<?php

declare(strict_types=1);

namespace App\Application\Publicaciones;

use App\Models\ObservatorioPublicacion;
use App\Presentation\Http\Controllers\Api\ObservatorioPublicacionController;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Throwable;

/** Routes old identities to their single destination. Never creates a conversion. */
final class LegacyPublicationBridge
{
    public function resolve(string $source, string $id, bool $lock = false): ?array
    {
        $type = PublicationOrigins::TYPES[$source] ?? throw new \InvalidArgumentException('Invalid publication source.');
        $origin = null;
        if (Schema::hasTable('publication_origins')) {
            $map = DB::table('publication_origins')->where('source_table', $source)->where('source_id', $id);
            $origin = ($lock ? $map->lockForUpdate() : $map)->first();
        }
        if (! Schema::hasTable('observatorio_publicaciones')) { abort_if($origin !== null, 404); return null; }
        $native = ObservatorioPublicacion::withoutGlobalScopes()->whereKey($id)->where('tipo', $type)->first();
        // Never guess between two different resources sharing a URL identity.
        if ($origin && $native && $origin->target_id !== $native->id) { abort(409, 'Identidad ambigua; utiliza la biblioteca de publicaciones.'); }
        if ($origin?->source_kind === 'compatibility' && DB::table($source)->where('id', $id)->exists()) {
            abort(409, 'Identidad ambigua; utiliza la biblioteca de publicaciones.');
        }
        if (! $origin && $native && DB::table($source)->where('id', $id)->exists()) {
            abort(409, 'Identidad ambigua; utiliza la biblioteca de publicaciones.');
        }
        if (! $origin && ! $native) { return null; }
        if (! $origin && $native && Schema::hasTable('publication_origins')) {
            $map = DB::table('publication_origins')->where('target_id', $native->id);
            $origin = ($lock ? $map->lockForUpdate() : $map)->first();
        }
        $query = ObservatorioPublicacion::query()->whereKey($origin?->target_id ?? $id)->where('tipo', $type);
        $publication = ($lock ? $query->lockForUpdate() : $query)->first();
        abort_unless($publication, 404);

        return ['publication' => $publication, 'origin' => $origin];
    }

    public function canWrite(Request $request, string $source, string $id): bool
    {
        $resolved = $this->resolve($source, $id);
        $user = $request->user();
        return $resolved !== null && $user?->canReadPublicationForManagement($resolved['publication'])
            && ! ($user->isEditor() && $resolved['publication']->estado === 'RECHAZADO');
    }

    public function canCreate(Request $request, string $source): bool
    {
        $department = $request->input('departamento_id'); $user = $request->user();
        if (! $user || ! isset(PublicationOrigins::TYPES[$source]) || ! is_string($department) || ! Str::isUuid($department)) { return false; }
        $probe = new ObservatorioPublicacion(['departamento_id' => $department, 'creado_por' => $user->id,
            'tipo' => PublicationOrigins::TYPES[$source]]);
        return $probe->departamento !== null && $user->canReadPublicationForManagement($probe);
    }

