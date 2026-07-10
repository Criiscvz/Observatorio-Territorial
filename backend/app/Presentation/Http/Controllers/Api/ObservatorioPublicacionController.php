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
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

class ObservatorioPublicacionController extends Controller
{
    private const ESTADO_PUBLICACION = 'PUBLICACION';
    private const ESTADO_EN_REVISION = 'EN_REVISION';
    private const ESTADO_ELIMINADO = 'ELIMINADO';
    private const SUBSCRIBER_ROLE = 'SUBSCRIBER';

    public function __construct(private readonly SharePointService $sharePointService)
    {
    }

    public function index(Request $request, Departamento $departamento): AnonymousResourceCollection
    {
        $tipo = $request->filled('tipo')
            ? $request->validate(['tipo' => ['in:ARTICULO,REPORTE,ATLAS']])['tipo']
            : null;

        return $this->list($request, $departamento, $tipo);
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
        return $this->list($request, $departamento, 'ATLAS');
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
            ? $file->storeAs('publicaciones/'.$departamento->id, Str::uuid().'.pdf', 'local')
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
                    'codigo' => match ($data['tipo']) {
                        'ARTICULO' => 'ART-',
                        'ATLAS' => 'ATL-',
                        default => 'REP-',
                    }.str_pad((string) $number, 4, '0', STR_PAD_LEFT),
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
                Storage::disk('local')->delete($path);
            }
            throw $exception;
        }

        return (new PublicacionResource($publicacion->refresh()->load('creadoPor')))->response()->setStatusCode(201);
    }

    public function download(Request $request, ObservatorioPublicacion $publicacion): BinaryFileResponse|\Illuminate\Http\RedirectResponse
    {
        $this->ensureCanView($request, $publicacion->departamento);
        $this->ensureCanViewPublication($request, $publicacion);
        if (! $publicacion->archivo_pdf && $publicacion->sharepoint_url) {
            return redirect()->away($publicacion->sharepoint_url);
        }
        abort_unless(Storage::disk('local')->exists($publicacion->archivo_pdf), 404, 'El PDF no está disponible.');

        return response()->download(
            Storage::disk('local')->path($publicacion->archivo_pdf),
            $publicacion->nombre_archivo_original ?? $publicacion->titulo.'.pdf',
            ['Content-Type' => 'application/pdf']
        );
    }

    public function update(UpdatePublicacionRequest $request, ObservatorioPublicacion $publicacion): JsonResponse
    {
        $this->ensureCanManage($request, $publicacion->departamento);
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
            $newPath = $newFile->storeAs(
                'publicaciones/'.$publicacion->departamento_id,
                Str::uuid().'.pdf',
                'local'
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
                    'autores' => $publicacion->tipo === 'ARTICULO' ? $data['autores'] : null,
                    'fuente' => $data['fuente'],
                    ...($newFile ? [
                        'archivo_pdf' => $newPath,
                        'nombre_archivo_original' => $newFile->getClientOriginalName(),
                    ] : []),
                ]);
            });
        } catch (\Throwable $exception) {
            if ($newPath) {
                Storage::disk('local')->delete($newPath);
            }
            throw $exception;
        }

        if ($newPath && $oldPath && $oldPath !== $newPath) {
            Storage::disk('local')->delete($oldPath);
        }

        return (new PublicacionResource($publicacion->refresh()->load('creadoPor')))->response();
    }

    public function sharePointFiles(Request $request, Departamento $departamento): JsonResponse
    {
        $this->ensureCanView($request, $departamento);

        return response()->json([
            'data' => $this->sharePointService->listPdfFiles(),
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

        $file = $this->sharePointService->getFile($data['sharepoint_file_id']);
        $existing = ObservatorioPublicacion::where('sharepoint_file_id', $file['id'])->first();
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
            $counter = DB::table('publicacion_contadores')->where('tipo', 'ATLAS')->lockForUpdate()->first();
            abort_unless($counter, 500, 'No se pudo generar el código de publicación.');
            $number = (int) $counter->siguiente_numero;
            DB::table('publicacion_contadores')->where('tipo', 'ATLAS')->update(['siguiente_numero' => $number + 1]);

            $lastModified = $file['last_modified_at'] ? Carbon::parse($file['last_modified_at']) : now();

            return ObservatorioPublicacion::create([
                'departamento_id' => $departamento->id,
                'creado_por' => $request->user()->id,
                'tipo' => 'ATLAS',
                'estado' => self::ESTADO_PUBLICACION,
                'solo_suscriptores' => false,
                'codigo' => 'ATL-'.str_pad((string) $number, 4, '0', STR_PAD_LEFT),
                'titulo' => pathinfo((string) $file['name'], PATHINFO_FILENAME) ?: (string) $file['name'],
                'fecha_publicacion' => $lastModified->toDateString(),
                'link_url' => $file['web_url'],
                'descripcion' => $data['descripcion'] ?? 'Reporte PDF importado desde SharePoint.',
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

    public function syncSharePointAtlas(Request $request, Departamento $departamento): JsonResponse
    {
        $this->ensureCanView($request, $departamento);
        $items = collect();

        foreach ($this->sharePointService->listPdfFiles() as $file) {
            $existing = ObservatorioPublicacion::where('sharepoint_file_id', $file['id'])->first();
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
                $counter = DB::table('publicacion_contadores')->where('tipo', 'ATLAS')->lockForUpdate()->first();
                abort_unless($counter, 500, 'No se pudo generar el codigo de publicacion.');
                $number = (int) $counter->siguiente_numero;
                DB::table('publicacion_contadores')->where('tipo', 'ATLAS')->update(['siguiente_numero' => $number + 1]);
                $lastModified = $file['last_modified_at'] ? Carbon::parse($file['last_modified_at']) : now();

                return ObservatorioPublicacion::create([
                    'departamento_id' => $departamento->id,
                    'creado_por' => $request->user()->id,
                    'tipo' => 'ATLAS',
                    'estado' => self::ESTADO_PUBLICACION,
                    'solo_suscriptores' => false,
                    'codigo' => 'ATL-'.str_pad((string) $number, 4, '0', STR_PAD_LEFT),
                    'titulo' => pathinfo((string) $file['name'], PATHINFO_FILENAME) ?: (string) $file['name'],
                    'fecha_publicacion' => $lastModified->toDateString(),
                    'link_url' => $file['web_url'],
                    'descripcion' => 'Reporte PDF importado desde SharePoint.',
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
            ->with('departamento')
            ->latest('created_at')
            ->limit(6);

        if ($request->user()->rol !== 'ADMIN') {
            $query->where('estado', self::ESTADO_PUBLICACION);
            if (! $this->isSubscriber($request->user())) {
                $query->where('solo_suscriptores', false);
            }
            $query->whereHas('departamento', function ($departamentoQuery) use ($request) {
                $departamentoQuery
                    ->where('publico', true)
                    ->orWhereHas('usuarios', fn($userQuery) => $userQuery->where('users.id', $request->user()->id));
            });
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
        $existing = ObservatorioPublicacion::where('sharepoint_file_id', $file['id'])->first();
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
                'codigo' => ($tipo === 'ATLAS' ? 'ATL-' : 'REP-').str_pad((string) $number, 4, '0', STR_PAD_LEFT),
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

    private function list(Request $request, Departamento $departamento, ?string $tipo): AnonymousResourceCollection
    {
        $this->ensureCanView($request, $departamento);
        $query = $departamento->publicaciones()->with('creadoPor')->latest('fecha_publicacion');
        if ($tipo) {
            $query->where('tipo', $tipo);
        }
        $this->applyVisibilityFilter($query, $request);
        return PublicacionResource::collection($query->get());
    }

    private function ensureCanView(Request $request, Departamento $departamento): void
    {
        $user = $request->user();
        $hasAccess = $user->rol === 'ADMIN' || $departamento->publico
            || $departamento->usuarios()->where('users.id', $user->id)->exists();
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

        if (! $this->isSubscriber($user)) {
            $query->where('solo_suscriptores', false);
        }
    }

    private function ensureCanViewPublication(Request $request, ObservatorioPublicacion $publicacion): void
    {
        $user = $request->user();
        if ($user->rol === 'ADMIN') {
            return;
        }

        if ($user->rol === 'EDITOR' && (int) $publicacion->creado_por === (int) $user->id) {
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
        return in_array($user->rol, [self::SUBSCRIBER_ROLE, 'SUSCRIPTOR', 'SUBSCRIPTOR'], true);
    }

}
