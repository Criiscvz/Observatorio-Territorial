<?php

declare(strict_types=1);

namespace App\Presentation\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class DepartamentoResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        // Si es un DTO
        if (is_array($this->resource) || $this->resource instanceof \App\Application\Departamento\DTOs\DepartamentoResponseDTO) {
            $data = is_array($this->resource) ? $this->resource : $this->resource->toArray();
            return $data;
        }

        // Si es un modelo Eloquent
        return [
            'id' => $this->id,
            'nombre' => $this->nombre,
            'codigo_interno' => $this->codigo_interno,
            'descripcion' => $this->descripcion,
            'publico' => (bool) $this->publico,
            'created_at' => $this->created_at?->toISOString(),
            'updated_at' => $this->updated_at?->toISOString(),
            'datasets' => DatasetResource::collection($this->whenLoaded('datasets')),
            'user_role' => $this->pivot?->rol ?? null,
        ];
    }
}
