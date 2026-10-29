<?php

declare(strict_types=1);

namespace App\Presentation\Http\Resources\Publicacion;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** Explicit public contract; no owner, review notes or raw storage/SharePoint identifiers. */
class CatalogPublicationResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $user = $request->user('sanctum');
        $subscriber = $user && in_array($user->rol, ['ADMIN', 'SUBSCRIBER', 'SUSCRIPTOR', 'SUBSCRIPTOR'], true);
        $locked = (bool) $this->solo_suscriptores && ! $subscriber;
        $unified = $this->origen === 'publicaciones';
        $authors = $unified ? json_decode($this->autores ?: '[]', true) : [$this->autores];
        $authors = is_array($authors) ? array_values(array_filter($authors, 'is_string')) : [];
        $hasRemotePdf = $this->sharepoint_url && ($this->tipo !== 'REPORTE' || $this->sharepoint_file_type === 'application/pdf');
        $download = $unified && ($this->archivo_pdf || $hasRemotePdf)
            ? "/api/departamentos/publicaciones/{$this->id}/download" : null;
        return [
            'id' => $this->id,
            'resource_key' => $this->origen.':'.$this->id,
            'origen' => $this->origen,
            'tipo' => $this->tipo,
            'codigo' => $this->codigo,
            'titulo' => $this->titulo,
            'descripcion' => $locked ? 'Contenido exclusivo para suscriptores.' : $this->descripcion,
            'autores' => $authors,
            'fuente' => $this->fuente,
            'fecha_publicacion' => $this->fecha_publicacion ? substr((string) $this->fecha_publicacion, 0, 10) : null,
            'fecha_recepcion' => $this->fecha_recepcion ? substr((string) $this->fecha_recepcion, 0, 10) : null,
            'departamento_id' => $this->departamento_id,
            'departamento' => $this->departamento_id ? ['id' => $this->departamento_id, 'nombre' => $this->departamento_nombre] : null,
            'categoria_id' => $this->categoria_id,
            'categoria' => $this->categoria_id ? ['id' => $this->categoria_id, 'nombre' => $this->categoria_nombre,
                'codigo' => $this->categoria_codigo, 'color' => $this->categoria_color, 'icono' => $this->categoria_icono] : null,
            'solo_suscriptores' => (bool) $this->solo_suscriptores,
            'bloqueado' => $locked,
            'link_url' => $locked || ($this->sharepoint_file_id && $this->link_url === $this->sharepoint_url) ? null : $this->link_url,
            'download_url' => $locked ? null : $download,
            'ficha_indicador' => $locked ? null : $this->ficha_indicador,
            'sharepoint_url' => $locked || $this->archivo_pdf || ! $hasRemotePdf ? null : $this->sharepoint_url,
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}
