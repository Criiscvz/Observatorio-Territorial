<?php

declare(strict_types=1);

namespace App\Infrastructure\Services;

use App\Domain\Statistics\Services\StatisticsServiceInterface;
use Illuminate\Support\Facades\DB;

class StatisticsService implements StatisticsServiceInterface
{
    public function getNumericStats(string $datasetId, string $column, int $limit): array
    {
        $stats = DB::table('registros_datos')
            ->where('dataset_id', $datasetId)
            ->selectRaw("
                COUNT(*) as count,
                AVG((data->>'$column')::numeric) as mean,
                MIN((data->>'$column')::numeric) as min,
                MAX((data->>'$column')::numeric) as max,
                SUM((data->>'$column')::numeric) as sum
            ")
            ->first();

        $min = $stats->min ?? 0;
        $max = $stats->max ?? 1;
        $range = $max - $min;
        $bins = min(20, max(5, (int) sqrt($stats->count ?? 10)));
        $binSize = $range > 0 ? $range / $bins : 1;

        $histogram = DB::table('registros_datos')
            ->where('dataset_id', $datasetId)
            ->selectRaw("
                FLOOR(((data->>'$column')::numeric - $min) / $binSize) as bin,
                COUNT(*) as count
            ")
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

    public function getCategoricalStats(string $datasetId, string $column, int $limit): array
    {
        $data = DB::table('registros_datos')
            ->where('dataset_id', $datasetId)
            ->selectRaw("data->>'$column' as categoria, COUNT(*) as count")
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

    public function getScatterData(string $datasetId, string $columnX, string $columnY, int $limit): array
    {
        $points = DB::table('registros_datos')
            ->where('dataset_id', $datasetId)
            ->selectRaw("(data->>'$columnX')::numeric as x, (data->>'$columnY')::numeric as y")
            ->whereNotNull(DB::raw("data->>'$columnX'"))
            ->whereNotNull(DB::raw("data->>'$columnY'"))
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

    public function getGroupedBarData(string $datasetId, string $catColumn, string $numColumn, int $limit): array
    {
        $data = DB::table('registros_datos')
            ->where('dataset_id', $datasetId)
            ->selectRaw("
                data->>'$catColumn' as categoria,
                AVG((data->>'$numColumn')::numeric) as avg_value,
                COUNT(*) as count
            ")
            ->groupBy('categoria')
            ->orderByDesc('count')
            ->limit($limit)
            ->get();

        return [
            'data' => [
                'categories' => $data->pluck('categoria')->toArray(),
                'labels' => $data->pluck('categoria')->toArray(),
                'values' => $data->pluck('avg_value')->map(fn($v) => round((float) $v, 2))->toArray(),
                'counts' => $data->pluck('count')->map(fn($v) => (int) $v)->toArray(),
            ],
            'stats' => [
                'count' => $data->sum('count'),
            ],
        ];
    }

    public function getHeatmapData(string $datasetId, string $columnX, string $columnY, int $limit): array
    {
        $labelsX = DB::table('registros_datos')
            ->where('dataset_id', $datasetId)
            ->selectRaw("DISTINCT data->>'$columnX' as cat")
            ->orderBy('cat')
            ->limit($limit)
            ->pluck('cat')
            ->toArray();

        $labelsY = DB::table('registros_datos')
            ->where('dataset_id', $datasetId)
            ->selectRaw("DISTINCT data->>'$columnY' as cat")
            ->orderBy('cat')
            ->limit($limit)
            ->pluck('cat')
            ->toArray();

        $counts = DB::table('registros_datos')
            ->where('dataset_id', $datasetId)
            ->selectRaw("data->>'$columnX' as cat_x, data->>'$columnY' as cat_y, COUNT(*) as count")
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

    public function getTimeSeriesData(string $datasetId, string $dateColumn, string $numColumn, int $limit): array
    {
        $data = DB::table('registros_datos')
            ->where('dataset_id', $datasetId)
            ->selectRaw("
                DATE(data->>'$dateColumn') as fecha,
                AVG((data->>'$numColumn')::numeric) as avg_value,
                COUNT(*) as count
            ")
            ->whereNotNull(DB::raw("data->>'$dateColumn'"))
            ->whereNotNull(DB::raw("data->>'$numColumn'"))
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

    public function getStackedBarData(string $datasetId, string $dateColumn, string $catColumn, int $limit): array
    {
        $categories = DB::table('registros_datos')
            ->where('dataset_id', $datasetId)
            ->selectRaw("DISTINCT data->>'$catColumn' as cat")
            ->orderBy('cat')
            ->limit(10)
            ->pluck('cat')
            ->toArray();

        $dates = DB::table('registros_datos')
            ->where('dataset_id', $datasetId)
            ->selectRaw("DISTINCT DATE(data->>'$dateColumn') as fecha")
            ->orderBy('fecha')
            ->limit($limit)
            ->pluck('fecha')
            ->toArray();

        $counts = DB::table('registros_datos')
            ->where('dataset_id', $datasetId)
            ->selectRaw("DATE(data->>'$dateColumn') as fecha, data->>'$catColumn' as categoria, COUNT(*) as count")
            ->groupBy('fecha', 'categoria')
            ->get();

        $series = [];
        foreach ($categories as $cat) {
            $seriesData = [];
            foreach ($dates as $date) {
                $count = $counts->where('fecha', $date)->where('categoria', $cat)->first();
                $seriesData[] = $count ? (int) $count->count : 0;
            }
            $series[] = [
                'name' => $cat ?? 'Sin valor',
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
