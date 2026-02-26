<?php

declare(strict_types=1);

namespace App\Application\Dataset\UseCases;

use App\Application\Dataset\DTOs\DatasetResponseDTO;
use App\Domain\Departamento\Repositories\DepartamentoRepositoryInterface;
use App\Domain\Dataset\Repositories\DatasetRepositoryInterface;
use Illuminate\Http\Response;
use Symfony\Component\HttpKernel\Exception\HttpException;

class UpdateDatasetUseCase
{
    public function __construct(
        private readonly DatasetRepositoryInterface $datasetRepository,
        private readonly DepartamentoRepositoryInterface $departamentoRepository,
    ) {}

    public function execute(string $datasetId, int $userId, array $data): DatasetResponseDTO
    {
        $dataset = $this->datasetRepository->findById($datasetId);

        if (!$dataset) {
            throw new HttpException(Response::HTTP_NOT_FOUND, 'Dataset no encontrado');
        }

        // Verify user has access to the department
        $hasAccess = $this->departamentoRepository->existsForUser($dataset->departamentoId, $userId);
        if (!$hasAccess) {
            throw new HttpException(Response::HTTP_FORBIDDEN, 'No tienes acceso a este dataset');
        }

        $updated = $dataset->withUpdatedFields(
            nombre: $data['nombre'] ?? null,
            descripcion: array_key_exists('descripcion', $data) ? ($data['descripcion'] ?? '') : null,
            enlaceFuente: array_key_exists('enlace_fuente', $data) ? ($data['enlace_fuente'] ?? '') : null,
        );

        $result = $this->datasetRepository->update($updated);

        return DatasetResponseDTO::fromEntity($result);
    }
}
