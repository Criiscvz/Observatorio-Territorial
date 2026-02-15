<?php

declare(strict_types=1);

namespace App\Presentation\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Infrastructure\Persistence\Eloquent\Models\GraficoPredeterminadoModel;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use OpenApi\Attributes as OA;

#[OA\Tag(name: 'Gráficos Predeterminados', description: 'Gestión de gráficos predeterminados')]
class GraficoPredeterminadoController extends Controller
{
    #[OA\Get(
        path: '/datasets/{datasetId}/graficos-predeterminados',
        summary: 'Listar gráficos predeterminados de un dataset',
        tags: ['Gráficos Predeterminados'],
        parameters: [
            new OA\Parameter(name: 'datasetId', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid'))
        ],
        responses: [
            new OA\Response(response: 200, description: 'Lista de gráficos predeterminados')
        ]
    )]
    public function index(string $datasetId): JsonResponse
    {
        $graficos = GraficoPredeterminadoModel::where('dataset_id', $datasetId)
            ->where('activo', true)
            ->with(['variableX:id,nombre_columna,nombre_original,tipo_dato', 'variableY:id,nombre_columna,nombre_original,tipo_dato'])
            ->orderBy('orden')
            ->get();

        return response()->json($graficos);
    }

    #[OA\Post(
        path: '/datasets/{datasetId}/graficos-predeterminados',
        summary: 'Crear gráfico predeterminado',
        security: [['sanctum' => []]],
        tags: ['Gráficos Predeterminados'],
        parameters: [
            new OA\Parameter(name: 'datasetId', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid'))
        ],
        requestBody: new OA\RequestBody(
            required: true,
            content: new OA\JsonContent(
                required: ['titulo', 'tipo_grafico', 'tipo_analisis', 'variable_x_id'],
                properties: [
                    new OA\Property(property: 'titulo', type: 'string'),
                    new OA\Property(property: 'descripcion', type: 'string'),
                    new OA\Property(property: 'tipo_grafico', type: 'string'),
                    new OA\Property(property: 'tipo_analisis', type: 'string', enum: ['univariable', 'bivariable']),
                    new OA\Property(property: 'variable_x_id', type: 'string', format: 'uuid'),
                    new OA\Property(property: 'variable_y_id', type: 'string', format: 'uuid'),
                    new OA\Property(property: 'filtros', type: 'object'),
                    new OA\Property(property: 'configuracion', type: 'object'),
                    new OA\Property(property: 'orden', type: 'integer')
                ]
            )
        ),
        responses: [
            new OA\Response(response: 201, description: 'Gráfico creado'),
            new OA\Response(response: 422, description: 'Validación fallida')
        ]
    )]
    public function store(Request $request, string $datasetId): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'titulo' => 'required|string|max:255',
            'descripcion' => 'nullable|string|max:1000',
            'tipo_grafico' => 'required|string|max:50',
            'tipo_analisis' => 'required|string|in:univariable,bivariable',
            'variable_x_id' => 'required|uuid|exists:variables_metadatos,id',
            'variable_y_id' => 'nullable|uuid|exists:variables_metadatos,id',
            'filtros' => 'nullable|array',
            'configuracion' => 'nullable|array',
            'orden' => 'nullable|integer|min:0',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Datos de validación inválidos',
                'errors' => $validator->errors(),
            ], 422);
        }

        $data = $validator->validated();
        $data['dataset_id'] = $datasetId;
        $data['creado_por'] = $request->user()->id;
        $data['activo'] = true;

        $grafico = GraficoPredeterminadoModel::create($data);

        return response()->json($grafico->load(['variableX', 'variableY']), 201);
    }

    #[OA\Put(
        path: '/graficos-predeterminados/{id}',
        summary: 'Actualizar gráfico predeterminado',
        security: [['sanctum' => []]],
        tags: ['Gráficos Predeterminados'],
        parameters: [
            new OA\Parameter(name: 'id', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid'))
        ],
        responses: [
            new OA\Response(response: 200, description: 'Gráfico actualizado'),
            new OA\Response(response: 404, description: 'No encontrado')
        ]
    )]
    public function update(Request $request, string $id): JsonResponse
    {
        $grafico = GraficoPredeterminadoModel::find($id);

        if (!$grafico) {
            return response()->json(['message' => 'Gráfico no encontrado'], 404);
        }

        $validator = Validator::make($request->all(), [
            'titulo' => 'sometimes|string|max:255',
            'descripcion' => 'nullable|string|max:1000',
            'tipo_grafico' => 'sometimes|string|max:50',
            'tipo_analisis' => 'sometimes|string|in:univariable,bivariable',
            'variable_x_id' => 'sometimes|uuid|exists:variables_metadatos,id',
            'variable_y_id' => 'nullable|uuid|exists:variables_metadatos,id',
            'filtros' => 'nullable|array',
            'configuracion' => 'nullable|array',
            'orden' => 'nullable|integer|min:0',
            'activo' => 'sometimes|boolean',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Datos de validación inválidos',
                'errors' => $validator->errors(),
            ], 422);
        }

        $grafico->update($validator->validated());

        return response()->json($grafico->load(['variableX', 'variableY']));
    }

    #[OA\Delete(
        path: '/graficos-predeterminados/{id}',
        summary: 'Eliminar gráfico predeterminado',
        security: [['sanctum' => []]],
        tags: ['Gráficos Predeterminados'],
        parameters: [
            new OA\Parameter(name: 'id', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid'))
        ],
        responses: [
            new OA\Response(response: 200, description: 'Gráfico eliminado'),
            new OA\Response(response: 404, description: 'No encontrado')
        ]
    )]
    public function destroy(string $id): JsonResponse
    {
        $grafico = GraficoPredeterminadoModel::find($id);

        if (!$grafico) {
            return response()->json(['message' => 'Gráfico no encontrado'], 404);
        }

        $grafico->delete();

        return response()->json(['message' => 'Gráfico eliminado exitosamente']);
    }
}
