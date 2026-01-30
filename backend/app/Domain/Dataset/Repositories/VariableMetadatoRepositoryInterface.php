<?php

declare(strict_types=1);

namespace App\Domain\Dataset\Repositories;

use App\Domain\Dataset\Entities\VariableMetadato;
use Illuminate\Support\Collection;

interface VariableMetadatoRepositoryInterface
{
    public function findById(string $id): ?VariableMetadato;
    
    public function findByDatasetId(string $datasetId): Collection;
    
    public function findVisiblesByDatasetId(string $datasetId): Collection;
    
    public function findByDatasetIdAndNombreColumna(string $datasetId, string $nombreColumna): ?VariableMetadato;
    
    public function save(VariableMetadato $variable): VariableMetadato;
    
    public function saveBatch(string $datasetId, array $variables): Collection;
    
    public function update(VariableMetadato $variable): VariableMetadato;
    
    public function deleteByDatasetId(string $datasetId): bool;
}
