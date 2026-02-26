<?php

declare(strict_types=1);

namespace App\Application\Public\DTOs;

final class TextAnalysisDTO
{
    public function __construct(
        public readonly string $datasetId,
        public readonly string $variableId,
        public readonly int $limit = 50,
        public readonly ?array $filters = null,
    ) {}

    public static function fromArray(array $data): self
    {
        return new self(
            datasetId: $data['dataset_id'],
            variableId: $data['variable_id'],
            limit: (int) ($data['limit'] ?? 50),
            filters: $data['filters'] ?? null,
        );
    }
}