    /** Old creation payload, new storage. No legacy row is inserted. */
    public function create(Request $request, string $source): JsonResponse
    {
        abort_unless(in_array($request->user()?->rol, ['ADMIN', 'ADMIN_OBSERVATORIO', 'EDITOR'], true), 403);
        if (is_string($request->input('departamento_id')) && Str::isUuid($request->input('departamento_id'))
            && ! $this->canCreate($request, $source)) { abort(403); }
        $article = $source === 'articulos'; $title = $article ? 'titulo' : 'nombre_indicador';
        $values = $request->validate([
            $title => ['required', 'string', 'max:255'], 'departamento_id' => ['required', 'uuid'],
            'fecha_publicacion' => ['required', 'date'], 'fecha_recepcion' => ['nullable', 'date'],
            'descripcion' => ['nullable', 'string', 'max:3000'], 'descripcion_indicador' => ['nullable', 'string', 'max:3000'],
            'autor' => ['nullable', 'string', 'max:255'], 'fuente' => ['nullable', 'string', 'max:255'],
            'categoria_id' => ['nullable', 'uuid', 'exists:categorias_dataset,id'],
            'enlace' => ['nullable', 'url:http,https', 'max:2048'],
            'link_url' => [$article ? 'nullable' : 'required', 'url:http,https', 'max:2048'],
            'estado' => ['sometimes', 'in:PUBLICADO,BORRADOR,'.implode(',', ObservatorioPublicacion::ESTADOS)],
            'observacion_revision' => ['nullable', 'string', 'max:2000'],
            'visibilidad' => ['sometimes', 'in:publico,suscriptor,privado'],
            'ficha' => ['sometimes', 'file', 'mimes:pdf', 'mimetypes:application/pdf,application/x-pdf', 'max:20480'],
        ]);
        abort_unless($this->canCreate($request, $source), 403);
        $user = $request->user(); $reviewer = $user->canReviewObservatory($values['departamento_id']);
        $state = match ($values['estado'] ?? 'EN_REVISION') { 'PUBLICADO' => 'PUBLICACION', 'BORRADOR' => 'EN_REVISION', default => $values['estado'] ?? 'EN_REVISION' };
        if (! $reviewer && ($state !== 'EN_REVISION' || isset($values['observacion_revision']) || ($values['visibilidad'] ?? 'publico') !== 'publico')) { abort(403); }
        if (in_array($state, ObservatorioPublicacion::ESTADOS_CON_OBSERVACION, true) && strlen(trim($values['observacion_revision'] ?? '')) < 3) {
            throw ValidationException::withMessages(['observacion_revision' => 'Indica el motivo de revisión.']);
        }
        $newPath = null;
        try {
            return DB::transaction(function () use ($request, $source, $article, $title, $values, $user, $state, &$newPath): JsonResponse {
                abort_unless($this->canCreate($request, $source), 403);
                $id = (string) Str::uuid(); $type = PublicationOrigins::TYPES[$source];
                $counter = DB::table('publicacion_contadores')->where('tipo', $type)->lockForUpdate()->first();
                abort_unless($counter, 503);
                DB::table('publicacion_contadores')->where('tipo', $type)->increment('siguiente_numero');
                $file = $request->file('ficha');
                if ($file) {
                    abort_if($article, 422);
                    $newPath = 'publicaciones/compatibilidad/'.$id.'/'.Str::uuid().'.pdf';
                    abort_unless(Storage::disk(config('filesystems.default'))->putFileAs(dirname($newPath), $file, basename($newPath)) === $newPath, 503);
                }
                $p = (new ObservatorioPublicacion())->forceFill([
                    'id' => $id, 'tipo' => $type, 'codigo' => ($article ? 'ART-' : 'REP-').str_pad((string) $counter->siguiente_numero, 4, '0', STR_PAD_LEFT),
                    'departamento_id' => $values['departamento_id'], 'creado_por' => $user->id, 'titulo' => $values[$title],
                    'fecha_publicacion' => $values['fecha_publicacion'], 'descripcion' => $values[$article ? 'descripcion' : 'descripcion_indicador'] ?? null,
                    'autores' => $article && filled($values['autor'] ?? null) ? [$values['autor']] : [], 'fuente' => $values['fuente'] ?? null,
                    'link_url' => $values[$article ? 'enlace' : 'link_url'] ?? null, 'estado' => $state,
                    'observacion_revision' => in_array($state, ObservatorioPublicacion::ESTADOS_CON_OBSERVACION, true) ? $values['observacion_revision'] : null,
                    'solo_suscriptores' => ($values['visibilidad'] ?? 'publico') === 'suscriptor',
                    'visibilidad_legada' => ($values['visibilidad'] ?? 'publico') === 'privado' ? 'privado' : null,
                    'archivo_pdf' => $newPath, 'nombre_archivo_original' => $file?->getClientOriginalName(),
                ]);
                $p->saveOrFail();
                $originId = (string) Str::uuid();
                DB::table('publication_origins')->insert(['id' => $originId, 'source_table' => $source, 'source_kind' => 'compatibility',
                    'source_id' => $id, 'target_id' => $id, 'categoria_id' => $values['categoria_id'] ?? null,
                    'fecha_recepcion' => $article ? ($values['fecha_recepcion'] ?? null) : null, 'created_at' => now(), 'updated_at' => now()]);
                return response()->json($this->row($request, $source, ['publication' => $p,
                    'origin' => DB::table('publication_origins')->where('id', $originId)->first()]), 201);
            });
        } catch (Throwable $e) {
            if ($newPath) { Storage::disk(config('filesystems.default'))->delete($newPath); }
            throw $e;
        }
    }

