<?php

declare(strict_types=1);

namespace App\Application\Dashboard\UseCases;

use App\Application\Dashboard\DTOs\BivariableRequestDTO;
use App\Application\Dashboard\DTOs\BivariableResponseDTO;
use App\Domain\Departamento\Repositories\DepartamentoRepositoryInterface;
use App\Domain\Dataset\Repositories\DatasetRepositoryInterface;
use App\Domain\Dataset\Repositories\RegistroDatoRepositoryInterface;
use App\Domain\Dataset\Repositories\VariableMetadatoRepositoryInterface;
use Illuminate\Http\Response;
use Symfony\Component\HttpKernel\Exception\HttpException;

class GetBivariableStatsUseCase
{
    public function __construct(
        private readonly DatasetRepositoryInterface $datasetRepository,
        private readonly DepartamentoRepositoryInterface $departamentoRepository,
        private readonly VariableMetadatoRepositoryInterface $variableRepository,
        private readonly RegistroDatoRepositoryInterface $registroRepository,
    ) {}

    public function execute(BivariableRequestDTO $dto, int $userId): BivariableResponseDTO
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
            $this->departamentoRepository->existsForUser($dataset->departamentoId, $userId);

        if (!$hasAccess) {
            throw new HttpException(Response::HTTP_FORBIDDEN, 'No tienes acceso a este dataset');
        }

        $chartType = $dto->chartType ?? $this->determineChartType($variableX->tipoDato, $variableY->tipoDato);
        $limit = $dto->limit ?? 20;

