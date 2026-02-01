<?php

declare(strict_types=1);

namespace App\Presentation\Http\Controllers\Api;

use OpenApi\Attributes as OA;
use App\Application\Dashboard\DTOs\BivariableRequestDTO;
use App\Application\Dashboard\DTOs\StatsRequestDTO;
use App\Application\Dashboard\UseCases\GetBivariableStatsUseCase;
use App\Application\Dashboard\UseCases\GetUnivariableStatsUseCase;
use App\Http\Controllers\Controller;
use App\Presentation\Http\Requests\BivariableRequest;
use App\Presentation\Http\Requests\StatsRequest;
use App\Presentation\Http\Resources\Dataset\ChartDataResource;
use Illuminate\Http\JsonResponse;

#[OA\Tag(name: 'Dashboard', description: 'Estadísticas y dashboard')]
class DashboardController extends Controller
{
    public function __construct(
        private readonly GetUnivariableStatsUseCase $univariableStatsUseCase,
        private readonly GetBivariableStatsUseCase $bivariableStatsUseCase,
    ) {}

    #[OA\Post(
        path: '/stats/univariable',
        summary: 'Obtener estadísticas univariables',
        security: [['sanctum' => []]],
        tags: ['Dashboard'],
        requestBody: new OA\RequestBody(
            required: true,
            content: new OA\JsonContent(
                required: ['dataset_id', 'variable_id'],
                properties: [
                    new OA\Property(property: 'dataset_id', type: 'string', format: 'uuid'),
                    new OA\Property(property: 'variable_id', type: 'string', format: 'uuid'),
                    new OA\Property(property: 'chart_type', type: 'string', enum: ['bar', 'pie', 'line', 'doughnut']),
                    new OA\Property(property: 'limit', type: 'integer', default: 20)
                ]
            )
        ),
        responses: [
            new OA\Response(response: 200, description: 'Estadísticas univariables')
        ]
    )]
    public function univariable(StatsRequest $request): JsonResponse
    {
        $dto = StatsRequestDTO::fromArray(
            $request->validated(),
            $request->user()->id
        );

        $result = $this->univariableStatsUseCase->execute($dto);

        return response()->json(new ChartDataResource($result));
    }

    #[OA\Post(
        path: '/stats/bivariable',
        summary: 'Obtener estadísticas bivariables',
        security: [['sanctum' => []]],
        tags: ['Dashboard'],
        requestBody: new OA\RequestBody(
            required: true,
            content: new OA\JsonContent(
                required: ['dataset_id', 'variable_x_id', 'variable_y_id'],
                properties: [
                    new OA\Property(property: 'dataset_id', type: 'string', format: 'uuid'),
                    new OA\Property(property: 'variable_x_id', type: 'string', format: 'uuid'),
                    new OA\Property(property: 'variable_y_id', type: 'string', format: 'uuid'),
                    new OA\Property(property: 'chart_type', type: 'string', enum: ['bar', 'stackedBar', 'groupedBar', 'line', 'scatter']),
                    new OA\Property(property: 'limit', type: 'integer', default: 20)
                ]
            )
        ),
        responses: [
            new OA\Response(response: 200, description: 'Estadísticas bivariables')
        ]
    )]
    public function bivariable(BivariableRequest $request): JsonResponse
    {
        $dto = BivariableRequestDTO::fromArray(
            $request->validated(),
            $request->user()->id
        );

        $result = $this->bivariableStatsUseCase->execute($dto);

        return response()->json(new ChartDataResource($result));
    }
}
