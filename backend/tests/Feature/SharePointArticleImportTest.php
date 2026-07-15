<?php

namespace Tests\Feature;

use App\Infrastructure\Services\SharePointService;
use App\Models\Departamento;
use App\Models\ObservatorioPublicacion;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Mockery\MockInterface;
use Tests\TestCase;

class SharePointArticleImportTest extends TestCase
{
    use RefreshDatabase;

    public function test_barometer_files_are_imported_as_articles_and_reports_without_affecting_atlas(): void
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
                'sharepoint_url' => 'https://sharepoint.test/barometer-pdf',
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
            'tipo' => 'ATLAS',
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
