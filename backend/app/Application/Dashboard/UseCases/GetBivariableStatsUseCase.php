<?php

declare(strict_types=1);

namespace App\Application\Dashboard\UseCases;

use App\Application\Dashboard\DTOs\BivariableRequestDTO;
use App\Application\Dashboard\DTOs\BivariableResponseDTO;
use App\Domain\Departamento\Repositories\DepartamentoRepositoryInterface;
use App\Domain\Dataset\Repositories\DatasetRepositoryInterface;
use App\Domain\Dataset\Repositories\VariableMetadatoRepositoryInterface;
use App\Domain\Statistics\Services\StatisticsServiceInterface;
use Illuminate\Http\Response;
use Symfony\Component\HttpKernel\Exception\HttpException;

class GetBivariableStatsUseCase
{
    public function __construct(
        private readonly DatasetRepositoryInterface $datasetRepository,
        private readonly DepartamentoRepositoryInterface $departamentoRepository,
        private readonly VariableMetadatoRepositoryInterface $variableRepository,
        private readonly StatisticsServiceInterface $statisticsService,
    ) {}

    public function execute(BivariableRequestDTO $dto): BivariableResponseDTO
    {
        // Obtener variables
        $variableX = $this->variableRepository->findById($dto->variableXId);
        $variableY = $this->variableRepository->findById($dto->variableYId);
        
        if (!$variableX || !$variableY) {
            throw new HttpException(Response::HTTP_NOT_FOUND, 'Variable no encontrada');
        }

        // Verificar que ambas variables pertenezcan al mismo dataset
        if ($variableX->datasetId !== $variableY->datasetId) {
            throw new HttpException(Response::HTTP_BAD_REQUEST, 'Las variables deben pertenecer al mismo dataset');
        }

        // Verificar acceso
        $dataset = $this->datasetRepository->findById($variableX->datasetId);
        if (!$dataset) {
            throw new HttpException(Response::HTTP_NOT_FOUND, 'Dataset no encontrado');
        }

        $departamento = $this->departamentoRepository->findById($dataset->departamentoId);
        $hasAccess = $departamento?->publico || 
            $this->departamentoRepository->existsForUser($dataset->departamentoId, $dto->userId);

        if (!$hasAccess) {
            throw new HttpException(Response::HTTP_FORBIDDEN, 'No tienes acceso a este dataset');
        }

        $chartType = $dto->chartType ?? $this->determineChartType($variableX->tipoDato, $variableY->tipoDato);
        $limit = $dto->limit ?? 20;

        return $this->generateBivariableData($variableX, $variableY, $chartType, $limit, $dto->filters);
    }

