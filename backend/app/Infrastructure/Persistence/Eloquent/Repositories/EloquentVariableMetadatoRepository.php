<?php

declare(strict_types=1);

namespace App\Infrastructure\Persistence\Eloquent\Repositories;

use App\Domain\Dataset\Entities\VariableMetadato;
use App\Domain\Dataset\Repositories\VariableMetadatoRepositoryInterface;
use App\Infrastructure\Persistence\Eloquent\Models\VariableMetadatoModel;
use Illuminate\Support\Collection;

class EloquentVariableMetadatoRepository implements VariableMetadatoRepositoryInterface
{
    public function __construct(
        private readonly VariableMetadatoModel $model
    ) {}

    public function findById(string $id): ?VariableMetadato
    {
        $model = $this->model->find($id);
        
        return $model ? $this->toDomain($model) : null;
    }

    public function findByDatasetId(string $datasetId): Collection
    {
        $models = $this->model
            ->where('dataset_id', $datasetId)
            ->orderBy('orden')
            ->get();

        return $models->map(fn($m) => $this->toDomain($m));
    }

    public function findVisiblesByDatasetId(string $datasetId): Collection
    {
        $models = $this->model
            ->where('dataset_id', $datasetId)
            ->visibles()
            ->orderBy('orden')
            ->get();

        return $models->map(fn($m) => $this->toDomain($m));
    }

    public function findByDatasetIdAndNombreColumna(string $datasetId, string $nombreColumna): ?VariableMetadato
    {
        $model = $this->model
            ->where('dataset_id', $datasetId)
            ->where('nombre_columna', $nombreColumna)
            ->first();

        return $model ? $this->toDomain($model) : null;
    }

    public function save(VariableMetadato $variable): VariableMetadato
    {
        $model = $this->model->create([
            'dataset_id' => $variable->datasetId,
            'nombre_columna' => $variable->nombreColumna,
            'nombre_original' => $variable->nombreOriginal,
            'tipo_dato' => $variable->tipoDato,
            'tipo_detectado' => $variable->tipoDetectado,
            'es_visible' => $variable->esVisible,
            'orden' => $variable->orden,
            'opciones' => $variable->opciones,
        ]);

        return $this->toDomain($model);
    }

    public function saveBatch(string $datasetId, array $variables): Collection
    {
        $saved = collect();
        
        foreach ($variables as $index => $var) {
            $model = $this->model->create([
                'dataset_id' => $datasetId,
                'nombre_columna' => $var['nombre_columna'],
                'nombre_original' => $var['nombre_original'],
                'tipo_dato' => $var['tipo_dato'],
                'tipo_detectado' => $var['tipo_detectado'],
                'es_visible' => $var['es_visible'] ?? true,
                'orden' => $index,
                'opciones' => $var['opciones'] ?? null,
            ]);
            
            $saved->push($this->toDomain($model));
        }

        return $saved;
    }

    public function update(VariableMetadato $variable): VariableMetadato
    {
        $model = $this->model->findOrFail($variable->id);
        
        $model->update([
            'nombre_columna' => $variable->nombreColumna,
            'tipo_dato' => $variable->tipoDato,
            'es_visible' => $variable->esVisible,
        ]);

        return $this->toDomain($model->fresh());
    }

    public function deleteByDatasetId(string $datasetId): bool
    {
        return $this->model->where('dataset_id', $datasetId)->delete() > 0;
    }

    private function toDomain(VariableMetadatoModel $model): VariableMetadato
    {
        return new VariableMetadato(
            id: $model->id,
            datasetId: $model->dataset_id,
            nombreColumna: $model->nombre_columna,
            nombreOriginal: $model->nombre_original,
            tipoDato: $model->tipo_dato,
            tipoDetectado: $model->tipo_detectado,
            esVisible: (bool) $model->es_visible,
            orden: $model->orden ?? 0,
            opciones: $model->opciones,
        );
    }
}
