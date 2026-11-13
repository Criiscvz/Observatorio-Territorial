<?php

declare(strict_types=1);

namespace App\Presentation\Http\Resources\Dataset;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class DatasetFuenteResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'dataset_id' => $this->dataset_id,
            'titulo' => $this->titulo,
            'url' => $this->url,
            'descripcion' => $this->descripcion,
            'orden' => (int) $this->orden,
        ];
    }
}
