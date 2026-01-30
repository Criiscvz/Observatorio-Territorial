<?php

declare(strict_types=1);

namespace App\Application\Auth\UseCases;

use App\Models\User;

class GetCurrentUserUseCase
{
    public function execute(User $user): array
    {
        return [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
        ];
    }
}
