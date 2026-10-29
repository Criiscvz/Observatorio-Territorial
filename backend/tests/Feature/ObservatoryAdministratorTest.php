<?php

namespace Tests\Feature;

use App\Models\Departamento;
use App\Models\ObservatorioPublicacion;
use App\Models\User;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ObservatoryAdministratorTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('local');
        config(['filesystems.default' => 'local']);
        Schema::table('observatorio_publicaciones', fn (Blueprint $table) => $table->string('tipo', 20)->change());
    }

    private function user(string $role = 'USER'): User
    {
        return User::withoutEvents(fn () => User::factory()->create(['rol' => $role]));
    }

    private function department(string $code): Departamento
    {
        return Departamento::create(['nombre' => $code, 'codigo_interno' => $code, 'publico' => true]);
    }

    private function assign(User $user, Departamento $department, bool $review = true, bool $editors = true): void
    {
        $user->departamentos()->attach($department->id, ['id' => (string) Str::uuid(),
            'rol' => $user->isObservatoryAdmin() ? 'ADMIN' : 'EDITOR',
            'puede_revisar' => $review, 'puede_agregar_editores' => $editors]);
    }

    private function publication(User $user, Departamento $department, string $code, string $type = 'REPORTE'): ObservatorioPublicacion
    {
        return ObservatorioPublicacion::create(['departamento_id' => $department->id, 'creado_por' => $user->id,
            'codigo' => $code, 'titulo' => $code, 'tipo' => $type, 'estado' => 'EN_REVISION',
            'fecha_publicacion' => '2026-10-27', 'link_url' => 'https://app.powerbi.com/view?r=test',
            'archivo_pdf' => 'existing.pdf', 'solo_suscriptores' => true]);
    }

    private function payload(string $state = 'PUBLICACION'): array
    {
        return ['titulo' => 'Revisado', 'fecha_publicacion' => '2026-10-27', 'estado' => $state,
            ... (in_array($state, ['SUSPENDIDO', 'ARCHIVADO', 'RECHAZADO'], true) ? ['observacion_revision' => 'Motivo de la revisión.'] : []),
            'solo_suscriptores' => true, 'link_url' => 'https://app.powerbi.com/view?r=test'];
    }

    private function permissions(Departamento $department, array $extra = []): array
    {
        return ['permisos' => [['modulo' => 'observatorios', 'nivel' => 'escritura',
            'departamento_id' => $department->id, ...$extra]]];
    }

    public function test_global_admin_assigns_new_role_and_independent_flags_and_serializes_them(): void
    {
        $global = $this->user('ADMIN');
        $target = $this->user();
        $first = $this->department('Uno');
        $second = $this->department('Dos');
        Sanctum::actingAs($global);
        $this->patchJson('/api/users/'.$target->id.'/role', ['rol' => 'ADMIN_OBSERVATORIO'])->assertOk();
        $this->putJson('/api/permisos/users/'.$target->id.'/permisos', ['permisos' => [
            $this->permissions($first, ['puede_revisar' => true, 'puede_agregar_editores' => false])['permisos'][0],
            $this->permissions($second, ['puede_revisar' => false, 'puede_agregar_editores' => true])['permisos'][0],
        ]])->assertOk()->assertJsonPath('user.rol', 'ADMIN_OBSERVATORIO');
        $this->assertDatabaseHas('usuario_departamento', ['user_id' => $target->id, 'departamento_id' => $first->id,
            'puede_revisar' => 1, 'puede_agregar_editores' => 0, 'rol' => 'ADMIN']);
        $data = $this->getJson('/api/permisos/users/'.$target->id.'/permisos')->assertOk()->json();
        $this->assertTrue(collect($data)->firstWhere('departamento_id', $first->id)['puede_revisar']);
        Sanctum::actingAs($target->fresh());
        $this->getJson('/api/user')->assertOk()->assertJsonPath('rol', 'ADMIN_OBSERVATORIO')
            ->assertJsonCount(2, 'departamentos');
    }

    public function test_workspace_includes_all_authors_and_three_types_but_only_assigned_scopes_and_paginates_twenty(): void
    {
        $manager = $this->user('ADMIN_OBSERVATORIO');
        $editor = $this->user('EDITOR');
        $mine = $this->department('Asignado');
        $foreign = $this->department('Ajeno');
        $this->assign($manager, $mine);
        for ($i = 1; $i <= 25; $i++) $this->publication($editor, $mine, 'PUB-'.$i, ['ARTICULO', 'LIBRO', 'REPORTE'][$i % 3]);
        $this->publication($editor, $foreign, 'AJENO');
        $this->publication($editor, $mine, 'ATLAS', 'ATLAS');
        $this->assertSame([$mine->id], $manager->observatoryIds());
        $this->assertDatabaseHas('usuario_departamento', ['user_id' => $manager->id, 'departamento_id' => $mine->id, 'puede_revisar' => 1]);
        $this->assertSame([$mine->id], $manager->observatoryIds('puede_revisar'));
        Sanctum::actingAs($manager);
        $this->getJson('/api/observatorio-admin/inicio')->assertOk()->assertJsonPath('observatorios_total', 1)
            ->assertJsonPath('publicaciones_total', 25)->assertJsonPath('pendientes_total', 25)->assertJsonCount(5, 'pendientes');
        $this->getJson('/api/observatorio-admin/publicaciones')->assertOk()->assertJsonCount(20, 'data')->assertJsonPath('meta.total', 25);
        $this->getJson('/api/observatorio-admin/publicaciones?page=2')->assertOk()->assertJsonCount(5, 'data');
        $this->getJson('/api/departamentos')->assertOk()->assertJsonCount(1)->assertJsonPath('0.id', $mine->id);
        $this->getJson('/api/departamentos/'.$foreign->id)->assertForbidden();
        $this->getJson('/api/departamentos/'.$foreign->id.'/publicaciones')->assertForbidden();
        $this->getJson('/api/departamentos/'.$mine->id.'/publicaciones')->assertOk()->assertJsonCount(25, 'data')
            ->assertJsonMissing(['codigo' => 'ATLAS'])->assertJsonPath('data.0.bloqueado', false);
    }

    public function test_review_permission_controls_others_content_all_states_and_revocation_is_immediate(): void
    {
        $manager = $this->user('ADMIN_OBSERVATORIO');
        $editor = $this->user('EDITOR');
        $mine = $this->department('Asignado');
        $foreign = $this->department('Ajeno');
        $this->assign($manager, $mine);
        $publication = $this->publication($editor, $mine, 'MIO');
        $other = $this->publication($editor, $foreign, 'AJENO');
        $atlas = $this->publication($editor, $mine, 'ATLAS', 'ATLAS');
        Storage::put('existing.pdf', '%PDF-1.4 test');
        Sanctum::actingAs($manager);
        foreach (['PUBLICACION', 'SUSPENDIDO', 'ARCHIVADO', 'EN_REVISION'] as $state) {
            $this->patchJson('/api/departamentos/publicaciones/'.$publication->id, $this->payload($state))
                ->assertOk()->assertJsonPath('data.estado', $state)->assertJsonPath('data.solo_suscriptores', true);
        }
        $this->get('/api/departamentos/publicaciones/'.$publication->id.'/download?context=management', ['Accept' => 'application/json'])->assertOk();
        $this->patchJson('/api/departamentos/publicaciones/'.$other->id, $this->payload())->assertForbidden();
        $this->get('/api/departamentos/publicaciones/'.$other->id.'/download?context=management', ['Accept' => 'application/json'])->assertForbidden();
        $this->patchJson('/api/departamentos/publicaciones/'.$atlas->id, $this->payload())->assertForbidden();
        $this->deleteJson('/api/departamentos/publicaciones/'.$atlas->id)->assertForbidden();
        $this->postJson('/api/departamentos/'.$mine->id.'/publicaciones', ['tipo' => 'REPORTE', ...$this->payload()])->assertCreated();
        $this->postJson('/api/departamentos/'.$foreign->id.'/publicaciones', ['tipo' => 'REPORTE', ...$this->payload()])->assertForbidden();
        DB::table('usuario_departamento')->where('user_id', $manager->id)->update(['puede_revisar' => false]);
        $this->patchJson('/api/departamentos/publicaciones/'.$publication->id, $this->payload())->assertForbidden();
        $this->deleteJson('/api/departamentos/publicaciones/'.$publication->id)->assertForbidden();
        $this->postJson('/api/departamentos/'.$mine->id.'/publicaciones', ['tipo' => 'REPORTE', ...$this->payload()])->assertForbidden();
        $this->getJson('/api/observatorio-admin/inicio')->assertOk()->assertJsonPath('pendientes_total', 0);
        $this->getJson('/api/departamentos/'.$mine->id.'/publicaciones/can-upload')->assertOk()->assertJsonPath('can_upload', false);
    }

    public function test_can_only_add_editors_with_explicit_scope_and_preserves_other_assignments(): void
    {
        $manager = $this->user('ADMIN_OBSERVATORIO');
        $normal = $this->user();
        $existing = $this->user('EDITOR');
        $global = $this->user('ADMIN');
        $mine = $this->department('Asignado');
        $foreign = $this->department('Ajeno');
        $this->assign($manager, $mine, false, true);
        $this->assign($existing, $mine, false, false);
        $this->assign($existing, $foreign, false, false);
        Sanctum::actingAs($manager);
        $endpoint = '/api/observatorio-admin/users/'.$normal->id.'/permisos';
        $this->putJson($endpoint, $this->permissions($foreign))->assertForbidden();
        $this->putJson($endpoint, $this->permissions($mine, ['puede_revisar' => true]))->assertForbidden();
        $this->putJson($endpoint, ['permisos' => [['modulo' => 'observatorios', 'nivel' => 'admin', 'departamento_id' => $mine->id]]])->assertForbidden();
        $this->assertDatabaseHas('users', ['id' => $normal->id, 'rol' => 'USER']);
        $this->putJson($endpoint, $this->permissions($mine))->assertOk()->assertJsonPath('user.rol', 'EDITOR');
        $this->assertDatabaseHas('usuario_departamento', ['user_id' => $normal->id, 'departamento_id' => $mine->id, 'rol' => 'EDITOR', 'puede_revisar' => 0]);
        $clear = ['permisos' => [['modulo' => 'observatorios', 'nivel' => 'ninguno', 'departamento_id' => null]]];
        $this->putJson('/api/observatorio-admin/users/'.$existing->id.'/permisos', $clear)->assertOk();
        $this->assertDatabaseHas('usuario_departamento', ['user_id' => $existing->id, 'departamento_id' => $foreign->id]);
        $this->assertDatabaseMissing('usuario_departamento', ['user_id' => $existing->id, 'departamento_id' => $mine->id]);
        $this->putJson('/api/observatorio-admin/users/'.$global->id.'/permisos', $this->permissions($mine))->assertForbidden();
        $this->putJson('/api/observatorio-admin/users/'.$manager->id.'/permisos', $this->permissions($mine))->assertForbidden();
        DB::table('usuario_departamento')->where('user_id', $manager->id)->update(['puede_agregar_editores' => false]);
        $this->putJson($endpoint, $this->permissions($mine))->assertForbidden();
    }

    public function test_users_listing_and_global_management_are_restricted(): void
    {
        $manager = $this->user('ADMIN_OBSERVATORIO');
        $normal = $this->user();
        $subscriber = $this->user('SUBSCRIBER');
        $editor = $this->user('EDITOR');
        $foreignEditor = $this->user('EDITOR');
        $mine = $this->department('Asignado');
        $this->assign($manager, $mine);
        $this->assign($editor, $mine, false, false);
        Sanctum::actingAs($manager);
        $this->getJson('/api/observatorio-admin/users')->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $normal->id);
        $this->getJson('/api/observatorio-admin/users?purpose=permissions')->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $editor->id);
        foreach (['/api/admin/inicio', '/api/admin/configuracion', '/api/users', '/api/atlas/categorias', '/api/datasets',
            '/api/permisos/users/'.$manager->id.'/permisos', '/api/observatorio-admin/users/'.$foreignEditor->id.'/permisos'] as $path) {
            $this->getJson($path)->assertForbidden();
        }
        $this->patchJson('/api/users/'.$normal->id.'/role', ['rol' => 'ADMIN'])->assertForbidden();
        $this->deleteJson('/api/users/'.$normal->id)->assertForbidden();
        $this->putJson('/api/departamentos/'.$mine->id, ['nombre' => 'No autorizado'])->assertForbidden();
    }

    public function test_supervisor_sees_editors_in_all_assigned_observatories_but_can_only_modify_enabled_scopes(): void
    {
        $manager = $this->user('ADMIN_OBSERVATORIO');
        $editor = $this->user('EDITOR');
        $foreignEditor = $this->user('EDITOR');
        $readOnly = $this->department('Solo consulta');
        $editable = $this->department('Puede asignar');
        $foreign = $this->department('Fuera de alcance');
        $this->assign($manager, $readOnly, true, false);
        $this->assign($manager, $editable, false, true);
        $this->assign($editor, $readOnly, false, false);
        $this->assign($editor, $foreign, false, false);
        $this->assign($foreignEditor, $foreign, false, false);
        Sanctum::actingAs($manager);
        $endpoint = '/api/observatorio-admin/users/'.$editor->id.'/permisos';
        $this->getJson('/api/observatorio-admin/users?purpose=permissions')->assertOk()
            ->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $editor->id)
            ->assertJsonCount(1, 'data.0.departamentos')->assertJsonPath('data.0.departamentos.0.id', $readOnly->id);
        $this->getJson($endpoint)->assertOk()->assertJsonCount(1)->assertJsonPath('0.departamento_id', $readOnly->id);
        $this->putJson($endpoint, $this->permissions($readOnly))->assertForbidden();
        $this->putJson($endpoint, $this->permissions($editable))->assertForbidden();
        $this->getJson('/api/observatorio-admin/users/'.$foreignEditor->id.'/permisos')->assertForbidden();
        $this->assign($editor, $editable, false, false);
        $clear = ['permisos' => [['modulo' => 'observatorios', 'nivel' => 'ninguno', 'departamento_id' => null]]];
        $this->putJson($endpoint, $clear)->assertOk()->assertJsonCount(1, 'permisos')
            ->assertJsonPath('permisos.0.departamento_id', $readOnly->id);
        $this->assertDatabaseHas('usuario_departamento', ['user_id' => $editor->id, 'departamento_id' => $readOnly->id]);
        $this->assertDatabaseHas('usuario_departamento', ['user_id' => $editor->id, 'departamento_id' => $foreign->id]);
        $this->assertDatabaseMissing('usuario_departamento', ['user_id' => $editor->id, 'departamento_id' => $editable->id]);
        DB::table('usuario_departamento')->where('user_id', $manager->id)->delete();
        $this->getJson('/api/observatorio-admin/users?purpose=permissions')->assertOk()->assertJsonCount(0, 'data');
        $this->getJson($endpoint)->assertForbidden();
    }

    public function test_supervisor_promotion_persists_editor_role_and_assignment_and_respects_account_status(): void
    {
        $manager = $this->user('ADMIN_OBSERVATORIO');
        $normal = $this->user();
        $normal->update(['name' => 'Nuevo Editor']);
        $inactive = $this->user();
        $inactive->update(['is_active' => false]);
        $mine = $this->department('Equipo');
        $this->assign($manager, $mine, false, true);
        Sanctum::actingAs($manager);
        $this->getJson('/api/observatorio-admin/users?search=NUEVO&per_page=1')->assertOk()
            ->assertJsonPath('meta.total', 1)->assertJsonPath('data.0.id', $normal->id);
        $endpoint = '/api/observatorio-admin/users/'.$normal->id.'/permisos';
        $this->putJson($endpoint, $this->permissions($mine))->assertOk()->assertJsonPath('user.rol', 'EDITOR');
        $this->getJson('/api/observatorio-admin/users?purpose=permissions')->assertOk()
            ->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $normal->id);
        $this->getJson('/api/observatorio-admin/users?search=NUEVO')->assertOk()->assertJsonCount(0, 'data');
        $this->putJson('/api/observatorio-admin/users/'.$inactive->id.'/permisos', $this->permissions($mine))->assertUnprocessable();
        $this->assertDatabaseHas('users', ['id' => $inactive->id, 'rol' => 'USER']);
        $this->assertDatabaseMissing('usuario_departamento', ['user_id' => $inactive->id]);
    }

    public function test_changing_role_clears_old_delegations_and_invalid_permission_saves_are_atomic(): void
    {
        $global = $this->user('ADMIN');
        $manager = $this->user('ADMIN_OBSERVATORIO');
        $editor = $this->user('EDITOR');
        $mine = $this->department('Asignado');
        $this->assign($manager, $mine);
        Sanctum::actingAs($global);
        $this->putJson('/api/permisos/users/'.$manager->id.'/permisos', ['permisos' => [
            ['modulo' => 'observatorios', 'nivel' => 'escritura', 'departamento_id' => $mine->id, 'puede_revisar' => true],
            ['modulo' => 'observatorios', 'nivel' => 'escritura', 'departamento_id' => null],
        ]])->assertUnprocessable();
        $this->assertDatabaseHas('usuario_departamento', ['user_id' => $manager->id, 'departamento_id' => $mine->id, 'puede_revisar' => 1]);
        $this->putJson('/api/permisos/users/'.$editor->id.'/permisos', $this->permissions($mine, ['puede_agregar_editores' => true]))->assertUnprocessable();
        $this->patchJson('/api/users/'.$manager->id.'/role', ['rol' => 'USER'])->assertOk();
        $this->assertDatabaseMissing('usuario_departamento', ['user_id' => $manager->id]);
    }
}
