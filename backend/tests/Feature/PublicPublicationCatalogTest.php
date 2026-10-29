<?php

namespace Tests\Feature;

use App\Infrastructure\Persistence\Eloquent\Models\ArticuloModel;
use App\Infrastructure\Persistence\Eloquent\Models\ReporteModel;
use App\Models\Departamento;
use App\Models\ObservatorioPublicacion;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class PublicPublicationCatalogTest extends TestCase
{
    use RefreshDatabase;

    private function department(bool $public = true): Departamento
    {
        return Departamento::create(['nombre' => 'Salud', 'codigo_interno' => uniqid('CAT-'), 'publico' => $public]);
    }

    private function publication(Departamento $d, array $extra = []): ObservatorioPublicacion
    {
        return ObservatorioPublicacion::create([...[
            'departamento_id' => $d->id, 'creado_por' => User::factory()->create()->id,
            'tipo' => 'ARTICULO', 'codigo' => uniqid('ART-'), 'titulo' => 'Investigación pública',
            'fecha_publicacion' => '2026-10-20', 'estado' => 'PUBLICACION', 'autores' => ['Ana Pérez'],
            'fuente' => 'ULEAM', 'archivo_pdf' => 'test.pdf', 'nombre_archivo_original' => 'test.pdf',
        ], ...$extra]);
    }

    public function test_mixed_sources_are_paginated_in_sql_and_ties_are_stable(): void
    {
        $d = $this->department();
        for ($i = 0; $i < 22; $i++) {
            $this->publication($d, ['titulo' => 'Artículo '.$i, 'created_at' => '2026-10-01 12:00:00']);
        }
        ArticuloModel::create(['departamento_id' => $d->id, 'titulo' => 'Artículo antiguo', 'estado' => 'PUBLICADO']);
        ReporteModel::create(['departamento_id' => $d->id, 'nombre_indicador' => 'Reporte antiguo']);
        $this->publication($d, ['tipo' => 'LIBRO']);
        DB::enableQueryLog();
        $url = '/api/publico/publicaciones?departamento_id='.$d->id;
        $first = $this->getJson($url)->assertOk()->assertJsonCount(20, 'data')->assertJsonPath('meta.total', 25)
            ->assertJsonPath('meta.per_page', 20)->assertJsonPath('counts.ARTICULO', 23)->assertJsonPath('counts.LIBRO', 1)->json('data');
        $sql = array_column(DB::getQueryLog(), 'query');
        $this->assertTrue((bool) array_filter($sql, fn ($q) => str_contains(strtolower($q), 'union all') && str_contains(strtolower($q), 'limit 20')));
        $second = $this->getJson($url.'&page=2')->assertOk()->assertJsonCount(5, 'data')->json('data');
        $keys = array_column([...$first, ...$second], 'resource_key');
        $this->assertCount(25, array_unique($keys));
        $this->assertSame(array_column($first, 'resource_key'), array_column($this->getJson($url)->json('data'), 'resource_key'));
        $this->getJson($url.'&tipo=LIBRO')->assertJsonCount(1, 'data')->assertJsonPath('meta.total', 1);
    }

    public function test_visibility_is_applied_before_totals_and_legacy_endpoints_do_not_leak_private_departments(): void
    {
        $public = $this->department(); $private = $this->department(false); $deleted = $this->department(); $deleted->delete();
        $this->publication($public);
        foreach ([$private, $deleted] as $d) {
            $this->publication($d);
            ArticuloModel::create(['departamento_id' => $d->id, 'titulo' => 'Oculto', 'estado' => 'PUBLICADO']);
            ReporteModel::create(['departamento_id' => $d->id, 'nombre_indicador' => 'Oculto']);
        }
        foreach (['EN_REVISION', 'SUSPENDIDO', 'ARCHIVADO', 'RECHAZADO'] as $state) {
            $this->publication($public, ['estado' => $state, 'observacion_revision' => 'Motivo interno']);
        }
        $this->getJson('/api/publico/publicaciones')->assertJsonPath('meta.total', 1)->assertJsonPath('counts.ARTICULO', 1);
        $this->getJson('/api/articulos')->assertJsonCount(1);
        $this->getJson('/api/reportes')->assertExactJson([]);
        $this->getJson('/api/publico/publicaciones?departamento_id='.$private->id)->assertNotFound();
    }

    public function test_explicit_contract_redacts_private_fields_and_editor_is_not_a_subscriber(): void
    {
        $d = $this->department();
        $p = $this->publication($d, ['solo_suscriptores' => true, 'link_url' => 'https://example.test/private',
            'sharepoint_url' => 'https://tenant.sharepoint.com/private.pdf', 'sharepoint_file_id' => 'private-id']);
        foreach ([null, 'EDITOR', 'ADMIN_OBSERVATORIO', 'SUBSCRIBER', 'ADMIN'] as $role) {
            \Illuminate\Support\Facades\Auth::forgetGuards();
            if ($role) { Sanctum::actingAs(User::factory()->create(['rol' => $role])); }
            $unlocked = in_array($role, ['ADMIN', 'SUBSCRIBER'], true);
            $row = $this->getJson('/api/publico/publicaciones')->assertOk()->assertJsonPath('data.0.bloqueado', ! $unlocked)->json('data.0');
            $this->assertSame($unlocked ? "/api/departamentos/publicaciones/{$p->id}/download" : null, $row['download_url']);
            foreach (['archivo_pdf', 'creado_por', 'creador', 'observacion_revision', 'sharepoint_file_id', 'sharepoint_error'] as $key) {
                $this->assertArrayNotHasKey($key, $row);
            }
        }
    }

    public function test_search_is_bound_literal_accent_insensitive_and_counts_keep_tab_totals(): void
    {
        $d = $this->department(); $p = $this->publication($d);
        $this->publication($d, ['titulo' => 'Otra', 'autores' => ['Luis'], 'fuente' => 'Ministerio']);
        foreach (['PEREZ', 'investigacion', $p->codigo] as $q) {
            $this->getJson('/api/publico/publicaciones?q='.rawurlencode($q))->assertJsonPath('meta.total', 1)
                ->assertJsonPath('counts.ARTICULO', 2)->assertJsonPath('data.0.id', $p->id);
        }
        foreach (['%', '_', "' OR 1=1 --"] as $q) {
            $this->getJson('/api/publico/publicaciones?q='.rawurlencode($q))->assertJsonPath('meta.total', 0);
        }
        foreach (['tipo=ATLAS', 'page=0', 'per_page=100', 'departamento_id=invalid', 'q[]=bad'] as $query) {
            $this->getJson('/api/publico/publicaciones?'.$query)->assertUnprocessable();
        }
    }

    public function test_inventory_reports_legacy_blockers_without_changing_any_record(): void
    {
        $article = ArticuloModel::create(['titulo' => 'Conservar íntegro', 'estado' => 'BORRADOR', 'visibilidad' => 'privado']);
        $before = $article->fresh()->getAttributes();
        $this->assertSame(0, \Illuminate\Support\Facades\Artisan::call('publications:inventory', ['--json' => true]));
        $result = json_decode(\Illuminate\Support\Facades\Artisan::output(), true, 512, JSON_THROW_ON_ERROR);
        $this->assertSame(1, $result['legacy_owner_decisions_required']);
        $this->assertFalse($result['automatic_migration_enabled']);
        $this->assertSame($before, $article->fresh()->getAttributes());
        $this->assertDatabaseCount('articulos', 1);
        $this->assertDatabaseCount('observatorio_publicaciones', 0);
    }

    public function test_category_filter_and_source_keys_preserve_colliding_ids_without_guessing_duplicates(): void
    {
        $d = $this->department();
        $category = \Illuminate\Support\Str::uuid()->toString();
        DB::table('categorias_dataset')->insert(['id' => $category, 'nombre' => 'Investigación', 'codigo' => 'investigacion']);
        $p = $this->publication($d);
        $legacy = ArticuloModel::create(['departamento_id' => $d->id, 'categoria_id' => $category, 'titulo' => 'Otro origen', 'estado' => 'PUBLICADO']);
        $legacy->update(['id' => $p->id]);
        $this->getJson('/api/publico/publicaciones?departamento_id='.$d->id)->assertJsonPath('meta.total', 2);
        $this->getJson('/api/publico/publicaciones?categoria_id='.$category)->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.origen', 'articulos')->assertJsonPath('data.0.categoria.nombre', 'Investigación');
        $this->getJson('/api/articulos?categoria_id='.$category)->assertJsonCount(1)->assertJsonPath('0.titulo', 'Otro origen');
        $this->getJson('/api/publico/estadisticas')->assertJsonPath('articulos', 2);
    }
}
