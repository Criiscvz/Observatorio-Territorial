<?php

declare(strict_types=1);

namespace App\Presentation\Http\Resources\Dataset;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** Metadata required by a category card or a saved chart, without internal options. */
class DatasetVariableSummaryResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'nombre_columna' => $this->nombre_columna,
            'nombre_original' => $this->nombre_original,
            'tipo_dato' => $this->tipo_dato,
        ];
    }
}
