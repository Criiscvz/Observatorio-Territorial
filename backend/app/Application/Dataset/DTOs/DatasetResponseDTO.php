<?php

declare(strict_types=1);

namespace App\Application\Dataset\DTOs;

use App\Domain\Dataset\Entities\Dataset;

final readonly class DatasetResponseDTO
{
    public function __construct(
        public string $id,
        public string $departamentoId,
        public string $nombre,
        public ?string $descripcion,
        public string $estado,
        public int $totalRegistros,
        public ?string $fechaCarga,
        public ?array $variablesMetadatos,
    ) {}

    public static function fromEntity(Dataset $entity): self
    {
        return new self(
            id: $entity->id,
            departamentoId: $entity->departamentoId,
            nombre: $entity->nombre,
            descripcion: $entity->descripcion,
            estado: $entity->estado,
            totalRegistros: $entity->totalRegistros,
            fechaCarga: $entity->fechaCarga?->format('Y-m-d H:i:s'),
            variablesMetadatos: $entity->variablesMetadatos,
        );
    }

    public function toArray(): array
    {
        return [
            'id' => $this->id,
            'departamento_id' => $this->departamentoId,
            'nombre' => $this->nombre,
            'descripcion' => $this->descripcion,
            'estado' => $this->estado,
            'total_registros' => $this->totalRegistros,
            'fecha_carga' => $this->fechaCarga,
            'variables_metadatos' => $this->variablesMetadatos,
        ];
    }
}
