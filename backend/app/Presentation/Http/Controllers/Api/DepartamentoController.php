<?php

declare(strict_types=1);

namespace App\Presentation\Http\Controllers\Api;

use App\Application\Departamento\DTOs\CreateDepartamentoDTO;
use App\Application\Departamento\DTOs\UpdateDepartamentoDTO;
use App\Application\Departamento\UseCases\CreateDepartamentoUseCase;
use App\Application\Departamento\UseCases\DeleteDepartamentoUseCase;
use App\Application\Departamento\UseCases\GetDepartamentosUseCase;
use App\Application\Departamento\UseCases\GetDepartamentoUseCase;
use App\Application\Departamento\UseCases\UpdateDepartamentoUseCase;
use App\Http\Controllers\Controller;
use App\Presentation\Http\Requests\CreateDepartamentoRequest;
use App\Presentation\Http\Requests\UpdateDepartamentoRequest;
use App\Presentation\Http\Resources\DepartamentoResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * @OA\Tag(
 *     name="Departamentos",
 *     description="Gestión de departamentos"
 * )
 */
class DepartamentoController extends Controller
{
    public function __construct(
        private readonly GetDepartamentosUseCase $getDepartamentosUseCase,
        private readonly GetDepartamentoUseCase $getDepartamentoUseCase,
        private readonly CreateDepartamentoUseCase $createDepartamentoUseCase,
        private readonly UpdateDepartamentoUseCase $updateDepartamentoUseCase,
        private readonly DeleteDepartamentoUseCase $deleteDepartamentoUseCase,
    ) {}

    /**
     * @OA\Get(
     *     path="/api/departamentos",
     *     summary="Listar departamentos del usuario",
     *     tags={"Departamentos"},
     *     security={{"sanctum":{}}},
     *     @OA\Response(response=200, description="Lista de departamentos")
     * )
     */
    public function index(Request $request): JsonResponse
    {
        $departamentos = $this->getDepartamentosUseCase->execute($request->user()->id);
        
        return response()->json(
            $departamentos->map(fn($d) => $d->toArray())
        );
    }

    /**
     * @OA\Get(
     *     path="/api/departamentos/publicos",
     *     summary="Listar departamentos públicos",
     *     tags={"Departamentos"},
     *     @OA\Response(response=200, description="Lista de departamentos públicos")
     * )
     */
    public function publicos(): JsonResponse
    {
        $departamentos = $this->getDepartamentosUseCase->getPublicos();
        
        return response()->json(
            $departamentos->map(fn($d) => $d->toArray())
        );
    }

    /**
     * @OA\Post(
     *     path="/api/departamentos",
     *     summary="Crear nuevo departamento",
     *     tags={"Departamentos"},
     *     security={{"sanctum":{}}},
     *     @OA\RequestBody(
     *         required=true,
     *         @OA\JsonContent(
     *             required={"nombre","codigo_interno"},
     *             @OA\Property(property="nombre", type="string"),
     *             @OA\Property(property="codigo_interno", type="string"),
     *             @OA\Property(property="descripcion", type="string"),
     *             @OA\Property(property="publico", type="boolean")
     *         )
     *     ),
     *     @OA\Response(response=201, description="Departamento creado")
     * )
     */
    public function store(CreateDepartamentoRequest $request): JsonResponse
    {
        $dto = CreateDepartamentoDTO::fromArray(
            $request->validated(),
            $request->user()->id
        );
        
        $result = $this->createDepartamentoUseCase->execute($dto);
        
        return response()->json($result->toArray(), 201);
    }

    /**
     * @OA\Get(
     *     path="/api/departamentos/{id}",
     *     summary="Obtener departamento",
     *     tags={"Departamentos"},
     *     security={{"sanctum":{}}},
     *     @OA\Parameter(name="id", in="path", required=true, @OA\Schema(type="string", format="uuid")),
     *     @OA\Response(response=200, description="Datos del departamento"),
     *     @OA\Response(response=404, description="No encontrado")
     * )
     */
    public function show(Request $request, string $id): JsonResponse
    {
        $result = $this->getDepartamentoUseCase->execute($id, $request->user()->id);
        
        return response()->json($result->toArray());
    }

    /**
     * @OA\Put(
     *     path="/api/departamentos/{id}",
     *     summary="Actualizar departamento",
     *     tags={"Departamentos"},
     *     security={{"sanctum":{}}},
     *     @OA\Parameter(name="id", in="path", required=true, @OA\Schema(type="string", format="uuid")),
     *     @OA\RequestBody(
     *         @OA\JsonContent(
     *             @OA\Property(property="nombre", type="string"),
     *             @OA\Property(property="descripcion", type="string"),
     *             @OA\Property(property="publico", type="boolean")
     *         )
     *     ),
     *     @OA\Response(response=200, description="Departamento actualizado")
     * )
     */
    public function update(UpdateDepartamentoRequest $request, string $id): JsonResponse
    {
        $dto = UpdateDepartamentoDTO::fromArray(
            $request->validated(),
            $id,
            $request->user()->id
        );
        
        $result = $this->updateDepartamentoUseCase->execute($dto);
        
        return response()->json($result->toArray());
    }

    /**
     * @OA\Delete(
     *     path="/api/departamentos/{id}",
     *     summary="Eliminar departamento",
     *     tags={"Departamentos"},
     *     security={{"sanctum":{}}},
     *     @OA\Parameter(name="id", in="path", required=true, @OA\Schema(type="string", format="uuid")),
     *     @OA\Response(response=200, description="Departamento eliminado")
     * )
     */
    public function destroy(Request $request, string $id): JsonResponse
    {
        $this->deleteDepartamentoUseCase->execute($id, $request->user()->id);
        
        return response()->json(['message' => 'Departamento eliminado exitosamente']);
    }
}
