<?php

declare(strict_types=1);

namespace App\Infrastructure\Persistence\Mongo\Repositories;

use App\Domain\Dataset\Repositories\RegistroDatoRepositoryInterface;
use App\Infrastructure\Persistence\Mongo\Models\RegistroDatoMongoModel;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Support\Collection;
use InvalidArgumentException;
use MongoDB\BSON\UTCDateTime;

class MongoRegistroDatoRepository implements RegistroDatoRepositoryInterface
{
    public function findByDatasetId(string $datasetId): Collection
    {
        return RegistroDatoMongoModel::where('dataset_id', $datasetId)->get();
    }

    public function findByDatasetIdPaginated(string $datasetId, int $perPage = 50): LengthAwarePaginator
    {
        return RegistroDatoMongoModel::where('dataset_id', $datasetId)
            ->orderBy('_id')
            ->paginate($perPage);
    }

    public function insertBatch(string $datasetId, array $records): int
    {
        $now = new UTCDateTime();

        $documents = array_map(fn($record) => [
            'dataset_id' => $datasetId,
            'data' => $record,
            'created_at' => $now,
        ], $records);

        foreach (array_chunk($documents, 1000) as $chunk) {
            RegistroDatoMongoModel::raw(
                fn($collection) => $collection->insertMany($chunk)
            );
        }

        return count($records);
    }

    public function deleteByDatasetId(string $datasetId): bool
    {
        return RegistroDatoMongoModel::where('dataset_id', $datasetId)->delete() > 0;
    }

    public function countByDatasetId(string $datasetId): int
    {
        return RegistroDatoMongoModel::where('dataset_id', $datasetId)->count();
    }

    public function getCategoricalFrequencies(string $datasetId, string $columna, int $limit = 20): array
    {
        $columna = $this->sanitizeColumn($columna);
        $field = 'data.' . $columna;

        $pipeline = [
            ['$match' => [
                'dataset_id' => $datasetId,
                $field => ['$ne' => null],
            ]],
            ['$group' => [
                '_id' => '$' . $field,
                'frecuencia' => ['$sum' => 1],
            ]],
            ['$sort' => ['frecuencia' => -1]],
            ['$limit' => $limit],
            ['$project' => [
                '_id' => 0,
                'categoria' => '$_id',
                'frecuencia' => 1,
            ]],
        ];

        $rows = $this->aggregate($pipeline);

        return array_map(fn($row) => [
            'categoria' => $row['categoria'] ?? null,
            'frecuencia' => (int) ($row['frecuencia'] ?? 0),
        ], $rows);
    }

    public function getNumericStats(string $datasetId, string $columna): array
    {
        $columna = $this->sanitizeColumn($columna);
        $field = 'data.' . $columna;

        $pipeline = [
            ['$match' => [
                'dataset_id' => $datasetId,
                '$expr' => ['$isNumber' => '$' . $field],
            ]],
            ['$group' => [
                '_id' => null,
                'count' => ['$sum' => 1],
                'mean' => ['$avg' => '$' . $field],
                'min' => ['$min' => '$' . $field],
                'max' => ['$max' => '$' . $field],
                'sum' => ['$sum' => '$' . $field],
                'std' => ['$stdDevPop' => '$' . $field],
                'values' => ['$push' => '$' . $field],
            ]],
        ];

        $rows = $this->aggregate($pipeline);

        if (empty($rows)) {
            return [
                'count' => 0,
                'mean' => null,
                'min' => null,
                'max' => null,
                'sum' => null,
                'std' => null,
                'median' => null,
            ];
        }

        $row = $rows[0];
        $values = $row['values'] ?? [];

        return [
            'count' => (int) ($row['count'] ?? 0),
            'mean' => isset($row['mean']) ? (float) $row['mean'] : null,
            'min' => isset($row['min']) ? (float) $row['min'] : null,
            'max' => isset($row['max']) ? (float) $row['max'] : null,
            'sum' => isset($row['sum']) ? (float) $row['sum'] : null,
            'std' => isset($row['std']) ? (float) $row['std'] : null,
            'median' => $this->calculateMedian($values),
        ];
    }

