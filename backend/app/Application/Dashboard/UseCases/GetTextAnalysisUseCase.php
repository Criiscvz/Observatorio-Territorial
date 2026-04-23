<?php

declare(strict_types=1);

namespace App\Application\Dashboard\UseCases;

use App\Application\Dashboard\DTOs\TextAnalysisRequestDTO;
use App\Domain\Departamento\Repositories\DepartamentoRepositoryInterface;
use App\Domain\Dataset\Repositories\DatasetRepositoryInterface;
use App\Domain\Dataset\Repositories\VariableMetadatoRepositoryInterface;
use App\Domain\Statistics\Services\StatisticsServiceInterface;
use Illuminate\Http\Response;
use Symfony\Component\HttpKernel\Exception\HttpException;

class GetTextAnalysisUseCase
{
    public function __construct(
        private readonly DatasetRepositoryInterface $datasetRepository,
        private readonly DepartamentoRepositoryInterface $departamentoRepository,
        private readonly VariableMetadatoRepositoryInterface $variableRepository,
        private readonly StatisticsServiceInterface $statisticsService,
    ) {}

    public function execute(TextAnalysisRequestDTO $dto): array
    {
        // Obtener variable
        $variable = $this->variableRepository->findById($dto->variableId);

        if (!$variable) {
            throw new HttpException(Response::HTTP_NOT_FOUND, 'Variable no encontrada');
        }

        // Verificar que sea de tipo TEXTO
        if ($variable->tipoDato !== 'TEXTO') {
            throw new HttpException(Response::HTTP_BAD_REQUEST, 'El análisis de texto solo está disponible para variables de tipo TEXTO');
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

        $result = $this->statisticsService->getTextAnalysis(
            $variable->datasetId,
            $variable->nombreColumna,
            $dto->limit,
            $dto->filters
        );

        return [
            'variable_id' => $variable->id,
            'nombre_variable' => $variable->nombreColumna,
            'tipo_variable' => $variable->tipoDato,
            ...$result,
        ];
    }
}
