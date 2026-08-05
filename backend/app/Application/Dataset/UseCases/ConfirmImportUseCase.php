<?php

declare(strict_types=1);

namespace App\Application\Dataset\UseCases;

use App\Application\Dataset\DTOs\ConfirmImportDTO;
use App\Application\Dataset\DTOs\DatasetResponseDTO;
use App\Domain\Departamento\Repositories\DepartamentoRepositoryInterface;
use App\Domain\Dataset\Repositories\DatasetRepositoryInterface;
use App\Domain\Dataset\Repositories\RegistroDatoRepositoryInterface;
use App\Domain\Dataset\Repositories\VariableMetadatoRepositoryInterface;
use App\Infrastructure\Services\ExcelReaderService;
use App\Infrastructure\Services\TemporaryStorageFileService;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpKernel\Exception\HttpException;

class ConfirmImportUseCase
{
    public function __construct(
        private readonly DatasetRepositoryInterface $datasetRepository,
        private readonly DepartamentoRepositoryInterface $departamentoRepository,
        private readonly VariableMetadatoRepositoryInterface $variableRepository,
        private readonly RegistroDatoRepositoryInterface $registroRepository,
        private readonly ExcelReaderService $excelReader,
        private readonly TemporaryStorageFileService $temporaryStorageFile,
    ) {}

    public function execute(ConfirmImportDTO $dto): DatasetResponseDTO
    {
        $dataset = $this->datasetRepository->findById($dto->datasetId);

        if (!$dataset) {
            throw new HttpException(Response::HTTP_NOT_FOUND, 'Dataset no encontrado');
        }

        // Verificar acceso al departamento
        if (!$this->departamentoRepository->existsForUser($dataset->departamentoId, $dto->userId)) {
            throw new HttpException(Response::HTTP_FORBIDDEN, 'No tienes acceso a este dataset');
        }

        // Verificar que el dataset esté pendiente
        if (!$dataset->isPendiente()) {
            throw new HttpException(Response::HTTP_BAD_REQUEST, 'El dataset ya fue procesado');
        }

        $filePath = $this->temporaryStorageFile->download('datasets/'.$dataset->nombreArchivo);
        $totalRegistros = 0;

        try {
            DB::transaction(function () use ($dto, $filePath, &$totalRegistros) {
            // Eliminar metadatos anteriores si existen
            $this->variableRepository->deleteByDatasetId($dto->datasetId);
            
            // Guardar nuevos metadatos
            $this->variableRepository->saveBatch($dto->datasetId, $dto->columnas);

            // Eliminar registros anteriores si existen
            $this->registroRepository->deleteByDatasetId($dto->datasetId);

            // Importar datos en lotes
            $batch = [];
            $batchSize = 500;

            foreach ($this->excelReader->import($filePath, $dto->columnas) as $registro) {
                $batch[] = $registro;
                $totalRegistros++;

                if (count($batch) >= $batchSize) {
                    $this->registroRepository->insertBatch($dto->datasetId, $batch);
                    $batch = [];
                }
            }

            // Insertar registros restantes
            if (!empty($batch)) {
                $this->registroRepository->insertBatch($dto->datasetId, $batch);
            }
            });
        } finally {
            @unlink($filePath);
        }

        // Actualizar estado del dataset
        $updatedDataset = $dataset->markAsCompletado($totalRegistros);
        $this->datasetRepository->update($updatedDataset);

        // Recargar dataset con variables
        $finalDataset = $this->datasetRepository->findById($dto->datasetId);

        return DatasetResponseDTO::fromEntity($finalDataset);
    }
}
