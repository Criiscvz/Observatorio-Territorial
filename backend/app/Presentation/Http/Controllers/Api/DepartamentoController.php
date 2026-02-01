<?php

declare(strict_types=1);

namespace App\Presentation\Http\Controllers\Api;

use OpenApi\Attributes as OA;
use App\Application\Departamento\DTOs\CreateDepartamentoDTO;
use App\Application\Departamento\DTOs\UpdateDepartamentoDTO;
use App\Application\Departamento\UseCases\CreateDepartamentoUseCase;
use App\Application\Departamento\UseCases\DeleteDepartamentoUseCase;
use App\Application\Departamento\UseCases\GetDepartamentosUseCase;
use App\Application\Departamento\UseCases\GetDepartamentoUseCase;
use App\Application\Departamento\UseCases\UpdateDepartamentoUseCase;
use App\Http\Controllers\Controller;
use App\Presentation\Http\Requests\Departamento\CreateDepartamentoRequest;
use App\Presentation\Http\Requests\Departamento\UpdateDepartamentoRequest;
use App\Presentation\Http\Resources\Departamento\DepartamentoResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

#[OA\Tag(name: 'Departamentos', description: 'Gestión de departamentos')]
class DepartamentoController extends Controller
{
    public function __construct(
        private readonly GetDepartamentosUseCase $getDepartamentosUseCase,
        private readonly GetDepartamentoUseCase $getDepartamentoUseCase,
        private readonly CreateDepartamentoUseCase $createDepartamentoUseCase,
        private readonly UpdateDepartamentoUseCase $updateDepartamentoUseCase,
        private readonly DeleteDepartamentoUseCase $deleteDepartamentoUseCase,
    ) {}

    #[OA\Get(
        path: '/departamentos',
        summary: 'Listar departamentos del usuario',
        security: [['sanctum' => []]],
        tags: ['Departamentos'],
        responses: [
            new OA\Response(response: 200, description: 'Lista de departamentos')
        ]
    )]
    public function index(Request $request): JsonResponse
    {
        $departamentos = $this->getDepartamentosUseCase->execute($request->user()->id);

        return response()->json(
            $departamentos->map(fn($d) => $d->toArray())
        );
    }

    #[OA\Get(
        path: '/departamentos/publicos',
        summary: 'Listar departamentos públicos',
        tags: ['Departamentos'],
        responses: [
            new OA\Response(response: 200, description: 'Lista de departamentos públicos')
        ]
    )]
    public function publicos(): JsonResponse
    {
        $departamentos = $this->getDepartamentosUseCase->getPublicos();

        return response()->json(
            $departamentos->map(fn($d) => $d->toArray())
        );
    }

    #[OA\Post(
        path: '/departamentos',
        summary: 'Crear nuevo departamento',
        security: [['sanctum' => []]],
        requestBody: new OA\RequestBody(
            required: true,
            content: new OA\JsonContent(
                required: ['nombre', 'codigo_interno'],
                properties: [
                    new OA\Property(property: 'nombre', type: 'string', example: 'Departamento de Ejemplo'),
                    new OA\Property(property: 'codigo_interno', type: 'string', example: 'DEP001'),
                    new OA\Property(property: 'descripcion', type: 'string', example: 'Descripción del departamento'),
                    new OA\Property(property: 'publico', type: 'boolean', example: true),
                    new OA\Property(property: 'icono', type: 'string', example: 'groups')
                ]
            )
        ),
        tags: ['Departamentos'],
        responses: [
            new OA\Response(response: 201, description: 'Departamento creado')
        ]
    )]
    public function store(CreateDepartamentoRequest $request): JsonResponse
    {
        $dto = CreateDepartamentoDTO::fromArray(
            $request->validated(),
            $request->user()->id
        );

        $result = $this->createDepartamentoUseCase->execute($dto);

        return response()->json($result->toArray(), 201);
    }

    #[OA\Get(
        path: '/departamentos/{id}',
        summary: 'Obtener departamento',
        security: [['sanctum' => []]],
        tags: ['Departamentos'],
        parameters: [
            new OA\Parameter(name: 'id', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid'))
        ],
        responses: [
            new OA\Response(response: 200, description: 'Datos del departamento'),
            new OA\Response(response: 404, description: 'No encontrado')
        ]
    )]
    public function show(Request $request, string $id): JsonResponse
    {
        $result = $this->getDepartamentoUseCase->execute($id, $request->user()->id);

        return response()->json($result->toArray());
    }

    #[OA\Put(
        path: '/departamentos/{id}',
        summary: 'Actualizar departamento',
        security: [['sanctum' => []]],
        tags: ['Departamentos'],
        parameters: [
            new OA\Parameter(name: 'id', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid'))
        ],
        requestBody: new OA\RequestBody(
            content: new OA\JsonContent(
                properties: [
                    new OA\Property(property: 'nombre', type: 'string'),
                    new OA\Property(property: 'descripcion', type: 'string'),
                    new OA\Property(property: 'publico', type: 'boolean'),
                    new OA\Property(property: 'icono', type: 'string')
                ]
            )
        ),
        responses: [
            new OA\Response(response: 200, description: 'Departamento actualizado')
        ]
    )]
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

    #[OA\Delete(
        path: '/departamentos/{id}',
        summary: 'Eliminar departamento',
        security: [['sanctum' => []]],
        tags: ['Departamentos'],
        parameters: [
            new OA\Parameter(name: 'id', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid'))
        ],
        responses: [
            new OA\Response(response: 200, description: 'Departamento eliminado')
        ]
    )]
    public function destroy(Request $request, string $id): JsonResponse
    {
        $this->deleteDepartamentoUseCase->execute($id, $request->user()->id);

        return response()->json(['message' => 'Departamento eliminado exitosamente']);
    }
}
