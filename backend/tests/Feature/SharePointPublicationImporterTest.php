<?php

namespace Tests\Feature;

use App\Application\Publicaciones\SharePointPublicationImporter;
use App\Infrastructure\Services\PublicationPdfStorage;
use App\Infrastructure\Services\SharePointService;
use App\Models\Departamento;
use App\Models\ObservatorioPublicacion;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class SharePointPublicationImporterTest extends TestCase
{
    use RefreshDatabase;

    private Departamento $department;
    private User $admin;
    private array $temporaryFiles = [];
    private const PDF = "%PDF-1.7\nSynthetic private import\n%%EOF";

    protected function setUp(): void
    {
        parent::setUp();
        config(['filesystems.default' => 'local']); Storage::fake('local');
        $this->department = Departamento::create(['nombre' => 'Importación de ensayo', 'codigo_interno' => 'IMPORT', 'publico' => false]);
        $this->admin = User::withoutEvents(fn () => User::factory()->create(['rol' => 'ADMIN', 'is_active' => true]));
    }

    protected function tearDown(): void
    {
        foreach ($this->temporaryFiles as $file) { if (is_file($file)) unlink($file); }
        parent::tearDown();
    }

    private function file(string $id = 'synthetic'): array
    {
        return ['id' => $id, 'name' => 'Ensayo.pdf', 'size' => strlen(self::PDF), 'mime_type' => 'application/pdf',
            'web_url' => 'https://tenant.sharepoint.test/document', 'last_modified_at' => '2026-10-29T10:00:00Z', 'created_by' => 'Ensayo'];
    }

    private function download(): string
    {
        $path = tempnam(sys_get_temp_dir(), 'pdf-import-test-'); file_put_contents($path, self::PDF);
        $this->temporaryFiles[] = $path; return $path;
    }

    private function mockDownload(): void
    {
        $this->mock(SharePointService::class)->shouldReceive('downloadPdf')->andReturnUsing(fn () => $this->download());
    }

    private function existing(?string $path = 'old.pdf', string $id = 'synthetic'): ObservatorioPublicacion
    {
        if ($path) Storage::put($path, self::PDF);
        return ObservatorioPublicacion::create(['departamento_id' => $this->department->id, 'creado_por' => $this->admin->id,
            'tipo' => 'LIBRO', 'estado' => 'ARCHIVADO', 'observacion_revision' => 'Motivo preservado.', 'fecha_revision' => now(),
            'solo_suscriptores' => true, 'codigo' => 'LIB-'.Str::uuid(), 'titulo' => 'Original',
            'fecha_publicacion' => '2026-10-29', 'archivo_pdf' => $path, 'sharepoint_file_id' => $id]);
    }

    public function test_batch_returns_models_preserves_duplicates_and_deletes_temporary_downloads(): void
    {
        $this->mockDownload(); $importer = app(SharePointPublicationImporter::class);
        $counter = DB::table('publicacion_contadores')->where('tipo', 'LIBRO')->value('siguiente_numero');
        $result = $importer->importPdfs($this->admin, $this->department, ['synthetic'], 'LIBRO', fn ($id) => $this->file($id));
        $this->assertSame(['imported' => 1, 'duplicates' => 0, 'rejected' => 0, 'errors' => 0], $result['totals']);
        $p = $result['data']['imported'][0]; $this->assertInstanceOf(ObservatorioPublicacion::class, $p);
        $this->assertSame(self::PDF, Storage::get($p->archivo_pdf));
        $this->assertSame($counter + 1, DB::table('publicacion_contadores')->where('tipo', 'LIBRO')->value('siguiente_numero'));
        $before = $p->getAttributes();
        $result = $importer->importPdfs($this->admin, $this->department, ['synthetic'], 'LIBRO', fn ($id) => $this->file($id));
        $this->assertSame(1, $result['totals']['duplicates']);
        $this->assertSame($before, $p->fresh()->getAttributes());
        $this->assertCount(1, Storage::allFiles());
        foreach ($this->temporaryFiles as $file) $this->assertFileDoesNotExist($file);
    }

    public function test_database_failure_compensates_new_copy_rolls_back_counter_and_keeps_other_batch_items(): void
    {
        $this->mockDownload(); $counter = DB::table('publicacion_contadores')->where('tipo', 'LIBRO')->value('siguiente_numero');
        ObservatorioPublicacion::creating(function (ObservatorioPublicacion $p) {
            if ($p->sharepoint_file_id === 'failed') throw new \RuntimeException('Database unavailable at private-provider.test?secret=synthetic');
        });
        $result = app(SharePointPublicationImporter::class)->importPdfs($this->admin, $this->department,
            ['failed', 'ok'], 'LIBRO', fn ($id) => $this->file($id));
        $this->assertSame(1, $result['totals']['errors']); $this->assertSame(1, $result['totals']['imported']);
        $this->assertStringNotContainsString('private-provider', json_encode($result['data']['errors']));
        $this->assertSame($counter + 1, DB::table('publicacion_contadores')->where('tipo', 'LIBRO')->value('siguiente_numero'));
        $this->assertDatabaseCount('observatorio_publicaciones', 1); $this->assertCount(1, Storage::allFiles());
        foreach ($this->temporaryFiles as $file) $this->assertFileDoesNotExist($file);
    }

    public function test_failed_refresh_preserves_original_pdf_metadata_and_decision(): void
    {
        $this->mockDownload(); $p = $this->existing(); $before = $p->fresh()->getAttributes();
        ObservatorioPublicacion::updating(fn () => throw new \RuntimeException('Synthetic save failure'));
        try {
            app(SharePointPublicationImporter::class)->savePdf($this->admin, $this->department, $this->file(), 'LIBRO', refresh: true);
            $this->fail('Expected save failure.');
        } catch (\RuntimeException $e) { $this->assertSame('Synthetic save failure', $e->getMessage()); }
        $this->assertSame($before, $p->fresh()->getAttributes());
        $this->assertSame(['old.pdf'], Storage::allFiles()); $this->assertSame(self::PDF, Storage::get('old.pdf'));
        foreach ($this->temporaryFiles as $file) $this->assertFileDoesNotExist($file);
    }

    public function test_successful_refresh_preserves_decision_and_keeps_mapped_backup_pdf(): void
    {
        $this->mockDownload(); $p = $this->existing();
        DB::table('publication_origins')->insert(['id' => (string) Str::uuid(), 'source_table' => 'reportes',
            'source_kind' => 'compatibility', 'source_id' => (string) Str::uuid(), 'target_id' => $p->id,
            'created_at' => now(), 'updated_at' => now()]);
        $date = $p->fecha_revision->toIso8601String();
        $updated = app(SharePointPublicationImporter::class)->savePdf($this->admin, $this->department, $this->file(), 'LIBRO', refresh: true);
        $this->assertNotSame('old.pdf', $updated->archivo_pdf); Storage::assertExists('old.pdf');
        $this->assertSame('ARCHIVADO', $updated->estado); $this->assertSame('Motivo preservado.', $updated->observacion_revision);
        $this->assertSame($date, $updated->fecha_revision->toIso8601String()); $this->assertTrue($updated->solo_suscriptores);
        $this->assertSame($p->codigo, $updated->codigo); $this->assertCount(2, Storage::allFiles());
    }

    public function test_refresh_of_native_pdf_replaces_only_its_previous_copy_after_commit(): void
    {
        $this->mockDownload(); $p = $this->existing(); Storage::put('unrelated.pdf', self::PDF);
        $updated = app(SharePointPublicationImporter::class)->savePdf($this->admin, $this->department, $this->file(), 'LIBRO', refresh: true);
        Storage::assertMissing('old.pdf'); Storage::assertExists('unrelated.pdf'); Storage::assertExists($updated->archivo_pdf);
        $this->assertSame('ARCHIVADO', $updated->estado); $this->assertSame($p->codigo, $updated->codigo);
        $this->assertCount(2, Storage::allFiles());
    }

    public function test_deleted_atlas_category_during_download_rolls_back_and_removes_the_copied_pdf(): void
    {
        $category = \App\Models\AtlasCategoria::create(['nombre' => 'Categoría de ensayo', 'publico' => true]);
        $service = $this->mock(SharePointService::class);
        $service->shouldReceive('downloadPdf')->once()->andReturnUsing(function () use ($category) {
            $category->delete(); return $this->download();
        });
        $counter = DB::table('publicacion_contadores')->where('tipo', 'ATLAS')->value('siguiente_numero');
        $result = app(SharePointPublicationImporter::class)->importPdfs($this->admin, null,
            ['synthetic'], 'ATLAS', fn ($id) => $this->file($id), $category->id);
        $this->assertSame(1, $result['totals']['errors']); $this->assertSame(0, $result['totals']['imported']);
        $this->assertSame($counter, DB::table('publicacion_contadores')->where('tipo', 'ATLAS')->value('siguiente_numero'));
        $this->assertDatabaseCount('observatorio_publicaciones', 0); $this->assertSame([], Storage::allFiles());
        foreach ($this->temporaryFiles as $file) $this->assertFileDoesNotExist($file);
    }

    public function test_duplicate_appearing_during_download_is_rechecked_and_unused_copy_is_removed(): void
    {
        $storage = $this->mock(PublicationPdfStorage::class)->makePartial();
        $storage->shouldReceive('copyFromSharePoint')->once()->andReturnUsing(function () {
            $this->existing('winner.pdf'); Storage::put('unused.pdf', self::PDF); return 'unused.pdf';
        });
        $counter = DB::table('publicacion_contadores')->where('tipo', 'LIBRO')->value('siguiente_numero');
        $result = app(SharePointPublicationImporter::class)->importPdfs($this->admin, $this->department,
            ['synthetic'], 'LIBRO', fn ($id) => $this->file($id));
        $this->assertSame(1, $result['totals']['duplicates']); $this->assertSame(0, $result['totals']['imported']);
        $this->assertSame($counter, DB::table('publicacion_contadores')->where('tipo', 'LIBRO')->value('siguiente_numero'));
        $this->assertDatabaseCount('observatorio_publicaciones', 1); $this->assertSame(['winner.pdf'], Storage::allFiles());
    }

    public function test_application_and_http_reject_non_administrators_before_resolving_or_downloading_files(): void
    {
        $this->mock(SharePointService::class)->shouldNotReceive('downloadPdf');
        foreach (['USER', 'SUBSCRIBER', 'EDITOR', 'ADMIN_OBSERVATORIO'] as $role) {
            $actor = User::withoutEvents(fn () => User::factory()->create(['rol' => $role, 'is_active' => true]));
            try {
                app(SharePointPublicationImporter::class)->importPdfs($actor, $this->department, ['synthetic'], 'LIBRO', fn () => $this->fail('Resolver called.'));
                $this->fail('Unauthorized import.');
            } catch (\Symfony\Component\HttpKernel\Exception\HttpExceptionInterface $e) { $this->assertSame(403, $e->getStatusCode()); }
            Sanctum::actingAs($actor);
            $this->postJson('/api/departamentos/'.$this->department->id.'/publicaciones/libros/sharepoint/import-many',
                ['sharepoint_file_ids' => ['synthetic']])->assertForbidden();
        }
        $this->assertDatabaseCount('observatorio_publicaciones', 0);
    }

    public function test_import_errors_do_not_echo_provider_secrets_to_response_or_log_context(): void
    {
        Log::spy(); $secret = 'synthetic-private-diagnostic';
        $result = app(SharePointPublicationImporter::class)->importPdfs($this->admin, $this->department,
            ['runtime', 'unexpected'], 'LIBRO', function ($id) use ($secret) {
                if ($id === 'runtime') throw new \RuntimeException('PDF: '.$secret);
                throw new \Exception($secret);
            });
        $this->assertSame(1, $result['totals']['rejected']); $this->assertSame(1, $result['totals']['errors']);
        $this->assertStringNotContainsString($secret, json_encode($result));
        Log::shouldHaveReceived('warning')->once()->with('SharePoint publication import failed', \Mockery::on(
            fn ($context) => ! str_contains(json_encode($context), $secret) && ! isset($context['message'])));
    }

    public function test_http_deletion_keeps_the_record_when_storage_cannot_confirm_removal(): void
    {
        $p = $this->existing(); $before = $p->fresh()->getAttributes(); Sanctum::actingAs($this->admin);
        $disk = \Mockery::mock(\Illuminate\Filesystem\FilesystemAdapter::class);
        $disk->shouldReceive('exists')->once()->with('old.pdf')->andReturn(true);
        $disk->shouldReceive('delete')->once()->with('old.pdf')->andReturn(false);
        Storage::shouldReceive('disk')->with('local')->andReturn($disk);
        $this->deleteJson('/api/departamentos/publicaciones/'.$p->id)->assertStatus(503);
        $this->assertSame($before, $p->fresh()->getAttributes());
    }
}
