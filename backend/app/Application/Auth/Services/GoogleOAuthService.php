<?php

declare(strict_types=1);

namespace App\Application\Auth\Services;

use App\Models\OAuthLoginCode;
use App\Models\User;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use RuntimeException;

class GoogleOAuthService
{
    private const STATE_TTL_SECONDS = 600;
    private const LOGIN_CODE_TTL_SECONDS = 60;

    public function authorizationUrl(): string
    {
        $this->assertConfigured();

        $state = $this->randomUrlSafe(32);
        $nonce = $this->randomUrlSafe(32);
        $verifier = $this->randomUrlSafe(64);
        $challenge = $this->base64Url(hash('sha256', $verifier, true));

        Cache::put($this->stateKey($state), [
            'nonce' => $nonce,
            'verifier' => $verifier,
        ], self::STATE_TTL_SECONDS);

        return 'https://accounts.google.com/o/oauth2/v2/auth?'.http_build_query([
            'client_id' => config('services.google.client_id'),
            'redirect_uri' => config('services.google.redirect'),
            'response_type' => 'code',
            'scope' => 'openid email profile',
            'state' => $state,
            'nonce' => $nonce,
            'code_challenge' => $challenge,
            'code_challenge_method' => 'S256',
            'prompt' => 'select_account',
        ], '', '&', PHP_QUERY_RFC3986);
    }

    public function handleCallback(string $authorizationCode, string $state): string
    {
        $this->assertConfigured();
        $stateData = Cache::pull($this->stateKey($state));

        if (!is_array($stateData)) {
            throw new RuntimeException('El intento de Google expiró o no es válido.');
        }

        $tokenResponse = Http::asForm()->timeout(15)->post('https://oauth2.googleapis.com/token', [
            'code' => $authorizationCode,
            'client_id' => config('services.google.client_id'),
            'client_secret' => config('services.google.client_secret'),
            'redirect_uri' => config('services.google.redirect'),
            'grant_type' => 'authorization_code',
            'code_verifier' => $stateData['verifier'],
        ])->throw()->json();

        $idToken = $tokenResponse['id_token'] ?? null;
        if (!is_string($idToken) || $idToken === '') {
            throw new RuntimeException('Google no devolvió una identidad válida.');
        }

        // Google's tokeninfo endpoint validates the ID token signature and expiry.
        $claims = Http::timeout(15)
            ->get('https://oauth2.googleapis.com/tokeninfo', ['id_token' => $idToken])
            ->throw()
            ->json();

        $issuer = $claims['iss'] ?? null;
        if (!in_array($issuer, ['https://accounts.google.com', 'accounts.google.com'], true)
            || !hash_equals((string) config('services.google.client_id'), (string) ($claims['aud'] ?? ''))
            || !hash_equals((string) $stateData['nonce'], (string) ($claims['nonce'] ?? ''))
            || (int) ($claims['exp'] ?? 0) <= time()
            || filter_var($claims['email_verified'] ?? false, FILTER_VALIDATE_BOOLEAN) !== true
            || empty($claims['sub'])
            || !filter_var($claims['email'] ?? null, FILTER_VALIDATE_EMAIL)) {
            throw new RuntimeException('La identidad proporcionada por Google no es válida.');
        }

        $email = Str::lower(trim((string) $claims['email']));
        $googleId = (string) $claims['sub'];

        $user = DB::transaction(function () use ($email, $googleId, $claims): User {
            $userByGoogle = User::query()->where('google_id', $googleId)->lockForUpdate()->first();
            if ($userByGoogle) {
                if (Str::lower($userByGoogle->email) !== $email) {
                    throw new RuntimeException('La cuenta Google no coincide con el usuario vinculado.');
                }
                return $userByGoogle;
            }

            $user = User::query()->whereRaw('LOWER(email) = ?', [$email])->lockForUpdate()->first();
            if ($user && $user->google_id !== null && !hash_equals($user->google_id, $googleId)) {
                throw new RuntimeException('El correo ya está vinculado con otra cuenta Google.');
            }

            if (!$user) {
                $user = User::create([
                    'name' => trim((string) ($claims['name'] ?? 'Usuario Google')),
                    'email' => $email,
                    'password' => Hash::make(Str::random(64)),
                    'rol' => 'USER',
                    'google_id' => $googleId,
                    'email_verified_at' => now(),
                ]);
                $user->perfil()->create([]);
            } else {
                // Linking is only reached after Google has cryptographically proved
                // control of this exact, verified email address.
                $user->forceFill([
                    'google_id' => $googleId,
                    'email_verified_at' => $user->email_verified_at ?? now(),
                ])->save();
            }

            return $user;
        });

        $plainCode = $this->randomUrlSafe(32);
        OAuthLoginCode::create([
            'user_id' => $user->id,
            'code_hash' => hash('sha256', $plainCode),
            'expires_at' => now()->addSeconds(self::LOGIN_CODE_TTL_SECONDS),
        ]);

        return $plainCode;
    }

    public function consumeLoginCode(string $plainCode): User
    {
        $codeHash = hash('sha256', $plainCode);

        $result = DB::transaction(function () use ($codeHash): ?User {
            $loginCode = OAuthLoginCode::query()
                ->where('code_hash', $codeHash)
                ->lockForUpdate()
                ->first();

            if (!$loginCode || $loginCode->used_at !== null || $loginCode->expires_at->isPast()) {
                return null;
            }

            $loginCode->update(['used_at' => now()]);
            return User::query()->find($loginCode->user_id);
        });

        if (!$result) {
            throw new RuntimeException('El acceso de Google expiró o ya fue utilizado.');
        }

        return $result;
    }

    private function assertConfigured(): void
    {
        foreach (['client_id', 'client_secret', 'redirect'] as $key) {
            if (!is_string(config("services.google.$key")) || config("services.google.$key") === '') {
                throw new RuntimeException('Google OAuth no está configurado.');
            }
        }
    }

    private function stateKey(string $state): string
    {
        return 'google-oauth-state:'.hash('sha256', $state);
    }

    private function randomUrlSafe(int $bytes): string
    {
        return $this->base64Url(random_bytes($bytes));
    }

    private function base64Url(string $value): string
    {
        return rtrim(strtr(base64_encode($value), '+/', '-_'), '=');
    }
}
