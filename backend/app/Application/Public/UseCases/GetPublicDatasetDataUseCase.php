<?php

declare(strict_types=1);

namespace App\Application\Public\UseCases;

use App\Domain\Dataset\Repositories\DatasetRepositoryInterface;
use App\Domain\Dataset\Repositories\RegistroDatoRepositoryInterface;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

class GetPublicDatasetDataUseCase
{
    public function __construct(
        private readonly DatasetRepositoryInterface $datasetRepository,
        private readonly RegistroDatoRepositoryInterface $registroRepository,
    ) {}

    public function execute(string $datasetId, int $page = 1, int $perPage = 50): array
    {
        $dataset = $this->datasetRepository->findPublicById($datasetId);

        if (!$dataset) {
            throw new NotFoundHttpException('Dataset no encontrado o no público');
        }

        $registros = $this->registroRepository->findByDatasetIdPaginated($datasetId, $perPage, $page);

        return [
            'dataset' => [
                'id' => $dataset->id,
                'nombre' => $dataset->nombre,
                'total_registros' => $dataset->totalRegistros,
                'departamento_id' => $dataset->departamentoId,
            ],
            'variables' => $dataset->variablesMetadatos ?? [],
            'data' => $registros->items(),
            'pagination' => [
                'current_page' => $registros->currentPage(),
                'last_page' => $registros->lastPage(),
                'per_page' => $registros->perPage(),
                'total' => $registros->total(),
            ],
        ];
    }
}
