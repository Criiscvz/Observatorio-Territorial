<?php

declare(strict_types=1);

namespace App\Application\Dataset\DTOs;

final readonly class AnalysisResultDTO
{
    public function __construct(
        public string $datasetId,
        public string $nombreArchivo,
        public int $totalFilas,
        public int $totalColumnas,
        public array $columnas,
        public array $muestra,
    ) {}

    public function toArray(): array
    {
        return [
            'dataset_id' => $this->datasetId,
            'nombre_archivo' => $this->nombreArchivo,
            'total_filas' => $this->totalFilas,
            'total_columnas' => $this->totalColumnas,
            'columnas' => $this->columnas,
            'muestra' => $this->muestra,
        ];
    }
}
