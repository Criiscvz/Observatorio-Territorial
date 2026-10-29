<?php

namespace Tests\Feature;

use App\Application\Publicaciones\LegacyPublicationRehearsal;
use App\Application\Publicaciones\PublicPublicationCatalog;
use App\Application\Publicaciones\RehearsalPublicationCatalog;
use App\Infrastructure\Persistence\Eloquent\Models\ArticuloModel;
use App\Infrastructure\Persistence\Eloquent\Models\ReporteModel;
use App\Models\Departamento;
use App\Models\ObservatorioPublicacion;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use RuntimeException;
use Tests\TestCase;

class LegacyPublicationRehearsalTest extends TestCase
{
    use RefreshDatabase;

    private LegacyPublicationRehearsal $service;
    private Departamento $department;
    private User $owner;

    protected function setUp(): void
    {
        parent::setUp();
        config(['publications.legacy_rehearsal_enabled' => true, 'filesystems.default' => 'phase2-rehearsal']);
        Storage::fake('phase2-rehearsal');
        $this->service = app(LegacyPublicationRehearsal::class);
        $this->service->prepare();
        $this->department = Departamento::create(['nombre' => 'Ensayo', 'codigo_interno' => 'LEGACY-TEST', 'publico' => true]);
        $this->owner = User::factory()->create(['rol' => 'ADMIN']);
    }

    private function article(array $values = []): ArticuloModel
    {
        return ArticuloModel::create([...[
            'titulo' => 'Título sintético', 'descripcion' => 'Descripción completa', 'autor' => 'Autora sintética',
            'departamento_id' => $this->department->id, 'fuente' => 'Fuente sintética', 'enlace' => 'https://example.test/fuente',
            'fecha_publicacion' => '2026-09-10', 'fecha_recepcion' => '2026-09-01', 'estado' => 'PUBLICADO', 'visibilidad' => 'publico',
        ], ...$values]);
    }

    private function decision(object $model): array
    {
        $source = $model instanceof ArticuloModel ? 'articulos' : 'reportes';
        $row = (array) DB::table($source)->where('id', $model->id)->first();
        return ['source' => $source, 'id' => $model->id, 'source_sha256' => LegacyPublicationRehearsal::fingerprint($row),
            'target_id' => (string) Str::uuid(), 'codigo' => ($source === 'articulos' ? 'ART-MIG-' : 'REP-MIG-').$model->id,
            'owner_id' => $this->owner->id, 'owner_decision' => 'Explicit synthetic owner decision for this fixture.'];
    }

    private function manifest(array $decisions): array
    {
        return ['version' => 1, 'batch_id' => (string) Str::uuid(), 'records' => $decisions];
    }

    private function mustFail(callable $operation): void
    {
        $failed = false;
        try { $operation(); } catch (\Throwable) { $failed = true; }
        $this->assertTrue($failed, 'Expected the unsafe or inconsistent operation to be blocked.');
    }

    public function test_explicit_owner_mapping_preserves_metadata_and_repeat_does_not_duplicate(): void
    {
        $category = (string) Str::uuid();
        DB::table('categorias_dataset')->insert(['id' => $category, 'nombre' => 'Ensayo', 'codigo' => 'legacy-test']);
        $a = $this->article(['categoria_id' => $category]);
        $b = $this->article(['titulo' => $a->titulo, 'visibilidad' => 'suscriptor', 'estado' => 'BORRADOR']);
        $plan = $this->manifest([$this->decision($a), $this->decision($b)]);
        $before = DB::table('articulos')->orderBy('id')->get()->toJson();
        $this->assertTrue($this->service->preview($plan)['ready']);
        $this->assertSame(2, $this->service->apply($plan)['imported']);
        $this->assertSame(2, $this->service->apply($plan)['unchanged']);
        $this->assertDatabaseCount('observatorio_publicaciones', 2);
        $target = ObservatorioPublicacion::findOrFail($plan['records'][0]['target_id']);
        $this->assertSame($a->titulo, $target->titulo);
        $this->assertSame($a->descripcion, $target->descripcion);
        $this->assertSame([$a->autor], $target->autores);
        $this->assertSame($a->fuente, $target->fuente);
        $this->assertSame('2026-09-10', $target->fecha_publicacion->format('Y-m-d'));
        $this->assertSame('PUBLICACION', $target->estado);
        $this->assertSame($this->owner->id, $target->creado_por);
        $receipt = DB::table('phase2_publication_imports')->where('source_id', $a->id)->first();
        $snapshot = json_decode($receipt->source_snapshot, true);
        $this->assertSame($category, $snapshot['categoria_id']);
        $this->assertSame('2026-09-01', substr($snapshot['fecha_recepcion'], 0, 10));
        $other = ObservatorioPublicacion::findOrFail($plan['records'][1]['target_id']);
        $this->assertSame('EN_REVISION', $other->estado); $this->assertTrue($other->solo_suscriptores);
        $this->assertSame($before, DB::table('articulos')->orderBy('id')->get()->toJson());
        $this->assertSame(2, $this->service->rollback($plan['batch_id'])['removed']);
        $this->assertDatabaseCount('observatorio_publicaciones', 0); $this->assertDatabaseCount('phase2_publication_imports', 0);
        $this->assertSame($before, DB::table('articulos')->orderBy('id')->get()->toJson());
        $this->assertSame(0, $this->service->rollback($plan['batch_id'])['removed']);
        $this->assertSame(2, $this->service->apply($plan)['imported']);
    }

