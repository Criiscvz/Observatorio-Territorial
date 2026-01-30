<?php

declare(strict_types=1);

namespace App\Application\Departamento\DTOs;

final readonly class UpdateDepartamentoDTO
{
    public function __construct(
        public string $id,
        public ?string $nombre,
        public ?string $descripcion,
        public ?bool $publico,
        public int $userId,
    ) {}

    public static function fromArray(array $data, string $id, int $userId): self
    {
        return new self(
            id: $id,
            nombre: $data['nombre'] ?? null,
            descripcion: $data['descripcion'] ?? null,
            publico: $data['publico'] ?? null,
            userId: $userId,
        );
    }
}
