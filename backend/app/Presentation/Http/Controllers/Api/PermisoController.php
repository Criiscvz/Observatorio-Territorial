<?php

declare(strict_types=1);

namespace App\Presentation\Http\Controllers\Api;

use App\Application\Permiso\UseCases\GetPermisosUseCase;
use App\Application\Permiso\UseCases\SavePermisoUseCase;
use App\Http\Controllers\Controller;
use App\Presentation\Http\Requests\Permiso\SavePermisosRequest;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PermisoController extends Controller
{
    public function __construct(
        private readonly GetPermisosUseCase $getPermisosUseCase,
        private readonly SavePermisoUseCase $savePermisoUseCase,
    ) {}

    /**
     * Obtiene los permisos de un usuario específico.
     */
    public function show(int $userId): JsonResponse
    {
        $permisos = $this->getPermisosUseCase->execute($userId);
        return response()->json($permisos->map(fn($p) => $p->toArray()));
    }

    /**
     * Obtiene los permisos del usuario autenticado.
     */
    public function myPermissions(Request $request): JsonResponse
    {
        $permisos = $this->getPermisosUseCase->execute($request->user()->id);
        return response()->json($permisos->map(fn($p) => $p->toArray()));
    }

    /**
     * Guarda los permisos de un usuario específico (reemplaza todos).
     */
    public function save(int $userId, SavePermisosRequest $request): JsonResponse
    {
        $results = $this->savePermisoUseCase->saveAll($userId, $request->validated()['permisos']);
        return response()->json([
            'message' => 'Permisos guardados correctamente.',
            'permisos' => array_map(fn($r) => $r->toArray(), $results),
        ]);
    }
}
