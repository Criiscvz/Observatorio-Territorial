<?php

namespace App\Presentation\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Infrastructure\Persistence\Eloquent\Models\DepartamentoModel as Departamento;
use App\Infrastructure\Persistence\Eloquent\Models\DatasetModel as Dataset;
use App\Infrastructure\Persistence\Eloquent\Models\RegistroDatoModel as RegistroDato;
use App\Infrastructure\Persistence\Eloquent\Models\VariableMetadatoModel as VariableMetadato;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Controlador para endpoints públicos (sin autenticación)
 */
class PublicController extends Controller
{
    /**
     * Lista de departamentos públicos
     */
    public function departamentos()
    {
        $departamentos = Departamento::where('publico', true)
            ->withCount('datasets')
            ->with(['datasets' => function ($q) {
                $q->select('id', 'nombre', 'departamento_id', 'total_registros', 'created_at')
                    ->orderBy('created_at', 'desc')
                    ->limit(5);
            }])
            ->orderBy('nombre')
            ->get();

        return response()->json($departamentos);
    }

    /**
     * Detalle de un departamento público
     */
    public function departamento(string $id)
    {
        $departamento = Departamento::where('publico', true)
            ->where('id', $id)
            ->with(['datasets' => function ($q) {
                $q->select('id', 'nombre', 'departamento_id', 'total_registros', 'created_at')
                    ->with(['variablesMetadatos' => function ($q2) {
                        $q2->select('id', 'dataset_id', 'nombre_original', 'nombre_columna', 'tipo_dato')
                            ->where('es_visible', true);
                    }])
                    ->orderBy('created_at', 'desc');
            }])
            ->first();

        if (!$departamento) {
            return response()->json(['message' => 'Departamento no encontrado o no público'], 404);
        }

        return response()->json($departamento);
    }

    /**
     * Datos de un dataset público
     */
    public function datasetData(string $id, Request $request)
    {
        // Verificar que el dataset pertenece a un departamento público
        $dataset = Dataset::with(['departamento', 'variablesMetadatos'])
            ->whereHas('departamento', fn($q) => $q->where('publico', true))
            ->find($id);

        if (!$dataset) {
            return response()->json(['message' => 'Dataset no encontrado o no público'], 404);
        }

        $page = $request->input('page', 1);
        $perPage = min($request->input('per_page', 50), 100);

        $registros = RegistroDato::where('dataset_id', $id)
            ->orderBy('id')
            ->paginate($perPage, ['*'], 'page', $page);

        return response()->json([
            'dataset' => [
                'id' => $dataset->id,
                'nombre' => $dataset->nombre,
                'total_registros' => $dataset->total_registros,
                'departamento_id' => $dataset->departamento_id,
            ],
            'variables' => $dataset->variablesMetadatos->where('es_visible', true)->values(),
            'data' => $registros->map(fn($r) => [
                'id' => $r->id,
                'data' => $r->data,
            ]),
            'pagination' => [
                'current_page' => $registros->currentPage(),
                'last_page' => $registros->lastPage(),
                'per_page' => $registros->perPage(),
                'total' => $registros->total(),
            ]
        ]);
    }

    /**
     * Estadísticas univariables públicas
     */
    public function univariable(Request $request)
    {
        $request->validate([
            'dataset_id' => 'required|string',
            'variable_id' => 'required|string',
            'chart_type' => 'nullable|string',
            'limit' => 'nullable|integer|min:1|max:100',
        ]);

        // Verificar que el dataset es público
        $dataset = Dataset::whereHas('departamento', fn($q) => $q->where('publico', true))
            ->find($request->dataset_id);

        if (!$dataset) {
            return response()->json(['message' => 'Dataset no público o no encontrado'], 404);
        }

        $variable = VariableMetadato::where('dataset_id', $request->dataset_id)
            ->find($request->variable_id);

        if (!$variable) {
            return response()->json(['message' => 'Variable no encontrada'], 404);
        }

        $tipo = $variable->tipo_dato;
        $columna = $variable->nombre_columna;
        $limit = $request->input('limit', 20);

        // Obtener estadísticas según tipo
        if ($tipo === 'NUMERICO') {
            return $this->getNumericStats($dataset->id, $columna, $variable, $limit);
        } else {
            return $this->getCategoricalStats($dataset->id, $columna, $variable, $limit);
        }
    }

