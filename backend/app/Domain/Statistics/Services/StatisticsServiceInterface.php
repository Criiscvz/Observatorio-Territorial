<?php

declare(strict_types=1);

namespace App\Domain\Statistics\Services;

interface StatisticsServiceInterface
{
    /**
     * Obtiene estadísticas numéricas (histograma, media, etc.)
     */
    public function getNumericStats(string $datasetId, string $column, int $limit, ?array $filters = null): array;

    /**
     * Obtiene estadísticas categóricas (frecuencias)
     */
    public function getCategoricalStats(string $datasetId, string $column, int $limit, ?array $filters = null): array;

    /**
     * Obtiene datos para gráfico de dispersión
     */
    public function getScatterData(string $datasetId, string $columnX, string $columnY, int $limit, ?array $filters = null): array;

    /**
     * Obtiene datos para gráfico de barras agrupadas
     */
    public function getGroupedBarData(string $datasetId, string $catColumn, string $numColumn, int $limit, ?array $filters = null): array;

    /**
     * Obtiene datos para mapa de calor
     */
    public function getHeatmapData(string $datasetId, string $columnX, string $columnY, int $limit, ?array $filters = null): array;

    /**
     * Obtiene datos para serie temporal
     */
    public function getTimeSeriesData(string $datasetId, string $dateColumn, string $numColumn, int $limit, ?array $filters = null): array;

    /**
     * Obtiene datos para barras apiladas
     */
    public function getStackedBarData(string $datasetId, string $dateColumn, string $catColumn, int $limit, ?array $filters = null): array;

    /**
     * Obtiene datos para nube de palabras (variables de texto)
     */
    public function getWordCloudData(string $datasetId, string $column, int $limit, ?array $filters = null): array;

    /**
     * Obtiene estadísticas de fecha (agrupación temporal, min/max, etc.)
     */
    public function getDateStats(string $datasetId, string $column, int $limit, ?array $filters = null): array;

    /**
     * Obtiene estadísticas de texto resumidas (agrupa por keywords dominantes para textos largos)
     */
    public function getTextSummaryStats(string $datasetId, string $column, int $limit, ?array $filters = null): array;

    /**
     * Obtiene análisis completo de texto: nube de palabras + sentimiento + clasificación + n-grams
     */
    public function getTextAnalysis(string $datasetId, string $column, int $limit, ?array $filters = null): array;
}
