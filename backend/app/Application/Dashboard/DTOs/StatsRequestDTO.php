<?php

declare(strict_types=1);

namespace App\Application\Dashboard\DTOs;

final readonly class StatsRequestDTO
{
    public function __construct(
        public string $datasetId,
        public string $variableId,
        public int $userId,
        public ?string $chartType = null,
        public ?int $limit = null,
        public ?array $filters = null,
    ) {}

    public static function fromArray(array $data, int $userId): self
    {
        return new self(
            datasetId: $data['dataset_id'],
            variableId: $data['variable_id'],
            userId: $userId,
            chartType: $data['chart_type'] ?? null,
            limit: $data['limit'] ?? null,
            filters: $data['filters'] ?? null,
        );
    }
}
