<?php

namespace Tests\Feature;

use App\Infrastructure\Services\SharePointService;
use App\Models\Departamento;
use App\Models\ObservatorioPublicacion;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class PublicationPdfReaderTest extends TestCase
{
    use RefreshDatabase;
    private const PDF = "%PDF-1.7\nDocumento de prueba\n%%EOF";

    protected function setUp(): void
    {
        parent::setUp();
        config(['filesystems.default' => 'local', 'services.sharepoint.tenant_id' => 'tenant-test',
            'services.sharepoint.client_id' => 'client-test', 'services.sharepoint.client_secret' => 'fake-secret',
            'services.sharepoint.drive_id' => 'drive-test']);
        Storage::fake('local');
        Http::preventStrayRequests();
    }

    public function test_graph_download_follows_trusted_redirect_without_forwarding_token_and_checks_pdf_bytes(): void
    {
        Http::fake([
            'https://login.microsoftonline.com/*' => Http::response(['access_token' => 'graph-test-token']),
            'https://graph.microsoft.com/v1.0/drives/drive-test/items/pdf/content' => Http::response('', 302, ['Location' => 'https://tenant.sharepoint.com/download']),
            'https://tenant.sharepoint.com/download' => Http::response(self::PDF, 200, ['Content-Type' => 'application/pdf']),
        ]);
        $path = app(SharePointService::class)->downloadPdf('pdf');
        try { $this->assertSame(self::PDF, file_get_contents($path)); } finally { unlink($path); }
        Http::assertSent(fn ($request) => $request->url() === 'https://tenant.sharepoint.com/download' && ! $request->hasHeader('Authorization'));
    }

    public function test_graph_download_rejects_html_even_when_named_pdf_and_rejects_oversized_content(): void
    {
        Http::fake([
            'https://login.microsoftonline.com/*' => Http::response(['access_token' => 'graph-test-token']),
            'https://graph.microsoft.com/*' => Http::sequence()->push('<html>Sign in</html>', 200)
                ->push(self::PDF, 200, ['Content-Length' => 21 * 1024 * 1024]),
        ]);
        foreach (['HTML', 'LARGE'] as $file) {
            try { app(SharePointService::class)->downloadPdf($file); $this->fail('Se aceptó contenido no válido.'); }
            catch (\RuntimeException $error) { $this->assertStringContainsString('PDF', $error->getMessage()); }
        }
    }

    public function test_graph_download_rejects_redirect_to_non_microsoft_destination(): void
    {
        Http::fake([
            'https://login.microsoftonline.com/*' => Http::response(['access_token' => 'graph-test-token']),
            'https://graph.microsoft.com/*' => Http::response('', 302, ['Location' => 'http://127.0.0.1/private']),
        ]);
        $this->expectException(\RuntimeException::class);
        app(SharePointService::class)->downloadPdf('unsafe');
    }

    public function test_stored_pdf_is_read_without_sharepoint_and_direct_url_enforces_subscription_and_status(): void
    {
        $publication = $this->publication();
        Storage::disk('local')->put('reader.pdf', self::PDF);
        $url = "/api/departamentos/publicaciones/{$publication->id}/download";
        $response = $this->get($url)->assertOk()->assertHeader('Content-Type', 'application/pdf');
        $this->assertSame(self::PDF, $response->streamedContent());
        $this->assertStringContainsString('no-store', $response->headers->get('Cache-Control'));
        $publication->update(['solo_suscriptores' => true]);
        $this->getJson($url)->assertForbidden();
        // SQLite retains the original two-role check; Sanctum receives the
        // subscriber role in memory, as the PostgreSQL migration permits it.
        $subscriber = User::factory()->create(['rol' => 'USER']);
        $subscriber->rol = 'SUBSCRIBER';
        Sanctum::actingAs($subscriber);
        $this->get($url)->assertOk();
        $publication->update(['estado' => 'EN_REVISION']);
        $this->getJson($url)->assertNotFound();
        Http::assertNothingSent();
    }

    public function test_legacy_pdf_does_not_redirect_visitors_to_sharepoint(): void
    {
        $publication = $this->publication();
        $publication->update(['archivo_pdf' => null]);
        $this->getJson("/api/departamentos/publicaciones/{$publication->id}/download")->assertStatus(409)->assertHeaderMissing('Location');
    }

    public function test_reimport_materializes_existing_pdf_without_changing_access_or_consuming_code(): void
    {
        $publication = $this->publication();
        $publication->update(['archivo_pdf' => null, 'solo_suscriptores' => true, 'estado' => 'EN_REVISION']);
        $service = $this->mock(SharePointService::class);
        $service->shouldReceive('getPdfFileInsideRoot')->twice()->with('original')->andReturn([
            'id' => 'original', 'name' => 'original.pdf', 'size' => 100,
        ]);
        $service->shouldReceive('downloadPdf')->once()->andReturnUsing(function () {
            $path = tempnam(sys_get_temp_dir(), 'pdf-test-'); file_put_contents($path, self::PDF); return $path;
        });
        Sanctum::actingAs(User::factory()->create(['rol' => 'ADMIN']));
        $url = "/api/departamentos/{$publication->departamento_id}/publicaciones/libros/sharepoint/import-many";
        for ($n = 0; $n < 2; $n++) $this->postJson($url, ['sharepoint_file_ids' => ['original']])->assertOk()->assertJsonPath('totals.duplicates', 1);
        $publication->refresh();
        Storage::disk('local')->assertExists($publication->archivo_pdf);
        $this->assertSame(self::PDF, Storage::disk('local')->get($publication->archivo_pdf));
        $this->assertSame('LIB-READER', $publication->codigo);
        $this->assertTrue($publication->solo_suscriptores);
        $this->assertSame('EN_REVISION', $publication->estado);
        $this->assertSame(1, ObservatorioPublicacion::count());
    }

    public function test_failed_copy_does_not_create_a_publication_or_leave_a_file(): void
    {
        $department = Departamento::create(['nombre' => 'Destino', 'codigo_interno' => 'FAIL-COPY', 'publico' => false]);
        Sanctum::actingAs(User::factory()->create(['rol' => 'ADMIN']));
        $service = $this->mock(SharePointService::class);
        $service->shouldReceive('getPdfFileInsideRoot')->andReturn(['id' => 'failure', 'name' => 'failure.pdf', 'size' => 20]);
        $service->shouldReceive('downloadPdf')->andThrow(new \RuntimeException('No se pudo descargar el PDF.'));
        $this->postJson("/api/departamentos/{$department->id}/publicaciones/libros/sharepoint/import-many", ['sharepoint_file_ids' => ['failure']])
            ->assertOk()->assertJsonPath('totals.imported', 0);
        $this->assertSame(0, ObservatorioPublicacion::count());
        $this->assertSame([], Storage::disk('local')->allFiles());
    }

    private function publication(): ObservatorioPublicacion
    {
        $department = Departamento::create(['nombre' => 'Salud', 'codigo_interno' => 'READER', 'publico' => true]);
        return ObservatorioPublicacion::create(['departamento_id' => $department->id, 'creado_por' => User::factory()->create()->id,
            'tipo' => 'LIBRO', 'codigo' => 'LIB-READER', 'titulo' => 'Lectura de prueba', 'fecha_publicacion' => '2026-10-21',
            'estado' => 'PUBLICACION', 'solo_suscriptores' => false, 'archivo_pdf' => 'reader.pdf',
            'sharepoint_file_id' => 'original', 'sharepoint_url' => 'https://tenant.sharepoint.com/original', 'nombre_archivo_original' => 'reader.pdf']);
    }
}
