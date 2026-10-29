<?php

namespace App\Presentation\Http\Controllers\Api;

use App\Application\Permiso\UseCases\SavePermisoUseCase;
use App\Http\Controllers\Controller;
use App\Models\Permiso;
use App\Models\User;
use App\Presentation\Http\Requests\Permiso\SavePermisosRequest;
use App\Presentation\Http\Resources\Auth\UserResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/** Delegated access never uses the global user-management endpoints. */
class ObservatoryAccessController extends Controller
{
    public function users(Request $request): JsonResponse
    {
        $data = $request->validate(['per_page' => 'sometimes|integer|min:1|max:100', 'search' => 'nullable|string|max:255',
            'purpose' => 'nullable|in:permissions']);
        $ids = $request->user()->observatoryIds();
        $permissions = ($data['purpose'] ?? '') === 'permissions';
        $query = User::query()->where('rol', $permissions ? 'EDITOR' : 'USER')->with('perfil')
            ->with(['departamentos' => fn ($q) => $q->whereIn('departamentos.id', $ids)]);
        if ($permissions) {
            $query->whereHas('departamentos', fn ($q) => $q->whereIn('departamentos.id', $ids));
        }
        if (! empty($data['search'])) {
            $term = mb_strtolower($data['search']);
            $query->where(fn ($q) => $q->whereRaw('LOWER(name) LIKE ?', ['%'.$term.'%'])
                ->orWhereRaw('LOWER(email) LIKE ?', ['%'.$term.'%']));
        }
        $users = $query->orderBy('name')->orderBy('id')->paginate($data['per_page'] ?? 15);
        return response()->json(['data' => UserResource::collection($users->items()), 'meta' => [
            'current_page' => $users->currentPage(), 'last_page' => $users->lastPage(),
            'per_page' => $users->perPage(), 'total' => $users->total(),
        ]]);
    }

    public function show(Request $request, User $user): JsonResponse
    {
        $ids = $request->user()->observatoryIds();
        $this->ensureTarget($user, $ids);
        return response()->json($this->permissions($user, $ids));
    }

    public function save(SavePermisosRequest $request, User $user, SavePermisoUseCase $save): JsonResponse
    {
        return DB::transaction(function () use ($request, $user, $save) {
            $actor = User::query()->lockForUpdate()->findOrFail($request->user()->id);
            abort_unless($actor->isObservatoryAdmin(), 403);
            $user = User::query()->lockForUpdate()->findOrFail($user->id);
            $ids = $actor->observatoryIds('puede_agregar_editores');
            abort_if(empty($ids), 403, 'No tienes permiso para agregar editores.');
            $this->ensureTarget($user, $ids);
            abort_unless($user->is_active, 422, 'Activa la cuenta antes de asignarla como editor.');
            $incoming = $request->validated()['permisos'];
            $selected = [];
            foreach ($incoming as $permission) {
                abort_unless($permission['modulo'] === 'observatorios' && in_array($permission['nivel'], ['escritura', 'ninguno'], true)
                    && empty($permission['puede_revisar']) && empty($permission['puede_agregar_editores']), 403,
                    'Solo puedes asignar acceso de editor.');
                $id = $permission['departamento_id'] ?? null;
                // A single null/none entry clears only the actor's manageable scopes.
                abort_unless(($id === null && $permission['nivel'] === 'ninguno' && count($incoming) === 1)
                    || in_array($id, $ids, true), 403, 'Observatorio fuera de tu alcance.');
                if ($permission['nivel'] === 'escritura') $selected[$id] = true;
            }
            // Keep all assignments outside the actor's scope, including legacy generic editor access.
            $outside = $user->departamentos()->whereNotIn('departamentos.id', $ids)->get();
            $merged = Permiso::where('user_id', $user->id)->where('modulo', '!=', 'observatorios')->get()
                ->map(fn ($p) => ['modulo' => $p->modulo, 'nivel' => $p->nivel, 'departamento_id' => $p->departamento_id])->all();
            foreach ($outside as $department) {
                $merged[] = ['modulo' => 'observatorios', 'nivel' => match ($department->pivot->rol) {
                    'ADMIN' => 'admin', 'LECTOR' => 'lectura', default => 'escritura',
                }, 'departamento_id' => $department->id];
            }
            foreach (array_keys($selected) as $id) {
                $merged[] = ['modulo' => 'observatorios', 'nivel' => 'escritura', 'departamento_id' => $id];
            }
            if ($user->rol === 'USER' && ! empty($selected)) {
                // This is the sole delegated promotion: validated above, no arbitrary role input.
                User::withoutEvents(function () use ($user) { $user->rol = 'EDITOR'; $user->save(); });
            }
            $save->saveAll($user->id, $merged ?: [['modulo' => 'observatorios', 'nivel' => 'ninguno', 'departamento_id' => null]]);
            $visibleIds = $actor->observatoryIds();
            $user->load(['perfil', 'departamentos' => fn ($q) => $q->whereIn('departamentos.id', $visibleIds)]);
            return response()->json(['message' => 'Accesos de editor guardados.', 'permisos' => $this->permissions($user, $visibleIds),
                'user' => new UserResource($user)]);
        });
    }

    private function ensureTarget(User $user, array $ids): void
    {
        abort_unless($user->rol === 'USER' || ($user->rol === 'EDITOR'
            && $user->departamentos()->whereIn('departamentos.id', $ids)->exists()), 403,
            'Solo puedes gestionar usuarios normales o editores de tus observatorios.');
    }

    private function permissions(User $user, array $ids): array
    {
        return $user->departamentos()->whereIn('departamentos.id', $ids)->get()->map(fn ($d) => [
            'modulo' => 'observatorios', 'nivel' => 'escritura', 'departamento_id' => $d->id,
            'puede_revisar' => false, 'puede_agregar_editores' => false,
        ])->all();
    }
}
