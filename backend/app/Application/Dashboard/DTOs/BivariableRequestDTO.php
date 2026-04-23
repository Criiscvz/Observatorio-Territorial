<?php

declare(strict_types=1);

namespace App\Application\Dashboard\DTOs;

final readonly class BivariableRequestDTO
{
    public function __construct(
        public string $datasetId,
        public string $variableXId,
        public string $variableYId,
        public int $userId,
        public ?string $chartType = null,
        public ?int $limit = null,
        public ?array $filters = null,
    ) {}

    public static function fromArray(array $data, int $userId): self
    {
        return new self(
            datasetId: $data['dataset_id'],
            variableXId: $data['variable_x_id'],
            variableYId: $data['variable_y_id'],
            userId: $userId,
            chartType: $data['chart_type'] ?? null,
            limit: $data['limit'] ?? null,
            filters: $data['filters'] ?? null,
        );
    }
}