    /**
     * Estadísticas bivariables públicas
     */
    public function bivariable(Request $request)
    {
        $request->validate([
            'dataset_id' => 'required|string',
            'variable_x_id' => 'required|string',
            'variable_y_id' => 'required|string',
            'chart_type' => 'nullable|string',
            'limit' => 'nullable|integer|min:1|max:100',
        ]);

        // Verificar que el dataset es público
        $dataset = Dataset::whereHas('departamento', fn($q) => $q->where('publico', true))
            ->find($request->dataset_id);

        if (!$dataset) {
            return response()->json(['message' => 'Dataset no público o no encontrado'], 404);
        }

        $varX = VariableMetadato::where('dataset_id', $request->dataset_id)->find($request->variable_x_id);
        $varY = VariableMetadato::where('dataset_id', $request->dataset_id)->find($request->variable_y_id);

        if (!$varX || !$varY) {
            return response()->json(['message' => 'Variable no encontrada'], 404);
        }

        $limit = $request->input('limit', 20);

        // Normalizar tipos: TEXTO se trata como CATEGORICO para análisis
        $tipoX = $this->normalizeTipo($varX->tipo_dato);
        $tipoY = $this->normalizeTipo($varY->tipo_dato);

        // Ambas numéricas -> scatter
        if ($tipoX === 'NUMERICO' && $tipoY === 'NUMERICO') {
            return $this->getScatterData($dataset->id, $varX, $varY, $limit);
        }

        // Una categórica/texto, una numérica -> grouped bar
        if (($tipoX === 'CATEGORICO' && $tipoY === 'NUMERICO') ||
            ($tipoX === 'NUMERICO' && $tipoY === 'CATEGORICO')
        ) {
            return $this->getGroupedBarData($dataset->id, $varX, $varY, $limit);
        }

        // Ambas categóricas/texto -> heatmap
        if ($tipoX === 'CATEGORICO' && $tipoY === 'CATEGORICO') {
            return $this->getHeatmapData($dataset->id, $varX, $varY, $limit);
        }

        // FECHA + NUMERICO -> serie temporal
        if (($tipoX === 'FECHA' && $tipoY === 'NUMERICO') ||
            ($tipoX === 'NUMERICO' && $tipoY === 'FECHA')
        ) {
            return $this->getTimeSeriesData($dataset->id, $varX, $varY, $limit);
        }

        // FECHA + CATEGORICO -> evolución temporal por categoría
        if (($tipoX === 'FECHA' && $tipoY === 'CATEGORICO') ||
            ($tipoX === 'CATEGORICO' && $tipoY === 'FECHA')
        ) {
            return $this->getStackedBarData($dataset->id, $varX, $varY, $limit);
        }

        // FECHA + FECHA -> línea temporal
        if ($tipoX === 'FECHA' && $tipoY === 'FECHA') {
            return $this->getTimeSeriesData($dataset->id, $varX, $varY, $limit);
        }

        return response()->json(['message' => 'Combinación de tipos no soportada'], 400);
    }

    /**
     * Normaliza el tipo de dato para análisis
     * TEXTO se trata como CATEGORICO
     */
    private function normalizeTipo(string $tipo): string
    {
        return $tipo === 'TEXTO' ? 'CATEGORICO' : $tipo;
    }

    // ============== MÉTODOS PRIVADOS ==============