    public function getHistogram(string $datasetId, string $columna, int $bins = 10): array
    {
        $columna = $this->sanitizeColumn($columna);
        $stats = $this->getNumericStats($datasetId, $columna);

        if (empty($stats['min']) || empty($stats['max']) || $stats['min'] == $stats['max']) {
            return [];
        }

        $min = (float) $stats['min'];
        $max = (float) $stats['max'];
        $binWidth = ($max - $min) / $bins;

        $field = 'data.' . $columna;

        $pipeline = [
            ['$match' => [
                'dataset_id' => $datasetId,
                '$expr' => ['$isNumber' => '$' . $field],
            ]],
            ['$project' => [
                'bin' => ['$floor' => [
                    '$divide' => [
                        ['$subtract' => ['$' . $field, $min]],
                        $binWidth,
                    ],
                ]],
            ]],
            ['$group' => [
                '_id' => '$bin',
                'count' => ['$sum' => 1],
            ]],
            ['$sort' => ['_id' => 1]],
        ];

        $rows = $this->aggregate($pipeline);

        return array_map(function ($row) use ($min, $binWidth, $bins) {
            $binIndex = min((int) ($row['_id'] ?? 0), $bins - 1);
            $rangeStart = $min + ($binIndex * $binWidth);
            $rangeEnd = $rangeStart + $binWidth;

            return [
                'range' => sprintf('%.2f - %.2f', $rangeStart, $rangeEnd),
                'count' => (int) ($row['count'] ?? 0),
            ];
        }, $rows);
    }

    public function getScatterData(string $datasetId, string $columnaX, string $columnaY, int $limit = 1000): array
    {
        $columnaX = $this->sanitizeColumn($columnaX);
        $columnaY = $this->sanitizeColumn($columnaY);
        $fieldX = 'data.' . $columnaX;
        $fieldY = 'data.' . $columnaY;

        $pipeline = [
            ['$match' => [
                'dataset_id' => $datasetId,
                '$expr' => ['$and' => [
                    ['$isNumber' => '$' . $fieldX],
                    ['$isNumber' => '$' . $fieldY],
                ]],
            ]],
            ['$limit' => $limit],
            ['$project' => [
                '_id' => 0,
                'x' => '$' . $fieldX,
                'y' => '$' . $fieldY,
            ]],
        ];

        $rows = $this->aggregate($pipeline);

        return array_map(fn($row) => [
            (float) ($row['x'] ?? 0),
            (float) ($row['y'] ?? 0),
        ], $rows);
    }

    public function getGroupedAverages(string $datasetId, string $columnaCategoria, string $columnaNumerico, int $limit = 20): array
    {
        $columnaCategoria = $this->sanitizeColumn($columnaCategoria);
        $columnaNumerico = $this->sanitizeColumn($columnaNumerico);
        $fieldCat = 'data.' . $columnaCategoria;
        $fieldNum = 'data.' . $columnaNumerico;

        $pipeline = [
            ['$match' => [
                'dataset_id' => $datasetId,
                $fieldCat => ['$ne' => null],
                '$expr' => ['$isNumber' => '$' . $fieldNum],
            ]],
            ['$group' => [
                '_id' => '$' . $fieldCat,
                'promedio' => ['$avg' => '$' . $fieldNum],
                'count' => ['$sum' => 1],
            ]],
            ['$sort' => ['promedio' => -1]],
            ['$limit' => $limit],
            ['$project' => [
                '_id' => 0,
                'categoria' => '$_id',
                'promedio' => 1,
                'count' => 1,
            ]],
        ];

        $rows = $this->aggregate($pipeline);

        return array_map(fn($row) => [
            'categoria' => $row['categoria'] ?? null,
            'promedio' => isset($row['promedio']) ? (float) $row['promedio'] : null,
            'count' => (int) ($row['count'] ?? 0),
        ], $rows);
    }

    public function getContingencyTable(string $datasetId, string $columnaX, string $columnaY, int $limit = 15): array
    {
        $columnaX = $this->sanitizeColumn($columnaX);
        $columnaY = $this->sanitizeColumn($columnaY);
        $fieldX = 'data.' . $columnaX;
        $fieldY = 'data.' . $columnaY;

        $pipeline = [
            ['$match' => [
                'dataset_id' => $datasetId,
                $fieldX => ['$ne' => null],
                $fieldY => ['$ne' => null],
            ]],
            ['$group' => [
                '_id' => ['x' => '$' . $fieldX, 'y' => '$' . $fieldY],
                'count' => ['$sum' => 1],
            ]],
            ['$sort' => ['count' => -1]],
            ['$limit' => $limit * $limit],
        ];

        $rows = $this->aggregate($pipeline);

        $categories = [];
        $series = [];

        foreach ($rows as $row) {
            $x = $row['_id']['x'] ?? null;
            $y = $row['_id']['y'] ?? null;

            if (!in_array($x, $categories, true)) {
                $categories[] = $x;
            }
            if (!isset($series[$y])) {
                $series[$y] = [];
            }
            $series[$y][$x] = (int) ($row['count'] ?? 0);
        }

        return [
            'categories' => array_slice($categories, 0, $limit),
            'series' => $series,
        ];
    }

