<?php

declare(strict_types=1);

namespace App\Presentation\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class VariableMetadatoResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'dataset_id' => $this->dataset_id,
            'nombre_columna' => $this->nombre_columna,
            'nombre_original' => $this->nombre_original,
            'tipo_dato' => $this->tipo_dato,
            'tipo_detectado' => $this->tipo_detectado,
            'es_visible' => (bool) $this->es_visible,
            'orden' => $this->orden ?? 0,
            'opciones' => $this->opciones,
        ];
    }
}