    public function test_pdf_sha256_is_preserved_and_original_is_retained_after_rollback(): void
    {
        $pdf = "%PDF-1.4\nSynthetic fixture only\n%%EOF";
        Storage::disk('phase2-rehearsal')->put('public/fichas/fixture.pdf', $pdf);
        $report = ReporteModel::create(['nombre_indicador' => 'Reporte de ensayo', 'departamento_id' => $this->department->id,
            'descripcion_indicador' => 'Descripción del indicador', 'fuente' => 'ULEAM', 'fecha_publicacion' => '2026-09-11',
            'link_url' => 'https://app.powerbi.com/view?r=synthetic', 'ficha_indicador' => 'https://example.test/api/reportes/fichas/fixture.pdf']);
        $d = [...$this->decision($report), 'estado' => 'PUBLICACION', 'state_decision' => 'Explicit approval in the synthetic rehearsal.',
            'file' => ['source' => 'public/fichas/fixture.pdf', 'sha256' => hash('sha256', $pdf)]];
        $plan = $this->manifest([$d]);
        $this->assertSame(1, $this->service->apply($plan)['imported']);
        $target = ObservatorioPublicacion::findOrFail($d['target_id']);
        $this->assertSame($report->link_url, $target->link_url);
        $this->assertSame($report->descripcion_indicador, $target->descripcion);
        $this->assertSame(hash('sha256', $pdf), hash('sha256', Storage::disk('phase2-rehearsal')->get($target->archivo_pdf)));
        $this->assertSame(1, $this->service->apply($plan)['unchanged']);
        $this->assertTrue($this->service->rollback($plan['batch_id'])['copied_files_removed']);
        Storage::disk('phase2-rehearsal')->assertMissing($target->archivo_pdf);
        $this->assertSame($pdf, Storage::disk('phase2-rehearsal')->get('public/fichas/fixture.pdf'));
        $this->assertDatabaseCount('reportes', 1);
    }

    public function test_missing_owner_department_date_and_unknown_states_require_explicit_decisions(): void
    {
        $a = $this->article(['departamento_id' => null, 'fecha_publicacion' => null, 'estado' => 'NO_MAPEADO']);
        $d = $this->decision($a);
        $missing = $d; unset($missing['owner_id']);
        $this->mustFail(fn () => $this->service->apply($this->manifest([$missing])));
        $this->assertFalse($this->service->preview($this->manifest([$d]))['ready']);
        $d += ['departamento_id' => $this->department->id, 'department_decision' => 'Explicit department mapping for a missing source value.'];
        $this->assertFalse($this->service->preview($this->manifest([$d]))['ready']);
        $d += ['fecha_publicacion' => '2026-09-12', 'date_decision' => 'Explicit date decision for the synthetic source.'];
        $this->assertFalse($this->service->preview($this->manifest([$d]))['ready']);
        $d += ['estado' => 'SUSPENDIDO', 'state_decision' => 'Explicit review-state decision for unknown legacy state.'];
        $this->assertFalse($this->service->preview($this->manifest([$d]))['ready']);
        $d['observacion_revision'] = 'Motivo sintético de suspensión';
        $this->assertSame(1, $this->service->apply($this->manifest([$d]))['imported']);
        $this->assertSame('Motivo sintético de suspensión', ObservatorioPublicacion::find($d['target_id'])->observacion_revision);
    }

