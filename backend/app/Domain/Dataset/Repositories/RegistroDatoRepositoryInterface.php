<?php

declare(strict_types=1);

namespace App\Domain\Dataset\Repositories;

use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Support\Collection;

interface RegistroDatoRepositoryInterface
{
    public function findByDatasetId(string $datasetId): Collection;
    
    public function findByDatasetIdPaginated(string $datasetId, int $perPage = 50): LengthAwarePaginator;
    
    public function insertBatch(string $datasetId, array $records): int;
    
    public function deleteByDatasetId(string $datasetId): bool;
    
    public function countByDatasetId(string $datasetId): int;
    
    /**
     * Obtiene frecuencias de una columna categórica
     */
    public function getCategoricalFrequencies(string $datasetId, string $columna, int $limit = 20): array;
    
    /**
     * Obtiene estadísticas de una columna numérica
     */
    public function getNumericStats(string $datasetId, string $columna): array;
    
    /**
     * Obtiene histograma de una columna numérica
     */
    public function getHistogram(string $datasetId, string $columna, int $bins = 10): array;
    
    /**
     * Obtiene datos para scatter plot
     */
    public function getScatterData(string $datasetId, string $columnaX, string $columnaY, int $limit = 1000): array;
    
    /**
     * Obtiene promedios agrupados por categoría
     */
    public function getGroupedAverages(string $datasetId, string $columnaCategoria, string $columnaNumerico, int $limit = 20): array;
    
    /**
     * Obtiene tabla de contingencia para dos categóricas
     */
    public function getContingencyTable(string $datasetId, string $columnaX, string $columnaY, int $limit = 15): array;

    /**
     * Obtiene promedio de una columna numérica agrupado por fecha
     */
    public function getTimeSeriesAverage(string $datasetId, string $columnaFecha, string $columnaNumerico, int $limit = 50): array;

    /**
     * Obtiene conteos por fecha y categoría para gráficos apilados
     */
    public function getStackedTimeData(string $datasetId, string $columnaFecha, string $columnaCategoria, int $limit = 50): array;
}
