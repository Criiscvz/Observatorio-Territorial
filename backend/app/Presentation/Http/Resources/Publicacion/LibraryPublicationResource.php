<?php

namespace App\Presentation\Http\Resources\Publicacion;

use Illuminate\Http\Request;

/** Library rows retain viewer/editor metadata without integration diagnostics or account email. */
class LibraryPublicationResource extends PublicacionResource
{
    public function toArray(Request $request): array
    {
        $row = parent::toArray($request);
        unset($row['sharepoint_file_id'], $row['sharepoint_error']);
        // The guarded download URL is the only PDF transport in this contract.
        $row['sharepoint_url'] = null;
        if ($this->tipo === 'ATLAS' && $this->atlasCategoria) {
            $row['atlas_categoria'] = ['id' => $this->atlasCategoria->id, 'nombre' => $this->atlasCategoria->nombre,
                'descripcion' => $this->atlasCategoria->descripcion, 'icono' => $this->atlasCategoria->icono, 'publico' => $this->atlasCategoria->publico];
        }
        if ($this->relationLoaded('creadoPor')) {
            $row['creador'] = $this->creadoPor ? ['id' => $this->creadoPor->id, 'name' => $this->creadoPor->name] : null;
        }
        if ($this->tipo === 'ATLAS' && ! str_contains((string) $request->route()?->getActionName(), 'ObservatorioPublicacionController')) {
            unset($row['creado_por'], $row['creador'], $row['sharepoint_file_name'], $row['sharepoint_file_type'],
                $row['sharepoint_file_size'], $row['sharepoint_last_modified_at'], $row['sharepoint_sync_status'], $row['sharepoint_synced_at']);
        }
        return $row;
    }
}
