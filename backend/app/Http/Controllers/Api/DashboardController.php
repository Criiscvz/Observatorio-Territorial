<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Departamento;
use App\Models\Dataset;
use App\Models\RegistroDato;
use App\Models\VariableMetadato;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use OpenApi\Attributes as OA;

class DashboardController extends Controller
{
    #[OA\Get(
        path: '/dashboard/{departamento}',
        summary: 'Obtener dashboard de departamento',
        description: 'Obtiene los datos para el dashboard de un departamento',
        tags: ['Dashboard'],
        security: [['sanctum' => []]],
        parameters: [
            new OA\Parameter(name: 'departamento', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid')),
            new OA\Parameter(name: 'dataset_id', in: 'query', schema: new OA\Schema(type: 'string', format: 'uuid')),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Datos del dashboard'),
        ]
    )]
    public function show(Request $request, Departamento $departamento): JsonResponse
    {
        // Verificar acceso
        if (!$request->user()->departamentos()->where('departamento_id', $departamento->id)->exists()) {
            return response()->json(['message' => 'No autorizado'], 403);
        }

        return $this->buildDashboard($departamento, $request->dataset_id);
    }

    #[OA\Get(
        path: '/public/dashboard/{departamento}',
        summary: 'Dashboard público',
        description: 'Obtiene el dashboard de un departamento público (sin autenticación)',
        tags: ['Público'],
        parameters: [
            new OA\Parameter(name: 'departamento', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid')),
            new OA\Parameter(name: 'dataset_id', in: 'query', schema: new OA\Schema(type: 'string', format: 'uuid')),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Dashboard público'),
            new OA\Response(response: 404, description: 'Departamento no público'),
        ]
    )]
    public function publicShow(Departamento $departamento, Request $request): JsonResponse
    {
        if (!$departamento->publico) {
            return response()->json(['message' => 'Departamento no disponible públicamente'], 404);
        }

        return $this->buildDashboard($departamento, $request->dataset_id);
    }

    #[OA\Get(
        path: '/dashboard/{departamento}/stats',
        summary: 'Estadísticas del dashboard',
        description: 'Obtiene estadísticas específicas para gráficos',
        tags: ['Dashboard'],
        security: [['sanctum' => []]],
        parameters: [
            new OA\Parameter(name: 'departamento', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid')),
            new OA\Parameter(name: 'dataset_id', in: 'query', required: true, schema: new OA\Schema(type: 'string', format: 'uuid')),
            new OA\Parameter(name: 'variable', in: 'query', required: true, schema: new OA\Schema(type: 'string')),
            new OA\Parameter(name: 'tipo_grafico', in: 'query', schema: new OA\Schema(type: 'string', enum: ['bar', 'pie', 'line', 'histogram'])),
            new OA\Parameter(name: 'variable_y', in: 'query', schema: new OA\Schema(type: 'string')),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Estadísticas para gráfico'),
        ]
    )]
    public function stats(Request $request, Departamento $departamento): JsonResponse
    {
        $request->validate([
            'dataset_id' => 'required|uuid|exists:datasets,id',
            'variable' => 'required|string',
            'tipo_grafico' => 'sometimes|in:bar,pie,line,histogram,scatter',
            'variable_y' => 'sometimes|string',
        ]);

        $dataset = Dataset::findOrFail($request->dataset_id);
        $variableX = $request->variable;
        $variableY = $request->variable_y;
        $tipoGrafico = $request->tipo_grafico ?? 'bar';

        // Obtener metadatos de la variable
        $metadatoX = VariableMetadato::where('dataset_id', $dataset->id)
            ->where('nombre_columna', $variableX)
            ->first();

        if (!$metadatoX) {
            return response()->json(['message' => 'Variable no encontrada'], 404);
        }

        $estadisticas = $this->calcularEstadisticas($dataset, $metadatoX, $variableY, $tipoGrafico);

        return response()->json([
            'variable' => $variableX,
            'tipo_dato' => $metadatoX->tipo_dato,
            'tipo_grafico' => $tipoGrafico,
            'data' => $estadisticas,
        ]);
    }

    private function buildDashboard(Departamento $departamento, ?string $datasetId): JsonResponse
    {
        $datasetsQuery = $departamento->datasets()->completados();
        
        if ($datasetId) {
            $datasetsQuery->where('id', $datasetId);
        }

        $datasets = $datasetsQuery->with('variablesMetadatos')->get();

        $dashboardData = [];

        foreach ($datasets as $dataset) {
            $variables = $dataset->variablesMetadatos()->visibles()->get();
            
            $charts = [];
            foreach ($variables as $variable) {
                $chartData = $this->generateChartData($dataset, $variable);
                if ($chartData) {
                    $charts[] = $chartData;
                }
            }

            $dashboardData[] = [
                'dataset' => [
                    'id' => $dataset->id,
                    'nombre' => $dataset->nombre,
                    'total_registros' => $dataset->total_registros,
                    'fecha_carga' => $dataset->fecha_carga,
                ],
                'variables' => $variables,
                'charts' => $charts,
            ];
        }

        return response()->json([
            'departamento' => [
                'id' => $departamento->id,
                'nombre' => $departamento->nombre,
            ],
            'dashboards' => $dashboardData,
        ]);
    }

    private function generateChartData(Dataset $dataset, VariableMetadato $variable): ?array
    {
        $columna = $variable->nombre_columna;
        
        switch ($variable->tipo_dato) {
            case 'CATEGORICO':
                return $this->generateCategoricalChartOptimized($dataset, $columna, $variable);
            case 'NUMERICO':
                return $this->generateNumericChartOptimized($dataset, $columna, $variable);
            case 'FECHA':
                return $this->generateTimeSeriesChartOptimized($dataset, $columna, $variable);
            default:
                return null;
        }
    }

    private function generateCategoricalChartOptimized(Dataset $dataset, string $columna, VariableMetadato $variable): array
    {
        // Usar consulta SQL agregada con JSONB para mejor rendimiento
        $frecuencias = DB::table('registros_datos')
            ->select(DB::raw("data->>'$columna' as valor"), DB::raw('COUNT(*) as cantidad'))
            ->where('dataset_id', $dataset->id)
            ->whereNotNull(DB::raw("data->>'$columna'"))
            ->groupBy(DB::raw("data->>'$columna'"))
            ->orderByDesc('cantidad')
            ->limit(20)
            ->get();

        $labels = [];
        $values = [];
        foreach ($frecuencias as $f) {
            $labels[] = $f->valor ?? 'Sin valor';
            $values[] = (int) $f->cantidad;
        }

        return [
            'variable' => $columna,
            'tipo' => 'categorical',
            'chart_type' => count($labels) <= 6 ? 'pie' : 'bar',
            'data' => [
                'labels' => $labels,
                'values' => $values,
            ],
        ];
    }

    private function generateNumericChartOptimized(Dataset $dataset, string $columna, VariableMetadato $variable): array
    {
        // Calcular estadísticas usando SQL agregado
        $stats = DB::table('registros_datos')
            ->select(
                DB::raw("COUNT(*) as count"),
                DB::raw("AVG((data->>'$columna')::numeric) as mean"),
                DB::raw("MIN((data->>'$columna')::numeric) as min"),
                DB::raw("MAX((data->>'$columna')::numeric) as max"),
                DB::raw("SUM((data->>'$columna')::numeric) as sum")
            )
            ->where('dataset_id', $dataset->id)
            ->whereRaw("(data->>'$columna') ~ '^-?[0-9]+(\\.[0-9]+)?$'")
            ->first();

        if (!$stats || $stats->count == 0) {
            return [
                'variable' => $columna,
                'tipo' => 'numeric',
                'chart_type' => 'histogram',
                'data' => [
                    'labels' => [],
                    'values' => [],
                    'stats' => null,
                ],
            ];
        }

        $min = (float) $stats->min;
        $max = (float) $stats->max;
        $bins = 10;
        $range = $max - $min;
        $binWidth = $range > 0 ? $range / $bins : 1;

        // Crear histograma con SQL
        $labels = [];
        $histogram = array_fill(0, $bins, 0);

        for ($i = 0; $i < $bins; $i++) {
            $start = $min + ($i * $binWidth);
            $end = $start + $binWidth;
            $labels[] = number_format($start, 1) . '-' . number_format($end, 1);
        }

        // Obtener distribución por bins
        if ($range > 0) {
            $histData = DB::table('registros_datos')
                ->select(DB::raw("FLOOR(((data->>'$columna')::numeric - $min) / $binWidth) as bin"), DB::raw('COUNT(*) as cnt'))
                ->where('dataset_id', $dataset->id)
                ->whereRaw("(data->>'$columna') ~ '^-?[0-9]+(\\.[0-9]+)?$'")
                ->groupBy('bin')
                ->get();

            foreach ($histData as $h) {
                $binIndex = min((int) $h->bin, $bins - 1);
                if ($binIndex >= 0 && $binIndex < $bins) {
                    $histogram[$binIndex] = (int) $h->cnt;
                }
            }
        } else {
            $histogram[0] = (int) $stats->count;
        }

        // Calcular mediana (aproximación usando percentil)
        $median = DB::table('registros_datos')
            ->select(DB::raw("PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY (data->>'$columna')::numeric) as median"))
            ->where('dataset_id', $dataset->id)
            ->whereRaw("(data->>'$columna') ~ '^-?[0-9]+(\\.[0-9]+)?$'")
            ->first();

        return [
            'variable' => $columna,
            'tipo' => 'numeric',
            'chart_type' => 'histogram',
            'data' => [
                'labels' => $labels,
                'values' => $histogram,
                'stats' => [
                    'count' => (int) $stats->count,
                    'mean' => round((float) $stats->mean, 2),
                    'median' => round((float) ($median->median ?? $stats->mean), 2),
                    'min' => $min,
                    'max' => $max,
                    'sum' => round((float) $stats->sum, 2),
                ],
            ],
        ];
    }

    private function generateTimeSeriesChartOptimized(Dataset $dataset, string $columna, VariableMetadato $variable): array
    {
        // Usar consulta SQL agregada
        $porFecha = DB::table('registros_datos')
            ->select(DB::raw("data->>'$columna' as fecha"), DB::raw('COUNT(*) as cantidad'))
            ->where('dataset_id', $dataset->id)
            ->whereNotNull(DB::raw("data->>'$columna'"))
            ->groupBy(DB::raw("data->>'$columna'"))
            ->orderBy('fecha')
            ->limit(100)
            ->get();

        $labels = [];
        $values = [];
        foreach ($porFecha as $f) {
            $labels[] = $f->fecha;
            $values[] = (int) $f->cantidad;
        }

        return [
            'variable' => $columna,
            'tipo' => 'date',
            'chart_type' => 'line',
            'data' => [
                'labels' => $labels,
                'values' => $values,
            ],
        ];
    }

    private function calcularEstadisticas(Dataset $dataset, VariableMetadato $metadatoX, ?string $variableY, string $tipoGrafico): array
    {
        $columnaX = $metadatoX->nombre_columna;

        if ($variableY && $tipoGrafico === 'scatter') {
            // Gráfico de dispersión bivariable - limitar a 1000 puntos para rendimiento
            $puntos = DB::table('registros_datos')
                ->select(
                    DB::raw("(data->>'$columnaX')::numeric as x"),
                    DB::raw("(data->>'$variableY')::numeric as y")
                )
                ->where('dataset_id', $dataset->id)
                ->whereRaw("(data->>'$columnaX') ~ '^-?[0-9]+(\\.[0-9]+)?$'")
                ->whereRaw("(data->>'$variableY') ~ '^-?[0-9]+(\\.[0-9]+)?$'")
                ->limit(1000)
                ->get();

            $result = [];
            foreach ($puntos as $p) {
                $result[] = [(float) $p->x, (float) $p->y];
            }
            return ['points' => $result];
        }

        if ($variableY) {
            // Agrupación: promedio de Y por cada valor de X usando SQL
            $grupos = DB::table('registros_datos')
                ->select(
                    DB::raw("data->>'$columnaX' as label"),
                    DB::raw("AVG((data->>'$variableY')::numeric) as value"),
                    DB::raw("COUNT(*) as count")
                )
                ->where('dataset_id', $dataset->id)
                ->whereNotNull(DB::raw("data->>'$columnaX'"))
                ->whereRaw("(data->>'$variableY') ~ '^-?[0-9]+(\\.[0-9]+)?$'")
                ->groupBy(DB::raw("data->>'$columnaX'"))
                ->orderByDesc('value')
                ->limit(20)
                ->get();

            $resultado = [];
            foreach ($grupos as $g) {
                $resultado[] = [
                    'label' => $g->label ?? 'Sin valor',
                    'value' => round((float) $g->value, 2),
                    'count' => (int) $g->count,
                ];
            }
            return $resultado;
        }

        // Análisis univariable optimizado
        switch ($metadatoX->tipo_dato) {
            case 'CATEGORICO':
                $frecuencias = DB::table('registros_datos')
                    ->select(DB::raw("data->>'$columnaX' as valor"), DB::raw('COUNT(*) as cantidad'))
                    ->where('dataset_id', $dataset->id)
                    ->whereNotNull(DB::raw("data->>'$columnaX'"))
                    ->groupBy(DB::raw("data->>'$columnaX'"))
                    ->orderByDesc('cantidad')
                    ->limit(20)
                    ->get();

                $labels = [];
                $values = [];
                foreach ($frecuencias as $f) {
                    $labels[] = $f->valor ?? 'Sin valor';
                    $values[] = (int) $f->cantidad;
                }
                return ['labels' => $labels, 'values' => $values];

            case 'NUMERICO':
                $stats = DB::table('registros_datos')
                    ->select(
                        DB::raw("MIN((data->>'$columnaX')::numeric) as min"),
                        DB::raw("MAX((data->>'$columnaX')::numeric) as max")
                    )
                    ->where('dataset_id', $dataset->id)
                    ->whereRaw("(data->>'$columnaX') ~ '^-?[0-9]+(\\.[0-9]+)?$'")
                    ->first();

                if (!$stats || $stats->min === null) {
                    return ['labels' => [], 'values' => []];
                }

                $min = (float) $stats->min;
                $max = (float) $stats->max;
                $bins = 10;
                $range = $max - $min;
                $binWidth = $range > 0 ? $range / $bins : 1;

                $labels = [];
                for ($i = 0; $i < $bins; $i++) {
                    $labels[] = number_format($min + $i * $binWidth, 1);
                }

                $histogram = array_fill(0, $bins, 0);
                if ($range > 0) {
                    $histData = DB::table('registros_datos')
                        ->select(DB::raw("FLOOR(((data->>'$columnaX')::numeric - $min) / $binWidth) as bin"), DB::raw('COUNT(*) as cnt'))
                        ->where('dataset_id', $dataset->id)
                        ->whereRaw("(data->>'$columnaX') ~ '^-?[0-9]+(\\.[0-9]+)?$'")
                        ->groupBy('bin')
                        ->get();

                    foreach ($histData as $h) {
                        $binIndex = min((int) $h->bin, $bins - 1);
                        if ($binIndex >= 0 && $binIndex < $bins) {
                            $histogram[$binIndex] = (int) $h->cnt;
                        }
                    }
                }

                return ['labels' => $labels, 'values' => $histogram];

            default:
                return ['labels' => [], 'values' => []];
        }
    }

    #[OA\Get(
        path: '/datasets/{dataset}/data',
        summary: 'Obtener datos del dataset',
        description: 'Obtiene los registros del dataset con paginación',
        tags: ['Dashboard'],
        security: [['sanctum' => []]],
        parameters: [
            new OA\Parameter(name: 'dataset', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid')),
            new OA\Parameter(name: 'page', in: 'query', schema: new OA\Schema(type: 'integer', default: 1)),
            new OA\Parameter(name: 'per_page', in: 'query', schema: new OA\Schema(type: 'integer', default: 50)),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Datos del dataset'),
        ]
    )]
    public function getDatasetData(Request $request, Dataset $dataset): JsonResponse
    {
        // Verificar acceso
        if (!$request->user()->departamentos()->where('departamento_id', $dataset->departamento_id)->exists()) {
            return response()->json(['message' => 'No autorizado'], 403);
        }

        $perPage = min($request->get('per_page', 50), 100);
        
        $registros = RegistroDato::where('dataset_id', $dataset->id)
            ->paginate($perPage);
        
        $variables = $dataset->variablesMetadatos()->orderBy('orden')->get();

        return response()->json([
            'dataset' => [
                'id' => $dataset->id,
                'nombre' => $dataset->nombre,
                'total_registros' => $dataset->total_registros,
            ],
            'variables' => $variables,
            'data' => $registros->items(),
            'pagination' => [
                'current_page' => $registros->currentPage(),
                'last_page' => $registros->lastPage(),
                'per_page' => $registros->perPage(),
                'total' => $registros->total(),
            ],
        ]);
    }

    #[OA\Put(
        path: '/variables-metadatos/{id}',
        summary: 'Actualizar metadatos de variable',
        description: 'Actualiza el tipo o visibilidad de una variable',
        tags: ['Dashboard'],
        security: [['sanctum' => []]],
        parameters: [
            new OA\Parameter(name: 'id', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid')),
        ],
        requestBody: new OA\RequestBody(
            content: new OA\JsonContent(
                properties: [
                    new OA\Property(property: 'tipo_dato', type: 'string', enum: ['NUMERICO', 'CATEGORICO', 'FECHA', 'TEXTO']),
                    new OA\Property(property: 'es_visible', type: 'boolean'),
                    new OA\Property(property: 'nombre_columna', type: 'string'),
                ]
            )
        ),
        responses: [
            new OA\Response(response: 200, description: 'Variable actualizada'),
        ]
    )]
    public function updateVariable(Request $request, VariableMetadato $variableMetadato): JsonResponse
    {
        $dataset = $variableMetadato->dataset;
        
        // Verificar acceso
        $userRol = $request->user()->departamentos()
            ->where('departamento_id', $dataset->departamento_id)
            ->first()?->pivot?->rol;

        if (!in_array($userRol, ['ADMIN', 'EDITOR'])) {
            return response()->json(['message' => 'No autorizado'], 403);
        }

        $validated = $request->validate([
            'tipo_dato' => 'sometimes|in:NUMERICO,CATEGORICO,FECHA,TEXTO',
            'es_visible' => 'sometimes|boolean',
            'nombre_columna' => 'sometimes|string|max:255',
        ]);

        $variableMetadato->update($validated);

        return response()->json([
            'message' => 'Variable actualizada',
            'variable' => $variableMetadato->fresh(),
        ]);
    }

    #[OA\Post(
        path: '/dashboard/{departamento}/bivariable',
        summary: 'Análisis bivariable',
        description: 'Obtiene análisis de correlación entre dos variables',
        tags: ['Dashboard'],
        security: [['sanctum' => []]],
        parameters: [
            new OA\Parameter(name: 'departamento', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid')),
        ],
        requestBody: new OA\RequestBody(
            required: true,
            content: new OA\JsonContent(
                required: ['dataset_id', 'variable_x', 'variable_y'],
                properties: [
                    new OA\Property(property: 'dataset_id', type: 'string', format: 'uuid'),
                    new OA\Property(property: 'variable_x', type: 'string'),
                    new OA\Property(property: 'variable_y', type: 'string'),
                    new OA\Property(property: 'chart_type', type: 'string', enum: ['bar', 'scatter', 'heatmap', 'grouped_bar']),
                ]
            )
        ),
        responses: [
            new OA\Response(response: 200, description: 'Análisis bivariable'),
        ]
    )]
    public function bivariableAnalysis(Request $request, Departamento $departamento): JsonResponse
    {
        $validated = $request->validate([
            'dataset_id' => 'required|uuid|exists:datasets,id',
            'variable_x' => 'required|string',
            'variable_y' => 'required|string',
            'chart_type' => 'sometimes|in:bar,scatter,heatmap,grouped_bar,stacked_bar',
        ]);

        $dataset = Dataset::findOrFail($validated['dataset_id']);
        $chartType = $validated['chart_type'] ?? 'bar';
        
        $metadatoX = VariableMetadato::where('dataset_id', $dataset->id)
            ->where('nombre_columna', $validated['variable_x'])
            ->first();
        
        $metadatoY = VariableMetadato::where('dataset_id', $dataset->id)
            ->where('nombre_columna', $validated['variable_y'])
            ->first();

        if (!$metadatoX || !$metadatoY) {
            return response()->json(['message' => 'Variables no encontradas'], 404);
        }

        $result = $this->calculateBivariable($dataset->id, $metadatoX, $metadatoY, $chartType);

        return response()->json([
            'variable_x' => $validated['variable_x'],
            'variable_y' => $validated['variable_y'],
            'tipo_x' => $metadatoX->tipo_dato,
            'tipo_y' => $metadatoY->tipo_dato,
            'chart_type' => $chartType,
            'data' => $result,
        ]);
    }

    private function calculateBivariable($datasetId, VariableMetadato $metadatoX, VariableMetadato $metadatoY, string $chartType): array
    {
        $colX = $metadatoX->nombre_columna;
        $colY = $metadatoY->nombre_columna;

        // Scatter plot para dos numéricas
        if ($metadatoX->tipo_dato === 'NUMERICO' && $metadatoY->tipo_dato === 'NUMERICO') {
            // Obtener puntos con SQL (limitado a 1000)
            $puntos = DB::table('registros_datos')
                ->select(
                    DB::raw("(data->>'$colX')::numeric as x"),
                    DB::raw("(data->>'$colY')::numeric as y")
                )
                ->where('dataset_id', $datasetId)
                ->whereRaw("(data->>'$colX') ~ '^-?[0-9]+(\\.[0-9]+)?$'")
                ->whereRaw("(data->>'$colY') ~ '^-?[0-9]+(\\.[0-9]+)?$'")
                ->limit(1000)
                ->get();

            $points = [];
            $xValues = [];
            $yValues = [];
            foreach ($puntos as $p) {
                $points[] = [(float) $p->x, (float) $p->y];
                $xValues[] = (float) $p->x;
                $yValues[] = (float) $p->y;
            }

            // Calcular estadísticas con SQL
            $stats = DB::table('registros_datos')
                ->select(
                    DB::raw("AVG((data->>'$colX')::numeric) as x_mean"),
                    DB::raw("AVG((data->>'$colY')::numeric) as y_mean"),
                    DB::raw("COUNT(*) as count")
                )
                ->where('dataset_id', $datasetId)
                ->whereRaw("(data->>'$colX') ~ '^-?[0-9]+(\\.[0-9]+)?$'")
                ->whereRaw("(data->>'$colY') ~ '^-?[0-9]+(\\.[0-9]+)?$'")
                ->first();
            
            // Calcular correlación de Pearson
            $correlation = $this->pearsonCorrelation($xValues, $yValues);
            
            return [
                'points' => $points,
                'correlation' => $correlation,
                'stats' => [
                    'x_mean' => round((float) ($stats->x_mean ?? 0), 2),
                    'y_mean' => round((float) ($stats->y_mean ?? 0), 2),
                    'count' => (int) ($stats->count ?? 0),
                ],
            ];
        }

        // Categórica vs Numérica: promedio de Y por cada categoría de X
        if ($metadatoX->tipo_dato === 'CATEGORICO' && $metadatoY->tipo_dato === 'NUMERICO') {
            $grupos = DB::table('registros_datos')
                ->select(
                    DB::raw("data->>'$colX' as label"),
                    DB::raw("AVG((data->>'$colY')::numeric) as mean"),
                    DB::raw("MIN((data->>'$colY')::numeric) as min"),
                    DB::raw("MAX((data->>'$colY')::numeric) as max"),
                    DB::raw("COUNT(*) as count")
                )
                ->where('dataset_id', $datasetId)
                ->whereNotNull(DB::raw("data->>'$colX'"))
                ->whereRaw("(data->>'$colY') ~ '^-?[0-9]+(\\.[0-9]+)?$'")
                ->groupBy(DB::raw("data->>'$colX'"))
                ->orderByDesc('mean')
                ->limit(20)
                ->get();

            $labels = [];
            $means = [];
            $mins = [];
            $maxs = [];
            $counts = [];

            foreach ($grupos as $g) {
                $labels[] = $g->label ?? 'Sin valor';
                $means[] = round((float) $g->mean, 2);
                $mins[] = (float) $g->min;
                $maxs[] = (float) $g->max;
                $counts[] = (int) $g->count;
            }

            return [
                'labels' => $labels,
                'values' => $means,
                'min' => $mins,
                'max' => $maxs,
                'counts' => $counts,
            ];
        }

        // Numérica vs Categórica: invertir
        if ($metadatoX->tipo_dato === 'NUMERICO' && $metadatoY->tipo_dato === 'CATEGORICO') {
            return $this->calculateBivariable($datasetId, $metadatoY, $metadatoX, $chartType);
        }

        // Categórica vs Categórica: tabla de contingencia / heatmap
        if ($metadatoX->tipo_dato === 'CATEGORICO' && $metadatoY->tipo_dato === 'CATEGORICO') {
            // Obtener categorías únicas
            $categoriesX = DB::table('registros_datos')
                ->select(DB::raw("DISTINCT data->>'$colX' as val"))
                ->where('dataset_id', $datasetId)
                ->whereNotNull(DB::raw("data->>'$colX'"))
                ->limit(15)
                ->pluck('val')
                ->toArray();

            $categoriesY = DB::table('registros_datos')
                ->select(DB::raw("DISTINCT data->>'$colY' as val"))
                ->where('dataset_id', $datasetId)
                ->whereNotNull(DB::raw("data->>'$colY'"))
                ->limit(15)
                ->pluck('val')
                ->toArray();

            // Obtener conteos cruzados
            $conteos = DB::table('registros_datos')
                ->select(
                    DB::raw("data->>'$colX' as x"),
                    DB::raw("data->>'$colY' as y"),
                    DB::raw("COUNT(*) as cnt")
                )
                ->where('dataset_id', $datasetId)
                ->whereNotNull(DB::raw("data->>'$colX'"))
                ->whereNotNull(DB::raw("data->>'$colY'"))
                ->groupBy(DB::raw("data->>'$colX'"), DB::raw("data->>'$colY'"))
                ->get();

            // Construir matriz de contingencia
            $contingencia = [];
            foreach ($conteos as $c) {
                if (!isset($contingencia[$c->x])) {
                    $contingencia[$c->x] = [];
                }
                $contingencia[$c->x][$c->y] = (int) $c->cnt;
            }

            // Para heatmap
            $heatmapData = [];
            foreach ($categoriesX as $xi => $x) {
                foreach ($categoriesY as $yi => $y) {
                    $heatmapData[] = [$xi, $yi, $contingencia[$x][$y] ?? 0];
                }
            }

            // Para grouped bar
            $series = [];
            foreach ($categoriesY as $y) {
                $data = [];
                foreach ($categoriesX as $x) {
                    $data[] = $contingencia[$x][$y] ?? 0;
                }
                $series[] = [
                    'name' => $y ?? 'Sin valor',
                    'data' => $data,
                ];
            }

            return [
                'labels_x' => $categoriesX,
                'labels_y' => $categoriesY,
                'heatmap' => $heatmapData,
                'series' => $series,
            ];
        }

        return ['labels' => [], 'values' => []];
    }

    private function pearsonCorrelation(array $x, array $y): float
    {
        $n = count($x);
        if ($n !== count($y) || $n < 2) {
            return 0;
        }

        $sumX = array_sum($x);
        $sumY = array_sum($y);
        $sumXY = 0;
        $sumX2 = 0;
        $sumY2 = 0;

        for ($i = 0; $i < $n; $i++) {
            $sumXY += $x[$i] * $y[$i];
            $sumX2 += $x[$i] * $x[$i];
            $sumY2 += $y[$i] * $y[$i];
        }

        $numerator = ($n * $sumXY) - ($sumX * $sumY);
        $denominator = sqrt((($n * $sumX2) - ($sumX * $sumX)) * (($n * $sumY2) - ($sumY * $sumY)));

        if ($denominator == 0) {
            return 0;
        }

        return round($numerator / $denominator, 4);
    }
}
