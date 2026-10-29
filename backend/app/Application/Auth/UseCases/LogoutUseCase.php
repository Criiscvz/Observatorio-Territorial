<?php

declare(strict_types=1);

namespace App\Application\Auth\UseCases;

use Illuminate\Support\Facades\Auth;

class LogoutUseCase
{
    public function execute(): void
    {
        // Sanctum authenticates the API request, but the browser session belongs to web.
        Auth::guard('web')->logout();
    }
}
