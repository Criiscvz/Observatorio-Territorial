<?php

namespace Tests\Feature;

use App\Models\{AtlasCategoria, Departamento, ObservatorioPublicacion, User};
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\{Auth, DB, Schema};
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class PublicationLibraryPaginationTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        if (DB::getDriverName() === 'sqlite') {
            Schema::table('observatorio_publicaciones', fn (Blueprint $t) => $t->uuid('departamento_id')->nullable()->change());
        }
    }
    private function user(string $role): User { return User::withoutEvents(fn () => User::factory()->create(['rol' => $role, 'is_active' => true])); }
    private function department(): Departamento { return Departamento::create(['nombre' => 'Salud', 'codigo_interno' => (string) Str::uuid(), 'publico' => true]); }
    private function publication(User $owner, ?Departamento $d, array $extra = []): ObservatorioPublicacion
    {
        return ObservatorioPublicacion::create([...['tipo' => 'ARTICULO', 'estado' => 'EN_REVISION', 'creado_por' => $owner->id,
            'departamento_id' => $d?->id, 'codigo' => 'TEST-'.Str::uuid(), 'titulo' => 'Atención médica', 'autores' => ['Ana Pérez'],
            'fecha_publicacion' => '2026-10-29', 'archivo_pdf' => 'test.pdf', 'nombre_archivo_original' => 'test.pdf', 'fuente' => 'ULEAM'], ...$extra]);
    }
    private function assign(User $user, Departamento $d, bool $review = true): void
    {
        $user->departamentos()->attach($d->id, ['id' => (string) Str::uuid(), 'rol' => $user->isEditor() ? 'EDITOR' : 'ADMIN', 'puede_revisar' => $review]);
    }
    private function url(Departamento $d): string { return '/api/departamentos/'.$d->id.'/biblioteca/publicaciones'; }

    public function test_management_paging_is_sql_stable_and_counts_include_all_authorized_types(): void
    {
        $admin = $this->user('ADMIN'); Sanctum::actingAs($admin); $d = $this->department();
        for ($i = 0; $i < 43; $i++) { $this->publication($admin, $d, ['created_at' => '2026-10-01 10:00:00']); }
        $this->publication($admin, $d, ['tipo' => 'LIBRO', 'estado' => 'RECHAZADO', 'observacion_revision' => 'Corregir fuente']);
        $this->publication($admin, $d, ['tipo' => 'ATLAS']);
        DB::enableQueryLog();
        $url = $this->url($d).'?tipo=ARTICULO';
        $first = $this->getJson($url)->assertOk()->assertJsonCount(20, 'data')->assertJsonPath('meta.total', 43)
            ->assertJsonPath('counts.LIBRO', 1)->assertJsonPath('review_total', 43)->json('data');
        $queries = array_column(DB::getQueryLog(), 'query');
        $this->assertTrue((bool) array_filter($queries, fn ($sql) => str_contains(strtolower($sql), 'limit 20')));
        $two = $this->getJson($url.'&page=2')->assertJsonCount(20, 'data')->json('data');
        $three = $this->getJson($url.'&page=3')->assertJsonCount(3, 'data')->json('data');
        $this->assertCount(43, array_unique(array_column([...$first, ...$two, ...$three], 'id')));
        $this->assertSame(array_column($first, 'id'), array_column($this->getJson($url)->json('data'), 'id'));
        $this->getJson($this->url($d).'/'.$three[0]['id'])->assertOk()->assertJsonPath('data.id', $three[0]['id']);
        $row = $first[0]; $this->assertArrayNotHasKey('email', $row['creador']);
        foreach (['archivo_pdf', 'sharepoint_file_id', 'sharepoint_error'] as $field) { $this->assertArrayNotHasKey($field, $row); }
    }

    public function test_editor_scope_is_applied_before_search_counts_and_single_item_lookup_and_revokes_immediately(): void
    {
        $editor = $this->user('EDITOR'); $other = $this->user('EDITOR'); $d = $this->department(); $this->assign($editor, $d);
        $own = $this->publication($editor, $d, ['estado' => 'RECHAZADO', 'observacion_revision' => 'Motivo visible']);
        $hidden = $this->publication($other, $d, ['estado' => 'PUBLICACION']);
        Sanctum::actingAs($editor);
        $this->getJson($this->url($d))->assertOk()->assertJsonPath('meta.total', 1)->assertJsonPath('counts.ARTICULO', 1)
            ->assertJsonPath('data.0.observacion_revision', 'Motivo visible');
        $this->getJson($this->url($d).'/'.$hidden->id)->assertNotFound();
        $this->getJson($this->url($d).'?q=Motivo')->assertJsonPath('meta.total', 1);
        $editor->departamentos()->detach();
        $this->getJson($this->url($d))->assertOk()->assertJsonPath('meta.total', 0)->assertJsonPath('counts.ARTICULO', 0);
        $this->getJson($this->url($d).'/'.$own->id)->assertNotFound();
    }

    public function test_supervisor_counts_follow_current_observatory_and_review_permission(): void
    {
        $manager = $this->user('ADMIN_OBSERVATORIO'); $d = $this->department(); $outside = $this->department(); $this->assign($manager, $d);
        $p = $this->publication($this->user('EDITOR'), $d); $this->publication($manager, $d, ['estado' => 'PUBLICACION']);
        Sanctum::actingAs($manager); $this->getJson($this->url($d))->assertJsonPath('meta.total', 2)->assertJsonPath('review_total', 1);
        $this->getJson($this->url($outside))->assertForbidden();
        DB::table('usuario_departamento')->where('user_id', $manager->id)->update(['puede_revisar' => false]);
        $this->getJson($this->url($d))->assertJsonPath('meta.total', 1)->assertJsonPath('review_total', 0);
        $this->getJson($this->url($d).'/'.$p->id)->assertNotFound();
    }

    public function test_literal_accent_search_state_and_input_validation_without_dropping_old_contract(): void
    {
        $admin = $this->user('ADMIN'); $d = $this->department(); $this->publication($admin, $d); Sanctum::actingAs($admin);
        foreach (['atencion', 'PEREZ', 'revision', 'uleam'] as $q) { $this->getJson($this->url($d).'?q='.$q)->assertJsonPath('meta.total', 1); }
        foreach (['%', '_', "' OR 1=1 --"] as $q) { $this->getJson($this->url($d).'?q='.rawurlencode($q))->assertJsonPath('meta.total', 0); }
        foreach (['per_page=100', 'page=0', 'tipo=ATLAS', 'estado=INVALID', 'q[]=bad'] as $q) { $this->getJson($this->url($d).'?'.$q)->assertUnprocessable(); }
        $this->getJson('/api/departamentos/'.$d->id.'/publicaciones')->assertOk()->assertJsonCount(1, 'data')->assertJsonMissingPath('meta');
        Sanctum::actingAs($this->user('USER')); $this->getJson($this->url($d))->assertForbidden();
    }

    public function test_atlas_public_and_admin_pages_and_summaries_do_not_include_private_or_deleted_content(): void
    {
        $admin = $this->user('ADMIN'); $c = AtlasCategoria::create(['nombre' => 'Educación', 'publico' => true]);
        $private = AtlasCategoria::create(['nombre' => 'Privada', 'publico' => false]);
        for ($i = 0; $i < 23; $i++) { $this->publication($admin, null, ['tipo' => 'ATLAS', 'atlas_categoria_id' => $c->id, 'estado' => 'PUBLICACION', 'link_url' => 'https://app.powerbi.com/view?r=fixture']); }
        $restricted = $this->publication($admin, null, ['tipo' => 'ATLAS', 'atlas_categoria_id' => $private->id, 'estado' => 'PUBLICACION']);
        $this->publication($admin, null, ['tipo' => 'ATLAS', 'atlas_categoria_id' => $c->id, 'estado' => 'EN_REVISION']);
        $url = '/api/publico/atlas/biblioteca?categoria_id='.$c->id;
        $first = $this->getJson($url)->assertOk()->assertJsonCount(20, 'data')->assertJsonPath('meta.total', 23)->json('data');
        $last = $this->getJson($url.'&page=2')->assertJsonCount(3, 'data')->json('data');
        $this->assertCount(23, array_unique(array_column([...$first, ...$last], 'id')));
        foreach (['creado_por', 'creador', 'sharepoint_error', 'sharepoint_file_id'] as $field) { $this->assertArrayNotHasKey($field, $first[0]); }
        $this->getJson('/api/publico/atlas/directorio?q=educacion')->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.publicaciones_total', 23);
        $this->getJson('/api/publico/atlas/biblioteca?categoria_id='.$private->id)->assertNotFound();
        Sanctum::actingAs($admin);
        $this->getJson('/api/departamentos/publicaciones/atlas-biblioteca?categoria_id='.$c->id)->assertOk()->assertJsonPath('meta.total', 24);
        $this->getJson('/api/atlas/categorias/directorio')->assertOk()->assertJsonCount(2, 'data');
        $c->delete(); Auth::forgetGuards();
        $this->getJson($url)->assertNotFound(); $this->getJson('/api/publico/atlas/directorio')->assertJsonCount(0, 'data');
    }

    public function test_atlas_locked_rows_and_invalid_filters_preserve_access_rules(): void
    {
        $c = AtlasCategoria::create(['nombre' => 'Salud', 'publico' => true]);
        $this->publication($this->user('ADMIN'), null, ['tipo' => 'ATLAS', 'estado' => 'PUBLICACION', 'atlas_categoria_id' => $c->id,
            'solo_suscriptores' => true, 'link_url' => 'https://app.powerbi.com/view?r=private', 'sharepoint_error' => 'internal']);
        $url = '/api/publico/atlas/biblioteca?categoria_id='.$c->id;
        $this->getJson($url)->assertOk()->assertJsonPath('data.0.bloqueado', true)->assertJsonPath('data.0.link_url', null)->assertJsonPath('data.0.download_url', null);
        Sanctum::actingAs($this->user('SUBSCRIBER'));$this->getJson($url)->assertJsonPath('data.0.bloqueado', false);
        foreach (['page=0', 'per_page=50', 'q[]=bad'] as $q) { $this->getJson($url.'&'.$q)->assertUnprocessable(); }
        $this->getJson('/api/publico/atlas/biblioteca')->assertUnprocessable();
        $this->getJson('/api/departamentos/publicaciones/atlas-biblioteca')->assertForbidden();
    }
}