    public function test_private_deleted_and_stale_sources_are_never_silently_published(): void
    {
        $private = $this->article(['visibilidad' => 'privado']);
        $deleted = $this->article(); $deleted->delete();
        $stale = $this->article(); $staleDecision = $this->decision($stale); $stale->update(['titulo' => 'Changed after preview']);
        foreach ([$this->decision($private), $this->decision($deleted), $staleDecision] as $d) {
            $plan = $this->manifest([$d]); $this->assertFalse($this->service->preview($plan)['ready']);
            $this->mustFail(fn () => $this->service->apply($plan));
        }
        $this->assertDatabaseCount('observatorio_publicaciones', 0); $this->assertDatabaseCount('articulos', 3);
    }

    public function test_collisions_and_changed_decisions_or_targets_block_repetition_and_rollback(): void
    {
        $a = $this->article(); $d = $this->decision($a); $plan = $this->manifest([$d]);
        $this->service->apply($plan);
        $expanded = $plan; $expanded['records'][] = $this->decision($this->article());
        $this->mustFail(fn () => $this->service->apply($expanded));
        $collision = $this->decision($this->article()); $collision['target_id'] = $d['target_id'];
        $this->assertFalse($this->service->preview($this->manifest([$collision]))['ready']);
        $different = $plan; $different['records'][0]['owner_decision'] = 'A different decision must not overwrite the receipt.';
        $this->mustFail(fn () => $this->service->apply($different));
        ObservatorioPublicacion::find($d['target_id'])->update(['titulo' => 'Edited after import']);
        $this->mustFail(fn () => $this->service->apply($plan));
        $this->mustFail(fn () => $this->service->rollback($plan['batch_id']));
        $this->assertSame('Edited after import', ObservatorioPublicacion::find($d['target_id'])->titulo);
        $this->assertDatabaseCount('phase2_publication_imports', 1);
    }

    public function test_intermediate_failure_rolls_back_all_rows_and_copied_files(): void
    {
        $a = $this->article(); $b = $this->article();
        $pdf = "%PDF-1.4\nFixture\n%%EOF"; Storage::disk('phase2-rehearsal')->put('public/fichas/failure.pdf', $pdf);
        $decisions = array_map(fn ($source) => [...$this->decision($source), 'file' => [
            'source' => 'public/fichas/failure.pdf', 'sha256' => hash('sha256', $pdf)]], [$a, $b]);
        $plan = $this->manifest($decisions); $count = 0;
        ObservatorioPublicacion::created(function () use (&$count): void { if (++$count === 2) { throw new RuntimeException('Synthetic failure after the second insert.'); } });
        try { $this->mustFail(fn () => $this->service->apply($plan)); }
        finally { ObservatorioPublicacion::flushEventListeners(); }
        $this->assertSame(2, $count);
        $this->assertDatabaseCount('observatorio_publicaciones', 0); $this->assertDatabaseCount('phase2_publication_imports', 0);
        $this->assertSame([], Storage::disk('phase2-rehearsal')->allFiles('publicaciones/phase2-legacy'));
        $this->assertSame($pdf, Storage::disk('phase2-rehearsal')->get('public/fichas/failure.pdf'));
        $this->assertSame(2, $this->service->apply($plan)['imported']);
    }

    public function test_bad_or_changed_pdf_mapping_never_deletes_original_content(): void
    {
        $a = $this->article();
        $d = [...$this->decision($a), 'file' => ['source' => '../outside.pdf', 'sha256' => str_repeat('0', 64)]];
        $this->assertFalse($this->service->preview($this->manifest([$d]))['ready']);
        Storage::disk('phase2-rehearsal')->put('public/fichas/changed.pdf', '%PDF-1.4 original');
        $d['file'] = ['source' => 'public/fichas/changed.pdf', 'sha256' => hash('sha256', '%PDF-1.4 original')];
        $plan = $this->manifest([$d]); $this->service->apply($plan);
        Storage::disk('phase2-rehearsal')->put('publicaciones/phase2-legacy/'.$d['target_id'].'.pdf', '%PDF-1.4 modified');
        $this->mustFail(fn () => $this->service->rollback($plan['batch_id']));
        $this->assertDatabaseCount('observatorio_publicaciones', 1);
        $this->assertSame('%PDF-1.4 original', Storage::disk('phase2-rehearsal')->get('public/fichas/changed.pdf'));
    }

