<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Dataset;
use App\Models\Departamento;
use App\Services\ExcelImportService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use OpenApi\Attributes as OA;

class DatasetController extends Controller
{
    public function __construct(
        protected ExcelImportService $excelImportService
    ) {}

    #[OA\Get(
        path: '/datasets',
        summary: 'Listar datasets',
        description: 'Obtiene la lista de datasets del usuario',
        tags: ['Datasets'],
        security: [['sanctum' => []]],
        parameters: [
            new OA\Parameter(name: 'departamento_id', in: 'query', schema: new OA\Schema(type: 'string', format: 'uuid')),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Lista de datasets'),
        ]
    )]
    public function index(Request $request): JsonResponse
    {
        $query = Dataset::with(['departamento', 'subidoPor', 'variablesMetadatos'])
            ->whereIn('departamento_id', $request->user()->departamentos()->pluck('departamento_id'));

        if ($request->has('departamento_id')) {
            $query->where('departamento_id', $request->departamento_id);
        }

        $datasets = $query->latest()->paginate(15);

        return response()->json($datasets);
    }

    #[OA\Post(
        path: '/datasets',
        summary: 'Crear dataset',
        description: 'Crea un nuevo dataset y sube el archivo Excel',
        tags: ['Datasets'],
        security: [['sanctum' => []]],
        requestBody: new OA\RequestBody(
            required: true,
            content: new OA\MediaType(
                mediaType: 'multipart/form-data',
                schema: new OA\Schema(
                    required: ['departamento_id', 'nombre', 'archivo'],
                    properties: [
                        new OA\Property(property: 'departamento_id', type: 'string', format: 'uuid'),
                        new OA\Property(property: 'nombre', type: 'string'),
                        new OA\Property(property: 'descripcion', type: 'string'),
                        new OA\Property(property: 'archivo', type: 'string', format: 'binary'),
                    ]
                )
            )
        ),
        responses: [
            new OA\Response(response: 201, description: 'Dataset creado'),
            new OA\Response(response: 422, description: 'Error de validación'),
        ]
    )]
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'departamento_id' => 'required|uuid|exists:departamentos,id',
            'nombre' => 'required|string|max:255',
            'descripcion' => 'nullable|string',
            'archivo' => 'required|file|mimes:xlsx,xls,csv|max:10240', // Max 10MB
        ]);

        // Verificar acceso al departamento
        $departamento = Departamento::findOrFail($validated['departamento_id']);
        $userRol = $request->user()->departamentos()
            ->where('departamento_id', $departamento->id)
            ->first()?->pivot?->rol;

        if (!in_array($userRol, ['ADMIN', 'EDITOR'])) {
            return response()->json(['message' => 'No tiene permisos para subir archivos'], 403);
        }

        // Guardar archivo en disco 'datasets'
        $archivo = $request->file('archivo');
        $nombreArchivo = time() . '_' . $archivo->getClientOriginalName();
        $archivo->storeAs('', $nombreArchivo, 'datasets');

        // Crear dataset
        $dataset = Dataset::create([
            'departamento_id' => $validated['departamento_id'],
            'subido_por' => $request->user()->id,
            'nombre' => $validated['nombre'],
            'nombre_archivo' => $nombreArchivo,
            'descripcion' => $validated['descripcion'] ?? null,
            'estado' => 'PENDIENTE',
        ]);

        return response()->json([
            'message' => 'Dataset creado. Proceda a importar los datos.',
            'dataset' => $dataset,
        ], 201);
    }

    #[OA\Get(
        path: '/datasets/{id}',
        summary: 'Obtener dataset',
        description: 'Obtiene un dataset específico con sus metadatos',
        tags: ['Datasets'],
        security: [['sanctum' => []]],
        parameters: [
            new OA\Parameter(name: 'id', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid')),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Dataset encontrado'),
            new OA\Response(response: 404, description: 'No encontrado'),
        ]
    )]
    public function show(Request $request, Dataset $dataset): JsonResponse
    {
        // Verificar acceso
        if (!$request->user()->departamentos()->where('departamento_id', $dataset->departamento_id)->exists()) {
            return response()->json(['message' => 'No autorizado'], 403);
        }

        return response()->json([
            'dataset' => $dataset->load(['departamento', 'subidoPor', 'variablesMetadatos']),
        ]);
    }

    #[OA\Post(
        path: '/datasets/{id}/import',
        summary: 'Analizar archivo Excel',
        description: 'Analiza el archivo Excel y detecta los tipos de columnas',
        tags: ['Datasets'],
        security: [['sanctum' => []]],
        parameters: [
            new OA\Parameter(name: 'id', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid')),
        ],
        responses: [
            new OA\Response(
                response: 200,
                description: 'Análisis completado',
                content: new OA\JsonContent(
                    properties: [
                        new OA\Property(property: 'message', type: 'string'),
                        new OA\Property(property: 'columnas', type: 'array', items: new OA\Items(type: 'object')),
                        new OA\Property(property: 'preview', type: 'array', items: new OA\Items(type: 'object')),
                    ]
                )
            ),
        ]
    )]
    public function import(Request $request, Dataset $dataset): JsonResponse
    {
        // Verificar acceso
        $userRol = $request->user()->departamentos()
            ->where('departamento_id', $dataset->departamento_id)
            ->first()?->pivot?->rol;

        if (!in_array($userRol, ['ADMIN', 'EDITOR'])) {
            return response()->json(['message' => 'No autorizado'], 403);
        }

        if ($dataset->estado !== 'PENDIENTE') {
            return response()->json(['message' => 'Este dataset ya fue procesado'], 400);
        }

        try {
            $dataset->update(['estado' => 'PROCESANDO']);
            
            $resultado = $this->excelImportService->analizar($dataset);

            return response()->json([
                'message' => 'Análisis completado. Revise y confirme los tipos de datos.',
                'columnas' => $resultado['columnas'],
                'preview' => $resultado['preview'],
                'total_filas' => $resultado['total_filas'],
            ]);
        } catch (\Exception $e) {
            $dataset->update(['estado' => 'ERROR']);
            return response()->json(['message' => 'Error al analizar: ' . $e->getMessage()], 500);
        }
    }

    #[OA\Post(
        path: '/datasets/{id}/confirm',
        summary: 'Confirmar importación',
        description: 'Confirma los tipos de datos y procesa la importación completa',
        tags: ['Datasets'],
        security: [['sanctum' => []]],
        parameters: [
            new OA\Parameter(name: 'id', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid')),
        ],
        requestBody: new OA\RequestBody(
            required: true,
            content: new OA\JsonContent(
                required: ['columnas'],
                properties: [
                    new OA\Property(
                        property: 'columnas',
                        type: 'array',
                        items: new OA\Items(
                            properties: [
                                new OA\Property(property: 'nombre_columna', type: 'string'),
                                new OA\Property(property: 'tipo_dato', type: 'string', enum: ['NUMERICO', 'CATEGORICO', 'FECHA', 'TEXTO']),
                                new OA\Property(property: 'es_visible', type: 'boolean'),
                            ]
                        )
                    ),
                ]
            )
        ),
        responses: [
            new OA\Response(response: 200, description: 'Importación completada'),
            new OA\Response(response: 400, description: 'Error en la importación'),
        ]
    )]
    public function confirm(Request $request, Dataset $dataset): JsonResponse
    {
        $validated = $request->validate([
            'columnas' => 'required|array',
            'columnas.*.nombre_columna' => 'required|string',
            'columnas.*.tipo_dato' => 'required|in:NUMERICO,CATEGORICO,FECHA,TEXTO',
            'columnas.*.es_visible' => 'boolean',
        ]);

        try {
            $resultado = $this->excelImportService->importar($dataset, $validated['columnas']);

            return response()->json([
                'message' => 'Importación completada exitosamente',
                'total_registros' => $resultado['total_registros'],
                'dataset' => $dataset->fresh()->load('variablesMetadatos'),
            ]);
        } catch (\Exception $e) {
            $dataset->update(['estado' => 'ERROR']);
            return response()->json(['message' => 'Error en la importación: ' . $e->getMessage()], 500);
        }
    }

    #[OA\Delete(
        path: '/datasets/{id}',
        summary: 'Eliminar dataset',
        description: 'Elimina un dataset y todos sus datos',
        tags: ['Datasets'],
        security: [['sanctum' => []]],
        parameters: [
            new OA\Parameter(name: 'id', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid')),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Dataset eliminado'),
            new OA\Response(response: 403, description: 'No autorizado'),
        ]
    )]
    public function destroy(Request $request, Dataset $dataset): JsonResponse
    {
        $userRol = $request->user()->departamentos()
            ->where('departamento_id', $dataset->departamento_id)
            ->first()?->pivot?->rol;

        if ($userRol !== 'ADMIN') {
            return response()->json(['message' => 'Solo administradores pueden eliminar datasets'], 403);
        }

        // Eliminar archivo físico
        $path = storage_path('app/datasets/' . $dataset->nombre_archivo);
        if (file_exists($path)) {
            unlink($path);
        }

        $dataset->delete();

        return response()->json([
            'message' => 'Dataset eliminado exitosamente',
        ]);
    }
}
