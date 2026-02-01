<?php

declare(strict_types=1);

namespace App\Application\Public\UseCases;

use App\Application\Public\DTOs\BivariableStatsDTO;
use App\Application\Public\DTOs\ChartDataDTO;
use App\Domain\Dataset\Repositories\DatasetRepositoryInterface;
use App\Domain\Dataset\Repositories\VariableMetadatoRepositoryInterface;
use App\Domain\Statistics\Services\StatisticsServiceInterface;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;
use Symfony\Component\HttpKernel\Exception\BadRequestHttpException;

class GetBivariableStatsUseCase
{
    public function __construct(
        private readonly DatasetRepositoryInterface $datasetRepository,
        private readonly VariableMetadatoRepositoryInterface $variableRepository,
        private readonly StatisticsServiceInterface $statisticsService,
    ) {}

    public function execute(BivariableStatsDTO $dto): ChartDataDTO
    {
        // Verificar que el dataset existe y es público
        $dataset = $this->datasetRepository->findPublicById($dto->datasetId);

        if (!$dataset) {
            throw new NotFoundHttpException('Dataset no público o no encontrado');
        }

        // Obtener las variables
        $varX = $this->variableRepository->findById($dto->variableXId);
        $varY = $this->variableRepository->findById($dto->variableYId);

        if (!$varX || !$varY || $varX->datasetId !== $dto->datasetId || $varY->datasetId !== $dto->datasetId) {
            throw new NotFoundHttpException('Variable no encontrada');
        }

        // Normalizar tipos
        $tipoX = $this->normalizeTipo($varX->tipoDato);
        $tipoY = $this->normalizeTipo($varY->tipoDato);

        // Determinar el tipo de gráfico y obtener datos
        [$result, $chartType] = $this->getChartData(
            $dto->datasetId,
            $varX,
            $varY,
            $tipoX,
            $tipoY,
            $dto->limit
        );

        return new ChartDataDTO(
            variableXId: $varX->id,
            variableYId: $varY->id,
            nombreVariableX: $varX->nombreOriginal,
            nombreVariableY: $varY->nombreOriginal,
            chartType: $chartType,
            data: $result['data'],
            stats: $result['stats'],
        );
    }

    private function normalizeTipo(string $tipo): string
    {
        return $tipo === 'TEXTO' ? 'CATEGORICO' : $tipo;
    }

    private function getChartData(
        string $datasetId,
        object $varX,
        object $varY,
        string $tipoX,
        string $tipoY,
        int $limit
    ): array {
        // Ambas numéricas -> scatter
        if ($tipoX === 'NUMERICO' && $tipoY === 'NUMERICO') {
            return [
                $this->statisticsService->getScatterData($datasetId, $varX->nombreColumna, $varY->nombreColumna, $limit),
                'scatter'
            ];
        }

        // Una categórica, una numérica -> grouped bar
        if (($tipoX === 'CATEGORICO' && $tipoY === 'NUMERICO') ||
            ($tipoX === 'NUMERICO' && $tipoY === 'CATEGORICO')
        ) {
            $catVar = $tipoX === 'CATEGORICO' ? $varX : $varY;
            $numVar = $tipoX === 'NUMERICO' ? $varX : $varY;

            return [
                $this->statisticsService->getGroupedBarData($datasetId, $catVar->nombreColumna, $numVar->nombreColumna, $limit),
                'grouped_bar'
            ];
        }

        // Ambas categóricas -> heatmap
        if ($tipoX === 'CATEGORICO' && $tipoY === 'CATEGORICO') {
            return [
                $this->statisticsService->getHeatmapData($datasetId, $varX->nombreColumna, $varY->nombreColumna, $limit),
                'heatmap'
            ];
        }

        // FECHA + NUMERICO -> serie temporal
        if (($tipoX === 'FECHA' && $tipoY === 'NUMERICO') ||
            ($tipoX === 'NUMERICO' && $tipoY === 'FECHA')
        ) {
            $dateVar = $tipoX === 'FECHA' ? $varX : $varY;
            $numVar = $tipoX === 'NUMERICO' ? $varX : $varY;

            return [
                $this->statisticsService->getTimeSeriesData($datasetId, $dateVar->nombreColumna, $numVar->nombreColumna, $limit),
                'line_time'
            ];
        }

        // FECHA + CATEGORICO -> stacked bar
        if (($tipoX === 'FECHA' && $tipoY === 'CATEGORICO') ||
            ($tipoX === 'CATEGORICO' && $tipoY === 'FECHA')
        ) {
            $dateVar = $tipoX === 'FECHA' ? $varX : $varY;
            $catVar = $tipoX === 'CATEGORICO' ? $varX : $varY;

            return [
                $this->statisticsService->getStackedBarData($datasetId, $dateVar->nombreColumna, $catVar->nombreColumna, $limit),
                'stacked_bar'
            ];
        }

        // FECHA + FECHA -> línea temporal
        if ($tipoX === 'FECHA' && $tipoY === 'FECHA') {
            return [
                $this->statisticsService->getTimeSeriesData($datasetId, $varX->nombreColumna, $varY->nombreColumna, $limit),
                'line_time'
            ];
        }

        throw new BadRequestHttpException('Combinación de tipos no soportada');
    }
}
