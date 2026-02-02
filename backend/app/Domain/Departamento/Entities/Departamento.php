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
        public readonly ?string $icono,
        public readonly bool $publico,
        public readonly ?\DateTimeImmutable $createdAt = null,
        public readonly ?\DateTimeImmutable $updatedAt = null,
        public readonly ?array $datasets = null,
    ) {}

    public static function create(
        string $nombre,
        string $codigoInterno,
        ?string $descripcion = null,
        ?string $icono = null,
        bool $publico = false
    ): self {
        return new self(
            id: null,
            nombre: $nombre,
            codigoInterno: $codigoInterno,
            descripcion: $descripcion,
            icono: $icono,
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
            icono: $this->icono,
            publico: $this->publico,
            createdAt: $this->createdAt,
            updatedAt: $this->updatedAt,
            datasets: $this->datasets,
        );
    }

    public function update(
        ?string $nombre = null,
        ?string $codigoInterno = null,
        ?string $descripcion = null,
        ?string $icono = null,
        ?bool $publico = null
    ): self {
        return new self(
            id: $this->id,
            nombre: $nombre ?? $this->nombre,
            codigoInterno: $codigoInterno ?? $this->codigoInterno,
            descripcion: $descripcion ?? $this->descripcion,
            icono: $icono ?? $this->icono,
            publico: $publico ?? $this->publico,
            createdAt: $this->createdAt,
            updatedAt: new \DateTimeImmutable(),
            datasets: $this->datasets,
        );
    }

    public function toArray(): array
    {
        $data = [
            'id' => $this->id,
            'nombre' => $this->nombre,
            'codigo_interno' => $this->codigoInterno,
            'descripcion' => $this->descripcion,
            'icono' => $this->icono,
            'publico' => $this->publico,
            'created_at' => $this->createdAt?->format('Y-m-d H:i:s'),
            'updated_at' => $this->updatedAt?->format('Y-m-d H:i:s'),
        ];

        // Incluir datasets si están cargados
        if ($this->datasets !== null) {
            $data['datasets'] = $this->datasets;
        }

        return $data;
    }
}
