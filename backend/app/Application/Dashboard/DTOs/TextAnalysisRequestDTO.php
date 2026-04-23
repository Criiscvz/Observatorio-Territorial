<?php

declare(strict_types=1);

namespace App\Application\Dashboard\DTOs;

final readonly class TextAnalysisRequestDTO
{
    public function __construct(
        public string $datasetId,
        public string $variableId,
        public int $userId,
        public int $limit = 50,
        public ?array $filters = null,
    ) {}

    public static function fromArray(array $data, int $userId): self
    {
        return new self(
            datasetId: $data['dataset_id'],
            variableId: $data['variable_id'],
            userId: $userId,
            limit: (int) ($data['limit'] ?? 50),
            filters: $data['filters'] ?? null,
        );
    }
}
