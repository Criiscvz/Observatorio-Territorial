<?php

declare(strict_types=1);

namespace App\Application\Dataset\UseCases;

use App\Domain\Dataset\Repositories\DatasetRepositoryInterface;
use App\Domain\Departamento\Repositories\DepartamentoRepositoryInterface;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpKernel\Exception\HttpException;

class DeleteDatasetUseCase
{
    public function __construct(
        private readonly DatasetRepositoryInterface $datasetRepository,
        private readonly DepartamentoRepositoryInterface $departamentoRepository,
    ) {}

    public function execute(string $datasetId, int $userId): void
    {
        // Obtener el dataset
        $dataset = $this->datasetRepository->findById($datasetId);

        if (!$dataset) {
            throw new HttpException(Response::HTTP_NOT_FOUND, 'Dataset no encontrado');
        }

        // Verificar acceso al departamento
        if (!$this->departamentoRepository->existsForUser($dataset->departamentoId, $userId)) {
            throw new HttpException(Response::HTTP_FORBIDDEN, 'No tienes acceso a este dataset');
        }

        // Eliminar archivo físico si existe
        $filePath = $dataset->nombreArchivo;
        $path = $filePath ? 'datasets/'.$filePath : null;
        if ($path && Storage::disk(config('filesystems.default'))->exists($path)) {
            Storage::disk(config('filesystems.default'))->delete($path);
        }

        // Eliminar dataset (esto también eliminará los registros relacionados por cascade)
        $this->datasetRepository->delete($datasetId);
    }
}
