<?php

declare(strict_types=1);

namespace App\Application\Departamento\DTOs;

final readonly class UpdateDepartamentoDTO
{
    public function __construct(
        public string $id,
        public ?string $nombre,
        public ?string $codigoInterno,
        public ?string $descripcion,
        public ?string $icono,
        public ?bool $publico,
        public int $userId,
    ) {}

    public static function fromArray(array $data, string $id, int $userId): self
    {
        return new self(
            id: $id,
            nombre: $data['nombre'] ?? null,
            codigoInterno: $data['codigo_interno'] ?? null,
            descripcion: $data['descripcion'] ?? null,
            icono: $data['icono'] ?? null,
            publico: $data['publico'] ?? null,
            userId: $userId,
        );
    }
}
