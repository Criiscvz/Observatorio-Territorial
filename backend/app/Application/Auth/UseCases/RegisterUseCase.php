<?php

declare(strict_types=1);

namespace App\Application\Auth\UseCases;

use App\Application\Auth\DTOs\AuthResponseDTO;
use App\Application\Auth\DTOs\RegisterDTO;
use App\Models\User;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\DB;

class RegisterUseCase
{
    public function execute(RegisterDTO $dto): AuthResponseDTO
    {
        return DB::transaction(function () use ($dto) {
            // Crear usuario con rol USER por defecto
            $user = User::create([
                'name' => $dto->name,
                'email' => $dto->email,
                'password' => Hash::make($dto->password),
                'rol' => 'USER',
            ]);

            // Crear perfil vacío automáticamente
            $user->perfil()->create([]);

            // Cargar relaciones
            $user->load(['perfil', 'departamentos']);

            // Crear token de autenticación
            $durationMinutes = $this->getSessionDurationMinutes($user);
            $expiresAt = now()->addMinutes($durationMinutes);
            $token = $user->createToken('auth-token', ['*'], $expiresAt)->plainTextToken;

            return AuthResponseDTO::fromUser($user, $token, $expiresAt, $durationMinutes * 60);
        });
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
