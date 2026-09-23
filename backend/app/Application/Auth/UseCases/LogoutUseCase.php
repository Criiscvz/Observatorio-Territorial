<?php

declare(strict_types=1);

namespace App\Application\Auth\UseCases;

use Illuminate\Support\Facades\Auth;

class LogoutUseCase
{
    public function execute(): void
    {
        Auth::logout();
    }
}
