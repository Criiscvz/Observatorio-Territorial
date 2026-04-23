<?php

declare(strict_types=1);

namespace App\Infrastructure\Services;

use App\Domain\Statistics\Services\StatisticsServiceInterface;
use Illuminate\Support\Facades\DB;

class StatisticsService implements StatisticsServiceInterface
{
    public function __construct(
        private readonly TextProcessingService $textProcessor,
    ) {}

    /**
     * Whitelist pattern for column names to prevent SQL injection
     */
    private function sanitizeColumn(string $column): string
    {
        // Permitir cualquier carácter Unicode imprimible (las columnas del CSV pueden tener
        // signos de interrogación, paréntesis, acentos, etc.). Es seguro porque los nombres
        // se pasan siempre como bind parameters (data->>?) y no se interpolan en SQL.
        if (!preg_match('/^[^\x00-\x1F\x7F]+$/u', $column) || mb_strlen($column) > 500) {
            throw new \InvalidArgumentException("Nombre de columna inválido: {$column}");
        }
        return $column;
    }

    /**
     * Detect if a value looks like a date string (YYYY-MM-DD or similar)
     */
    private function isDateValue(mixed $value): bool
    {
        if (!is_string($value)) return false;
        return (bool) preg_match('/^\d{4}[-\/]\d{1,2}[-\/]\d{1,2}/', $value);
    }

    /**
     * Determine the SQL cast based on filter type hint or value detection
     */
    private function getFilterCast(array $filter): string
    {
        $type = $filter['type'] ?? null;
        $value = $filter['value'];

        if ($type === 'FECHA') return 'date';
        if ($type === 'NUMERICO') return 'numeric';
        if ($type !== null) return 'text'; // CATEGORICO, TEXTO

        // Auto-detect from value
        $testValue = is_array($value) ? ($value[0] ?? '') : $value;
        if ($this->isDateValue($testValue)) return 'date';
        if (is_numeric($testValue)) return 'numeric';
        return 'text';
    }

    /**
     * Apply JSONB filters to a query builder
     */
    private function applyFilters($query, ?array $filters): mixed
    {
        if (empty($filters)) {
            return $query;
        }

        foreach ($filters as $filter) {
            $col = $this->sanitizeColumn($filter['column']);
            $operator = $filter['operator'];
            $value = $filter['value'];
            $cast = $this->getFilterCast($filter);

            switch ($operator) {
                case 'eq':
                    $query->whereRaw("data->>? = ?", [$col, (string)$value]);
                    break;
                case 'neq':
                    $query->whereRaw("data->>? != ?", [$col, (string)$value]);
                    break;
                case 'in':
                    if (is_array($value)) {
                        $placeholders = implode(',', array_fill(0, count($value), '?'));
                        $params = array_merge([$col], array_map('strval', $value));
                        $query->whereRaw("data->>? IN ($placeholders)", $params);
                    }
                    break;
                case 'not_in':
                    if (is_array($value)) {
                        $placeholders = implode(',', array_fill(0, count($value), '?'));
                        $params = array_merge([$col], array_map('strval', $value));
                        $query->whereRaw("data->>? NOT IN ($placeholders)", $params);
                    }
                    break;
                case 'gt':
                    if ($cast === 'date') {
                        $query->whereRaw("(data->>?)::date > ?::date", [$col, (string)$value]);
                    } else {
                        $query->whereRaw("(data->>?)::numeric > ?", [$col, (float)$value]);
                    }
                    break;
                case 'gte':
                    if ($cast === 'date') {
                        $query->whereRaw("(data->>?)::date >= ?::date", [$col, (string)$value]);
                    } else {
                        $query->whereRaw("(data->>?)::numeric >= ?", [$col, (float)$value]);
                    }
                    break;
                case 'lt':
                    if ($cast === 'date') {
                        $query->whereRaw("(data->>?)::date < ?::date", [$col, (string)$value]);
                    } else {
                        $query->whereRaw("(data->>?)::numeric < ?", [$col, (float)$value]);
                    }
                    break;
                case 'lte':
                    if ($cast === 'date') {
                        $query->whereRaw("(data->>?)::date <= ?::date", [$col, (string)$value]);
                    } else {
                        $query->whereRaw("(data->>?)::numeric <= ?", [$col, (float)$value]);
                    }
                    break;
                case 'between':
                    if (is_array($value) && count($value) === 2) {
                        if ($cast === 'date') {
                            $query->whereRaw("(data->>?)::date BETWEEN ?::date AND ?::date", [$col, (string)$value[0], (string)$value[1]]);
                        } else {
                            $query->whereRaw("(data->>?)::numeric BETWEEN ? AND ?", [$col, (float)$value[0], (float)$value[1]]);
                        }
                    }
                    break;
                case 'contains':
                    $query->whereRaw("data->>? ILIKE ?", [$col, '%' . $value . '%']);
                    break;
                case 'not_contains':
                    $query->whereRaw("data->>? NOT ILIKE ?", [$col, '%' . $value . '%']);
                    break;
            }
        }

        return $query;
    }

