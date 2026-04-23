<?php

declare(strict_types=1);

namespace App\Application\Dashboard\DTOs;

final readonly class ChartDataDTO
{
    public function __construct(
        public string $variableId,
        public string $nombreVariable,
        public string $tipoVariable,
        public string $chartType,
        public array $data,
        public ?array $stats = null,
    ) {}

    public function toArray(): array
    {
        return [
            'variable_id' => $this->variableId,
            'nombre_variable' => $this->nombreVariable,
            'tipo_variable' => $this->tipoVariable,
            'chart_type' => $this->chartType,
            'data' => $this->data,
            'stats' => $this->stats,
        ];
    }
}
