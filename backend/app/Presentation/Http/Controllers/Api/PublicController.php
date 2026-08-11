<?php

declare(strict_types=1);

namespace App\Presentation\Http\Controllers\Api;

use OpenApi\Attributes as OA;
use App\Application\Public\DTOs\BivariableStatsDTO;
use App\Application\Public\DTOs\TextAnalysisDTO;
use App\Application\Public\DTOs\UnivariableStatsDTO;
use App\Application\Public\UseCases\GetBivariableStatsUseCase;
use App\Application\Public\UseCases\GetPublicDatasetDataUseCase;
use App\Application\Public\UseCases\GetPublicDepartamentosUseCase;
use App\Application\Public\UseCases\GetTextAnalysisUseCase;
use App\Application\Public\UseCases\GetUnivariableStatsUseCase;
use App\Http\Controllers\Controller;
use App\Infrastructure\Persistence\Eloquent\Models\ArticuloModel;
use App\Infrastructure\Persistence\Eloquent\Models\ReporteModel;
use App\Models\Departamento;
use App\Models\ObservatorioPublicacion;
use App\Presentation\Http\Requests\Public\BivariableStatsRequest;
use App\Presentation\Http\Requests\Public\UnivariableStatsRequest;
use App\Presentation\Http\Resources\Publicacion\PublicacionResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

#[OA\Tag(name: 'Público', description: 'Endpoints públicos (sin autenticación)')]
class PublicController extends Controller
{
    public function __construct(
        private readonly GetPublicDepartamentosUseCase $getDepartamentosUseCase,
        private readonly GetPublicDatasetDataUseCase $getDatasetDataUseCase,
        private readonly GetUnivariableStatsUseCase $getUnivariableStatsUseCase,
        private readonly GetBivariableStatsUseCase $getBivariableStatsUseCase,
        private readonly GetTextAnalysisUseCase $getTextAnalysisUseCase,
    ) {}