    public function getNumericStats(string $datasetId, string $column, int $limit, ?array $filters = null): array
    {
        $col = $this->sanitizeColumn($column);

        $query = DB::table('registros_datos')
            ->where('dataset_id', $datasetId)
            ->whereRaw("data->>? IS NOT NULL AND TRIM(data->>?) != ''", [$col, $col]);
        $query = $this->applyFilters($query, $filters);

        $stats = $query->selectRaw("
                COUNT(*) as count,
                AVG(NULLIF(TRIM(data->>?), '')::numeric) as mean,
                MIN(NULLIF(TRIM(data->>?), '')::numeric) as min,
                MAX(NULLIF(TRIM(data->>?), '')::numeric) as max,
                SUM(NULLIF(TRIM(data->>?), '')::numeric) as sum
            ", [$col, $col, $col, $col])
            ->first();

        $min = (float) ($stats->min ?? 0);
        $max = (float) ($stats->max ?? 1);
        $range = $max - $min;
        $bins = min(20, max(5, (int) sqrt((int) ($stats->count ?? 10))));
        $binSize = $range > 0 ? $range / $bins : 1;

        $histQuery = DB::table('registros_datos')
            ->where('dataset_id', $datasetId)
            ->whereRaw("data->>? IS NOT NULL AND TRIM(data->>?) != ''", [$col, $col]);
        $histQuery = $this->applyFilters($histQuery, $filters);

        $histogram = $histQuery->selectRaw("
                FLOOR(((data->>?)::numeric - ?) / ?) as bin,
                COUNT(*) as count
            ", [$col, $min, $binSize])
            ->groupBy('bin')
            ->orderBy('bin')
            ->get();

        $labels = [];
        $values = [];

        foreach ($histogram as $h) {
            $binStart = $min + ((float) $h->bin * $binSize);
            $binEnd = $binStart + $binSize;
            $labels[] = number_format($binStart, 1) . ' - ' . number_format($binEnd, 1);
            $values[] = (int) $h->count;
        }

        return [
            'data' => [
                'labels' => $labels,
                'values' => $values,
            ],
            'stats' => [
                'count' => (int) ($stats->count ?? 0),
                'mean' => round((float) ($stats->mean ?? 0), 2),
                'min' => round((float) ($stats->min ?? 0), 2),
                'max' => round((float) ($stats->max ?? 0), 2),
                'sum' => round((float) ($stats->sum ?? 0), 2),
            ],
        ];
    }

    public function getCategoricalStats(string $datasetId, string $column, int $limit, ?array $filters = null): array
    {
        $col = $this->sanitizeColumn($column);

        $query = DB::table('registros_datos')
            ->where('dataset_id', $datasetId);
        $query = $this->applyFilters($query, $filters);

        $data = $query->selectRaw("data->>? as categoria, COUNT(*) as count", [$col])
            ->groupBy('categoria')
            ->orderByDesc('count')
            ->limit($limit)
            ->get();

        return [
            'data' => [
                'labels' => $data->pluck('categoria')->toArray(),
                'values' => $data->pluck('count')->map(fn($v) => (int) $v)->toArray(),
            ],
            'stats' => [
                'count' => $data->sum('count'),
                'unique' => $data->count(),
            ],
        ];
    }

    public function getDateStats(string $datasetId, string $column, int $limit, ?array $filters = null): array
    {
        $col = $this->sanitizeColumn($column);

        $baseQuery = fn() => $this->applyFilters(
            DB::table('registros_datos')->where('dataset_id', $datasetId),
            $filters
        );

        // Get date range to determine optimal granularity
        $range = $baseQuery()
            ->selectRaw("
                MIN(DATE(data->>?)) as min_date,
                MAX(DATE(data->>?)) as max_date,
                COUNT(*) as count
            ", [$col, $col])
            ->whereRaw("data->>? IS NOT NULL AND data->>? != ''", [$col, $col])
            ->first();

        $minDate = $range->min_date ?? null;
        $maxDate = $range->max_date ?? null;
        $totalCount = (int) ($range->count ?? 0);

        if (!$minDate || !$maxDate || $totalCount === 0) {
            return [
                'data' => ['labels' => [], 'values' => []],
                'stats' => ['count' => 0, 'min_date' => null, 'max_date' => null, 'periods' => 0],
            ];
        }

        // Determine granularity based on date range
        $daysDiff = (int) ((strtotime($maxDate) - strtotime($minDate)) / 86400);

        if ($daysDiff <= 60) {
            // Up to 2 months: group by day
            $groupExpr = "DATE(data->>?)";
            $formatExpr = "TO_CHAR(DATE(data->>?), 'YYYY-MM-DD')";
            $granularity = 'day';
        } elseif ($daysDiff <= 730) {
            // Up to 2 years: group by month
            $groupExpr = "DATE_TRUNC('month', DATE(data->>?))";
            $formatExpr = "TO_CHAR(DATE(data->>?), 'YYYY-MM')";
            $granularity = 'month';
        } else {
            // More than 2 years: group by year
            $groupExpr = "DATE_TRUNC('year', DATE(data->>?))";
            $formatExpr = "TO_CHAR(DATE(data->>?), 'YYYY')";
            $granularity = 'year';
        }

        $data = $baseQuery()
            ->selectRaw("{$formatExpr} as periodo, COUNT(*) as count", [$col])
            ->whereRaw("data->>? IS NOT NULL AND data->>? != ''", [$col, $col])
            ->groupByRaw("{$groupExpr}", [$col])
            ->orderByRaw("{$groupExpr} ASC", [$col])
            ->limit($limit)
            ->get();

        return [
            'data' => [
                'labels' => $data->pluck('periodo')->toArray(),
                'values' => $data->pluck('count')->map(fn($v) => (int) $v)->toArray(),
            ],
            'stats' => [
                'count' => $totalCount,
                'min_date' => $minDate,
                'max_date' => $maxDate,
                'periods' => $data->count(),
                'granularity' => $granularity,
            ],
        ];
    }

    public function getScatterData(string $datasetId, string $columnX, string $columnY, int $limit, ?array $filters = null): array
    {
        $colX = $this->sanitizeColumn($columnX);
        $colY = $this->sanitizeColumn($columnY);

        $query = DB::table('registros_datos')
            ->where('dataset_id', $datasetId);
        $query = $this->applyFilters($query, $filters);

        $points = $query->selectRaw("(data->>?)::numeric as x, (data->>?)::numeric as y", [$colX, $colY])
            ->whereRaw("data->>? IS NOT NULL", [$colX])
            ->whereRaw("data->>? IS NOT NULL", [$colY])
            ->limit(1000)
            ->get()
            ->map(fn($p) => [(float) $p->x, (float) $p->y])
            ->toArray();

        $correlation = $this->calculateCorrelation($points);

        return [
            'data' => [
                'points' => $points,
                'correlation' => $correlation,
            ],
            'stats' => [
                'count' => count($points),
                'correlation' => $correlation,
            ],
        ];
    }

    public function getGroupedBarData(string $datasetId, string $catColumn, string $numColumn, int $limit, ?array $filters = null): array
    {
        $cat = $this->sanitizeColumn($catColumn);
        $num = $this->sanitizeColumn($numColumn);

        $query = DB::table('registros_datos')
            ->where('dataset_id', $datasetId);
        $query = $this->applyFilters($query, $filters);

        $data = $query->selectRaw("
                data->>? as categoria,
                AVG((data->>?)::numeric) as avg_value,
                COUNT(*) as count
            ", [$cat, $num])
            ->groupBy('categoria')
            ->orderByDesc('count')
            ->limit($limit)
            ->get();

        return [
            'data' => [
                'labels' => $data->pluck('categoria')->toArray(),
                'values' => $data->pluck('avg_value')->map(fn($v) => round((float) $v, 2))->toArray(),
                'counts' => $data->pluck('count')->map(fn($v) => (int) $v)->toArray(),
            ],
            'stats' => [
                'count' => $data->sum('count'),
            ],
        ];
    }

    public function getHeatmapData(string $datasetId, string $columnX, string $columnY, int $limit, ?array $filters = null): array
    {
        $colX = $this->sanitizeColumn($columnX);
        $colY = $this->sanitizeColumn($columnY);

        $baseQuery = fn() => $this->applyFilters(
            DB::table('registros_datos')->where('dataset_id', $datasetId),
            $filters
        );

        $labelsX = $baseQuery()
            ->selectRaw("DISTINCT data->>? as cat", [$colX])
            ->orderBy('cat')
            ->limit($limit)
            ->pluck('cat')
            ->toArray();

        $labelsY = $baseQuery()
            ->selectRaw("DISTINCT data->>? as cat", [$colY])
            ->orderBy('cat')
            ->limit($limit)
            ->pluck('cat')
            ->toArray();

        $counts = $baseQuery()
            ->selectRaw("data->>? as cat_x, data->>? as cat_y, COUNT(*) as count", [$colX, $colY])
            ->groupBy('cat_x', 'cat_y')
            ->get();

        $heatmap = [];
        foreach ($counts as $c) {
            $xi = array_search($c->cat_x, $labelsX);
            $yi = array_search($c->cat_y, $labelsY);
            if ($xi !== false && $yi !== false) {
                $heatmap[] = [$xi, $yi, (int) $c->count];
            }
        }

        return [
            'data' => [
                'labels_x' => $labelsX,
                'labels_y' => $labelsY,
                'heatmap' => $heatmap,
            ],
            'stats' => [
                'count' => array_sum(array_column($heatmap, 2)),
            ],
        ];
    }

    public function getTimeSeriesData(string $datasetId, string $dateColumn, string $numColumn, int $limit, ?array $filters = null): array
    {
        $date = $this->sanitizeColumn($dateColumn);
        $num = $this->sanitizeColumn($numColumn);

        $query = DB::table('registros_datos')
            ->where('dataset_id', $datasetId);
        $query = $this->applyFilters($query, $filters);

        $data = $query->selectRaw("
                DATE(data->>?) as fecha,
                AVG((data->>?)::numeric) as avg_value,
                COUNT(*) as count
            ", [$date, $num])
            ->whereRaw("data->>? IS NOT NULL", [$date])
            ->whereRaw("data->>? IS NOT NULL", [$num])
            ->groupBy('fecha')
            ->orderBy('fecha')
            ->limit($limit)
            ->get();

        return [
            'data' => [
                'labels' => $data->pluck('fecha')->toArray(),
                'values' => $data->pluck('avg_value')->map(fn($v) => round((float) $v, 2))->toArray(),
                'counts' => $data->pluck('count')->map(fn($v) => (int) $v)->toArray(),
            ],
            'stats' => [
                'count' => $data->sum('count'),
                'periods' => $data->count(),
            ],
        ];
    }

    public function getStackedBarData(string $datasetId, string $dateColumn, string $catColumn, int $limit, ?array $filters = null): array
    {
        $date = $this->sanitizeColumn($dateColumn);
        $cat = $this->sanitizeColumn($catColumn);

        $baseQuery = fn() => $this->applyFilters(
            DB::table('registros_datos')->where('dataset_id', $datasetId),
            $filters
        );

        $categories = $baseQuery()
            ->selectRaw("DISTINCT data->>? as cat", [$cat])
            ->orderBy('cat')
            ->limit(10)
            ->pluck('cat')
            ->toArray();

        $dates = $baseQuery()
            ->selectRaw("DISTINCT DATE(data->>?) as fecha", [$date])
            ->orderBy('fecha')
            ->limit($limit)
            ->pluck('fecha')
            ->toArray();

        $counts = $baseQuery()
            ->selectRaw("DATE(data->>?) as fecha, data->>? as categoria, COUNT(*) as count", [$date, $cat])
            ->groupBy('fecha', 'categoria')
            ->get();

        $series = [];
        foreach ($categories as $catVal) {
            $seriesData = [];
            foreach ($dates as $dateVal) {
                $count = $counts->where('fecha', $dateVal)->where('categoria', $catVal)->first();
                $seriesData[] = $count ? (int) $count->count : 0;
            }
            $series[] = [
                'name' => $catVal ?? 'Sin valor',
                'data' => $seriesData,
            ];
        }

        return [
            'data' => [
                'labels' => $dates,
                'labels_x' => $dates,
                'categories' => $categories,
                'series' => $series,
            ],
            'stats' => [
                'count' => $counts->sum('count'),
                'periods' => count($dates),
                'categories' => count($categories),
            ],
        ];
    }

    public function getWordCloudData(string $datasetId, string $column, int $limit, ?array $filters = null): array
    {
        $col = $this->sanitizeColumn($column);

        $query = DB::table('registros_datos')
            ->where('dataset_id', $datasetId);
        $query = $this->applyFilters($query, $filters);

        $maxRecords = config('nlp.max_records', 5000);

        // Get all text values from the column
        $texts = $query->selectRaw("data->>? as texto", [$col])
            ->whereRaw("data->>? IS NOT NULL", [$col])
            ->limit($maxRecords)
            ->pluck('texto')
            ->toArray();

        // Get dataset-specific stopwords if any
        $extraStopwords = $this->getDatasetStopwords($datasetId);

        $useStemming = config('nlp.stemming.enabled', true);
        $maxNgram = config('nlp.ngrams.enabled', true) ? config('nlp.ngrams.max_n', 3) : 1;

        // Use TextProcessingService for advanced frequency counting
        $freq = $this->textProcessor->countFrequencies($texts, $useStemming, $maxNgram, $extraStopwords);

        // Merge unigrams (use display form) with significant bigrams
        $words = [];

        // Add unigrams (mapped to display form if stemmed)
        $unigramSlice = array_slice($freq['unigrams'], 0, $limit, true);
        foreach ($unigramSlice as $stem => $count) {
            $display = $freq['stemToDisplay'][$stem] ?? $stem;
            $words[$display] = ($words[$display] ?? 0) + $count;
        }

        // Add top bigrams (they often carry more meaning)
        $bigramSlice = array_slice($freq['bigrams'], 0, (int) ceil($limit / 3), true);
        foreach ($bigramSlice as $bigram => $count) {
            $words[$bigram] = $count;
        }

        // Sort by frequency and cap at limit
        arsort($words);
        $words = array_slice($words, 0, $limit, true);

        // Format for word cloud
        $result = [];
        $maxCount = !empty($words) ? max($words) : 1;
        foreach ($words as $word => $count) {
            $result[] = [
                'name' => $word,
                'value' => $count,
                'weight' => round($count / $maxCount, 3),
            ];
        }

        return [
            'data' => [
                'words' => $result,
                'labels' => array_column($result, 'name'),
                'values' => array_column($result, 'value'),
            ],
            'stats' => [
                'total_texts' => count($texts),
                'unique_words' => count($freq['unigrams']),
                'total_words' => array_sum($freq['unigrams']),
                'bigrams_found' => count($freq['bigrams']),
            ],
        ];
    }

    private function calculateCorrelation(array $points): ?float
    {
        $n = count($points);
        if ($n <= 2) {
            return null;
        }

        $sumX = array_sum(array_column($points, 0));
        $sumY = array_sum(array_column($points, 1));
        $sumXY = array_sum(array_map(fn($p) => $p[0] * $p[1], $points));
        $sumX2 = array_sum(array_map(fn($p) => $p[0] ** 2, $points));
        $sumY2 = array_sum(array_map(fn($p) => $p[1] ** 2, $points));

        $num = ($n * $sumXY) - ($sumX * $sumY);
        $den = sqrt((($n * $sumX2) - ($sumX ** 2)) * (($n * $sumY2) - ($sumY ** 2)));

        return $den > 0 ? round($num / $den, 3) : 0;
    }

    /**
     * Get text summary stats: groups long texts by their dominant keywords.
     * Short unique texts with <= 50 unique values use regular categorical counting.
     * Long/diverse texts are classified by TF-IDF weighted keywords.
     */
    public function getTextSummaryStats(string $datasetId, string $column, int $limit, ?array $filters = null): array
    {
        $col = $this->sanitizeColumn($column);

        $baseQuery = fn() => $this->applyFilters(
            DB::table('registros_datos')->where('dataset_id', $datasetId),
            $filters
        );

        // Count unique values to determine strategy
        $maxCategories = config('nlp.classification.max_categories', 50);
        $uniqueCount = $baseQuery()
            ->selectRaw("COUNT(DISTINCT data->>?) as unique_count", [$col])
            ->whereRaw("data->>? IS NOT NULL AND data->>? != ''", [$col, $col])
            ->value('unique_count');

        // If few unique values, use regular categorical stats (short texts like categories)
        if ($uniqueCount <= $maxCategories) {
            return $this->getCategoricalStats($datasetId, $column, $limit, $filters);
        }

        $maxRecords = config('nlp.max_records', 5000);

        // For diverse/long texts: classify by dominant keywords using TF-IDF
        $texts = $baseQuery()
            ->selectRaw("data->>? as texto", [$col])
            ->whereRaw("data->>? IS NOT NULL AND data->>? != ''", [$col, $col])
            ->limit($maxRecords)
            ->pluck('texto')
            ->toArray();

        if (empty($texts)) {
            return [
                'data' => ['labels' => [], 'values' => []],
                'stats' => ['count' => 0, 'unique' => 0],
            ];
        }

        $extraStopwords = $this->getDatasetStopwords($datasetId);

        // Use TextProcessingService for TF-IDF classification
        $classification = $this->textProcessor->classifyTexts($texts, $limit, $extraStopwords);

        // Build output
        $labels = [];
        $values = [];
        foreach ($classification['categories'] as $keyword => $count) {
            if ($count > 0) {
                $labels[] = mb_convert_case($keyword, MB_CASE_TITLE, 'UTF-8');
                $values[] = $count;
            }
        }

        // Add unclassified
        if ($classification['unclassified'] > 0) {
            $labels[] = '(Otros)';
            $values[] = $classification['unclassified'];
        }

        return [
            'data' => [
                'labels' => $labels,
                'values' => $values,
            ],
            'stats' => [
                'count' => count($texts),
                'unique' => (int) $uniqueCount,
                'classified_by' => 'tfidf_keywords',
                'keywords_used' => count($classification['keywords_used']),
            ],
        ];
    }

    /**
     * Full text analysis: word cloud + sentiment + classification + n-grams.
     * This is a comprehensive endpoint for the text insights panel.
     */
    public function getTextAnalysis(string $datasetId, string $column, int $limit, ?array $filters = null): array
    {
        $col = $this->sanitizeColumn($column);

        $baseQuery = fn() => $this->applyFilters(
            DB::table('registros_datos')->where('dataset_id', $datasetId),
            $filters
        );

        $maxRecords = config('nlp.max_records', 5000);

        $texts = $baseQuery()
            ->selectRaw("data->>? as texto", [$col])
            ->whereRaw("data->>? IS NOT NULL AND data->>? != ''", [$col, $col])
            ->limit($maxRecords)
            ->pluck('texto')
            ->toArray();

        if (empty($texts)) {
            return [
                'wordcloud' => ['words' => [], 'labels' => [], 'values' => []],
                'sentiment' => ['overall' => 'neutral', 'score' => 0, 'distribution' => ['positive' => 0, 'negative' => 0, 'neutral' => 0], 'total' => 0],
                'keywords' => ['labels' => [], 'values' => [], 'unclassified' => 0],
                'ngrams' => ['bigrams' => [], 'trigrams' => []],
                'stats' => ['total_texts' => 0, 'avg_length' => 0],
            ];
        }

        $extraStopwords = $this->getDatasetStopwords($datasetId);

        // 1. Frequency analysis (with stemming + n-grams)
        $useStemming = config('nlp.stemming.enabled', true);
        $maxNgram = config('nlp.ngrams.enabled', true) ? config('nlp.ngrams.max_n', 3) : 1;
        $freq = $this->textProcessor->countFrequencies($texts, $useStemming, $maxNgram, $extraStopwords);

        // Build word cloud data
        $words = [];
        $unigramSlice = array_slice($freq['unigrams'], 0, $limit, true);
        foreach ($unigramSlice as $stem => $count) {
            $display = $freq['stemToDisplay'][$stem] ?? $stem;
            $words[$display] = ($words[$display] ?? 0) + $count;
        }
        $bigramSlice = array_slice($freq['bigrams'], 0, (int) ceil($limit / 3), true);
        foreach ($bigramSlice as $bigram => $count) {
            $words[$bigram] = $count;
        }
        arsort($words);
        $words = array_slice($words, 0, $limit, true);

        $wordCloudData = [];
        $maxCount = !empty($words) ? max($words) : 1;
        foreach ($words as $word => $count) {
            $wordCloudData[] = [
                'name' => $word,
                'value' => $count,
                'weight' => round($count / $maxCount, 3),
            ];
        }

        // 2. Sentiment analysis
        $sentiment = $this->textProcessor->analyzeSentiment($texts);

        // 3. Keyword classification
        $classification = $this->textProcessor->classifyTexts($texts, min($limit, 15), $extraStopwords);

        // 4. Top n-grams
        $topBigrams = array_slice($freq['bigrams'], 0, 20, true);
        $topTrigrams = array_slice($freq['trigrams'], 0, 10, true);

        // 5. Text length stats
        $lengths = array_map(fn($t) => mb_strlen($t), array_filter($texts, fn($t) => !empty($t)));
        $avgLength = count($lengths) > 0 ? round(array_sum($lengths) / count($lengths), 1) : 0;

        return [
            'wordcloud' => [
                'words' => $wordCloudData,
                'labels' => array_column($wordCloudData, 'name'),
                'values' => array_column($wordCloudData, 'value'),
            ],
            'sentiment' => $sentiment,
            'keywords' => [
                'labels' => array_map(fn($k) => mb_convert_case($k, MB_CASE_TITLE, 'UTF-8'), array_keys($classification['categories'])),
                'values' => array_values($classification['categories']),
                'unclassified' => $classification['unclassified'],
            ],
            'ngrams' => [
                'bigrams' => array_map(fn($phrase, $count) => ['phrase' => $phrase, 'count' => $count], array_keys($topBigrams), array_values($topBigrams)),
                'trigrams' => array_map(fn($phrase, $count) => ['phrase' => $phrase, 'count' => $count], array_keys($topTrigrams), array_values($topTrigrams)),
            ],
            'stats' => [
                'total_texts' => count($texts),
                'unique_words' => count($freq['unigrams']),
                'total_words' => array_sum($freq['unigrams']),
                'avg_text_length' => $avgLength,
                'bigrams_found' => count($freq['bigrams']),
                'trigrams_found' => count($freq['trigrams']),
            ],
        ];
    }

    /**
     * Retrieve dataset-specific custom stopwords (from variable metadata options).
     */
    private function getDatasetStopwords(string $datasetId): array
    {
        $options = DB::table('datasets')
            ->where('id', $datasetId)
            ->value('opciones');

        if ($options) {
            $parsed = is_string($options) ? json_decode($options, true) : $options;
            return $parsed['custom_stopwords'] ?? [];
        }

        return [];
    }
}
