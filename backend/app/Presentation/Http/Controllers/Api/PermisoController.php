<?php

declare(strict_types=1);

namespace App\Presentation\Http\Controllers\Api;

use App\Application\Permiso\UseCases\GetPermisosUseCase;
use App\Application\Permiso\UseCases\ManageObservatoryAccess;
use App\Http\Controllers\Controller;
use App\Models\User;
use App\Presentation\Http\Requests\Permiso\SavePermisosRequest;
use App\Presentation\Http\Resources\Auth\UserResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PermisoController extends Controller
{
    public function __construct(
        private readonly GetPermisosUseCase $getPermisosUseCase,
    ) {}

    /**
     * Obtiene los permisos de un usuario específico.
     */
    public function show(int $userId): JsonResponse
    {
        $permisos = $this->getPermisosUseCase->execute($userId);
        return response()->json($this->withCapabilities($userId, $permisos->map(fn($p) => $p->toArray())->all()));
    }

    /**
     * Obtiene los permisos del usuario autenticado.
     */
    public function myPermissions(Request $request): JsonResponse
    {
        $permisos = $this->getPermisosUseCase->execute($request->user()->id);
        return response()->json($this->withCapabilities($request->user()->id, $permisos->map(fn($p) => $p->toArray())->all()));
    }

    /**
     * Guarda los permisos de un usuario específico (reemplaza todos).
     */
    public function save(int $userId, SavePermisosRequest $request): JsonResponse
    {
        app(ManageObservatoryAccess::class)->save($request->user()->id, $userId, $request->validated()['permisos'], delegated: false);
        $results = $this->getPermisosUseCase->execute($userId);
        $user = User::with(['perfil', 'departamentos'])->findOrFail($userId);

        return response()->json([
            'message' => 'Permisos guardados correctamente.',
            'permisos' => $this->withCapabilities($userId, $results->map(fn($r) => $r->toArray())->all()),
            'user' => new UserResource($user),
        ]);
    }

    private function withCapabilities(int $userId, array $permissions): array
    {
        $assignments = User::findOrFail($userId)->departamentos()->get()->keyBy('id');
        return array_map(function ($permission) use ($assignments) {
            $pivot = $assignments->get($permission['departamento_id'] ?? '')?->pivot;
            return [...$permission, 'puede_revisar' => (bool) $pivot?->puede_revisar,
                'puede_agregar_editores' => (bool) $pivot?->puede_agregar_editores];
        }, $permissions);
    }
}
