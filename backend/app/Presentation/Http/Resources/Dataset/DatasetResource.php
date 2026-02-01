<?php

declare(strict_types=1);

namespace App\Presentation\Http\Resources\Dataset;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use App\Presentation\Http\Resources\Departamento\DepartamentoResource;

class DatasetResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        if ($this->resource instanceof \App\Application\Dataset\DTOs\DatasetResponseDTO) {
            return $this->resource->toArray();
        }

        return [
            'id' => $this->id,
            'departamento_id' => $this->departamento_id,
            'nombre' => $this->nombre,
            'nombre_archivo' => $this->nombre_archivo,
            'descripcion' => $this->descripcion,
            'estado' => $this->estado,
            'total_registros' => $this->total_registros ?? 0,
            'fecha_carga' => $this->fecha_carga?->toISOString(),
            'created_at' => $this->created_at?->toISOString(),
            'updated_at' => $this->updated_at?->toISOString(),
            'departamento' => new DepartamentoResource($this->whenLoaded('departamento')),
            'variables_metadatos' => VariableMetadatoResource::collection($this->whenLoaded('variablesMetadatos')),
        ];
    }
}
