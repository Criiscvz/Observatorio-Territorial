<?php

declare(strict_types=1);

namespace App\Application\Publicaciones;

use App\Models\ObservatorioPublicacion;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\Validator;
use Throwable;

/** Explicitly armed disposable-DB rehearsal. Never called by HTTP or deployment migrations. */
class LegacyPublicationRehearsal
{
    private const TABLE = 'phase2_publication_imports';

    public function assertDisposable(): void
    {
        $connection = config('database.default');
        $database = config("database.connections.{$connection}.database");
        $host = config("database.connections.{$connection}.host");
        $safe = $connection === 'sqlite' && $database === ':memory:';
        $safe = $safe || ($connection === 'pgsql' && in_array($host, ['127.0.0.1', 'localhost', 'postgres'], true)
            && preg_match('/(?:^|_)(test|testing)$/i', (string) $database));
        if (! app()->environment('testing') || ! config('publications.legacy_rehearsal_enabled') || ! $safe
            || config('filesystems.default') !== 'phase2-rehearsal'
            || config('filesystems.disks.phase2-rehearsal.driver') !== 'local'
            || filled(config("database.connections.{$connection}.url"))) {
            throw new LegacyRehearsalBlocked('Rehearsal requires explicit enablement, testing, a disposable local database and the dedicated rehearsal filesystem.');
        }
    }

    public function prepare(): void
    {
        $this->assertDisposable();
        if (! Schema::hasColumns('observatorio_publicaciones', ['visibilidad_legada', 'eliminado_legado_at'])
            || ! Schema::hasTable('publication_origins')) {
            throw new LegacyRehearsalBlocked('Apply the preservation schema to the disposable database before rehearsal.');
        }
        // The old nullable-file migration only handled PostgreSQL. Match that
        // actual target schema in the disposable SQLite rehearsal too.
        if (DB::getDriverName() === 'sqlite') {
            Schema::table('observatorio_publicaciones', function (Blueprint $table): void {
                $table->string('archivo_pdf')->nullable()->change();
                $table->string('nombre_archivo_original')->nullable()->change();
            });
        }
        if (! Schema::hasTable(self::TABLE)) {
            Schema::create(self::TABLE, function (Blueprint $table): void {
                $table->uuid('id')->primary();
                $table->uuid('batch_id')->index();
                $table->string('source_table', 20);
                $table->uuid('source_id');
                $table->foreignUuid('target_id')->unique()->constrained('observatorio_publicaciones')->restrictOnDelete();
                $table->string('source_hash', 64);
                $table->string('target_hash', 64);
                $table->string('decision_hash', 64);
                $table->string('manifest_hash', 64);
                $table->unsignedInteger('batch_size');
                $table->uuid('categoria_id')->nullable();
                $table->date('fecha_recepcion')->nullable();
                $table->string('metadata_hash', 64);
                $table->string('origin_hash', 64);
                $table->json('source_snapshot');
                $table->json('decisions');
                $table->json('file_manifest')->nullable();
                $table->timestamp('created_at');
                $table->unique(['source_table', 'source_id']);
            });
        }
        if (! Schema::hasColumns(self::TABLE, ['manifest_hash', 'batch_size', 'categoria_id', 'fecha_recepcion', 'metadata_hash', 'origin_hash'])) {
            throw new LegacyRehearsalBlocked('Rehearsal schema version differs; use a fresh disposable database.');
        }
    }

    public static function fingerprint(array $row): string
    {
        ksort($row);
        // Normalize JSONB's whitespace/order when a raw PostgreSQL row is read back.
        foreach (['autores'] as $field) {
            if (isset($row[$field]) && is_string($row[$field])) {
                $decoded = json_decode($row[$field], true);
                if (is_array($decoded)) { $row[$field] = $decoded; }
            }
        }
        $canonical = function ($value) use (&$canonical) {
            if (! is_array($value)) { return $value; }
            if (! array_is_list($value)) { ksort($value); }
            return array_map($canonical, $value);
        };
        return hash('sha256', json_encode($canonical($row), JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE));
    }

