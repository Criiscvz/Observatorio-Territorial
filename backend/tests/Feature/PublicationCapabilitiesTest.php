<?php

namespace Tests\Feature;

use App\Models\Departamento;
use App\Models\ObservatorioPublicacion;
use App\Models\User;
use App\Policies\ObservatorioPublicacionPolicy;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class PublicationCapabilitiesTest extends TestCase
{
    use RefreshDatabase;

    private function user(string $role, ?Departamento $department = null, bool $review = true): User
    {
        $user = User::withoutEvents(fn () => User::factory()->create(['rol' => $role, 'is_active' => true]));
        if ($department) {
            $user->departamentos()->attach($department->id, ['id' => (string) Str::uuid(),
                'rol' => $role === 'EDITOR' ? 'EDITOR' : 'ADMIN', 'puede_revisar' => $review]);
        }
        return $user;
    }

    private function department(): Departamento
    {
        return Departamento::create(['nombre' => 'Ensayo permisos', 'codigo_interno' => (string) Str::uuid(), 'publico' => true]);
    }

    private function publication(User $owner, Departamento $department, string $type = 'ARTICULO', string $state = 'EN_REVISION'): ObservatorioPublicacion
    {
        return ObservatorioPublicacion::create(['departamento_id' => $department->id, 'creado_por' => $owner->id,
            'tipo' => $type, 'estado' => $state, 'codigo' => (string) Str::uuid(), 'titulo' => 'Ensayo permisos',
            'fecha_publicacion' => '2026-10-29', 'solo_suscriptores' => true,
            'link_url' => 'https://app.powerbi.com/view?r=fixture']);
    }

    public function test_policy_covers_all_editorial_types_states_roles_ownership_and_scope(): void
    {
        $department = $this->department();
        $owner = $this->user('EDITOR', $department);
        $actors = [
            [$owner, true, false], [$this->user('EDITOR', $department), false, false],
            [$this->user('ADMIN'), true, true], [$this->user('ADMIN_OBSERVATORIO', $department), true, true],
            [$this->user('ADMIN_OBSERVATORIO', $department, false), false, false],
            [$this->user('ADMIN_OBSERVATORIO', $this->department()), false, false],
            [$this->user('SUBSCRIBER'), false, false], [$this->user('USER'), false, false],
        ];
        foreach (['ARTICULO', 'REPORTE', 'LIBRO'] as $type) {
            foreach (ObservatorioPublicacion::ESTADOS as $state) {
                $publication = $this->publication($owner, $department, $type, $state);
                foreach ($actors as [$actor, $write, $review]) {
                    $allowed = $write && ! ($actor->isEditor() && $state === 'RECHAZADO');
                    $capabilities = app(ObservatorioPublicacionPolicy::class)->capabilities($actor, $publication);
                    $this->assertSame($allowed, $actor->can('update', $publication));
                    $this->assertSame($allowed, $actor->can('delete', $publication));
                    $this->assertSame($review, $actor->can('review', $publication));
                    $this->assertSame($allowed, $capabilities['can_edit']);
                    $this->assertSame($allowed, $capabilities['can_delete']);
                    $this->assertSame($review, $capabilities['can_review']);
                }
            }
        }
    }

    public function test_library_workspace_and_actual_http_writes_share_the_policy_and_rejected_editor_is_read_only(): void
    {
        $department = $this->department(); $owner = $this->user('EDITOR', $department);
        $publication = $this->publication($owner, $department, 'LIBRO', 'RECHAZADO');
        Sanctum::actingAs($owner);
        $caps = ['can_view' => true, 'can_edit' => false, 'can_delete' => false, 'can_review' => false];
        $this->getJson("/api/departamentos/{$department->id}/biblioteca/publicaciones?tipo=LIBRO")
            ->assertOk()->assertJsonPath('data.0.capabilities', $caps);
        $this->getJson('/api/editor/publicaciones')->assertOk()->assertJsonPath('data.0.capabilities', $caps);
        // Invalid payload still returns authorization failure, not a field-validation hint.
        $this->patchJson('/api/departamentos/publicaciones/'.$publication->id, ['capabilities' => ['can_edit' => true]])->assertForbidden();
        $this->deleteJson('/api/departamentos/publicaciones/'.$publication->id)->assertForbidden();
        $this->assertSame('RECHAZADO', $publication->fresh()->estado);

        Sanctum::actingAs($this->user('ADMIN_OBSERVATORIO', $department));
        $this->patchJson('/api/departamentos/publicaciones/'.$publication->id, ['titulo' => 'Revisado',
            'fecha_publicacion' => '2026-10-29', 'estado' => 'EN_REVISION'])->assertOk()
            ->assertJsonPath('data.capabilities.can_edit', true)->assertJsonPath('data.capabilities.can_review', true);
        Sanctum::actingAs($owner);
        $this->patchJson('/api/departamentos/publicaciones/'.$publication->id, ['titulo' => 'Corregido',
            'fecha_publicacion' => '2026-10-29'])->assertOk()->assertJsonPath('data.capabilities.can_review', false);
    }

    public function test_current_assignments_and_review_flag_override_preloaded_relations_and_old_capabilities(): void
    {
        $department = $this->department(); $owner = $this->user('EDITOR', $department);
        $publication = $this->publication($owner, $department);
        foreach ([$owner, $this->user('ADMIN_OBSERVATORIO', $department)] as $actor) {
            $actor->load('departamentos');
            $this->assertTrue($actor->can('update', $publication));
            if ($actor->isEditor()) { $actor->departamentos()->detach($department->id); }
            else { $actor->departamentos()->updateExistingPivot($department->id, ['puede_revisar' => false]); }
            $this->assertFalse($actor->can('update', $publication));
            $this->assertFalse($actor->canReadPublicationForManagement($publication));
            Sanctum::actingAs($actor);
            $this->patchJson('/api/departamentos/publicaciones/'.$publication->id, [])->assertForbidden();
            $this->deleteJson('/api/departamentos/publicaciones/'.$publication->id)->assertForbidden();
        }
    }

    public function test_inactive_accounts_deleted_parent_tombstones_and_subscriber_reading_do_not_grant_write_access(): void
    {
        $department = $this->department(); $editor = $this->user('EDITOR', $department);
        $publication = $this->publication($editor, $department, 'ARTICULO', 'PUBLICACION');
        $policy = app(ObservatorioPublicacionPolicy::class);
        $this->assertFalse($policy->view(null, $publication));
        $this->assertTrue($policy->view($this->user('SUBSCRIBER'), $publication));
        $this->assertFalse($policy->view($this->user('USER'), $publication));
        $admin = $this->user('ADMIN'); $admin->is_active = false;
        $this->assertSame(['can_view' => false, 'can_edit' => false, 'can_delete' => false, 'can_review' => false], $policy->capabilities($admin, $publication));
        $department->delete(); $publication->unsetRelation('departamento');
        $this->assertFalse($editor->can('update', $publication));
        $publication->forceFill(['eliminado_legado_at' => now()]);
        $this->assertFalse($this->user('ADMIN')->can('update', $publication));
    }

    public function test_atlas_management_remains_administrator_only_and_not_part_of_editorial_review(): void
    {
        $department = $this->department(); $editor = $this->user('EDITOR', $department);
        // Policy input, not a persisted Atlas conversion or a fixture in the real library.
        $atlas = new ObservatorioPublicacion(['tipo' => 'ATLAS', 'creado_por' => $editor->id,
            'departamento_id' => $department->id, 'estado' => 'EN_REVISION']);
        foreach (['ADMIN', 'ADMIN_OBSERVATORIO', 'EDITOR', 'SUBSCRIBER', 'USER'] as $role) {
            $actor = $role === 'EDITOR' ? $editor : $this->user($role, $department);
            $this->assertSame($role === 'ADMIN', $actor->can('update', $atlas));
            $this->assertSame($role === 'ADMIN', $actor->can('delete', $atlas));
            $this->assertFalse($actor->can('review', $atlas));
        }
    }
}
