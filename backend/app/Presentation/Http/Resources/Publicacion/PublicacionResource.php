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
            'creado_por' => $this->creado_por,
            'creador' => $this->whenLoaded('creadoPor', fn() => [
                'id' => $this->creadoPor?->id,
                'name' => $this->creadoPor?->name,
                'email' => $this->creadoPor?->email,
                'rol' => $this->creadoPor?->rol,
            ]),
            'tipo' => $this->tipo,
            'estado' => $this->estado,
            'solo_suscriptores' => (bool) $this->solo_suscriptores,
            'codigo' => $this->codigo,
            'titulo' => $this->titulo,
            'fecha_publicacion' => $this->fecha_publicacion?->format('Y-m-d'),
            'link_url' => $this->link_url,
            'descripcion' => $this->descripcion,
            'autores' => $this->autores,
            'fuente' => $this->fuente,
            'nombre_archivo_original' => $this->nombre_archivo_original,
            'download_url' => ($this->archivo_pdf || $this->sharepoint_url)
                ? "/api/departamentos/publicaciones/{$this->id}/download"
                : null,
            'sharepoint_url' => $this->sharepoint_url,
            'sharepoint_file_id' => $this->sharepoint_file_id,
            'sharepoint_file_name' => $this->sharepoint_file_name,
            'sharepoint_file_type' => $this->sharepoint_file_type,
            'sharepoint_file_size' => $this->sharepoint_file_size,
            'sharepoint_last_modified_at' => $this->sharepoint_last_modified_at?->toIso8601String(),
            'sharepoint_sync_status' => $this->sharepoint_sync_status,
            'sharepoint_synced_at' => $this->sharepoint_synced_at?->toIso8601String(),
            'sharepoint_error' => $this->sharepoint_error,
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}