    public function test_rehearsal_is_blocked_outside_explicit_disposable_configuration(): void
    {
        config(['publications.legacy_rehearsal_enabled' => false]);
        $this->mustFail(fn () => $this->service->prepare());
        $this->artisan('publications:rehearse-legacy', ['action' => 'prepare'])->assertExitCode(1);
        config(['publications.legacy_rehearsal_enabled' => true]);
        $driver = config('database.default'); $before = config("database.connections.{$driver}.database");
        config(["database.connections.{$driver}.database" => 'observatorio_production']);
        $this->mustFail(fn () => $this->service->prepare());
        config(["database.connections.{$driver}.database" => $before]);
        app()->instance('env', 'production');
        try { $this->mustFail(fn () => $this->service->prepare()); }
        finally { app()->instance('env', 'testing'); }
        $this->assertDatabaseCount('observatorio_publicaciones', 0);
    }

    public function test_invalid_manifests_and_database_errors_are_not_printed_as_safe_blockers(): void
    {
        $a = $this->article(); $decision = $this->decision($a);
        $marker = 'synthetic-private-manifest-marker';
        $bad = $this->manifest([$decision]); $bad['records'][0]['unexpected_field'] = $marker;
        $disk = Storage::disk('phase2-rehearsal'); $disk->put('bad-manifest.json', json_encode($bad));
        $this->assertSame(1, \Illuminate\Support\Facades\Artisan::call('publications:rehearse-legacy', [
            '--manifest' => $disk->path('bad-manifest.json'),
        ]));
        $this->assertStringNotContainsString($marker, \Illuminate\Support\Facades\Artisan::output());
        // A driver error is not a domain blocker and must never become preview text.
        Schema::drop('phase2_publication_imports');
        $this->assertTrue($this->service->preview($this->manifest([$decision]))['ready']);
        config(['filesystems.default' => 'local']);
        $this->mustFail(fn () => $this->service->prepare());
        config(['filesystems.default' => 'phase2-rehearsal']);
        $connection = config('database.default');
        config(["database.connections.{$connection}.url" => 'postgresql://example.invalid/test']);
        $this->mustFail(fn () => $this->service->prepare());
        config(["database.connections.{$connection}.url" => null]);
        $this->assertDatabaseCount('observatorio_publicaciones', 0);
        DB::listen(function ($query) use ($marker): void {
            if (str_contains($query->sql, 'from "users"')) { throw new \PDOException($marker); }
        });
        $driverFailure = false;
        try { $this->service->preview($this->manifest([$decision])); }
        catch (\PDOException) { $driverFailure = true; }
        $this->assertTrue($driverFailure, 'Driver errors must propagate to the sanitized command handler.');
    }

    public function test_mapped_editor_requires_current_assignment_and_incomplete_receipts_block_rollback(): void
    {
        $editor = User::factory()->create(['rol' => 'EDITOR']);
        $a = $this->article(); $d = $this->decision($a); $d['owner_id'] = $editor->id;
        $this->assertFalse($this->service->preview($this->manifest([$d]))['ready']);
        $editor->departamentos()->attach($this->department->id, ['id' => (string) Str::uuid(), 'rol' => 'EDITOR']);
        $second = $this->decision($this->article());
        $plan = $this->manifest([$d, $second]); $this->service->apply($plan);
        DB::table('phase2_publication_imports')->where('source_id', $d['id'])->delete();
        $this->mustFail(fn () => $this->service->rollback($plan['batch_id']));
        $this->assertDatabaseCount('observatorio_publicaciones', 2);
        $this->assertDatabaseCount('articulos', 2);
    }

