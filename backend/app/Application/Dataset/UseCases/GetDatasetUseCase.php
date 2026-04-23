<?php

declare(strict_types=1);

namespace App\Application\Dataset\UseCases;

use App\Application\Dataset\DTOs\DatasetResponseDTO;
use App\Domain\Departamento\Repositories\DepartamentoRepositoryInterface;
use App\Domain\Dataset\Repositories\DatasetRepositoryInterface;
use Illuminate\Http\Response;
use Symfony\Component\HttpKernel\Exception\HttpException;

class GetDatasetUseCase
{
    public function __construct(
        private readonly DatasetRepositoryInterface $datasetRepository,
        private readonly DepartamentoRepositoryInterface $departamentoRepository,
    ) {}

    public function execute(string $datasetId, int $userId): DatasetResponseDTO
    {
        $dataset = $this->datasetRepository->findById($datasetId);

        if (!$dataset) {
            throw new HttpException(Response::HTTP_NOT_FOUND, 'Dataset no encontrado');
        }

        // Verificar acceso al departamento
        $departamento = $this->departamentoRepository->findById($dataset->departamentoId);
        
        $hasAccess = $departamento?->publico || 
            $this->departamentoRepository->existsForUser($dataset->departamentoId, $userId);

        if (!$hasAccess) {
            throw new HttpException(Response::HTTP_FORBIDDEN, 'No tienes acceso a este dataset');
        }

        return DatasetResponseDTO::fromEntity($dataset);
    }
}
