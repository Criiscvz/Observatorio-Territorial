<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

class EnsureActiveAccount
{
    public function handle(Request $request, Closure $next): Response
    {
        // Resolve the same optional guard used by public PDF/subscriber resources too.
        // Anonymous requests do not need a database lookup for account status.
        $user = $request->user('sanctum');
        if ($user && ! $user->isActive()) {
            if ($request->hasSession()) {
                Auth::guard('web')->logout();
                $request->session()->invalidate();
                $request->session()->regenerateToken();
            }

            return response()->json(['message' => 'Tu cuenta está desactivada.'], 401);
        }

        return $next($request);
    }
}
