<?php

declare(strict_types=1);

namespace App\Presentation\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Departamento;
use App\Models\ObservatorioPublicacion;
use App\Infrastructure\Services\SharePointService;
use App\Presentation\Http\Requests\Publicacion\StorePublicacionRequest;
use App\Presentation\Http\Requests\Publicacion\UpdatePublicacionRequest;
use App\Presentation\Http\Resources\Publicacion\PublicacionResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use RuntimeException;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ObservatorioPublicacionController extends Controller
{
    private const ESTADO_PUBLICACION = 'PUBLICACION';
    private const ESTADO_EN_REVISION = 'EN_REVISION';
    private const SUBSCRIBER_ROLE = 'SUBSCRIBER';

    public function __construct(private readonly SharePointService $sharePointService)
    {
    }

    public function index(Request $request, Departamento $departamento): AnonymousResourceCollection
    {
        $filters = $request->validate([
            'tipo' => ['nullable', 'in:ARTICULO,REPORTE,LIBRO,ATLAS'],
            'estado' => ['nullable', 'in:PUBLICACION,EN_REVISION,SUSPENDIDO,ARCHIVADO'],
        ]);

        return $this->list($request, $departamento, $filters['tipo'] ?? null, $filters['estado'] ?? null);
    }

    public function indexGlobalAtlas(Request $request): AnonymousResourceCollection
    {
        abort_unless($request->user()->rol === 'ADMIN', 403, 'No tienes permisos para gestionar Atlas global.');

        $items = ObservatorioPublicacion::query()
            ->with('creadoPor')
            ->where('tipo', 'ATLAS')
            ->whereNull('departamento_id')
            ->orderByDesc('fecha_publicacion')
            ->orderByDesc('created_at')
            ->get();

        return PublicacionResource::collection($items);
    }

    public function showGlobalAtlas(Request $request, ObservatorioPublicacion $publicacion): JsonResponse
    {
        abort_unless($request->user()->rol === 'ADMIN', 403, 'No tienes permisos para gestionar Atlas global.');
        abort_unless(
            $publicacion->tipo === 'ATLAS' && $publicacion->departamento_id === null,
            404,
            'Atlas global no encontrado.'
        );

        return (new PublicacionResource($publicacion->load('creadoPor')))->response();
    }

    public function articulos(Request $request, Departamento $departamento): AnonymousResourceCollection
    {
        return $this->list($request, $departamento, 'ARTICULO');
    }

    public function reportes(Request $request, Departamento $departamento): AnonymousResourceCollection
    {
        return $this->list($request, $departamento, 'REPORTE');
    }

    public function atlas(Request $request, Departamento $departamento): AnonymousResourceCollection
    {
        return $this->list($request, $departamento, 'LIBRO');
    }

    public function libros(Request $request, Departamento $departamento): AnonymousResourceCollection
    {
        return $this->list($request, $departamento, 'LIBRO');
    }

    public function canUpload(Request $request, Departamento $departamento): JsonResponse
    {
        $user = $request->user();
        $departamentoRole = $departamento->usuarios()
            ->where('users.id', $user->id)
            ->first()?->pivot?->rol;
        $hasPermission = in_array($departamentoRole, ['ADMIN', 'EDITOR'], true);
        $canUpload = $user->rol === 'ADMIN' || ($user->rol === 'EDITOR' && $hasPermission);

        return response()->json([
            'can_upload' => $canUpload,
            'role' => $user->rol,
            'has_permission' => $hasPermission,
            'departamento_role' => $user->rol === 'ADMIN' ? 'ADMIN' : $departamentoRole,
        ]);
    }

    public function store(StorePublicacionRequest $request, Departamento $departamento): JsonResponse
    {
        $this->ensureCanManage($request, $departamento);
        $data = $request->validated();
        $estado = $request->user()->rol === 'ADMIN' ? $data['estado'] : self::ESTADO_EN_REVISION;
        $file = $request->file('archivo');
        $path = $file
            ? $file->storeAs('publicaciones/'.$departamento->id, Str::uuid().'.pdf', config('filesystems.default'))
            : null;

        try {
            $publicacion = DB::transaction(function () use ($data, $request, $departamento, $file, $path, $estado) {
                $counter = DB::table('publicacion_contadores')->where('tipo', $data['tipo'])->lockForUpdate()->first();
                abort_unless($counter, 500, 'No se pudo generar el código de publicación.');
                $number = (int) $counter->siguiente_numero;
                DB::table('publicacion_contadores')->where('tipo', $data['tipo'])->update(['siguiente_numero' => $number + 1]);

                return ObservatorioPublicacion::create([
                    'departamento_id' => $departamento->id,
                    'creado_por' => $request->user()->id,
                    'tipo' => $data['tipo'],
                    'estado' => $estado,
                    'solo_suscriptores' => $request->user()->rol === 'ADMIN' && $request->boolean('solo_suscriptores'),
                    'codigo' => $this->codePrefix($data['tipo']).str_pad((string) $number, 4, '0', STR_PAD_LEFT),
                    'titulo' => $data['titulo'],
                    'fecha_publicacion' => $data['fecha_publicacion'],
                    'link_url' => $data['link_url'] ?? null,
                    'descripcion' => $data['descripcion'] ?? null,
                    'autores' => $data['autores'] ?? null,
                    'fuente' => $data['fuente'],
                    'archivo_pdf' => $path,
                    'nombre_archivo_original' => $file?->getClientOriginalName(),
                ]);
            });
        } catch (\Throwable $exception) {
            if ($path) {
                Storage::disk(config('filesystems.default'))->delete($path);
            }
            throw $exception;
        }

        return (new PublicacionResource($publicacion->refresh()->load('creadoPor')))->response()->setStatusCode(201);
    }

    public function storeGlobalAtlas(StorePublicacionRequest $request): JsonResponse
    {
        abort_unless($request->user()->rol === 'ADMIN', 403, 'No tienes permisos para subir Atlas global.');
        $data = $request->validated();
        abort_unless($data['tipo'] === 'ATLAS', 422, 'El módulo global solo permite publicaciones de tipo Atlas.');

        $file = $request->file('archivo');
        $path = $file
            ? $file->storeAs('publicaciones/atlas-global', Str::uuid().'.pdf', config('filesystems.default'))
            : null;

        try {
            $publicacion = DB::transaction(function () use ($data, $request, $file, $path) {
                $counter = DB::table('publicacion_contadores')->where('tipo', 'ATLAS')->lockForUpdate()->first();
                abort_unless($counter, 500, 'No se pudo generar el código de publicación.');
                $number = (int) $counter->siguiente_numero;
                DB::table('publicacion_contadores')->where('tipo', 'ATLAS')->update(['siguiente_numero' => $number + 1]);

                return ObservatorioPublicacion::create([
                    'departamento_id' => null,
                    'creado_por' => $request->user()->id,
                    'tipo' => 'ATLAS',
                    'estado' => $request->user()->rol === 'ADMIN' ? $data['estado'] : self::ESTADO_EN_REVISION,
                    'solo_suscriptores' => $request->boolean('solo_suscriptores'),
                    'codigo' => 'ATL-'.str_pad((string) $number, 4, '0', STR_PAD_LEFT),
                    'titulo' => $data['titulo'],
                    'fecha_publicacion' => $data['fecha_publicacion'],
                    'link_url' => $data['link_url'] ?? null,
                    'descripcion' => $data['descripcion'] ?? null,
                    'autores' => $data['autores'] ?? null,
                    'fuente' => $data['fuente'],
                    'archivo_pdf' => $path,
                    'nombre_archivo_original' => $file?->getClientOriginalName(),
                ]);
            });
        } catch (\Throwable $exception) {
            if ($path) {
                Storage::disk(config('filesystems.default'))->delete($path);
            }
            throw $exception;
        }

        return (new PublicacionResource($publicacion->refresh()->load('creadoPor')))->response()->setStatusCode(201);
    }

    public function download(Request $request, ObservatorioPublicacion $publicacion): StreamedResponse|\Illuminate\Http\RedirectResponse
    {
        if ($publicacion->departamento) {
            $this->ensureCanView($request, $publicacion->departamento);
        }
        $this->ensureCanViewPublication($request, $publicacion);
        if (! $publicacion->archivo_pdf && $publicacion->sharepoint_url) {
            return redirect()->away($publicacion->sharepoint_url);
        }

        $disk = Storage::disk(config('filesystems.default'));
        abort_unless($disk->exists($publicacion->archivo_pdf), 404, 'Archivo no disponible.');

        $filename = $publicacion->nombre_archivo_original ?? $publicacion->titulo.'.pdf';
        $safeFilename = str_replace('"', '\"', $filename);

        $stream = $disk->readStream($publicacion->archivo_pdf);
        abort_unless($stream !== false, 404, 'Archivo no disponible.');

        return response()->stream(function () use ($stream): void {
            fpassthru($stream);
            fclose($stream);
        }, 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => 'inline; filename="'.$safeFilename.'"',
        ]);
    }

    public function update(UpdatePublicacionRequest $request, ObservatorioPublicacion $publicacion): JsonResponse
    {
        if ($publicacion->departamento) {
            $this->ensureCanManage($request, $publicacion->departamento);
        } else {
            abort_unless($request->user()->rol === 'ADMIN', 403, 'No tienes permisos para gestionar Atlas global.');
        }
        abort_unless(
            $request->user()->rol === 'ADMIN' || (int) $publicacion->creado_por === (int) $request->user()->id,
            403,
            'No puedes editar publicaciones de otros usuarios.'
        );
        $data = $request->validated();
        $isAdmin = $request->user()->rol === 'ADMIN';
        $newFile = $request->file('archivo');
        $oldPath = $publicacion->archivo_pdf;
        $newPath = null;

        if ($newFile) {
            $storageFolder = $publicacion->departamento_id
                ? 'publicaciones/'.$publicacion->departamento_id
                : 'publicaciones/atlas-global';
            $newPath = $newFile->storeAs(
                $storageFolder,
                Str::uuid().'.pdf',
                config('filesystems.default')
            );
        }

        try {
            DB::transaction(function () use ($data, $request, $publicacion, $newFile, $newPath, $isAdmin) {
                $publicacion->update([
                    'estado' => $isAdmin ? $data['estado'] : $publicacion->estado,
                    'solo_suscriptores' => $isAdmin ? $request->boolean('solo_suscriptores') : $publicacion->solo_suscriptores,
                    'titulo' => $data['titulo'],
                    'fecha_publicacion' => $data['fecha_publicacion'],
                    'link_url' => $data['link_url'] ?? null,
                    'descripcion' => $data['descripcion'],
                    'autores' => $publicacion->tipo === 'ARTICULO' ? $data['autores'] : ($data['autores'] ?? null),
                    'fuente' => $data['fuente'],
                    ...($newFile ? [
                        'archivo_pdf' => $newPath,
                        'nombre_archivo_original' => $newFile->getClientOriginalName(),
                    ] : []),
                ]);
            });
        } catch (\Throwable $exception) {
            if ($newPath) {
                Storage::disk(config('filesystems.default'))->delete($newPath);
            }
            throw $exception;
        }

        if ($newPath && $oldPath && $oldPath !== $newPath) {
            Storage::disk(config('filesystems.default'))->delete($oldPath);
        }

        return (new PublicacionResource($publicacion->refresh()->load('creadoPor')))->response();
    }

    public function destroy(Request $request, ObservatorioPublicacion $publicacion): JsonResponse
    {
        if ($publicacion->departamento) {
            $this->ensureCanManage($request, $publicacion->departamento);
        } else {
            abort_unless($request->user()->rol === 'ADMIN', 403, 'No tienes permisos para eliminar Atlas global.');
        }

        $user = $request->user();
        abort_unless(
            $user->rol === 'ADMIN' || ($user->rol === 'EDITOR' && (int) $publicacion->creado_por === (int) $user->id),
            403,
            'No tienes permiso para eliminar esta publicación.'
        );

        $filePath = $publicacion->archivo_pdf;

        DB::transaction(function () use ($publicacion) {
            $publicacion->delete();
        });

        if ($filePath && Storage::disk(config('filesystems.default'))->exists($filePath)) {
            Storage::disk(config('filesystems.default'))->delete($filePath);
        }

        return response()->json([
            'message' => 'Publicación eliminada correctamente.',
        ]);
    }

    public function sharePointFiles(Request $request, Departamento $departamento): JsonResponse
    {
        $this->ensureCanView($request, $departamento);

        return response()->json([
            'data' => $this->sharePointService->listPdfFiles(),
        ]);
    }

    public function browseSharePointAtlas(Request $request, Departamento $departamento): JsonResponse
    {
        $this->ensureCanView($request, $departamento);
        $data = $request->validate([
            'item_id' => ['nullable', 'string', 'max:1024'],
        ]);

        return response()->json([
            'data' => $this->sharePointService->browseAtlasFolder($data['item_id'] ?? null),
        ]);
    }

    public function browseSharePointArticulos(Request $request, Departamento $departamento): JsonResponse
    {
        $this->ensureCanView($request, $departamento);
        $data = $request->validate([
            'item_id' => ['nullable', 'string', 'max:1024'],
        ]);

        return response()->json([
            'data' => $this->sharePointService->browseBarometerFolder($data['item_id'] ?? null),
        ]);
    }

    public function browseSharePointReportes(Request $request, Departamento $departamento): JsonResponse
    {
        $this->ensureCanView($request, $departamento);
        $data = $request->validate([
            'item_id' => ['nullable', 'string', 'max:1024'],
        ]);

        return response()->json([
            'data' => $this->sharePointService->browseBarometerFolder($data['item_id'] ?? null),
        ]);
    }

    public function sharePointPowerBiLinks(Request $request, Departamento $departamento): JsonResponse
    {
        $this->ensureCanView($request, $departamento);

        return response()->json([
            'data' => $this->sharePointService->listPowerBiLinks(),
        ]);
    }

    public function importSharePointReporte(Request $request, Departamento $departamento): JsonResponse
    {
        $this->ensureCanView($request, $departamento);
        $data = $request->validate([
            'sharepoint_file_id' => ['required', 'string', 'max:1024'],
            'descripcion' => ['nullable', 'string', 'max:3000'],
        ]);

        $file = $this->sharePointService->getPowerBiLink($data['sharepoint_file_id']);
        $publicacion = $this->upsertSharePointPublication(
            request: $request,
            departamento: $departamento,
            file: $file,
            tipo: 'REPORTE',
            descripcion: $data['descripcion'] ?? 'Reporte Power BI importado desde SharePoint.',
        );

        return (new PublicacionResource($publicacion->refresh()))->response()
            ->setStatusCode($publicacion->wasRecentlyCreated ? 201 : 200);
    }

    public function syncSharePointReportes(Request $request, Departamento $departamento): JsonResponse
    {
        $this->ensureCanView($request, $departamento);
        $items = collect();

        foreach ($this->sharePointService->listPowerBiLinks() as $file) {
            $items->push($this->upsertSharePointPublication(
                request: $request,
                departamento: $departamento,
                file: $file,
                tipo: 'REPORTE',
                descripcion: 'Reporte Power BI importado desde SharePoint.',
            )->refresh());
        }

        return response()->json([
            'data' => PublicacionResource::collection($items),
            'synced' => $items->count(),
        ]);
    }

    public function importSharePointAtlas(Request $request, Departamento $departamento): JsonResponse
    {
        $this->ensureCanView($request, $departamento);
        $data = $request->validate([
            'sharepoint_file_id' => ['required', 'string', 'max:1024'],
            'descripcion' => ['nullable', 'string', 'max:3000'],
        ]);

        $file = $this->sharePointService->getPdfFileInsideRoot($data['sharepoint_file_id']);
        $existing = $this->findSharePointPublication($departamento, (string) $file['id']);
        if ($existing) {
            $lastModified = $file['last_modified_at'] ? Carbon::parse($file['last_modified_at']) : $existing->sharepoint_last_modified_at;
            $existing->update([
                'titulo' => pathinfo((string) $file['name'], PATHINFO_FILENAME) ?: (string) $file['name'],
                'fecha_publicacion' => $lastModified?->toDateString() ?? $existing->fecha_publicacion,
                'link_url' => $file['web_url'],
                'descripcion' => $data['descripcion'] ?? $existing->descripcion,
                'autores' => $file['created_by'] ?? $existing->autores,
                'fuente' => 'SharePoint',
                'nombre_archivo_original' => $file['name'],
                'sharepoint_url' => $file['web_url'],
                'sharepoint_file_name' => $file['name'],
                'sharepoint_file_type' => $file['mime_type'],
                'sharepoint_file_size' => $file['size'],
                'sharepoint_last_modified_at' => $file['last_modified_at'],
                'sharepoint_sync_status' => 'sincronizado',
                'sharepoint_synced_at' => now(),
                'sharepoint_error' => null,
            ]);

            return (new PublicacionResource($existing->refresh()))->response();
        }

        $publicacion = DB::transaction(function () use ($data, $request, $departamento, $file) {
            $counter = DB::table('publicacion_contadores')->where('tipo', 'LIBRO')->lockForUpdate()->first();
            abort_unless($counter, 500, 'No se pudo generar el código de publicación.');
            $number = (int) $counter->siguiente_numero;
            DB::table('publicacion_contadores')->where('tipo', 'LIBRO')->update(['siguiente_numero' => $number + 1]);

            $lastModified = $file['last_modified_at'] ? Carbon::parse($file['last_modified_at']) : now();

            return ObservatorioPublicacion::create([
                'departamento_id' => $departamento->id,
                'creado_por' => $request->user()->id,
                'tipo' => 'LIBRO',
                'estado' => self::ESTADO_PUBLICACION,
                'solo_suscriptores' => false,
                'codigo' => 'LIB-'.str_pad((string) $number, 4, '0', STR_PAD_LEFT),
                'titulo' => pathinfo((string) $file['name'], PATHINFO_FILENAME) ?: (string) $file['name'],
                'fecha_publicacion' => $lastModified->toDateString(),
                'link_url' => $file['web_url'],
                'descripcion' => $data['descripcion'] ?? 'Libro PDF importado desde SharePoint.',
                'autores' => $file['created_by'] ?? null,
                'fuente' => 'SharePoint',
                'archivo_pdf' => null,
                'nombre_archivo_original' => $file['name'],
                'sharepoint_url' => $file['web_url'],
                'sharepoint_file_id' => $file['id'],
                'sharepoint_file_name' => $file['name'],
                'sharepoint_file_type' => $file['mime_type'],
                'sharepoint_file_size' => $file['size'],
                'sharepoint_last_modified_at' => $file['last_modified_at'],
                'sharepoint_sync_status' => 'sincronizado',
                'sharepoint_synced_at' => now(),
                'sharepoint_error' => null,
            ]);
        });

        return (new PublicacionResource($publicacion))->response()->setStatusCode(201);
    }

    public function importManySharePointAtlas(Request $request, Departamento $departamento): JsonResponse
    {
        $this->ensureCanView($request, $departamento);
        $data = $request->validate([
            'sharepoint_file_ids' => ['required', 'array', 'min:1', 'max:50'],
            'sharepoint_file_ids.*' => ['required', 'string', 'max:1024', 'distinct'],
        ]);

        return $this->importManySharePointPdfs(
            request: $request,
            departamento: $departamento,
            fileIds: $data['sharepoint_file_ids'],
            tipo: 'LIBRO',
            resolveFile: fn(string $fileId) => $this->sharePointService->getPdfFileInsideRoot($fileId),
        );
    }

    public function browseSharePointGlobalAtlas(Request $request): JsonResponse
    {
        abort_unless($request->user()->rol === 'ADMIN', 403, 'No tienes permisos para importar Atlas global.');
        $data = $request->validate([
            'item_id' => ['nullable', 'string', 'max:1024'],
        ]);

        return response()->json([
            'data' => $this->sharePointService->browseAtlasFolder($data['item_id'] ?? null),
        ]);
    }

    public function importManySharePointGlobalAtlas(Request $request): JsonResponse
    {
        abort_unless($request->user()->rol === 'ADMIN', 403, 'No tienes permisos para importar Atlas global.');
        $data = $request->validate([
            'sharepoint_file_ids' => ['required', 'array', 'min:1', 'max:50'],
            'sharepoint_file_ids.*' => ['required', 'string', 'max:1024', 'distinct'],
        ]);

        return $this->importManySharePointPdfs(
            request: $request,
            departamento: null,
            fileIds: $data['sharepoint_file_ids'],
            tipo: 'ATLAS',
            resolveFile: fn(string $fileId) => $this->sharePointService->getPdfFileInsideRoot($fileId),
        );
    }

    public function importManySharePointArticulos(Request $request, Departamento $departamento): JsonResponse
    {
        $this->ensureCanView($request, $departamento);
        $data = $request->validate([
            'sharepoint_file_ids' => ['required', 'array', 'min:1', 'max:50'],
            'sharepoint_file_ids.*' => ['required', 'string', 'max:1024', 'distinct'],
        ]);

        return $this->importManySharePointPdfs(
            request: $request,
            departamento: $departamento,
            fileIds: $data['sharepoint_file_ids'],
            tipo: 'ARTICULO',
            resolveFile: fn(string $fileId) => $this->sharePointService->getPdfFileInsideBarometerRoot($fileId),
        );
    }

    public function importManySharePointReportes(Request $request, Departamento $departamento): JsonResponse
    {
        $this->ensureCanView($request, $departamento);
        $data = $request->validate([
            'sharepoint_file_ids' => ['required', 'array', 'min:1', 'max:50'],
            'sharepoint_file_ids.*' => ['required', 'string', 'max:1024', 'distinct'],
        ]);

        return $this->importManySharePointPdfs(
            request: $request,
            departamento: $departamento,
            fileIds: $data['sharepoint_file_ids'],
            tipo: 'REPORTE',
            resolveFile: fn(string $fileId) => $this->sharePointService->getPdfFileInsideBarometerRoot($fileId),
        );
    }

    private function importManySharePointPdfs(
        Request $request,
        ?Departamento $departamento,
        array $fileIds,
        string $tipo,
        callable $resolveFile,
    ): JsonResponse {

        $summary = [
            'imported' => [],
            'duplicates' => [],
            'rejected' => [],
            'errors' => [],
        ];

        foreach ($fileIds as $fileId) {
            try {
                $file = $resolveFile($fileId);
                $existing = $this->findSharePointPublication($departamento, (string) $file['id']);
                if ($existing) {
                    $summary['duplicates'][] = [
                        'sharepoint_file_id' => $file['id'],
                        'name' => $file['name'],
                        'publicacion_id' => $existing->id,
                        'message' => 'El archivo ya habia sido importado.',
                    ];
                    continue;
                }

                $publicacion = DB::transaction(fn() => $this->createSharePointPdfPublication(
                    request: $request,
                    departamento: $departamento,
                    file: $file,
                    tipo: $tipo,
                ));

                $summary['imported'][] = (new PublicacionResource($publicacion->refresh()))->resolve($request);
            } catch (RuntimeException $exception) {
                $message = $exception->getMessage();
                $bucket = str_contains(strtolower($message), 'pdf') ? 'rejected' : 'errors';
                $summary[$bucket][] = [
                    'sharepoint_file_id' => $fileId,
                    'message' => $message,
                ];
            } catch (\Throwable $exception) {
                Log::warning('SharePoint publication import failed', [
                    'sharepoint_file_id' => $fileId,
                    'tipo' => $tipo,
                    'departamento_id' => $departamento?->id,
                    'message' => $exception->getMessage(),
                    'exception' => $exception::class,
                ]);
                $summary['errors'][] = [
                    'sharepoint_file_id' => $fileId,
                    'message' => 'No se pudo importar el archivo seleccionado.',
                ];
            }
        }

        return response()->json([
            'data' => $summary,
            'totals' => [
                'imported' => count($summary['imported']),
                'duplicates' => count($summary['duplicates']),
                'rejected' => count($summary['rejected']),
                'errors' => count($summary['errors']),
            ],
        ]);
    }

    public function syncSharePointAtlas(Request $request, Departamento $departamento): JsonResponse
    {
        $this->ensureCanView($request, $departamento);
        $items = collect();

        foreach ($this->sharePointService->listPdfFiles() as $file) {
            $existing = $this->findSharePointPublication($departamento, (string) $file['id']);
            if ($existing) {
                $lastModified = $file['last_modified_at'] ? Carbon::parse($file['last_modified_at']) : $existing->sharepoint_last_modified_at;
                $existing->update([
                    'titulo' => pathinfo((string) $file['name'], PATHINFO_FILENAME) ?: (string) $file['name'],
                    'fecha_publicacion' => $lastModified?->toDateString() ?? $existing->fecha_publicacion,
                    'link_url' => $file['web_url'],
                    'autores' => $file['created_by'] ?? $existing->autores,
                    'fuente' => 'SharePoint',
                    'nombre_archivo_original' => $file['name'],
                    'sharepoint_url' => $file['web_url'],
                    'sharepoint_file_name' => $file['name'],
                    'sharepoint_file_type' => $file['mime_type'],
                    'sharepoint_file_size' => $file['size'],
                    'sharepoint_last_modified_at' => $file['last_modified_at'],
                    'sharepoint_sync_status' => 'sincronizado',
                    'sharepoint_synced_at' => now(),
                    'sharepoint_error' => null,
                ]);
                $items->push($existing->refresh());
                continue;
            }

            $items->push(DB::transaction(function () use ($request, $departamento, $file) {
                $counter = DB::table('publicacion_contadores')->where('tipo', 'LIBRO')->lockForUpdate()->first();
                abort_unless($counter, 500, 'No se pudo generar el codigo de publicacion.');
                $number = (int) $counter->siguiente_numero;
                DB::table('publicacion_contadores')->where('tipo', 'LIBRO')->update(['siguiente_numero' => $number + 1]);
                $lastModified = $file['last_modified_at'] ? Carbon::parse($file['last_modified_at']) : now();

                return ObservatorioPublicacion::create([
                    'departamento_id' => $departamento->id,
                    'creado_por' => $request->user()->id,
                    'tipo' => 'LIBRO',
                    'estado' => self::ESTADO_PUBLICACION,
                    'solo_suscriptores' => false,
                    'codigo' => 'LIB-'.str_pad((string) $number, 4, '0', STR_PAD_LEFT),
                    'titulo' => pathinfo((string) $file['name'], PATHINFO_FILENAME) ?: (string) $file['name'],
                    'fecha_publicacion' => $lastModified->toDateString(),
                    'link_url' => $file['web_url'],
                    'descripcion' => 'Libro PDF importado desde SharePoint.',
                    'autores' => $file['created_by'] ?? null,
                    'fuente' => 'SharePoint',
                    'archivo_pdf' => null,
                    'nombre_archivo_original' => $file['name'],
                    'sharepoint_url' => $file['web_url'],
                    'sharepoint_file_id' => $file['id'],
                    'sharepoint_file_name' => $file['name'],
                    'sharepoint_file_type' => $file['mime_type'],
                    'sharepoint_file_size' => $file['size'],
                    'sharepoint_last_modified_at' => $file['last_modified_at'],
                    'sharepoint_sync_status' => 'sincronizado',
                    'sharepoint_synced_at' => now(),
                    'sharepoint_error' => null,
                ]);
            }));
        }

        return response()->json([
            'data' => PublicacionResource::collection($items),
            'synced' => $items->count(),
        ]);
    }

    public function recentAtlasReports(Request $request): AnonymousResourceCollection
    {
        $query = ObservatorioPublicacion::query()
            ->where('tipo', 'ATLAS')
            ->whereNull('departamento_id')
            ->latest('created_at')
            ->limit(6);

        if ($request->user()->rol !== 'ADMIN') {
            $query->where('estado', self::ESTADO_PUBLICACION);
        }

        return PublicacionResource::collection($query->get());
    }

    private function upsertSharePointPublication(
        Request $request,
        Departamento $departamento,
        array $file,
        string $tipo,
        string $descripcion,
    ): ObservatorioPublicacion {
        $existing = $this->findSharePointPublication($departamento, (string) $file['id']);
        $lastModified = $file['last_modified_at'] ? Carbon::parse($file['last_modified_at']) : now();
        $linkUrl = $tipo === 'REPORTE' ? $file['powerbi_url'] : $file['web_url'];

        if ($existing) {
            $existing->update([
                'tipo' => $tipo,
                'titulo' => pathinfo((string) $file['name'], PATHINFO_FILENAME) ?: (string) $file['name'],
                'fecha_publicacion' => $lastModified->toDateString(),
                'link_url' => $linkUrl,
                'descripcion' => $existing->descripcion ?: $descripcion,
                'autores' => $file['created_by'] ?? $existing->autores,
                'fuente' => 'SharePoint',
                'archivo_pdf' => $tipo === 'ATLAS' ? $existing->archivo_pdf : null,
                'nombre_archivo_original' => $tipo === 'ATLAS' ? $file['name'] : null,
                'sharepoint_url' => $file['web_url'],
                'sharepoint_file_name' => $file['name'],
                'sharepoint_file_type' => $file['mime_type'],
                'sharepoint_file_size' => $file['size'],
                'sharepoint_last_modified_at' => $file['last_modified_at'],
                'sharepoint_sync_status' => 'sincronizado',
                'sharepoint_synced_at' => now(),
                'sharepoint_error' => null,
            ]);

            return $existing;
        }

        return DB::transaction(function () use ($request, $departamento, $file, $tipo, $descripcion, $lastModified, $linkUrl) {
            $counter = DB::table('publicacion_contadores')->where('tipo', $tipo)->lockForUpdate()->first();
            abort_unless($counter, 500, 'No se pudo generar el codigo de publicacion.');
            $number = (int) $counter->siguiente_numero;
            DB::table('publicacion_contadores')->where('tipo', $tipo)->update(['siguiente_numero' => $number + 1]);

            return ObservatorioPublicacion::create([
                'departamento_id' => $departamento->id,
                'creado_por' => $request->user()->id,
                'tipo' => $tipo,
                'estado' => self::ESTADO_PUBLICACION,
                'solo_suscriptores' => false,
                'codigo' => $this->codePrefix($tipo).str_pad((string) $number, 4, '0', STR_PAD_LEFT),
                'titulo' => pathinfo((string) $file['name'], PATHINFO_FILENAME) ?: (string) $file['name'],
                'fecha_publicacion' => $lastModified->toDateString(),
                'link_url' => $linkUrl,
                'descripcion' => $descripcion,
                'autores' => $file['created_by'] ?? null,
                'fuente' => 'SharePoint',
                'archivo_pdf' => null,
                'nombre_archivo_original' => $tipo === 'ATLAS' ? $file['name'] : null,
                'sharepoint_url' => $file['web_url'],
                'sharepoint_file_id' => $file['id'],
                'sharepoint_file_name' => $file['name'],
                'sharepoint_file_type' => $file['mime_type'],
                'sharepoint_file_size' => $file['size'],
                'sharepoint_last_modified_at' => $file['last_modified_at'],
                'sharepoint_sync_status' => 'sincronizado',
                'sharepoint_synced_at' => now(),
                'sharepoint_error' => null,
            ]);
        });
    }

    private function createSharePointPdfPublication(
        Request $request,
        ?Departamento $departamento,
        array $file,
        string $tipo,
    ): ObservatorioPublicacion {
        $counter = DB::table('publicacion_contadores')->where('tipo', $tipo)->lockForUpdate()->first();
        abort_unless($counter, 500, 'No se pudo generar el codigo de publicacion.');
        $number = (int) $counter->siguiente_numero;
        DB::table('publicacion_contadores')->where('tipo', $tipo)->update(['siguiente_numero' => $number + 1]);
        $lastModified = $file['last_modified_at'] ? Carbon::parse($file['last_modified_at']) : now();
        $isArticulo = $tipo === 'ARTICULO';
        $codePrefix = $this->codePrefix($tipo);

        return ObservatorioPublicacion::create([
            'departamento_id' => $departamento?->id,
            'creado_por' => $request->user()->id,
            'tipo' => $tipo,
            'estado' => self::ESTADO_PUBLICACION,
            'solo_suscriptores' => false,
            'codigo' => $codePrefix.str_pad((string) $number, 4, '0', STR_PAD_LEFT),
            'titulo' => pathinfo((string) $file['name'], PATHINFO_FILENAME) ?: (string) $file['name'],
            'fecha_publicacion' => $lastModified->toDateString(),
            'link_url' => $file['web_url'],
            'descripcion' => match ($tipo) {
                'ARTICULO' => 'Artículo PDF importado desde SharePoint.',
                'REPORTE' => 'Reporte PDF importado desde SharePoint.',
                'LIBRO' => 'Libro PDF importado desde SharePoint.',
                default => 'Atlas PDF importado desde SharePoint.',
            },
            'autores' => $file['created_by'] ?? ($isArticulo ? 'ULEAM' : null),
            'fuente' => 'SharePoint',
            'archivo_pdf' => null,
            'nombre_archivo_original' => $file['name'],
            'sharepoint_url' => $file['web_url'],
            'sharepoint_file_id' => $file['id'],
            'sharepoint_file_name' => $file['name'],
            'sharepoint_file_type' => $file['mime_type'],
            'sharepoint_file_size' => $file['size'],
            'sharepoint_last_modified_at' => $file['last_modified_at'],
            'sharepoint_sync_status' => 'sincronizado',
            'sharepoint_synced_at' => now(),
            'sharepoint_error' => null,
        ]);
    }

    private function findSharePointPublication(
        ?Departamento $departamento,
        string $sharePointFileId,
    ): ?ObservatorioPublicacion {
        $query = ObservatorioPublicacion::query()
            ->where('sharepoint_file_id', $sharePointFileId);

        if ($departamento) {
            $query->where('departamento_id', $departamento->id);
        } else {
            $query->whereNull('departamento_id');
        }

        return $query->first();
    }

    private function codePrefix(string $tipo): string
    {
        return match ($tipo) {
            'ARTICULO' => 'ART-',
            'REPORTE' => 'REP-',
            'LIBRO' => 'LIB-',
            default => 'ATL-',
        };
    }

    private function list(
        Request $request,
        Departamento $departamento,
        ?string $tipo,
        ?string $estado = null,
    ): AnonymousResourceCollection
    {
        $this->ensureCanView($request, $departamento);
        $query = $departamento->publicaciones()
            ->with('creadoPor')
            ->where('estado', '!=', 'ELIMINADO')
            ->latest('fecha_publicacion');
        if ($tipo) {
            $query->where('tipo', $tipo);
        }
        if ($estado) {
            $query->where('estado', $estado);
        }
        $this->applyVisibilityFilter($query, $request);
        return PublicacionResource::collection($query->get());
    }

    private function ensureCanView(Request $request, Departamento $departamento): void
    {
        $user = $request->user('sanctum') ?: $request->user();
        $hasAccess = ($user?->rol === 'ADMIN')
            || $departamento->publico
            || ($user && $departamento->usuarios()->where('users.id', $user->id)->exists());
        abort_unless($hasAccess, 403, 'No tienes acceso a este observatorio.');
    }

    private function applyVisibilityFilter($query, Request $request): void
    {
        $user = $request->user();
        if ($user->rol === 'ADMIN') {
            return;
        }

        if ($user->rol === 'EDITOR') {
            $query->where(function ($visibilityQuery) use ($user) {
                $visibilityQuery
                    ->where('estado', self::ESTADO_PUBLICACION)
                    ->orWhere('creado_por', $user->id);
            });
        } else {
            $query->where('estado', self::ESTADO_PUBLICACION);
        }

    }

    private function ensureCanViewPublication(Request $request, ObservatorioPublicacion $publicacion): void
    {
        $user = $request->user('sanctum') ?: $request->user();
        if ($user?->rol === 'ADMIN') {
            return;
        }

        if (
            $request->query('context') === 'management'
            && $user?->rol === 'EDITOR'
            && (int) $publicacion->creado_por === (int) $user->id
        ) {
            return;
        }

        abort_unless($publicacion->estado === self::ESTADO_PUBLICACION, 404, 'La publicación no está disponible.');

        if ($publicacion->solo_suscriptores) {
            abort_unless($this->isSubscriber($user), 403, 'Esta publicación es solo para suscriptores.');
        }
    }

    private function ensureCanManage(Request $request, Departamento $departamento): void
    {
        $user = $request->user();
        if ($user->rol === 'ADMIN') {
            return;
        }

        abort_unless($user->rol === 'EDITOR', 403, 'No tienes permisos para gestionar publicaciones.');
        abort_unless(
            $departamento->usuarios()
                ->where('users.id', $user->id)
                ->wherePivotIn('rol', ['ADMIN', 'EDITOR'])
                ->exists(),
            403,
            'No tienes acceso de edición a este observatorio.'
        );
    }

    private function isSubscriber($user): bool
    {
        return $user && in_array($user->rol, [self::SUBSCRIBER_ROLE, 'SUSCRIPTOR', 'SUBSCRIPTOR'], true);
    }

}
