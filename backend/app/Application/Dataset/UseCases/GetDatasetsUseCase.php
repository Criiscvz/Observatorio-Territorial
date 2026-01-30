<?php

declare(strict_types=1);

namespace App\Application\Dataset\UseCases;

use App\Application\Dataset\DTOs\DatasetResponseDTO;
use App\Domain\Dataset\Repositories\DatasetRepositoryInterface;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

class GetDatasetsUseCase
{
    public function __construct(
        private readonly DatasetRepositoryInterface $datasetRepository,
    ) {}

    public function execute(int $userId, ?string $departamentoId = null): LengthAwarePaginator
    {
        return $this->datasetRepository->findByUserDepartamentos($userId, $departamentoId);
    }
}
