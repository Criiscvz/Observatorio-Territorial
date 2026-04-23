<?php

declare(strict_types=1);

namespace App\Domain\Dataset\Entities;

class DatasetFuente
{
    public function __construct(
        public readonly ?string $id,
        public readonly string $datasetId,
        public readonly string $titulo,
        public readonly string $url,
        public readonly ?string $descripcion,
        public readonly int $orden,
    ) {}

    public static function create(
        string $datasetId,
        string $titulo,
        string $url,
        ?string $descripcion = null,
        int $orden = 0,
    ): self {
        return new self(
            id: null,
            datasetId: $datasetId,
            titulo: $titulo,
            url: $url,
            descripcion: $descripcion,
            orden: $orden,
        );
    }

    public function toArray(): array
    {
        return [
            'id' => $this->id,
            'dataset_id' => $this->datasetId,
            'titulo' => $this->titulo,
            'url' => $this->url,
            'descripcion' => $this->descripcion,
            'orden' => $this->orden,
        ];
    }
}