    public function test_catalog_handoff_preserves_category_received_date_and_distinct_source_ids(): void
    {
        $category = (string) Str::uuid();
        DB::table('categorias_dataset')->insert(['id' => $category, 'nombre' => 'Categoría sintética', 'codigo' => 'handoff']);
        $a = $this->article(['categoria_id' => $category]);
        $report = ReporteModel::create(['nombre_indicador' => $a->titulo, 'categoria_id' => $category,
            'departamento_id' => $this->department->id, 'fecha_publicacion' => '2026-09-10']);
        // Coincident UUIDs in different sources are still two publications.
        DB::table('reportes')->where('id', $report->id)->update(['id' => $a->id]);
        $report->id = $a->id;
        $d = [...$this->decision($report), 'estado' => 'PUBLICACION', 'state_decision' => 'Approval for the synthetic report.'];
        $plan = $this->manifest([$this->decision($a), $d]);
        $catalog = app(RehearsalPublicationCatalog::class);
        $this->assertSame(2, $catalog->query(['categoria_id' => $category])->count());
        $this->service->apply($plan);
        // The production read model remains unchanged until a later, explicit cutover.
        $this->assertSame(4, app(PublicPublicationCatalog::class)->query()->count());
        $this->app->bind(PublicPublicationCatalog::class, RehearsalPublicationCatalog::class);
        $response = $this->getJson('/api/publico/publicaciones?categoria_id='.$category)->assertOk()
            ->assertJsonPath('meta.total', 2)->assertJsonPath('counts.ARTICULO', 1)->assertJsonPath('counts.REPORTE', 1);
        $rows = collect($response->json('data'))->keyBy('tipo');
        $this->assertSame('2026-09-01', $rows['ARTICULO']['fecha_recepcion']);
        $this->assertNull($rows['REPORTE']['fecha_recepcion']);
        foreach ($rows as $row) {
            $this->assertSame($category, $row['categoria_id']);
            $this->assertSame('Categoría sintética', $row['categoria']['nombre']);
            $this->assertSame('publicaciones', $row['origen']);
            foreach (['source_snapshot', 'decisions', 'source_hash', 'target_hash', 'metadata_hash', 'owner_id'] as $field) {
                $this->assertArrayNotHasKey($field, $row);
            }
        }
        $this->service->rollback($plan['batch_id']);
        $this->getJson('/api/publico/publicaciones?categoria_id='.$category)->assertOk()->assertJsonPath('meta.total', 2);
        $this->assertSame(1, $catalog->query()->where('origen', 'articulos')->count());
        $this->assertSame(1, $catalog->query()->where('origen', 'reportes')->count());
    }

    public function test_partial_catalog_handoff_keeps_sql_pagination_counts_and_search_without_duplicates(): void
    {
        $decisions = [];
        for ($i = 0; $i < 24; $i++) {
            $article = $this->article(['titulo' => 'Publicación '.$i]);
            if ($i < 12) { $decisions[] = $this->decision($article); }
        }
        $report = ReporteModel::create(['nombre_indicador' => 'Reporte sin convertir', 'departamento_id' => $this->department->id]);
        $this->app->bind(PublicPublicationCatalog::class, RehearsalPublicationCatalog::class);
        $url = '/api/publico/publicaciones?departamento_id='.$this->department->id;
        $this->getJson($url)->assertJsonPath('meta.total', 25);
        $plan = $this->manifest($decisions); $this->service->apply($plan);
        DB::enableQueryLog();
        $first = $this->getJson($url)->assertOk()->assertJsonCount(20, 'data')->assertJsonPath('meta.total', 25)
            ->assertJsonPath('counts.ARTICULO', 24)->assertJsonPath('counts.REPORTE', 1)->json('data');
        $queries = array_column(DB::getQueryLog(), 'query');
        $this->assertTrue((bool) array_filter($queries, fn ($q) => str_contains(strtolower($q), 'not exists') && str_contains(strtolower($q), 'limit 20')));
        $second = $this->getJson($url.'&page=2')->assertOk()->assertJsonCount(5, 'data')->json('data');
        $this->assertCount(25, array_unique(array_column([...$first, ...$second], 'resource_key')));
        $this->getJson($url.'&q=Publicaci%C3%B3n%200')->assertJsonPath('meta.total', 1);
        $this->getJson($url.'&tipo=REPORTE')->assertJsonPath('meta.total', 1)->assertJsonPath('data.0.id', $report->id);
        $this->assertSame(12, $this->service->apply($plan)['unchanged']);
        $this->service->rollback($plan['batch_id']);
        $this->getJson($url)->assertJsonPath('meta.total', 25)->assertJsonPath('counts.ARTICULO', 24);
    }

