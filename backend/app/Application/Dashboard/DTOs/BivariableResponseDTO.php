<?php

declare(strict_types=1);

namespace App\Application\Dashboard\DTOs;

final readonly class BivariableResponseDTO
{
    public function __construct(
        public string $variableXId,
        public string $variableYId,
        public string $nombreVariableX,
        public string $nombreVariableY,
        public string $chartType,
        public array $data,
        public ?array $stats = null,
    ) {}

    public function toArray(): array
    {
        return [
            'variable_x_id' => $this->variableXId,
            'variable_y_id' => $this->variableYId,
            'nombre_variable_x' => $this->nombreVariableX,
            'nombre_variable_y' => $this->nombreVariableY,
            'chart_type' => $this->chartType,
            'data' => $this->data,
            'stats' => $this->stats,
        ];
    }
}
