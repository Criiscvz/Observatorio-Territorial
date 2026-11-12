<?php

declare(strict_types=1);

namespace App\Application\Publicaciones;

use App\Models\Departamento;
use App\Models\ObservatorioPublicacion;
use App\Models\User;

/** Shared current/legacy PDF access; never builds a response or contacts SharePoint. */
final class ReadPublicationPdf
{
    public function execute(?User $user, ObservatorioPublicacion $publication, bool $management = false): PublicationPdf
    {
        if ($publication->departamento) {
            $this->authorizeDepartment($user, $publication->departamento);
        }
        abort_if($publication->eliminado_legado_at !== null, 404);
        if ($user?->rol !== 'ADMIN') {
            // A removed parent must not turn an assigned file into a global download.
            abort_if(($publication->departamento_id !== null && ! $publication->departamento)
                || ($publication->departamento_id === null && $publication->tipo !== 'ATLAS'), 404);
            if (! ($management && $user?->canReadPublicationForManagement($publication))) {
                abort_if($publication->hasPrivateLegacyAccess(), 404);
                abort_unless($publication->estado === 'PUBLICACION', 404, 'La publicación no está disponible.');
                if ($publication->tipo === 'ATLAS' && $publication->atlas_categoria_id) {
                    abort_unless($publication->atlasCategoria?->publico === true, 404, 'La publicación no está disponible.');
                }
                if ($publication->solo_suscriptores) {
                    abort_unless($user && in_array($user->rol, ['SUBSCRIBER', 'SUSCRIPTOR', 'SUBSCRIPTOR'], true),
                        403, 'Esta publicación es solo para suscriptores.');
                }
            }
        }
        abort_if(! $publication->archivo_pdf && $publication->sharepoint_url, 409,
            'Este PDF no tiene una copia guardada. Administración debe importarlo nuevamente desde SharePoint.');
        abort_unless($publication->archivo_pdf, 404,
            'Esta publicación no tiene un PDF guardado. Un administrador debe volver a subirlo.');

        return new PublicationPdf($publication->archivo_pdf, $publication->nombre_archivo_original ?? $publication->titulo.'.pdf');
    }

    private function authorizeDepartment(?User $user, Departamento $department): void
    {
        if ($user?->isObservatoryAdmin()) {
            abort_unless(in_array($department->id, $user->observatoryIds(), true), 403, 'Observatorio fuera de tu alcance.');
            return;
        }
        $hasAccess = $user?->rol === 'ADMIN' || $department->publico
            || ($user && $department->usuarios()->where('users.id', $user->id)->exists());
        abort_unless($hasAccess, 403, 'No tienes acceso a este observatorio.');
    }
}
