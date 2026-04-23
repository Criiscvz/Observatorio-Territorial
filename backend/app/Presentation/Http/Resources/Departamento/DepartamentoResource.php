<?php

declare(strict_types=1);

namespace App\Presentation\Http\Resources\Departamento;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class DepartamentoResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        if ($this->resource instanceof \App\Domain\Departamento\Entities\Departamento) {
            return $this->resource->toArray();
        }

        return [
            'id' => $this->id,
            'nombre' => $this->nombre,
            'codigo_interno' => $this->codigo_interno,
            'descripcion' => $this->descripcion,
            'icono' => $this->icono,
            'publico' => (bool) $this->publico,
            'datasets_count' => $this->datasets_count ?? $this->datasets->count(),
            'created_at' => $this->created_at?->toISOString(),
            'updated_at' => $this->updated_at?->toISOString(),
        ];
    }
}
