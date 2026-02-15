<?php

declare(strict_types=1);

namespace App\Infrastructure\Services;

use App\Domain\Statistics\Services\StatisticsServiceInterface;
use Illuminate\Support\Facades\DB;

class StatisticsService implements StatisticsServiceInterface
{
    /**
     * Whitelist pattern for column names to prevent SQL injection
     */
    private function sanitizeColumn(string $column): string
    {
        if (!preg_match('/^[a-zA-Z0-9_\x{00C0}-\x{024F}\s\-\.]+$/u', $column)) {
            throw new \InvalidArgumentException("Nombre de columna inválido: {$column}");
        }
        return $column;
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
                    $query->whereRaw("(data->>?)::numeric > ?", [$col, (float)$value]);
                    break;
                case 'gte':
                    $query->whereRaw("(data->>?)::numeric >= ?", [$col, (float)$value]);
                    break;
                case 'lt':
                    $query->whereRaw("(data->>?)::numeric < ?", [$col, (float)$value]);
                    break;
                case 'lte':
                    $query->whereRaw("(data->>?)::numeric <= ?", [$col, (float)$value]);
                    break;
                case 'between':
                    if (is_array($value) && count($value) === 2) {
                        $query->whereRaw("(data->>?)::numeric BETWEEN ? AND ?", [$col, (float)$value[0], (float)$value[1]]);
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
            ->where('dataset_id', $datasetId);
        $query = $this->applyFilters($query, $filters);

        $stats = $query->selectRaw("
                COUNT(*) as count,
                AVG((data->>?)::numeric) as mean,
                MIN((data->>?)::numeric) as min,
                MAX((data->>?)::numeric) as max,
                SUM((data->>?)::numeric) as sum
            ", [$col, $col, $col, $col])
            ->first();

        $min = $stats->min ?? 0;
        $max = $stats->max ?? 1;
        $range = $max - $min;
        $bins = min(20, max(5, (int) sqrt($stats->count ?? 10)));
        $binSize = $range > 0 ? $range / $bins : 1;

        $histQuery = DB::table('registros_datos')
            ->where('dataset_id', $datasetId);
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
            $binStart = $min + ($h->bin * $binSize);
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
                'mean' => round($stats->mean ?? 0, 2),
                'min' => round($stats->min ?? 0, 2),
                'max' => round($stats->max ?? 0, 2),
                'sum' => round($stats->sum ?? 0, 2),
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

        // Get all text values from the column
        $texts = $query->selectRaw("data->>? as texto", [$col])
            ->whereRaw("data->>? IS NOT NULL", [$col])
            ->limit(5000)
            ->pluck('texto')
            ->toArray();

        // Spanish and English stopwords
        $stopwords = array_flip([
            // Spanish
            'de', 'la', 'el', 'en', 'y', 'a', 'los', 'del', 'se', 'las', 'por', 'un', 'para', 'con',
            'no', 'una', 'su', 'al', 'es', 'lo', 'como', 'pero', 'sus', 'le', 'ya', 'o', 'fue',
            'este', 'ha', 'si', 'porque', 'esta', 'son', 'entre', 'cuando', 'muy', 'sin', 'sobre',
            'ser', 'me', 'hasta', 'hay', 'donde', 'han', 'quien', 'desde',
            'todo', 'nos', 'durante', 'todos', 'uno', 'les', 'ni', 'contra', 'otros', 'fueron',
            'ese', 'eso', 'ante', 'ellos', 'esto', 'antes', 'algunos', 'unos', 'yo',
            'otro', 'otras', 'otra', 'tanto', 'esa', 'estos', 'mucho', 'nada', 'muchos',
            'cual', 'sea', 'poco', 'ella', 'estar', 'haber', 'estas', 'era', 'forma', 'parte', 'cada',
            'bien', 'puede', 'mismo', 'dos', 'que', 'mas',
            // English
            'the', 'be', 'to', 'of', 'and', 'in', 'that', 'have', 'it', 'for', 'not', 'on', 'with',
            'he', 'as', 'you', 'do', 'at', 'this', 'but', 'his', 'by', 'from', 'they', 'we', 'say',
            'her', 'she', 'or', 'an', 'will', 'my', 'one', 'all', 'would', 'there', 'their', 'what',
            'so', 'up', 'out', 'if', 'about', 'who', 'get', 'which', 'go', 'me', 'when', 'make', 'can',
            'like', 'no', 'just', 'him', 'know', 'take', 'into', 'your', 'some', 'could', 'them', 'see',
            'other', 'than', 'then', 'now', 'look', 'only', 'its', 'over', 'also', 'after', 'use', 'how',
            'our', 'any', 'these', 'most', 'us', 'is', 'are', 'was', 'were', 'been', 'has', 'had',
        ]);

        // Count word frequencies
        $wordCounts = [];
        foreach ($texts as $text) {
            if (empty($text)) continue;

            // Normalize: lowercase, remove punctuation, split
            $text = mb_strtolower(trim($text));
            $text = preg_replace('/[^\p{L}\p{N}\s]/u', ' ', $text);
            $words = preg_split('/\s+/', $text, -1, PREG_SPLIT_NO_EMPTY);

            foreach ($words as $word) {
                if (mb_strlen($word) < 3) continue;
                if (isset($stopwords[$word])) continue;

                $wordCounts[$word] = ($wordCounts[$word] ?? 0) + 1;
            }
        }

        // Sort by frequency and take top N
        arsort($wordCounts);
        $wordCounts = array_slice($wordCounts, 0, $limit, true);

        // Format for word cloud
        $words = [];
        $maxCount = !empty($wordCounts) ? max($wordCounts) : 1;
        foreach ($wordCounts as $word => $count) {
            $words[] = [
                'name' => $word,
                'value' => $count,
                'weight' => round($count / $maxCount, 3),
            ];
        }

        return [
            'data' => [
                'words' => $words,
                'labels' => array_column($words, 'name'),
                'values' => array_column($words, 'value'),
            ],
            'stats' => [
                'total_texts' => count($texts),
                'unique_words' => count($wordCounts),
                'total_words' => array_sum($wordCounts),
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
}
