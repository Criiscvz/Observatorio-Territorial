<?php

declare(strict_types=1);

namespace App\Presentation\Http\Resources\Dataset;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** Public category contract, independent of model attributes and loaded relations. */
class CategoriaDatasetResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'nombre' => $this->nombre,
            'codigo' => $this->codigo,
            'descripcion' => $this->descripcion,
            'icono' => $this->icono,
            'color' => $this->color,
            'orden' => (int) $this->orden,
            'activo' => (bool) $this->activo,
        ];
    }
}
