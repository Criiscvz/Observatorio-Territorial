<?php

declare(strict_types=1);

namespace App\Domain\Departamento\Repositories;

use App\Domain\Departamento\Entities\Departamento;
use Illuminate\Support\Collection;

interface DepartamentoRepositoryInterface
{
    public function findById(string $id): ?Departamento;

    public function findPublicById(string $id): ?Departamento;

    public function findByCodigoInterno(string $codigo): ?Departamento;

    public function findAllByUserId(int $userId): Collection;

    public function findPublicos(): Collection;

    public function save(Departamento $departamento): Departamento;

    public function update(Departamento $departamento): Departamento;

    public function delete(string $id): bool;

    public function existsForUser(string $departamentoId, int $userId): bool;

    public function getUserRole(string $departamentoId, int $userId): ?string;
}
