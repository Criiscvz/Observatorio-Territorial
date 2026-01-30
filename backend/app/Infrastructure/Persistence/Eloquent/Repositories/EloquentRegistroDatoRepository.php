<?php

declare(strict_types=1);

namespace App\Infrastructure\Persistence\Eloquent\Repositories;

use App\Domain\Dataset\Repositories\RegistroDatoRepositoryInterface;
use App\Infrastructure\Persistence\Eloquent\Models\RegistroDatoModel;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class EloquentRegistroDatoRepository implements RegistroDatoRepositoryInterface
{
    public function __construct(
        private readonly RegistroDatoModel $model
    ) {}

    public function findByDatasetId(string $datasetId): Collection
    {
        return $this->model->where('dataset_id', $datasetId)->get();
    }

    public function findByDatasetIdPaginated(string $datasetId, int $perPage = 50): LengthAwarePaginator
    {
        return $this->model
            ->where('dataset_id', $datasetId)
            ->orderBy('id')
            ->paginate($perPage);
    }

    public function insertBatch(string $datasetId, array $records): int
    {
        $data = array_map(fn($record) => [
            'dataset_id' => $datasetId,
            'data' => json_encode($record),
            'created_at' => now(),
            'updated_at' => now(),
        ], $records);

        foreach (array_chunk($data, 1000) as $chunk) {
            $this->model->insert($chunk);
        }

        return count($records);
    }

    public function deleteByDatasetId(string $datasetId): bool
    {
        return $this->model->where('dataset_id', $datasetId)->delete() > 0;
    }

    public function countByDatasetId(string $datasetId): int
    {
        return $this->model->where('dataset_id', $datasetId)->count();
    }

    public function getCategoricalFrequencies(string $datasetId, string $columna, int $limit = 20): array
    {
        return DB::table('registros_datos')
            ->select(DB::raw("data->>'$columna' as categoria, COUNT(*) as frecuencia"))
            ->where('dataset_id', $datasetId)
            ->whereNotNull(DB::raw("data->>'$columna'"))
            ->groupBy(DB::raw("data->>'$columna'"))
            ->orderBy('frecuencia', 'desc')
            ->limit($limit)
            ->get()
            ->toArray();
    }

    public function getNumericStats(string $datasetId, string $columna): array
    {
        $result = DB::table('registros_datos')
            ->select(DB::raw("
                COUNT(*) as count,
                AVG((data->>'$columna')::numeric) as mean,
                MIN((data->>'$columna')::numeric) as min,
                MAX((data->>'$columna')::numeric) as max,
                SUM((data->>'$columna')::numeric) as sum,
                STDDEV((data->>'$columna')::numeric) as std,
                PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY (data->>'$columna')::numeric) as median
            "))
            ->where('dataset_id', $datasetId)
            ->whereRaw("data->>'$columna' ~ '^-?[0-9]+(\\.[0-9]+)?$'")
            ->first();

        return (array) $result;
    }

    public function getHistogram(string $datasetId, string $columna, int $bins = 10): array
    {
        $stats = $this->getNumericStats($datasetId, $columna);
        
        if (empty($stats['min']) || empty($stats['max']) || $stats['min'] == $stats['max']) {
            return [];
        }

        $min = (float) $stats['min'];
        $max = (float) $stats['max'];
        $binWidth = ($max - $min) / $bins;

        $result = DB::table('registros_datos')
            ->select(DB::raw("
                FLOOR(((data->>'$columna')::numeric - $min) / $binWidth) as bin,
                COUNT(*) as count
            "))
            ->where('dataset_id', $datasetId)
            ->whereRaw("data->>'$columna' ~ '^-?[0-9]+(\\.[0-9]+)?$'")
            ->groupBy('bin')
            ->orderBy('bin')
            ->get();

        return $result->map(function ($row) use ($min, $binWidth, $bins) {
            $binIndex = min((int) $row->bin, $bins - 1);
            $rangeStart = $min + ($binIndex * $binWidth);
            $rangeEnd = $rangeStart + $binWidth;
            
            return [
                'range' => sprintf('%.2f - %.2f', $rangeStart, $rangeEnd),
                'count' => (int) $row->count,
            ];
        })->toArray();
    }

    public function getScatterData(string $datasetId, string $columnaX, string $columnaY, int $limit = 1000): array
    {
        return DB::table('registros_datos')
            ->select(DB::raw("
                (data->>'$columnaX')::numeric as x,
                (data->>'$columnaY')::numeric as y
            "))
            ->where('dataset_id', $datasetId)
            ->whereRaw("data->>'$columnaX' ~ '^-?[0-9]+(\\.[0-9]+)?$'")
            ->whereRaw("data->>'$columnaY' ~ '^-?[0-9]+(\\.[0-9]+)?$'")
            ->limit($limit)
            ->get()
            ->map(fn($row) => [(float) $row->x, (float) $row->y])
            ->toArray();
    }

    public function getGroupedAverages(string $datasetId, string $columnaCategoria, string $columnaNumerico, int $limit = 20): array
    {
        return DB::table('registros_datos')
            ->select(DB::raw("
                data->>'$columnaCategoria' as categoria,
                AVG((data->>'$columnaNumerico')::numeric) as promedio,
                COUNT(*) as count
            "))
            ->where('dataset_id', $datasetId)
            ->whereNotNull(DB::raw("data->>'$columnaCategoria'"))
            ->whereRaw("data->>'$columnaNumerico' ~ '^-?[0-9]+(\\.[0-9]+)?$'")
            ->groupBy(DB::raw("data->>'$columnaCategoria'"))
            ->orderBy('promedio', 'desc')
            ->limit($limit)
            ->get()
            ->toArray();
    }

    public function getContingencyTable(string $datasetId, string $columnaX, string $columnaY, int $limit = 15): array
    {
        $result = DB::table('registros_datos')
            ->select(DB::raw("
                data->>'$columnaX' as x,
                data->>'$columnaY' as y,
                COUNT(*) as count
            "))
            ->where('dataset_id', $datasetId)
            ->whereNotNull(DB::raw("data->>'$columnaX'"))
            ->whereNotNull(DB::raw("data->>'$columnaY'"))
            ->groupBy(DB::raw("data->>'$columnaX'"), DB::raw("data->>'$columnaY'"))
            ->orderBy('count', 'desc')
            ->limit($limit * $limit)
            ->get();

        $categories = [];
        $series = [];

        foreach ($result as $row) {
            if (!in_array($row->x, $categories)) {
                $categories[] = $row->x;
            }
            if (!isset($series[$row->y])) {
                $series[$row->y] = [];
            }
            $series[$row->y][$row->x] = (int) $row->count;
        }

        return [
            'categories' => array_slice($categories, 0, $limit),
            'series' => $series,
        ];
    }
}
