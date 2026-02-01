<?php

declare(strict_types=1);

namespace App\Application\Public\DTOs;

final class UnivariableStatsDTO
{
    public function __construct(
        public readonly string $datasetId,
        public readonly string $variableId,
        public readonly ?string $chartType = null,
        public readonly int $limit = 20,
    ) {}

    public static function fromArray(array $data): self
    {
        return new self(
            datasetId: $data['dataset_id'],
            variableId: $data['variable_id'],
            chartType: $data['chart_type'] ?? null,
            limit: (int) ($data['limit'] ?? 20),
        );
    }
}
