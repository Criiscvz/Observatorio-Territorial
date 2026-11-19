<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

class EnsureActiveAccount
{
    public const EMAIL_VERIFICATION_PAUSED_SESSION = 'email_verification_paused';

    public function handle(Request $request, Closure $next): Response
    {
        // Resolve the same optional guard used by public PDF/subscriber resources too.
        // Anonymous requests do not need a database lookup for account status.
        $user = $request->user('sanctum');
        if (!$user) {
            return $next($request);
        }

        // Browser sessions opened without a verified email during the pause must reauthenticate.
        $verificationResumed = config('verification.required') !== false
            && $user->email_verified_at === null
            && $request->hasSession()
            && $request->session()->get(self::EMAIL_VERIFICATION_PAUSED_SESSION) === true;

        $message = match (true) {
            !$user->isActive() => 'Tu cuenta está desactivada.',
            $verificationResumed => 'Debes verificar tu correo electrónico antes de continuar.',
            default => null,
        };

        if ($message !== null) {
            if ($request->hasSession()) {
                Auth::guard('web')->logout();
                $request->session()->invalidate();
                $request->session()->regenerateToken();
            }

            return response()->json(['message' => $message], 401);
        }

        return $next($request);
    }
}
