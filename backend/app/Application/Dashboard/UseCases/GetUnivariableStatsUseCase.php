<?php

declare(strict_types=1);

namespace App\Application\Dashboard\UseCases;

use App\Application\Dashboard\DTOs\ChartDataDTO;
use App\Application\Dashboard\DTOs\StatsRequestDTO;
use App\Domain\Departamento\Repositories\DepartamentoRepositoryInterface;
use App\Domain\Dataset\Repositories\DatasetRepositoryInterface;
use App\Domain\Dataset\Repositories\RegistroDatoRepositoryInterface;
use App\Domain\Dataset\Repositories\VariableMetadatoRepositoryInterface;
use Illuminate\Http\Response;
use Symfony\Component\HttpKernel\Exception\HttpException;

class GetUnivariableStatsUseCase
{
    public function __construct(
        private readonly DatasetRepositoryInterface $datasetRepository,
        private readonly DepartamentoRepositoryInterface $departamentoRepository,
        private readonly VariableMetadatoRepositoryInterface $variableRepository,
        private readonly RegistroDatoRepositoryInterface $registroRepository,
    ) {}

    public function execute(StatsRequestDTO $dto): ChartDataDTO
    {
        // Obtener variable
        $variable = $this->variableRepository->findById($dto->variableId);
        
        if (!$variable) {
            throw new HttpException(Response::HTTP_NOT_FOUND, 'Variable no encontrada');
        }

        // Verificar acceso
        $dataset = $this->datasetRepository->findById($variable->datasetId);
        if (!$dataset) {
            throw new HttpException(Response::HTTP_NOT_FOUND, 'Dataset no encontrado');
        }

        $departamento = $this->departamentoRepository->findById($dataset->departamentoId);
        $hasAccess = $departamento?->publico || 
            $this->departamentoRepository->existsForUser($dataset->departamentoId, $dto->userId);

        if (!$hasAccess) {
            throw new HttpException(Response::HTTP_FORBIDDEN, 'No tienes acceso a este dataset');
        }

        // Generar datos según tipo de variable
        $chartType = $dto->chartType ?? $this->getDefaultChartType($variable->tipoDato);
        $limit = $dto->limit ?? 20;

        if ($variable->isNumerico()) {
            return $this->generateNumericChart($variable, $chartType, $limit);
        }

        return $this->generateCategoricalChart($variable, $chartType, $limit);
    }

    private function generateNumericChart($variable, string $chartType, int $limit): ChartDataDTO
    {
        $stats = $this->registroRepository->getNumericStats($variable->datasetId, $variable->nombreColumna);

        if ($chartType === 'histogram') {
            $data = $this->registroRepository->getHistogram($variable->datasetId, $variable->nombreColumna);
            
            return new ChartDataDTO(
                variableId: $variable->id,
                nombreVariable: $variable->nombreColumna,
                tipoVariable: $variable->tipoDato,
                chartType: 'histogram',
                data: [
                    'categories' => array_column($data, 'range'),
                    'values' => array_column($data, 'count'),
                ],
                stats: [
                    'count' => (int) ($stats['count'] ?? 0),
                    'mean' => round((float) ($stats['mean'] ?? 0), 2),
                    'min' => round((float) ($stats['min'] ?? 0), 2),
                    'max' => round((float) ($stats['max'] ?? 0), 2),
                    'sum' => round((float) ($stats['sum'] ?? 0), 2),
                    'median' => round((float) ($stats['median'] ?? 0), 2),
                ],
            );
        }

        // Bar chart con rangos
        $data = $this->registroRepository->getHistogram($variable->datasetId, $variable->nombreColumna);
        
        return new ChartDataDTO(
            variableId: $variable->id,
            nombreVariable: $variable->nombreColumna,
            tipoVariable: $variable->tipoDato,
            chartType: 'bar',
            data: [
                'categories' => array_column($data, 'range'),
                'values' => array_column($data, 'count'),
            ],
            stats: [
                'count' => (int) ($stats['count'] ?? 0),
                'mean' => round((float) ($stats['mean'] ?? 0), 2),
                'min' => round((float) ($stats['min'] ?? 0), 2),
                'max' => round((float) ($stats['max'] ?? 0), 2),
                'sum' => round((float) ($stats['sum'] ?? 0), 2),
                'median' => round((float) ($stats['median'] ?? 0), 2),
            ],
        );
    }

    private function generateCategoricalChart($variable, string $chartType, int $limit): ChartDataDTO
    {
        $frequencies = $this->registroRepository->getCategoricalFrequencies(
            $variable->datasetId, 
            $variable->nombreColumna, 
            $limit
        );

        $categories = [];
        $values = [];
        $total = 0;

        foreach ($frequencies as $item) {
            $categories[] = $item->categoria ?? 'Sin valor';
            $values[] = (int) $item->frecuencia;
            $total += (int) $item->frecuencia;
        }

        return new ChartDataDTO(
            variableId: $variable->id,
            nombreVariable: $variable->nombreColumna,
            tipoVariable: $variable->tipoDato,
            chartType: $chartType,
            data: [
                'categories' => $categories,
                'values' => $values,
            ],
            stats: [
                'count' => $total,
                'unique' => count($categories),
            ],
        );
    }

    private function getDefaultChartType(string $tipoDato): string
    {
        return match ($tipoDato) {
            'NUMERICO' => 'histogram',
            'CATEGORICO' => 'pie',
            'FECHA' => 'line',
            default => 'bar',
        };
    }
}
