<?php

declare(strict_types=1);

namespace App\Presentation\Http\Resources\Dataset;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ChartDataResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        // Si es un DTO
        if ($this->resource instanceof \App\Application\Dashboard\DTOs\ChartDataDTO) {
            return $this->resource->toArray();
        }

        if ($this->resource instanceof \App\Application\Dashboard\DTOs\BivariableResponseDTO) {
            return $this->resource->toArray();
        }

        // Retornar array directamente
        return is_array($this->resource) ? $this->resource : [];
    }
}
