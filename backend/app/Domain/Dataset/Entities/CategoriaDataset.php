<?php

declare(strict_types=1);

namespace App\Domain\Dataset\Entities;

class CategoriaDataset
{
    public const INVESTIGACION = 'INVESTIGACION';
    public const VINCULACION = 'VINCULACION';
    public const BAROMETRO = 'BAROMETRO';

    public function __construct(
        public readonly ?string $id,
        public readonly string $nombre,
        public readonly string $codigo,
        public readonly ?string $descripcion,
        public readonly ?string $icono,
        public readonly ?string $color,
        public readonly int $orden,
        public readonly bool $activo,
    ) {}

    public static function create(
        string $nombre,
        string $codigo,
        ?string $descripcion = null,
        ?string $icono = null,
        ?string $color = null,
        int $orden = 0,
    ): self {
        return new self(
            id: null,
            nombre: $nombre,
            codigo: $codigo,
            descripcion: $descripcion,
            icono: $icono,
            color: $color,
            orden: $orden,
            activo: true,
        );
    }

    public function toArray(): array
    {
        return [
            'id' => $this->id,
            'nombre' => $this->nombre,
            'codigo' => $this->codigo,
            'descripcion' => $this->descripcion,
            'icono' => $this->icono,
            'color' => $this->color,
            'orden' => $this->orden,
            'activo' => $this->activo,
        ];
    }
}