        return $this->generateBivariableData($variableX, $variableY, $chartType, $limit);
    }

    private function generateBivariableData($variableX, $variableY, string $chartType, int $limit): BivariableResponseDTO
    {
        $datasetId = $variableX->datasetId;

        // Normalizar tipos: TEXTO se trata como CATEGORICO
        $tipoX = $this->normalizeTipo($variableX->tipoDato);
        $tipoY = $this->normalizeTipo($variableY->tipoDato);

        // Ambas numéricas -> Scatter plot
        if ($tipoX === 'NUMERICO' && $tipoY === 'NUMERICO') {
            $scatterData = $this->registroRepository->getScatterData(
                $datasetId,
                $variableX->nombreColumna,
                $variableY->nombreColumna,
                1000
            );

            // Calcular correlación
            $correlation = $this->calculateCorrelation($scatterData);

            return new BivariableResponseDTO(
                variableXId: $variableX->id,
                variableYId: $variableY->id,
                nombreVariableX: $variableX->nombreColumna,
                nombreVariableY: $variableY->nombreColumna,
                chartType: 'scatter',
                data: [
                    'points' => $scatterData,
                ],
                stats: [
                    'correlation' => $correlation,
                    'count' => count($scatterData),
                ],
            );
        }

        // Categórica/Texto + Numérica -> Bar chart agrupado
        if ($tipoX === 'CATEGORICO' && $tipoY === 'NUMERICO') {
            $grouped = $this->registroRepository->getGroupedAverages(
                $datasetId,
                $variableX->nombreColumna,
                $variableY->nombreColumna,
                $limit
            );

            return new BivariableResponseDTO(
                variableXId: $variableX->id,
                variableYId: $variableY->id,
                nombreVariableX: $variableX->nombreColumna,
                nombreVariableY: $variableY->nombreColumna,
                chartType: 'grouped_bar',
                data: [
                    'categories' => array_column($grouped, 'categoria'),
                    'labels' => array_column($grouped, 'categoria'),
                    'values' => array_map(fn($v) => round((float) $v->promedio, 2), $grouped),
                    'counts' => array_column($grouped, 'count'),
                ],
                stats: ['count' => array_sum(array_column($grouped, 'count'))],
            );
        }

        // Numérica + Categórica/Texto -> invertir
        if ($tipoX === 'NUMERICO' && $tipoY === 'CATEGORICO') {
            $grouped = $this->registroRepository->getGroupedAverages(
                $datasetId,
                $variableY->nombreColumna,
                $variableX->nombreColumna,
                $limit
            );

            return new BivariableResponseDTO(
                variableXId: $variableX->id,
                variableYId: $variableY->id,
                nombreVariableX: $variableX->nombreColumna,
                nombreVariableY: $variableY->nombreColumna,
                chartType: 'grouped_bar',
                data: [
                    'categories' => array_column($grouped, 'categoria'),
                    'labels' => array_column($grouped, 'categoria'),
                    'values' => array_map(fn($v) => round((float) $v->promedio, 2), $grouped),
                    'counts' => array_column($grouped, 'count'),
                ],
                stats: ['count' => array_sum(array_column($grouped, 'count'))],
            );
        }

        // Ambas categóricas/texto -> Heatmap o stacked bar
        if ($tipoX === 'CATEGORICO' && $tipoY === 'CATEGORICO') {
            $contingency = $this->registroRepository->getContingencyTable(
                $datasetId,
                $variableX->nombreColumna,
                $variableY->nombreColumna,
                $limit
            );

            return new BivariableResponseDTO(
                variableXId: $variableX->id,
                variableYId: $variableY->id,
                nombreVariableX: $variableX->nombreColumna,
                nombreVariableY: $variableY->nombreColumna,
                chartType: $chartType === 'heatmap' ? 'heatmap' : 'stacked_bar',
                data: $contingency,
                stats: null,
            );
        }

        // FECHA + NUMERICO -> serie temporal
        if (($tipoX === 'FECHA' && $tipoY === 'NUMERICO') ||
            ($tipoX === 'NUMERICO' && $tipoY === 'FECHA')) {
            $timeData = $this->registroRepository->getTimeSeriesAverage(
                $datasetId,
                $tipoX === 'FECHA' ? $variableX->nombreColumna : $variableY->nombreColumna,
                $tipoX === 'NUMERICO' ? $variableX->nombreColumna : $variableY->nombreColumna,
                $limit
            );

            return new BivariableResponseDTO(
                variableXId: $variableX->id,
                variableYId: $variableY->id,
                nombreVariableX: $variableX->nombreColumna,
                nombreVariableY: $variableY->nombreColumna,
                chartType: 'line_time',
                data: [
                    'labels' => array_column($timeData, 'fecha'),
                    'values' => array_map(fn($v) => round((float) $v->avg_value, 2), $timeData),
                    'counts' => array_column($timeData, 'count'),
                ],
                stats: ['count' => array_sum(array_column($timeData, 'count'))],
            );
        }

        // FECHA + CATEGORICO -> evolución temporal
        if (($tipoX === 'FECHA' && $tipoY === 'CATEGORICO') ||
            ($tipoX === 'CATEGORICO' && $tipoY === 'FECHA')) {
            $stackedData = $this->registroRepository->getStackedTimeData(
                $datasetId,
                $tipoX === 'FECHA' ? $variableX->nombreColumna : $variableY->nombreColumna,
                $tipoX === 'CATEGORICO' ? $variableX->nombreColumna : $variableY->nombreColumna,
                $limit
            );

            return new BivariableResponseDTO(
                variableXId: $variableX->id,
                variableYId: $variableY->id,
                nombreVariableX: $variableX->nombreColumna,
                nombreVariableY: $variableY->nombreColumna,
                chartType: 'stacked_bar',
                data: $stackedData,
                stats: null,
            );
        }

        // Fallback: tratar como categóricas
        $contingency = $this->registroRepository->getContingencyTable(
            $datasetId,
            $variableX->nombreColumna,
            $variableY->nombreColumna,
            $limit
        );

        return new BivariableResponseDTO(
            variableXId: $variableX->id,
            variableYId: $variableY->id,
            nombreVariableX: $variableX->nombreColumna,
            nombreVariableY: $variableY->nombreColumna,
            chartType: 'stacked_bar',
            data: $contingency,
            stats: null,
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

    private function calculateCorrelation(array $points): ?float
    {
        if (count($points) < 2) {
            return null;
        }

        $n = count($points);
        $sumX = 0;
        $sumY = 0;
        $sumXY = 0;
        $sumX2 = 0;
        $sumY2 = 0;

        foreach ($points as [$x, $y]) {
            $sumX += $x;
            $sumY += $y;
            $sumXY += $x * $y;
            $sumX2 += $x * $x;
            $sumY2 += $y * $y;
        }

        $numerator = ($n * $sumXY) - ($sumX * $sumY);
        $denominator = sqrt((($n * $sumX2) - ($sumX * $sumX)) * (($n * $sumY2) - ($sumY * $sumY)));

        if ($denominator == 0) {
            return null;
        }

        return round($numerator / $denominator, 4);
    }
}
