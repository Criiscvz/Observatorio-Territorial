<?php

declare(strict_types=1);

namespace App\Infrastructure\Persistence\Eloquent\Repositories;

use App\Domain\Dataset\Entities\Dataset;
use App\Domain\Dataset\Repositories\DatasetRepositoryInterface;
use App\Infrastructure\Persistence\Eloquent\Models\DatasetModel;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Support\Collection;

class EloquentDatasetRepository implements DatasetRepositoryInterface
{
    public function __construct(
        private readonly DatasetModel $model
    ) {}

    public function findById(string $id): ?Dataset
    {
        $model = $this->model->with('variablesMetadatos')->find($id);

        return $model ? $this->toDomain($model) : null;
    }

    public function findPublicById(string $id): ?Dataset
    {
        $model = $this->model
            ->with('variablesMetadatos')
            ->whereHas('departamento', fn($q) => $q->where('publico', true))
            ->find($id);

        return $model ? $this->toDomain($model) : null;
    }

    public function findByDepartamentoId(string $departamentoId): Collection
    {
        $models = $this->model
            ->where('departamento_id', $departamentoId)
            ->with('variablesMetadatos')
            ->orderBy('created_at', 'desc')
            ->get();

        return $models->map(fn($m) => $this->toDomain($m));
    }

    public function findCompletadosByDepartamentoId(string $departamentoId): Collection
    {
        $models = $this->model
            ->where('departamento_id', $departamentoId)
            ->completados()
            ->with('variablesMetadatos')
            ->orderBy('created_at', 'desc')
            ->get();

        return $models->map(fn($m) => $this->toDomain($m));
    }

    public function findByUserDepartamentos(int $userId, ?string $departamentoId = null): LengthAwarePaginator
    {
        $query = $this->model
            ->whereHas('departamento.usuarios', fn($q) => $q->where('user_id', $userId));

        if ($departamentoId) {
            $query->where('departamento_id', $departamentoId);
        }

        return $query->with(['departamento', 'variablesMetadatos'])
            ->orderBy('created_at', 'desc')
            ->paginate(15);
    }

    public function save(Dataset $dataset): Dataset
    {
        $model = $this->model->create([
            'departamento_id' => $dataset->departamentoId,
            'subido_por' => $dataset->subidoPor,
            'nombre' => $dataset->nombre,
            'nombre_archivo' => $dataset->nombreArchivo,
            'descripcion' => $dataset->descripcion,
            'estado' => $dataset->estado,
            'total_registros' => $dataset->totalRegistros,
            'fecha_carga' => $dataset->fechaCarga,
        ]);

        return $this->toDomain($model);
    }

    public function update(Dataset $dataset): Dataset
    {
        $model = $this->model->findOrFail($dataset->id);

        $model->update([
            'nombre' => $dataset->nombre,
            'descripcion' => $dataset->descripcion,
            'estado' => $dataset->estado,
            'total_registros' => $dataset->totalRegistros,
        ]);

        return $this->toDomain($model->fresh());
    }

    public function updateEstado(string $id, string $estado): bool
    {
        return $this->model->where('id', $id)->update(['estado' => $estado]) > 0;
    }

    public function delete(string $id): bool
    {
        return $this->model->find($id)?->delete() ?? false;
    }

    private function toDomain(DatasetModel $model): Dataset
    {
        $variables = null;
        if ($model->relationLoaded('variablesMetadatos')) {
            $variables = $model->variablesMetadatos->map(fn($v) => [
                'id' => $v->id,
                'nombre_columna' => $v->nombre_columna,
                'nombre_original' => $v->nombre_original,
                'tipo_dato' => $v->tipo_dato,
                'tipo_detectado' => $v->tipo_detectado,
                'es_visible' => $v->es_visible,
                'orden' => $v->orden,
            ])->toArray();
        }

        return new Dataset(
            id: $model->id,
            departamentoId: $model->departamento_id,
            subidoPor: $model->subido_por,
            nombre: $model->nombre,
            nombreArchivo: $model->nombre_archivo,
            descripcion: $model->descripcion,
            estado: $model->estado,
            totalRegistros: $model->total_registros ?? 0,
            fechaCarga: $model->fecha_carga ? new \DateTimeImmutable($model->fecha_carga->toDateTimeString()) : null,
            createdAt: $model->created_at ? new \DateTimeImmutable($model->created_at->toDateTimeString()) : null,
            updatedAt: $model->updated_at ? new \DateTimeImmutable($model->updated_at->toDateTimeString()) : null,
            variablesMetadatos: $variables,
        );
    }
}
