<?php

declare(strict_types=1);

namespace App\Application\Public\DTOs;

final class ChartDataDTO
{
    public function __construct(
        public readonly ?string $variableId = null,
        public readonly ?string $variableXId = null,
        public readonly ?string $variableYId = null,
        public readonly ?string $nombreVariable = null,
        public readonly ?string $nombreVariableX = null,
        public readonly ?string $nombreVariableY = null,
        public readonly ?string $tipoVariable = null,
        public readonly string $chartType = 'bar',
        public readonly array $data = [],
        public readonly array $stats = [],
    ) {}

    public function toArray(): array
    {
        $result = [
            'chart_type' => $this->chartType,
            'data' => $this->data,
            'stats' => $this->stats,
        ];

        if ($this->variableId !== null) {
            $result['variable_id'] = $this->variableId;
            $result['nombre_variable'] = $this->nombreVariable;
            $result['tipo_variable'] = $this->tipoVariable;
        }

        if ($this->variableXId !== null) {
            $result['variable_x_id'] = $this->variableXId;
            $result['variable_y_id'] = $this->variableYId;
            $result['nombre_variable_x'] = $this->nombreVariableX;
            $result['nombre_variable_y'] = $this->nombreVariableY;
        }

        return $result;
    }
}
