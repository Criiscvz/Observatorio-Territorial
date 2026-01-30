<?php

declare(strict_types=1);

namespace App\Application\Dataset\UseCases;

use App\Domain\Departamento\Repositories\DepartamentoRepositoryInterface;
use App\Domain\Dataset\Repositories\DatasetRepositoryInterface;
use App\Domain\Dataset\Repositories\RegistroDatoRepositoryInterface;
use App\Domain\Dataset\Repositories\VariableMetadatoRepositoryInterface;
use Illuminate\Http\Response;
use Symfony\Component\HttpKernel\Exception\HttpException;

class GetDatasetDataUseCase
{
    public function __construct(
        private readonly DatasetRepositoryInterface $datasetRepository,
        private readonly DepartamentoRepositoryInterface $departamentoRepository,
        private readonly RegistroDatoRepositoryInterface $registroRepository,
        private readonly VariableMetadatoRepositoryInterface $variableRepository,
    ) {}

    public function execute(string $datasetId, int $userId, int $perPage = 50): array
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

        $paginator = $this->registroRepository->findByDatasetIdPaginated($datasetId, $perPage);
        $variables = $this->variableRepository->findByDatasetId($datasetId);

        return [
            'dataset' => [
                'id' => $dataset->id,
                'nombre' => $dataset->nombre,
                'total_registros' => $dataset->totalRegistros,
                'departamento_id' => $dataset->departamentoId,
            ],
            'variables' => $variables->map(fn ($v) => [
                'id' => $v->id,
                'dataset_id' => $v->datasetId,
                'nombre_columna' => $v->nombreColumna,
                'nombre_original' => $v->nombreOriginal,
                'tipo_dato' => $v->tipoDato,
                'es_visible' => $v->esVisible,
            ])->values()->toArray(),
            'data' => collect($paginator->items())->map(fn ($item) => [
                'id' => $item->id,
                'data' => $item->data,
            ])->toArray(),
            'pagination' => [
                'current_page' => $paginator->currentPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
                'last_page' => $paginator->lastPage(),
            ],
        ];
    }
}
