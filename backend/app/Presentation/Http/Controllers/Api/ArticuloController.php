<?php

declare(strict_types=1);

namespace App\Presentation\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Infrastructure\Persistence\Eloquent\Models\ArticuloModel;
use App\Models\ObservatorioPublicacion;
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
        $query = ArticuloModel::with(['categoria', 'departamento']);

        if ($request->filled('categoria_id')) {
            $query->where('categoria_id', $request->query('categoria_id'));
        }

        if ($request->filled('departamento_id')) {
            $query->where('departamento_id', $request->query('departamento_id'));
        }

        $articulos = $query
            ->orderByRaw('fecha_publicacion DESC NULLS LAST')
            ->orderByDesc('created_at')
            ->get()
            ->filter(fn($articulo) => $this->canViewLegacyContent($request, $articulo));

        $publicaciones = ObservatorioPublicacion::query()
            ->with('departamento')
            ->where('tipo', 'ARTICULO')
            ->where('estado', 'PUBLICACION')
            ->when(
                $request->filled('departamento_id'),
                fn($publicationQuery) => $publicationQuery->where('departamento_id', $request->query('departamento_id'))
            )
            ->latest('fecha_publicacion')
            ->get()
            ->filter(fn(ObservatorioPublicacion $publicacion) => $this->canViewPublication($request, $publicacion))
            ->map(fn(ObservatorioPublicacion $publicacion) => $this->mapPublicacionToArticulo($publicacion));

        return response()->json(
            $articulos
                ->concat($publicaciones)
                ->sortByDesc(fn($item) => (string) ($item['fecha_publicacion'] ?? $item->fecha_publicacion ?? $item['created_at'] ?? $item->created_at ?? ''))
                ->values()
        );
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
    public function show(Request $request, string $id): JsonResponse
    {
        $articulo = ArticuloModel::with(['categoria', 'departamento'])->find($id);

        if (!$articulo) {
            return response()->json(['message' => 'Artículo no encontrado'], 404);
        }

        if ($articulo->visibilidad === 'suscriptor') {
            $user = $request->user('sanctum');
            if (!$this->isSubscriber($user)) {
                return response()->json(['message' => 'Acceso exclusivo para suscriptores.'], 403);
            }
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
                    new OA\Property(property: 'categoria_id', type: 'string', format: 'uuid'),
                    new OA\Property(property: 'departamento_id', type: 'string', format: 'uuid')
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
            'visibilidad' => 'sometimes|string|in:publico,suscriptor,privado',
            'fecha_publicacion' => 'nullable|date',
            'fecha_recepcion' => 'nullable|date',
            'categoria_id' => 'nullable|uuid|exists:categorias_dataset,id',
            'departamento_id' => 'nullable|uuid|exists:departamentos,id',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Datos de validación inválidos',
                'errors' => $validator->errors(),
            ], 422);
        }

        $articulo = ArticuloModel::create($validator->validated());
        $articulo->load(['categoria', 'departamento']);

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
                    new OA\Property(property: 'categoria_id', type: 'string', format: 'uuid'),
                    new OA\Property(property: 'departamento_id', type: 'string', format: 'uuid')
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
            'visibilidad' => 'sometimes|string|in:publico,suscriptor,privado',
            'fecha_publicacion' => 'nullable|date',
            'fecha_recepcion' => 'nullable|date',
            'categoria_id' => 'nullable|uuid|exists:categorias_dataset,id',
            'departamento_id' => 'nullable|uuid|exists:departamentos,id',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Datos de validación inválidos',
                'errors' => $validator->errors(),
            ], 422);
        }

        $articulo->update($validator->validated());

        return response()->json($articulo->fresh(['categoria', 'departamento']));
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

    private function mapPublicacionToArticulo(ObservatorioPublicacion $publicacion): array
    {
        $downloadUrl = rtrim(config('app.url'), '/')."/api/departamentos/publicaciones/{$publicacion->id}/download";

        return [
            'id' => $publicacion->id,
            'titulo' => $publicacion->titulo,
            'descripcion' => $publicacion->descripcion,
            'autor' => $publicacion->autores,
            'fuente' => $publicacion->fuente,
            'estado' => $publicacion->estado,
            'enlace' => $publicacion->link_url ?: ($publicacion->sharepoint_url ?: $downloadUrl),
            'fecha_publicacion' => $publicacion->fecha_publicacion?->format('Y-m-d'),
            'fecha_recepcion' => $publicacion->created_at?->format('Y-m-d'),
            'categoria_id' => null,
            'departamento_id' => $publicacion->departamento_id,
            'visibilidad' => $publicacion->solo_suscriptores ? 'suscriptor' : 'publico',
            'categoria' => null,
            'departamento' => $publicacion->departamento,
            'created_at' => $publicacion->created_at?->toIso8601String(),
            'updated_at' => $publicacion->updated_at?->toIso8601String(),
        ];
    }

    private function canViewPublication(Request $request, ObservatorioPublicacion $publicacion): bool
    {
        if ($publicacion->estado !== 'PUBLICACION') {
            return false;
        }

        if (! $publicacion->solo_suscriptores) {
            return true;
        }

        $user = $request->user('sanctum');

        return $this->isSubscriber($user);
    }

    private function canViewLegacyContent(Request $request, $articulo): bool
    {
        if (($articulo->estado ?? 'PUBLICADO') && ! in_array($articulo->estado, ['PUBLICADO', 'PUBLICACION'], true)) {
            return false;
        }

        if (($articulo->visibilidad ?? 'publico') !== 'suscriptor') {
            return true;
        }

        return $this->isSubscriber($request->user('sanctum'));
    }

    private function isSubscriber($user): bool
    {
        return $user && in_array($user->rol, ['ADMIN', 'EDITOR', 'SUBSCRIBER', 'SUSCRIPTOR', 'SUBSCRIPTOR'], true);
    }
}