    public function getTimeSeriesAverage(string $datasetId, string $columnaFecha, string $columnaNumerico, int $limit = 50): array
    {
        $columnaFecha = $this->sanitizeColumn($columnaFecha);
        $columnaNumerico = $this->sanitizeColumn($columnaNumerico);
        $fieldFecha = 'data.' . $columnaFecha;
        $fieldNum = 'data.' . $columnaNumerico;

        $pipeline = [
            ['$match' => [
                'dataset_id' => $datasetId,
                $fieldFecha => ['$ne' => null],
                '$expr' => ['$isNumber' => '$' . $fieldNum],
            ]],
            ['$group' => [
                '_id' => '$' . $fieldFecha,
                'avg_value' => ['$avg' => '$' . $fieldNum],
                'count' => ['$sum' => 1],
            ]],
            ['$sort' => ['_id' => 1]],
            ['$limit' => $limit],
            ['$project' => [
                '_id' => 0,
                'fecha' => '$_id',
                'avg_value' => 1,
                'count' => 1,
            ]],
        ];

        $rows = $this->aggregate($pipeline);

        return array_map(fn($row) => [
            'fecha' => $row['fecha'] ?? null,
            'avg_value' => isset($row['avg_value']) ? (float) $row['avg_value'] : null,
            'count' => (int) ($row['count'] ?? 0),
        ], $rows);
    }

    public function getStackedTimeData(string $datasetId, string $columnaFecha, string $columnaCategoria, int $limit = 50): array
    {
        $columnaFecha = $this->sanitizeColumn($columnaFecha);
        $columnaCategoria = $this->sanitizeColumn($columnaCategoria);
        $fieldFecha = 'data.' . $columnaFecha;
        $fieldCat = 'data.' . $columnaCategoria;

        // Categorías únicas (máximo 10)
        $catRows = $this->aggregate([
            ['$match' => [
                'dataset_id' => $datasetId,
                $fieldCat => ['$ne' => null],
            ]],
            ['$group' => ['_id' => '$' . $fieldCat]],
            ['$sort' => ['_id' => 1]],
            ['$limit' => 10],
        ]);
        $categories = array_map(fn($row) => $row['_id'] ?? null, $catRows);

        // Fechas únicas (orden cronológico = lexicográfico para 'Y-m-d')
        $dateRows = $this->aggregate([
            ['$match' => [
                'dataset_id' => $datasetId,
                $fieldFecha => ['$ne' => null],
            ]],
            ['$group' => ['_id' => '$' . $fieldFecha]],
            ['$sort' => ['_id' => 1]],
            ['$limit' => $limit],
        ]);
        $dates = array_map(fn($row) => $row['_id'] ?? null, $dateRows);

        // Conteos por fecha y categoría
        $countRows = $this->aggregate([
            ['$match' => [
                'dataset_id' => $datasetId,
                $fieldFecha => ['$ne' => null],
                $fieldCat => ['$ne' => null],
            ]],
            ['$group' => [
                '_id' => ['fecha' => '$' . $fieldFecha, 'categoria' => '$' . $fieldCat],
                'count' => ['$sum' => 1],
            ]],
        ]);

        // Indexar conteos: [fecha][categoria] => count
        $countMap = [];
        foreach ($countRows as $row) {
            $fecha = $row['_id']['fecha'] ?? null;
            $cat = $row['_id']['categoria'] ?? null;
            $countMap[$fecha][$cat] = (int) ($row['count'] ?? 0);
        }

        // Construir series
        $series = [];
        foreach ($categories as $cat) {
            $seriesData = [];
            foreach ($dates as $date) {
                $seriesData[] = $countMap[$date][$cat] ?? 0;
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
     * Ejecuta un aggregation pipeline y devuelve cada documento como array PHP plano.
     *
     * @param array<int, array<string, mixed>> $pipeline
     * @return array<int, array<string, mixed>>
     */
    private function aggregate(array $pipeline): array
    {
        return RegistroDatoMongoModel::raw(
            fn($collection) => $collection->aggregate($pipeline, [
                'typeMap' => ['root' => 'array', 'document' => 'array', 'array' => 'array'],
            ])
        )->toArray();
    }

    /**
     * Calcula la mediana en PHP a partir de una lista de valores numéricos.
     *
     * @param array<int, int|float> $values
     */
    private function calculateMedian(array $values): ?float
    {
        if (empty($values)) {
            return null;
        }

        $numbers = array_values(array_map('floatval', $values));
        sort($numbers);

        $count = count($numbers);
        $middle = intdiv($count, 2);

        if ($count % 2 === 0) {
            return ($numbers[$middle - 1] + $numbers[$middle]) / 2;
        }

        return $numbers[$middle];
    }

    /**
     * Valida el nombre de columna para prevenir inyección NoSQL.
     */
    private function sanitizeColumn(string $col): string
    {
        if (!preg_match('/^[a-zA-Z0-9_]+$/', $col)) {
            throw new InvalidArgumentException("Nombre de columna inválido: {$col}");
        }

        return $col;
    }
}
