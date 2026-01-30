<?php

declare(strict_types=1);

namespace App\Application\Auth\UseCases;

use App\Application\Auth\DTOs\AuthResponseDTO;
use App\Application\Auth\DTOs\RegisterDTO;
use App\Models\User;
use Illuminate\Support\Facades\Hash;

class RegisterUseCase
{
    public function execute(RegisterDTO $dto): AuthResponseDTO
    {
        $user = User::create([
            'name' => $dto->name,
            'email' => $dto->email,
            'password' => Hash::make($dto->password),
        ]);

        $token = $user->createToken('auth-token')->plainTextToken;

        return new AuthResponseDTO(
            userId: $user->id,
            name: $user->name,
            email: $user->email,
            token: $token,
        );
    }
}
