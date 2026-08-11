<?php

declare(strict_types=1);

namespace App\Application\Departamento\UseCases;

use App\Application\Departamento\DTOs\CreateDepartamentoDTO;
use App\Application\Departamento\DTOs\DepartamentoResponseDTO;
use App\Domain\Departamento\Entities\Departamento;
use App\Domain\Departamento\Repositories\DepartamentoRepositoryInterface;
use App\Domain\User\Repositories\UserRepositoryInterface;
use Illuminate\Validation\ValidationException;

class CreateDepartamentoUseCase
{
    public function __construct(
        private readonly DepartamentoRepositoryInterface $departamentoRepository,
        private readonly UserRepositoryInterface $userRepository,
    ) {}

    public function execute(CreateDepartamentoDTO $dto): DepartamentoResponseDTO
    {
        // Verificar que el código interno no exista
        $existing = $this->departamentoRepository->findByCodigoInterno($dto->codigoInterno);
        if ($existing) {
            throw ValidationException::withMessages([
                'codigo_interno' => ['El código interno ya está en uso.'],
            ]);
        }

        // Crear entidad de dominio
        $departamento = Departamento::create(
            nombre: $dto->nombre,
            codigoInterno: $dto->codigoInterno,
            descripcion: $dto->descripcion,
            icono: $dto->icono,
            publico: $dto->publico,
        );

        // Guardar en repositorio
        $savedDepartamento = $this->departamentoRepository->save($departamento);

        // Asignar usuario como ADMIN del departamento
        $this->userRepository->attachDepartamento(
            userId: $dto->userId,
            departamentoId: $savedDepartamento->id,
            rol: 'ADMIN'
        );

        return DepartamentoResponseDTO::fromEntity($savedDepartamento, 'ADMIN');
    }
}
