<?php

declare(strict_types=1);

namespace App\Presentation\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Infrastructure\Persistence\Eloquent\Models\ArticuloModel;
use App\Support\Authorization\DepartamentoResourceAuthorizer;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use OpenApi\Attributes as OA;

#[OA\Tag(name: 'Artículos', description: 'Artículos de contenido del observatorio')]
class ArticuloController extends Controller
{
    public function __construct(
        private readonly DepartamentoResourceAuthorizer $resourceAuthorizer,
    ) {}

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
        return app(\App\Presentation\Http\Resources\Publicacion\LegacyCatalogResponse::class)->index($request, 'ARTICULO');
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
        if ($response = app(\App\Application\Publicaciones\LegacyPublicationBridge::class)->show($request, 'articulos', $id)) {
            return $response;
        }
        $articulo = ArticuloModel::with(['categoria', 'departamento'])->find($id);

        if (!$articulo) {
            return response()->json(['message' => 'Artículo no encontrado'], 404);
        }

        abort_unless($this->canViewLegacyContent($request, $articulo), 404, 'Artículo no encontrado');

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
        return app(\App\Application\Publicaciones\LegacyPublicationBridge::class)->create($request, 'articulos');
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
        return app(\App\Application\Publicaciones\LegacyPublicationBridge::class)->write(
            $request, 'articulos', $id, fn () => $this->updateLegacy($request, $id));
    }

    private function updateLegacy(Request $request, string $id): JsonResponse
    {
        $articulo = ArticuloModel::find($id);

        if (!$articulo) {
            return response()->json(['message' => 'Artículo no encontrado'], 404);
        }

        $this->resourceAuthorizer->ensureCanManageDepartamento($request->user(), $articulo->departamento_id);

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

        $data = $validator->validated();
        $this->resourceAuthorizer->ensureCanManageDepartamento(
            $request->user(),
            $data['departamento_id'] ?? $articulo->departamento_id,
        );

        $articulo->update($data);

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
    public function destroy(Request $request, string $id): JsonResponse
    {
        return app(\App\Application\Publicaciones\LegacyPublicationBridge::class)->write(
            $request, 'articulos', $id, fn () => $this->destroyLegacy($request, $id), delete: true);
    }

    private function destroyLegacy(Request $request, string $id): JsonResponse
    {
        $articulo = ArticuloModel::find($id);

        if (!$articulo) {
            return response()->json(['message' => 'Artículo no encontrado'], 404);
        }

        $this->resourceAuthorizer->ensureCanManageDepartamento($request->user(), $articulo->departamento_id);

        $articulo->delete();

        return response()->json(['message' => 'Artículo eliminado exitosamente']);
    }

    private function canViewLegacyContent(Request $request, $articulo): bool
    {
        if ($articulo->estado !== null && ! in_array($articulo->estado, ['PUBLICADO', 'PUBLICACION'], true)) {
            return false;
        }

        if ($articulo->deleted_at !== null
            || ! in_array($articulo->visibilidad ?? 'publico', ['publico', 'suscriptor'], true)
            || ($articulo->departamento_id !== null && (! $articulo->departamento || ! $articulo->departamento->publico))) {
            return false;
        }

        return true;
    }

    private function isSubscriber($user): bool
    {
        return $user && in_array($user->rol, ['ADMIN', 'SUBSCRIBER', 'SUSCRIPTOR', 'SUBSCRIPTOR'], true);
    }
}
