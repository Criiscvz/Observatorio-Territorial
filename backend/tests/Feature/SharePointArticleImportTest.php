<?php

namespace Tests\Feature;

use App\Infrastructure\Services\SharePointService;
use App\Models\Departamento;
use App\Models\ObservatorioPublicacion;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Illuminate\Support\Facades\Storage;
use Mockery\MockInterface;
use Tests\TestCase;

class SharePointArticleImportTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        config(['filesystems.default' => 'local']);
        Storage::fake('local');
    }

    private function mockDownload(MockInterface $mock): void
    {
        $mock->shouldReceive('downloadPdf')->andReturnUsing(function () {
            $path = tempnam(sys_get_temp_dir(), 'pdf-test-');
            file_put_contents($path, "%PDF-1.7\nCopia de prueba\n%%EOF");
            return $path;
        });
    }

    public function test_barometer_files_are_imported_as_articles_reports_and_department_books(): void
    {
        $admin = User::factory()->create([
            'rol' => 'ADMIN',
            'is_active' => true,
        ]);
        $departamento = Departamento::create([
            'nombre' => 'Observatorio de prueba',
            'codigo_interno' => 'OBS-SP',
            'publico' => true,
        ]);

        $barometerFile = $this->sharePointFile('barometer-pdf', 'Indicadores Barómetro.pdf');
        $reportFile = $this->sharePointFile('report-pdf', 'Reporte Barómetro.pdf');
        $atlasFile = $this->sharePointFile('atlas-pdf', 'Atlas Territorial.pdf');

        $this->mock(SharePointService::class, function (MockInterface $mock) use ($barometerFile, $reportFile, $atlasFile) {
            $this->mockDownload($mock);
            $mock->shouldReceive('browseBarometerFolder')
                ->twice()
                ->with(null)
                ->andReturn([
                    'current' => ['id' => 'barometer-root', 'name' => 'Barómetro'],
                    'root' => ['id' => 'barometer-root', 'name' => 'Barómetro'],
                    'parent' => null,
                    'breadcrumbs' => [['id' => 'barometer-root', 'name' => 'Barómetro']],
                    'items' => [],
                ]);
            $mock->shouldReceive('getPdfFileInsideBarometerRoot')
                ->twice()
                ->with('barometer-pdf')
                ->andReturn($barometerFile);
            $mock->shouldReceive('getPdfFileInsideBarometerRoot')
                ->twice()
                ->with('report-pdf')
                ->andReturn($reportFile);
            $mock->shouldReceive('getPdfFileInsideRoot')
                ->once()
                ->with('atlas-pdf')
                ->andReturn($atlasFile);
        });

        Sanctum::actingAs($admin);

        $this->getJson("/api/departamentos/{$departamento->id}/publicaciones/articulos/sharepoint/browse")
            ->assertOk()
            ->assertJsonPath('data.current.name', 'Barómetro');

        $articleEndpoint = "/api/departamentos/{$departamento->id}/publicaciones/articulos/sharepoint/import-many";
        $this->postJson($articleEndpoint, ['sharepoint_file_ids' => ['barometer-pdf']])
            ->assertOk()
            ->assertJsonPath('totals.imported', 1)
            ->assertJsonPath('totals.errors', 0);

        $this->postJson($articleEndpoint, ['sharepoint_file_ids' => ['barometer-pdf']])
            ->assertOk()
            ->assertJsonPath('totals.imported', 0)
            ->assertJsonPath('totals.duplicates', 1);

        $this->getJson('/api/articulos')
            ->assertOk()
            ->assertJsonFragment([
                'titulo' => 'Indicadores Barómetro',
                'sharepoint_url' => null,
            ]);

        $this->getJson("/api/departamentos/{$departamento->id}/publicaciones/reportes/sharepoint/browse")
            ->assertOk()
            ->assertJsonPath('data.current.name', 'Barómetro');

        $reportEndpoint = "/api/departamentos/{$departamento->id}/publicaciones/reportes/sharepoint/import-many";
        $this->postJson($reportEndpoint, ['sharepoint_file_ids' => ['report-pdf']])
            ->assertOk()
            ->assertJsonPath('totals.imported', 1)
            ->assertJsonPath('totals.errors', 0);

        $this->postJson($reportEndpoint, ['sharepoint_file_ids' => ['report-pdf']])
            ->assertOk()
            ->assertJsonPath('totals.imported', 0)
            ->assertJsonPath('totals.duplicates', 1);

        $this->postJson(
            "/api/departamentos/{$departamento->id}/publicaciones/atlas/sharepoint/import-many",
            ['sharepoint_file_ids' => ['atlas-pdf']],
        )
            ->assertOk()
            ->assertJsonPath('totals.imported', 1);

        $this->assertDatabaseHas('observatorio_publicaciones', [
            'departamento_id' => $departamento->id,
            'tipo' => 'ARTICULO',
            'sharepoint_file_id' => 'barometer-pdf',
        ]);
        $this->assertDatabaseHas('observatorio_publicaciones', [
            'departamento_id' => $departamento->id,
            'tipo' => 'REPORTE',
            'sharepoint_file_id' => 'report-pdf',
        ]);
        $this->assertDatabaseHas('observatorio_publicaciones', [
            'departamento_id' => $departamento->id,
            'tipo' => 'LIBRO',
            'sharepoint_file_id' => 'atlas-pdf',
        ]);
        $this->assertSame(1, ObservatorioPublicacion::where('sharepoint_file_id', 'barometer-pdf')->count());
        $this->assertStringStartsWith(
            'ART-',
            ObservatorioPublicacion::where('sharepoint_file_id', 'barometer-pdf')->value('codigo'),
        );
        $this->assertSame(1, ObservatorioPublicacion::where('sharepoint_file_id', 'report-pdf')->count());
        $this->assertStringStartsWith(
            'REP-',
            ObservatorioPublicacion::where('sharepoint_file_id', 'report-pdf')->value('codigo'),
        );
        $this->assertStringStartsWith(
            'LIB-',
            ObservatorioPublicacion::where('sharepoint_file_id', 'atlas-pdf')->value('codigo'),
        );
    }

    public function test_current_import_routes_preserve_types_and_report_partial_failures_and_duplicates(): void
    {
        Sanctum::actingAs(User::factory()->create(['rol' => 'ADMIN', 'is_active' => true]));
        $service = $this->mock(SharePointService::class);
        $this->mockDownload($service);
        foreach (['articulos' => 'ARTICULO', 'libros' => 'LIBRO', 'reportes' => 'REPORTE'] as $target => $type) {
            $department = Departamento::create(['nombre' => 'Destino '.$type, 'codigo_interno' => 'DEST-'.$type, 'publico' => false]);
            $resolve = $type === 'LIBRO' ? 'getPdfFileInsideRoot' : 'getPdfFileInsideBarometerRoot';
            $id = $target.'-pdf';
            $service->shouldReceive($resolve)->twice()->with($id)->andReturn($this->sharePointFile($id, $type.'.pdf'));
            $service->shouldReceive($resolve)->once()->with($target.'-invalid')->andThrow(new \RuntimeException('El archivo no es un PDF valido.'));
            $service->shouldReceive($resolve)->once()->with($target.'-unavailable')->andThrow(new \RuntimeException('No se pudo obtener el archivo de SharePoint.'));
            $endpoint = "/api/departamentos/{$department->id}/publicaciones/{$target}/sharepoint/import-many";
            $this->postJson($endpoint, ['sharepoint_file_ids' => [$id, $target.'-invalid', $target.'-unavailable']])
                ->assertOk()->assertJsonPath('totals.imported', 1)->assertJsonPath('totals.rejected', 1)->assertJsonPath('totals.errors', 1)
                ->assertJsonPath('data.imported.0.tipo', $type)->assertJsonPath('data.imported.0.departamento_id', $department->id);
            $this->postJson($endpoint, ['sharepoint_file_ids' => [$id]])->assertOk()
                ->assertJsonPath('totals.imported', 0)->assertJsonPath('totals.duplicates', 1);
            $this->getJson("/api/departamentos/{$department->id}/publicaciones?tipo={$type}")->assertOk()->assertJsonCount(1, 'data');
            $this->assertSame(1, ObservatorioPublicacion::where('departamento_id', $department->id)->where('tipo', $type)->count());
        }
        $this->assertSame(0, ObservatorioPublicacion::where('tipo', 'ATLAS')->count());
    }

    public function test_import_routes_reject_unauthorized_users(): void
    {
        $department = Departamento::create(['nombre' => 'Destino protegido', 'codigo_interno' => 'PROT-SP', 'publico' => true]);
        $endpoint = "/api/departamentos/{$department->id}/publicaciones/libros/sharepoint/import-many";
        $this->postJson($endpoint, ['sharepoint_file_ids' => ['pdf']])->assertUnauthorized();
        Sanctum::actingAs(User::factory()->create(['rol' => 'USER']));
        $this->postJson($endpoint, ['sharepoint_file_ids' => ['pdf']])->assertForbidden();
        $this->assertSame(0, ObservatorioPublicacion::count());
    }

    public function test_import_routes_reject_empty_and_repeated_selections(): void
    {
        $department = Departamento::create(['nombre' => 'Destino protegido', 'codigo_interno' => 'PROT-SP', 'publico' => true]);
        $endpoint = "/api/departamentos/{$department->id}/publicaciones/libros/sharepoint/import-many";
        Sanctum::actingAs(User::factory()->create(['rol' => 'ADMIN']));
        $this->postJson($endpoint, ['sharepoint_file_ids' => []])->assertUnprocessable()->assertJsonValidationErrors('sharepoint_file_ids');
        $this->postJson($endpoint, ['sharepoint_file_ids' => ['same', 'same']])->assertUnprocessable();
        $this->assertSame(0, ObservatorioPublicacion::count());
    }

    private function sharePointFile(string $id, string $name): array
    {
        return [
            'id' => $id,
            'name' => $name,
            'web_url' => "https://sharepoint.test/{$id}",
            'mime_type' => 'application/pdf',
            'size' => 1024,
            'created_at' => '2026-07-15T00:00:00Z',
            'last_modified_at' => '2026-07-15T00:00:00Z',
            'created_by' => 'ULEAM',
        ];
    }
}
