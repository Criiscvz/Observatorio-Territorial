<?php

declare(strict_types=1);

namespace App\Application\Departamento\UseCases;

use App\Domain\Departamento\Repositories\DepartamentoRepositoryInterface;
use Illuminate\Http\Response;
use Symfony\Component\HttpKernel\Exception\HttpException;

class DeleteDepartamentoUseCase
{
    public function __construct(
        private readonly DepartamentoRepositoryInterface $departamentoRepository,
    ) {}

    public function execute(string $departamentoId, int $userId): bool
    {
        $departamento = $this->departamentoRepository->findById($departamentoId);

        if (!$departamento) {
            throw new HttpException(Response::HTTP_NOT_FOUND, 'Departamento no encontrado');
        }

        // Verificar que el usuario tenga rol ADMIN
        $role = $this->departamentoRepository->getUserRole($departamentoId, $userId);
        if ($role !== 'ADMIN') {
            throw new HttpException(Response::HTTP_FORBIDDEN, 'Solo los administradores pueden eliminar el departamento');
        }

        return $this->departamentoRepository->delete($departamentoId);
    }
}