    private function getNumericStats($datasetId, $columna, $variable, $limit)
    {
        $stats = DB::table('registros_datos')
            ->where('dataset_id', $datasetId)
            ->selectRaw("
                COUNT(*) as count,
                AVG((data->>'$columna')::numeric) as mean,
                MIN((data->>'$columna')::numeric) as min,
                MAX((data->>'$columna')::numeric) as max,
                SUM((data->>'$columna')::numeric) as sum
            ")
            ->first();

        // Histograma
        $min = $stats->min ?? 0;
        $max = $stats->max ?? 1;
        $range = $max - $min;
        $bins = min(20, max(5, (int)sqrt($stats->count ?? 10)));
        $binSize = $range > 0 ? $range / $bins : 1;

        $histogram = DB::table('registros_datos')
            ->where('dataset_id', $datasetId)
            ->selectRaw("
                FLOOR(((data->>'$columna')::numeric - $min) / $binSize) as bin,
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
            $values[] = (int)$h->count;
        }

        return response()->json([
            'variable_id' => $variable->id,
            'nombre_variable' => $variable->nombre_original,
            'tipo_variable' => 'NUMERICO',
            'chart_type' => 'histogram',
            'data' => [
                'labels' => $labels,
                'values' => $values,
            ],
            'stats' => [
                'count' => (int)($stats->count ?? 0),
                'mean' => round($stats->mean ?? 0, 2),
                'min' => round($stats->min ?? 0, 2),
                'max' => round($stats->max ?? 0, 2),
                'sum' => round($stats->sum ?? 0, 2),
            ]
        ]);
    }

    private function getCategoricalStats($datasetId, $columna, $variable, $limit)
    {
        $data = DB::table('registros_datos')
            ->where('dataset_id', $datasetId)
            ->selectRaw("data->>'$columna' as categoria, COUNT(*) as count")
            ->groupBy('categoria')
            ->orderByDesc('count')
            ->limit($limit)
            ->get();

        return response()->json([
            'variable_id' => $variable->id,
            'nombre_variable' => $variable->nombre_original,
            'tipo_variable' => $variable->tipo_dato,
            'chart_type' => 'bar',
            'data' => [
                'labels' => $data->pluck('categoria')->toArray(),
                'values' => $data->pluck('count')->map(fn($v) => (int)$v)->toArray(),
            ],
            'stats' => [
                'count' => $data->sum('count'),
                'unique' => $data->count(),
            ]
        ]);
    }

    private function getScatterData($datasetId, $varX, $varY, $limit)
    {
        $colX = $varX->nombre_columna;
        $colY = $varY->nombre_columna;

        $points = DB::table('registros_datos')
            ->where('dataset_id', $datasetId)
            ->selectRaw("(data->>'$colX')::numeric as x, (data->>'$colY')::numeric as y")
            ->whereNotNull(DB::raw("data->>'$colX'"))
            ->whereNotNull(DB::raw("data->>'$colY'"))
            ->limit(1000)
            ->get()
            ->map(fn($p) => [(float)$p->x, (float)$p->y])
            ->toArray();

        // Calcular correlación simple
        $n = count($points);
        $correlation = null;
        if ($n > 2) {
            $sumX = array_sum(array_column($points, 0));
            $sumY = array_sum(array_column($points, 1));
            $sumXY = array_sum(array_map(fn($p) => $p[0] * $p[1], $points));
            $sumX2 = array_sum(array_map(fn($p) => $p[0] ** 2, $points));
            $sumY2 = array_sum(array_map(fn($p) => $p[1] ** 2, $points));

            $num = ($n * $sumXY) - ($sumX * $sumY);
            $den = sqrt((($n * $sumX2) - ($sumX ** 2)) * (($n * $sumY2) - ($sumY ** 2)));
            $correlation = $den > 0 ? round($num / $den, 3) : 0;
        }

        return response()->json([
            'variable_x_id' => $varX->id,
            'variable_y_id' => $varY->id,
            'nombre_variable_x' => $varX->nombre_original,
            'nombre_variable_y' => $varY->nombre_original,
            'chart_type' => 'scatter',
            'data' => [
                'points' => $points,
                'correlation' => $correlation,
            ],
            'stats' => [
                'count' => $n,
                'correlation' => $correlation,
            ]
        ]);
    }

    private function getGroupedBarData($datasetId, $varX, $varY, $limit)
    {
        // Determinar cuál es categórica y cuál numérica
        if ($varX->tipo_dato === 'CATEGORICO') {
            $catVar = $varX;
            $numVar = $varY;
        } else {
            $catVar = $varY;
            $numVar = $varX;
        }

        $colCat = $catVar->nombre_columna;
        $colNum = $numVar->nombre_columna;

        $data = DB::table('registros_datos')
            ->where('dataset_id', $datasetId)
            ->selectRaw("
                data->>'$colCat' as categoria,
                AVG((data->>'$colNum')::numeric) as avg_value,
                COUNT(*) as count
            ")
            ->groupBy('categoria')
            ->orderByDesc('count')
            ->limit($limit)
            ->get();

        return response()->json([
            'variable_x_id' => $varX->id,
            'variable_y_id' => $varY->id,
            'nombre_variable_x' => $varX->nombre_original,
            'nombre_variable_y' => $varY->nombre_original,
            'chart_type' => 'grouped_bar',
            'data' => [
                'categories' => $data->pluck('categoria')->toArray(),
                'labels' => $data->pluck('categoria')->toArray(),
                'values' => $data->pluck('avg_value')->map(fn($v) => round((float)$v, 2))->toArray(),
                'counts' => $data->pluck('count')->map(fn($v) => (int)$v)->toArray(),
            ],
            'stats' => [
                'count' => $data->sum('count'),
            ]
        ]);
    }

    private function getHeatmapData($datasetId, $varX, $varY, $limit)
    {
        $colX = $varX->nombre_columna;
        $colY = $varY->nombre_columna;

        // Obtener categorías únicas
        $labelsX = DB::table('registros_datos')
            ->where('dataset_id', $datasetId)
            ->selectRaw("DISTINCT data->>'$colX' as cat")
            ->orderBy('cat')
            ->limit($limit)
            ->pluck('cat')
            ->toArray();

        $labelsY = DB::table('registros_datos')
            ->where('dataset_id', $datasetId)
            ->selectRaw("DISTINCT data->>'$colY' as cat")
            ->orderBy('cat')
            ->limit($limit)
            ->pluck('cat')
            ->toArray();

        // Matriz de frecuencias
        $heatmap = [];
        $counts = DB::table('registros_datos')
            ->where('dataset_id', $datasetId)
            ->selectRaw("data->>'$colX' as cat_x, data->>'$colY' as cat_y, COUNT(*) as count")
            ->groupBy('cat_x', 'cat_y')
            ->get();

        foreach ($counts as $c) {
            $xi = array_search($c->cat_x, $labelsX);
            $yi = array_search($c->cat_y, $labelsY);
            if ($xi !== false && $yi !== false) {
                $heatmap[] = [$xi, $yi, (int)$c->count];
            }
        }

        return response()->json([
            'variable_x_id' => $varX->id,
            'variable_y_id' => $varY->id,
            'nombre_variable_x' => $varX->nombre_original,
            'nombre_variable_y' => $varY->nombre_original,
            'chart_type' => 'heatmap',
            'data' => [
                'labels_x' => $labelsX,
                'labels_y' => $labelsY,
                'heatmap' => $heatmap,
            ],
            'stats' => [
                'count' => array_sum(array_column($heatmap, 2)),
            ]
        ]);
    }

    /**
     * Genera datos para gráfico de serie temporal
     * FECHA + NUMERICO -> línea temporal con promedio por periodo
     */
    private function getTimeSeriesData($datasetId, $varX, $varY, $limit)
    {
        // Determinar cuál es fecha y cuál numérica
        if ($varX->tipo_dato === 'FECHA') {
            $dateVar = $varX;
            $numVar = $varY;
        } else {
            $dateVar = $varY;
            $numVar = $varX;
        }

        $colDate = $dateVar->nombre_columna;
        $colNum = $numVar->nombre_columna;

        // Agrupar por fecha y calcular promedio
        $data = DB::table('registros_datos')
            ->where('dataset_id', $datasetId)
            ->selectRaw("
                DATE(data->>'$colDate') as fecha,
                AVG((data->>'$colNum')::numeric) as avg_value,
                COUNT(*) as count
            ")
            ->whereNotNull(DB::raw("data->>'$colDate'"))
            ->whereNotNull(DB::raw("data->>'$colNum'"))
            ->groupBy('fecha')
            ->orderBy('fecha')
            ->limit($limit)
            ->get();

        return response()->json([
            'variable_x_id' => $varX->id,
            'variable_y_id' => $varY->id,
            'nombre_variable_x' => $varX->nombre_original,
            'nombre_variable_y' => $varY->nombre_original,
            'chart_type' => 'line_time',
            'data' => [
                'labels' => $data->pluck('fecha')->toArray(),
                'values' => $data->pluck('avg_value')->map(fn($v) => round((float)$v, 2))->toArray(),
                'counts' => $data->pluck('count')->map(fn($v) => (int)$v)->toArray(),
            ],
            'stats' => [
                'count' => $data->sum('count'),
                'periods' => $data->count(),
            ]
        ]);
    }

    /**
     * Genera datos para gráfico de barras apiladas
     * FECHA + CATEGORICO -> evolución temporal por categoría
     */
    private function getStackedBarData($datasetId, $varX, $varY, $limit)
    {
        // Determinar cuál es fecha y cuál categórica
        if ($varX->tipo_dato === 'FECHA') {
            $dateVar = $varX;
            $catVar = $varY;
        } else {
            $dateVar = $varY;
            $catVar = $varX;
        }

        $colDate = $dateVar->nombre_columna;
        $colCat = $catVar->nombre_columna;

        // Obtener categorías únicas
        $categories = DB::table('registros_datos')
            ->where('dataset_id', $datasetId)
            ->selectRaw("DISTINCT data->>'$colCat' as cat")
            ->orderBy('cat')
            ->limit(10)
            ->pluck('cat')
            ->toArray();

        // Obtener fechas únicas
        $dates = DB::table('registros_datos')
            ->where('dataset_id', $datasetId)
            ->selectRaw("DISTINCT DATE(data->>'$colDate') as fecha")
            ->orderBy('fecha')
            ->limit($limit)
            ->pluck('fecha')
            ->toArray();

        // Contar por fecha y categoría
        $counts = DB::table('registros_datos')
            ->where('dataset_id', $datasetId)
            ->selectRaw("DATE(data->>'$colDate') as fecha, data->>'$colCat' as categoria, COUNT(*) as count")
            ->groupBy('fecha', 'categoria')
            ->get();

        // Construir series por categoría
        $series = [];
        foreach ($categories as $cat) {
            $seriesData = [];
            foreach ($dates as $date) {
                $count = $counts->where('fecha', $date)->where('categoria', $cat)->first();
                $seriesData[] = $count ? (int)$count->count : 0;
            }
            $series[] = [
                'name' => $cat ?? 'Sin valor',
                'data' => $seriesData,
            ];
        }

        return response()->json([
            'variable_x_id' => $varX->id,
            'variable_y_id' => $varY->id,
            'nombre_variable_x' => $varX->nombre_original,
            'nombre_variable_y' => $varY->nombre_original,
            'chart_type' => 'stacked_bar',
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
            ]
        ]);
    }
}
