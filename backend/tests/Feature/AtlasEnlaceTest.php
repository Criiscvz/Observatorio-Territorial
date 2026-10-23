<?php

namespace Tests\Feature;

use App\Models\AtlasCategoria;
use App\Models\ObservatorioPublicacion;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Schema;
use Illuminate\Database\Schema\Blueprint;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class AtlasEnlaceTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->assertSame('sqlite', config('database.default'));
        $this->assertSame(':memory:', config('database.connections.sqlite.database'));
        // Older migrations only apply these nullable changes to PostgreSQL.
        Schema::table('observatorio_publicaciones', function (Blueprint $table) {
            $table->uuid('departamento_id')->nullable()->change();
            $table->string('archivo_pdf')->nullable()->change();
            $table->string('nombre_archivo_original')->nullable()->change();
        });
        Storage::fake('local');
        config(['filesystems.default' => 'local']);
        Sanctum::actingAs(User::factory()->create(['rol' => 'ADMIN']));
    }

    private function category(bool $public = true): AtlasCategoria
    {
        return AtlasCategoria::create(['nombre' => 'Categoría '.fake()->uuid(), 'publico' => $public]);
    }

    private function payload(array $extra = []): array
    {
        return array_merge(['titulo' => 'Atlas territorial', 'link_url' => 'https://example.test/atlas',
            'fecha_publicacion' => '2026-10-20', 'fuente' => 'ULEAM', 'descripcion' => 'Consulta territorial', 'mostrar_en_portal' => true], $extra);
    }

    private function create(AtlasCategoria $category, array $extra = []): string
    {
        return $this->postJson("/api/atlas/categorias/{$category->id}/enlaces", $this->payload($extra))
            ->assertCreated()->assertJsonPath('data.tipo', 'ATLAS')->assertJsonPath('data.departamento_id', null)->json('data.id');
    }

    public function test_creation_persists_a_link_without_pdf_and_selection_survives_readback(): void
    {
        $category = $this->category();
        $id = $this->create($category);
        $this->assertSame($id, $category->fresh()->publicacion_destacada_id);
        $row = ObservatorioPublicacion::findOrFail($id);
        $this->assertSame('https://example.test/atlas', $row->link_url);
        $this->assertNull($row->archivo_pdf);
        $this->getJson('/api/departamentos/publicaciones/atlas-global')->assertOk()->assertJsonFragment(['id' => $id]);
        $this->getJson('/api/atlas/categorias')->assertOk()->assertJsonFragment(['publicacion_destacada_id' => $id]);
        $this->getJson('/api/publico/atlas')->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.link_url', $row->link_url);
    }

    public function test_only_selected_link_is_public_and_previous_records_are_preserved(): void
    {
        $category = $this->category();
        $first = $this->create($category);
        $second = $this->create($category, ['titulo' => 'Segundo', 'mostrar_en_portal' => false]);
        $this->getJson('/api/publico/atlas')->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $first);
        $this->putJson("/api/atlas/categorias/{$category->id}/seleccion", ['publicacion_id' => $second])->assertOk();
        $this->getJson('/api/publico/atlas')->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $second);
        $this->assertDatabaseCount('observatorio_publicaciones', 2);
        $this->assertSame($second, $category->fresh()->publicacion_destacada_id);
    }

    public function test_selection_cannot_cross_categories_or_expose_private_categories(): void
    {
        $first = $this->category(); $private = $this->category(false);
        $id = $this->create($private);
        $this->putJson("/api/atlas/categorias/{$first->id}/seleccion", ['publicacion_id' => $id])->assertNotFound();
        $this->getJson('/api/publico/atlas')->assertOk()->assertJsonCount(0, 'data');
        $private->update(['publico' => true]);
        $this->getJson('/api/publico/atlas')->assertOk()->assertJsonCount(1, 'data');
    }

    public function test_validation_rejects_unsafe_urls_blank_title_and_invalid_dates_without_creating_rows(): void
    {
        $category = $this->category();
        foreach (['javascript:alert(1)', 'ftp://example.test/file', 'not-a-link'] as $url) {
            $this->postJson("/api/atlas/categorias/{$category->id}/enlaces", $this->payload(['link_url' => $url]))->assertUnprocessable()->assertJsonValidationErrors('link_url');
        }
        $this->postJson("/api/atlas/categorias/{$category->id}/enlaces", $this->payload(['titulo' => ' ', 'fecha_publicacion' => '2026-02-31']))->assertUnprocessable()->assertJsonValidationErrors(['titulo', 'fecha_publicacion']);
        $this->assertDatabaseCount('observatorio_publicaciones', 0);
    }

    public function test_editing_legacy_pdf_keeps_file_and_reassigning_clears_old_selection(): void
    {
        $category = $this->category(); $target = $this->category();
        $id = $this->create($category);
        Storage::disk('local')->put('atlas/original.pdf', '%PDF-test');
        ObservatorioPublicacion::whereKey($id)->update(['archivo_pdf' => 'atlas/original.pdf']);
        $this->patchJson("/api/atlas/enlaces/{$id}", $this->payload(['atlas_categoria_id' => $target->id, 'titulo' => 'Editado']))->assertOk();
        $this->assertNull($category->fresh()->publicacion_destacada_id);
        $this->assertSame($id, $target->fresh()->publicacion_destacada_id);
        $this->assertSame('atlas/original.pdf', ObservatorioPublicacion::find($id)->archivo_pdf);
        Storage::disk('local')->assertExists('atlas/original.pdf');
    }

    public function test_unselecting_or_deleting_the_selected_link_does_not_publish_other_links(): void
    {
        $category = $this->category();
        $id = $this->create($category);
        $this->create($category, ['mostrar_en_portal' => false]);
        $this->patchJson("/api/atlas/enlaces/{$id}", $this->payload(['atlas_categoria_id' => $category->id, 'mostrar_en_portal' => false]))->assertOk();
        $this->getJson('/api/publico/atlas')->assertOk()->assertJsonCount(0, 'data');
        $this->putJson("/api/atlas/categorias/{$category->id}/seleccion", ['publicacion_id' => $id])->assertOk();
        $this->deleteJson("/api/departamentos/publicaciones/{$id}")->assertOk();
        $this->assertNull($category->fresh()->publicacion_destacada_id);
        $this->getJson('/api/publico/atlas')->assertOk()->assertJsonCount(0, 'data');
    }

    public function test_permissions_and_deleted_category_are_enforced(): void
    {
        $category = $this->category(); $id = $this->create($category);
        Sanctum::actingAs((new User())->forceFill(['id' => auth()->id(), 'rol' => 'EDITOR', 'is_active' => true]));
        $this->postJson("/api/atlas/categorias/{$category->id}/enlaces", $this->payload())->assertForbidden();
        $this->patchJson("/api/atlas/enlaces/{$id}", $this->payload(['atlas_categoria_id' => $category->id]))->assertForbidden();
        $this->putJson("/api/atlas/categorias/{$category->id}/seleccion", ['publicacion_id' => $id])->assertForbidden();
        Sanctum::actingAs(User::factory()->create(['rol' => 'ADMIN']));
        $empty = $this->category(); $empty->delete();
        $this->postJson("/api/atlas/categorias/{$empty->id}/enlaces", $this->payload())->assertNotFound();
    }
}
