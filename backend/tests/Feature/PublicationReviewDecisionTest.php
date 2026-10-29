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
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class PublicationReviewDecisionTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        config(['filesystems.default' => 'local']);
        Storage::fake('local');
        Schema::table('observatorio_publicaciones', fn (Blueprint $table) => $table->string('tipo', 20)->change());
    }

    private function assigned(string $role, Departamento $department, bool $review = true): User
    {
        $user = User::withoutEvents(fn () => User::factory()->create(['rol' => $role]));
        $user->departamentos()->attach($department->id, ['id' => (string) Str::uuid(),
            'rol' => $role === 'EDITOR' ? 'EDITOR' : 'ADMIN', 'puede_revisar' => $review]);
        return $user;
    }

    private function department(string $code = 'QA'): Departamento
    {
        return Departamento::create(['nombre' => $code, 'codigo_interno' => $code, 'publico' => true]);
    }

    private function publication(User $owner, Departamento $department, string $type = 'ARTICULO'): ObservatorioPublicacion
    {
        $id = (string) Str::uuid();
        Storage::disk('local')->put($id.'.pdf', '%PDF-1.4 test');
        return ObservatorioPublicacion::create(['departamento_id' => $department->id, 'creado_por' => $owner->id,
            'tipo' => $type, 'estado' => 'EN_REVISION', 'codigo' => $id, 'titulo' => 'Enviado por el editor',
            'fecha_publicacion' => '2026-10-28', 'archivo_pdf' => $id.'.pdf', 'nombre_archivo_original' => 'original.pdf',
            'solo_suscriptores' => true, 'link_url' => 'https://app.powerbi.com/view?r=qa']);
    }

    private function payload(string $state, ?string $reason = 'Falta completar la metodología.'): array
    {
        return ['titulo' => 'Publicación revisada', 'fecha_publicacion' => '2026-10-28', 'estado' => $state,
            'solo_suscriptores' => true, 'link_url' => 'https://app.powerbi.com/view?r=qa', 'observacion_revision' => $reason];
    }

    public function test_admin_and_scoped_supervisor_record_reason_for_each_state_and_type_and_editor_can_read_it(): void
    {
        $department = $this->department();
        $editor = $this->assigned('EDITOR', $department);
        foreach (['ADMIN', 'ADMIN_OBSERVATORIO'] as $role) {
            $manager = $this->assigned($role, $department);
            foreach (['SUSPENDIDO', 'ARCHIVADO', 'RECHAZADO'] as $state) {
                foreach (['ARTICULO', 'LIBRO', 'REPORTE'] as $type) {
                    $publication = $this->publication($editor, $department, $type);
                    Sanctum::actingAs($manager);
                    $this->patchJson('/api/departamentos/publicaciones/'.$publication->id, $this->payload($state))
                        ->assertOk()->assertJsonPath('data.estado', $state)
                        ->assertJsonPath('data.observacion_revision', 'Falta completar la metodología.');
                    $this->assertNotNull($publication->fresh()->fecha_revision);
                    Sanctum::actingAs($editor);
                    $this->getJson('/api/departamentos/'.$department->id.'/publicaciones')
                        ->assertOk()->assertJsonFragment(['id' => $publication->id, 'estado' => $state,
                            'observacion_revision' => 'Falta completar la metodología.']);
                }
            }
        }
        $this->getJson('/api/editor/publicaciones?estado=RECHAZADO')->assertOk()->assertJsonPath('meta.total', 6)
            ->assertJsonPath('data.0.observacion_revision', 'Falta completar la metodología.');
    }

    public function test_reason_is_required_trimmed_and_limited_without_modifying_the_original_file_on_failure(): void
    {
        $department = $this->department();
        $admin = $this->assigned('ADMIN', $department);
        $publication = $this->publication($admin, $department);
        Sanctum::actingAs($admin);
        foreach (['SUSPENDIDO', 'ARCHIVADO', 'RECHAZADO'] as $state) {
            foreach ([null, '   ', str_repeat('x', 2001)] as $reason) {
                $this->patchJson('/api/departamentos/publicaciones/'.$publication->id, $this->payload($state, $reason))
                    ->assertUnprocessable()->assertJsonValidationErrors('observacion_revision');
                $this->assertSame('EN_REVISION', $publication->fresh()->estado);
                Storage::disk('local')->assertExists($publication->archivo_pdf);
            }
        }
        $this->patchJson('/api/departamentos/publicaciones/'.$publication->id, $this->payload('SUSPENDIDO', '  Corregir la fecha.  '))
            ->assertOk()->assertJsonPath('data.observacion_revision', 'Corregir la fecha.');
    }

    public function test_creation_requires_reason_for_manager_and_does_not_let_editor_set_review_outcome(): void
    {
        $department = $this->department();
        Sanctum::actingAs($this->assigned('ADMIN', $department));
        foreach (['SUSPENDIDO', 'ARCHIVADO', 'RECHAZADO'] as $state) {
            $this->postJson('/api/departamentos/'.$department->id.'/publicaciones',
                [...$this->payload($state, null), 'tipo' => 'REPORTE'])->assertUnprocessable()
                ->assertJsonValidationErrors('observacion_revision');
            $this->postJson('/api/departamentos/'.$department->id.'/publicaciones',
                [...$this->payload($state), 'tipo' => 'REPORTE'])->assertCreated()
                ->assertJsonPath('data.estado', $state)->assertJsonPath('data.observacion_revision', 'Falta completar la metodología.');
        }
        Sanctum::actingAs($this->assigned('EDITOR', $department));
        $this->postJson('/api/departamentos/'.$department->id.'/publicaciones',
            [...$this->payload('RECHAZADO', null), 'tipo' => 'REPORTE'])->assertCreated()
            ->assertJsonPath('data.estado', 'EN_REVISION')->assertJsonPath('data.observacion_revision', null);
    }

    public function test_rejected_editor_cannot_edit_replace_pdf_delete_or_change_status_but_can_read_the_pdf(): void
    {
        $department = $this->department();
        $editor = $this->assigned('EDITOR', $department);
        $publication = $this->publication($editor, $department);
        $publication->update(['estado' => 'RECHAZADO', 'observacion_revision' => 'No cumple los requisitos.', 'fecha_revision' => now()]);
        Sanctum::actingAs($editor);
        foreach (['PUBLICACION', 'EN_REVISION', 'SUSPENDIDO'] as $state) {
            $this->patchJson('/api/departamentos/publicaciones/'.$publication->id,
                [...$this->payload($state, null), 'titulo' => 'Intento de cambio'])->assertForbidden();
        }
        $this->post('/api/departamentos/publicaciones/'.$publication->id,
            [...$this->payload('EN_REVISION', null), '_method' => 'PATCH',
                'archivo' => UploadedFile::fake()->create('reemplazo.pdf', 1, 'application/pdf')], ['Accept' => 'application/json'])
            ->assertForbidden();
        $this->deleteJson('/api/departamentos/publicaciones/'.$publication->id)->assertForbidden();
        $this->assertSame('Enviado por el editor', $publication->fresh()->titulo);
        $this->assertCount(1, Storage::disk('local')->allFiles());
        $this->get('/api/departamentos/publicaciones/'.$publication->id.'/download?context=management')
            ->assertOk()->assertHeader('Content-Type', 'application/pdf');
        $this->get('/api/departamentos/publicaciones/'.$publication->id.'/download')->assertNotFound();
        Sanctum::actingAs($this->assigned('EDITOR', $department));
        $this->getJson('/api/departamentos/'.$department->id.'/publicaciones')->assertOk()->assertJsonMissing(['id' => $publication->id]);
        $this->get('/api/departamentos/publicaciones/'.$publication->id.'/download?context=management')->assertNotFound();
    }

    public function test_editor_cannot_overwrite_review_reason_and_suspended_or_archived_publications_remain_editable(): void
    {
        $department = $this->department();
        $editor = $this->assigned('EDITOR', $department);
        Sanctum::actingAs($editor);
        foreach (['SUSPENDIDO', 'ARCHIVADO'] as $state) {
            $publication = $this->publication($editor, $department);
            $publication->update(['estado' => $state, 'observacion_revision' => 'Motivo del responsable.', 'fecha_revision' => now()]);
            $this->patchJson('/api/departamentos/publicaciones/'.$publication->id, $this->payload('PUBLICACION', 'Intento de alterar motivo'))
                ->assertUnprocessable()->assertJsonValidationErrors('observacion_revision');
            $this->patchJson('/api/departamentos/publicaciones/'.$publication->id, $this->payload('PUBLICACION', null))
                ->assertOk()->assertJsonPath('data.estado', $state)->assertJsonPath('data.observacion_revision', 'Motivo del responsable.');
        }
    }

    public function test_supervisor_cannot_review_outside_scope_or_without_review_permission_and_admin_can_reopen_rejection(): void
    {
        $department = $this->department();
        $other = $this->department('Ajeno');
        $editor = $this->assigned('EDITOR', $department);
        $publication = $this->publication($editor, $department);
        $publication->update(['estado' => 'RECHAZADO', 'observacion_revision' => 'Motivo inicial.', 'fecha_revision' => now()]);
        foreach ([$this->assigned('ADMIN_OBSERVATORIO', $other), $this->assigned('ADMIN_OBSERVATORIO', $department, false)] as $manager) {
            Sanctum::actingAs($manager);
            $this->patchJson('/api/departamentos/publicaciones/'.$publication->id, $this->payload('PUBLICACION', null))->assertForbidden();
        }
        Sanctum::actingAs($this->assigned('ADMIN', $department));
        $this->patchJson('/api/departamentos/publicaciones/'.$publication->id, $this->payload('EN_REVISION', null))
            ->assertOk()->assertJsonPath('data.estado', 'EN_REVISION')->assertJsonPath('data.observacion_revision', null)
            ->assertJsonPath('data.fecha_revision', null);
    }
}
