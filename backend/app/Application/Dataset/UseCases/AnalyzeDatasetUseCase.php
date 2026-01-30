<?php

declare(strict_types=1);

namespace App\Application\Dataset\UseCases;

use App\Application\Dataset\DTOs\AnalysisResultDTO;
use App\Domain\Departamento\Repositories\DepartamentoRepositoryInterface;
use App\Domain\Dataset\Repositories\DatasetRepositoryInterface;
use App\Infrastructure\Services\ExcelReaderService;
use Illuminate\Http\Response;
use Symfony\Component\HttpKernel\Exception\HttpException;

class AnalyzeDatasetUseCase
{
    public function __construct(
        private readonly DatasetRepositoryInterface $datasetRepository,
        private readonly DepartamentoRepositoryInterface $departamentoRepository,
        private readonly ExcelReaderService $excelReader,
    ) {}

    public function execute(string $datasetId, int $userId): AnalysisResultDTO
    {
        $dataset = $this->datasetRepository->findById($datasetId);

        if (!$dataset) {
            throw new HttpException(Response::HTTP_NOT_FOUND, 'Dataset no encontrado');
        }

        // Verificar acceso al departamento
        if (!$this->departamentoRepository->existsForUser($dataset->departamentoId, $userId)) {
            throw new HttpException(Response::HTTP_FORBIDDEN, 'No tienes acceso a este dataset');
        }

        // Analizar archivo
        $filePath = storage_path('app/datasets/' . $dataset->nombreArchivo);
        $analysis = $this->excelReader->analyze($filePath);

        return new AnalysisResultDTO(
            datasetId: $dataset->id,
            nombreArchivo: $dataset->nombreArchivo,
            totalFilas: $analysis['total_filas'],
            totalColumnas: count($analysis['columnas']),
            columnas: $analysis['columnas'],
            muestra: $analysis['preview'],
        );
    }
}
