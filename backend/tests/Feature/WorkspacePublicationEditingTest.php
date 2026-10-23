<?php

namespace Tests\Feature;

use App\Models\Departamento;
use App\Models\ObservatorioPublicacion;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class WorkspacePublicationEditingTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        config(['filesystems.default' => 'local']);
        Storage::fake('local');
    }

    public function test_editing_each_type_persists_subscribers_and_metadata_and_preserves_the_existing_pdf(): void
    {
        Sanctum::actingAs(User::factory()->create(['rol' => 'ADMIN']));
        $department = Departamento::create(['nombre' => 'Salud de prueba', 'codigo_interno' => 'QA', 'publico' => true]);
        foreach (['ARTICULO', 'LIBRO', 'REPORTE'] as $type) {
            $original = $this->post("/api/departamentos/{$department->id}/publicaciones", [
                ...$this->payload(), 'tipo' => $type,
                'archivo' => UploadedFile::fake()->create('original.pdf', 1, 'application/pdf'),
            ], ['Accept' => 'application/json'])->assertCreated();
            $id = $original->json('data.id');
            $path = ObservatorioPublicacion::findOrFail($id)->archivo_pdf;
            $this->post("/api/departamentos/publicaciones/{$id}", [
                ...$this->payload(), '_method' => 'PATCH', 'titulo' => "Editado {$type}",
                'solo_suscriptores' => '1', 'descripcion' => 'Descripción actualizada',
                'fuente' => 'Fuente actualizada', 'autores' => [' Ana ', 'Luis'],
            ], ['Accept' => 'application/json'])->assertOk()
                ->assertJsonPath('data.titulo', "Editado {$type}")
                ->assertJsonPath('data.autores', ['Ana', 'Luis'])
                ->assertJsonPath('data.solo_suscriptores', true);
            $stored = ObservatorioPublicacion::findOrFail($id);
            $this->assertSame($department->id, $stored->departamento_id);
            $this->assertSame($path, $stored->archivo_pdf);
            $this->assertSame('Descripción actualizada', $stored->descripcion);
            $this->assertSame('Fuente actualizada', $stored->fuente);
            Storage::disk('local')->assertExists($path);
            $this->getJson("/api/departamentos/{$department->id}/publicaciones")
                ->assertOk()->assertJsonFragment(['id' => $id, 'titulo' => "Editado {$type}", 'solo_suscriptores' => true]);
            $this->get($original->json('data.download_url'))->assertOk()->assertHeader('Content-Type', 'application/pdf');
        }
        $this->assertDatabaseCount('observatorio_publicaciones', 3);
    }

    public function test_pdf_replacement_and_publishing_are_persisted_and_review_queue_is_updated(): void
    {
        Sanctum::actingAs(User::factory()->create(['rol' => 'ADMIN']));
        $department = Departamento::create(['nombre' => 'Salud de prueba', 'codigo_interno' => 'QA', 'publico' => true]);
        $created = $this->post("/api/departamentos/{$department->id}/publicaciones", [
            ...$this->payload(), 'tipo' => 'REPORTE', 'estado' => 'EN_REVISION',
            'archivo' => UploadedFile::fake()->create('original.pdf', 1, 'application/pdf'),
        ], ['Accept' => 'application/json'])->assertCreated();
        $id = $created->json('data.id');
        $oldPath = ObservatorioPublicacion::findOrFail($id)->archivo_pdf;
        $this->post("/api/departamentos/publicaciones/{$id}", [
            ...$this->payload(), '_method' => 'PATCH', 'estado' => 'PUBLICACION',
            'archivo' => UploadedFile::fake()->create('nuevo.pdf', 1, 'application/pdf'),
        ], ['Accept' => 'application/json'])->assertOk()
            ->assertJsonPath('data.estado', 'PUBLICACION')->assertJsonPath('data.nombre_archivo_original', 'nuevo.pdf');
        $stored = ObservatorioPublicacion::findOrFail($id);
        $this->assertNotSame($oldPath, $stored->archivo_pdf);
        Storage::disk('local')->assertExists($stored->archivo_pdf);
        Storage::disk('local')->assertMissing($oldPath);
        $this->getJson("/api/departamentos/{$department->id}/publicaciones?estado=EN_REVISION")->assertOk()->assertJsonMissing(['id' => $id]);
        $this->get($created->json('data.download_url'))->assertOk()->assertHeader('Content-Type', 'application/pdf');
    }

    public function test_invalid_updates_leave_metadata_and_original_pdf_unchanged(): void
    {
        Sanctum::actingAs(User::factory()->create(['rol' => 'ADMIN']));
        $department = Departamento::create(['nombre' => 'Salud de prueba', 'codigo_interno' => 'QA', 'publico' => true]);
        $created = $this->post("/api/departamentos/{$department->id}/publicaciones", [
            ...$this->payload(), 'tipo' => 'REPORTE', 'archivo' => UploadedFile::fake()->create('original.pdf', 1, 'application/pdf'),
        ], ['Accept' => 'application/json'])->assertCreated();
        $id = $created->json('data.id'); $path = ObservatorioPublicacion::findOrFail($id)->archivo_pdf;
        $this->post("/api/departamentos/publicaciones/{$id}", [
            ...$this->payload(), '_method' => 'PATCH', 'link_url' => 'javascript:alert(1)',
            'archivo' => UploadedFile::fake()->create('datos.csv', 1, 'text/csv'),
        ], ['Accept' => 'application/json'])->assertUnprocessable()->assertJsonValidationErrors(['link_url', 'archivo']);
        $stored = ObservatorioPublicacion::findOrFail($id);
        $this->assertSame('Publicación original', $stored->titulo); $this->assertSame($path, $stored->archivo_pdf);
        Storage::disk('local')->assertExists($path); $this->assertCount(1, Storage::disk('local')->allFiles());
    }

    private function payload(): array
    {
        return ['titulo' => 'Publicación original', 'fecha_publicacion' => '2026-10-20', 'estado' => 'EN_REVISION',
            'solo_suscriptores' => '0', 'link_url' => 'https://app.powerbi.com/view?r=qa'];
    }
}
