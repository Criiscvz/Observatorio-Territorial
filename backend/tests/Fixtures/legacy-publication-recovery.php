<?php

declare(strict_types=1);

// Standalone synthetic fixture runner. tests/bootstrap ignores production DB URLs.
require dirname(__DIR__).'/bootstrap.php';
$app = require dirname(__DIR__, 2).'/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
if (getenv('LEGACY_RECOVERY_FIXTURES_ENABLED') !== 'yes' || config('database.default') !== 'pgsql') {
    throw new RuntimeException('Explicit PostgreSQL recovery-fixture context required.');
}
$service = app(App\Application\Publicaciones\LegacyPublicationRehearsal::class);
$service->assertDisposable();
$action = $argv[1] ?? '';
$disk = Illuminate\Support\Facades\Storage::disk('phase2-rehearsal');
$db = Illuminate\Support\Facades\DB::class;

function verifyCatalogHandoff(bool $converted): void
{
    $rows = app(App\Application\Publicaciones\RehearsalPublicationCatalog::class)->query()->get();
    if ($rows->count() !== 2 || $rows->where('categoria_codigo', 'recovery')->count() !== 2
        || $rows->where('tipo', 'ARTICULO')->first()->fecha_recepcion !== '2026-08-30'
        || $rows->where('origen', 'publicaciones')->count() !== ($converted ? 2 : 0)) {
        throw new RuntimeException('Synthetic catalog handoff did not preserve counts/category/received date.');
    }
    if ($converted) {
        $db = Illuminate\Support\Facades\DB::class;
        if ($db::table('observatorio_publicaciones')->where('visibilidad_legada', 'privado')->count() !== 1
            || $db::table('observatorio_publicaciones')->whereNotNull('eliminado_legado_at')->count() !== 1
            || App\Models\ObservatorioPublicacion::count() !== 3) {
            throw new RuntimeException('Private/deleted preservation changed during recovery.');
        }
    }
}

