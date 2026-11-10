<?php

namespace Tests\Feature;

use App\Application\Permiso\UseCases\ManageObservatoryAccess;
use App\Models\Departamento;
use App\Models\User;
use App\Policies\ObservatoryAccessPolicy;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ObservatoryAccessCapabilitiesTest extends TestCase
{
    use RefreshDatabase;

    private function user(string $role = 'USER'): User
    {
        return User::withoutEvents(fn () => User::factory()->create(['rol' => $role, 'is_active' => true]));
    }
    private function department(): Departamento
    {
        return Departamento::create(['nombre' => 'Ensayo alcance', 'codigo_interno' => (string) Str::uuid(), 'publico' => false]);
    }
    private function assign(User $user, Departamento $department, bool $editors = false): void
    {
        $user->departamentos()->attach($department->id, ['id' => (string) Str::uuid(),
            'rol' => $user->isObservatoryAdmin() ? 'ADMIN' : 'EDITOR', 'puede_revisar' => false, 'puede_agregar_editores' => $editors]);
    }
    private function input(?Departamento $department = null, array $extra = []): array
    {
        return ['permisos' => [['modulo' => 'observatorios', 'nivel' => $department ? 'escritura' : 'ninguno',
            'departamento_id' => $department?->id, ...$extra]]];
    }

    public function test_supervisor_context_lists_only_manageable_or_read_only_visible_scopes_and_current_capabilities(): void
    {
        $manager = $this->user('ADMIN_OBSERVATORIO'); $editor = $this->user('EDITOR');
        $read = $this->department(); $write = $this->department(); $foreign = $this->department();
        $this->assign($manager, $read); $this->assign($manager, $write, true);
        $this->assign($editor, $read); $this->assign($editor, $foreign);
        Sanctum::actingAs($manager);
        $this->getJson('/api/accesos/contexto')->assertOk()->assertJsonPath('capabilities.can_assign_editors', true);
        $this->getJson('/api/accesos/usuarios/'.$editor->id)->assertOk()
            ->assertJsonPath('capabilities.can_view_access', true)->assertJsonPath('capabilities.can_manage_access', false)
            ->assertJsonCount(2, 'observatorios')->assertJsonCount(1, 'permisos')->assertJsonMissing(['id' => $foreign->id]);
        $this->assign($editor, $write);
        $this->getJson('/api/accesos/usuarios/'.$editor->id)->assertOk()
            ->assertJsonPath('capabilities.can_manage_access', true)->assertJsonPath('capabilities.can_revoke_access', true)
            ->assertJsonCount(1, 'observatorios')->assertJsonPath('observatorios.0.id', $write->id)
            ->assertJsonCount(1, 'permisos')->assertJsonPath('permisos.0.departamento_id', $write->id);
        $listed = $this->getJson('/api/observatorio-admin/users?purpose=permissions')->assertOk();
        $listed->assertJsonPath('data.0.access_capabilities.can_manage_access', true)
            ->assertJsonPath('meta.access_capabilities.can_assign_editors', true);
    }

    public function test_promotion_and_scope_clear_preserve_foreign_observatories_and_other_modules(): void
    {
        $manager = $this->user('ADMIN_OBSERVATORIO'); $normal = $this->user(); $own = $this->department(); $other = $this->department();
        $this->assign($manager, $own, true); Sanctum::actingAs($manager);
        $this->getJson('/api/accesos/usuarios/'.$normal->id)->assertOk()->assertJsonPath('capabilities.can_assign_editors', true);
        $endpoint = '/api/observatorio-admin/users/'.$normal->id.'/permisos';
        $this->putJson($endpoint, $this->input($own))->assertOk()->assertJsonPath('user.rol', 'EDITOR');
        $this->assign($normal, $other);
        DB::table('permisos')->insert(['id' => (string) Str::uuid(), 'user_id' => $normal->id, 'modulo' => 'reportes',
            'nivel' => 'lectura', 'departamento_id' => null, 'created_at' => now(), 'updated_at' => now()]);
        $this->putJson($endpoint, $this->input())->assertOk()->assertJsonPath('user.access_capabilities.can_manage_access', false);
        $this->assertDatabaseHas('usuario_departamento', ['user_id' => $normal->id, 'departamento_id' => $other->id]);
        $this->assertDatabaseMissing('usuario_departamento', ['user_id' => $normal->id, 'departamento_id' => $own->id]);
        $this->assertDatabaseHas('permisos', ['user_id' => $normal->id, 'modulo' => 'reportes', 'nivel' => 'lectura']);
        $this->assertSame('EDITOR', $normal->fresh()->rol);
    }

    public function test_forged_scope_role_module_or_supervisor_flags_do_not_change_any_assignment(): void
    {
        $manager = $this->user('ADMIN_OBSERVATORIO'); $normal = $this->user(); $own = $this->department(); $foreign = $this->department();
        $this->assign($manager, $own, true); Sanctum::actingAs($manager);
        $endpoint = '/api/observatorio-admin/users/'.$normal->id.'/permisos';
        foreach ([$this->input($foreign), $this->input($own, ['puede_revisar' => true]),
            $this->input($own, ['puede_agregar_editores' => true]), $this->input($own, ['nivel' => 'admin']),
            $this->input($own, ['modulo' => 'atlas'])] as $input) {
            $this->putJson($endpoint, [...$input, 'rol' => 'ADMIN', 'access_capabilities' => ['can_manage_access' => true]])->assertForbidden();
            $this->assertSame('USER', $normal->fresh()->rol);
            $this->assertDatabaseMissing('usuario_departamento', ['user_id' => $normal->id]);
        }
        foreach (['ADMIN', 'SUBSCRIBER', 'ADMIN_OBSERVATORIO'] as $role) {
            $target = $this->user($role);
            $this->getJson('/api/accesos/usuarios/'.$target->id)->assertForbidden();
            $this->putJson('/api/observatorio-admin/users/'.$target->id.'/permisos', $this->input($own))->assertForbidden();
        }
    }

    public function test_revoked_permissions_and_roles_override_stale_context_and_preloaded_relations(): void
    {
        $manager = $this->user('ADMIN_OBSERVATORIO'); $normal = $this->user(); $own = $this->department();
        $this->assign($manager, $own, true); $manager->load('departamentos'); Sanctum::actingAs($manager);
        $this->getJson('/api/accesos/usuarios/'.$normal->id)->assertOk()->assertJsonPath('capabilities.can_manage_access', true);
        $manager->departamentos()->updateExistingPivot($own->id, ['puede_agregar_editores' => false]);
        $this->assertFalse(app(ObservatoryAccessPolicy::class)->assignAccess($manager, $normal));
        $this->getJson('/api/accesos/contexto')->assertOk()->assertJsonPath('capabilities.can_assign_editors', false);
        $this->putJson('/api/observatorio-admin/users/'.$normal->id.'/permisos', $this->input($own))->assertForbidden();
        $this->assertSame('USER', $normal->fresh()->rol);
        // The application boundary reloads the actor under lock; even a stale in-memory ADMIN is insufficient.
        $admin = $this->user('ADMIN'); DB::table('users')->where('id', $admin->id)->update(['rol' => 'USER']);
        try { app(ManageObservatoryAccess::class)->save($admin->id, $normal->id, $this->input($own)['permisos'], false); $this->fail('Stale role accepted.'); }
        catch (\Symfony\Component\HttpKernel\Exception\HttpExceptionInterface $e) { $this->assertSame(403, $e->getStatusCode()); }
    }

    public function test_inactive_targets_deleted_scopes_and_invalid_global_save_leave_everything_unchanged(): void
    {
        $manager = $this->user('ADMIN_OBSERVATORIO'); $normal = $this->user(); $own = $this->department();
        $this->assign($manager, $own, true); $normal->update(['is_active' => false]); Sanctum::actingAs($manager);
        $this->getJson('/api/accesos/usuarios/'.$normal->id)->assertOk()->assertJsonPath('capabilities.can_manage_access', false);
        $this->putJson('/api/observatorio-admin/users/'.$normal->id.'/permisos', $this->input($own))->assertUnprocessable();
        $editor = $this->user('EDITOR'); $this->assign($editor, $own); $own->delete();
        $this->getJson('/api/accesos/contexto')->assertOk()->assertJsonPath('capabilities.can_assign_editors', false);
        Sanctum::actingAs($this->user('ADMIN'));
        $this->putJson('/api/permisos/users/'.$editor->id.'/permisos', $this->input($own))->assertUnprocessable();
        $this->assertDatabaseHas('usuario_departamento', ['user_id' => $editor->id, 'departamento_id' => $own->id]);
        $this->assertSame('USER', $normal->fresh()->rol);
    }

    public function test_administrator_manages_supervisor_independent_flags_and_other_roles_cannot_access_context(): void
    {
        $admin = $this->user('ADMIN'); $manager = $this->user('ADMIN_OBSERVATORIO'); $own = $this->department(); Sanctum::actingAs($admin);
        $this->getJson('/api/accesos/usuarios/'.$manager->id)->assertOk()->assertJsonPath('capabilities.can_manage_access', true);
        $this->putJson('/api/permisos/users/'.$manager->id.'/permisos', $this->input($own, ['puede_revisar' => false, 'puede_agregar_editores' => true]))
            ->assertOk()->assertJsonPath('user.access_capabilities.can_manage_access', true);
        $this->assertDatabaseHas('usuario_departamento', ['user_id' => $manager->id, 'departamento_id' => $own->id,
            'puede_revisar' => false, 'puede_agregar_editores' => true]);
        foreach (['USER', 'EDITOR', 'SUBSCRIBER'] as $role) {
            Sanctum::actingAs($this->user($role));
            $this->getJson('/api/accesos/contexto')->assertForbidden();
            $this->getJson('/api/accesos/usuarios/'.$manager->id)->assertForbidden();
        }
    }

    public function test_failed_permission_persistence_rolls_back_delegated_role_promotion_and_assignments(): void
    {
        $manager = $this->user('ADMIN_OBSERVATORIO'); $normal = $this->user(); $own = $this->department();
        $this->assign($manager, $own, true); Sanctum::actingAs($manager);
        \App\Infrastructure\Persistence\Eloquent\Models\PermisoModel::creating(fn () => throw new \RuntimeException('Synthetic assignment failure'));
        $this->putJson('/api/observatorio-admin/users/'.$normal->id.'/permisos', $this->input($own))->assertStatus(500);
        $this->assertSame('USER', $normal->fresh()->rol);
        $this->assertDatabaseMissing('usuario_departamento', ['user_id' => $normal->id]);
        $this->assertDatabaseMissing('permisos', ['user_id' => $normal->id]);
    }
}
