<?php

declare(strict_types=1);

namespace App\Presentation\Http\Resources\Dataset;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** Summary for public category cards; never serializes file paths, uploaders or options. */
class CategoriaDatasetItemResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'departamento_id' => $this->departamento_id,
            'categoria_id' => $this->categoria_id,
            'nombre' => $this->nombre,
            'descripcion' => $this->descripcion,
            'enlace_fuente' => $this->enlace_fuente,
            'estado' => $this->estado,
            'total_registros' => (int) $this->total_registros,
            'fecha_carga' => $this->fecha_carga?->toISOString(),
            // The existing public card displays this date; it is an explicit field.
            'created_at' => $this->created_at?->toISOString(),
            'departamento' => $this->whenLoaded('departamento', fn (): array => [
                'id' => $this->departamento->id,
                'nombre' => $this->departamento->nombre,
                'icono' => $this->departamento->icono,
            ]),
            'variables_metadatos' => DatasetVariableSummaryResource::collection($this->whenLoaded('variablesMetadatos')),
        ];
    }
}
