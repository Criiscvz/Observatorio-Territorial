<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\VariableMetadato;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use OpenApi\Attributes as OA;

class VariableMetadatoController extends Controller
{
    #[OA\Get(
        path: '/variables-metadatos',
        summary: 'Listar variables metadatos',
        description: 'Obtiene las variables de un dataset',
        tags: ['Variables Metadatos'],
        security: [['sanctum' => []]],
        parameters: [
            new OA\Parameter(name: 'dataset_id', in: 'query', required: true, schema: new OA\Schema(type: 'string', format: 'uuid')),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Lista de variables'),
        ]
    )]
    public function index(Request $request): JsonResponse
    {
        $request->validate([
            'dataset_id' => 'required|uuid|exists:datasets,id',
        ]);

        $variables = VariableMetadato::where('dataset_id', $request->dataset_id)
            ->orderBy('orden')
            ->get();

        return response()->json([
            'variables' => $variables,
        ]);
    }

    #[OA\Get(
        path: '/variables-metadatos/{id}',
        summary: 'Obtener variable',
        description: 'Obtiene una variable específica',
        tags: ['Variables Metadatos'],
        security: [['sanctum' => []]],
        parameters: [
            new OA\Parameter(name: 'id', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid')),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Variable encontrada'),
        ]
    )]
    public function show(VariableMetadato $variableMetadato): JsonResponse
    {
        return response()->json([
            'variable' => $variableMetadato->load('dataset'),
        ]);
    }

    /**
     * Actualizar variable (método legacy - usar DashboardController::updateVariable)
     */
    public function update(Request $request, VariableMetadato $variableMetadato): JsonResponse
    {
        $validated = $request->validate([
            'tipo_dato' => 'sometimes|in:NUMERICO,CATEGORICO,FECHA,TEXTO',
            'es_visible' => 'boolean',
            'orden' => 'integer|min:0',
        ]);

        $variableMetadato->update($validated);

        return response()->json([
            'message' => 'Variable actualizada',
            'variable' => $variableMetadato->fresh(),
        ]);
    }
}
