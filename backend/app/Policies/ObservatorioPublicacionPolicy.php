<?php

declare(strict_types=1);

namespace App\Policies;

use App\Models\Departamento;
use App\Models\ObservatorioPublicacion;
use App\Models\User;

/** Current assignments are queried, never taken from cached relations or client claims. */
final class ObservatorioPublicacionPolicy
{
    private function active(User $user): bool
    {
        return $user->is_active && ! $user->trashed();
    }

    public function create(User $user, Departamento $department): bool
    {
        if (! $this->active($user) || $department->trashed()) { return false; }
        if ($user->isAdmin()) { return true; }
        if ($user->isObservatoryAdmin()) { return $user->canReviewObservatory($department->id); }

        return $user->isEditor() && $user->departamentos()->whereKey($department->id)
            ->wherePivotIn('rol', ['ADMIN', 'EDITOR'])->exists();
    }

    public function viewForManagement(User $user, ObservatorioPublicacion $publication): bool
    {
        if (! $this->active($user) || $publication->eliminado_legado_at !== null) { return false; }
        if ($user->isAdmin()) { return true; }
        if (! in_array($publication->tipo, ['ARTICULO', 'REPORTE', 'LIBRO'], true)
            || ! $publication->departamento) { return false; }
        if ($user->isObservatoryAdmin()) { return $user->canReviewObservatory($publication->departamento_id); }

        return $user->isEditor() && (int) $publication->creado_por === (int) $user->id
            && $this->create($user, $publication->departamento);
    }

    public function view(?User $user, ObservatorioPublicacion $publication): bool
    {
        if ($publication->eliminado_legado_at !== null || ($user && ! $this->active($user))) { return false; }
        if ($user && $this->viewForManagement($user, $publication)) { return true; }
        if ($publication->hasPrivateLegacyAccess() || $publication->estado !== 'PUBLICACION') { return false; }
        if ($publication->departamento_id !== null) {
            if (! $publication->departamento) { return false; }
            if ($user?->isObservatoryAdmin() && ! in_array($publication->departamento_id, $user->observatoryIds(), true)) { return false; }
            if (! $publication->departamento->publico && (! $user || ! $user->departamentos()->whereKey($publication->departamento_id)->exists())) { return false; }
        } elseif ($publication->tipo !== 'ATLAS') { return false; }
        if ($publication->tipo === 'ATLAS' && $publication->atlas_categoria_id && ! $publication->atlasCategoria?->publico) { return false; }

        return ! $publication->solo_suscriptores || (bool) $user?->isSubscriber();
    }

    public function update(User $user, ObservatorioPublicacion $publication): bool
    {
        return $this->viewForManagement($user, $publication)
            && ! ($user->isEditor() && $publication->estado === 'RECHAZADO');
    }

    public function delete(User $user, ObservatorioPublicacion $publication): bool
    {
        return $this->update($user, $publication);
    }

    public function review(User $user, ObservatorioPublicacion $publication): bool
    {
        return $publication->tipo !== 'ATLAS' && $this->viewForManagement($user, $publication)
            && $user->canReviewObservatory($publication->departamento_id);
    }

    /** Capabilities describe actions, not an authorization token for a later request. */
    public function capabilities(?User $user, ObservatorioPublicacion $publication): array
    {
        $management = $user && $this->viewForManagement($user, $publication);
        $write = $management && ! ($user->isEditor() && $publication->estado === 'RECHAZADO');

        return ['can_view' => $management || $this->view($user, $publication), 'can_edit' => $write,
            'can_delete' => $write, 'can_review' => $management && $publication->tipo !== 'ATLAS'
                && $user->canReviewObservatory($publication->departamento_id)];
    }
}