    public function preview(array $manifest): array
    {
        $this->assertDisposable();
        $manifest = $this->validateManifest($manifest);
        $manifestHash = $this->manifestHash($manifest);
        if (Schema::hasTable(self::TABLE) && DB::table(self::TABLE)->where('batch_id', $manifest['batch_id'])
            ->where('manifest_hash', '!=', $manifestHash)->exists()) {
            throw new LegacyRehearsalBlocked('Batch manifest changed; use an explicit new batch after resolving the existing one.');
        }
        $rows = [];
        foreach ($manifest['records'] as $decision) {
            try {
                $source = $this->source($decision);
                $existing = Schema::hasTable(self::TABLE) ? DB::table(self::TABLE)
                    ->where('source_table', $decision['source'])->where('source_id', $decision['id'])->first() : null;
                if ($existing) {
                    $this->verifyReceipt($existing, $manifest['batch_id'], $decision, $source);
                    $state = 'already_applied';
                } else {
                    $this->target($decision, $source);
                    $this->file($decision, $source);
                    $state = 'ready';
                }
                $rows[] = ['source' => $decision['source'], 'id' => $decision['id'], 'status' => $state];
            } catch (LegacyRehearsalBlocked $e) {
                $rows[] = ['source' => $decision['source'], 'id' => $decision['id'], 'status' => 'blocked', 'reason' => $e->getMessage()];
            }
        }
        return ['batch_id' => $manifest['batch_id'], 'ready' => ! in_array('blocked', array_column($rows, 'status'), true),
            'rows' => $rows, 'source_tables_retained' => true];
    }

    public function apply(array $manifest): array
    {
        $this->assertDisposable();
        $manifest = $this->validateManifest($manifest);
        if (! Schema::hasTable(self::TABLE)) { throw new LegacyRehearsalBlocked('Run prepare on the disposable database first.'); }
        $preview = $this->preview($manifest);
        if (! $preview['ready']) { throw new LegacyRehearsalBlocked('Manifest has unresolved blockers; no changes applied.'); }
        $createdFiles = [];
        try {
            return DB::transaction(function () use ($manifest, &$createdFiles): array {
                $this->lockRehearsal();
                $imported = 0; $unchanged = 0;
                // Stable locking order for concurrent batches.
                $records = $manifest['records'];
                usort($records, fn ($a, $b) => strcmp($a['source'].':'.$a['id'], $b['source'].':'.$b['id']));
                foreach ($records as $decision) {
                    $source = $this->source($decision, true);
                    $existing = DB::table(self::TABLE)->where('source_table', $decision['source'])->where('source_id', $decision['id'])->lockForUpdate()->first();
                    if ($existing) {
                        $this->verifyReceipt($existing, $manifest['batch_id'], $decision, $source); $unchanged++; continue;
                    }
                    if (DB::table(self::TABLE)->where('batch_id', $manifest['batch_id'])
                        ->where('manifest_hash', '!=', $this->manifestHash($manifest))->exists()) {
                        throw new LegacyRehearsalBlocked('Batch manifest changed while waiting for the rehearsal lock.');
                    }
                    $target = $this->target($decision, $source);
                    $file = $this->file($decision, $source);
                    if ($file) {
                        $disk = Storage::disk('phase2-rehearsal');
                        if ($disk->exists($file['target'])) { throw new LegacyRehearsalBlocked('Destination file already exists without a matching receipt.'); }
                        $createdFiles[] = $file['target'];
                        if (! $disk->put($file['target'], $disk->get($file['source']))) { throw new LegacyRehearsalBlocked('Could not copy the fixture PDF.'); }
                        $this->verifyFile($file['target'], $file['sha256']);
                        $target['archivo_pdf'] = $file['target'];
                        $target['nombre_archivo_original'] = basename($file['source']);
                    }
                    (new ObservatorioPublicacion())->forceFill($target)->saveOrFail();
                    $originId = (string) Str::uuid();
                    DB::table('publication_origins')->insert([
                        'id' => $originId, 'source_table' => $decision['source'], 'source_id' => $decision['id'],
                        'target_id' => $target['id'], ...self::catalogMetadata($source),
                        'legacy_file_name' => $decision['source'] === 'reportes' && $file ? basename($file['source']) : null,
                        'created_at' => now(), 'updated_at' => now(),
                    ]);
                    $origin = (array) DB::table('publication_origins')->where('id', $originId)->first();
                    $stored = (array) DB::table('observatorio_publicaciones')->where('id', $target['id'])->first();
                    DB::table(self::TABLE)->insert([
                        'id' => (string) Str::uuid(), 'batch_id' => $manifest['batch_id'],
                        'source_table' => $decision['source'], 'source_id' => $decision['id'], 'target_id' => $target['id'],
                        'source_hash' => self::fingerprint($source), 'target_hash' => self::fingerprint($stored),
                        'decision_hash' => self::fingerprint($decision),
                        'manifest_hash' => $this->manifestHash($manifest),
                        'batch_size' => count($manifest['records']),
                        ...self::catalogMetadata($source),
                        'metadata_hash' => self::fingerprint(self::catalogMetadata($source)),
                        'origin_hash' => self::fingerprint($origin),
                        'source_snapshot' => json_encode($source, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE),
                        'decisions' => json_encode($decision, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE),
                        'file_manifest' => $file ? json_encode($file, JSON_THROW_ON_ERROR) : null, 'created_at' => now(),
                    ]);
                    $imported++;
                }
                return ['imported' => $imported, 'unchanged' => $unchanged, 'source_tables_retained' => true];
            });
        } catch (Throwable $e) {
            foreach ($createdFiles as $path) { Storage::disk('phase2-rehearsal')->delete($path); }
            throw $e;
        }
    }

