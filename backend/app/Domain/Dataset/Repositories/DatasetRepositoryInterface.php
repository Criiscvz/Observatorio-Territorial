<?php

declare(strict_types=1);

namespace App\Domain\Dataset\Repositories;

use App\Domain\Dataset\Entities\Dataset;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Support\Collection;

interface DatasetRepositoryInterface
{
    public function findById(string $id): ?Dataset;
    
    public function findByDepartamentoId(string $departamentoId): Collection;
    
    public function findCompletadosByDepartamentoId(string $departamentoId): Collection;
    
    public function findByUserDepartamentos(int $userId, ?string $departamentoId = null): LengthAwarePaginator;
    
    public function save(Dataset $dataset): Dataset;
    
    public function update(Dataset $dataset): Dataset;
    
    public function updateEstado(string $id, string $estado): bool;
    
    public function delete(string $id): bool;
}
