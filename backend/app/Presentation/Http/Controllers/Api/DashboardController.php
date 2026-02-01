<?php

declare(strict_types=1);

namespace App\Presentation\Http\Controllers\Api;

use App\Application\Dashboard\DTOs\BivariableRequestDTO;
use App\Application\Dashboard\DTOs\StatsRequestDTO;
use App\Application\Dashboard\UseCases\GetBivariableStatsUseCase;
use App\Application\Dashboard\UseCases\GetUnivariableStatsUseCase;
use App\Http\Controllers\Controller;
use App\Presentation\Http\Requests\BivariableRequest;
use App\Presentation\Http\Requests\StatsRequest;
use App\Presentation\Http\Resources\Dataset\ChartDataResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * @OA\Tag(
 *     name="Dashboard",
 *     description="Estadísticas y gráficos"
 * )
 */
class DashboardController extends Controller
{
    public function __construct(
        private readonly GetUnivariableStatsUseCase $getUnivariableStatsUseCase,
        private readonly GetBivariableStatsUseCase $getBivariableStatsUseCase,
    ) {}

    /**
     * @OA\Post(
     *     path="/api/stats/univariable",
     *     summary="Obtener estadísticas univariable",
     *     tags={"Dashboard"},
     *     security={{"sanctum":{}}},
     *     @OA\RequestBody(
     *         required=true,
     *         @OA\JsonContent(
     *             required={"dataset_id","variable_id"},
     *             @OA\Property(property="dataset_id", type="string", format="uuid"),
     *             @OA\Property(property="variable_id", type="string", format="uuid"),
     *             @OA\Property(property="chart_type", type="string"),
     *             @OA\Property(property="limit", type="integer")
     *         )
     *     ),
     *     @OA\Response(response=200, description="Datos del gráfico")
     * )
     */
    public function univariable(StatsRequest $request): JsonResponse
    {
        $dto = StatsRequestDTO::fromArray($request->validated());
        $result = $this->getUnivariableStatsUseCase->execute($dto, $request->user()->id);

        return response()->json(new ChartDataResource($result));
    }

    /**
     * @OA\Post(
     *     path="/api/stats/bivariable",
     *     summary="Obtener estadísticas bivariable",
     *     tags={"Dashboard"},
     *     security={{"sanctum":{}}},
     *     @OA\RequestBody(
     *         required=true,
     *         @OA\JsonContent(
     *             required={"dataset_id","variable_x_id","variable_y_id"},
     *             @OA\Property(property="dataset_id", type="string", format="uuid"),
     *             @OA\Property(property="variable_x_id", type="string", format="uuid"),
     *             @OA\Property(property="variable_y_id", type="string", format="uuid"),
     *             @OA\Property(property="chart_type", type="string"),
     *             @OA\Property(property="limit", type="integer")
     *         )
     *     ),
     *     @OA\Response(response=200, description="Datos del gráfico")
     * )
     */
    public function bivariable(BivariableRequest $request): JsonResponse
    {
        $dto = BivariableRequestDTO::fromArray($request->validated());
        $result = $this->getBivariableStatsUseCase->execute($dto, $request->user()->id);

        return response()->json(new ChartDataResource($result));
    }
}