    public function rollback(string $batchId): array
    {
        $this->assertDisposable();
        if (! Str::isUuid($batchId)) { throw new LegacyRehearsalBlocked('A valid batch UUID is required.'); }
        $files = DB::transaction(function () use ($batchId): array {
            $this->lockRehearsal();
            $receipts = DB::table(self::TABLE)->where('batch_id', $batchId)->orderBy('source_table')->orderBy('source_id')->lockForUpdate()->get();
            if ($receipts->isNotEmpty() && $receipts->count() !== (int) $receipts->first()->batch_size) {
                throw new LegacyRehearsalBlocked('Incomplete batch receipts require manual reconciliation before rollback.');
            }
            foreach ($receipts as $receipt) {
                $decision = json_decode($receipt->decisions, true, 512, JSON_THROW_ON_ERROR);
                $this->validateManifest(['version' => 1, 'batch_id' => $batchId, 'records' => [$decision]]);
                $this->verifyReceipt($receipt, $batchId, $decision, $this->source($decision, true));
            }
            $files = [];
            foreach ($receipts as $receipt) {
                $file = $receipt->file_manifest ? json_decode($receipt->file_manifest, true, 512, JSON_THROW_ON_ERROR) : null;
                DB::table(self::TABLE)->where('id', $receipt->id)->delete();
                DB::table('publication_origins')->where('target_id', $receipt->target_id)->delete();
                DB::table('observatorio_publicaciones')->where('id', $receipt->target_id)->delete();
                if ($file) { $files[] = $file['target']; }
            }
            return ['removed' => $receipts->count(), 'files' => $files];
        });
        $clean = true;
        foreach ($files['files'] as $path) { $clean = Storage::disk('phase2-rehearsal')->delete($path) && $clean; }
        return ['removed' => $files['removed'], 'copied_files_removed' => $clean, 'source_tables_retained' => true];
    }

