<?php

declare(strict_types=1);

namespace App\Application\Profile\UseCases;

use App\Application\Profile\DTOs\UpdateProfileDTO;
use App\Application\Profile\Services\CommunityProfileUpdater;
use App\Models\User;
use Illuminate\Support\Facades\DB;

class UpdateProfileUseCase
{
    public function __construct(private readonly CommunityProfileUpdater $communityProfileUpdater) {}

    public function execute(User $user, UpdateProfileDTO $dto): User
    {
        return DB::transaction(function () use ($user, $dto) {
            // Actualizar nombre del usuario si se proporciona
            if ($dto->name !== null) {
                $user->name = $dto->name;
                $user->save();
            }

            // Actualizar o crear perfil
            $perfilData = [];

            if ($dto->telefono !== null) {
                $perfilData['telefono'] = $dto->telefono;
            }
            if ($dto->cargo !== null) {
                $perfilData['cargo'] = $dto->cargo;
            }
            if ($dto->bio !== null) {
                $perfilData['bio'] = $dto->bio;
            }

            if (! empty($perfilData)) {
                if ($user->perfil) {
                    $user->perfil->update($perfilData);
                } else {
                    $user->perfil()->create($perfilData);
                }
            }

            // Recargar relaciones
            $this->communityProfileUpdater->execute($user, $dto->community);
            $user->load(['perfil', 'intereses']);

            return $user;
        });
    }
}