    #[OA\Get(
        path: '/publico/departamentos',
        summary: 'Listar departamentos públicos',
        tags: ['Público'],
        responses: [
            new OA\Response(response: 200, description: 'Lista de departamentos públicos')
        ]
    )]
    public function departamentos(): JsonResponse
    {
        $departamentos = $this->getDepartamentosUseCase->execute();

        return response()->json(
            $departamentos->map(fn($d) => $d->toArray())
        );
    }

    #[OA\Get(
        path: '/publico/estadisticas',
        summary: 'Obtener totales públicos del portal',
        tags: ['Público'],
        responses: [
            new OA\Response(response: 200, description: 'Totales de observatorios y publicaciones públicas')
        ]
    )]
    public function estadisticas(): JsonResponse
    {
        $publicDepartmentIds = Departamento::query()->publicos()->pluck('id');

        $legacyArticles = ArticuloModel::query()
            ->whereIn('departamento_id', $publicDepartmentIds)
            ->where(fn ($query) => $query->whereNull('visibilidad')->orWhere('visibilidad', '!=', 'privado'))
            ->where(fn ($query) => $query->whereNull('estado')->orWhereIn('estado', ['PUBLICADO', 'PUBLICACION']))
            ->count();

        $legacyReports = ReporteModel::query()
            ->whereIn('departamento_id', $publicDepartmentIds)
            ->where(fn ($query) => $query->whereNull('visibilidad')->orWhere('visibilidad', '!=', 'privado'))
            ->count();

        $publishedPublications = ObservatorioPublicacion::query()
            ->whereIn('departamento_id', $publicDepartmentIds)
            ->where('estado', 'PUBLICACION');

        return response()->json([
            'observatorios' => $publicDepartmentIds->count(),
            'articulos' => $legacyArticles + (clone $publishedPublications)->where('tipo', 'ARTICULO')->count(),
            'reportes' => $legacyReports + (clone $publishedPublications)->where('tipo', 'REPORTE')->count(),
            'libros' => (clone $publishedPublications)->where('tipo', 'LIBRO')->count(),
        ]);
    }

    #[OA\Get(
        path: '/publico/departamentos/{id}',
        summary: 'Obtener departamento público',
        tags: ['Público'],
        parameters: [
            new OA\Parameter(name: 'id', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid'))
        ],
        responses: [
            new OA\Response(response: 200, description: 'Datos del departamento'),
            new OA\Response(response: 404, description: 'No encontrado')
        ]
    )]
    public function departamento(string $id): JsonResponse
    {
        $departamento = $this->getDepartamentosUseCase->getById($id);

        if (!$departamento) {
            return response()->json(['message' => 'Departamento no encontrado o no público'], 404);
        }

        return response()->json($departamento->toArray());
    }

    public function departamentoAtlas(string $id): \Illuminate\Http\Resources\Json\AnonymousResourceCollection|JsonResponse
    {
        $departamento = $this->getDepartamentosUseCase->getById($id);

        if (!$departamento) {
            return response()->json(['message' => 'Departamento no encontrado o no público'], 404);
        }

        $query = ObservatorioPublicacion::query()
            ->where('departamento_id', $id)
            ->where('tipo', 'LIBRO')
            ->where('estado', 'PUBLICACION')
            ->latest('fecha_publicacion');

        return PublicacionResource::collection($query->get());
    }

    public function atlas(Request $request): \Illuminate\Http\Resources\Json\AnonymousResourceCollection
    {
        $query = ObservatorioPublicacion::query()
            ->where('tipo', 'ATLAS')
            ->where('estado', 'PUBLICACION')
            ->whereNull('departamento_id')
            ->latest('fecha_publicacion');

        return PublicacionResource::collection($query->get());
    }

    private function isSubscriber($user): bool
    {
        return $user && in_array($user->rol, ['ADMIN', 'EDITOR', 'SUBSCRIBER', 'SUSCRIPTOR', 'SUBSCRIPTOR'], true);
    }

    #[OA\Get(
        path: '/publico/datasets/{id}/data',
        summary: 'Obtener datos de un dataset público',
        tags: ['Público'],
        parameters: [
            new OA\Parameter(name: 'id', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid')),
            new OA\Parameter(name: 'page', in: 'query', schema: new OA\Schema(type: 'integer', default: 1)),
            new OA\Parameter(name: 'per_page', in: 'query', schema: new OA\Schema(type: 'integer', default: 50))
        ],
        responses: [
            new OA\Response(response: 200, description: 'Datos paginados del dataset'),
            new OA\Response(response: 404, description: 'Dataset no encontrado')
        ]
    )]
    public function datasetData(string $id, Request $request): JsonResponse
    {
        $page = (int) $request->input('page', 1);
        $perPage = min((int) $request->input('per_page', 50), 100);

        $result = $this->getDatasetDataUseCase->execute($id, $page, $perPage);

        return response()->json($result);
    }

    #[OA\Post(
        path: '/publico/stats/univariable',
        summary: 'Estadísticas univariables',
        tags: ['Público'],
        requestBody: new OA\RequestBody(
            required: true,
            content: new OA\JsonContent(
                required: ['dataset_id', 'variable_id'],
                properties: [
                    new OA\Property(property: 'dataset_id', type: 'string', format: 'uuid'),
                    new OA\Property(property: 'variable_id', type: 'string', format: 'uuid'),
                    new OA\Property(property: 'chart_type', type: 'string'),
                    new OA\Property(property: 'limit', type: 'integer', default: 20)
                ]
            )
        ),
        responses: [
            new OA\Response(response: 200, description: 'Estadísticas de la variable')
        ]
    )]
    public function univariable(UnivariableStatsRequest $request): JsonResponse
    {
        $dto = UnivariableStatsDTO::fromArray($request->validated());
        $result = $this->getUnivariableStatsUseCase->execute($dto);

        return response()->json($result->toArray());
    }

    #[OA\Post(
        path: '/publico/stats/bivariable',
        summary: 'Estadísticas bivariables',
        tags: ['Público'],
        requestBody: new OA\RequestBody(
            required: true,
            content: new OA\JsonContent(
                required: ['dataset_id', 'variable_x_id', 'variable_y_id'],
                properties: [
                    new OA\Property(property: 'dataset_id', type: 'string', format: 'uuid'),
                    new OA\Property(property: 'variable_x_id', type: 'string', format: 'uuid'),
                    new OA\Property(property: 'variable_y_id', type: 'string', format: 'uuid'),
                    new OA\Property(property: 'chart_type', type: 'string'),
                    new OA\Property(property: 'limit', type: 'integer', default: 20)
                ]
            )
        ),
        responses: [
            new OA\Response(response: 200, description: 'Estadísticas bivariables')
        ]
    )]
    public function bivariable(BivariableStatsRequest $request): JsonResponse
    {
        $dto = BivariableStatsDTO::fromArray($request->validated());
        $result = $this->getBivariableStatsUseCase->execute($dto);

        return response()->json($result->toArray());
    }

    #[OA\Post(
        path: '/publico/stats/text-analysis',
        summary: 'Análisis completo de texto (NLP) - Público',
        description: 'Obtiene análisis avanzado de texto para datasets públicos: nube de palabras con stemming y n-grams, sentimiento, clasificación TF-IDF y frases frecuentes.',
        tags: ['Público'],
        requestBody: new OA\RequestBody(
            required: true,
            content: new OA\JsonContent(
                required: ['dataset_id', 'variable_id'],
                properties: [
                    new OA\Property(property: 'dataset_id', type: 'string', format: 'uuid'),
                    new OA\Property(property: 'variable_id', type: 'string', format: 'uuid'),
                    new OA\Property(property: 'limit', type: 'integer', default: 50),
                    new OA\Property(property: 'filters', type: 'array', items: new OA\Items(type: 'object'))
                ]
            )
        ),
        responses: [
            new OA\Response(response: 200, description: 'Análisis de texto completo'),
            new OA\Response(response: 400, description: 'Variable no es de tipo TEXTO'),
            new OA\Response(response: 404, description: 'Dataset o variable no encontrados'),
        ]
    )]
    public function textAnalysis(UnivariableStatsRequest $request): JsonResponse
    {
        $dto = TextAnalysisDTO::fromArray($request->validated());
        $result = $this->getTextAnalysisUseCase->execute($dto);

        return response()->json($result);
    }
}
