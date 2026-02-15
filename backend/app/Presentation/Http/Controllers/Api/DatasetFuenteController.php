<?php

declare(strict_types=1);

namespace App\Presentation\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Infrastructure\Persistence\Eloquent\Models\DatasetFuenteModel;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use OpenApi\Attributes as OA;

#[OA\Tag(name: 'Fuentes', description: 'Fuentes de datos de datasets')]
class DatasetFuenteController extends Controller
{
    #[OA\Get(
        path: '/datasets/{datasetId}/fuentes',
        summary: 'Listar fuentes de un dataset',
        tags: ['Fuentes'],
        parameters: [
            new OA\Parameter(name: 'datasetId', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid'))
        ],
        responses: [
            new OA\Response(response: 200, description: 'Lista de fuentes')
        ]
    )]
    public function index(string $datasetId): JsonResponse
    {
        $fuentes = DatasetFuenteModel::where('dataset_id', $datasetId)
            ->orderBy('orden')
            ->get();

        return response()->json($fuentes);
    }

    #[OA\Post(
        path: '/datasets/{datasetId}/fuentes',
        summary: 'Agregar fuente al dataset',
        security: [['sanctum' => []]],
        tags: ['Fuentes'],
        parameters: [
            new OA\Parameter(name: 'datasetId', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid'))
        ],
        requestBody: new OA\RequestBody(
            required: true,
            content: new OA\JsonContent(
                required: ['titulo', 'url'],
                properties: [
                    new OA\Property(property: 'titulo', type: 'string'),
                    new OA\Property(property: 'url', type: 'string', format: 'url'),
                    new OA\Property(property: 'descripcion', type: 'string'),
                    new OA\Property(property: 'orden', type: 'integer')
                ]
            )
        ),
        responses: [
            new OA\Response(response: 201, description: 'Fuente creada'),
            new OA\Response(response: 422, description: 'Validación fallida')
        ]
    )]
    public function store(Request $request, string $datasetId): JsonResponse
    {
        // Normalize URL: add https:// if no protocol specified
        $input = $request->all();
        if (!empty($input['url']) && !preg_match('#^https?://#i', $input['url'])) {
            $input['url'] = 'https://' . $input['url'];
        }

        $validator = Validator::make($input, [
            'titulo' => 'required|string|max:255',
            'url' => 'required|url|max:500',
            'descripcion' => 'nullable|string|max:500',
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

        $fuente = DatasetFuenteModel::create($data);

        return response()->json($fuente, 201);
    }

    #[OA\Put(
        path: '/fuentes/{id}',
        summary: 'Actualizar fuente',
        security: [['sanctum' => []]],
        tags: ['Fuentes'],
        parameters: [
            new OA\Parameter(name: 'id', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid'))
        ],
        responses: [
            new OA\Response(response: 200, description: 'Fuente actualizada'),
            new OA\Response(response: 404, description: 'No encontrada')
        ]
    )]
    public function update(Request $request, string $id): JsonResponse
    {
        $fuente = DatasetFuenteModel::find($id);

        if (!$fuente) {
            return response()->json(['message' => 'Fuente no encontrada'], 404);
        }

        // Normalize URL: add https:// if no protocol specified
        $input = $request->all();
        if (!empty($input['url']) && !preg_match('#^https?://#i', $input['url'])) {
            $input['url'] = 'https://' . $input['url'];
        }

        $validator = Validator::make($input, [
            'titulo' => 'sometimes|string|max:255',
            'url' => 'sometimes|url|max:500',
            'descripcion' => 'nullable|string|max:500',
            'orden' => 'nullable|integer|min:0',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Datos de validación inválidos',
                'errors' => $validator->errors(),
            ], 422);
        }

        $fuente->update($validator->validated());

        return response()->json($fuente);
    }

    #[OA\Delete(
        path: '/fuentes/{id}',
        summary: 'Eliminar fuente',
        security: [['sanctum' => []]],
        tags: ['Fuentes'],
        parameters: [
            new OA\Parameter(name: 'id', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid'))
        ],
        responses: [
            new OA\Response(response: 200, description: 'Fuente eliminada'),
            new OA\Response(response: 404, description: 'No encontrada')
        ]
    )]
    public function destroy(string $id): JsonResponse
    {
        $fuente = DatasetFuenteModel::find($id);

        if (!$fuente) {
            return response()->json(['message' => 'Fuente no encontrada'], 404);
        }

        $fuente->delete();

        return response()->json(['message' => 'Fuente eliminada exitosamente']);
    }
}
