<?php

declare(strict_types=1);

namespace App\Presentation\Http\Controllers\Api;

use OpenApi\Attributes as OA;
use App\Application\Dataset\DTOs\ConfirmImportDTO;
use App\Application\Dataset\DTOs\UploadDatasetDTO;
use App\Application\Dataset\UseCases\AnalyzeDatasetUseCase;
use App\Application\Dataset\UseCases\BulkUpdateVariablesUseCase;
use App\Application\Dataset\UseCases\ConfirmImportUseCase;
use App\Application\Dataset\UseCases\DeleteDatasetUseCase;
use App\Application\Dataset\UseCases\GetDatasetDataUseCase;
use App\Application\Dataset\UseCases\GetDatasetsUseCase;
use App\Application\Dataset\UseCases\GetDatasetUseCase;
use App\Application\Dataset\UseCases\UpdateDatasetUseCase;
use App\Application\Dataset\UseCases\UpdateVariableUseCase;
use App\Application\Dataset\UseCases\UploadDatasetUseCase;
use App\Http\Controllers\Controller;
use App\Presentation\Http\Requests\Dataset\ConfirmImportRequest;
use App\Presentation\Http\Requests\Dataset\UpdateVariableRequest;
use App\Presentation\Http\Requests\Dataset\UploadDatasetRequest;
use App\Presentation\Http\Resources\Dataset\DatasetResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

#[OA\Tag(name: 'Datasets', description: 'Gestión de datasets')]
class DatasetController extends Controller
{
    public function __construct(
        private readonly GetDatasetsUseCase $getDatasetsUseCase,
        private readonly GetDatasetUseCase $getDatasetUseCase,
        private readonly UploadDatasetUseCase $uploadDatasetUseCase,
        private readonly AnalyzeDatasetUseCase $analyzeDatasetUseCase,
        private readonly ConfirmImportUseCase $confirmImportUseCase,
        private readonly GetDatasetDataUseCase $getDatasetDataUseCase,
        private readonly UpdateVariableUseCase $updateVariableUseCase,
        private readonly UpdateDatasetUseCase $updateDatasetUseCase,
        private readonly BulkUpdateVariablesUseCase $bulkUpdateVariablesUseCase,
        private readonly DeleteDatasetUseCase $deleteDatasetUseCase,
    ) {}

