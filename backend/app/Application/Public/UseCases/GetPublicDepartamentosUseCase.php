<?php

declare(strict_types=1);

namespace App\Application\Public\UseCases;

use App\Domain\Departamento\Repositories\DepartamentoRepositoryInterface;
use Illuminate\Support\Collection;

class GetPublicDepartamentosUseCase
{
    public function __construct(
        private readonly DepartamentoRepositoryInterface $departamentoRepository,
    ) {}

    public function execute(): Collection
    {
        return $this->departamentoRepository->findPublicos();
    }

    public function getById(string $id): ?object
    {
        return $this->departamentoRepository->findPublicById($id);
    }
}
