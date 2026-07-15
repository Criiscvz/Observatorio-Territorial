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

        $durationMinutes = $this->getSessionDurationMinutes($user);
        $expiresAt = now()->addMinutes($durationMinutes);

        // Crear nuevo token con expiracion por rol.
        $token = $user->createToken('auth-token', ['*'], $expiresAt)->plainTextToken;

        return AuthResponseDTO::fromUser($user, $token, $expiresAt, $durationMinutes * 60);
    }

    private function getSessionDurationMinutes(User $user): int
    {
        $role = strtoupper((string) ($user->rol ?? 'USER'));

        return match ($role) {
            'ADMIN', 'EDITOR' => 480,
            'SUSCRIPTOR', 'SUBSCRIPTOR', 'SUBSCRIBER', 'USER' => 1440,
            default => 1440,
        };
    }
}
