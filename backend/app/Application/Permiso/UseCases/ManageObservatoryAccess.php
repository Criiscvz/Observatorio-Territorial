<?php

declare(strict_types=1);

namespace App\Application\Permiso\UseCases;

use App\Models\Departamento;
use App\Models\Permiso;
use App\Models\User;
use App\Policies\ObservatoryAccessPolicy;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;

final class ManageObservatoryAccess
{
    public function __construct(private readonly ObservatoryAccessPolicy $policy, private readonly SavePermisoUseCase $save) {}

    public function overview(User $actor): array
    {
        abort_unless($actor->is_active && ! $actor->trashed() && ($actor->isAdmin() || $actor->isObservatoryAdmin()), 403);
        return ['capabilities' => ['can_assign_editors' => $this->policy->manageableIds($actor) !== []]];
    }

    public function context(User $actor, User $target): array
    {
        Gate::forUser($actor)->authorize('viewAccess', $target);
        $capabilities = $this->policy->capabilities($actor, $target);
        $ids = $capabilities['can_manage_access'] ? $this->policy->manageableIds($actor) : $this->policy->visibleIds($actor);
        $departments = Departamento::whereIn('id', $ids)->orderBy('nombre')->orderBy('id')
            ->get(['id', 'nombre', 'codigo_interno', 'descripcion', 'publico']);
        return ['capabilities' => $capabilities, 'observatorios' => $departments,
            'permisos' => $actor->isAdmin() ? $this->adminPermissions($target) : $this->permissions($target, $ids)];
    }

    public function permissions(User $target, array $ids): array
    {
        return $target->departamentos()->whereIn('departamentos.id', $ids)->get()->map(fn ($d) => [
            'modulo' => 'observatorios', 'nivel' => 'escritura', 'departamento_id' => $d->id,
            'puede_revisar' => false, 'puede_agregar_editores' => false,
        ])->all();
    }

    private function adminPermissions(User $target): array
    {
        $rows = app(GetPermisosUseCase::class)->execute($target->id);
        $assigned = $target->departamentos()->get()->keyBy('id');
        return $rows->map(function ($row) use ($assigned) {
            $p = $row->toArray(); $pivot = $assigned->get($p['departamento_id'] ?? '')?->pivot;
            return [...$p, 'puede_revisar' => (bool) $pivot?->puede_revisar,
                'puede_agregar_editores' => (bool) $pivot?->puede_agregar_editores];
        })->all();
    }

    /** Locks users in stable order; delegation revocations and role changes are checked again here. */
    public function save(int $actorId, int $targetId, array $incoming, bool $delegated): User
    {
        return DB::transaction(function () use ($actorId, $targetId, $incoming, $delegated) {
            $users = User::whereIn('id', [$actorId, $targetId])->orderBy('id')->lockForUpdate()->get()->keyBy('id');
            $actor = $users->get($actorId); $target = $users->get($targetId); abort_unless($actor && $target, 404);
            abort_unless($delegated ? $actor->isObservatoryAdmin() : $actor->isAdmin(), 403);
            Gate::forUser($actor)->authorize('assignAccess', $target);
            if (! $delegated) { $this->save->saveAll($targetId, $incoming); return $target->refresh(); }
            abort_unless($target->is_active, 422, 'Activa la cuenta antes de asignarla como editor.');
            $ids = $this->policy->manageableIds($actor); $selected = [];
            foreach ($incoming as $p) {
                abort_unless(($p['modulo'] ?? null) === 'observatorios' && in_array($p['nivel'] ?? null, ['escritura', 'ninguno'], true)
                    && empty($p['puede_revisar']) && empty($p['puede_agregar_editores']), 403, 'Solo puedes asignar acceso de editor.');
                $id = $p['departamento_id'] ?? null;
                abort_unless(($id === null && $p['nivel'] === 'ninguno' && count($incoming) === 1)
                    || in_array($id, $ids, true), 403, 'Observatorio fuera de tu alcance.');
                if ($p['nivel'] === 'escritura') $selected[$id] = true;
            }
            // Preserve other observatories and modules, even if absent from the scoped response.
            $outside = $target->departamentos()->whereNotIn('departamentos.id', $ids)->get();
            $merged = Permiso::where('user_id', $targetId)->where('modulo', '!=', 'observatorios')->get()
                ->map(fn ($p) => ['modulo' => $p->modulo, 'nivel' => $p->nivel, 'departamento_id' => $p->departamento_id])->all();
            foreach ($outside as $d) $merged[] = ['modulo' => 'observatorios', 'nivel' => match ($d->pivot->rol) {
                'ADMIN' => 'admin', 'LECTOR' => 'lectura', default => 'escritura',
            }, 'departamento_id' => $d->id];
            foreach (array_keys($selected) as $id) $merged[] = ['modulo' => 'observatorios', 'nivel' => 'escritura', 'departamento_id' => $id];
            if ($target->rol === 'USER' && $selected !== []) {
                User::withoutEvents(function () use ($target) { $target->rol = 'EDITOR'; $target->save(); });
            }
            $this->save->saveAll($targetId, $merged ?: [['modulo' => 'observatorios', 'nivel' => 'ninguno', 'departamento_id' => null]]);
            return $target->refresh();
        });
    }
}
