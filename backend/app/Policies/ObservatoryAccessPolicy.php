<?php

declare(strict_types=1);

namespace App\Policies;

use App\Models\Departamento;
use App\Models\User;

/** Access-management rules; current scopes never come from a loaded relation or browser claims. */
final class ObservatoryAccessPolicy
{
    private function active(User $actor): bool { return $actor->is_active && ! $actor->trashed(); }

    public function visibleIds(User $actor): array
    {
        if (! $this->active($actor)) return [];
        return $actor->isAdmin() ? Departamento::pluck('id')->all()
            : ($actor->isObservatoryAdmin() ? $actor->observatoryIds() : []);
    }

    public function manageableIds(User $actor): array
    {
        if (! $this->active($actor)) return [];
        return $actor->isAdmin() ? Departamento::pluck('id')->all()
            : ($actor->isObservatoryAdmin() ? $actor->observatoryIds('puede_agregar_editores') : []);
    }

    public function viewAccess(User $actor, User $target): bool
    {
        if (! $this->active($actor) || $target->trashed()) return false;
        return $actor->isAdmin() || ($actor->isObservatoryAdmin() && ($target->rol === 'USER'
            || ($target->isEditor() && $target->departamentos()->whereIn('departamentos.id', $this->visibleIds($actor))->exists())));
    }

    /** Authorization before field validation; inactive delegated targets are rejected with 422 by the use case. */
    public function assignAccess(User $actor, User $target): bool
    {
        if (! $this->active($actor) || $target->trashed()) return false;
        if ($actor->isAdmin()) return true;
        $ids = $this->manageableIds($actor);
        return $actor->isObservatoryAdmin() && $ids !== [] && ($target->rol === 'USER'
            || ($target->isEditor() && $target->departamentos()->whereIn('departamentos.id', $ids)->exists()));
    }

    public function capabilities(User $actor, User $target): array
    {
        $write = $this->assignAccess($actor, $target) && ($actor->isAdmin()
            ? in_array($target->rol, ['EDITOR', 'ADMIN_OBSERVATORIO'], true) : $target->is_active);
        return ['can_view_access' => $this->viewAccess($actor, $target), 'can_manage_access' => $write,
            'can_assign_editors' => $write && ($actor->isAdmin() || $target->rol === 'USER' || $target->isEditor()),
            'can_revoke_access' => $write];
    }
}
