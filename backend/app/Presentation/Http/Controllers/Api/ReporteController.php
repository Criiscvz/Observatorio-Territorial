<?php

declare(strict_types=1);

namespace App\Presentation\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Infrastructure\Persistence\Eloquent\Models\ReporteModel;
use App\Support\Authorization\DepartamentoResourceAuthorizer;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Validator;
use OpenApi\Attributes as OA;

#[OA\Tag(name: 'Reportes', description: 'Reportes e indicadores del observatorio')]
class ReporteController extends Controller
{
    public function __construct(
        private readonly DepartamentoResourceAuthorizer $resourceAuthorizer,
    ) {}

    #[OA\Get(
        path: '/reportes',
        summary: 'Listar reportes',
        tags: ['Reportes'],
        parameters: [
            new OA\Parameter(name: 'categoria_id', in: 'query', required: false, schema: new OA\Schema(type: 'string', format: 'uuid'))
        ],
        responses: [
            new OA\Response(response: 200, description: 'Lista de reportes')
        ]
    )]
    public function index(Request $request): JsonResponse
    {
        return app(\App\Presentation\Http\Resources\Publicacion\LegacyCatalogResponse::class)->index($request, 'REPORTE');
    }

    #[OA\Get(
        path: '/reportes/{id}',
        summary: 'Obtener un reporte',
        tags: ['Reportes'],
        parameters: [
            new OA\Parameter(name: 'id', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid'))
        ],
        responses: [
            new OA\Response(response: 200, description: 'Reporte encontrado'),
            new OA\Response(response: 404, description: 'No encontrado')
        ]
    )]
    public function show(Request $request, string $id): JsonResponse
    {
        $reporte = ReporteModel::with(['categoria', 'departamento'])->find($id);

        if (!$reporte) {
            return response()->json(['message' => 'Reporte no encontrado'], 404);
        }

        abort_unless($this->canViewLegacyContent($request, $reporte), 404, 'Reporte no encontrado');

        if ($reporte->visibilidad === 'suscriptor') {
            $user = $request->user('sanctum');
            if (!$this->isSubscriber($user)) {
                return response()->json(['message' => 'Acceso exclusivo para suscriptores.'], 403);
            }
        }

        return response()->json($reporte);
    }

    #[OA\Post(
        path: '/reportes',
        summary: 'Crear reporte',
        security: [['sanctum' => []]],
        tags: ['Reportes'],
        requestBody: new OA\RequestBody(
            required: true,
            content: new OA\MediaType(
                mediaType: 'multipart/form-data',
                schema: new OA\Schema(
                    required: ['nombre_indicador'],
                    properties: [
                        new OA\Property(property: 'nombre_indicador', type: 'string'),
                        new OA\Property(property: 'descripcion_indicador', type: 'string'),
                        new OA\Property(property: 'fecha_publicacion', type: 'string', format: 'date'),
                        new OA\Property(property: 'link_url', type: 'string', format: 'url'),
                        new OA\Property(property: 'fuente', type: 'string'),
                        new OA\Property(property: 'categoria_id', type: 'string', format: 'uuid'),
                        new OA\Property(property: 'departamento_id', type: 'string', format: 'uuid'),
                        new OA\Property(property: 'ficha', type: 'string', format: 'binary')
                    ]
                )
            )
        ),
        responses: [
            new OA\Response(response: 201, description: 'Reporte creado'),
            new OA\Response(response: 422, description: 'Validación fallida')
        ]
    )]
    public function store(Request $request): JsonResponse
    {
        // Normalizar URL: agregar https:// si no especifica protocolo
        $input = $request->all();
        if (!empty($input['link_url']) && !preg_match('#^https?://#i', $input['link_url'])) {
            $input['link_url'] = 'https://' . $input['link_url'];
        }

        $validator = Validator::make($input, [
            'nombre_indicador' => 'required|string|max:255',
            'descripcion_indicador' => 'nullable|string',
            'fecha_publicacion' => 'nullable|date',
            'link_url' => 'nullable|url|max:500',
            'fuente' => 'nullable|string|max:255',
            'visibilidad' => 'sometimes|string|in:publico,suscriptor,privado',
            'categoria_id' => 'nullable|uuid|exists:categorias_dataset,id',
            'departamento_id' => 'nullable|uuid|exists:departamentos,id',
            'ficha' => 'nullable|file|mimes:pdf,doc,docx,xls,xlsx|max:10240',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Datos de validación inválidos',
                'errors' => $validator->errors(),
            ], 422);
        }

        $data = $validator->validated();

        if ($request->hasFile('ficha')) {
            $data['ficha_indicador'] = $this->guardarFicha($request->file('ficha'));
        }

        unset($data['ficha']);

        $this->resourceAuthorizer->ensureCanManageDepartamento(
            $request->user(),
            $data['departamento_id'] ?? null,
        );

        $reporte = ReporteModel::create($data);
        $reporte->load(['categoria', 'departamento']);

        return response()->json($reporte, 201);
    }

    #[OA\Put(
        path: '/reportes/{id}',
        summary: 'Actualizar reporte',
        security: [['sanctum' => []]],
        tags: ['Reportes'],
        parameters: [
            new OA\Parameter(name: 'id', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid'))
        ],
        requestBody: new OA\RequestBody(
            required: false,
            content: new OA\MediaType(
                mediaType: 'multipart/form-data',
                schema: new OA\Schema(
                    properties: [
                        new OA\Property(property: 'nombre_indicador', type: 'string'),
                        new OA\Property(property: 'descripcion_indicador', type: 'string'),
                        new OA\Property(property: 'fecha_publicacion', type: 'string', format: 'date'),
                        new OA\Property(property: 'link_url', type: 'string', format: 'url'),
                        new OA\Property(property: 'fuente', type: 'string'),
                        new OA\Property(property: 'categoria_id', type: 'string', format: 'uuid'),
                        new OA\Property(property: 'departamento_id', type: 'string', format: 'uuid'),
                        new OA\Property(property: 'ficha', type: 'string', format: 'binary')
                    ]
                )
            )
        ),
        responses: [
            new OA\Response(response: 200, description: 'Reporte actualizado'),
            new OA\Response(response: 404, description: 'No encontrado'),
            new OA\Response(response: 422, description: 'Validación fallida')
        ]
    )]
    public function update(Request $request, string $id): JsonResponse
    {
        $reporte = ReporteModel::find($id);

        if (!$reporte) {
            return response()->json(['message' => 'Reporte no encontrado'], 404);
        }

        $this->resourceAuthorizer->ensureCanManageDepartamento($request->user(), $reporte->departamento_id);

        // Normalizar URL: agregar https:// si no especifica protocolo
        $input = $request->all();
        if (!empty($input['link_url']) && !preg_match('#^https?://#i', $input['link_url'])) {
            $input['link_url'] = 'https://' . $input['link_url'];
        }

        $validator = Validator::make($input, [
            'nombre_indicador' => 'sometimes|string|max:255',
            'descripcion_indicador' => 'nullable|string',
            'fecha_publicacion' => 'nullable|date',
            'link_url' => 'nullable|url|max:500',
            'fuente' => 'nullable|string|max:255',
            'visibilidad' => 'sometimes|string|in:publico,suscriptor,privado',
            'categoria_id' => 'nullable|uuid|exists:categorias_dataset,id',
            'departamento_id' => 'nullable|uuid|exists:departamentos,id',
            'ficha' => 'nullable|file|mimes:pdf,doc,docx,xls,xlsx|max:10240',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Datos de validación inválidos',
                'errors' => $validator->errors(),
            ], 422);
        }

        $data = $validator->validated();

        if ($request->hasFile('ficha')) {
            // Eliminar ficha anterior si existe
            if ($reporte->ficha_indicador) {
                $oldFilename = basename($reporte->ficha_indicador);
                $oldPath = 'public/fichas/' . $oldFilename;
                if (Storage::exists($oldPath)) {
                    Storage::delete($oldPath);
                }
            }

            $data['ficha_indicador'] = $this->guardarFicha($request->file('ficha'));
        }

        unset($data['ficha']);

        $this->resourceAuthorizer->ensureCanManageDepartamento(
            $request->user(),
            $data['departamento_id'] ?? $reporte->departamento_id,
        );

        $reporte->update($data);

        return response()->json($reporte->fresh(['categoria', 'departamento']));
    }

    #[OA\Delete(
        path: '/reportes/{id}',
        summary: 'Eliminar reporte',
        security: [['sanctum' => []]],
        tags: ['Reportes'],
        parameters: [
            new OA\Parameter(name: 'id', in: 'path', required: true, schema: new OA\Schema(type: 'string', format: 'uuid'))
        ],
        responses: [
            new OA\Response(response: 200, description: 'Reporte eliminado'),
            new OA\Response(response: 404, description: 'No encontrado')
        ]
    )]
    public function destroy(Request $request, string $id): JsonResponse
    {
        $reporte = ReporteModel::find($id);

        if (!$reporte) {
            return response()->json(['message' => 'Reporte no encontrado'], 404);
        }

        $this->resourceAuthorizer->ensureCanManageDepartamento($request->user(), $reporte->departamento_id);

        $reporte->delete();

        return response()->json(['message' => 'Reporte eliminado exitosamente']);
    }

    #[OA\Get(
        path: '/reportes/fichas/{filename}',
        summary: 'Descargar ficha de indicador',
        tags: ['Reportes'],
        parameters: [
            new OA\Parameter(name: 'filename', in: 'path', required: true, schema: new OA\Schema(type: 'string'))
        ],
        responses: [
            new OA\Response(response: 200, description: 'Archivo de la ficha'),
            new OA\Response(response: 404, description: 'No encontrada')
        ]
    )]
    public function ficha(Request $request, string $filename)
    {
        if (!preg_match('/^[A-Za-z0-9._-]+$/', $filename)) {
            return response()->json(['message' => 'Ficha no encontrada'], 404)
                ->header('Access-Control-Allow-Origin', '*')
                ->header('Cross-Origin-Resource-Policy', 'cross-origin');
        }

        $path = 'public/fichas/' . $filename;

        if (!Storage::exists($path)) {
            return response()->json(['message' => 'Ficha no encontrada'], 404)
                ->header('Access-Control-Allow-Origin', '*')
                ->header('Cross-Origin-Resource-Policy', 'cross-origin');
        }

        // Validación de paywall para descargas/fichas de suscriptor
        $reporte = ReporteModel::where('ficha_indicador', 'like', '%' . $filename)->first();
        if ($reporte && ! $this->canViewLegacyContent($request, $reporte)) {
            return response()->json(['message' => 'Ficha no encontrada'], 404)
                ->header('Access-Control-Allow-Origin', '*')
                ->header('Cross-Origin-Resource-Policy', 'cross-origin');
        }

        if ($reporte && $reporte->visibilidad === 'suscriptor') {
            $user = $request->user('sanctum');
            if (!$this->isSubscriber($user)) {
                return response()->json(['message' => 'Acceso exclusivo para suscriptores.'], 403)
                    ->header('Access-Control-Allow-Origin', '*')
                    ->header('Cross-Origin-Resource-Policy', 'cross-origin');
            }
        }

        $file = Storage::get($path);
        $mimeType = Storage::mimeType($path);

        return response($file, 200)
            ->header('Content-Type', $mimeType)
            ->header('Cache-Control', 'public, max-age=31536000')
            ->header('Access-Control-Allow-Origin', '*')
            ->header('Cross-Origin-Resource-Policy', 'cross-origin');
    }

    private function guardarFicha(\Illuminate\Http\UploadedFile $file): string
    {
        // Asegurar que el directorio de fichas exista
        if (!Storage::exists('public/fichas')) {
            Storage::makeDirectory('public/fichas');
        }

        $filename = 'ficha_' . uniqid() . '.' . $file->getClientOriginalExtension();
        $file->storeAs('public/fichas', $filename);

        // URL completa usando APP_URL + endpoint API (evita problemas de CORS)
        return rtrim(config('app.url'), '/') . '/api/reportes/fichas/' . $filename;
    }

    private function canViewLegacyContent(Request $request, $reporte): bool
    {
        if (($reporte->visibilidad ?? 'publico') === 'privado') {
            return false;
        }

        return true;
    }

    private function isSubscriber($user): bool
    {
        return $user && in_array($user->rol, ['ADMIN', 'EDITOR', 'SUBSCRIBER', 'SUSCRIPTOR', 'SUBSCRIPTOR'], true);
    }
}
