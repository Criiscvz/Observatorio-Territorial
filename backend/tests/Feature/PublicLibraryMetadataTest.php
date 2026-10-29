<?php

namespace Tests\Feature;

use App\Models\Departamento;
use App\Models\ObservatorioPublicacion;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PublicLibraryMetadataTest extends TestCase
{
    use RefreshDatabase;

    public function test_public_article_keeps_its_reference_link_separate_from_its_pdf_and_returns_its_code(): void
    {
        $publication = $this->publication('ARTICULO');
        $this->getJson('/api/articulos?departamento_id='.$publication->departamento_id)
            ->assertOk()->assertJsonPath('0.codigo', 'ART-PUBLIC')
            ->assertJsonPath('0.link_url', 'https://example.test/fuente')
            ->assertJsonPath('0.download_url', "/api/departamentos/publicaciones/{$publication->id}/download");
        $publication->update(['solo_suscriptores' => true]);
        $this->getJson('/api/articulos?departamento_id='.$publication->departamento_id)
            ->assertOk()->assertJsonPath('0.bloqueado', true)
            ->assertJsonPath('0.link_url', null)->assertJsonPath('0.download_url', null);
    }

    public function test_public_reports_include_saved_code_and_authors_and_keep_restricted_links_hidden(): void
    {
        $publication = $this->publication('REPORTE');
        $this->getJson('/api/reportes?departamento_id='.$publication->departamento_id)
            ->assertOk()->assertJsonPath('0.codigo', 'REP-PUBLIC')
            ->assertJsonPath('0.autores', ['Ana', 'Luis']);
        $publication->update(['solo_suscriptores' => true]);
        $this->getJson('/api/reportes?departamento_id='.$publication->departamento_id)
            ->assertOk()->assertJsonPath('0.bloqueado', true)
            ->assertJsonPath('0.link_url', null)->assertJsonPath('0.download_url', null);
    }

    public function test_sharepoint_powerbi_shortcut_is_not_advertised_as_a_pdf(): void
    {
        $publication = $this->publication('REPORTE');
        $publication->update(['archivo_pdf' => null, 'link_url' => 'https://app.powerbi.com/view?r=publico',
            'sharepoint_file_id' => 'shortcut', 'sharepoint_url' => 'https://tenant.sharepoint.com/reporte.url',
            'sharepoint_file_type' => 'application/octet-stream']);
        $this->getJson('/api/reportes?departamento_id='.$publication->departamento_id)->assertOk()
            ->assertJsonPath('0.link_url', 'https://app.powerbi.com/view?r=publico')
            ->assertJsonPath('0.download_url', null)->assertJsonPath('0.ficha_indicador', null)->assertJsonPath('0.sharepoint_url', null);
        \Laravel\Sanctum\Sanctum::actingAs(User::factory()->create(['rol' => 'ADMIN']));
        $this->getJson('/api/departamentos/'.$publication->departamento_id.'/publicaciones')->assertOk()
            ->assertJsonPath('data.0.download_url', null)->assertJsonPath('data.0.sharepoint_url', null);
    }

    private function publication(string $type): ObservatorioPublicacion
    {
        $department = Departamento::create(['nombre' => 'Salud', 'codigo_interno' => 'PUBLIC', 'publico' => true]);
        return ObservatorioPublicacion::create([
            'departamento_id' => $department->id, 'creado_por' => User::factory()->create()->id,
            'tipo' => $type, 'codigo' => $type === 'ARTICULO' ? 'ART-PUBLIC' : 'REP-PUBLIC',
            'estado' => 'PUBLICACION', 'titulo' => 'Publicación de prueba', 'fecha_publicacion' => '2026-10-21',
            'fuente' => 'ULEAM', 'autores' => ['Ana', 'Luis'], 'link_url' => 'https://example.test/fuente',
            'archivo_pdf' => 'prueba.pdf', 'nombre_archivo_original' => 'prueba.pdf', 'solo_suscriptores' => false,
        ]);
    }
}
