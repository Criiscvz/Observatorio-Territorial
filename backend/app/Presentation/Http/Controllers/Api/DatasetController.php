<?php

declare(strict_types=1);

namespace App\Presentation\Http\Controllers\Api;

use OpenApi\Attributes as OA;
use App\Application\Dataset\DTOs\ConfirmImportDTO;
use App\Application\Dataset\DTOs\UploadDatasetDTO;
use App\Application\Dataset\UseCases\AnalyzeDatasetUseCase;
use App\Application\Dataset\UseCases\ConfirmImportUseCase;
use App\Application\Dataset\UseCases\GetDatasetDataUseCase;
use App\Application\Dataset\UseCases\GetDatasetsUseCase;
use App\Application\Dataset\UseCases\GetDatasetUseCase;
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

        return response()->json($result->toArray());
    }
}
