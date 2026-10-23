<?php

namespace Tests\Feature;

use App\Models\Departamento;
use App\Models\ObservatorioPublicacion;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class WorkspacePublicationCreationTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        config(['filesystems.default' => 'local']);
        Storage::fake('local');
    }

    public function test_articles_books_and_reports_are_persisted_and_can_be_read_in_the_selected_observatory(): void
    {
        $admin = User::factory()->create(['rol' => 'ADMIN']);
        Sanctum::actingAs($admin);
        $department = $this->department();
        $other = Departamento::create(['nombre' => 'Otro observatorio', 'codigo_interno' => 'OTRO', 'publico' => true]);
        foreach (['ARTICULO' => 'ART-', 'LIBRO' => 'LIB-', 'REPORTE' => 'REP-'] as $type => $prefix) {
            $payload = $this->payload($type);
            $payload['autores'] = [' Ana ', '', 'Luis'];
            $payload['solo_suscriptores'] = '1';
            $response = $this->post("/api/departamentos/{$department->id}/publicaciones", $payload, ['Accept' => 'application/json'])
                ->assertCreated()->assertJsonPath('data.tipo', $type)
                ->assertJsonPath('data.departamento_id', $department->id)
                ->assertJsonPath('data.autores', ['Ana', 'Luis'])
                ->assertJsonPath('data.solo_suscriptores', true);
            $id = $response->json('data.id');
            $stored = ObservatorioPublicacion::findOrFail($id);
            $this->assertStringStartsWith($prefix, $stored->codigo);
            $this->assertSame($admin->id, $stored->creado_por);
            $this->assertSame('2026-10-20', $stored->fecha_publicacion->format('Y-m-d'));
            $this->getJson("/api/departamentos/{$department->id}/publicaciones?tipo={$type}")
                ->assertOk()->assertJsonFragment(['id' => $id, 'titulo' => $payload['titulo']]);
            $this->getJson("/api/departamentos/{$other->id}/publicaciones")->assertOk()->assertJsonMissing(['id' => $id]);
            if ($type === 'REPORTE') {
                $this->assertNull($stored->archivo_pdf);
                $this->assertSame($payload['link_url'], $stored->link_url);
            } else {
                Storage::disk('local')->assertExists($stored->archivo_pdf);
                $this->get($response->json('data.download_url'))->assertOk()->assertHeader('Content-Type', 'application/pdf');
            }
        }
        $this->assertDatabaseCount('observatorio_publicaciones', 3);
        $this->assertSame(0, ObservatorioPublicacion::where('tipo', 'ATLAS')->count());
    }

    public function test_missing_pdf_and_report_url_are_rejected_without_consuming_a_code(): void
    {
        Sanctum::actingAs(User::factory()->create(['rol' => 'ADMIN']));
        $department = $this->department();
        foreach (['ARTICULO', 'LIBRO', 'REPORTE'] as $type) {
            $next = DB::table('publicacion_contadores')->where('tipo', $type)->value('siguiente_numero');
            $payload = $this->payload($type);
            unset($payload['archivo'], $payload['link_url']);
            $this->postJson("/api/departamentos/{$department->id}/publicaciones", $payload)
                ->assertUnprocessable()->assertJsonValidationErrors($type === 'REPORTE' ? 'link_url' : 'archivo');
            $this->assertSame($next, DB::table('publicacion_contadores')->where('tipo', $type)->value('siguiente_numero'));
        }
        $this->assertDatabaseCount('observatorio_publicaciones', 0);
        $this->assertSame([], Storage::disk('local')->allFiles());
    }

    public function test_invalid_file_size_url_and_metadata_are_rejected(): void
    {
        Sanctum::actingAs(User::factory()->create(['rol' => 'ADMIN']));
        $department = $this->department();
        $endpoint = "/api/departamentos/{$department->id}/publicaciones";
        foreach ([UploadedFile::fake()->create('datos.csv', 1, 'text/csv'), UploadedFile::fake()->create('grande.pdf', 20481, 'application/pdf')] as $file) {
            $payload = $this->payload('LIBRO');
            $payload['archivo'] = $file;
            $this->post($endpoint, $payload, ['Accept' => 'application/json'])->assertUnprocessable()->assertJsonValidationErrors('archivo');
        }
        $this->postJson($endpoint, [...$this->payload('REPORTE'), 'link_url' => 'javascript:alert(1)', 'titulo' => str_repeat('x', 256), 'descripcion' => str_repeat('x', 3001), 'autores' => [str_repeat('x', 256)]])
            ->assertUnprocessable()->assertJsonValidationErrors(['titulo', 'link_url', 'descripcion', 'autores.0']);
        $this->assertDatabaseCount('observatorio_publicaciones', 0);
    }

    public function test_reports_can_also_include_an_optional_pdf(): void
    {
        Sanctum::actingAs(User::factory()->create(['rol' => 'ADMIN']));
        $department = $this->department();
        $response = $this->post("/api/departamentos/{$department->id}/publicaciones", [...$this->payload('REPORTE'), 'estado' => 'EN_REVISION', 'archivo' => UploadedFile::fake()->create('reporte.pdf', 1, 'application/pdf')], ['Accept' => 'application/json'])
            ->assertCreated()->assertJsonPath('data.estado', 'EN_REVISION');
        Storage::disk('local')->assertExists(ObservatorioPublicacion::findOrFail($response->json('data.id'))->archivo_pdf);
    }

    public function test_anonymous_and_regular_users_cannot_create_content(): void
    {
        $department = $this->department();
        $endpoint = "/api/departamentos/{$department->id}/publicaciones";
        $this->postJson($endpoint, $this->payload('REPORTE'))->assertUnauthorized();
        Sanctum::actingAs(User::factory()->create(['rol' => 'USER']));
        $this->postJson($endpoint, $this->payload('REPORTE'))->assertForbidden();
        $this->assertDatabaseCount('observatorio_publicaciones', 0);
    }

    private function department(): Departamento
    {
        return Departamento::create(['nombre' => 'Observatorio de prueba', 'codigo_interno' => 'PRUEBA', 'publico' => true]);
    }

    private function payload(string $type): array
    {
        return ['tipo' => $type, 'titulo' => "Prueba {$type}", 'fecha_publicacion' => '2026-10-20', 'estado' => 'PUBLICACION', 'solo_suscriptores' => '0',
            ...($type === 'REPORTE' ? ['link_url' => 'https://app.powerbi.com/view?r=prueba'] : ['archivo' => UploadedFile::fake()->create(strtolower($type).'.pdf', 1, 'application/pdf')])];
    }
}
