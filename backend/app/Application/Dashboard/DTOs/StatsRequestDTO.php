<?php

declare(strict_types=1);

namespace App\Application\Dashboard\DTOs;

final readonly class StatsRequestDTO
{
    public function __construct(
        public string $datasetId,
        public string $variableId,
        public ?string $chartType = null,
        public ?int $limit = null,
    ) {}

    public static function fromArray(array $data): self
    {
        return new self(
            datasetId: $data['dataset_id'],
            variableId: $data['variable_id'],
            chartType: $data['chart_type'] ?? null,
            limit: $data['limit'] ?? null,
        );
    }
}
