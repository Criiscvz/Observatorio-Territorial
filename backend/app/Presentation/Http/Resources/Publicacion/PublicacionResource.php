<?php

namespace App\Presentation\Http\Resources\Publicacion;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class PublicacionResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $user = $request->user('sanctum') ?: $request->user();
        $isSubscriberContent = (bool) $this->solo_suscriptores;
        $routeAction = (string) ($request->route()?->getActionName() ?? '');
        $isManagementRequest = str_contains($routeAction, 'ObservatorioPublicacionController')
            || str_contains($routeAction, 'AtlasEnlaceController');
        $isEditorOwner = $isManagementRequest
            && $user?->rol === 'EDITOR'
            && (int) $this->creado_por === (int) $user->id;
        $isScopedManager = $isManagementRequest && $user?->isObservatoryAdmin() && $this->tipo !== 'ATLAS'
            && in_array($this->departamento_id, $user->observatoryIds(), true);
        $canViewSubscriberContent = $isScopedManager || ! $isSubscriberContent
            || ($user && in_array($user->rol, ['ADMIN', 'SUBSCRIBER', 'SUSCRIPTOR', 'SUBSCRIPTOR'], true))
            || $isEditorOwner;
        $isLocked = $isSubscriberContent && ! $canViewSubscriberContent;
        $downloadUrl = "/api/departamentos/publicaciones/{$this->id}/download";
        if ($isEditorOwner || $isScopedManager) {
            $downloadUrl .= '?context=management';
        }

        $hideAtlasInternals = $this->tipo === 'ATLAS' && ! $isManagementRequest;
        $hasSharePointPdf = $this->sharepoint_url && ($this->tipo !== 'REPORTE' || $this->sharepoint_file_type === 'application/pdf');

        return [
            'id' => $this->id,
            'departamento_id' => $this->departamento_id,
            'creado_por' => $hideAtlasInternals ? null : $this->creado_por,
            'creador' => $this->whenLoaded('creadoPor', fn() => [
                'id' => $this->creadoPor?->id,
                'name' => $this->creadoPor?->name,
                'email' => $this->creadoPor?->email,
                'rol' => $this->creadoPor?->rol,
            ]),
            ...($this->tipo === 'ATLAS' ? [
                'atlas_categoria_id' => $this->atlas_categoria_id,
                'atlas_categoria' => $this->atlasCategoria,
            ] : []),
            'tipo' => $this->tipo,
            'estado' => $this->estado,
            ...($isManagementRequest ? [
                'observacion_revision' => $this->observacion_revision,
                'fecha_revision' => $this->fecha_revision?->toIso8601String(),
            ] : []),
            'solo_suscriptores' => (bool) $this->solo_suscriptores,
            'bloqueado' => $isLocked,
            'codigo' => $this->codigo,
            'titulo' => $this->titulo,
            'fecha_publicacion' => $this->fecha_publicacion?->format('Y-m-d'),
            'link_url' => $isLocked || (! $isManagementRequest && $this->sharepoint_file_id && $this->link_url === $this->sharepoint_url) ? null : $this->link_url,
            'descripcion' => $isLocked ? 'Contenido exclusivo para suscriptores.' : $this->descripcion,
            'autores' => $this->autores,
            'fuente' => $this->fuente,
            'nombre_archivo_original' => $isLocked ? null : $this->nombre_archivo_original,
            'download_url' => (! $isLocked && ($this->archivo_pdf || $hasSharePointPdf))
                ? $downloadUrl
                : null,
            'sharepoint_url' => ($isLocked || $this->archivo_pdf || ! $hasSharePointPdf) ? null : $this->sharepoint_url,
            'sharepoint_file_id' => $hideAtlasInternals ? null : $this->sharepoint_file_id,
            'sharepoint_file_name' => $hideAtlasInternals ? null : $this->sharepoint_file_name,
            'sharepoint_file_type' => $hideAtlasInternals ? null : $this->sharepoint_file_type,
            'sharepoint_file_size' => $hideAtlasInternals ? null : $this->sharepoint_file_size,
            'sharepoint_last_modified_at' => $hideAtlasInternals ? null : $this->sharepoint_last_modified_at?->toIso8601String(),
            'sharepoint_sync_status' => $hideAtlasInternals ? null : $this->sharepoint_sync_status,
            'sharepoint_synced_at' => $hideAtlasInternals ? null : $this->sharepoint_synced_at?->toIso8601String(),
            'sharepoint_error' => $hideAtlasInternals ? null : $this->sharepoint_error,
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}
