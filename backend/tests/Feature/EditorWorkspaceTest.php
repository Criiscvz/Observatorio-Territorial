<?php

namespace Tests\Feature;

use App\Models\Departamento;
use App\Models\ObservatorioPublicacion;
use App\Models\User;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class EditorWorkspaceTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('local');
        config(['filesystems.default' => 'local']);
        Schema::table('observatorio_publicaciones', fn (Blueprint $table) => $table->string('tipo', 20)->change());
    }

    private function editor(): User
    {
        // The legacy SQLite role CHECK predates EDITOR. Authenticate its persisted
        // user ID with the editor role in memory, without changing the test schema.
        $user = User::factory()->create(['rol' => 'USER']);
        $user->rol = 'EDITOR';
        return $user;
    }

    private function department(string $code): Departamento
    {
        return Departamento::create(['nombre' => $code, 'codigo_interno' => $code, 'publico' => true]);
    }

    private function publication(User $user, Departamento $department, string $code, string $type = 'ARTICULO'): ObservatorioPublicacion
    {
        return ObservatorioPublicacion::create(['departamento_id' => $department->id, 'creado_por' => $user->id,
            'codigo' => $code, 'titulo' => $code, 'tipo' => $type, 'estado' => 'EN_REVISION',
            'fecha_publicacion' => '2026-10-21', 'archivo_pdf' => 'existing.pdf', 'link_url' => 'https://example.test/report']);
    }

    public function test_summary_and_pages_include_only_own_content_in_assigned_observatories(): void
    {
        $editor = $this->editor();
        $other = User::factory()->create();
        $assigned = $this->department('Asignado');
        $foreign = $this->department('Ajeno');
        $assigned->usuarios()->attach($editor->id, ['id' => (string) \Illuminate\Support\Str::uuid(), 'rol' => 'EDITOR']);
        for ($i = 1; $i <= 25; $i++) {
            $this->publication($editor, $assigned, 'MIO-'.$i, ['ARTICULO', 'LIBRO', 'REPORTE'][$i % 3]);
        }
        $this->publication($other, $assigned, 'DE-OTRO');
        $this->publication($editor, $foreign, 'SIN-ASIGNACION');
        $this->publication($editor, $assigned, 'ATLAS-EXCLUIDO', 'ATLAS');
        Sanctum::actingAs($editor);

        $this->getJson('/api/editor/inicio')->assertOk()->assertJsonPath('observatorios_total', 1)
            ->assertJsonPath('publicaciones_total', 25)->assertJsonPath('pendientes_total', 25)
            ->assertJsonCount(5, 'pendientes')->assertJsonCount(1, 'observatorios');
        $this->getJson('/api/editor/publicaciones')->assertOk()->assertJsonCount(20, 'data')
            ->assertJsonPath('meta.total', 25)->assertJsonPath('meta.per_page', 20)
            ->assertJsonMissing(['titulo' => 'DE-OTRO'])->assertJsonMissing(['titulo' => 'ATLAS-EXCLUIDO']);
        $this->getJson('/api/editor/publicaciones?page=2')->assertOk()->assertJsonCount(5, 'data');
        $this->getJson('/api/editor/publicaciones?departamento_id='.$foreign->id)->assertOk()->assertJsonCount(0, 'data');
        foreach (['ARTICULO', 'LIBRO', 'REPORTE'] as $type) {
            $result = $this->getJson('/api/editor/publicaciones?tipo='.$type.'&estado=EN_REVISION')->assertOk();
            $this->assertNotEmpty($result->json('data'));
            $this->assertSame([$type], array_values(array_unique(array_column($result->json('data'), 'tipo'))));
        }
        $this->getJson('/api/departamentos')->assertOk()->assertJsonCount(1)->assertJsonPath('0.id', $assigned->id);
        $this->getJson('/api/departamentos/'.$foreign->id)->assertForbidden();
        $assigned->usuarios()->detach($editor->id);
        $this->getJson('/api/editor/inicio')->assertOk()->assertJsonPath('observatorios_total', 0)->assertJsonPath('publicaciones_total', 0);
    }

    public function test_editor_creates_all_three_types_only_in_assigned_observatories_and_always_in_review(): void
    {
        $editor = $this->editor();
        $assigned = $this->department('Asignado');
        $foreign = $this->department('Ajeno');
        $assigned->usuarios()->attach($editor->id, ['id' => (string) \Illuminate\Support\Str::uuid(), 'rol' => 'EDITOR']);
        Sanctum::actingAs($editor);
        foreach (['ARTICULO', 'LIBRO', 'REPORTE'] as $type) {
            $data = ['tipo' => $type, 'titulo' => 'Nuevo '.$type, 'fecha_publicacion' => '2026-10-21',
                'estado' => 'PUBLICACION', 'solo_suscriptores' => '1',
                ...($type === 'REPORTE' ? ['link_url' => 'https://app.powerbi.com/view?r=test']
                    : ['archivo' => UploadedFile::fake()->create('test.pdf', 1, 'application/pdf')])];
            $this->post('/api/departamentos/'.$assigned->id.'/publicaciones', $data, ['Accept' => 'application/json'])
                ->assertCreated()->assertJsonPath('data.estado', 'EN_REVISION')->assertJsonPath('data.creado_por', $editor->id)
                ->assertJsonPath('data.solo_suscriptores', false);
            $this->post('/api/departamentos/'.$foreign->id.'/publicaciones', $data, ['Accept' => 'application/json'])->assertForbidden();
        }
        $this->assertDatabaseCount('observatorio_publicaciones', 3);
    }

    public function test_editor_cannot_manage_atlas_barometer_configuration_or_another_authors_content(): void
    {
        $editor = $this->editor();
        $assigned = $this->department('Asignado');
        $assigned->usuarios()->attach($editor->id, ['id' => (string) \Illuminate\Support\Str::uuid(), 'rol' => 'EDITOR']);
        $other = $this->publication(User::factory()->create(), $assigned, 'OTRO');
        $atlas = $this->publication($editor, $assigned, 'ATLAS', 'ATLAS');
        Sanctum::actingAs($editor);
        foreach (['/api/admin/inicio', '/api/admin/publicaciones', '/api/admin/configuracion', '/api/atlas/categorias', '/api/datasets'] as $endpoint) {
            $this->getJson($endpoint)->assertForbidden();
        }
        $this->postJson('/api/departamentos/'.$assigned->id.'/publicaciones', ['tipo' => 'ATLAS'])->assertForbidden();
        $this->patchJson('/api/departamentos/publicaciones/'.$atlas->id, [])->assertForbidden();
        $this->deleteJson('/api/departamentos/publicaciones/'.$atlas->id)->assertForbidden();
        $payload = ['titulo' => 'Intento', 'fecha_publicacion' => '2026-10-21', 'estado' => 'PUBLICACION'];
        $this->patchJson('/api/departamentos/publicaciones/'.$other->id, $payload)->assertForbidden();
        $this->assertDatabaseHas('observatorio_publicaciones', ['id' => $other->id, 'titulo' => 'OTRO']);
    }

    public function test_workspace_requires_editor_authentication(): void
    {
        $this->getJson('/api/editor/inicio')->assertUnauthorized();
        foreach (['USER', 'ADMIN'] as $role) {
            Sanctum::actingAs(User::factory()->create(['rol' => $role]));
            $this->getJson('/api/editor/inicio')->assertForbidden();
            $this->getJson('/api/editor/publicaciones')->assertForbidden();
        }
    }
}
