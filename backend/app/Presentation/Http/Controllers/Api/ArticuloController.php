<?php

declare(strict_types=1);

namespace App\Presentation\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Infrastructure\Persistence\Eloquent\Models\ArticuloModel;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use OpenApi\Attributes as OA;

#[OA\Tag(name: 'Artículos', description: 'Artículos de contenido del observatorio')]
class ArticuloController extends Controller
{
    #[OA\Get(
        path: '/articulos',
        summary: 'Listar artículos',
        tags: ['Artículos'],
        parameters: [
            new OA\Parameter(name: 'categoria_id', in: 'query', required: false, schema: new OA\Schema(type: 'string', format: 'uuid'))
        ],
        responses: [
            new OA\Response(response: 200, description: 'Lista de artículos')
        ]
    )]
    public function index(Request $request): JsonResponse
    {
        $query = ArticuloModel::with('categoria');

        if ($request->filled('categoria_id')) {
            $query->where('categoria_id', $request->query('categoria_id'));
        }

        $articulos = $query
            ->orderByRaw('fecha_publicacion DESC NULLS LAST')
            ->orderByDesc('created_at')
            ->get();

        return response()->json($articulos);
    }

    #[OA\Get(
        path: '/articulos/{id}',
        summary: 'Obtener un artículo',
        tags: ['Artículos'],
        parameters: [
            new OA\Parameter(name: 'id', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid'))
        ],
        responses: [
            new OA\Response(response: 200, description: 'Detalle del artículo'),
            new OA\Response(response: 404, description: 'No encontrado')
        ]
    )]
    public function show(string $id): JsonResponse
    {
        $articulo = ArticuloModel::with('categoria')->find($id);

        if (!$articulo) {
            return response()->json(['message' => 'Artículo no encontrado'], 404);
        }

        return response()->json($articulo);
    }

    #[OA\Post(
        path: '/articulos',
        summary: 'Crear artículo',
        security: [['sanctum' => []]],
        tags: ['Artículos'],
        requestBody: new OA\RequestBody(
            required: true,
            content: new OA\JsonContent(
                required: ['titulo'],
                properties: [
                    new OA\Property(property: 'titulo', type: 'string'),
                    new OA\Property(property: 'descripcion', type: 'string'),
                    new OA\Property(property: 'autor', type: 'string'),
                    new OA\Property(property: 'fuente', type: 'string'),
                    new OA\Property(property: 'estado', type: 'string'),
                    new OA\Property(property: 'enlace', type: 'string'),
                    new OA\Property(property: 'fecha_publicacion', type: 'string', format: 'date'),
                    new OA\Property(property: 'fecha_recepcion', type: 'string', format: 'date'),
                    new OA\Property(property: 'categoria_id', type: 'string', format: 'uuid')
                ]
            )
        ),
        responses: [
            new OA\Response(response: 201, description: 'Artículo creado'),
            new OA\Response(response: 422, description: 'Validación fallida')
        ]
    )]
    public function store(Request $request): JsonResponse
    {
        $input = $request->all();

        $validator = Validator::make($input, [
            'titulo' => 'required|string|max:255',
            'descripcion' => 'nullable|string',
            'autor' => 'nullable|string|max:255',
            'fuente' => 'nullable|string|max:255',
            'estado' => 'nullable|string',
            'enlace' => 'nullable|string',
            'fecha_publicacion' => 'nullable|date',
            'fecha_recepcion' => 'nullable|date',
            'categoria_id' => 'nullable|uuid|exists:categorias_dataset,id',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Datos de validación inválidos',
                'errors' => $validator->errors(),
            ], 422);
        }

        $articulo = ArticuloModel::create($validator->validated());
        $articulo->load('categoria');

        return response()->json($articulo, 201);
    }

    #[OA\Put(
        path: '/articulos/{id}',
        summary: 'Actualizar artículo',
        security: [['sanctum' => []]],
        tags: ['Artículos'],
        parameters: [
            new OA\Parameter(name: 'id', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid'))
        ],
        requestBody: new OA\RequestBody(
            required: true,
            content: new OA\JsonContent(
                properties: [
                    new OA\Property(property: 'titulo', type: 'string'),
                    new OA\Property(property: 'descripcion', type: 'string'),
                    new OA\Property(property: 'autor', type: 'string'),
                    new OA\Property(property: 'fuente', type: 'string'),
                    new OA\Property(property: 'estado', type: 'string'),
                    new OA\Property(property: 'enlace', type: 'string'),
                    new OA\Property(property: 'fecha_publicacion', type: 'string', format: 'date'),
                    new OA\Property(property: 'fecha_recepcion', type: 'string', format: 'date'),
                    new OA\Property(property: 'categoria_id', type: 'string', format: 'uuid')
                ]
            )
        ),
        responses: [
            new OA\Response(response: 200, description: 'Artículo actualizado'),
            new OA\Response(response: 404, description: 'No encontrado'),
            new OA\Response(response: 422, description: 'Validación fallida')
        ]
    )]
    public function update(Request $request, string $id): JsonResponse
    {
        $articulo = ArticuloModel::find($id);

        if (!$articulo) {
            return response()->json(['message' => 'Artículo no encontrado'], 404);
        }

        $input = $request->all();

        $validator = Validator::make($input, [
            'titulo' => 'sometimes|string|max:255',
            'descripcion' => 'nullable|string',
            'autor' => 'nullable|string|max:255',
            'fuente' => 'nullable|string|max:255',
            'estado' => 'nullable|string',
            'enlace' => 'nullable|string',
            'fecha_publicacion' => 'nullable|date',
            'fecha_recepcion' => 'nullable|date',
            'categoria_id' => 'nullable|uuid|exists:categorias_dataset,id',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Datos de validación inválidos',
                'errors' => $validator->errors(),
            ], 422);
        }

        $articulo->update($validator->validated());

        return response()->json($articulo->fresh(['categoria']));
    }

    #[OA\Delete(
        path: '/articulos/{id}',
        summary: 'Eliminar artículo',
        security: [['sanctum' => []]],
        tags: ['Artículos'],
        parameters: [
            new OA\Parameter(name: 'id', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid'))
        ],
        responses: [
            new OA\Response(response: 200, description: 'Artículo eliminado'),
            new OA\Response(response: 404, description: 'No encontrado')
        ]
    )]
    public function destroy(string $id): JsonResponse
    {
        $articulo = ArticuloModel::find($id);

        if (!$articulo) {
            return response()->json(['message' => 'Artículo no encontrado'], 404);
        }

        $articulo->delete();

        return response()->json(['message' => 'Artículo eliminado exitosamente']);
    }
}