    private function generateBivariableData($variableX, $variableY, string $chartType, int $limit, ?array $filters = null): BivariableResponseDTO
    {
        $datasetId = $variableX->datasetId;

        // Normalizar tipos: TEXTO se trata como CATEGORICO
        $tipoX = $this->normalizeTipo($variableX->tipoDato);
        $tipoY = $this->normalizeTipo($variableY->tipoDato);

        // Ambas numéricas -> Scatter plot
        if ($tipoX === 'NUMERICO' && $tipoY === 'NUMERICO') {
            $result = $this->statisticsService->getScatterData(
                $datasetId,
                $variableX->nombreColumna,
                $variableY->nombreColumna,
                1000,
                $filters
            );

            return new BivariableResponseDTO(
                variableXId: $variableX->id,
                variableYId: $variableY->id,
                nombreVariableX: $variableX->nombreColumna,
                nombreVariableY: $variableY->nombreColumna,
                chartType: 'scatter',
                data: $result['data'],
                stats: $result['stats'],
            );
        }

        // Categórica/Texto + Numérica -> Bar chart agrupado
        if ($tipoX === 'CATEGORICO' && $tipoY === 'NUMERICO') {
            $result = $this->statisticsService->getGroupedBarData(
                $datasetId,
                $variableX->nombreColumna,
                $variableY->nombreColumna,
                $limit,
                $filters
            );

            return new BivariableResponseDTO(
                variableXId: $variableX->id,
                variableYId: $variableY->id,
                nombreVariableX: $variableX->nombreColumna,
                nombreVariableY: $variableY->nombreColumna,
                chartType: 'grouped_bar',
                data: $result['data'],
                stats: $result['stats'],
            );
        }

        // Numérica + Categórica/Texto -> invertir
        if ($tipoX === 'NUMERICO' && $tipoY === 'CATEGORICO') {
            $result = $this->statisticsService->getGroupedBarData(
                $datasetId,
                $variableY->nombreColumna,
                $variableX->nombreColumna,
                $limit,
                $filters
            );

            return new BivariableResponseDTO(
                variableXId: $variableX->id,
                variableYId: $variableY->id,
                nombreVariableX: $variableX->nombreColumna,
                nombreVariableY: $variableY->nombreColumna,
                chartType: 'grouped_bar',
                data: $result['data'],
                stats: $result['stats'],
            );
        }

        // Ambas categóricas/texto -> Heatmap o stacked bar
        if ($tipoX === 'CATEGORICO' && $tipoY === 'CATEGORICO') {
            $result = $this->statisticsService->getHeatmapData(
                $datasetId,
                $variableX->nombreColumna,
                $variableY->nombreColumna,
                $limit,
                $filters
            );

            return new BivariableResponseDTO(
                variableXId: $variableX->id,
                variableYId: $variableY->id,
                nombreVariableX: $variableX->nombreColumna,
                nombreVariableY: $variableY->nombreColumna,
                chartType: $chartType === 'heatmap' ? 'heatmap' : 'stacked_bar',
                data: $result['data'],
                stats: $result['stats'],
            );
        }

        // FECHA + NUMERICO -> serie temporal
        if (($tipoX === 'FECHA' && $tipoY === 'NUMERICO') ||
            ($tipoX === 'NUMERICO' && $tipoY === 'FECHA')) {
            $dateColumn = $tipoX === 'FECHA' ? $variableX->nombreColumna : $variableY->nombreColumna;
            $numColumn = $tipoX === 'NUMERICO' ? $variableX->nombreColumna : $variableY->nombreColumna;
            
            $result = $this->statisticsService->getTimeSeriesData(
                $datasetId,
                $dateColumn,
                $numColumn,
                $limit,
                $filters
            );

            return new BivariableResponseDTO(
                variableXId: $variableX->id,
                variableYId: $variableY->id,
                nombreVariableX: $variableX->nombreColumna,
                nombreVariableY: $variableY->nombreColumna,
                chartType: 'line_time',
                data: $result['data'],
                stats: $result['stats'],
            );
        }

        // FECHA + CATEGORICO -> evolución temporal
        if (($tipoX === 'FECHA' && $tipoY === 'CATEGORICO') ||
            ($tipoX === 'CATEGORICO' && $tipoY === 'FECHA')) {
            $dateColumn = $tipoX === 'FECHA' ? $variableX->nombreColumna : $variableY->nombreColumna;
            $catColumn = $tipoX === 'CATEGORICO' ? $variableX->nombreColumna : $variableY->nombreColumna;
            
            $result = $this->statisticsService->getStackedBarData(
                $datasetId,
                $dateColumn,
                $catColumn,
                $limit,
                $filters
            );

            return new BivariableResponseDTO(
                variableXId: $variableX->id,
                variableYId: $variableY->id,
                nombreVariableX: $variableX->nombreColumna,
                nombreVariableY: $variableY->nombreColumna,
                chartType: 'stacked_bar',
                data: $result['data'],
                stats: $result['stats'],
            );
        }

        // Fallback: tratar como categóricas
        $result = $this->statisticsService->getHeatmapData(
            $datasetId,
            $variableX->nombreColumna,
            $variableY->nombreColumna,
            $limit,
            $filters
        );

        return new BivariableResponseDTO(
            variableXId: $variableX->id,
            variableYId: $variableY->id,
            nombreVariableX: $variableX->nombreColumna,
            nombreVariableY: $variableY->nombreColumna,
            chartType: 'stacked_bar',
            data: $result['data'],
            stats: $result['stats'],
        );
    }

    /**
     * Normaliza el tipo de dato para análisis
     */
    private function normalizeTipo(string $tipo): string
    {
        return $tipo === 'TEXTO' ? 'CATEGORICO' : $tipo;
    }

    private function determineChartType(string $tipoX, string $tipoY): string
    {
        // Normalizar tipos
        $tipoX = $this->normalizeTipo($tipoX);
        $tipoY = $this->normalizeTipo($tipoY);

        if ($tipoX === 'NUMERICO' && $tipoY === 'NUMERICO') {
            return 'scatter';
        }

        if (($tipoX === 'CATEGORICO' && $tipoY === 'NUMERICO') ||
            ($tipoX === 'NUMERICO' && $tipoY === 'CATEGORICO')) {
            return 'grouped_bar';
        }

        if ($tipoX === 'CATEGORICO' && $tipoY === 'CATEGORICO') {
            return 'heatmap';
        }

        if (($tipoX === 'FECHA' && $tipoY === 'NUMERICO') ||
            ($tipoX === 'NUMERICO' && $tipoY === 'FECHA')) {
            return 'line_time';
        }

        if (($tipoX === 'FECHA' && $tipoY === 'CATEGORICO') ||
            ($tipoX === 'CATEGORICO' && $tipoY === 'FECHA')) {
            return 'stacked_bar';
        }

        return 'stacked_bar';
    }
}
