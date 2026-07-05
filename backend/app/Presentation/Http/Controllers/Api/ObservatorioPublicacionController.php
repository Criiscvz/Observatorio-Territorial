<?php

declare(strict_types=1);

namespace App\Presentation\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Departamento;
use App\Models\ObservatorioPublicacion;
use App\Presentation\Http\Requests\Publicacion\StorePublicacionRequest;
use App\Presentation\Http\Requests\Publicacion\UpdatePublicacionRequest;
use App\Presentation\Http\Resources\Publicacion\PublicacionResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

class ObservatorioPublicacionController extends Controller
{
    public function index(Request $request, Departamento $departamento): AnonymousResourceCollection
    {
        $tipo = $request->filled('tipo')
            ? $request->validate(['tipo' => ['in:ARTICULO,REPORTE']])['tipo']
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

    public function store(StorePublicacionRequest $request, Departamento $departamento): JsonResponse
    {
        $data = $request->validated();
        $file = $request->file('archivo');
        $path = $file->storeAs('publicaciones/'.$departamento->id, Str::uuid().'.pdf', 'local');

        try {
            $publicacion = DB::transaction(function () use ($data, $request, $departamento, $file, $path) {
                $counter = DB::table('publicacion_contadores')->where('tipo', $data['tipo'])->lockForUpdate()->first();
                abort_unless($counter, 500, 'No se pudo generar el código de publicación.');
                $number = (int) $counter->siguiente_numero;
                DB::table('publicacion_contadores')->where('tipo', $data['tipo'])->update(['siguiente_numero' => $number + 1]);

                return ObservatorioPublicacion::create([
                    'departamento_id' => $departamento->id,
                    'creado_por' => $request->user()->id,
                    'tipo' => $data['tipo'],
                    'codigo' => ($data['tipo'] === 'ARTICULO' ? 'ART-' : 'REP-').str_pad((string) $number, 4, '0', STR_PAD_LEFT),
                    'titulo' => $data['titulo'],
                    'fecha_publicacion' => $data['fecha_publicacion'],
                    'link_url' => $data['link_url'],
                    'descripcion' => $data['descripcion'] ?? null,
                    'autores' => $data['autores'] ?? null,
                    'fuente' => $data['fuente'],
                    'archivo_pdf' => $path,
                    'nombre_archivo_original' => $file->getClientOriginalName(),
                ]);
            });
        } catch (\Throwable $exception) {
            Storage::disk('local')->delete($path);
            throw $exception;
        }

        return (new PublicacionResource($publicacion))->response()->setStatusCode(201);
    }

    public function download(Request $request, ObservatorioPublicacion $publicacion): BinaryFileResponse
    {
        $this->ensureCanView($request, $publicacion->departamento);
        abort_unless(Storage::disk('local')->exists($publicacion->archivo_pdf), 404, 'El PDF no está disponible.');

        return response()->download(
            Storage::disk('local')->path($publicacion->archivo_pdf),
            $publicacion->nombre_archivo_original,
            ['Content-Type' => 'application/pdf']
        );
    }

    public function update(UpdatePublicacionRequest $request, ObservatorioPublicacion $publicacion): JsonResponse
    {
        $data = $request->validated();
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
            DB::transaction(function () use ($data, $publicacion, $newFile, $newPath) {
                $publicacion->update([
                    'titulo' => $data['titulo'],
                    'fecha_publicacion' => $data['fecha_publicacion'],
                    'link_url' => $data['link_url'],
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

        if ($newPath && $oldPath !== $newPath) {
            Storage::disk('local')->delete($oldPath);
        }

        return (new PublicacionResource($publicacion->refresh()))->response();
    }

    private function list(Request $request, Departamento $departamento, ?string $tipo): AnonymousResourceCollection
    {
        $this->ensureCanView($request, $departamento);
        $query = $departamento->publicaciones()->latest('fecha_publicacion');
        if ($tipo) {
            $query->where('tipo', $tipo);
        }
        return PublicacionResource::collection($query->get());
    }

    private function ensureCanView(Request $request, Departamento $departamento): void
    {
        $user = $request->user();
        $hasAccess = $user->rol === 'ADMIN' || $departamento->publico
            || $departamento->usuarios()->where('users.id', $user->id)->exists();
        abort_unless($hasAccess, 403, 'No tienes acceso a este observatorio.');
    }
}
