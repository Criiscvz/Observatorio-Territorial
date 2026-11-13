<?php

declare(strict_types=1);

namespace App\Presentation\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Infrastructure\Persistence\Eloquent\Models\CategoriaDatasetModel;
use App\Presentation\Http\Resources\Dataset\CategoriaDatasetItemResource;
use App\Presentation\Http\Resources\Dataset\CategoriaDatasetResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use OpenApi\Attributes as OA;

#[OA\Tag(name: 'Categorías', description: 'Categorías de datasets')]
class CategoriaDatasetController extends Controller
{
    #[OA\Get(
        path: '/categorias',
        summary: 'Listar categorías de datasets',
        tags: ['Categorías'],
        responses: [
            new OA\Response(response: 200, description: 'Lista de categorías activas')
        ]
    )]
    public function index(Request $request): JsonResponse
    {
        $categorias = CategoriaDatasetModel::where('activo', true)
            ->orderBy('orden')
            ->get();

        return response()->json(CategoriaDatasetResource::collection($categorias)->resolve($request));
    }

    #[OA\Get(
        path: '/categorias/{codigo}',
        summary: 'Obtener categoría por código',
        tags: ['Categorías'],
        parameters: [
            new OA\Parameter(name: 'codigo', in: 'path', required: true, schema: new OA\Schema(type: 'string'))
        ],
        responses: [
            new OA\Response(response: 200, description: 'Datos de la categoría'),
            new OA\Response(response: 404, description: 'No encontrada')
        ]
    )]
    public function show(Request $request, string $codigo): JsonResponse
    {
        $categoria = CategoriaDatasetModel::where('codigo', $codigo)
            ->where('activo', true)
            ->first();

        if (!$categoria) {
            return response()->json(['message' => 'Categoría no encontrada'], 404);
        }

        return response()->json((new CategoriaDatasetResource($categoria))->resolve($request));
    }

    #[OA\Get(
        path: '/categorias/{codigo}/datasets',
        summary: 'Obtener datasets de una categoría',
        tags: ['Categorías'],
        parameters: [
            new OA\Parameter(name: 'codigo', in: 'path', required: true, schema: new OA\Schema(type: 'string'))
        ],
        responses: [
            new OA\Response(response: 200, description: 'Datasets de la categoría')
        ]
    )]
    public function datasets(Request $request, string $codigo): JsonResponse
    {
        $categoria = CategoriaDatasetModel::where('codigo', $codigo)
            ->where('activo', true)
            ->first();

        if (!$categoria) {
            return response()->json(['message' => 'Categoría no encontrada'], 404);
        }

        $datasets = $categoria->datasets()
            ->where('estado', 'COMPLETADO')
            ->whereHas('departamento', fn ($q) => $q->where('publico', true))
            ->with([
                'departamento:id,nombre,icono',
                'variablesMetadatos' => fn ($q) => $q->where('es_visible', true)
                    ->orderBy('orden')->select('id', 'dataset_id', 'nombre_columna', 'nombre_original', 'tipo_dato'),
            ])
            ->orderBy('created_at', 'desc')
            ->get();

        return response()->json([
            'categoria' => (new CategoriaDatasetResource($categoria))->resolve($request),
            'datasets' => CategoriaDatasetItemResource::collection($datasets)->resolve($request),
        ]);
    }
}
