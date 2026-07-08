<?php

declare(strict_types=1);

namespace App\Infrastructure\Persistence\Eloquent\Repositories;

use App\Domain\Permiso\Entities\Permiso;
use App\Domain\Permiso\Repositories\PermisoRepositoryInterface;
use App\Infrastructure\Persistence\Eloquent\Models\PermisoModel;
use Illuminate\Support\Collection;

class EloquentPermisoRepository implements PermisoRepositoryInterface
{
    public function __construct(
        private readonly PermisoModel $model
    ) {}

    public function findByUserId(int $userId): Collection
    {
        return $this->model
            ->where('user_id', $userId)
            ->get()
            ->map(fn($m) => $this->toDomain($m));
    }

    public function findOne(int $userId, string $modulo, ?string $departamentoId = null): ?Permiso
    {
        $query = $this->model
            ->where('user_id', $userId)
            ->where('modulo', $modulo);

        if ($departamentoId !== null) {
            $query->where('departamento_id', $departamentoId);
        } else {
            $query->whereNull('departamento_id');
        }

        $model = $query->first();

        return $model ? $this->toDomain($model) : null;
    }

    public function save(Permiso $permiso): Permiso
    {
        // Upsert: buscar si ya existe un permiso para este usuario+módulo+departamento
        $existing = $this->model
            ->where('user_id', $permiso->userId)
            ->where('modulo', $permiso->modulo)
            ->where('departamento_id', $permiso->departamentoId)
            ->first();

        if ($existing) {
            $existing->update([
                'nivel' => $permiso->nivel,
            ]);
            return $this->toDomain($existing->fresh());
        }

        $model = $this->model->create([
            'user_id' => $permiso->userId,
            'modulo' => $permiso->modulo,
            'nivel' => $permiso->nivel,
            'departamento_id' => $permiso->departamentoId,
        ]);

        return $this->toDomain($model);
    }

    public function delete(string $id): bool
    {
        return $this->model->find($id)?->delete() ?? false;
    }

    private function toDomain(PermisoModel $model): Permiso
    {
        return new Permiso(
            id: $model->id,
            userId: $model->user_id,
            modulo: $model->modulo,
            nivel: $model->nivel,
            departamentoId: $model->departamento_id,
            createdAt: $model->created_at ? new \DateTimeImmutable($model->created_at->toDateTimeString()) : null,
            updatedAt: $model->updated_at ? new \DateTimeImmutable($model->updated_at->toDateTimeString()) : null,
        );
    }
}