    private function authorizeRead(Request $request, ObservatorioPublicacion $p): void
    {
        $user = $request->user('sanctum') ?: $request->user();
        $management = $request->query('context') === 'management' && $user?->canReadPublicationForManagement($p);
        if ($management) { return; }
        abort_unless($p->departamento?->publico && $p->estado === 'PUBLICACION' && ! $p->hasPrivateLegacyAccess(), 404);
        abort_if($p->solo_suscriptores && ! ($user?->isAdmin() || $user?->isSubscriber()), 403);
    }

    public function show(Request $request, string $source, string $id): ?JsonResponse
    {
        $resolved = $this->resolve($source, $id);
        if (! $resolved) { return null; }
        $this->authorizeRead($request, $resolved['publication']);
        return response()->json($this->row($request, $source, $resolved))->header('Cache-Control', 'private, no-store');
    }

    /** Lock the source before checking its map, including the not-yet-converted path. */
    public function write(Request $request, string $source, string $id, callable $fallback, bool $delete = false): JsonResponse
    {
        abort_unless(isset(PublicationOrigins::TYPES[$source]), 404);
        $newPath = null;
        try {
            return DB::transaction(function () use ($request, $source, $id, $fallback, $delete, &$newPath): JsonResponse {
                DB::table($source)->where('id', $id)->lockForUpdate()->first();
                $resolved = $this->resolve($source, $id, true);
                if (! $resolved) { return $fallback(); }
                $p = $resolved['publication']; $user = $request->user();
                abort_unless($p->departamento && $user?->canReadPublicationForManagement($p), 403);
                abort_if($user->isEditor() && $p->estado === 'RECHAZADO', 403);
                if ($delete) {
                    // Retain the destination/map/files so the old source cannot resurface.
                    $p->forceFill(['eliminado_legado_at' => now()])->saveOrFail();
                    return response()->json(['message' => 'Publicación eliminada.']);
                }
                $values = $request->validate([
                    'titulo' => ['sometimes', 'string', 'max:255'], 'nombre_indicador' => ['sometimes', 'string', 'max:255'],
                    'descripcion' => ['sometimes', 'nullable', 'string', 'max:3000'],
                    'descripcion_indicador' => ['sometimes', 'nullable', 'string', 'max:3000'],
                    'autor' => ['sometimes', 'nullable', 'string', 'max:255'], 'fuente' => ['sometimes', 'nullable', 'string', 'max:255'],
                    'fecha_publicacion' => ['sometimes', 'required', 'date'], 'fecha_recepcion' => ['sometimes', 'nullable', 'date'],
                    'categoria_id' => ['sometimes', 'nullable', 'uuid', 'exists:categorias_dataset,id'],
                    'departamento_id' => ['sometimes', 'required', 'uuid'],
                    'enlace' => ['sometimes', 'nullable', 'url:http,https', 'max:2048'],
                    'link_url' => ['sometimes', 'nullable', 'url:http,https', 'max:2048'],
                    'estado' => ['sometimes', 'required', 'in:PUBLICADO,BORRADOR,'.implode(',', ObservatorioPublicacion::ESTADOS)],
                    'observacion_revision' => ['sometimes', 'nullable', 'string', 'max:2000'],
                    'visibilidad' => ['sometimes', 'required', 'in:publico,suscriptor,privado'],
                    'ficha' => ['sometimes', 'file', 'mimes:pdf', 'mimetypes:application/pdf,application/x-pdf', 'max:20480'],
                ]);
                if (isset($values['departamento_id']) && $values['departamento_id'] !== $p->departamento_id) {
                    throw ValidationException::withMessages(['departamento_id' => 'El observatorio de una publicación convertida no se cambia desde el formulario antiguo.']);
                }
                $visibility = $p->hasPrivateLegacyAccess() ? 'privado' : ($p->solo_suscriptores ? 'suscriptor' : 'publico');
                if (isset($values['visibilidad']) && $values['visibilidad'] !== $visibility) {
                    throw ValidationException::withMessages(['visibilidad' => 'Gestiona el acceso desde el formulario de revisión actual.']);
                }
                $state = match ($values['estado'] ?? $p->estado) { 'PUBLICADO' => 'PUBLICACION', 'BORRADOR' => 'EN_REVISION', default => $values['estado'] ?? $p->estado };
                if (($state !== $p->estado || array_key_exists('observacion_revision', $values)) && ! $user->canReviewObservatory($p->departamento_id)) { abort(403); }
                $reason = $values['observacion_revision'] ?? $p->observacion_revision;
                if (in_array($state, ObservatorioPublicacion::ESTADOS_CON_OBSERVACION, true) && strlen(trim($reason ?? '')) < 3) {
                    throw ValidationException::withMessages(['observacion_revision' => 'Indica el motivo de la decisión de revisión.']);
                }
                $article = $source === 'articulos';
                $updates = array_intersect_key($values, array_flip(['fuente', 'fecha_publicacion']));
                foreach ([($article ? 'titulo' : 'nombre_indicador') => 'titulo',
                    ($article ? 'descripcion' : 'descripcion_indicador') => 'descripcion',
                    ($article ? 'enlace' : 'link_url') => 'link_url'] as $old => $new) {
                    if (array_key_exists($old, $values)) { $updates[$new] = $values[$old]; }
                }
                if (! $article && array_key_exists('link_url', $updates) && ! filled($updates['link_url'])) {
                    throw ValidationException::withMessages(['link_url' => 'El reporte requiere un enlace.']);
                }
                if ($article && array_key_exists('autor', $values)) { $updates['autores'] = filled($values['autor']) ? [$values['autor']] : []; }
                if ($request->hasFile('ficha')) {
                    abort_unless(! $article, 422);
                    $file = $request->file('ficha');
                    $newPath = 'publicaciones/compatibilidad/'.$p->id.'/'.Str::uuid().'.pdf';
                    $stored = Storage::disk(config('filesystems.default'))->putFileAs(dirname($newPath), $file, basename($newPath));
                    abort_unless(is_string($stored) && $stored === $newPath, 503, 'No se pudo guardar el PDF.');
                    $updates += ['archivo_pdf' => $newPath, 'nombre_archivo_original' => $file->getClientOriginalName(),
                        'sharepoint_url' => null, 'sharepoint_file_id' => null];
                }
                $p->fill($updates);
                if ($user->canReviewObservatory($p->departamento_id)) {
                    $p->estado = $state;
                    if ($state !== $p->getOriginal('estado') || array_key_exists('observacion_revision', $values)) {
                        $p->observacion_revision = in_array($state, ObservatorioPublicacion::ESTADOS_CON_OBSERVACION, true) ? $reason : null;
                        $p->fecha_revision = now();
                    }
                }
                $p->saveOrFail();
                $metadata = array_intersect_key($values, array_flip(['categoria_id', 'fecha_recepcion']));
                if ($metadata) {
                    if (! $resolved['origin']) { throw ValidationException::withMessages(['categoria_id' => 'Esta publicación no tiene metadatos de origen antiguo.']); }
                    DB::table('publication_origins')->where('id', $resolved['origin']->id)->update([...$metadata, 'updated_at' => now()]);
                    $resolved['origin'] = DB::table('publication_origins')->where('id', $resolved['origin']->id)->first();
                }
                return response()->json($this->row($request, $source, $resolved))->header('Cache-Control', 'private, no-store');
            });
        } catch (Throwable $e) {
            if ($newPath) { Storage::disk(config('filesystems.default'))->delete($newPath); }
            throw $e;
        }
    }

