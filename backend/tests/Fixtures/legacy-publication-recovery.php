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

if ($action === 'seed') {
    if ($db::selectOne("SELECT count(*) AS n FROM information_schema.tables WHERE table_schema='public'")->n !== 0) {
        throw new RuntimeException('Fixture seeding requires an empty disposable database.');
    }
    Illuminate\Support\Facades\Artisan::call('migrate', ['--force' => true]);
    $service->prepare();
    $department = App\Models\Departamento::create(['nombre' => 'Synthetic recovery', 'codigo_interno' => 'RECOVERY', 'publico' => true]);
    $owner = App\Models\User::withoutEvents(fn () => App\Models\User::factory()->create(['rol' => 'ADMIN', 'email' => 'recovery@example.test']));
    $article = App\Infrastructure\Persistence\Eloquent\Models\ArticuloModel::create([
        'titulo' => 'Synthetic article', 'descripcion' => 'Recovery fixture description', 'autor' => 'Synthetic author',
        'fuente' => 'Synthetic source', 'departamento_id' => $department->id, 'estado' => 'PUBLICADO',
        'visibilidad' => 'suscriptor', 'fecha_publicacion' => '2026-09-01', 'fecha_recepcion' => '2026-08-30',
        'enlace' => 'https://example.test/reference',
    ]);
    $report = App\Infrastructure\Persistence\Eloquent\Models\ReporteModel::create([
        'nombre_indicador' => 'Synthetic report', 'descripcion_indicador' => 'Full indicator description', 'fuente' => 'Synthetic source',
        'departamento_id' => $department->id, 'visibilidad' => 'publico', 'fecha_publicacion' => '2026-09-02',
        'link_url' => 'https://app.powerbi.com/view?r=synthetic', 'ficha_indicador' => '/api/reportes/fichas/recovery.pdf',
    ]);
    $pdf = "%PDF-1.4\nSynthetic recovery fixture\n%%EOF";
    $disk->put('public/fichas/recovery.pdf', $pdf);
    $records = [];
    foreach (['articulos' => $article, 'reportes' => $report] as $table => $model) {
        $records[] = [
            'source' => $table, 'id' => $model->id, 'source_sha256' => $service::fingerprint((array) $db::table($table)->where('id', $model->id)->first()),
            'target_id' => (string) Illuminate\Support\Str::uuid(), 'codigo' => ($table === 'articulos' ? 'ART-MIG-' : 'REP-MIG-').$model->id,
            'owner_id' => $owner->id, 'owner_decision' => 'Explicit synthetic owner decision in the recovery fixture.',
            ...($table === 'reportes' ? ['estado' => 'PUBLICACION', 'state_decision' => 'Explicit synthetic approval for a report without legacy state.',
                'file' => ['source' => 'public/fichas/recovery.pdf', 'sha256' => hash('sha256', $pdf)]] : []),
        ];
    }
    $plan = ['version' => 1, 'batch_id' => (string) Illuminate\Support\Str::uuid(), 'records' => $records];
    $disk->put('manifest.private.json', json_encode($plan, JSON_THROW_ON_ERROR));
    echo json_encode(['seeded' => true, 'legacy_records' => 2, 'fixture_pdfs' => 1]);
} else {
    $plan = json_decode($disk->get('manifest.private.json'), true, 512, JSON_THROW_ON_ERROR);
    if ($action === 'apply') {
        $before = $service->preview($plan);
        if (! $before['ready']) { throw new RuntimeException('Fixture manifest unexpectedly blocked.'); }
        $first = $service->apply($plan); $repeat = $service->apply($plan);
        if ($first['imported'] !== 2 || $repeat['unchanged'] !== 2) { throw new RuntimeException('Idempotence failed.'); }
        echo json_encode(['applied' => 2, 'repeat_unchanged' => 2]);
    } elseif ($action === 'rollback') {
        $result = $service->rollback($plan['batch_id']);
        if ($result['removed'] !== 2 || ! $result['copied_files_removed']) { throw new RuntimeException('Rollback failed.'); }
        echo json_encode(['removed' => 2, 'original_pdf_retained' => $disk->exists('public/fichas/recovery.pdf')]);
    } elseif ($action === 'verify-restored') {
        if ($db::table('articulos')->count() !== 1 || $db::table('reportes')->count() !== 1
            || $db::table('observatorio_publicaciones')->count() !== 0 || $db::table('phase2_publication_imports')->count() !== 0) {
            throw new RuntimeException('Restored source/target counts differ.');
        }
        $service->apply($plan); $service->rollback($plan['batch_id']);
        echo json_encode(['restored_fixture_verified' => true, 'reapply_after_restore' => true]);
    } else { throw new RuntimeException('Unknown fixture action.'); }
}
