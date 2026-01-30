<?php

declare(strict_types=1);

namespace App\Application\Dataset\DTOs;

final readonly class ConfirmImportDTO
{
    public function __construct(
        public string $datasetId,
        public int $userId,
        public array $columnas,
    ) {}

    public static function fromArray(array $data, string $datasetId, int $userId): self
    {
        return new self(
            datasetId: $datasetId,
            userId: $userId,
            columnas: $data['columnas'] ?? [],
        );
    }
}
