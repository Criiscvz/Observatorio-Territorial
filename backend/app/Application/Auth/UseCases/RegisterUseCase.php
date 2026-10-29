<?php

declare(strict_types=1);

namespace App\Application\Auth\UseCases;

use App\Application\Auth\DTOs\RegisterDTO;
use App\Application\Profile\Services\CommunityProfileUpdater;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

class RegisterUseCase
{
    public function __construct(private readonly CommunityProfileUpdater $communityProfileUpdater) {}

    public function execute(RegisterDTO $dto): User
    {
        return DB::transaction(function () use ($dto) {
            // Crear usuario con rol USER por defecto
            $user = User::create([
                'name' => $dto->name,
                'email' => $dto->email,
                'password' => Hash::make($dto->password),
                'rol' => 'USER',
                'email_verified_at' => null,
            ]);

            // Crear perfil vacío automáticamente
            $user->perfil()->create([]);
            $this->communityProfileUpdater->execute($user, $dto->community);

            return $user;
        });
    }
}
