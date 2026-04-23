<?php

declare(strict_types=1);

namespace App\Application\Dataset\UseCases;

use App\Application\Dataset\DTOs\DatasetResponseDTO;
use App\Application\Dataset\DTOs\UploadDatasetDTO;
use App\Domain\Departamento\Repositories\DepartamentoRepositoryInterface;
use App\Domain\Dataset\Entities\Dataset;
use App\Domain\Dataset\Repositories\DatasetRepositoryInterface;
use Illuminate\Http\Response;
use Symfony\Component\HttpKernel\Exception\HttpException;

class UploadDatasetUseCase
{
    public function __construct(
        private readonly DatasetRepositoryInterface $datasetRepository,
        private readonly DepartamentoRepositoryInterface $departamentoRepository,
    ) {}

    public function execute(UploadDatasetDTO $dto): DatasetResponseDTO
    {
        // Verificar acceso al departamento
        if (!$this->departamentoRepository->existsForUser($dto->departamentoId, $dto->userId)) {
            throw new HttpException(Response::HTTP_FORBIDDEN, 'No tienes acceso a este departamento');
        }

        // Generar nombre único para el archivo
        $nombreArchivo = time() . '_' . preg_replace('/[^a-zA-Z0-9._-]/', '_', $dto->archivo->getClientOriginalName());

        // Guardar archivo
        $dto->archivo->storeAs('', $nombreArchivo, 'datasets');

        // Crear entidad de dominio
        $dataset = Dataset::create(
            departamentoId: $dto->departamentoId,
            subidoPor: $dto->userId,
            nombre: $dto->nombre,
            nombreArchivo: $nombreArchivo,
            descripcion: $dto->descripcion,
        );

        // Guardar en repositorio
        $savedDataset = $this->datasetRepository->save($dataset);

        return DatasetResponseDTO::fromEntity($savedDataset);
    }
}
