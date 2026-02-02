<?php

declare(strict_types=1);

namespace App\Application\Departamento\UseCases;

use App\Application\Departamento\DTOs\DepartamentoResponseDTO;
use App\Application\Departamento\DTOs\UpdateDepartamentoDTO;
use App\Domain\Departamento\Repositories\DepartamentoRepositoryInterface;
use Illuminate\Http\Response;
use Symfony\Component\HttpKernel\Exception\HttpException;

class UpdateDepartamentoUseCase
{
    public function __construct(
        private readonly DepartamentoRepositoryInterface $departamentoRepository,
    ) {}

    public function execute(UpdateDepartamentoDTO $dto): DepartamentoResponseDTO
    {
        $departamento = $this->departamentoRepository->findById($dto->id);

        if (!$departamento) {
            throw new HttpException(Response::HTTP_NOT_FOUND, 'Departamento no encontrado');
        }

        // Verificar que el usuario tenga rol ADMIN
        $role = $this->departamentoRepository->getUserRole($dto->id, $dto->userId);
        if ($role !== 'ADMIN') {
            throw new HttpException(Response::HTTP_FORBIDDEN, 'Solo los administradores pueden modificar el departamento');
        }

        // Actualizar entidad
        $updatedDepartamento = $departamento->update(
            nombre: $dto->nombre,
            codigoInterno: $dto->codigoInterno,
            descripcion: $dto->descripcion,
            icono: $dto->icono,
            publico: $dto->publico,
        );

        // Guardar cambios
        $savedDepartamento = $this->departamentoRepository->update($updatedDepartamento);

        return DepartamentoResponseDTO::fromEntity($savedDepartamento, 'ADMIN');
    }
}
