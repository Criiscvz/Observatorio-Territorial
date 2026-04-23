<?php

declare(strict_types=1);

namespace App\Application\Public\UseCases;

use App\Application\Public\DTOs\ChartDataDTO;
use App\Application\Public\DTOs\UnivariableStatsDTO;
use App\Domain\Dataset\Repositories\DatasetRepositoryInterface;
use App\Domain\Dataset\Repositories\VariableMetadatoRepositoryInterface;
use App\Domain\Statistics\Services\StatisticsServiceInterface;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

class GetUnivariableStatsUseCase
{
    public function __construct(
        private readonly DatasetRepositoryInterface $datasetRepository,
        private readonly VariableMetadatoRepositoryInterface $variableRepository,
        private readonly StatisticsServiceInterface $statisticsService,
    ) {}

    public function execute(UnivariableStatsDTO $dto): ChartDataDTO
    {
        // Verificar que el dataset existe y es público
        $dataset = $this->datasetRepository->findPublicById($dto->datasetId);

        if (!$dataset) {
            throw new NotFoundHttpException('Dataset no público o no encontrado');
        }

        // Obtener la variable
        $variable = $this->variableRepository->findById($dto->variableId);

        if (!$variable || $variable->datasetId !== $dto->datasetId) {
            throw new NotFoundHttpException('Variable no encontrada');
        }

        $tipo = $variable->tipoDato;
        $columna = $variable->nombreColumna;

        // Obtener estadísticas según tipo
        $chartType = $dto->chartType;

        if ($chartType === 'wordcloud' && ($tipo === 'TEXTO' || $tipo === 'CATEGORICO')) {
            $result = $this->statisticsService->getWordCloudData($dto->datasetId, $columna, $dto->limit, $dto->filters);
            $chartType = 'wordcloud';
        } elseif ($tipo === 'NUMERICO') {
            $result = $this->statisticsService->getNumericStats($dto->datasetId, $columna, $dto->limit, $dto->filters);
            $chartType = $chartType ?? 'histogram';
        } elseif ($tipo === 'FECHA') {
            $result = $this->statisticsService->getDateStats($dto->datasetId, $columna, $dto->limit, $dto->filters);
            $chartType = $chartType ?? 'line';
        } elseif ($tipo === 'TEXTO') {
            $result = $this->statisticsService->getTextSummaryStats($dto->datasetId, $columna, $dto->limit, $dto->filters);
            $chartType = $chartType ?? 'bar';
        } else {
            $result = $this->statisticsService->getCategoricalStats($dto->datasetId, $columna, $dto->limit, $dto->filters);
            $chartType = $chartType ?? 'bar';
        }

        return new ChartDataDTO(
            variableId: $variable->id,
            nombreVariable: $variable->nombreOriginal,
            tipoVariable: $tipo,
            chartType: $chartType,
            data: $result['data'],
            stats: $result['stats'],
        );
    }
}
