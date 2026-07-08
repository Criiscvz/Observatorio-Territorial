<?php

declare(strict_types=1);

namespace App\Application\Permiso\UseCases;

use App\Application\Permiso\DTOs\PermisoResponseDTO;
use App\Domain\Permiso\Repositories\PermisoRepositoryInterface;
use Illuminate\Support\Collection;

class GetPermisosUseCase
{
    public function __construct(
        private readonly PermisoRepositoryInterface $permisoRepository,
    ) {}

    /**
     * Obtiene todos los permisos de un usuario.
     * @return Collection<PermisoResponseDTO>
     */
    public function execute(int $userId): Collection
    {
        return $this->permisoRepository
            ->findByUserId($userId)
            ->map(fn($p) => PermisoResponseDTO::fromEntity($p));
    }
}
