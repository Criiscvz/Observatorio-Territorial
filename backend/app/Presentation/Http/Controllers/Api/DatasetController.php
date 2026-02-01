<?php

declare(strict_types=1);

namespace App\Presentation\Http\Controllers\Api;

use OpenApi\Annotations as OA;
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

/**
 * @OA\Tag(
 *     name="Datasets",
 *     description="Gestión de datasets"
 * )
 */
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

    /**
     * @OA\Get(
     *     path="/api/datasets",
     *     summary="Listar datasets",
     *     tags={"Datasets"},
     *     security={{"sanctum":{}}},
     *     @OA\Parameter(name="departamento_id", in="query", @OA\Schema(type="string", format="uuid")),
     *     @OA\Response(response=200, description="Lista de datasets")
     * )
     */
    public function index(Request $request): JsonResponse
    {
        $departamentoId = $request->query('departamento_id');
        $result = $this->getDatasetsUseCase->execute(
            $request->user()->id,
            $departamentoId
        );

        return response()->json(DatasetResource::collection($result));
    }

    /**
     * @OA\Post(
     *     path="/api/datasets",
     *     summary="Subir nuevo dataset",
     *     tags={"Datasets"},
     *     security={{"sanctum":{}}},
     *     @OA\RequestBody(
     *         required=true,
     *         @OA\MediaType(
     *             mediaType="multipart/form-data",
     *             @OA\Schema(
     *                 required={"departamento_id","nombre","archivo"},
     *                 @OA\Property(property="departamento_id", type="string", format="uuid"),
     *                 @OA\Property(property="nombre", type="string"),
     *                 @OA\Property(property="descripcion", type="string"),
     *                 @OA\Property(property="archivo", type="string", format="binary")
     *             )
     *         )
     *     ),
     *     @OA\Response(response=201, description="Dataset creado")
     * )
     */
    public function store(UploadDatasetRequest $request): JsonResponse
    {
        $dto = UploadDatasetDTO::fromArray(
            $request->validated(),
            $request->user()->id
        );

        $result = $this->uploadDatasetUseCase->execute($dto);

        return response()->json($result->toArray(), 201);
    }

    /**
     * @OA\Get(
     *     path="/api/datasets/{id}",
     *     summary="Obtener dataset",
     *     tags={"Datasets"},
     *     security={{"sanctum":{}}},
     *     @OA\Parameter(name="id", in="path", required=true, @OA\Schema(type="string", format="uuid")),
     *     @OA\Response(response=200, description="Datos del dataset")
     * )
     */
    public function show(Request $request, string $id): JsonResponse
    {
        $result = $this->getDatasetUseCase->execute($id, $request->user()->id);

        return response()->json($result->toArray());
    }

    /**
     * @OA\Post(
     *     path="/api/datasets/{id}/analyze",
     *     summary="Analizar dataset",
     *     tags={"Datasets"},
     *     security={{"sanctum":{}}},
     *     @OA\Parameter(name="id", in="path", required=true, @OA\Schema(type="string", format="uuid")),
     *     @OA\Response(response=200, description="Resultado del análisis")
     * )
     */
    public function analyze(Request $request, string $id): JsonResponse
    {
        $result = $this->analyzeDatasetUseCase->execute($id, $request->user()->id);

        return response()->json($result->toArray());
    }

    /**
     * @OA\Post(
     *     path="/api/datasets/{id}/import",
     *     summary="Confirmar importación",
     *     tags={"Datasets"},
     *     security={{"sanctum":{}}},
     *     @OA\Parameter(name="id", in="path", required=true, @OA\Schema(type="string", format="uuid")),
     *     @OA\RequestBody(
     *         required=true,
     *         @OA\JsonContent(
     *             required={"columnas"},
     *             @OA\Property(property="columnas", type="array", @OA\Items(type="object"))
     *         )
     *     ),
     *     @OA\Response(response=200, description="Importación completada")
     * )
     */
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

    /**
     * @OA\Get(
     *     path="/api/datasets/{id}/data",
     *     summary="Obtener datos del dataset",
     *     tags={"Datasets"},
     *     security={{"sanctum":{}}},
     *     @OA\Parameter(name="id", in="path", required=true, @OA\Schema(type="string", format="uuid")),
     *     @OA\Parameter(name="per_page", in="query", @OA\Schema(type="integer", default=50)),
     *     @OA\Response(response=200, description="Datos paginados")
     * )
     */
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

    /**
     * @OA\Put(
     *     path="/api/variables/{id}",
     *     summary="Actualizar variable",
     *     tags={"Datasets"},
     *     security={{"sanctum":{}}},
     *     @OA\Parameter(name="id", in="path", required=true, @OA\Schema(type="string", format="uuid")),
     *     @OA\RequestBody(
     *         @OA\JsonContent(
     *             @OA\Property(property="tipo_dato", type="string"),
     *             @OA\Property(property="es_visible", type="boolean"),
     *             @OA\Property(property="nombre_columna", type="string")
     *         )
     *     ),
     *     @OA\Response(response=200, description="Variable actualizada")
     * )
     */
    public function updateVariable(UpdateVariableRequest $request, string $id): JsonResponse
    {
        $result = $this->updateVariableUseCase->execute(
            $id,
            $request->user()->id,
            $request->validated()
        );

        return response()->json($result);
    }
}