    private function validateManifest(array $manifest): array
    {
        if (array_diff(array_keys($manifest), ['version', 'batch_id', 'records'])) {
            throw new LegacyRehearsalBlocked('Unknown top-level manifest fields are not accepted.');
        }
        Validator::make($manifest, [
            'records.*' => ['required', 'array:source,id,source_sha256,target_id,codigo,owner_id,owner_decision,departamento_id,department_decision,fecha_publicacion,date_decision,estado,state_decision,observacion_revision,preservation_decision,file'],
            'version' => ['required', 'integer', 'in:1'], 'batch_id' => ['required', 'uuid'],
            'records' => ['required', 'array', 'min:1', 'max:500'],
            'records.*.source' => ['required', 'in:articulos,reportes'], 'records.*.id' => ['required', 'uuid'],
            'records.*.source_sha256' => ['required', 'regex:/^[a-f0-9]{64}$/'],
            'records.*.target_id' => ['required', 'uuid', 'distinct'],
            'records.*.codigo' => ['required', 'string', 'max:255', 'distinct'],
            'records.*.owner_id' => ['required', 'integer', 'min:1'],
            'records.*.owner_decision' => ['required', 'string', 'min:10', 'max:2000'],
            'records.*.departamento_id' => ['sometimes', 'uuid'],
            'records.*.department_decision' => ['sometimes', 'string', 'min:10', 'max:2000'],
            'records.*.fecha_publicacion' => ['sometimes', 'date_format:Y-m-d'],
            'records.*.date_decision' => ['sometimes', 'string', 'min:10', 'max:2000'],
            'records.*.estado' => ['sometimes', 'in:'.implode(',', ObservatorioPublicacion::ESTADOS)],
            'records.*.state_decision' => ['sometimes', 'string', 'min:10', 'max:2000'],
            'records.*.observacion_revision' => ['sometimes', 'string', 'min:3', 'max:4000'],
            'records.*.preservation_decision' => ['sometimes', 'string', 'min:10', 'max:2000'],
            'records.*.file' => ['sometimes', 'array:source,sha256'],
            'records.*.file.source' => ['required_with:records.*.file', 'string'],
            'records.*.file.sha256' => ['required_with:records.*.file', 'regex:/^[a-f0-9]{64}$/'],
        ])->validate();
        $seen = [];
        foreach ($manifest['records'] as $decision) {
            $key = $decision['source'].':'.$decision['id'];
            if (isset($seen[$key])) { throw new LegacyRehearsalBlocked('Source repeated within a manifest.'); } $seen[$key] = true;
        }
        return $manifest;
    }

    private function manifestHash(array $manifest): string
    {
        $records = $manifest['records'];
        usort($records, fn ($a, $b) => strcmp($a['source'].':'.$a['id'], $b['source'].':'.$b['id']));
        return self::fingerprint(['version' => $manifest['version'], 'batch_id' => $manifest['batch_id'], 'records' => $records]);
    }

    private function source(array $decision, bool $lock = false): array
    {
        $query = DB::table($decision['source'])->where('id', $decision['id']);
        $row = ($lock ? $query->lockForUpdate() : $query)->first();
        if (! $row || self::fingerprint((array) $row) !== $decision['source_sha256']) { throw new LegacyRehearsalBlocked('Source missing or changed after planning.'); }
        if (! in_array($row->visibilidad ?? 'publico', ['publico', 'suscriptor', 'privado'], true)) {
            throw new LegacyRehearsalBlocked('Unknown legacy visibility requires a separate explicit mapping.');
        }
        if (($row->deleted_at !== null || ($row->visibilidad ?? 'publico') === 'privado')
            && strlen(trim($decision['preservation_decision'] ?? '')) < 10) {
            throw new LegacyRehearsalBlocked('Private or deleted sources require an explicit decision to preserve their restrictions.');
        }
        return (array) $row;
    }

