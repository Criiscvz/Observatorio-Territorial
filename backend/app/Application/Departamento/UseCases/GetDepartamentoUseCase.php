<?php

declare(strict_types=1);

namespace App\Application\Departamento\UseCases;

use App\Application\Departamento\DTOs\DepartamentoResponseDTO;
use App\Domain\Departamento\Repositories\DepartamentoRepositoryInterface;
use Illuminate\Http\Response;
use Symfony\Component\HttpKernel\Exception\HttpException;

class GetDepartamentoUseCase
{
    public function __construct(
        private readonly DepartamentoRepositoryInterface $departamentoRepository,
    ) {}

    public function execute(string $departamentoId, int $userId): DepartamentoResponseDTO
    {
        $departamento = $this->departamentoRepository->findById($departamentoId);

        if (!$departamento) {
            throw new HttpException(Response::HTTP_NOT_FOUND, 'Departamento no encontrado');
        }

        // Verificar acceso: el departamento es público o el usuario tiene acceso
        $hasAccess = $departamento->publico || 
            $this->departamentoRepository->existsForUser($departamentoId, $userId);

        if (!$hasAccess) {
            throw new HttpException(Response::HTTP_FORBIDDEN, 'No tienes acceso a este departamento');
        }

        $role = $this->departamentoRepository->getUserRole($departamentoId, $userId);

        return DepartamentoResponseDTO::fromEntity($departamento, $role);
    }
}
