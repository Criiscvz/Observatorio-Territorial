<?php

namespace Tests\Feature;

use App\Application\Auth\Services\GoogleOAuthService;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Factory as HttpFactory;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class GoogleOAuthServiceTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        config()->set('services.google', [
            'client_id' => 'google-client.test',
            'client_secret' => 'secret-for-tests',
            'redirect' => 'http://localhost:8000/api/auth/google/callback',
        ]);
    }

    public function test_google_creates_verified_user_and_reuses_same_account(): void
    {
        $service = app(GoogleOAuthService::class);
        $first = $this->completeGoogle($service, 'google-123', 'google@example.test');
        $user = $service->consumeLoginCode($first);

        $this->assertNotNull($user->email_verified_at);
        $this->assertSame('google-123', $user->google_id);
        $this->assertSame(1, User::where('email', 'google@example.test')->count());

        $second = $this->completeGoogle($service, 'google-123', 'google@example.test');
        $sameUser = $service->consumeLoginCode($second);
        $this->assertSame($user->id, $sameUser->id);
        $this->assertSame(1, User::where('email', 'google@example.test')->count());
    }

    public function test_verified_google_identity_safely_links_existing_local_email(): void
    {
        $existing = User::factory()->create([
            'email' => 'linked@example.test',
            'password' => Hash::make('local-password'),
            'google_id' => null,
        ]);
        $existing->perfil()->create([]);

        $service = app(GoogleOAuthService::class);
        $loginCode = $this->completeGoogle($service, 'google-linked', 'linked@example.test');
        $linked = $service->consumeLoginCode($loginCode);

        $this->assertSame($existing->id, $linked->id);
        $this->assertSame('google-linked', $linked->google_id);
        $this->assertSame(1, User::where('email', 'linked@example.test')->count());
    }

    public function test_google_login_code_is_single_use(): void
    {
        $service = app(GoogleOAuthService::class);
        $loginCode = $this->completeGoogle($service, 'google-once', 'once@example.test');
        $service->consumeLoginCode($loginCode);

        $this->expectException(\RuntimeException::class);
        $service->consumeLoginCode($loginCode);
    }

    private function completeGoogle(GoogleOAuthService $service, string $subject, string $email): string
    {
        $url = $service->authorizationUrl();
        parse_str((string) parse_url($url, PHP_URL_QUERY), $query);
        $state = $query['state'];
        $stateData = Cache::get('google-oauth-state:'.hash('sha256', $state));

        Http::swap(new HttpFactory());
        Http::fake([
            'https://oauth2.googleapis.com/token' => Http::response(['id_token' => 'signed-id-token']),
            'https://oauth2.googleapis.com/tokeninfo*' => Http::response([
                'iss' => 'https://accounts.google.com', 'aud' => 'google-client.test',
                'exp' => time() + 300, 'nonce' => $stateData['nonce'],
                'sub' => $subject, 'email' => $email, 'email_verified' => 'true',
                'name' => 'Google User',
            ]),
        ]);

        return $service->handleCallback('authorization-code', $state);
    }
}
