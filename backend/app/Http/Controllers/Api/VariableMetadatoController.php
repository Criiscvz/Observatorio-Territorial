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

    #[OA\Put(
        path: '/variables-metadatos/{id}',
        summary: 'Actualizar variable',
        description: 'Actualiza una variable metadato (tipo, visibilidad, orden)',
        tags: ['Variables Metadatos'],
        security: [['sanctum' => []]],
        parameters: [
            new OA\Parameter(name: 'id', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid')),
        ],
        requestBody: new OA\RequestBody(
            content: new OA\JsonContent(
                properties: [
                    new OA\Property(property: 'tipo_dato', type: 'string', enum: ['NUMERICO', 'CATEGORICO', 'FECHA', 'TEXTO']),
                    new OA\Property(property: 'es_visible', type: 'boolean'),
                    new OA\Property(property: 'orden', type: 'integer'),
                ]
            )
        ),
        responses: [
            new OA\Response(response: 200, description: 'Variable actualizada'),
        ]
    )]
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
