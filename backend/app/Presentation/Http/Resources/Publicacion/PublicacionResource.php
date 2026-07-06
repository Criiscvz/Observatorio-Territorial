<?php

namespace App\Presentation\Http\Resources\Publicacion;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class PublicacionResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'departamento_id' => $this->departamento_id,
            'tipo' => $this->tipo,
            'codigo' => $this->codigo,
            'titulo' => $this->titulo,
            'fecha_publicacion' => $this->fecha_publicacion?->format('Y-m-d'),
            'link_url' => $this->link_url,
            'descripcion' => $this->descripcion,
            'autores' => $this->autores,
            'fuente' => $this->fuente,
            'nombre_archivo_original' => $this->nombre_archivo_original,
            'download_url' => "/api/departamentos/publicaciones/{$this->id}/download",
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}
