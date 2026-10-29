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
            'fecha_publicacion' => '2026-10-20', 'fuente' => 'ULEAM', 'descripcion' => 'Consulta territorial'], $extra);
    }

    private function create(AtlasCategoria $category, array $extra = []): string
    {
        return $this->postJson("/api/atlas/categorias/{$category->id}/enlaces", $this->payload($extra))
            ->assertCreated()->assertJsonPath('data.tipo', 'ATLAS')->assertJsonPath('data.departamento_id', null)->json('data.id');
    }

    public function test_creation_persists_a_link_without_pdf_or_portal_selection(): void
    {
        $category = $this->category();
        $id = $this->create($category);
        $this->assertNull($category->fresh()->publicacion_destacada_id);
        $row = ObservatorioPublicacion::findOrFail($id);
        $this->assertSame('https://example.test/atlas', $row->link_url);
        $this->assertNull($row->archivo_pdf);
        $this->getJson('/api/departamentos/publicaciones/atlas-global')->assertOk()->assertJsonFragment(['id' => $id]);
        $this->getJson('/api/atlas/categorias')->assertOk()->assertJsonFragment(['id' => $category->id]);
        $this->getJson('/api/publico/atlas')->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.link_url', $row->link_url);
    }

    public function test_all_published_links_are_public_regardless_of_legacy_selection(): void
    {
        $category = $this->category();
        $first = $this->create($category);
        $second = $this->create($category, ['titulo' => 'Segundo', 'mostrar_en_portal' => false]);
        AtlasCategoria::whereKey($category->id)->update(['publicacion_destacada_id' => $first]);
        $this->getJson('/api/publico/atlas')->assertOk()->assertJsonCount(2, 'data')->assertJsonFragment(['id' => $first])->assertJsonFragment(['id' => $second]);
        $this->assertDatabaseCount('observatorio_publicaciones', 2);
        $this->assertSame($first, $category->fresh()->publicacion_destacada_id);
    }

    public function test_category_filter_and_visibility_remain_enforced(): void
    {
        $first = $this->category(); $private = $this->category(false);
        $id = $this->create($private);
        $this->getJson("/api/publico/atlas?categoria_id={$first->id}")->assertOk()->assertJsonCount(0, 'data');
        $this->getJson('/api/publico/atlas')->assertOk()->assertJsonCount(0, 'data');
        $private->update(['publico' => true]);
        $this->getJson('/api/publico/atlas')->assertOk()->assertJsonCount(1, 'data');
    }

    public function test_public_library_excludes_drafts_archived_suspended_and_private_categories_and_keeps_restricted_urls_hidden(): void
    {
        $category = $this->category();
        $first = $this->create($category);
        $second = $this->create($category, ['titulo' => 'Atlas adicional']);
        foreach (['EN_REVISION', 'ARCHIVADO', 'SUSPENDIDO'] as $state) {
            $id = $this->create($category, ['titulo' => $state]);
            ObservatorioPublicacion::whereKey($id)->update(['estado' => $state]);
        }
        $restricted = $this->create($category);
        ObservatorioPublicacion::whereKey($restricted)->update(['solo_suscriptores' => true]);
        $this->create($this->category(false));
        // A persisted selection from an earlier release must not hide sibling files.
        AtlasCategoria::whereKey($category->id)->update(['publicacion_destacada_id' => $first]);
        $this->app['auth']->forgetGuards();
        $this->getJson('/api/publico/atlas')->assertOk()->assertJsonCount(3, 'data')
            ->assertJsonFragment(['id' => $first])->assertJsonFragment(['id' => $second]);
        $rows = $this->getJson('/api/publico/atlas')->assertOk()->json('data');
        $locked = collect($rows)->firstWhere('id', $restricted);
        $this->assertTrue($locked['bloqueado']);
        $this->assertNull($locked['link_url']);
        $this->assertNull($locked['download_url']);
        $category->update(['publico' => false]);
        $this->getJson('/api/publico/atlas')->assertOk()->assertJsonCount(0, 'data');
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
        $this->assertNull($target->fresh()->publicacion_destacada_id);
        $this->getJson("/api/publico/atlas?categoria_id={$target->id}")->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $id);
        $this->assertSame('atlas/original.pdf', ObservatorioPublicacion::find($id)->archivo_pdf);
        Storage::disk('local')->assertExists('atlas/original.pdf');
    }

    public function test_deleting_one_link_keeps_the_other_published_links_visible(): void
    {
        $category = $this->category();
        $id = $this->create($category);
        $second = $this->create($category, ['mostrar_en_portal' => false]);
        $this->patchJson("/api/atlas/enlaces/{$id}", $this->payload(['atlas_categoria_id' => $category->id, 'mostrar_en_portal' => false]))->assertOk();
        $this->getJson('/api/publico/atlas')->assertOk()->assertJsonCount(2, 'data');
        $this->deleteJson("/api/departamentos/publicaciones/{$id}")->assertOk();
        $this->assertNull($category->fresh()->publicacion_destacada_id);
        $this->getJson('/api/publico/atlas')->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $second);
    }

    public function test_permissions_and_deleted_category_are_enforced(): void
    {
        $category = $this->category(); $id = $this->create($category);
        Sanctum::actingAs((new User())->forceFill(['id' => auth()->id(), 'rol' => 'EDITOR', 'is_active' => true]));
        $this->postJson("/api/atlas/categorias/{$category->id}/enlaces", $this->payload())->assertForbidden();
        $this->patchJson("/api/atlas/enlaces/{$id}", $this->payload(['atlas_categoria_id' => $category->id]))->assertForbidden();
        Sanctum::actingAs(User::factory()->create(['rol' => 'ADMIN']));
        $empty = $this->category(); $empty->delete();
        $this->postJson("/api/atlas/categorias/{$empty->id}/enlaces", $this->payload())->assertNotFound();
    }
}
