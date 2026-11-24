<?php

declare(strict_types=1);

namespace App\Application\Dataset\UseCases;

use App\Application\Dataset\DTOs\ConfirmImportDTO;
use App\Application\Dataset\DTOs\DatasetResponseDTO;
use App\Domain\Departamento\Repositories\DepartamentoRepositoryInterface;
use App\Domain\Dataset\Entities\Dataset;
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
        $dataset = $this->findPendingDataset($dto);
        $filePath = $this->temporaryStorageFile->download('datasets/'.$dataset->nombreArchivo);

        try {
            // The generator reads and validates source headers before any old metadata/rows are removed.
            $records = $this->excelReader->import($filePath, $dto->columnas);
            $records->rewind();

            return DB::transaction(function () use ($dto, $records): DatasetResponseDTO {
                $dataset = $this->findPendingDataset($dto, lockForUpdate: true);
                $this->variableRepository->deleteByDatasetId($dto->datasetId);
                $this->variableRepository->saveBatch($dto->datasetId, $dto->columnas);
                $this->registroRepository->deleteByDatasetId($dto->datasetId);

                $totalRegistros = 0;
                $batch = [];
                $batchSize = 500;

                foreach ($records as $registro) {
                    $batch[] = $registro;
                    $totalRegistros++;

                    if (count($batch) >= $batchSize) {
                        $this->registroRepository->insertBatch($dto->datasetId, $batch);
                        $batch = [];
                    }
                }

                if (!empty($batch)) {
                    $this->registroRepository->insertBatch($dto->datasetId, $batch);
                }

                $this->datasetRepository->update($dataset->markAsCompletado($totalRegistros));

                return DatasetResponseDTO::fromEntity($this->datasetRepository->findById($dto->datasetId));
            });
        } finally {
            @unlink($filePath);
        }
    }

    private function findPendingDataset(ConfirmImportDTO $dto, bool $lockForUpdate = false): Dataset
    {
        $dataset = $this->datasetRepository->findById($dto->datasetId, $lockForUpdate);

        if (!$dataset) {
            throw new HttpException(Response::HTTP_NOT_FOUND, 'Dataset no encontrado');
        }

        if (!$this->departamentoRepository->existsForUser($dataset->departamentoId, $dto->userId)) {
            throw new HttpException(Response::HTTP_FORBIDDEN, 'No tienes acceso a este dataset');
        }

        if (!$dataset->isPendiente()) {
            throw new HttpException(Response::HTTP_BAD_REQUEST, 'El dataset ya fue procesado');
        }

        return $dataset;
    }
}
