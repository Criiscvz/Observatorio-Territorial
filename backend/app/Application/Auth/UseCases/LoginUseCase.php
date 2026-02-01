<?php

declare(strict_types=1);

namespace App\Application\Auth\UseCases;

use App\Application\Auth\DTOs\AuthResponseDTO;
use App\Application\Auth\DTOs\LoginDTO;
use App\Models\User;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class LoginUseCase
{
    public function execute(LoginDTO $dto): AuthResponseDTO
    {
        $user = User::where('email', $dto->email)->first();

        if (!$user || !Hash::check($dto->password, $user->password)) {
            throw ValidationException::withMessages([
                'email' => ['Las credenciales proporcionadas son incorrectas.'],
            ]);
        }

        // Revocar todos los tokens anteriores del usuario
        $user->tokens()->delete();

        // Cargar relaciones necesarias
        $user->load(['perfil', 'departamentos']);

        // Crear nuevo token
        $token = $user->createToken('auth-token')->plainTextToken;

        return AuthResponseDTO::fromUser($user, $token);
    }
}
