<?php

declare(strict_types=1);

namespace App\Application\Dashboard\UseCases;

use App\Application\Dashboard\DTOs\ChartDataDTO;
use App\Application\Dashboard\DTOs\StatsRequestDTO;
use App\Domain\Departamento\Repositories\DepartamentoRepositoryInterface;
use App\Domain\Dataset\Repositories\DatasetRepositoryInterface;
use App\Domain\Dataset\Repositories\VariableMetadatoRepositoryInterface;
use App\Domain\Statistics\Services\StatisticsServiceInterface;
use App\Presentation\Http\Requests\Stats\StatsRequest;
use Illuminate\Http\Response;
use Symfony\Component\HttpKernel\Exception\HttpException;

class GetUnivariableStatsUseCase
{
    public function __construct(
        private readonly DatasetRepositoryInterface $datasetRepository,
        private readonly DepartamentoRepositoryInterface $departamentoRepository,
        private readonly VariableMetadatoRepositoryInterface $variableRepository,
        private readonly StatisticsServiceInterface $statisticsService,
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

        // Determinar tipo de gráfico
        $defaultChartType = $this->getDefaultChartType($variable->tipoDato);
        $chartType = $dto->chartType ?? $defaultChartType;
        
        // Validar compatibilidad
        if (!StatsRequest::isChartCompatible($chartType, $variable->tipoDato)) {
            $chartType = $defaultChartType;
        }
        
        $limit = $dto->limit ?? 20;

        // Usar el servicio compartido de estadísticas
        if ($chartType === 'wordcloud' && ($variable->tipoDato === 'TEXTO' || $variable->tipoDato === 'CATEGORICO')) {
            $result = $this->statisticsService->getWordCloudData(
                $variable->datasetId,
                $variable->nombreColumna,
                $limit,
                $dto->filters
            );
        } elseif ($variable->isNumerico()) {
            $result = $this->statisticsService->getNumericStats(
                $variable->datasetId, 
                $variable->nombreColumna, 
                $limit,
                $dto->filters
            );
        } else {
            $result = $this->statisticsService->getCategoricalStats(
                $variable->datasetId, 
                $variable->nombreColumna, 
                $limit,
                $dto->filters
            );
        }

        return new ChartDataDTO(
            variableId: $variable->id,
            nombreVariable: $variable->nombreColumna,
            tipoVariable: $variable->tipoDato,
            chartType: $chartType,
            data: $result['data'],
            stats: $result['stats'],
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
