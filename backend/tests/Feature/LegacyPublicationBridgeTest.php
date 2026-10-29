<?php

namespace Tests\Feature;

use App\Application\Publicaciones\LegacyPublicationRehearsal;
use App\Application\Publicaciones\PublicPublicationCatalog;
use App\Infrastructure\Persistence\Eloquent\Models\ArticuloModel;
use App\Infrastructure\Persistence\Eloquent\Models\ReporteModel;
use App\Models\Departamento;
use App\Models\ObservatorioPublicacion;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class LegacyPublicationBridgeTest extends TestCase
{
    use RefreshDatabase;

    private Departamento $department;
    private User $admin;
    private User $editor;

    protected function setUp(): void
    {
        parent::setUp();
        config(['publications.legacy_rehearsal_enabled' => true, 'filesystems.default' => 'phase2-rehearsal']);
        Storage::fake('phase2-rehearsal');
        app(LegacyPublicationRehearsal::class)->prepare();
        $this->department = Departamento::create(['nombre' => 'Adapter fixture', 'codigo_interno' => 'BRIDGE', 'publico' => true]);
        $this->admin = User::factory()->create(['rol' => 'ADMIN']);
        $this->editor = User::factory()->create(['rol' => 'EDITOR']);
        $this->editor->departamentos()->attach($this->department->id, ['id' => (string) Str::uuid(), 'rol' => 'EDITOR']);
    }

    private function convert(string $source = 'articulos', array $extra = []): array
    {
        $model = $source === 'articulos'
            ? ArticuloModel::create(['titulo' => 'Original article', 'descripcion' => 'Original description', 'autor' => 'First author',
                'enlace' => 'https://example.test/article', 'fecha_recepcion' => '2026-09-01', 'estado' => 'PUBLICADO',
                'departamento_id' => $this->department->id, 'fecha_publicacion' => '2026-09-10', ...$extra])
            : ReporteModel::create(['nombre_indicador' => 'Original report', 'descripcion_indicador' => 'Report description',
                'departamento_id' => $this->department->id, 'fecha_publicacion' => '2026-09-10',
                'link_url' => 'https://app.powerbi.com/view?r=synthetic', 'ficha_indicador' => '/api/reportes/fichas/bridge.pdf', ...$extra]);
        Storage::disk('phase2-rehearsal')->put('public/fichas/bridge.pdf', "%PDF-1.4\nOriginal fixture\n%%EOF");
        $decision = ['source' => $source, 'id' => $model->id,
            'source_sha256' => LegacyPublicationRehearsal::fingerprint((array) DB::table($source)->where('id', $model->id)->first()),
            'target_id' => (string) Str::uuid(), 'codigo' => ($source === 'articulos' ? 'ART-MIG-' : 'REP-MIG-').$model->id,
            'owner_id' => $this->editor->id, 'owner_decision' => 'Explicit synthetic owner for adapter tests.',
            'preservation_decision' => 'Keep original privacy and deletion constraints.',
            ...($source === 'reportes' ? ['estado' => 'PUBLICACION', 'state_decision' => 'Explicit approval in this synthetic fixture.',
                'file' => ['source' => 'public/fichas/bridge.pdf', 'sha256' => hash('sha256', "%PDF-1.4\nOriginal fixture\n%%EOF")]] : [])];
        $plan = ['version' => 1, 'batch_id' => (string) Str::uuid(), 'records' => [$decision]];
        app(LegacyPublicationRehearsal::class)->apply($plan);
        return [$model, ObservatorioPublicacion::findOrFail($decision['target_id']), $plan];
    }

    public function test_old_and_new_ids_share_one_editable_destination_and_keep_the_source_unchanged(): void
    {
        [$old, $p, $plan] = $this->convert();
        $before = $old->fresh()->getAttributes();
        Sanctum::actingAs($this->editor);
        $this->putJson('/api/articulos/'.$old->id, ['titulo' => 'Edited through old ID'])->assertOk()->assertJsonPath('id', $p->id);
        $this->assertSame('Edited through old ID', $p->fresh()->titulo);
        $this->patchJson('/api/departamentos/publicaciones/'.$p->id, [
            'titulo' => 'Edited through current form', 'fecha_publicacion' => '2026-09-10',
            'autores' => ['First author', 'Second author'], 'descripcion' => 'Updated description',
        ])->assertOk();
        $this->putJson('/api/articulos/'.$p->id, ['fuente' => 'New source'])->assertOk();
        $this->getJson('/api/articulos/'.$old->id)->assertOk()->assertJsonPath('titulo', 'Edited through current form')
            ->assertJsonPath('autor.1', 'Second author')->assertJsonPath('descripcion', 'Updated description')->assertJsonPath('fuente', 'New source');
        $this->getJson('/api/publico/publicaciones')->assertOk()->assertJsonPath('meta.total', 1);
        $this->assertSame($before, $old->fresh()->getAttributes());
        $this->assertDatabaseCount('observatorio_publicaciones', 1);
        $this->assertDatabaseCount('publication_origins', 1);
        $blocked = false;
        try { app(LegacyPublicationRehearsal::class)->rollback($plan['batch_id']); } catch (\Throwable) { $blocked = true; }
        $this->assertTrue($blocked, 'Recovery must not discard subsequent edits.');
    }

    public function test_old_creation_stores_only_a_new_publication_and_requires_explicit_destination_and_date(): void
    {
        Sanctum::actingAs($this->editor);
        $payload = ['titulo' => 'Created with old payload', 'departamento_id' => $this->department->id, 'fecha_publicacion' => '2026-09-10'];
        $this->postJson('/api/articulos', array_diff_key($payload, ['fecha_publicacion' => true]))->assertUnprocessable();
        $id = $this->postJson('/api/articulos', $payload)->assertCreated()->assertJsonPath('estado', 'EN_REVISION')->json('id');
        $this->assertDatabaseCount('articulos', 0); $this->assertDatabaseCount('observatorio_publicaciones', 1);
        $this->assertDatabaseHas('publication_origins', ['source_id' => $id, 'target_id' => $id, 'source_kind' => 'compatibility']);
        $this->assertSame($this->editor->id, ObservatorioPublicacion::findOrFail($id)->creado_por);
        $this->putJson('/api/articulos/'.$id, ['titulo' => 'Still one publication'])->assertOk();
        $this->postJson('/api/articulos', [...$payload, 'estado' => 'PUBLICADO'])->assertForbidden();
        $this->postJson('/api/articulos', [...$payload, 'visibilidad' => 'suscriptor'])->assertForbidden();
        $this->assertDatabaseCount('observatorio_publicaciones', 1);
        Sanctum::actingAs($this->admin);
        $reportId = $this->postJson('/api/reportes', ['nombre_indicador' => 'New report', 'departamento_id' => $this->department->id,
            'fecha_publicacion' => '2026-09-10', 'link_url' => 'https://app.powerbi.com/view?r=synthetic', 'estado' => 'PUBLICADO'])
            ->assertCreated()->assertJsonPath('estado', 'PUBLICACION')->json('id');
        $this->assertDatabaseCount('reportes', 0);
        $this->getJson('/api/reportes/'.$reportId)->assertOk()->assertJsonPath('nombre_indicador', 'New report');
    }

    public function test_permissions_rejection_and_revocation_apply_to_both_old_and_new_urls(): void
    {
        [$old, $p] = $this->convert();
        $other = User::factory()->create(['rol' => 'EDITOR']);
        $other->departamentos()->attach($this->department->id, ['id' => (string) Str::uuid(), 'rol' => 'EDITOR']);
        Sanctum::actingAs($other);
        $this->putJson('/api/articulos/'.$old->id, ['titulo' => 'Not the owner'])->assertForbidden();
        $supervisor = User::withoutEvents(fn () => User::factory()->create(['rol' => 'ADMIN_OBSERVATORIO']));
        $supervisor->departamentos()->attach($this->department->id, ['id' => (string) Str::uuid(), 'rol' => 'ADMIN', 'puede_revisar' => true]);
        Sanctum::actingAs($supervisor);
        $this->assertTrue($supervisor->canReadPublicationForManagement($p));
        $invalid = $this->putJson('/api/articulos/'.$old->id, ['titulo' => 'Reviewed', 'estado' => 'RECHAZADO']);
        $this->assertSame(422, $invalid->status(), $invalid->getContent());
        $this->putJson('/api/articulos/'.$old->id, ['titulo' => 'Reviewed', 'estado' => 'RECHAZADO', 'observacion_revision' => 'Synthetic rejection reason'])->assertOk();
        Sanctum::actingAs($this->editor);
        $this->putJson('/api/articulos/'.$old->id, ['titulo' => 'Cannot edit rejected'])->assertForbidden();
        $this->deleteJson('/api/articulos/'.$p->id)->assertForbidden();
        $this->getJson('/api/articulos/'.$old->id.'?context=management')->assertOk()->assertJsonPath('estado', 'RECHAZADO');
        Sanctum::actingAs($supervisor);
        $supervisor->departamentos()->updateExistingPivot($this->department->id, ['puede_revisar' => false]);
        $this->putJson('/api/articulos/'.$old->id, ['titulo' => 'Revoked reviewer'])->assertForbidden();
        $this->editor->departamentos()->detach($this->department->id);
        Sanctum::actingAs($this->editor);
        $this->getJson('/api/articulos/'.$old->id.'?context=management')->assertNotFound();
    }

    public function test_old_ficha_serves_current_pdf_and_preserves_original_after_replacement(): void
    {
        [$old, $p] = $this->convert('reportes');
        Sanctum::actingAs($this->editor);
        $pdf = "%PDF-1.4\nReplacement fixture\n%%EOF";
        $this->call('PUT', '/api/reportes/'.$old->id, ['nombre_indicador' => 'New report title'], [], [
            'ficha' => UploadedFile::fake()->createWithContent('replacement.pdf', $pdf),
        ], ['HTTP_ACCEPT' => 'application/json'])->assertOk();
        $p->refresh();
        $this->assertStringContainsString('publicaciones/compatibilidad/', $p->archivo_pdf);
        $this->get('/api/reportes/fichas/bridge.pdf')->assertOk()->assertStreamedContent($pdf);
        $this->get($this->getJson('/api/reportes/'.$old->id)->json('download_url'))->assertOk()->assertStreamedContent($pdf);
        $this->assertSame('/api/reportes/fichas/bridge.pdf', $old->fresh()->ficha_indicador);
        $this->assertSame("%PDF-1.4\nOriginal fixture\n%%EOF", Storage::disk('phase2-rehearsal')->get('public/fichas/bridge.pdf'));
        $this->assertDatabaseCount('observatorio_publicaciones', 1);
        $p->update(['link_url' => 'https://tenant.sharepoint.com/private-document',
            'sharepoint_url' => 'https://tenant.sharepoint.com/private-document', 'sharepoint_file_id' => 'synthetic-internal-id']);
        $row = $this->getJson('/api/reportes/'.$old->id)->assertOk()->assertJsonPath('link_url', null)->json();
        foreach (['sharepoint_file_id', 'archivo_pdf', 'source_snapshot', 'decisions'] as $field) {
            $this->assertArrayNotHasKey($field, $row);
        }
    }

    public function test_deletion_from_either_interface_keeps_identity_and_prevents_source_resurrection(): void
    {
        foreach (['old', 'current'] as $interface) {
            [$old, $p] = $this->convert('reportes');
            Sanctum::actingAs($this->editor);
            $url = $interface === 'old' ? '/api/reportes/'.$old->id : '/api/departamentos/publicaciones/'.$p->id;
            $this->deleteJson($url)->assertOk();
            $this->assertNotNull(DB::table('observatorio_publicaciones')->where('id', $p->id)->value('eliminado_legado_at'));
            $this->assertDatabaseHas('publication_origins', ['source_id' => $old->id, 'target_id' => $p->id]);
            $this->getJson('/api/reportes/'.$old->id)->assertNotFound();
            $this->get('/api/reportes/fichas/bridge.pdf')->assertNotFound();
            $this->assertSame(0, app(PublicPublicationCatalog::class)->query()->count());
            Storage::disk('phase2-rehearsal')->assertExists($p->archivo_pdf);
            $this->assertNotNull($old->fresh());
        }
    }

    public function test_category_and_received_date_updates_are_shared_and_restricted_fields_cannot_change(): void
    {
        [$old, $p] = $this->convert();
        $category = (string) Str::uuid();
        DB::table('categorias_dataset')->insert(['id' => $category, 'nombre' => 'New category', 'codigo' => 'bridge-category']);
        Sanctum::actingAs($this->editor);
        $this->putJson('/api/articulos/'.$old->id, ['categoria_id' => $category, 'fecha_recepcion' => '2026-08-01', 'creado_por' => $this->admin->id])->assertOk();
        $this->assertSame($this->editor->id, $p->fresh()->creado_por);
        $this->getJson('/api/publico/publicaciones?categoria_id='.$category)->assertOk()->assertJsonPath('meta.total', 1)
            ->assertJsonPath('data.0.fecha_recepcion', '2026-08-01');
        $this->putJson('/api/articulos/'.$old->id, ['estado' => 'ARCHIVADO', 'observacion_revision' => 'An editor cannot review'])->assertForbidden();
        $this->putJson('/api/articulos/'.$old->id, ['visibilidad' => 'privado'])->assertUnprocessable();
        $this->assertSame('PUBLICACION', $p->fresh()->estado);
    }

    public function test_conflicting_ids_and_map_rollback_never_guess_or_discard_live_identity(): void
    {
        [$old, $p] = $this->convert();
        (new ObservatorioPublicacion())->forceFill(['id' => $old->id, 'tipo' => 'ARTICULO', 'codigo' => 'ART-COLLISION', 'titulo' => 'Different resource',
            'departamento_id' => $this->department->id, 'creado_por' => $this->admin->id, 'fecha_publicacion' => '2026-09-10', 'estado' => 'PUBLICACION'])->saveOrFail();
        Sanctum::actingAs($this->admin);
        $this->getJson('/api/articulos/'.$old->id)->assertStatus(409);
        $this->putJson('/api/articulos/'.$old->id, ['titulo' => 'Do not guess'])->assertStatus(409);
        $this->assertSame('Original article', $p->fresh()->titulo);
        $migration = require database_path('migrations/2026_10_29_000002_create_publication_origins.php');
        $blocked = false; try { $migration->down(); } catch (\Throwable) { $blocked = true; }
        $this->assertTrue($blocked);
    }

    public function test_failed_pdf_update_rolls_back_rows_metadata_and_only_removes_the_new_copy(): void
    {
        [$old, $p] = $this->convert('reportes');
        $before = $p->getAttributes();
        $files = Storage::disk('phase2-rehearsal')->allFiles(); sort($files);
        Sanctum::actingAs($this->editor);
        ObservatorioPublicacion::updating(function () { throw new \RuntimeException('Synthetic write failure.'); });
        try {
            $this->call('PUT', '/api/reportes/'.$old->id, ['nombre_indicador' => 'Must roll back'], [], [
                'ficha' => UploadedFile::fake()->createWithContent('new.pdf', "%PDF-1.4\nFailed fixture\n%%EOF"),
            ], ['HTTP_ACCEPT' => 'application/json'])->assertStatus(500);
        } finally { ObservatorioPublicacion::flushEventListeners(); }
        $this->assertSame($before, $p->fresh()->getAttributes());
        $after = Storage::disk('phase2-rehearsal')->allFiles(); sort($after);
        $this->assertSame($files, $after);
        $this->assertDatabaseCount('publication_origins', 1);
    }

    public function test_private_and_subscriber_destinations_keep_current_authorization_on_old_details_and_files(): void
    {
        [$old, $p] = $this->convert('reportes', ['visibilidad' => 'suscriptor']);
        $subscriber = User::factory()->create(['rol' => 'SUBSCRIBER']);
        $other = User::factory()->create(['rol' => 'EDITOR']);
        foreach ([null, $other, $subscriber, $this->editor] as $actor) {
            \Illuminate\Support\Facades\Auth::forgetGuards();
            if ($actor) { Sanctum::actingAs($actor); }
            $this->getJson('/api/reportes/'.$old->id)->assertStatus($actor?->isSubscriber() ? 200 : 403);
            $this->get('/api/reportes/fichas/bridge.pdf')->assertStatus($actor?->isSubscriber() ? 200 : 403);
        }
        Sanctum::actingAs($this->editor);
        $this->get('/api/reportes/fichas/bridge.pdf?context=management')->assertOk();
        $p->forceFill(['visibilidad_legada' => 'privado'])->saveOrFail();
        Sanctum::actingAs($subscriber);
        $this->getJson('/api/reportes/'.$old->id.'?context=management')->assertNotFound();
        $this->get('/api/reportes/fichas/bridge.pdf')->assertNotFound();
        Sanctum::actingAs($this->editor);
        $this->getJson('/api/reportes/'.$old->id.'?context=management')->assertOk();
        $this->editor->departamentos()->detach($this->department->id);
        $this->get('/api/reportes/fichas/bridge.pdf?context=management')->assertNotFound();
    }

    public function test_permanent_identity_is_unique_and_rehearsal_receipts_are_not_runtime_dependencies(): void
    {
        [$old, $p] = $this->convert();
        $origin = (array) DB::table('publication_origins')->first();
        $origin['id'] = (string) Str::uuid();
        $blocked = false;
        try { DB::transaction(fn () => DB::table('publication_origins')->insert($origin)); } catch (\Illuminate\Database\QueryException) { $blocked = true; }
        $this->assertTrue($blocked);
        // Runtime routing must not depend on the disposable rehearsal ledger.
        \Illuminate\Support\Facades\Schema::drop('phase2_publication_imports');
        $this->getJson('/api/publico/publicaciones')->assertOk()->assertJsonPath('meta.total', 1);
        $this->getJson('/api/articulos/'.$old->id)->assertOk()->assertJsonPath('id', $p->id);
        Sanctum::actingAs($this->editor);
        $this->putJson('/api/articulos/'.$old->id, ['titulo' => 'Updated without rehearsal tables'])->assertOk();
        $this->assertDatabaseCount('articulos', 1);
        $this->assertDatabaseCount('observatorio_publicaciones', 1);
    }

    public function test_category_deletion_keeps_the_identity_without_a_dangling_public_category(): void
    {
        $category = (string) Str::uuid();
        DB::table('categorias_dataset')->insert(['id' => $category, 'nombre' => 'Temporary category', 'codigo' => 'temporary-bridge']);
        [$old, $p] = $this->convert('articulos', ['categoria_id' => $category]);
        DB::table('categorias_dataset')->where('id', $category)->delete();
        $this->assertDatabaseHas('publication_origins', ['source_id' => $old->id, 'target_id' => $p->id, 'categoria_id' => null]);
        $this->getJson('/api/articulos/'.$old->id)->assertOk()->assertJsonPath('categoria', null);
        $this->getJson('/api/publico/publicaciones')->assertOk()->assertJsonPath('meta.total', 1)->assertJsonPath('data.0.categoria_id', null);
    }
}
