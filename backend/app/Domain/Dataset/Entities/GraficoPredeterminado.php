<?php

declare(strict_types=1);

namespace App\Domain\Dataset\Entities;

class GraficoPredeterminado
{
    public function __construct(
        public readonly ?string $id,
        public readonly string $datasetId,
        public readonly string $titulo,
        public readonly ?string $descripcion,
        public readonly string $tipoGrafico,
        public readonly string $tipoAnalisis,
        public readonly string $variableXId,
        public readonly ?string $variableYId,
        public readonly ?array $filtros,
        public readonly ?array $configuracion,
        public readonly int $orden,
        public readonly bool $activo,
        public readonly int $creadoPor,
    ) {}

    public static function create(
        string $datasetId,
        string $titulo,
        string $tipoGrafico,
        string $tipoAnalisis,
        string $variableXId,
        int $creadoPor,
        ?string $descripcion = null,
        ?string $variableYId = null,
        ?array $filtros = null,
        ?array $configuracion = null,
        int $orden = 0,
    ): self {
        return new self(
            id: null,
            datasetId: $datasetId,
            titulo: $titulo,
            descripcion: $descripcion,
            tipoGrafico: $tipoGrafico,
            tipoAnalisis: $tipoAnalisis,
            variableXId: $variableXId,
            variableYId: $variableYId,
            filtros: $filtros,
            configuracion: $configuracion,
            orden: $orden,
            activo: true,
            creadoPor: $creadoPor,
        );
    }

    public function toArray(): array
    {
        return [
            'id' => $this->id,
            'dataset_id' => $this->datasetId,
            'titulo' => $this->titulo,
            'descripcion' => $this->descripcion,
            'tipo_grafico' => $this->tipoGrafico,
            'tipo_analisis' => $this->tipoAnalisis,
            'variable_x_id' => $this->variableXId,
            'variable_y_id' => $this->variableYId,
            'filtros' => $this->filtros,
            'configuracion' => $this->configuracion,
            'orden' => $this->orden,
            'activo' => $this->activo,
            'creado_por' => $this->creadoPor,
        ];
    }
}