    public function file(Request $request, string $filename): mixed
    {
        if (! Schema::hasTable('publication_origins')) { return null; }
        $maps = DB::table('publication_origins')->where('source_table', 'reportes')->where('legacy_file_name', $filename)->get();
        if ($maps->isEmpty()) { return null; }
        // Ambiguous/shared identities are never resolved by picking the first row.
        abort_unless($maps->count() === 1, 404);
        $map = $maps->first();
        $otherReferences = DB::table('reportes')->where('id', '!=', $map->source_id)
            ->where('ficha_indicador', 'like', '%'.$filename)->get(['ficha_indicador']);
        abort_if($otherReferences->contains(fn ($row) => basename(parse_url((string) $row->ficha_indicador, PHP_URL_PATH) ?: '') === $filename), 404);
        $resolved = $this->resolve('reportes', $map->source_id);
        abort_unless($resolved, 404);
        $this->authorizeRead($request, $resolved['publication']);
        return app(ObservatorioPublicacionController::class)->download($request, $resolved['publication']);
    }

    private function row(Request $request, string $source, array $resolved): array
    {
        $p = $resolved['publication']; $origin = $resolved['origin'];
        $category = $origin?->categoria_id ? DB::table('categorias_dataset')->where('id', $origin->categoria_id)->first() : null;
        $download = $p->archivo_pdf ? '/api/departamentos/publicaciones/'.$p->id.'/download' : null;
        $link = $p->sharepoint_file_id && $p->link_url === $p->sharepoint_url ? null : $p->link_url;
        if ($download && ($request->query('context') === 'management' || $request->method() !== 'GET')) {
            $download .= '?context=management';
        }
        $row = ['id' => $p->id, 'codigo' => $p->codigo, 'departamento_id' => $p->departamento_id,
            'departamento' => $p->departamento ? ['id' => $p->departamento->id, 'nombre' => $p->departamento->nombre] : null,
            'categoria_id' => $origin?->categoria_id, 'categoria' => $category ? ['id' => $category->id, 'nombre' => $category->nombre,
                'codigo' => $category->codigo, 'color' => $category->color, 'icono' => $category->icono] : null,
            'fecha_publicacion' => $p->fecha_publicacion?->format('Y-m-d'),
            'fecha_recepcion' => $origin?->fecha_recepcion ? substr((string) $origin->fecha_recepcion, 0, 10) : null,
            'fuente' => $p->fuente, 'visibilidad' => $p->hasPrivateLegacyAccess() ? 'privado' : ($p->solo_suscriptores ? 'suscriptor' : 'publico'),
            'estado' => $p->estado, 'download_url' => $download, 'link_url' => $link,
            'created_at' => $p->created_at?->toIso8601String(), 'updated_at' => $p->updated_at?->toIso8601String()];

        return $source === 'articulos'
            ? [...$row, 'titulo' => $p->titulo, 'descripcion' => $p->descripcion, 'autor' => $p->autores, 'enlace' => $download ?: $link]
            : [...$row, 'nombre_indicador' => $p->titulo, 'descripcion_indicador' => $p->descripcion, 'autores' => $p->autores, 'ficha_indicador' => $download];
    }
}