    private function target(array $d, array $source): array
    {
        $article = $d['source'] === 'articulos';
        $type = $article ? 'ARTICULO' : 'REPORTE';
        if (! str_starts_with($d['codigo'], $article ? 'ART-MIG-' : 'REP-MIG-')) { throw new LegacyRehearsalBlocked('An explicit migration code with the correct type prefix is required.'); }
        if (DB::table('observatorio_publicaciones')->where('id', $d['target_id'])->orWhere('codigo', $d['codigo'])->exists()) { throw new LegacyRehearsalBlocked('Target ID or code collision requires an explicit resolution.'); }
        if (DB::table('publication_origins')->where('source_table', $d['source'])->where('source_id', $d['id'])->exists()) {
            throw new LegacyRehearsalBlocked('Source already has a permanent destination; reconcile its existing map.');
        }
        $owner = DB::table('users')->where('id', $d['owner_id'])->whereNull('deleted_at')->where('is_active', true)->first();
        if (! $owner || ! in_array($owner->rol, ['ADMIN', 'ADMIN_OBSERVATORIO', 'EDITOR'], true)) { throw new LegacyRehearsalBlocked('Explicit active authoring-account mapping required.'); }
        $department = $source['departamento_id'] ?: ($d['departamento_id'] ?? null);
        if (! $source['departamento_id'] && strlen(trim($d['department_decision'] ?? '')) < 10) { throw new LegacyRehearsalBlocked('Missing department requires a documented decision.'); }
        if (isset($d['departamento_id']) && $d['departamento_id'] !== $department) { throw new LegacyRehearsalBlocked('Existing department cannot be silently reassigned.'); }
        if (! DB::table('departamentos')->where('id', $department)->whereNull('deleted_at')->exists()) { throw new LegacyRehearsalBlocked('Active department mapping required.'); }
        $assignment = DB::table('usuario_departamento')->where('user_id', $owner->id)->where('departamento_id', $department);
        if (($owner->rol === 'EDITOR' && ! (clone $assignment)->whereIn('rol', ['ADMIN', 'EDITOR'])->exists())
            || ($owner->rol === 'ADMIN_OBSERVATORIO' && ! (clone $assignment)->where('puede_revisar', true)->exists())) {
            throw new LegacyRehearsalBlocked('Mapped authoring account must have current authoring access to the selected department.');
        }
        $sourceDate = $source['fecha_publicacion'] ? substr((string) $source['fecha_publicacion'], 0, 10) : null;
        $date = $sourceDate ?: ($d['fecha_publicacion'] ?? null);
        if (! $source['fecha_publicacion'] && strlen(trim($d['date_decision'] ?? '')) < 10) { throw new LegacyRehearsalBlocked('Missing publication date requires a documented decision.'); }
        if (isset($d['fecha_publicacion']) && $d['fecha_publicacion'] !== $date) { throw new LegacyRehearsalBlocked('Existing publication date cannot be silently replaced.'); }
        if (! is_string($date) || ! preg_match('/^\d{4}-\d{2}-\d{2}$/', $date) || date('Y-m-d', strtotime($date)) !== $date) { throw new LegacyRehearsalBlocked('An explicit valid publication date is required.'); }
        $known = ['PUBLICADO' => 'PUBLICACION', 'PUBLICACION' => 'PUBLICACION', 'BORRADOR' => 'EN_REVISION', 'EN_REVISION' => 'EN_REVISION', 'SUSPENDIDO' => 'SUSPENDIDO', 'ARCHIVADO' => 'ARCHIVADO', 'RECHAZADO' => 'RECHAZADO'];
        $state = $article ? ($known[$source['estado'] ?? ''] ?? null) : null;
        if (isset($d['estado']) && $d['estado'] !== $state) {
            if (strlen(trim($d['state_decision'] ?? '')) < 10) { throw new LegacyRehearsalBlocked('Unknown or changed review state requires a documented decision.'); }
            $state = $d['estado'];
        }
        if (! in_array($state, ObservatorioPublicacion::ESTADOS, true)) { throw new LegacyRehearsalBlocked('Explicit review state mapping required.'); }
        $reason = $d['observacion_revision'] ?? null;
        if (in_array($state, ObservatorioPublicacion::ESTADOS_CON_OBSERVACION, true) && strlen(trim($reason ?? '')) < 3) { throw new LegacyRehearsalBlocked('Review observation required for the mapped state.'); }
        return ['id' => $d['target_id'], 'departamento_id' => $department, 'creado_por' => $d['owner_id'], 'tipo' => $type,
            'codigo' => $d['codigo'], 'titulo' => $source[$article ? 'titulo' : 'nombre_indicador'],
            'descripcion' => $source[$article ? 'descripcion' : 'descripcion_indicador'],
            'autores' => $article && filled($source['autor']) ? [$source['autor']] : [], 'fuente' => $source['fuente'],
            'fecha_publicacion' => $date, 'estado' => $state, 'observacion_revision' => $reason,
            'solo_suscriptores' => ($source['visibilidad'] ?? 'publico') === 'suscriptor',
            'visibilidad_legada' => $source['visibilidad'] ?? 'publico', 'eliminado_legado_at' => $source['deleted_at'],
            'link_url' => $source[$article ? 'enlace' : 'link_url'], 'created_at' => $source['created_at'], 'updated_at' => $source['updated_at']];
    }

