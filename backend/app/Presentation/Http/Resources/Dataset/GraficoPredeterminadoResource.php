<?php

declare(strict_types=1);

namespace App\Presentation\Http\Resources\Dataset;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class GraficoPredeterminadoResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'dataset_id' => $this->dataset_id,
            'titulo' => $this->titulo,
            'descripcion' => $this->descripcion,
            'analisis' => $this->analisis,
            'tipo_grafico' => $this->tipo_grafico,
            'tipo_analisis' => $this->tipo_analisis,
            'variable_x_id' => $this->variable_x_id,
            'variable_y_id' => $this->variable_y_id,
            'filtros' => $this->filtros,
            'configuracion' => $this->configuracion,
            'orden' => (int) $this->orden,
            'activo' => (bool) $this->activo,
            'variable_x' => new DatasetVariableSummaryResource($this->whenLoaded('variableX')),
            'variable_y' => new DatasetVariableSummaryResource($this->whenLoaded('variableY')),
        ];
    }
}
