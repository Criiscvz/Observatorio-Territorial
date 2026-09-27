<?php

namespace Tests\Feature;

use App\Models\AtlasCategoria;
use App\Models\ObservatorioPublicacion;
use App\Models\User;
use App\Infrastructure\Services\SharePointService;
use Database\Seeders\AtlasCategoriaSeeder;
use Illuminate\Database\QueryException;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use Illuminate\Http\UploadedFile;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class AtlasCategoriaTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        // Only an in-memory database; no reset command and no application database access.
        $this->assertSame(':memory:', config('database.connections.sqlite.database'));
        $this->assertSame('sqlite', config('database.default'));
        Schema::create('users', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('email');
            $table->string('rol');
            $table->softDeletes();
        });
        DB::table('users')->insert(['id' => 1, 'name' => 'Admin', 'email' => 'test@example.test', 'rol' => 'ADMIN']);
        Schema::create('publicacion_contadores', function (Blueprint $table) {
            $table->string('tipo')->primary();
            $table->integer('siguiente_numero');
        });
        DB::table('publicacion_contadores')->insert(['tipo' => 'ATLAS', 'siguiente_numero' => 1]);
        Schema::create('observatorio_publicaciones', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('departamento_id')->nullable();
            $table->unsignedBigInteger('creado_por')->nullable();
            $table->string('tipo');
            $table->string('estado');
            $table->boolean('solo_suscriptores')->default(false);
            foreach (['codigo', 'titulo', 'link_url', 'descripcion', 'autores', 'fuente', 'archivo_pdf',
                'nombre_archivo_original', 'sharepoint_url', 'sharepoint_file_id', 'sharepoint_file_name', 'sharepoint_error',
                'sharepoint_file_type', 'sharepoint_sync_status', 'sharepoint_last_modified_at', 'sharepoint_synced_at'] as $field) {
                $table->text($field)->nullable();
            }
            $table->unsignedBigInteger('sharepoint_file_size')->nullable();
            $table->date('fecha_publicacion')->nullable();
            $table->timestamps();
        });
        (require database_path('migrations/2026_09_27_000001_create_atlas_categorias.php'))->up();
    }

    private function signIn(string $role = 'ADMIN'): void
    {
        Sanctum::actingAs((new User())->forceFill(['id' => 1, 'rol' => $role, 'is_active' => true]));
    }

    public function test_failed_upload_does_not_create_a_publication_or_replace_existing_pdf(): void
    {
        $this->signIn();
        $disk = \Mockery::mock(\Illuminate\Filesystem\FilesystemAdapter::class);
        $disk->shouldReceive('putFileAs')->twice()->andReturn(false);
        Storage::shouldReceive('disk')->andReturn($disk);
        $payload = ['tipo' => 'ATLAS', 'titulo' => 'Documento', 'estado' => 'PUBLICACION',
            'fecha_publicacion' => '2026-09-26', 'fuente' => 'ULEAM'];
        $this->postJson('/api/departamentos/publicaciones/atlas-global', $payload + [
            'archivo' => UploadedFile::fake()->create('atlas.pdf', 10, 'application/pdf'),
        ])->assertStatus(503);
        $this->assertSame(0, ObservatorioPublicacion::count());
        $this->assertSame(1, DB::table('publicacion_contadores')->value('siguiente_numero'));
        $existing = $this->publication(['archivo_pdf' => 'original.pdf']);
        $this->patchJson("/api/departamentos/publicaciones/{$existing->id}", $payload + [
            'archivo' => UploadedFile::fake()->create('nuevo.pdf', 10, 'application/pdf'),
        ])->assertStatus(503);
        $this->assertSame('original.pdf', $existing->fresh()->archivo_pdf);
        $this->assertSame('Atlas de prueba', $existing->fresh()->titulo);
    }

    public function test_uploaded_pdf_can_be_opened_replaced_and_deleted(): void
    {
        $this->signIn();
        config(['filesystems.default' => 's3']);
        Storage::fake(config('filesystems.default'));
        $payload = ['tipo' => 'ATLAS', 'titulo' => 'Documento', 'estado' => 'PUBLICACION',
            'fecha_publicacion' => '2026-09-26', 'fuente' => 'ULEAM'];
        $response = $this->postJson('/api/departamentos/publicaciones/atlas-global', $payload + [
            'archivo' => UploadedFile::fake()->createWithContent('atlas.pdf', "%PDF-1.4\nOriginal"),
        ])->assertCreated();
        $id = $response->json('data.id');
        $url = $response->json('data.download_url');
        $old = ObservatorioPublicacion::findOrFail($id)->archivo_pdf;
        $this->get($url)->assertOk()->assertHeader('Content-Type', 'application/pdf')
            ->assertStreamedContent("%PDF-1.4\nOriginal");
        ObservatorioPublicacion::findOrFail($id)->update(['sharepoint_url' => 'https://example.test/old.pdf']);
        $this->patchJson("/api/departamentos/publicaciones/$id", $payload + [
            'archivo' => UploadedFile::fake()->createWithContent('nuevo.pdf', "%PDF-1.4\nNuevo"),
        ])->assertOk()->assertJsonPath('data.sharepoint_url', null);
        Storage::disk(config('filesystems.default'))->assertMissing($old);
        $this->get($url)->assertOk()->assertStreamedContent("%PDF-1.4\nNuevo");
        $new = ObservatorioPublicacion::findOrFail($id)->archivo_pdf;
        $this->deleteJson("/api/departamentos/publicaciones/$id")->assertOk();
        Storage::disk(config('filesystems.default'))->assertMissing($new);
        $this->getJson($url)->assertNotFound();
    }

    public function test_missing_files_and_restricted_downloads_are_not_exposed(): void
    {
        Storage::fake(config('filesystems.default'));
        $missing = $this->publication();
        $this->getJson("/api/departamentos/publicaciones/{$missing->id}/download")->assertNotFound();
        $missing->update(['archivo_pdf' => 'missing.pdf']);
        $this->getJson("/api/departamentos/publicaciones/{$missing->id}/download")->assertNotFound();
        Storage::disk(config('filesystems.default'))->put('private.pdf', '%PDF-1.4 secret');
        $private = $this->publication(['archivo_pdf' => 'private.pdf', 'solo_suscriptores' => true]);
        $this->getJson("/api/departamentos/publicaciones/{$private->id}/download")->assertForbidden();
        $private->update(['solo_suscriptores' => false, 'estado' => 'EN_REVISION']);
        $this->getJson("/api/departamentos/publicaciones/{$private->id}/download")->assertNotFound();
        $this->signIn();
        $this->get("/api/departamentos/publicaciones/{$private->id}/download")->assertOk();
    }

    public function test_failed_file_deletion_preserves_publication(): void
    {
        $this->signIn();
        $publication = $this->publication(['archivo_pdf' => 'private.pdf']);
        $disk = \Mockery::mock(\Illuminate\Filesystem\FilesystemAdapter::class);
        $disk->shouldReceive('exists')->with('private.pdf')->andReturn(true);
        $disk->shouldReceive('delete')->with('private.pdf')->andReturn(false);
        Storage::shouldReceive('disk')->andReturn($disk);
        $this->deleteJson("/api/departamentos/publicaciones/{$publication->id}")->assertStatus(503);
        $this->assertNotNull($publication->fresh());
    }

    public function test_s3_upload_logs_only_safe_diagnostic_fields(): void
    {
        $this->signIn();
        config(['filesystems.default' => 's3']);
        $aws = new \Aws\S3\Exception\S3Exception('SECRET_DO_NOT_LOG', new \Aws\Command('PutObject'), [
            'code' => 'AccessDenied', 'response' => new \GuzzleHttp\Psr7\Response(403),
        ]);
        $driver = \Mockery::mock(\League\Flysystem\FilesystemOperator::class);
        $driver->shouldReceive('writeStream')->once()->andThrow(
            \League\Flysystem\UnableToWriteFile::atLocation('sensitive-path', 'SECRET_DO_NOT_LOG', $aws)
        );
        $disk = \Mockery::mock(\Illuminate\Filesystem\FilesystemAdapter::class);
        $disk->shouldReceive('getDriver')->andReturn($driver);
        Storage::shouldReceive('disk')->with('s3')->andReturn($disk);
        \Illuminate\Support\Facades\Log::spy();
        $this->postJson('/api/departamentos/publicaciones/atlas-global', [
            'tipo' => 'ATLAS', 'titulo' => 'Documento', 'estado' => 'PUBLICACION',
            'fecha_publicacion' => '2026-09-26', 'fuente' => 'ULEAM',
            'archivo' => UploadedFile::fake()->create('atlas.pdf', 10, 'application/pdf'),
        ])->assertStatus(503)->assertDontSee('SECRET_DO_NOT_LOG');
        \Illuminate\Support\Facades\Log::shouldHaveReceived('error')->with('ATLAS_STORAGE_WRITE_FAILED', [
            'disk' => 's3', 'exception' => \League\Flysystem\UnableToWriteFile::class,
            's3_code' => 'AccessDenied', 's3_status' => 403,
        ])->once();
        $this->assertSame(0, ObservatorioPublicacion::count());
    }

    public function test_sharepoint_import_assigns_category_and_preserves_existing_file_category(): void
    {
        $this->signIn();
        $first = AtlasCategoria::create(['nombre' => 'Salud']);
        $second = AtlasCategoria::create(['nombre' => 'Ambiente']);
        $this->mock(SharePointService::class, function ($mock) {
            $mock->shouldReceive('getPdfFileInsideRoot')->twice()->with('pdf-1')->andReturn([
                'id' => 'pdf-1', 'name' => 'Documento.pdf', 'web_url' => 'https://example.test/file',
                'mime_type' => 'application/pdf', 'size' => 100, 'last_modified_at' => '2026-09-26T12:00:00Z',
            ]);
        });
        $endpoint = '/api/departamentos/publicaciones/atlas-global/sharepoint/import-many';
        $this->postJson($endpoint, ['sharepoint_file_ids' => ['pdf-1'], 'atlas_categoria_id' => $first->id])
            ->assertOk()->assertJsonPath('totals.imported', 1)
            ->assertJsonPath('data.imported.0.atlas_categoria_id', $first->id);
        $this->postJson($endpoint, ['sharepoint_file_ids' => ['pdf-1'], 'atlas_categoria_id' => $second->id])
            ->assertOk()->assertJsonPath('totals.duplicates', 1);
        $this->assertSame($first->id, ObservatorioPublicacion::firstOrFail()->atlas_categoria_id);
        $this->deleteJson("/api/atlas/categorias/{$first->id}")->assertConflict();
        $second->delete();
        $this->postJson($endpoint, ['sharepoint_file_ids' => ['pdf-2'], 'atlas_categoria_id' => $second->id])
            ->assertUnprocessable()->assertJsonValidationErrors('atlas_categoria_id');
    }

    private function publication(array $attributes = []): ObservatorioPublicacion
    {
        return ObservatorioPublicacion::create(array_merge([
            'tipo' => 'ATLAS', 'estado' => 'PUBLICACION', 'titulo' => 'Atlas de prueba',
            'fecha_publicacion' => '2026-09-26', 'solo_suscriptores' => false,
        ], $attributes));
    }

    public function test_admin_can_create_edit_list_and_soft_delete(): void
    {
        $this->signIn();
        $id = $this->postJson('/api/atlas/categorias', ['nombre' => '  Finanzas   Públicas ', 'descripcion' => 'Descripción'])
            ->assertCreated()->assertJsonPath('data.nombre', 'Finanzas Públicas')->json('data.id');
        $this->putJson("/api/atlas/categorias/$id", ['nombre' => 'Finanzas locales', 'descripcion' => null])->assertOk();
        $this->getJson('/api/atlas/categorias')->assertOk()->assertJsonPath('data.0.nombre', 'Finanzas locales');
        $this->deleteJson("/api/atlas/categorias/$id")->assertOk();
        $this->assertSoftDeleted('atlas_categorias', ['id' => $id]);
        $this->getJson('/api/publico/atlas/categorias')->assertOk()->assertJsonCount(0, 'data');
    }

    public function test_required_names_and_case_insensitive_duplicates(): void
    {
        $this->signIn();
        $this->postJson('/api/atlas/categorias', ['nombre' => '  '])->assertUnprocessable()->assertJsonValidationErrors('nombre');
        $this->postJson('/api/atlas/categorias', ['nombre' => 'EDUCACIÓN'])->assertCreated();
        $this->postJson('/api/atlas/categorias', ['nombre' => ' educación '])->assertUnprocessable()->assertJsonValidationErrors('nombre');
        $other = AtlasCategoria::create(['nombre' => 'Otra']);
        $this->putJson("/api/atlas/categorias/{$other->id}", ['nombre' => 'Educación'])->assertUnprocessable();
    }

    public function test_seed_preserves_renames_descriptions_and_deletions(): void
    {
        $existing = AtlasCategoria::create(['nombre' => 'SALUD', 'descripcion' => 'Personalizada']);
        $seed = new AtlasCategoriaSeeder();
        $seed->run();
        $seed->run();
        $this->assertSame(10, AtlasCategoria::count());
        $this->assertSame('Personalizada', $existing->fresh()->descripcion);
        $existing->update(['nombre' => 'Salud comunitaria']);
        AtlasCategoria::where('nombre', 'Economía')->firstOrFail()->delete();
        $seed->run();
        $this->assertSame(10, AtlasCategoria::withTrashed()->count());
        $this->assertSame(9, AtlasCategoria::count());
        $this->assertSame('Salud comunitaria', $existing->fresh()->nombre);
    }

    public function test_associated_drafts_and_files_block_deletion_and_foreign_key_restricts(): void
    {
        $this->signIn();
        $category = AtlasCategoria::create(['nombre' => 'Salud']);
        $publication = $this->publication(['atlas_categoria_id' => $category->id, 'estado' => 'ARCHIVADO', 'archivo_pdf' => 'private.pdf']);
        $this->deleteJson("/api/atlas/categorias/{$category->id}")->assertConflict();
        $this->assertNotNull($category->fresh());
        $this->assertSame('private.pdf', $publication->fresh()->archivo_pdf);
        $this->expectException(QueryException::class);
        DB::table('atlas_categorias')->where('id', $category->id)->delete();
    }

    public function test_anonymous_and_non_admin_writes_are_rejected(): void
    {
        $category = AtlasCategoria::create(['nombre' => 'Salud']);
        $this->postJson('/api/atlas/categorias', ['nombre' => 'Otra'])->assertUnauthorized();
        $this->putJson("/api/atlas/categorias/{$category->id}", ['nombre' => 'Otra'])->assertUnauthorized();
        $this->deleteJson("/api/atlas/categorias/{$category->id}")->assertUnauthorized();
        foreach (['EDITOR', 'USER', 'SUBSCRIBER'] as $role) {
            $this->signIn($role);
            $this->postJson('/api/atlas/categorias', ['nombre' => 'Otra'])->assertForbidden();
            $this->putJson("/api/atlas/categorias/{$category->id}", ['nombre' => 'Otra'])->assertForbidden();
            $this->deleteJson("/api/atlas/categorias/{$category->id}")->assertForbidden();
        }
    }

    public function test_public_filters_preserve_publication_rules_and_sensitive_fields(): void
    {
        $category = AtlasCategoria::create(['nombre' => 'Salud']);
        $empty = AtlasCategoria::create(['nombre' => 'Ambiente']);
        $legacy = $this->publication();
        $draft = $this->publication(['atlas_categoria_id' => $category->id, 'estado' => 'EN_REVISION']);
        $restricted = $this->publication(['atlas_categoria_id' => $category->id, 'solo_suscriptores' => true,
            'descripcion' => 'Secreto', 'sharepoint_url' => 'https://private.test/file',
            'sharepoint_file_name' => 'privado.pdf', 'sharepoint_error' => 'internal diagnostic']);
        $this->getJson('/api/publico/atlas/categorias')->assertOk()->assertJsonCount(2, 'data');
        $this->getJson("/api/publico/atlas?categoria_id={$empty->id}")->assertOk()->assertJsonCount(0, 'data');
        $this->getJson("/api/publico/atlas?categoria_id={$category->id}")->assertOk()->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.bloqueado', true)->assertJsonPath('data.0.download_url', null)
            ->assertJsonPath('data.0.sharepoint_url', null)->assertJsonPath('data.0.sharepoint_error', null)
            ->assertJsonPath('data.0.sharepoint_file_name', null)->assertDontSee('Secreto');
        $this->getJson('/api/publico/atlas')->assertOk()->assertJsonCount(2, 'data');
        $this->assertNull($legacy->fresh()->atlas_categoria_id);
        $this->getJson("/api/departamentos/publicaciones/{$draft->id}/download")->assertNotFound();
        $this->getJson("/api/departamentos/publicaciones/{$restricted->id}/download")->assertForbidden();
        $this->signIn('SUBSCRIBER');
        $this->getJson("/api/publico/atlas?categoria_id={$category->id}")->assertOk()
            ->assertJsonPath('data.0.bloqueado', false)->assertJsonPath('data.0.descripcion', 'Secreto');
    }

    public function test_database_unique_key_blocks_duplicate_names_without_controller_validation(): void
    {
        AtlasCategoria::create(['nombre' => 'Educación']);
        $this->expectException(QueryException::class);
        AtlasCategoria::create(['nombre' => ' EDUCACIÓN ']);
    }

    public function test_publication_category_can_be_saved_reassigned_and_cleared(): void
    {
        $this->signIn();
        Storage::fake(config('filesystems.default'));
        $first = AtlasCategoria::create(['nombre' => 'Salud']);
        $second = AtlasCategoria::create(['nombre' => 'Ambiente']);
        $payload = ['tipo' => 'ATLAS', 'titulo' => 'Nuevo Atlas', 'estado' => 'PUBLICACION',
            'fecha_publicacion' => '2026-09-26', 'fuente' => 'ULEAM', 'atlas_categoria_id' => $first->id];
        $id = $this->postJson('/api/departamentos/publicaciones/atlas-global', $payload + [
            'archivo' => UploadedFile::fake()->create('atlas.pdf', 10, 'application/pdf'),
        ])->assertCreated()->assertJsonPath('data.atlas_categoria_id', $first->id)->json('data.id');
        $payload['atlas_categoria_id'] = $second->id;
        $this->patchJson("/api/departamentos/publicaciones/$id", $payload)->assertOk()
            ->assertJsonPath('data.atlas_categoria_id', $second->id);
        unset($payload['atlas_categoria_id']);
        $this->patchJson("/api/departamentos/publicaciones/$id", $payload)->assertOk()
            ->assertJsonPath('data.atlas_categoria_id', $second->id);
        $this->patchJson("/api/departamentos/publicaciones/$id", $payload + ['atlas_categoria_id' => null])->assertOk()
            ->assertJsonPath('data.atlas_categoria_id', null);
        $this->deleteJson("/api/atlas/categorias/{$second->id}")->assertOk();
        $this->patchJson("/api/departamentos/publicaciones/$id", $payload + ['atlas_categoria_id' => $second->id])
            ->assertUnprocessable()->assertJsonValidationErrors('atlas_categoria_id');
    }
}
