<?php

declare(strict_types=1);

namespace App\Infrastructure\Persistence\Eloquent\Repositories;

use App\Domain\Dataset\Repositories\RegistroDatoRepositoryInterface;
use App\Infrastructure\Persistence\Eloquent\Models\RegistroDatoModel;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Query\Builder;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class EloquentRegistroDatoRepository implements RegistroDatoRepositoryInterface
{
    private const NUMERIC_PATTERN = '^-?[0-9]+(\.[0-9]+)?$';

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
        return $this->datasetColumns($datasetId, ['categoria' => $columna])
            ->selectRaw('categoria, COUNT(*) as frecuencia')
            ->whereNotNull('categoria')
            ->groupBy('categoria')
            ->orderBy('frecuencia', 'desc')
            ->limit($limit)
            ->get()
            ->toArray();
    }

    public function getNumericStats(string $datasetId, string $columna): array
    {
        $result = $this->datasetColumns($datasetId, ['value' => $columna])
            ->selectRaw('
                COUNT(*) as count,
                AVG(value::numeric) as mean,
                MIN(value::numeric) as min,
                MAX(value::numeric) as max,
                SUM(value::numeric) as sum,
                STDDEV(value::numeric) as std,
                PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY value::numeric) as median
            ')
            ->whereRaw('value ~ ?', [self::NUMERIC_PATTERN])
            ->first();

        return (array) $result;
    }

    public function getHistogram(string $datasetId, string $columna, int $bins = 10): array
    {
        if ($bins < 1) {
            throw new \InvalidArgumentException('El número de intervalos debe ser mayor que cero.');
        }

        $stats = $this->getNumericStats($datasetId, $columna);
        
        if ($stats['min'] === null || $stats['max'] === null || $stats['min'] == $stats['max']) {
            return [];
        }

        $min = (float) $stats['min'];
        $max = (float) $stats['max'];
        $binWidth = ($max - $min) / $bins;

        $result = $this->datasetColumns($datasetId, ['value' => $columna])
            ->selectRaw('
                LEAST(FLOOR((value::numeric - CAST(? AS numeric)) / CAST(? AS numeric)), ?) as bin,
                COUNT(*) as count
            ', [$min, $binWidth, $bins - 1])
            ->whereRaw('value ~ ?', [self::NUMERIC_PATTERN])
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
        return $this->datasetColumns($datasetId, ['value_x' => $columnaX, 'value_y' => $columnaY])
            ->selectRaw('value_x::numeric as x, value_y::numeric as y')
            ->whereRaw('value_x ~ ?', [self::NUMERIC_PATTERN])
            ->whereRaw('value_y ~ ?', [self::NUMERIC_PATTERN])
            ->limit($limit)
            ->get()
            ->map(fn($row) => [(float) $row->x, (float) $row->y])
            ->toArray();
    }

    public function getGroupedAverages(string $datasetId, string $columnaCategoria, string $columnaNumerico, int $limit = 20): array
    {
        return $this->datasetColumns($datasetId, ['categoria' => $columnaCategoria, 'value' => $columnaNumerico])
            ->selectRaw('
                categoria,
                AVG(value::numeric) as promedio,
                COUNT(*) as count
            ')
            ->whereNotNull('categoria')
            ->whereRaw('value ~ ?', [self::NUMERIC_PATTERN])
            ->groupBy('categoria')
            ->orderBy('promedio', 'desc')
            ->limit($limit)
            ->get()
            ->toArray();
    }

    public function getContingencyTable(string $datasetId, string $columnaX, string $columnaY, int $limit = 15): array
    {
        $result = $this->datasetColumns($datasetId, ['x' => $columnaX, 'y' => $columnaY])
            ->selectRaw('x, y, COUNT(*) as count')
            ->whereNotNull('x')
            ->whereNotNull('y')
            ->groupBy('x', 'y')
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

    public function getTimeSeriesAverage(string $datasetId, string $columnaFecha, string $columnaNumerico, int $limit = 50): array
    {
        return $this->datasetColumns($datasetId, ['date_value' => $columnaFecha, 'value' => $columnaNumerico])
            ->selectRaw('
                DATE(date_value) as fecha,
                AVG(value::numeric) as avg_value,
                COUNT(*) as count
            ')
            ->whereNotNull('date_value')
            ->whereRaw('value ~ ?', [self::NUMERIC_PATTERN])
            ->groupBy('fecha')
            ->orderBy('fecha')
            ->limit($limit)
            ->get()
            ->toArray();
    }

    public function getStackedTimeData(string $datasetId, string $columnaFecha, string $columnaCategoria, int $limit = 50): array
    {
        $values = $this->datasetColumns($datasetId, ['date_value' => $columnaFecha, 'categoria' => $columnaCategoria]);

        // Obtener categorías únicas
        $categories = (clone $values)
            ->distinct()
            ->select('categoria')
            ->whereNotNull('categoria')
            ->orderBy('categoria')
            ->limit(10)
            ->pluck('categoria')
            ->toArray();

        // Obtener fechas únicas
        $dates = (clone $values)
            ->distinct()
            ->selectRaw('DATE(date_value) as fecha')
            ->whereNotNull('date_value')
            ->orderBy('fecha')
            ->limit($limit)
            ->pluck('fecha')
            ->toArray();

        // Contar por fecha y categoría
        $counts = (clone $values)
            ->selectRaw('
                DATE(date_value) as fecha,
                categoria,
                COUNT(*) as count
            ')
            ->whereNotNull('date_value')
            ->whereNotNull('categoria')
            ->groupBy('fecha', 'categoria')
            ->get();

        // Construir series
        $series = [];
        foreach ($categories as $cat) {
            $seriesData = [];
            foreach ($dates as $date) {
                $count = $counts->first(fn($c) => $c->fecha === $date && $c->categoria === $cat);
                $seriesData[] = $count ? (int)$count->count : 0;
            }
            $series[] = [
                'name' => $cat ?? 'Sin valor',
                'data' => $seriesData,
            ];
        }

        return [
            'labels_x' => $dates,
            'categories' => $categories,
            'series' => $series,
        ];
    }

    /**
     * Project JSON keys once as bound text values, never as SQL fragments.
     * The aliases are fixed by the calling methods and escaped as identifiers.
     * Using a subquery also avoids repeating positional parameters in GROUP BY.
     *
     * @param array<string, string> $columns SQL alias => imported JSON key
     */
    private function datasetColumns(string $datasetId, array $columns): Builder
    {
        $query = DB::table('registros_datos')->where('dataset_id', $datasetId);

        foreach ($columns as $alias => $column) {
            $column = $this->sanitizeColumn($column);
            $query->selectRaw(
                'data->>CAST(? AS text) AS '.$query->getGrammar()->wrap($alias),
                [$column],
            );
        }

        return DB::query()->fromSub($query, 'dataset_values');
    }

    /** Imported column names are normalized by ExcelReaderService. */
    private function sanitizeColumn(string $columna): string
    {
        if (!preg_match('/^[a-zA-Z0-9_]+$/D', $columna)) {
            throw new \InvalidArgumentException("Nombre de columna inválido: {$columna}");
        }

        return $columna;
    }
}
