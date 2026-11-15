<?php

declare(strict_types=1);

namespace App\Support\Authorization;

use App\Models\Departamento;
use App\Models\User;

/** The existing read rule, shared by request authorization and controller rechecks. */
final class PublicationDepartmentAccess
{
    public function ensure(?User $user, Departamento $departamento): void
    {
        if ($user?->isObservatoryAdmin()) {
            abort_unless(in_array($departamento->id, $user->observatoryIds(), true), 403, 'Observatorio fuera de tu alcance.');
            return;
        }
        $hasAccess = $user?->rol === 'ADMIN' || $departamento->publico
            || ($user && $departamento->usuarios()->where('users.id', $user->id)->exists());
        abort_unless($hasAccess, 403, 'No tienes acceso a este observatorio.');
    }
}
