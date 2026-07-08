<?php

declare(strict_types=1);

namespace App\Domain\Permiso\Repositories;

use App\Domain\Permiso\Entities\Permiso;
use Illuminate\Support\Collection;

interface PermisoRepositoryInterface
{
    /**
     * Obtiene todos los permisos de un usuario.
     */
    public function findByUserId(int $userId): Collection;

    /**
     * Obtiene el permiso de un usuario para un módulo y departamento específicos.
     */
    public function findOne(int $userId, string $modulo, ?string $departamentoId = null): ?Permiso;

    /**
     * Guarda o actualiza un permiso (upsert).
     */
    public function save(Permiso $permiso): Permiso;

    /**
     * Elimina un permiso.
     */
    public function delete(string $id): bool;
}
