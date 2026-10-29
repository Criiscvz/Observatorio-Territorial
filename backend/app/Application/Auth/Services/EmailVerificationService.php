<?php

declare(strict_types=1);

namespace App\Application\Auth\Services;

use App\Mail\EmailVerificationCodeMail;
use App\Models\EmailVerificationCode;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Validation\ValidationException;
use Throwable;

class EmailVerificationService
{
    public const EXPIRES_MINUTES = 10;
    public const RESEND_COOLDOWN_SECONDS = 60;
    public const MAX_ATTEMPTS = 3;

    public function send(User $user, bool $enforceCooldown = true): void
    {
        if ($user->email_verified_at !== null) {
            return;
        }

        $code = (string) random_int(100000, 999999);

        $verification = DB::transaction(function () use ($user, $code, $enforceCooldown): EmailVerificationCode {
            User::query()->whereKey($user->id)->lockForUpdate()->firstOrFail();

            $latest = EmailVerificationCode::query()
                ->where('user_id', $user->id)
                ->latest('created_at')
                ->first();

            if ($enforceCooldown && $latest && $latest->created_at->addSeconds(self::RESEND_COOLDOWN_SECONDS)->isFuture()) {
                throw ValidationException::withMessages([
                    'email' => ['Espera antes de solicitar un nuevo código.'],
                ]);
            }

            EmailVerificationCode::query()
                ->where('user_id', $user->id)
                ->whereNull('used_at')
                ->update(['used_at' => now(), 'updated_at' => now()]);

            return EmailVerificationCode::create([
                'user_id' => $user->id,
                'code_hash' => Hash::make($code),
                'attempts' => 0,
                'expires_at' => now()->addMinutes(self::EXPIRES_MINUTES),
            ]);
        });

        try {
            Mail::to($user->email)->send(new EmailVerificationCodeMail($code));
        } catch (Throwable $exception) {
            // A code that was never delivered must never remain valid. Deleting
            // it also lets the user retry immediately after a transient outage.
            $verification->delete();

            throw $exception;
        }
    }

    public function verify(User $user, string $code): User
    {
        $result = DB::transaction(function () use ($user, $code): array {
            $lockedUser = User::query()->whereKey($user->id)->lockForUpdate()->firstOrFail();

            if ($lockedUser->email_verified_at !== null) {
                return ['error' => 'El correo ya fue verificado.'];
            }

            $verification = EmailVerificationCode::query()
                ->where('user_id', $lockedUser->id)
                ->whereNull('used_at')
                ->latest('created_at')
                ->lockForUpdate()
                ->first();

            if (!$verification || $verification->expires_at->isPast()) {
                if ($verification) {
                    $verification->update(['used_at' => now()]);
                }
                return ['error' => 'El código expiró o ya no es válido.'];
            }

            if ($verification->attempts >= self::MAX_ATTEMPTS) {
                $verification->update(['used_at' => now()]);
                return ['error' => 'Demasiados intentos. Solicita un código nuevo.'];
            }

            if (!Hash::check($code, $verification->code_hash)) {
                $verification->increment('attempts');
                if ($verification->fresh()->attempts >= self::MAX_ATTEMPTS) {
                    $verification->update(['used_at' => now()]);
                }
                return ['error' => 'El código es incorrecto.'];
            }

            $verification->update(['used_at' => now()]);
            $lockedUser->forceFill(['email_verified_at' => now()])->save();

            return ['user' => $lockedUser->fresh()];
        });

        if (isset($result['error'])) {
            throw ValidationException::withMessages(['code' => [$result['error']]]);
        }

        return $result['user'];
    }
}
