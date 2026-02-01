<?php

declare(strict_types=1);

namespace App\Application\Public\DTOs;

final class BivariableStatsDTO
{
    public function __construct(
        public readonly string $datasetId,
        public readonly string $variableXId,
        public readonly string $variableYId,
        public readonly ?string $chartType = null,
        public readonly int $limit = 20,
    ) {}

    public static function fromArray(array $data): self
    {
        return new self(
            datasetId: $data['dataset_id'],
            variableXId: $data['variable_x_id'],
            variableYId: $data['variable_y_id'],
            chartType: $data['chart_type'] ?? null,
            limit: (int) ($data['limit'] ?? 20),
        );
    }
}
