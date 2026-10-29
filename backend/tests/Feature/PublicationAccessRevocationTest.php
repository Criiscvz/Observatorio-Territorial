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

class PublicationAccessRevocationTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        config(['filesystems.default' => 'local']);
        Storage::fake('local');
        Storage::put('access.pdf', "%PDF-1.7\nRecovery fixture\n%%EOF");
        Schema::table('observatorio_publicaciones', fn (Blueprint $table) => $table->string('tipo', 20)->change());
        Schema::table('observatorio_publicaciones', fn (Blueprint $table) => $table->uuid('departamento_id')->nullable()->change());
    }

    private function user(string $role): User
    {
        return User::withoutEvents(fn () => User::factory()->create(['rol' => $role, 'is_active' => true]));
    }

    private function department(): Departamento
    {
        return Departamento::create(['nombre' => 'Acceso', 'codigo_interno' => (string) Str::uuid(), 'publico' => true]);
    }

    private function assign(User $user, Departamento $department): void
    {
        $user->departamentos()->attach($department->id, ['id' => (string) Str::uuid(),
            'rol' => $user->isObservatoryAdmin() ? 'ADMIN' : 'EDITOR',
            'puede_revisar' => true, 'puede_agregar_editores' => true]);
    }

    private function publication(User $owner, ?Departamento $department, string $type = 'ARTICULO'): ObservatorioPublicacion
    {
        return ObservatorioPublicacion::create(['creado_por' => $owner->id, 'departamento_id' => $department?->id,
            'tipo' => $type, 'codigo' => 'ACCESS-'.Str::uuid(), 'titulo' => 'Publicación de ensayo',
            'fecha_publicacion' => '2026-10-29', 'estado' => 'RECHAZADO', 'solo_suscriptores' => true,
            'archivo_pdf' => 'access.pdf', 'link_url' => 'https://app.powerbi.com/view?r=fixture']);
    }

    public function test_revoking_an_editor_assignment_removes_private_pdf_and_unpublished_metadata_access_immediately(): void
    {
        $editor = $this->user('EDITOR');
        $department = $this->department();
        $this->assign($editor, $department);
        Sanctum::actingAs($editor);
        foreach (['ARTICULO', 'LIBRO', 'REPORTE'] as $type) {
            $publication = $this->publication($editor, $department, $type);
            $url = '/api/departamentos/publicaciones/'.$publication->id.'/download?context=management';
            $this->get($url)->assertOk();
        }
        $editor->departamentos()->detach();
        foreach (ObservatorioPublicacion::all() as $publication) {
            $this->getJson('/api/departamentos/publicaciones/'.$publication->id.'/download?context=management')->assertNotFound();
            $this->patchJson('/api/departamentos/publicaciones/'.$publication->id, [
                'titulo' => $publication->titulo, 'fecha_publicacion' => '2026-10-29',
                'link_url' => $publication->link_url, 'estado' => 'EN_REVISION',
            ])->assertForbidden();
            $this->deleteJson('/api/departamentos/publicaciones/'.$publication->id)->assertForbidden();
        }
        $this->getJson('/api/departamentos/'.$department->id.'/publicaciones')->assertOk()->assertJsonCount(0, 'data');
        $this->getJson('/api/editor/publicaciones')->assertOk()->assertJsonPath('meta.total', 0);
    }

    public function test_supervisor_without_review_permission_can_read_published_content_but_cannot_bypass_private_review_access(): void
    {
        $manager = $this->user('ADMIN_OBSERVATORIO');
        $department = $this->department();
        $this->assign($manager, $department);
        $draft = $this->publication($this->user('EDITOR'), $department);
        $published = $this->publication($this->user('EDITOR'), $department, 'LIBRO');
        $published->update(['estado' => 'PUBLICACION', 'solo_suscriptores' => false]);
        Sanctum::actingAs($manager);
        $this->get('/api/departamentos/publicaciones/'.$draft->id.'/download?context=management')->assertOk();
        DB::table('usuario_departamento')->where('user_id', $manager->id)->update(['puede_revisar' => false]);
        $this->getJson('/api/departamentos/publicaciones/'.$draft->id.'/download?context=management')->assertNotFound();
        $this->getJson('/api/departamentos/'.$department->id.'/publicaciones')->assertOk()
            ->assertJsonCount(1, 'data')->assertJsonMissing(['id' => $draft->id]);
        $this->getJson('/api/observatorio-admin/publicaciones')->assertOk()->assertJsonPath('meta.total', 1);
        $this->get('/api/departamentos/publicaciones/'.$published->id.'/download?context=management')->assertOk();
        $published->update(['solo_suscriptores' => true]);
        $this->getJson('/api/departamentos/publicaciones/'.$published->id.'/download?context=management')->assertForbidden();
        $this->getJson('/api/departamentos/'.$department->id.'/publicaciones')->assertOk()
            ->assertJsonPath('data.0.bloqueado', true)->assertJsonPath('data.0.download_url', null);
        $this->assertTrue($manager->departamentos()->first()->pivot->puede_agregar_editores == true);
    }

    public function test_deleted_observatory_or_missing_parent_never_turns_a_publication_into_a_public_pdf(): void
    {
        $owner = $this->user('EDITOR');
        $department = $this->department();
        $publication = $this->publication($owner, $department);
        $publication->update(['estado' => 'PUBLICACION', 'solo_suscriptores' => false]);
        $department->delete();
        $url = '/api/departamentos/publicaciones/'.$publication->id.'/download';
        $this->getJson($url)->assertNotFound();
        Sanctum::actingAs($owner);
        $this->getJson($url.'?context=management')->assertNotFound();
        Sanctum::actingAs($this->user('ADMIN'));
        $this->get($url)->assertOk(); // Global administration retains recovery access.
    }

    public function test_non_atlas_publication_without_observatory_cannot_be_read_as_a_global_resource(): void
    {
        $publication = $this->publication($this->user('EDITOR'), null, 'LIBRO');
        $publication->update(['estado' => 'PUBLICACION', 'solo_suscriptores' => false]);
        $this->getJson('/api/departamentos/publicaciones/'.$publication->id.'/download')->assertNotFound();
    }
}