    #[OA\Get(
        path: '/datasets',
        summary: 'Listar datasets',
        security: [['sanctum' => []]],
        tags: ['Datasets'],
        parameters: [
            new OA\Parameter(name: 'departamento_id', in: 'query', schema: new OA\Schema(type: 'string', format: 'uuid'))
        ],
        responses: [
            new OA\Response(response: 200, description: 'Lista de datasets')
        ]
    )]
    public function index(Request $request): JsonResponse
    {
        $departamentoId = $request->query('departamento_id');
        $result = $this->getDatasetsUseCase->execute(
            $request->user()->id,
            $departamentoId
        );

        return response()->json(DatasetResource::collection($result));
    }

    #[OA\Post(
        path: '/datasets',
        summary: 'Subir nuevo dataset',
        security: [['sanctum' => []]],
        tags: ['Datasets'],
        requestBody: new OA\RequestBody(
            required: true,
            content: new OA\MediaType(
                mediaType: 'multipart/form-data',
                schema: new OA\Schema(
                    required: ['departamento_id', 'nombre', 'archivo'],
                    properties: [
                        new OA\Property(property: 'departamento_id', type: 'string', format: 'uuid'),
                        new OA\Property(property: 'nombre', type: 'string'),
                        new OA\Property(property: 'descripcion', type: 'string'),
                        new OA\Property(property: 'archivo', type: 'string', format: 'binary')
                    ]
                )
            )
        ),
        responses: [
            new OA\Response(response: 201, description: 'Dataset creado')
        ]
    )]
    public function store(UploadDatasetRequest $request): JsonResponse
    {
        \Log::info('DatasetController@store - Request received', [
            'user_id' => $request->user()?->id,
            'validated' => $request->validated(),
        ]);

        $dto = UploadDatasetDTO::fromArray(
            $request->validated(),
            $request->user()->id
        );

        $result = $this->uploadDatasetUseCase->execute($dto);

        return response()->json($result->toArray(), 201);
    }

    #[OA\Get(
        path: '/datasets/{id}',
        summary: 'Obtener dataset',
        security: [['sanctum' => []]],
        tags: ['Datasets'],
        parameters: [
            new OA\Parameter(name: 'id', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid'))
        ],
        responses: [
            new OA\Response(response: 200, description: 'Datos del dataset')
        ]
    )]
    public function show(Request $request, string $id): JsonResponse
    {
        $result = $this->getDatasetUseCase->execute($id, $request->user()->id);

        return response()->json($result->toArray());
    }

    #[OA\Post(
        path: '/datasets/{id}/analyze',
        summary: 'Analizar dataset',
        security: [['sanctum' => []]],
        tags: ['Datasets'],
        parameters: [
            new OA\Parameter(name: 'id', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid'))
        ],
        responses: [
            new OA\Response(response: 200, description: 'Resultado del análisis')
        ]
    )]
    public function analyze(Request $request, string $id): JsonResponse
    {
        $result = $this->analyzeDatasetUseCase->execute($id, $request->user()->id);

        return response()->json($result->toArray());
    }

    #[OA\Post(
        path: '/datasets/{id}/import',
        summary: 'Confirmar importación',
        security: [['sanctum' => []]],
        tags: ['Datasets'],
        parameters: [
            new OA\Parameter(name: 'id', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid'))
        ],
        requestBody: new OA\RequestBody(
            required: true,
            content: new OA\JsonContent(
                required: ['columnas'],
                properties: [
                    new OA\Property(property: 'columnas', type: 'array', items: new OA\Items(type: 'object'))
                ]
            )
        ),
        responses: [
            new OA\Response(response: 200, description: 'Importación completada')
        ]
    )]
    public function import(ConfirmImportRequest $request, string $id): JsonResponse
    {
        $dto = ConfirmImportDTO::fromArray(
            $request->validated(),
            $id,
            $request->user()->id
        );

        $result = $this->confirmImportUseCase->execute($dto);

        return response()->json($result->toArray());
    }

    #[OA\Get(
        path: '/datasets/{id}/data',
        summary: 'Obtener datos del dataset',
        security: [['sanctum' => []]],
        tags: ['Datasets'],
        parameters: [
            new OA\Parameter(name: 'id', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid')),
            new OA\Parameter(name: 'per_page', in: 'query', schema: new OA\Schema(type: 'integer', default: 50))
        ],
        responses: [
            new OA\Response(response: 200, description: 'Datos paginados')
        ]
    )]
    public function data(Request $request, string $id): JsonResponse
    {
        $perPage = (int) $request->query('per_page', 50);
        $result = $this->getDatasetDataUseCase->execute(
            $id,
            $request->user()->id,
            $perPage
        );

        return response()->json($result);
    }

    #[OA\Put(
        path: '/variables/{id}',
        summary: 'Actualizar variable',
        security: [['sanctum' => []]],
        tags: ['Datasets'],
        parameters: [
            new OA\Parameter(name: 'id', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid'))
        ],
        requestBody: new OA\RequestBody(
            content: new OA\JsonContent(
                properties: [
                    new OA\Property(property: 'tipo_dato', type: 'string'),
                    new OA\Property(property: 'es_visible', type: 'boolean'),
                    new OA\Property(property: 'nombre_columna', type: 'string')
                ]
            )
        ),
        responses: [
            new OA\Response(response: 200, description: 'Variable actualizada')
        ]
    )]
    public function updateVariable(UpdateVariableRequest $request, string $id): JsonResponse
    {
        $result = $this->updateVariableUseCase->execute(
            $id,
            $request->user()->id,
            $request->validated()
        );

        return response()->json($result);
    }

    #[OA\Put(
        path: '/datasets/{id}',
        summary: 'Actualizar dataset',
        security: [['sanctum' => []]],
        tags: ['Datasets'],
        parameters: [
            new OA\Parameter(name: 'id', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid'))
        ],
        requestBody: new OA\RequestBody(
            content: new OA\JsonContent(
                properties: [
                    new OA\Property(property: 'nombre', type: 'string'),
                    new OA\Property(property: 'descripcion', type: 'string'),
                    new OA\Property(property: 'enlace_fuente', type: 'string')
                ]
            )
        ),
        responses: [
            new OA\Response(response: 200, description: 'Dataset actualizado'),
            new OA\Response(response: 403, description: 'Sin permisos'),
            new OA\Response(response: 404, description: 'No encontrado')
        ]
    )]
    public function update(Request $request, string $id): JsonResponse
    {
        $validated = $request->validate([
            'nombre' => 'sometimes|string|max:255',
            'descripcion' => 'nullable|string|max:2000',
            'enlace_fuente' => 'nullable|string|url|max:500',
        ]);

        $result = $this->updateDatasetUseCase->execute($id, $request->user()->id, $validated);

        return response()->json($result->toArray());
    }

    #[OA\Post(
        path: '/variables/bulk-update',
        summary: 'Actualizar múltiples variables',
        security: [['sanctum' => []]],
        tags: ['Datasets'],
        requestBody: new OA\RequestBody(
            required: true,
            content: new OA\JsonContent(
                required: ['variable_ids'],
                properties: [
                    new OA\Property(property: 'variable_ids', type: 'array', items: new OA\Items(type: 'string', format: 'uuid')),
                    new OA\Property(property: 'es_visible', type: 'boolean'),
                    new OA\Property(property: 'tipo_dato', type: 'string', enum: ['NUMERICO', 'CATEGORICO', 'TEXTO', 'FECHA'])
                ]
            )
        ),
        responses: [
            new OA\Response(response: 200, description: 'Variables actualizadas'),
            new OA\Response(response: 403, description: 'Sin permisos')
        ]
    )]
    public function bulkUpdateVariables(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'variable_ids' => 'required|array|min:1|max:200',
            'variable_ids.*' => 'required|string|uuid',
            'es_visible' => 'sometimes|boolean',
            'tipo_dato' => 'sometimes|string|in:NUMERICO,CATEGORICO,TEXTO,FECHA',
        ]);

        $result = $this->bulkUpdateVariablesUseCase->execute(
            $validated['variable_ids'],
            $request->user()->id,
            array_filter($validated, fn($key) => $key !== 'variable_ids', ARRAY_FILTER_USE_KEY),
        );

        return response()->json($result);
    }

    #[OA\Delete(
        path: '/datasets/{id}',
        summary: 'Eliminar dataset',
        security: [['sanctum' => []]],
        tags: ['Datasets'],
        parameters: [
            new OA\Parameter(name: 'id', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid'))
        ],
        responses: [
            new OA\Response(response: 200, description: 'Dataset eliminado'),
            new OA\Response(response: 403, description: 'Sin permisos'),
            new OA\Response(response: 404, description: 'No encontrado')
        ]
    )]
    public function destroy(Request $request, string $id): JsonResponse
    {
        if ($request->user()?->rol !== 'ADMIN') {
            return response()->json([
                'message' => 'No autorizado para eliminar datasets.',
            ], 403);
        }

        $this->deleteDatasetUseCase->execute($id, $request->user()->id);

        return response()->json(['message' => 'Dataset eliminado exitosamente']);
    }
}
