<?php

declare(strict_types=1);

namespace App\Application\Dataset\UseCases;

use App\Domain\Departamento\Repositories\DepartamentoRepositoryInterface;
use App\Domain\Dataset\Repositories\DatasetRepositoryInterface;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpKernel\Exception\HttpException;

class GetDatasetStopwordsUseCase
{
    public function __construct(
        private readonly DatasetRepositoryInterface $datasetRepository,
        private readonly DepartamentoRepositoryInterface $departamentoRepository,
    ) {}

    public function execute(string $datasetId, int $userId): array
    {
        $dataset = $this->datasetRepository->findById($datasetId);

        if (!$dataset) {
            throw new HttpException(Response::HTTP_NOT_FOUND, 'Dataset no encontrado');
        }

        // Verify access
        $hasAccess = $this->departamentoRepository->existsForUser($dataset->departamentoId, $userId);
        if (!$hasAccess) {
            $departamento = $this->departamentoRepository->findById($dataset->departamentoId);
            if (!$departamento?->publico) {
                throw new HttpException(Response::HTTP_FORBIDDEN, 'No tienes acceso a este dataset');
            }
        }

        $currentOpciones = DB::table('datasets')
            ->where('id', $datasetId)
            ->value('opciones');

        $opciones = $currentOpciones ? json_decode($currentOpciones, true) : [];

        return [
            'stopwords' => $opciones['custom_stopwords'] ?? [],
            'count' => count($opciones['custom_stopwords'] ?? []),
        ];
    }
}
