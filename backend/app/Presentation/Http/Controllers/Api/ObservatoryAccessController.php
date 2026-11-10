<?php

namespace App\Presentation\Http\Controllers\Api;

use App\Application\Permiso\UseCases\ManageObservatoryAccess;
use App\Http\Controllers\Controller;
use App\Policies\ObservatoryAccessPolicy;
use App\Models\User;
use App\Presentation\Http\Requests\Permiso\SavePermisosRequest;
use App\Presentation\Http\Resources\Auth\UserResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

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
            'access_capabilities' => app(ManageObservatoryAccess::class)->overview($request->user())['capabilities'],
        ]]);
    }

    public function overview(Request $request, ManageObservatoryAccess $access): JsonResponse
    {
        return response()->json($access->overview($request->user()));
    }

    public function context(Request $request, User $user, ManageObservatoryAccess $access): JsonResponse
    {
        return response()->json($access->context($request->user(), $user));
    }

    public function show(Request $request, User $user, ManageObservatoryAccess $access): JsonResponse
    {
        Gate::forUser($request->user())->authorize('viewAccess', $user);
        return response()->json($access->permissions($user, app(ObservatoryAccessPolicy::class)->visibleIds($request->user())));
    }

    public function save(SavePermisosRequest $request, User $user, ManageObservatoryAccess $access): JsonResponse
    {
        $user = $access->save($request->user()->id, $user->id, $request->validated()['permisos'], delegated: true);
        $ids = app(ObservatoryAccessPolicy::class)->visibleIds($request->user()->fresh());
        $user->load(['perfil', 'departamentos' => fn ($q) => $q->whereIn('departamentos.id', $ids)]);
        return response()->json(['message' => 'Accesos de editor guardados.', 'permisos' => $access->permissions($user, $ids),
            'user' => new UserResource($user)]);
    }
}
