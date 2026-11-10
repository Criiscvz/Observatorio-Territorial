<?php

namespace Tests\Feature;

use App\Application\Publicaciones\PublicationReviewWorkflow;
use App\Models\Departamento;
use App\Models\ObservatorioPublicacion;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class PublicationReviewWorkflowTest extends TestCase
{
    use RefreshDatabase;

    private Departamento $department;
    private User $editor;

    protected function setUp(): void
    {
        parent::setUp();
        config(['filesystems.default' => 'local']);
        Storage::fake('local');
        $this->department = Departamento::create(['nombre' => 'Revisión de ensayo', 'codigo_interno' => 'REVIEW', 'publico' => true]);
        $this->editor = $this->actor('EDITOR');
        $this->travelTo(now()->setDate(2026, 10, 29)->setTime(10, 0));
    }

    private function actor(string $role): User
    {
        $actor = User::withoutEvents(fn () => User::factory()->create(['rol' => $role, 'is_active' => true]));
        $actor->departamentos()->attach($this->department->id, ['id' => (string) Str::uuid(),
            'rol' => $role === 'EDITOR' ? 'EDITOR' : 'ADMIN', 'puede_revisar' => true]);
        return $actor;
    }

    private function publication(string $type = 'ARTICULO'): ObservatorioPublicacion
    {
        $id = (string) Str::uuid();
        Storage::put($id.'.pdf', "%PDF-1.4\nOriginal de ensayo\n%%EOF");
        return ObservatorioPublicacion::create(['id' => $id, 'departamento_id' => $this->department->id,
            'creado_por' => $this->editor->id, 'tipo' => $type, 'estado' => 'EN_REVISION',
            'codigo' => 'WF-'.$id, 'titulo' => 'Original', 'fecha_publicacion' => '2026-10-29',
            'archivo_pdf' => $id.'.pdf', 'nombre_archivo_original' => 'original.pdf',
            'link_url' => 'https://app.powerbi.com/view?r=fixture', 'solo_suscriptores' => true]);
    }

    private function payload(string $state, ?string $reason = null): array
    {
        return ['estado' => $state, 'observacion_revision' => $reason, 'titulo' => 'Original',
            'fecha_publicacion' => '2026-10-29', 'link_url' => 'https://app.powerbi.com/view?r=fixture',
            'solo_suscriptores' => true];
    }

    public function test_native_and_compatible_updates_share_stable_decision_dates_and_clear_reopened_decisions(): void
    {
        foreach (['ADMIN', 'ADMIN_OBSERVATORIO'] as $role) {
            Sanctum::actingAs($this->actor($role));
            foreach (['ARTICULO', 'REPORTE', 'LIBRO'] as $type) {
                $p = $this->publication($type); $path = '/api/departamentos/publicaciones/'.$p->id;
                foreach (['SUSPENDIDO', 'ARCHIVADO', 'RECHAZADO'] as $state) {
                    $this->patchJson($path, $this->payload($state, '  Corregir referencias.  '))
                        ->assertOk()->assertJsonPath('data.estado', $state)
                        ->assertJsonPath('data.observacion_revision', 'Corregir referencias.');
                    $date = $p->fresh()->fecha_revision->toIso8601String();
                    $this->assertSame(now()->toIso8601String(), $date);
                    $this->travel(1)->hours();
                    $this->patchJson($path, $this->payload($state, 'Corregir referencias.'))->assertOk();
                    $this->assertSame($date, $p->fresh()->fecha_revision->toIso8601String());
                    if ($type !== 'LIBRO') {
                        $legacy = '/api/'.($type === 'ARTICULO' ? 'articulos' : 'reportes').'/'.$p->id;
                        $this->putJson($legacy, ['fuente' => 'Actualización de metadatos'])->assertOk();
                        $this->putJson($legacy, ['estado' => $state, 'observacion_revision' => '  Corregir referencias.  '])->assertOk();
                        $this->assertSame($date, $p->fresh()->fecha_revision->toIso8601String());
                        $this->putJson($legacy, ['estado' => $state, 'observacion_revision' => 'Completar metodología.'])->assertOk();
                        $this->assertSame(now()->toIso8601String(), $p->fresh()->fecha_revision->toIso8601String());
                        $this->assertSame('Completar metodología.', $p->fresh()->observacion_revision);
                        $this->putJson($legacy, ['estado' => 'BORRADOR'])->assertOk();
                    } else {
                        $this->patchJson($path, $this->payload('EN_REVISION'))->assertOk();
                    }
                    $this->assertSame('EN_REVISION', $p->fresh()->estado);
                    $this->assertNull($p->fresh()->observacion_revision);
                    $this->assertNull($p->fresh()->fecha_revision);
                    Storage::assertExists($p->archivo_pdf);
                }
            }
        }
    }

    public function test_legacy_creation_records_the_reason_and_date_and_publishing_clears_them(): void
    {
        Sanctum::actingAs($this->actor('ADMIN'));
        foreach (['articulos', 'reportes'] as $source) {
            foreach (ObservatorioPublicacion::ESTADOS_CON_OBSERVACION as $state) {
                $payload = ['departamento_id' => $this->department->id, 'fecha_publicacion' => '2026-10-29',
                    'titulo' => 'Artículo de ensayo', 'nombre_indicador' => 'Reporte de ensayo',
                    'link_url' => 'https://app.powerbi.com/view?r=fixture', 'estado' => $state,
                    'observacion_revision' => '  Motivo de la decisión.  '];
                $id = $this->postJson('/api/'.$source, $payload)->assertCreated()->json('id');
                $p = ObservatorioPublicacion::findOrFail($id);
                $this->assertSame('Motivo de la decisión.', $p->observacion_revision);
                $this->assertSame(now()->toIso8601String(), $p->fecha_revision->toIso8601String());
                $this->putJson('/api/'.$source.'/'.$id, ['estado' => 'PUBLICADO'])->assertOk();
                $this->assertSame('PUBLICACION', $p->fresh()->estado);
                $this->assertNull($p->fresh()->observacion_revision);
                $this->assertNull($p->fresh()->fecha_revision);
            }
        }
        $this->assertDatabaseCount('articulos', 0);
        $this->assertDatabaseCount('reportes', 0);
    }

    public function test_editor_corrections_preserve_a_decision_and_rejection_blocks_both_routes(): void
    {
        $manager = $this->actor('ADMIN_OBSERVATORIO');
        foreach (['ARTICULO', 'REPORTE', 'LIBRO'] as $type) {
            $p = $this->publication($type); $path = '/api/departamentos/publicaciones/'.$p->id;
            Sanctum::actingAs($manager);
            $this->patchJson($path, $this->payload('ARCHIVADO', 'Motivo original.'))->assertOk();
            $date = $p->fresh()->fecha_revision->toIso8601String();
            Sanctum::actingAs($this->editor); $this->travel(1)->hours();
            $this->patchJson($path, [...$this->payload('PUBLICACION'), 'titulo' => 'Corregido'])
                ->assertOk()->assertJsonPath('data.estado', 'ARCHIVADO')->assertJsonPath('data.capabilities.can_review', false);
            if ($type !== 'LIBRO') {
                $this->putJson('/api/'.($type === 'ARTICULO' ? 'articulos' : 'reportes').'/'.$p->id,
                    ['fuente' => 'Corrección del editor'])->assertOk();
            }
            $this->assertSame('Motivo original.', $p->fresh()->observacion_revision);
            $this->assertSame($date, $p->fresh()->fecha_revision->toIso8601String());
            Sanctum::actingAs($manager);
            $this->patchJson($path, $this->payload('RECHAZADO', 'Rechazo definitivo.'))->assertOk();
            Sanctum::actingAs($this->editor);
            $this->patchJson($path, $this->payload('EN_REVISION'))->assertForbidden();
            if ($type !== 'LIBRO') {
                $this->putJson('/api/'.($type === 'ARTICULO' ? 'articulos' : 'reportes').'/'.$p->id,
                    ['fuente' => 'Intento rechazado'])->assertForbidden();
            }
            $this->assertSame('Rechazo definitivo.', $p->fresh()->observacion_revision);
        }
    }

    public function test_failure_after_a_compatible_review_rolls_back_the_decision_metadata_and_pdf_together(): void
    {
        $p = $this->publication(); Sanctum::actingAs($this->actor('ADMIN'));
        $before = $p->fresh()->getAttributes();
        // Native identity has no old metadata map: this error happens after save inside the transaction.
        $this->putJson('/api/articulos/'.$p->id, ['estado' => 'ARCHIVADO',
            'observacion_revision' => 'No publicar todavía.', 'fuente' => 'No debe guardarse',
            'fecha_recepcion' => '2026-10-29'])->assertUnprocessable();
        $this->assertSame($before, $p->fresh()->getAttributes());
        Storage::assertExists($p->archivo_pdf);
        $this->assertDatabaseCount('publication_origins', 0);
    }

    public function test_workflow_rechecks_current_permissions_and_validates_even_without_a_form_request(): void
    {
        $workflow = app(PublicationReviewWorkflow::class); $p = $this->publication();
        $manager = $this->actor('ADMIN_OBSERVATORIO'); $manager->load('departamentos');
        $manager->departamentos()->updateExistingPivot($this->department->id, ['puede_revisar' => false]);
        try {
            DB::transaction(fn () => $workflow->forUpdate($manager, $p->fresh(), $this->payload('PUBLICACION')));
            $this->fail('Revoked reviewer was accepted.');
        } catch (\Illuminate\Auth\Access\AuthorizationException $e) {
            $this->assertSame(403, $e->status() ?? 403);
        }
        $admin = $this->actor('ADMIN');
        foreach ([['estado' => 'PUBLICADO'], ['estado' => 'SUSPENDIDO'],
            ['estado' => 'RECHAZADO', 'observacion_revision' => ['invalid']],
            ['estado' => 'ARCHIVADO', 'observacion_revision' => str_repeat('a', 2001)]] as $input) {
            try {
                DB::transaction(fn () => $workflow->forUpdate($admin, $p->fresh(), $input));
                $this->fail('Invalid review was accepted.');
            } catch (ValidationException $e) {
                $this->assertNotEmpty($e->errors());
            }
        }
        $this->assertSame('EN_REVISION', $p->fresh()->estado);
        $this->assertNull($p->fresh()->fecha_revision);
    }

    public function test_metadata_edit_normalizes_legacy_whitespace_without_changing_the_original_decision_time(): void
    {
        $p = $this->publication();
        $p->update(['estado' => 'SUSPENDIDO', 'observacion_revision' => '  Revisar las fuentes.  ', 'fecha_revision' => now()]);
        $date = $p->fresh()->fecha_revision->toIso8601String();
        $this->travel(2)->hours(); Sanctum::actingAs($this->actor('ADMIN'));
        $this->putJson('/api/articulos/'.$p->id, ['fuente' => 'Fuente corregida'])->assertOk();
        $this->assertSame('Revisar las fuentes.', $p->fresh()->observacion_revision);
        $this->assertSame($date, $p->fresh()->fecha_revision->toIso8601String());
    }

    public function test_supervisor_is_not_treated_as_an_editor_if_review_permission_disappears_after_authorization(): void
    {
        $manager = $this->actor('ADMIN_OBSERVATORIO'); $p = $this->publication();
        Gate::after(function (User $actor, string $ability, ?bool $result) use ($manager): void {
            if ($actor->id === $manager->id && $result && in_array($ability, ['create', 'update'], true)) {
                $actor->departamentos()->updateExistingPivot($this->department->id, ['puede_revisar' => false]);
            }
        });
        $workflow = app(PublicationReviewWorkflow::class);
        foreach (['create', 'update'] as $operation) {
            $manager->departamentos()->updateExistingPivot($this->department->id, ['puede_revisar' => true]);
            try {
                DB::transaction(fn () => $operation === 'create'
                    ? $workflow->forCreation($manager, $this->department, 'ARTICULO', $this->payload('PUBLICACION'))
                    : $workflow->forUpdate($manager, $p->fresh(), $this->payload('PUBLICACION')));
                $this->fail('Revoked supervisor was treated as an editor.');
            } catch (\Symfony\Component\HttpKernel\Exception\HttpExceptionInterface $e) {
                $this->assertSame(403, $e->getStatusCode());
            }
        }
        $this->assertSame('EN_REVISION', $p->fresh()->estado);
    }
}
