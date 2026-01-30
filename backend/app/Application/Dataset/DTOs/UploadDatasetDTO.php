<?php

declare(strict_types=1);

namespace App\Application\Dataset\DTOs;

use Illuminate\Http\UploadedFile;

final readonly class UploadDatasetDTO
{
    public function __construct(
        public string $departamentoId,
        public int $userId,
        public string $nombre,
        public UploadedFile $archivo,
        public ?string $descripcion,
    ) {}

    public static function fromArray(array $data, int $userId): self
    {
        return new self(
            departamentoId: $data['departamento_id'],
            userId: $userId,
            nombre: $data['nombre'],
            archivo: $data['archivo'],
            descripcion: $data['descripcion'] ?? null,
        );
    }
}