    public function test_unpublished_converted_target_never_resurrects_legacy_source(): void
    {
        $a = $this->article(); $d = $this->decision($a); $plan = $this->manifest([$d]);
        $this->service->apply($plan);
        $catalog = app(RehearsalPublicationCatalog::class);
        $this->assertSame(1, $catalog->query()->count());
        $baseline = (array) DB::table('observatorio_publicaciones')->where('id', $d['target_id'])->first();
        foreach (['EN_REVISION', 'SUSPENDIDO', 'ARCHIVADO', 'RECHAZADO'] as $state) {
            DB::table('observatorio_publicaciones')->where('id', $d['target_id'])->update(['estado' => $state]);
            $this->assertSame(0, $catalog->query()->count());
        }
        DB::table('observatorio_publicaciones')->where('id', $d['target_id'])->update($baseline);
        $this->department->update(['publico' => false]);
        $this->assertSame(0, $catalog->query()->count());
        $this->department->update(['publico' => true]);
        $this->assertSame(1, $catalog->query()->count());
        $this->service->rollback($plan['batch_id']);
        $this->assertSame(1, $catalog->query()->where('origen', 'articulos')->count());
    }

    public function test_catalog_metadata_changes_and_non_disposable_handoff_are_blocked(): void
    {
        $a = $this->article(); $plan = $this->manifest([$this->decision($a)]);
        $this->service->apply($plan);
        DB::table('phase2_publication_imports')->where('source_id', $a->id)->update(['fecha_recepcion' => '2020-01-01']);
        $this->mustFail(fn () => $this->service->apply($plan));
        $this->mustFail(fn () => $this->service->rollback($plan['batch_id']));
        config(['publications.legacy_rehearsal_enabled' => false]);
        $this->mustFail(fn () => app(RehearsalPublicationCatalog::class)->query());
        config(['publications.legacy_rehearsal_enabled' => true]);
        app()->instance('env', 'production');
        try { $this->mustFail(fn () => app(RehearsalPublicationCatalog::class)->query()); }
        finally { app()->instance('env', 'testing'); }
    }

    public function test_handoff_keeps_native_books_and_protected_pdf_access(): void
    {
        $a = $this->article(['visibilidad' => 'suscriptor']);
        $pdf = "%PDF-1.4\nSynthetic subscriber PDF\n%%EOF";
        Storage::disk('phase2-rehearsal')->put('public/fichas/subscriber.pdf', $pdf);
        $d = [...$this->decision($a), 'file' => ['source' => 'public/fichas/subscriber.pdf', 'sha256' => hash('sha256', $pdf)]];
        $this->service->apply($this->manifest([$d]));
        $book = ObservatorioPublicacion::create(['departamento_id' => $this->department->id, 'creado_por' => $this->owner->id,
            'tipo' => 'LIBRO', 'codigo' => 'LIB-NATIVE', 'titulo' => 'Libro nativo', 'estado' => 'PUBLICACION',
            'fecha_publicacion' => '2026-09-11', 'autores' => ['Autora del libro']]);
        $this->app->bind(PublicPublicationCatalog::class, RehearsalPublicationCatalog::class);
        $download = '/api/departamentos/publicaciones/'.$d['target_id'].'/download';
        foreach ([null, 'USER', 'EDITOR', 'ADMIN_OBSERVATORIO', 'SUBSCRIBER'] as $role) {
            \Illuminate\Support\Facades\Auth::forgetGuards();
            if ($role) { \Laravel\Sanctum\Sanctum::actingAs(User::factory()->create(['rol' => $role])); }
            $allowed = $role === 'SUBSCRIBER';
            $row = $this->getJson('/api/publico/publicaciones?tipo=ARTICULO')->assertOk()
                ->assertJsonPath('meta.total', 1)->assertJsonPath('counts.LIBRO', 1)->json('data.0');
            $this->assertSame(! $allowed, $row['bloqueado']);
            $this->assertSame($allowed ? $download : null, $row['download_url']);
            $response = $this->get($download);
            if ($allowed) { $response->assertOk(); $this->assertSame($pdf, $response->streamedContent()); }
            else { $response->assertForbidden(); }
        }
        $this->getJson('/api/publico/publicaciones?tipo=LIBRO')->assertOk()->assertJsonPath('data.0.id', $book->id)
            ->assertJsonPath('data.0.autores.0', 'Autora del libro')->assertJsonPath('data.0.categoria_id', null);
    }
}