if ($action === 'seed') {
    if ($db::selectOne("SELECT count(*) AS n FROM information_schema.tables WHERE table_schema='public'")->n !== 0) {
        throw new RuntimeException('Fixture seeding requires an empty disposable database.');
    }
    Illuminate\Support\Facades\Artisan::call('migrate', ['--force' => true]);
    $service->prepare();
    $department = App\Models\Departamento::create(['nombre' => 'Synthetic recovery', 'codigo_interno' => 'RECOVERY', 'publico' => true]);
    $category = (string) Illuminate\Support\Str::uuid();
    $db::table('categorias_dataset')->insert(['id' => $category, 'nombre' => 'Synthetic recovery category', 'codigo' => 'recovery']);
    $owner = App\Models\User::withoutEvents(fn () => App\Models\User::factory()->create(['rol' => 'ADMIN', 'email' => 'recovery@example.test']));
    $article = App\Infrastructure\Persistence\Eloquent\Models\ArticuloModel::create([
        'titulo' => 'Synthetic article', 'descripcion' => 'Recovery fixture description', 'autor' => 'Synthetic author',
        'fuente' => 'Synthetic source', 'departamento_id' => $department->id, 'categoria_id' => $category, 'estado' => 'PUBLICADO',
        'visibilidad' => 'suscriptor', 'fecha_publicacion' => '2026-09-01', 'fecha_recepcion' => '2026-08-30',
        'enlace' => 'https://example.test/reference',
    ]);
    $report = App\Infrastructure\Persistence\Eloquent\Models\ReporteModel::create([
        'nombre_indicador' => 'Synthetic report', 'descripcion_indicador' => 'Full indicator description', 'fuente' => 'Synthetic source',
        'departamento_id' => $department->id, 'categoria_id' => $category, 'visibilidad' => 'publico', 'fecha_publicacion' => '2026-09-02',
        'link_url' => 'https://app.powerbi.com/view?r=synthetic', 'ficha_indicador' => '/api/reportes/fichas/recovery.pdf',
    ]);
    $pdf = "%PDF-1.4\nSynthetic recovery fixture\n%%EOF";
    $disk->put('public/fichas/recovery.pdf', $pdf);
    $records = [];
    $private = App\Infrastructure\Persistence\Eloquent\Models\ArticuloModel::create([
        ...$article->only(['departamento_id', 'categoria_id', 'titulo', 'fecha_publicacion', 'fecha_recepcion', 'estado']),
        'visibilidad' => 'privado',
    ]);
    $deleted = App\Infrastructure\Persistence\Eloquent\Models\ArticuloModel::create([
        ...$article->only(['departamento_id', 'categoria_id', 'titulo', 'fecha_publicacion', 'fecha_recepcion', 'estado']),
        'visibilidad' => 'publico',
    ]);
    $deleted->delete();
    foreach ([['articulos', $article], ['reportes', $report], ['articulos', $private], ['articulos', $deleted]] as [$table, $model]) {
        $records[] = [
            'source' => $table, 'id' => $model->id, 'source_sha256' => $service::fingerprint((array) $db::table($table)->where('id', $model->id)->first()),
            'target_id' => (string) Illuminate\Support\Str::uuid(), 'codigo' => ($table === 'articulos' ? 'ART-MIG-' : 'REP-MIG-').$model->id,
            'owner_id' => $owner->id, 'owner_decision' => 'Explicit synthetic owner decision in the recovery fixture.',
            ...(($model->deleted_at !== null || $model->visibilidad === 'privado') ? [
                'preservation_decision' => 'Retain the private/deleted restriction in the synthetic recovery.',
            ] : []),
            ...($table === 'reportes' ? ['estado' => 'PUBLICACION', 'state_decision' => 'Explicit synthetic approval for a report without legacy state.',
                'file' => ['source' => 'public/fichas/recovery.pdf', 'sha256' => hash('sha256', $pdf)]] : []),
        ];
    }
    $plan = ['version' => 1, 'batch_id' => (string) Illuminate\Support\Str::uuid(), 'records' => $records];
    $disk->put('manifest.private.json', json_encode($plan, JSON_THROW_ON_ERROR));
    verifyCatalogHandoff(false);
    echo json_encode(['seeded' => true, 'legacy_records' => 4, 'fixture_pdfs' => 1]);
} else {
    $plan = json_decode($disk->get('manifest.private.json'), true, 512, JSON_THROW_ON_ERROR);
    if ($action === 'apply') {
        $before = $service->preview($plan);
        if (! $before['ready']) { throw new RuntimeException('Fixture manifest unexpectedly blocked.'); }
        $first = $service->apply($plan); $repeat = $service->apply($plan);
        if ($first['imported'] !== 4 || $repeat['unchanged'] !== 4) { throw new RuntimeException('Idempotence failed.'); }
        verifyCatalogHandoff(true);
        echo json_encode(['applied' => 4, 'repeat_unchanged' => 4, 'catalog_handoff_verified' => true]);
    } elseif ($action === 'rollback') {
        $result = $service->rollback($plan['batch_id']);
        if ($result['removed'] !== 4 || ! $result['copied_files_removed']) { throw new RuntimeException('Rollback failed.'); }
        verifyCatalogHandoff(false);
        echo json_encode(['removed' => 4, 'original_pdf_retained' => $disk->exists('public/fichas/recovery.pdf')]);
    } elseif ($action === 'verify-restored') {
        if ($db::table('articulos')->count() !== 3 || $db::table('reportes')->count() !== 1
            || $db::table('observatorio_publicaciones')->count() !== 0 || $db::table('phase2_publication_imports')->count() !== 0) {
            throw new RuntimeException('Restored source/target counts differ.');
        }
        verifyCatalogHandoff(false);
        $service->apply($plan); verifyCatalogHandoff(true);
        $service->rollback($plan['batch_id']); verifyCatalogHandoff(false);
        echo json_encode(['restored_fixture_verified' => true, 'reapply_after_restore' => true, 'catalog_handoff_verified' => true]);
    } else { throw new RuntimeException('Unknown fixture action.'); }
}
