<?php

declare(strict_types=1);

namespace App\Application\Departamento\DTOs;

final readonly class CreateDepartamentoDTO
{
    public function __construct(
        public string $nombre,
        public string $codigoInterno,
        public ?string $descripcion,
        public bool $publico,
        public int $userId,
    ) {}

    public static function fromArray(array $data, int $userId): self
    {
        return new self(
            nombre: $data['nombre'],
            codigoInterno: $data['codigo_interno'],
            descripcion: $data['descripcion'] ?? null,
            publico: $data['publico'] ?? false,
            userId: $userId,
        );
    }
}
