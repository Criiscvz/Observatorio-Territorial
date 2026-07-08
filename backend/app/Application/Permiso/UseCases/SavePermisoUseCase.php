<?php

declare(strict_types=1);

namespace App\Application\Permiso\UseCases;

use App\Application\Permiso\DTOs\PermisoResponseDTO;
use App\Domain\Permiso\Entities\Permiso;
use App\Domain\Permiso\Repositories\PermisoRepositoryInterface;

class SavePermisoUseCase
{
    public function __construct(
        private readonly PermisoRepositoryInterface $permisoRepository,
    ) {}

    /**
     * Guarda o actualiza un permiso para un usuario.
     * Si el nivel es 'ninguno', elimina el permiso si existe.
     */
    public function execute(int $userId, string $modulo, string $nivel, ?string $departamentoId = null): ?PermisoResponseDTO
    {
        // Si es "ninguno", eliminar el permiso existente
        if ($nivel === Permiso::NIVEL_NINGUNO) {
            $existing = $this->permisoRepository->findOne($userId, $modulo, $departamentoId);
            if ($existing) {
                $this->permisoRepository->delete($existing->id);
            }
            return PermisoResponseDTO::fromNivel($userId, $modulo, $nivel, $departamentoId);
        }

        $permiso = Permiso::create(
            userId: $userId,
            modulo: $modulo,
            nivel: $nivel,
            departamentoId: $departamentoId,
        );

        $saved = $this->permisoRepository->save($permiso);

        return PermisoResponseDTO::fromEntity($saved);
    }

    /**
     * Guarda múltiples permisos de una vez (reemplaza todos los del usuario).
     * @param array $permisosData - Array de [modulo, nivel, departamento_id?]
     */
    public function saveAll(int $userId, array $permisosData): array
    {
        // Obtener permisos actuales para detectar los que ya no existen
        $existing = $this->permisoRepository->findByUserId($userId);

        // Construir key para identificar permisos existentes
        $incomingKeys = [];
        $results = [];

        foreach ($permisosData as $data) {
            $modulo = $data['modulo'];
            $nivel = $data['nivel'];
            $departamentoId = $data['departamento_id'] ?? null;

            $key = $modulo . '|' . ($departamentoId ?? '');
            $incomingKeys[] = $key;

            $result = $this->execute($userId, $modulo, $nivel, $departamentoId);
            if ($result) {
                $results[] = $result;
            }
        }

        // Eliminar permisos que ya no están en la nueva configuración
        foreach ($existing as $permiso) {
            $key = $permiso->modulo . '|' . ($permiso->departamentoId ?? '');
            if (!in_array($key, $incomingKeys)) {
                $this->permisoRepository->delete($permiso->id);
            }
        }

        return $results;
    }
}
