<?php

namespace Tests\Feature;

use App\Models\Departamento;
use App\Models\ObservatorioPublicacion;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class AdminWorkspaceTest extends TestCase
{
    use RefreshDatabase;

    public function test_public_configuration_uses_the_existing_link_until_saved(): void
    {
        $this->getJson('/api/publico/configuracion')->assertOk()
            ->assertJsonPath('visor_geografico_url', config('portal.visor_geografico_url'));
        $this->getJson('/api/admin/inicio')->assertUnauthorized();
        $this->putJson('/api/admin/configuracion', ['visor_geografico_url' => 'https://example.test/map'])->assertUnauthorized();
    }

    public function test_only_an_administrator_can_persist_the_viewer_link(): void
    {
        $admin = User::factory()->create(['rol' => 'ADMIN']);
        // The SQLite test schema retains the original role CHECK; Sanctum can
        // authenticate an editor model without inserting it into that schema.
        $users = [User::factory()->create(['rol' => 'USER']), User::factory()->make(['rol' => 'EDITOR'])];
        foreach ($users as $user) {
            Sanctum::actingAs($user);
            $this->putJson('/api/admin/configuracion', ['visor_geografico_url' => 'https://example.test/map'])->assertForbidden();
            $this->getJson('/api/admin/publicaciones')->assertForbidden();
        }
        Sanctum::actingAs($admin);
        $this->putJson('/api/admin/configuracion', ['visor_geografico_url' => 'https://example.test/map'])
            ->assertOk()->assertJsonPath('visor_geografico_url', 'https://example.test/map');
        $this->assertDatabaseHas('site_settings', ['key' => 'visor_geografico_url', 'value' => 'https://example.test/map']);
        $this->getJson('/api/publico/configuracion')->assertOk()->assertJsonPath('visor_geografico_url', 'https://example.test/map');
    }

    public function test_unsafe_and_empty_viewer_links_do_not_replace_the_saved_value(): void
    {
        Sanctum::actingAs(User::factory()->create(['rol' => 'ADMIN']));
        foreach (['javascript:alert(1)', 'data:text/html,test', '/mapa', '', str_repeat('x', 2050)] as $url) {
            $this->putJson('/api/admin/configuracion', ['visor_geografico_url' => $url])
                ->assertUnprocessable()->assertJsonValidationErrors('visor_geografico_url');
        }
        $this->assertDatabaseCount('site_settings', 0);
    }

    public function test_summary_and_paginated_publications_use_real_rows_and_exclude_deleted_observatories(): void
    {
        $admin = User::factory()->create(['rol' => 'ADMIN']);
        Sanctum::actingAs($admin);
        $department = Departamento::create(['nombre' => 'Salud', 'codigo_interno' => 'SAL', 'publico' => true]);
        for ($i = 1; $i <= 25; $i++) {
            ObservatorioPublicacion::create(['departamento_id' => $department->id, 'tipo' => 'ARTICULO',
                'estado' => $i <= 2 ? 'EN_REVISION' : 'PUBLICACION', 'codigo' => 'ART-'.$i,
                'titulo' => 'Publicación '.$i, 'fecha_publicacion' => '2026-10-20', 'creado_por' => $admin->id,
                'link_url' => 'https://example.test/article', 'fuente' => 'Prueba', 'archivo_pdf' => 'test.pdf', 'nombre_archivo_original' => 'test.pdf']);
        }
        $this->getJson('/api/admin/inicio')->assertOk()->assertJsonPath('publicaciones_total', 25)
            ->assertJsonPath('pendientes_total', 2)->assertJsonCount(2, 'pendientes');
        $this->getJson('/api/admin/publicaciones')->assertOk()->assertJsonCount(20, 'data')->assertJsonPath('meta.total', 25)->assertJsonPath('meta.per_page', 20);
        $this->getJson('/api/admin/publicaciones?page=2')->assertOk()->assertJsonCount(5, 'data');
        $this->getJson('/api/admin/publicaciones?estado=EN_REVISION')->assertOk()->assertJsonCount(2, 'data');
        $department->delete();
        $this->getJson('/api/admin/inicio')->assertOk()->assertJsonPath('publicaciones_total', 0);
    }

    public function test_all_publication_types_appear_together_and_type_filters_preserve_other_filters(): void
    {
        $admin = User::factory()->create(['rol' => 'ADMIN']);
        Sanctum::actingAs($admin);
        $department = Departamento::create(['nombre' => 'Salud', 'codigo_interno' => 'SAL', 'publico' => true]);
        foreach (['ARTICULO', 'REPORTE', 'LIBRO'] as $type) {
            // Older SQLite migrations retain the original type CHECK without LIBRO.
            // Insert the book via the same in-memory schema adjustment used by publication tests.
            if ($type === 'LIBRO') {
                \Illuminate\Support\Facades\Schema::table('observatorio_publicaciones', function (\Illuminate\Database\Schema\Blueprint $table) {
                    $table->string('tipo', 20)->change();
                });
            }
            ObservatorioPublicacion::create(['departamento_id' => $department->id, 'tipo' => $type,
                'estado' => 'PUBLICACION', 'codigo' => $type.'-QA', 'titulo' => 'Publicación '.$type,
                'fecha_publicacion' => '2026-10-20', 'creado_por' => $admin->id,
                'link_url' => 'https://example.test/publication', 'fuente' => 'Prueba', 'archivo_pdf' => 'test.pdf', 'nombre_archivo_original' => 'test.pdf']);
        }
        $all = $this->getJson('/api/admin/publicaciones')->assertOk()->assertJsonCount(3, 'data');
        $this->assertEqualsCanonicalizing(['ARTICULO', 'REPORTE', 'LIBRO'], array_column($all->json('data'), 'tipo'));
        foreach (['ARTICULO', 'REPORTE', 'LIBRO'] as $type) {
            $this->getJson('/api/admin/publicaciones?'.http_build_query(['tipo' => $type, 'departamento_id' => $department->id, 'estado' => 'PUBLICACION']))
                ->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.tipo', $type);
        }
    }
}
