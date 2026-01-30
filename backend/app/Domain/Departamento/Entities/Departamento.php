<?php

declare(strict_types=1);

namespace App\Domain\Departamento\Entities;

use App\Domain\Shared\ValueObjects\Uuid;

class Departamento
{
    public function __construct(
        public readonly ?string $id,
        public readonly string $nombre,
        public readonly string $codigoInterno,
        public readonly ?string $descripcion,
        public readonly bool $publico,
        public readonly ?\DateTimeImmutable $createdAt = null,
        public readonly ?\DateTimeImmutable $updatedAt = null,
        public readonly ?array $datasets = null,
    ) {}

    public static function create(
        string $nombre,
        string $codigoInterno,
        ?string $descripcion = null,
        bool $publico = false
    ): self {
        return new self(
            id: null,
            nombre: $nombre,
            codigoInterno: $codigoInterno,
            descripcion: $descripcion,
            publico: $publico,
        );
    }

    public function withId(string $id): self
    {
        return new self(
            id: $id,
            nombre: $this->nombre,
            codigoInterno: $this->codigoInterno,
            descripcion: $this->descripcion,
            publico: $this->publico,
            createdAt: $this->createdAt,
            updatedAt: $this->updatedAt,
            datasets: $this->datasets,
        );
    }

    public function update(
        ?string $nombre = null,
        ?string $descripcion = null,
        ?bool $publico = null
    ): self {
        return new self(
            id: $this->id,
            nombre: $nombre ?? $this->nombre,
            codigoInterno: $this->codigoInterno,
            descripcion: $descripcion ?? $this->descripcion,
            publico: $publico ?? $this->publico,
            createdAt: $this->createdAt,
            updatedAt: new \DateTimeImmutable(),
            datasets: $this->datasets,
        );
    }

    public function toArray(): array
    {
        return [
            'id' => $this->id,
            'nombre' => $this->nombre,
            'codigo_interno' => $this->codigoInterno,
            'descripcion' => $this->descripcion,
            'publico' => $this->publico,
            'created_at' => $this->createdAt?->format('Y-m-d H:i:s'),
            'updated_at' => $this->updatedAt?->format('Y-m-d H:i:s'),
        ];
    }
}
