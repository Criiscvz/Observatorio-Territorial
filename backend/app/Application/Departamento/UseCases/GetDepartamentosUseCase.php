<?php

declare(strict_types=1);

namespace App\Application\Departamento\UseCases;

use App\Application\Departamento\DTOs\DepartamentoResponseDTO;
use App\Domain\Departamento\Repositories\DepartamentoRepositoryInterface;
use Illuminate\Support\Collection;

class GetDepartamentosUseCase
{
    public function __construct(
        private readonly DepartamentoRepositoryInterface $departamentoRepository,
    ) {}

    public function execute(int $userId): Collection
    {
        $departamentos = $this->departamentoRepository->findAllByUserId($userId);

        return $departamentos->map(function ($departamento) use ($userId) {
            $role = $this->departamentoRepository->getUserRole($departamento->id, $userId);
            return DepartamentoResponseDTO::fromEntity($departamento, $role);
        });
    }

    public function getAll(): Collection
    {
        $departamentos = $this->departamentoRepository->findAll();

        return $departamentos->map(fn($d) => DepartamentoResponseDTO::fromEntity($d, 'ADMIN'));
    }

    public function getPublicos(): Collection
    {
        $departamentos = $this->departamentoRepository->findPublicos();

        return $departamentos->map(fn($d) => DepartamentoResponseDTO::fromEntity($d));
    }
}
