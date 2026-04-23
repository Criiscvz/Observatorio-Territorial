<?php

declare(strict_types=1);

namespace App\Application\Public\UseCases;

use App\Application\Public\DTOs\TextAnalysisDTO;
use App\Domain\Dataset\Repositories\DatasetRepositoryInterface;
use App\Domain\Dataset\Repositories\VariableMetadatoRepositoryInterface;
use App\Domain\Statistics\Services\StatisticsServiceInterface;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;
use Symfony\Component\HttpKernel\Exception\HttpException;

class GetTextAnalysisUseCase
{
    public function __construct(
        private readonly DatasetRepositoryInterface $datasetRepository,
        private readonly VariableMetadatoRepositoryInterface $variableRepository,
        private readonly StatisticsServiceInterface $statisticsService,
    ) {}

    public function execute(TextAnalysisDTO $dto): array
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

        // Verificar tipo TEXTO
        if ($variable->tipoDato !== 'TEXTO') {
            throw new HttpException(400, 'El análisis de texto solo está disponible para variables de tipo TEXTO');
        }

        $result = $this->statisticsService->getTextAnalysis(
            $dto->datasetId,
            $variable->nombreColumna,
            $dto->limit,
            $dto->filters
        );

        return [
            'variable_id' => $variable->id,
            'nombre_variable' => $variable->nombreOriginal,
            'tipo_variable' => $variable->tipoDato,
            ...$result,
        ];
    }
}
