<?php

declare(strict_types=1);

namespace App\Application\Departamento\DTOs;

use App\Domain\Departamento\Entities\Departamento;

final readonly class DepartamentoResponseDTO
{
    public function __construct(
        public string $id,
        public string $nombre,
        public string $codigoInterno,
        public ?string $descripcion,
        public ?string $icono,
        public bool $publico,
        public ?string $createdAt,
        public ?array $datasets,
        public ?string $userRole,
    ) {}

    public static function fromEntity(Departamento $entity, ?string $userRole = null): self
    {
        return new self(
            id: $entity->id,
            nombre: $entity->nombre,
            codigoInterno: $entity->codigoInterno,
            descripcion: $entity->descripcion,
            icono: $entity->icono,
            publico: $entity->publico,
            createdAt: $entity->createdAt?->format('Y-m-d H:i:s'),
            datasets: $entity->datasets,
            userRole: $userRole,
        );
    }

    public function toArray(): array
    {
        return [
            'id' => $this->id,
            'nombre' => $this->nombre,
            'codigo_interno' => $this->codigoInterno,
            'descripcion' => $this->descripcion,
            'icono' => $this->icono,
            'publico' => $this->publico,
            'created_at' => $this->createdAt,
            'datasets' => $this->datasets,
            'user_role' => $this->userRole,
        ];
    }
}