    private function file(array $decision, array $source): ?array
    {
        $file = $decision['file'] ?? null;
        if (! $file && $decision['source'] === 'reportes' && filled($source['ficha_indicador'])) { throw new LegacyRehearsalBlocked('Legacy attachment requires an explicit local PDF mapping.'); }
        if (! $file) { return null; }
        if (! is_array($file) || ! preg_match('#^public/fichas/[A-Za-z0-9_-]+\.pdf$#', $file['source'] ?? '')
            || ! preg_match('/^[a-f0-9]{64}$/', $file['sha256'] ?? '')) { throw new LegacyRehearsalBlocked('A local fixture PDF and SHA-256 are required; remote fetching is disabled.'); }
        $this->verifyFile($file['source'], $file['sha256']);
        if ($decision['source'] === 'reportes' && filled($source['ficha_indicador'])
            && basename(parse_url($source['ficha_indicador'], PHP_URL_PATH) ?: $source['ficha_indicador']) !== basename($file['source'])) {
            throw new LegacyRehearsalBlocked('Mapped fixture does not match the recorded legacy attachment filename.');
        }
        $bytes = Storage::disk('phase2-rehearsal')->get($file['source']);
        if (! str_starts_with($bytes, '%PDF-') || strlen($bytes) > 20 * 1024 * 1024) { throw new LegacyRehearsalBlocked('Fixture attachment must be a PDF of at most 20 MB.'); }
        return ['source' => $file['source'], 'target' => 'publicaciones/phase2-legacy/'.$decision['target_id'].'.pdf', 'sha256' => $file['sha256']];
    }

    private function verifyFile(string $path, string $sha256): void
    {
        $disk = Storage::disk('phase2-rehearsal');
        if (! $disk->exists($path) || ! hash_equals($sha256, hash('sha256', $disk->get($path)))) { throw new LegacyRehearsalBlocked('Fixture file missing or changed; no destructive recovery allowed.'); }
    }

    private function verifyReceipt(object $receipt, string $batchId, array $decision, array $source): void
    {
        $origin = DB::table('publication_origins')->where('source_table', $decision['source'])
            ->where('source_id', $decision['id'])->first();
        if (! $origin || $origin->target_id !== $receipt->target_id || $receipt->origin_hash !== self::fingerprint((array) $origin)) {
            throw new LegacyRehearsalBlocked('Permanent origin changed; refuse destructive recovery.');
        }
        $metadata = ['categoria_id' => $receipt->categoria_id,
            'fecha_recepcion' => $receipt->fecha_recepcion ? substr((string) $receipt->fecha_recepcion, 0, 10) : null];
        if ($receipt->batch_id !== $batchId || $receipt->decision_hash !== self::fingerprint($decision)
            || $receipt->source_hash !== self::fingerprint($source)
            || $receipt->metadata_hash !== self::fingerprint($metadata)
            || $metadata !== self::catalogMetadata($source)
            || $receipt->source_hash !== self::fingerprint(json_decode($receipt->source_snapshot, true, 512, JSON_THROW_ON_ERROR))) {
            throw new LegacyRehearsalBlocked('Receipt or decisions differ from the original batch.');
        }
        $target = DB::table('observatorio_publicaciones')->where('id', $receipt->target_id)->lockForUpdate()->first();
        if (! $target || $receipt->target_hash !== self::fingerprint((array) $target)) { throw new LegacyRehearsalBlocked('Imported target changed; refuse to overwrite or roll it back.'); }
        if ($receipt->file_manifest) {
            $file = json_decode($receipt->file_manifest, true, 512, JSON_THROW_ON_ERROR);
            if (($file['target'] ?? null) !== 'publicaciones/phase2-legacy/'.$receipt->target_id.'.pdf'
                || ! preg_match('#^public/fichas/[A-Za-z0-9_-]+\.pdf$#', $file['source'] ?? '')) {
                throw new LegacyRehearsalBlocked('Receipt file paths do not match the bounded rehearsal namespace.');
            }
            $this->verifyFile($file['source'], $file['sha256']); $this->verifyFile($file['target'], $file['sha256']);
        }
    }

    private static function catalogMetadata(array $source): array
    {
        return ['categoria_id' => $source['categoria_id'] ?? null,
            'fecha_recepcion' => filled($source['fecha_recepcion'] ?? null) ? substr((string) $source['fecha_recepcion'], 0, 10) : null];
    }

    private function lockRehearsal(): void
    {
        if (DB::getDriverName() === 'pgsql') {
            // Serialize file-copy/cleanup within this disposable database.
            DB::select('SELECT pg_advisory_xact_lock(72602, 1)');
        }
    }
}
