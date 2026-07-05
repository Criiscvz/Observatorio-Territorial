<?php

declare(strict_types=1);

namespace App\Infrastructure\Services;

use App\Domain\Statistics\Services\StatisticsServiceInterface;
use App\Infrastructure\Persistence\Mongo\Models\RegistroDatoMongoModel;
use Illuminate\Support\Facades\DB;

class StatisticsService implements StatisticsServiceInterface
{
    public function __construct(
        private readonly TextProcessingService $textProcessor,
    ) {}

    /**
     * Whitelist pattern for column names to prevent injection.
     *
     * Se permite cualquier carácter Unicode imprimible (las columnas del CSV pueden tener
     * signos de interrogación, paréntesis, acentos, etc.). Es seguro porque los nombres
     * nunca se interpolan en una cadena de consulta: se usan únicamente como field paths
     * estructurados dentro de los pipelines de Mongo ('data.'.$col).
     */
    private function sanitizeColumn(string $column): string
    {
        if (!preg_match('/^[^\x00-\x1F\x7F]+$/u', $column) || mb_strlen($column) > 500) {
            throw new \InvalidArgumentException("Nombre de columna inválido: {$column}");
        }
        return $column;
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
     * Detect if a value looks like a date string (YYYY-MM-DD or similar)
     */
    private function isDateValue(mixed $value): bool
    {
        if (!is_string($value)) return false;
        return (bool) preg_match('/^\d{4}[-\/]\d{1,2}[-\/]\d{1,2}/', $value);
    }

    /**
     * Determine the logical type of a filter (date / numeric / text) based on type hint or value.
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
     * Construye el fragmento de $match de Mongo equivalente a applyFilters() de Postgres.
     *
     * Replica las semánticas de la versión jsonb:
     *  - eq/neq/in/not_in: comparan como STRING (en Postgres se hacía con data->>? y casteos a string).
     *  - gt/gte/lt/lte/between: comparación numérica o por fecha (string Y-m-d, comparable lexicográficamente).
     *  - contains/not_contains: ILIKE (case-insensitive substring) -> $regex con opción 'i'.
     *
     * @param array<int, array<string, mixed>>|null $filters
     * @return array<string, mixed>  Fragmento listo para mezclar dentro de un $match.
     */
    private function buildFilterMatch(?array $filters): array
    {
        if (empty($filters)) {
            return [];
        }

        $conditions = [];

        foreach ($filters as $filter) {
            $col = $this->sanitizeColumn($filter['column']);
            $operator = $filter['operator'];
            $value = $filter['value'];
            $cast = $this->getFilterCast($filter);
            $field = 'data.' . $col;

            switch ($operator) {
                case 'eq':
                    // Comparación como string para replicar data->>? = ?
                    $conditions[] = ['$expr' => ['$eq' => [['$toString' => '$' . $field], (string) $value]]];
                    break;

                case 'neq':
                    $conditions[] = ['$expr' => ['$ne' => [['$toString' => '$' . $field], (string) $value]]];
                    break;

                case 'in':
                    if (is_array($value)) {
                        $conditions[] = ['$expr' => ['$in' => [
                            ['$toString' => '$' . $field],
                            array_map('strval', $value),
                        ]]];
                    }
                    break;

                case 'not_in':
                    if (is_array($value)) {
                        $conditions[] = ['$expr' => ['$not' => [['$in' => [
                            ['$toString' => '$' . $field],
                            array_map('strval', $value),
                        ]]]]];
                    }
                    break;

                case 'gt':
                    $conditions[] = $cast === 'date'
                        ? [$field => ['$gt' => (string) $value]]
                        : [$field => ['$gt' => (float) $value]];
                    break;

                case 'gte':
                    $conditions[] = $cast === 'date'
                        ? [$field => ['$gte' => (string) $value]]
                        : [$field => ['$gte' => (float) $value]];
                    break;

                case 'lt':
                    $conditions[] = $cast === 'date'
                        ? [$field => ['$lt' => (string) $value]]
                        : [$field => ['$lt' => (float) $value]];
                    break;

                case 'lte':
                    $conditions[] = $cast === 'date'
                        ? [$field => ['$lte' => (string) $value]]
                        : [$field => ['$lte' => (float) $value]];
                    break;

                case 'between':
                    if (is_array($value) && count($value) === 2) {
                        if ($cast === 'date') {
                            $conditions[] = [$field => ['$gte' => (string) $value[0], '$lte' => (string) $value[1]]];
                        } else {
                            $conditions[] = [$field => ['$gte' => (float) $value[0], '$lte' => (float) $value[1]]];
                        }
                    }
                    break;

                case 'contains':
                    $conditions[] = [$field => ['$regex' => preg_quote((string) $value, '/'), '$options' => 'i']];
                    break;

                case 'not_contains':
                    $conditions[] = [$field => ['$not' => ['$regex' => preg_quote((string) $value, '/'), '$options' => 'i']]];
                    break;
            }
        }

        if (empty($conditions)) {
            return [];
        }

        // Mezclar todas las condiciones en un solo fragmento. Como varios filtros pueden
        // usar la misma clave ($expr / mismo field), se combinan bajo $and para no perder ninguno.
        return ['$and' => $conditions];
    }

    /**
     * Construye el $match inicial de un pipeline: dataset_id + filtros + condiciones extra.
     *
     * @param array<int, array<string, mixed>>|null $filters
     * @param array<string, mixed> $extra  Condiciones adicionales (p.ej. validez numérica/fecha de columnas).
     * @return array<string, mixed>
     */
    private function buildMatch(string $datasetId, ?array $filters, array $extra = []): array
    {
        $match = ['dataset_id' => $datasetId];

        $filterMatch = $this->buildFilterMatch($filters);

        // Combinar fragmentos que puedan compartir claves ($and, $expr, etc.) sin pisarse.
        $andClauses = [];

        if (!empty($filterMatch)) {
            // buildFilterMatch siempre devuelve ['$and' => [...]] cuando hay condiciones.
            $andClauses = array_merge($andClauses, $filterMatch['$and'] ?? [$filterMatch]);
        }

        if (!empty($extra)) {
            $andClauses[] = $extra;
        }

        if (!empty($andClauses)) {
            $match['$and'] = $andClauses;
        }

        return $match;
    }

    public function getNumericStats(string $datasetId, string $column, int $limit, ?array $filters = null): array
    {
        $col = $this->sanitizeColumn($column);
        $field = 'data.' . $col;

        // Solo filas cuyo valor es realmente numérico (los valores ya son float nativos en Mongo).
        $onlyNumeric = ['$expr' => ['$isNumber' => '$' . $field]];

        $statsMatch = $this->buildMatch($datasetId, $filters, $onlyNumeric);

        $statsRows = $this->aggregate([
            ['$match' => $statsMatch],
            ['$group' => [
                '_id' => null,
                'count' => ['$sum' => 1],
                'mean' => ['$avg' => '$' . $field],
                'min' => ['$min' => '$' . $field],
                'max' => ['$max' => '$' . $field],
                'sum' => ['$sum' => '$' . $field],
            ]],
        ]);

        $stats = $statsRows[0] ?? [];

        $min = (float) ($stats['min'] ?? 0);
        $max = (float) ($stats['max'] ?? 1);
        $count = (int) ($stats['count'] ?? 0);
        $range = $max - $min;
        $bins = min(20, max(5, (int) sqrt($count > 0 ? $count : 10)));
        $binSize = $range > 0 ? $range / $bins : 1;

        $histogram = $this->aggregate([
            ['$match' => $statsMatch],
            ['$project' => [
                'bin' => ['$floor' => [
                    '$divide' => [
                        ['$subtract' => ['$' . $field, $min]],
                        $binSize,
                    ],
                ]],
            ]],
            ['$group' => [
                '_id' => '$bin',
                'count' => ['$sum' => 1],
            ]],
            ['$sort' => ['_id' => 1]],
        ]);

        $labels = [];
        $values = [];

        foreach ($histogram as $h) {
            $binStart = $min + ((float) ($h['_id'] ?? 0) * $binSize);
            $binEnd = $binStart + $binSize;
            $labels[] = number_format($binStart, 1) . ' - ' . number_format($binEnd, 1);
            $values[] = (int) ($h['count'] ?? 0);
        }

        return [
            'data' => [
                'labels' => $labels,
                'values' => $values,
            ],
            'stats' => [
                'count' => (int) ($stats['count'] ?? 0),
                'mean' => round((float) ($stats['mean'] ?? 0), 2),
                'min' => round((float) ($stats['min'] ?? 0), 2),
                'max' => round((float) ($stats['max'] ?? 0), 2),
                'sum' => round((float) ($stats['sum'] ?? 0), 2),
            ],
        ];
    }

    public function getCategoricalStats(string $datasetId, string $column, int $limit, ?array $filters = null): array
    {
        $col = $this->sanitizeColumn($column);
        $field = 'data.' . $col;

        // Normaliza el valor: trim de strings, NULL/'' -> 'Sin valor'.
        // $trim solo opera sobre strings; para valores no string usamos $toString primero.
        $categoryExpr = ['$let' => [
            'vars' => [
                'trimmed' => ['$trim' => ['input' => ['$toString' => ['$ifNull' => ['$' . $field, '']]]]],
            ],
            'in' => ['$cond' => [
                ['$eq' => ['$$trimmed', '']],
                'Sin valor',
                '$$trimmed',
            ]],
        ]];

        $rows = $this->aggregate([
            ['$match' => $this->buildMatch($datasetId, $filters)],
            ['$group' => [
                '_id' => $categoryExpr,
                'count' => ['$sum' => 1],
            ]],
            ['$sort' => ['count' => -1]],
            ['$limit' => $limit],
            ['$project' => [
                '_id' => 0,
                'categoria' => '$_id',
                'count' => 1,
            ]],
        ]);

        $labels = [];
        $values = [];
        $totalCount = 0;
        foreach ($rows as $row) {
            $labels[] = $row['categoria'] ?? 'Sin valor';
            $c = (int) ($row['count'] ?? 0);
            $values[] = $c;
            $totalCount += $c;
        }

        return [
            'data' => [
                'labels' => $labels,
                'values' => $values,
            ],
            'stats' => [
                'count' => $totalCount,
                'unique' => count($rows),
            ],
        ];
    }

    public function getDateStats(string $datasetId, string $column, int $limit, ?array $filters = null): array
    {
        $col = $this->sanitizeColumn($column);
        $field = 'data.' . $col;

        // Solo filas cuyo valor (string) empieza por YYYY-MM-DD o YYYY/MM/DD.
        $onlyDate = [$field => ['$type' => 'string', '$regex' => '^[0-9]{4}[-/][0-9]{1,2}[-/][0-9]{1,2}']];

        $baseMatch = $this->buildMatch($datasetId, $filters, $onlyDate);

        // Rango de fechas y total. Los valores son strings 'Y-m-d' => min/max lexicográfico = cronológico.
        $rangeRows = $this->aggregate([
            ['$match' => $baseMatch],
            ['$group' => [
                '_id' => null,
                // Normalizamos a YYYY-MM-DD tomando los primeros 10 caracteres del string.
                'min_date' => ['$min' => ['$substrBytes' => ['$' . $field, 0, 10]]],
                'max_date' => ['$max' => ['$substrBytes' => ['$' . $field, 0, 10]]],
                'count' => ['$sum' => 1],
            ]],
        ]);

        $range = $rangeRows[0] ?? [];
        $minDate = $range['min_date'] ?? null;
        $maxDate = $range['max_date'] ?? null;
        $totalCount = (int) ($range['count'] ?? 0);

        if (!$minDate || !$maxDate || $totalCount === 0) {
            return [
                'data' => ['labels' => [], 'values' => []],
                'stats' => ['count' => 0, 'min_date' => null, 'max_date' => null, 'periods' => 0],
            ];
        }

        // Granularidad según rango de días.
        $daysDiff = (int) ((strtotime($maxDate) - strtotime($minDate)) / 86400);

        if ($daysDiff <= 60) {
            // Hasta 2 meses: agrupar por día (YYYY-MM-DD).
            $periodExpr = ['$substrBytes' => ['$' . $field, 0, 10]];
            $granularity = 'day';
        } elseif ($daysDiff <= 730) {
            // Hasta 2 años: agrupar por mes (YYYY-MM).
            $periodExpr = ['$substrBytes' => ['$' . $field, 0, 7]];
            $granularity = 'month';
        } else {
            // Más de 2 años: agrupar por año (YYYY).
            $periodExpr = ['$substrBytes' => ['$' . $field, 0, 4]];
            $granularity = 'year';
        }

        $data = $this->aggregate([
            ['$match' => $baseMatch],
            ['$group' => [
                '_id' => $periodExpr,
                'count' => ['$sum' => 1],
            ]],
            ['$sort' => ['_id' => 1]],
            ['$limit' => $limit],
            ['$project' => [
                '_id' => 0,
                'periodo' => '$_id',
                'count' => 1,
            ]],
        ]);

        $labels = [];
        $values = [];
        foreach ($data as $row) {
            $labels[] = $row['periodo'] ?? null;
            $values[] = (int) ($row['count'] ?? 0);
        }

        return [
            'data' => [
                'labels' => $labels,
                'values' => $values,
            ],
            'stats' => [
                'count' => $totalCount,
                'min_date' => $minDate,
                'max_date' => $maxDate,
                'periods' => count($data),
                'granularity' => $granularity,
            ],
        ];
    }

    public function getScatterData(string $datasetId, string $columnX, string $columnY, int $limit, ?array $filters = null): array
    {
        $colX = $this->sanitizeColumn($columnX);
        $colY = $this->sanitizeColumn($columnY);
        $fieldX = 'data.' . $colX;
        $fieldY = 'data.' . $colY;

        $bothNumeric = ['$expr' => ['$and' => [
            ['$isNumber' => '$' . $fieldX],
            ['$isNumber' => '$' . $fieldY],
        ]]];

        $rows = $this->aggregate([
            ['$match' => $this->buildMatch($datasetId, $filters, $bothNumeric)],
            ['$limit' => 1000],
            ['$project' => [
                '_id' => 0,
                'x' => '$' . $fieldX,
                'y' => '$' . $fieldY,
            ]],
        ]);

        $points = array_map(fn($row) => [
            (float) ($row['x'] ?? 0),
            (float) ($row['y'] ?? 0),
        ], $rows);

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
        $fieldCat = 'data.' . $cat;
        $fieldNum = 'data.' . $num;

        $onlyNumeric = ['$expr' => ['$isNumber' => '$' . $fieldNum]];

        $categoryExpr = ['$let' => [
            'vars' => [
                'trimmed' => ['$trim' => ['input' => ['$toString' => ['$ifNull' => ['$' . $fieldCat, '']]]]],
            ],
            'in' => ['$cond' => [
                ['$eq' => ['$$trimmed', '']],
                'Sin valor',
                '$$trimmed',
            ]],
        ]];

        $rows = $this->aggregate([
            ['$match' => $this->buildMatch($datasetId, $filters, $onlyNumeric)],
            ['$group' => [
                '_id' => $categoryExpr,
                'avg_value' => ['$avg' => '$' . $fieldNum],
                'count' => ['$sum' => 1],
            ]],
            ['$sort' => ['count' => -1]],
            ['$limit' => $limit],
            ['$project' => [
                '_id' => 0,
                'categoria' => '$_id',
                'avg_value' => 1,
                'count' => 1,
            ]],
        ]);

        $labels = [];
        $values = [];
        $counts = [];
        $totalCount = 0;
        foreach ($rows as $row) {
            $labels[] = $row['categoria'] ?? 'Sin valor';
            $values[] = round((float) ($row['avg_value'] ?? 0), 2);
            $c = (int) ($row['count'] ?? 0);
            $counts[] = $c;
            $totalCount += $c;
        }

        return [
            'data' => [
                'labels' => $labels,
                'values' => $values,
                'counts' => $counts,
            ],
            'stats' => [
                'count' => $totalCount,
            ],
        ];
    }

    public function getHeatmapData(string $datasetId, string $columnX, string $columnY, int $limit, ?array $filters = null): array
    {
        $colX = $this->sanitizeColumn($columnX);
        $colY = $this->sanitizeColumn($columnY);
        $fieldX = 'data.' . $colX;
        $fieldY = 'data.' . $colY;

        $baseMatch = $this->buildMatch($datasetId, $filters);

        $normExpr = fn(string $field) => ['$let' => [
            'vars' => [
                'trimmed' => ['$trim' => ['input' => ['$toString' => ['$ifNull' => ['$' . $field, '']]]]],
            ],
            'in' => ['$cond' => [
                ['$eq' => ['$$trimmed', '']],
                'Sin valor',
                '$$trimmed',
            ]],
        ]];

        // Labels X (categorías únicas, ordenadas ascendentemente).
        $rowsX = $this->aggregate([
            ['$match' => $baseMatch],
            ['$group' => ['_id' => $normExpr($fieldX)]],
            ['$sort' => ['_id' => 1]],
            ['$limit' => $limit],
        ]);
        $labelsX = array_map(fn($r) => $r['_id'] ?? 'Sin valor', $rowsX);

        // Labels Y.
        $rowsY = $this->aggregate([
            ['$match' => $baseMatch],
            ['$group' => ['_id' => $normExpr($fieldY)]],
            ['$sort' => ['_id' => 1]],
            ['$limit' => $limit],
        ]);
        $labelsY = array_map(fn($r) => $r['_id'] ?? 'Sin valor', $rowsY);

        // Conteos por par (x, y).
        $counts = $this->aggregate([
            ['$match' => $baseMatch],
            ['$group' => [
                '_id' => ['x' => $normExpr($fieldX), 'y' => $normExpr($fieldY)],
                'count' => ['$sum' => 1],
            ]],
        ]);

        $heatmap = [];
        foreach ($counts as $c) {
            $catX = $c['_id']['x'] ?? null;
            $catY = $c['_id']['y'] ?? null;
            $xi = array_search($catX, $labelsX, true);
            $yi = array_search($catY, $labelsY, true);
            if ($xi !== false && $yi !== false) {
                $heatmap[] = [$xi, $yi, (int) ($c['count'] ?? 0)];
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
        $fieldDate = 'data.' . $date;
        $fieldNum = 'data.' . $num;

        $valid = ['$and' => [
            [$fieldDate => ['$type' => 'string', '$regex' => '^[0-9]{4}[-/][0-9]{1,2}[-/][0-9]{1,2}']],
            ['$expr' => ['$isNumber' => '$' . $fieldNum]],
        ]];

        $rows = $this->aggregate([
            ['$match' => $this->buildMatch($datasetId, $filters, $valid)],
            ['$group' => [
                // DATE(data->>?) en Postgres -> normalizamos al prefijo YYYY-MM-DD.
                '_id' => ['$substrBytes' => ['$' . $fieldDate, 0, 10]],
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
        ]);

        $labels = [];
        $values = [];
        $counts = [];
        $totalCount = 0;
        foreach ($rows as $row) {
            $labels[] = $row['fecha'] ?? null;
            $values[] = round((float) ($row['avg_value'] ?? 0), 2);
            $c = (int) ($row['count'] ?? 0);
            $counts[] = $c;
            $totalCount += $c;
        }

        return [
            'data' => [
                'labels' => $labels,
                'values' => $values,
                'counts' => $counts,
            ],
            'stats' => [
                'count' => $totalCount,
                'periods' => count($rows),
            ],
        ];
    }

    public function getStackedBarData(string $datasetId, string $dateColumn, string $catColumn, int $limit, ?array $filters = null): array
    {
        $date = $this->sanitizeColumn($dateColumn);
        $cat = $this->sanitizeColumn($catColumn);
        $fieldDate = 'data.' . $date;
        $fieldCat = 'data.' . $cat;

        $onlyDate = [$fieldDate => ['$type' => 'string', '$regex' => '^[0-9]{4}[-/][0-9]{1,2}[-/][0-9]{1,2}']];
        $baseMatch = $this->buildMatch($datasetId, $filters, $onlyDate);

        $categoryExpr = ['$let' => [
            'vars' => [
                'trimmed' => ['$trim' => ['input' => ['$toString' => ['$ifNull' => ['$' . $fieldCat, '']]]]],
            ],
            'in' => ['$cond' => [
                ['$eq' => ['$$trimmed', '']],
                'Sin valor',
                '$$trimmed',
            ]],
        ]];

        $dateExpr = ['$substrBytes' => ['$' . $fieldDate, 0, 10]];

        // Categorías únicas (máximo 10), ordenadas ascendentemente.
        $catRows = $this->aggregate([
            ['$match' => $baseMatch],
            ['$group' => ['_id' => $categoryExpr]],
            ['$sort' => ['_id' => 1]],
            ['$limit' => 10],
        ]);
        $categories = array_map(fn($r) => $r['_id'] ?? 'Sin valor', $catRows);

        // Fechas únicas (orden cronológico = lexicográfico para 'Y-m-d').
        $dateRows = $this->aggregate([
            ['$match' => $baseMatch],
            ['$group' => ['_id' => $dateExpr]],
            ['$sort' => ['_id' => 1]],
            ['$limit' => $limit],
        ]);
        $dates = array_map(fn($r) => $r['_id'] ?? null, $dateRows);

        // Conteos por (fecha, categoría).
        $countRows = $this->aggregate([
            ['$match' => $baseMatch],
            ['$group' => [
                '_id' => ['fecha' => $dateExpr, 'categoria' => $categoryExpr],
                'count' => ['$sum' => 1],
            ]],
        ]);

        // Indexar conteos: [fecha][categoria] => count.
        $countMap = [];
        $totalCount = 0;
        foreach ($countRows as $row) {
            $fecha = $row['_id']['fecha'] ?? null;
            $catVal = $row['_id']['categoria'] ?? null;
            $c = (int) ($row['count'] ?? 0);
            $countMap[$fecha][$catVal] = $c;
            $totalCount += $c;
        }

        $series = [];
        foreach ($categories as $catVal) {
            $seriesData = [];
            foreach ($dates as $dateVal) {
                $seriesData[] = $countMap[$dateVal][$catVal] ?? 0;
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
                'count' => $totalCount,
                'periods' => count($dates),
                'categories' => count($categories),
            ],
        ];
    }

    public function getWordCloudData(string $datasetId, string $column, int $limit, ?array $filters = null): array
    {
        $col = $this->sanitizeColumn($column);
        $field = 'data.' . $col;

        $maxRecords = config('nlp.max_records', 5000);

        // Recuperar todos los valores de texto de la columna (no nulos).
        $rows = $this->aggregate([
            ['$match' => $this->buildMatch($datasetId, $filters, [$field => ['$ne' => null]])],
            ['$limit' => (int) $maxRecords],
            ['$project' => ['_id' => 0, 'texto' => '$' . $field]],
        ]);
        $texts = array_map(fn($r) => $r['texto'] ?? null, $rows);

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
        $field = 'data.' . $col;

        // Match base: valores no nulos y no vacíos.
        $notEmpty = ['$and' => [
            [$field => ['$ne' => null]],
            ['$expr' => ['$ne' => [['$toString' => '$' . $field], '']]],
        ]];
        $baseMatch = $this->buildMatch($datasetId, $filters, $notEmpty);

        // Contar valores únicos para decidir estrategia.
        $maxCategories = config('nlp.classification.max_categories', 50);
        $uniqueRows = $this->aggregate([
            ['$match' => $baseMatch],
            ['$group' => ['_id' => '$' . $field]],
            ['$count' => 'unique_count'],
        ]);
        $uniqueCount = (int) ($uniqueRows[0]['unique_count'] ?? 0);

        // Si hay pocos valores únicos, usar estadísticas categóricas normales (textos cortos tipo categorías).
        if ($uniqueCount <= $maxCategories) {
            return $this->getCategoricalStats($datasetId, $column, $limit, $filters);
        }

        $maxRecords = config('nlp.max_records', 5000);

        // Para textos diversos/largos: clasificar por keywords dominantes con TF-IDF.
        $rows = $this->aggregate([
            ['$match' => $baseMatch],
            ['$limit' => (int) $maxRecords],
            ['$project' => ['_id' => 0, 'texto' => '$' . $field]],
        ]);
        $texts = array_map(fn($r) => $r['texto'] ?? null, $rows);

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
        $field = 'data.' . $col;

        $maxRecords = config('nlp.max_records', 5000);

        $notEmpty = ['$and' => [
            [$field => ['$ne' => null]],
            ['$expr' => ['$ne' => [['$toString' => '$' . $field], '']]],
        ]];

        $rows = $this->aggregate([
            ['$match' => $this->buildMatch($datasetId, $filters, $notEmpty)],
            ['$limit' => (int) $maxRecords],
            ['$project' => ['_id' => 0, 'texto' => '$' . $field]],
        ]);
        $texts = array_map(fn($r) => $r['texto'] ?? null, $rows);

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
     *
     * NOTA: la tabla `datasets` sigue en PostgreSQL (solo `registros_datos` migró a Mongo),
     * por lo que esta lectura se mantiene sobre el query builder de Postgres.
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
