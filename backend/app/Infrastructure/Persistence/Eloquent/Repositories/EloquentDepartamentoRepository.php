<?php

declare(strict_types=1);

namespace App\Infrastructure\Persistence\Eloquent\Repositories;

use App\Domain\Departamento\Entities\Departamento;
use App\Domain\Departamento\Repositories\DepartamentoRepositoryInterface;
use App\Infrastructure\Persistence\Eloquent\Models\DepartamentoModel;
use Illuminate\Support\Collection;

class EloquentDepartamentoRepository implements DepartamentoRepositoryInterface
{
    public function __construct(
        private readonly DepartamentoModel $model
    ) {}

    public function findById(string $id): ?Departamento
    {
        $model = $this->model->with('datasets')->find($id);

        return $model ? $this->toDomain($model) : null;
    }

    public function findPublicById(string $id): ?Departamento
    {
        $model = $this->model
            ->where('publico', true)
            ->with(['datasets' => fn($q) => $q->where('estado', 'COMPLETADO')])
            ->find($id);

        return $model ? $this->toDomain($model) : null;
    }

    public function findByCodigoInterno(string $codigo): ?Departamento
    {
        $model = $this->model->where('codigo_interno', $codigo)->first();

        return $model ? $this->toDomain($model) : null;
    }

    public function findAllByUserId(int $userId): Collection
    {
        $models = $this->model
            ->whereHas('usuarios', fn($q) => $q->where('user_id', $userId))
            ->with(['datasets' => fn($q) => $q->select('id', 'departamento_id', 'nombre', 'estado', 'total_registros')])
            ->get();

        return $models->map(fn($m) => $this->toDomain($m));
    }

    public function findPublicos(): Collection
    {
        $models = $this->model
            ->publicos()
            ->with(['datasets' => fn($q) => $q->where('estado', 'COMPLETADO')])
            ->get();

        return $models->map(fn($m) => $this->toDomain($m));
    }

    public function save(Departamento $departamento): Departamento
    {
        $model = $this->model->create([
            'nombre' => $departamento->nombre,
            'codigo_interno' => $departamento->codigoInterno,
            'descripcion' => $departamento->descripcion,
            'icono' => $departamento->icono,
            'publico' => $departamento->publico,
        ]);

        return $this->toDomain($model);
    }

    public function update(Departamento $departamento): Departamento
    {
        $model = $this->model->findOrFail($departamento->id);

        $model->update([
            'nombre' => $departamento->nombre,
            'descripcion' => $departamento->descripcion,
            'icono' => $departamento->icono,
            'publico' => $departamento->publico,
        ]);

        return $this->toDomain($model->fresh());
    }

    public function delete(string $id): bool
    {
        return $this->model->find($id)?->delete() ?? false;
    }

    public function existsForUser(string $departamentoId, int $userId): bool
    {
        return $this->model
            ->where('id', $departamentoId)
            ->whereHas('usuarios', fn($q) => $q->where('user_id', $userId))
            ->exists();
    }

    public function getUserRole(string $departamentoId, int $userId): ?string
    {
        $model = $this->model
            ->where('id', $departamentoId)
            ->whereHas('usuarios', fn($q) => $q->where('user_id', $userId))
            ->with(['usuarios' => fn($q) => $q->where('user_id', $userId)])
            ->first();

        if (!$model || $model->usuarios->isEmpty()) {
            return null;
        }

        return $model->usuarios->first()->pivot->rol;
    }

    private function toDomain(DepartamentoModel $model): Departamento
    {
        $datasets = null;
        if ($model->relationLoaded('datasets')) {
            $datasets = $model->datasets->map(fn($d) => [
                'id' => $d->id,
                'nombre' => $d->nombre,
                'estado' => $d->estado,
                'total_registros' => $d->total_registros,
            ])->toArray();
        }

        return new Departamento(
            id: $model->id,
            nombre: $model->nombre,
            codigoInterno: $model->codigo_interno,
            descripcion: $model->descripcion,
            icono: $model->icono,
            publico: (bool) $model->publico,
            createdAt: $model->created_at ? new \DateTimeImmutable($model->created_at->toDateTimeString()) : null,
            updatedAt: $model->updated_at ? new \DateTimeImmutable($model->updated_at->toDateTimeString()) : null,
            datasets: $datasets,
        );
    }
}
