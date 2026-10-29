<?php

declare(strict_types=1);

namespace App\Application\Auth\UseCases;

use App\Application\Auth\DTOs\AuthResponseDTO;
use App\Application\Auth\DTOs\LoginDTO;
use App\Models\User;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;
use App\Domain\Shared\Exceptions\ApiException;

class LoginUseCase
{
    public function execute(LoginDTO $dto): AuthResponseDTO
    {
        $user = User::query()->whereRaw('LOWER(email) = ?', [$dto->email])->first();

        if (!$user || !Hash::check($dto->password, $user->password)) {
            throw ValidationException::withMessages([
                'email' => ['Las credenciales proporcionadas son incorrectas.'],
            ]);
        }

        if ($user->email_verified_at === null) {
            throw new ApiException(
                'EMAIL_VERIFICATION_REQUIRED',
                'Debes verificar tu correo electrónico antes de continuar.',
                403,
                ['email' => $user->email],
            );
        }

        // Cargar relaciones necesarias
        $user->load(['perfil', 'departamentos']);

        Auth::login($user);

        return AuthResponseDTO::fromUser($user);
    }
}
