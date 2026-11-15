<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Infrastructure\Services\SharePointService;
use App\Models\{AtlasCategoria, Departamento, ObservatorioPublicacion, User};
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\{DB, Http, Schema, Storage};
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class EditorialInputValidationTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;
    private Departamento $department;
    private AtlasCategoria $category;

    protected function setUp(): void
    {
        parent::setUp();
        // Older migrations change these columns only on PostgreSQL. Mirror its
        // nullability here; the same tests also run against its actual migrations.
        if (DB::getDriverName() === 'sqlite') {
            Schema::table('observatorio_publicaciones', function (Blueprint $table): void {
                $table->uuid('departamento_id')->nullable()->change();
                $table->string('archivo_pdf')->nullable()->change();
                $table->string('nombre_archivo_original')->nullable()->change();
            });
        }
        $this->admin = $this->user('ADMIN');
        $this->department = $this->department();
        $this->category = AtlasCategoria::create(['nombre' => 'Ambiente', 'publico' => true]);
        Sanctum::actingAs($this->admin);
        Storage::fake('local');
        Http::preventStrayRequests();
    }

    private function user(string $role): User
    {
        return User::withoutEvents(fn () => User::factory()->create(['rol' => $role, 'is_active' => true]));
    }

    private function department(bool $public = true): Departamento
    {
        return Departamento::create(['nombre' => 'Salud', 'codigo_interno' => (string) Str::uuid(), 'publico' => $public]);
    }

    private function reportPayload(): array
    {
        return ['tipo' => 'REPORTE', 'titulo' => 'Informe', 'estado' => 'PUBLICACION',
            'fecha_publicacion' => '2026-11-15', 'link_url' => 'https://example.test/report'];
    }

    private function publication(bool $atlas = false): ObservatorioPublicacion
    {
        return ObservatorioPublicacion::create([...$this->reportPayload(),
            'tipo' => $atlas ? 'ATLAS' : 'REPORTE', 'codigo' => 'QA-'.Str::uuid(),
            'departamento_id' => $atlas ? null : $this->department->id,
            'atlas_categoria_id' => $atlas ? $this->category->id : null, 'creado_por' => $this->admin->id]);
    }

    private function query(string $url, array $query)
    {
        return $this->getJson($url.'?'.http_build_query($query));
    }

    public static function invalidQueries(): array
    {
        return [['q', ['invalid']], ['q', "text\0text"], ['q', str_repeat('x', 256)],
            ['page', 0], ['page', 1000001], ['page', ['invalid']], ['per_page', 100], ['per_page', ['invalid']]];
    }

    #[DataProvider('invalidQueries')]
    public function test_paginated_public_and_management_filters_reject_invalid_inputs(string $field, mixed $value): void
    {
        foreach (['/api/publico/publicaciones', '/api/admin/publicaciones',
            '/api/departamentos/'.$this->department->id.'/biblioteca/publicaciones',
            '/api/departamentos/publicaciones/atlas-biblioteca', '/api/publico/atlas/biblioteca'] as $url) {
            $this->query($url, ['categoria_id' => $this->category->id, $field => $value])
                ->assertUnprocessable()->assertJsonValidationErrors($field);
        }
        $this->assertDatabaseCount('observatorio_publicaciones', 0);
    }

    public function test_directory_enum_and_uuid_filters_validate_without_database_type_errors(): void
    {
        foreach (['/api/publico/atlas/directorio', '/api/atlas/categorias/directorio'] as $url) {
            foreach ([['invalid'], "text\0text", str_repeat('x', 201)] as $q) {
                $this->query($url, ['q' => $q])->assertUnprocessable()->assertJsonValidationErrors('q');
            }
        }
        foreach (['/api/publico/publicaciones', '/api/admin/publicaciones',
            '/api/departamentos/'.$this->department->id.'/biblioteca/publicaciones',
            '/api/departamentos/'.$this->department->id.'/publicaciones'] as $url) {
            foreach (['tipo', 'estado'] as $field) {
                if ($url === '/api/publico/publicaciones' && $field === 'estado') continue;
                $this->query($url, [$field => ['invalid']])->assertUnprocessable()->assertJsonValidationErrors($field);
            }
        }
        foreach (['/api/publico/publicaciones', '/api/admin/publicaciones'] as $url) {
            $this->query($url, ['departamento_id' => 'invalid'])->assertUnprocessable()->assertJsonValidationErrors('departamento_id');
        }
        foreach (['/api/publico/atlas', '/api/publico/atlas/biblioteca',
            '/api/departamentos/publicaciones/atlas-biblioteca'] as $url) {
            $this->query($url, ['categoria_id' => ['invalid']])->assertUnprocessable()->assertJsonValidationErrors('categoria_id');
        }
    }

    public static function invalidCategories(): array
    {
        return [['nombre', null], ['nombre', ['invalid']], ['nombre', ' '], ['nombre', "A\0B"],
            ['nombre', str_repeat('é', 151)], ['nombre', str_repeat('İ', 100)],
            ['descripcion', "A\0B"], ['descripcion', str_repeat('x', 3001)], ['publico', null], ['icono', 'not_an_icon']];
    }

    #[DataProvider('invalidCategories')]
    public function test_invalid_category_mutations_do_not_write(string $field, mixed $value): void
    {
        $before = $this->category->refresh()->getRawOriginal();
        foreach (['post' => '/api/atlas/categorias', 'put' => '/api/atlas/categorias/'.$this->category->id] as $method => $url) {
            $this->json($method, $url, ['nombre' => 'Categoría distinta', $field => $value])
                ->assertUnprocessable()->assertJsonValidationErrors($field);
        }
        $this->assertDatabaseCount('atlas_categorias', 1);
        self::assertSame($before, $this->category->refresh()->getRawOriginal());
    }

    public function test_category_normalization_uniqueness_deleted_names_and_partial_settings_are_preserved(): void
    {
        $this->putJson('/api/atlas/categorias/'.$this->category->id, ['nombre' => '  AMBIENTE   '])->assertOk()
            ->assertJsonPath('data.nombre', 'AMBIENTE')->assertJsonPath('data.publico', true);
        $this->postJson('/api/atlas/categorias', ['nombre' => 'ambiente'])->assertUnprocessable()->assertJsonValidationErrors('nombre');
        $this->category->refresh()->delete();
        $this->postJson('/api/atlas/categorias', ['nombre' => 'Ambiente'])->assertUnprocessable()->assertJsonValidationErrors('nombre');
        $name = str_repeat('é', 150);
        $this->postJson('/api/atlas/categorias', ['nombre' => $name, 'nombre_clave' => 'injected', 'publico' => true])
            ->assertCreated()->assertJsonPath('data.nombre', $name);
        $this->assertDatabaseHas('atlas_categorias', ['nombre' => $name, 'nombre_clave' => $name]);
    }

    public function test_invalid_utf8_in_form_data_or_search_is_rejected_before_normalization_or_sql(): void
    {
        $this->withHeader('Accept', 'application/json')->post('/api/atlas/categorias', ['nombre' => "bad\xFFname"])
            ->assertUnprocessable()->assertJsonValidationErrors('nombre');
        $this->getJson('/api/publico/publicaciones?q=bad%FFname')->assertUnprocessable()->assertJsonValidationErrors('q');
        $this->getJson('/api/publico/atlas/directorio?q=bad%FFname')->assertUnprocessable()->assertJsonValidationErrors('q');
        $this->assertDatabaseCount('atlas_categorias', 1);
        $this->assertDatabaseCount('observatorio_publicaciones', 0);
    }

    public static function invalidAtlasLinks(): array
    {
        return [['titulo', ' '], ['titulo', ['invalid']], ['titulo', str_repeat('é', 256)], ['titulo', "A\0B"],
            ['fuente', "A\0B"], ['descripcion', "A\0B"], ['link_url', ['invalid']],
            ['link_url', 'javascript:alert(1)'], ['link_url', 'https://example.test/'.str_repeat('x', 2048)],
            ['fecha_publicacion', '0000-01-01'], ['fecha_publicacion', '2026-02-30'], ['archivo', 'not-permitted']];
    }

    #[DataProvider('invalidAtlasLinks')]
    public function test_invalid_atlas_links_do_not_write_files_rows_or_counters(string $field, mixed $value): void
    {
        $publication = $this->publication(true);
        $before = $publication->refresh()->getRawOriginal();
        $counter = DB::table('publicacion_contadores')->where('tipo', 'ATLAS')->value('siguiente_numero');
        $payload = ['titulo' => 'Atlas', 'fecha_publicacion' => '2026-11-15', 'link_url' => 'https://example.test/atlas',
            'atlas_categoria_id' => $this->category->id, $field => $value];
        $this->postJson('/api/atlas/categorias/'.$this->category->id.'/enlaces', $payload)
            ->assertUnprocessable()->assertJsonValidationErrors($field);
        $this->patchJson('/api/atlas/enlaces/'.$publication->id, $payload)
            ->assertUnprocessable()->assertJsonValidationErrors($field);
        self::assertSame($before, $publication->refresh()->getRawOriginal());
        self::assertSame($counter, DB::table('publicacion_contadores')->where('tipo', 'ATLAS')->value('siguiente_numero'));
        $this->assertDatabaseCount('observatorio_publicaciones', 1);
        self::assertSame([], Storage::disk('local')->allFiles());
    }

    public function test_valid_atlas_creation_reassignment_and_page_contracts_keep_server_owned_data(): void
    {
        $target = AtlasCategoria::create(['nombre' => 'Educación', 'publico' => true]);
        $payload = ['titulo' => 'Atlas público', 'fecha_publicacion' => '2026-11-15', 'link_url' => 'https://example.test/atlas',
            'creado_por' => 999, 'estado' => 'RECHAZADO', 'departamento_id' => $this->department->id,
            'archivo_pdf' => 'injected.pdf', 'mostrar_en_portal' => false];
        $id = $this->postJson('/api/atlas/categorias/'.$this->category->id.'/enlaces', $payload)->assertCreated()->json('data.id');
        $this->assertDatabaseHas('observatorio_publicaciones', ['id' => $id, 'creado_por' => $this->admin->id,
            'estado' => 'PUBLICACION', 'departamento_id' => null, 'archivo_pdf' => null]);
        $this->patchJson('/api/atlas/enlaces/'.$id, [...$payload, 'atlas_categoria_id' => $target->id])->assertOk();
        $this->assertDatabaseHas('observatorio_publicaciones', ['id' => $id, 'atlas_categoria_id' => $target->id]);
        $this->query('/api/publico/atlas/biblioteca', ['categoria_id' => $target->id, 'per_page' => 20])->assertOk()
            ->assertJsonPath('meta.per_page', 20)->assertJsonPath('meta.total', 1)->assertJsonPath('data.0.id', $id);
        $target->delete();
        $this->query('/api/publico/atlas/biblioteca', ['categoria_id' => $target->id])->assertNotFound();
        $this->query('/api/departamentos/publicaciones/atlas-biblioteca', ['categoria_id' => $target->id])->assertNotFound();
        $this->patchJson('/api/atlas/enlaces/'.$id, [...$payload, 'atlas_categoria_id' => $target->id])
            ->assertUnprocessable()->assertJsonValidationErrors('atlas_categoria_id');
    }

    public static function invalidMetadata(): array
    {
        return [['titulo', "A\0B", 'titulo'], ['descripcion', "A\0B", 'descripcion'], ['fuente', "A\0B", 'fuente'],
            ['autores', [42], 'autores.0'], ['autores', [['nested']], 'autores.0'], ['autores', ["A\0B"], 'autores.0'],
            ['autores', 42, 'autores'], ['autores', array_fill(0, 101, 'Autor'), 'autores'],
            ['fecha_publicacion', '0000-01-01', 'fecha_publicacion']];
    }

    #[DataProvider('invalidMetadata')]
    public function test_native_metadata_validation_rejects_invalid_authors_and_database_text_without_writes(string $field, mixed $value, string $error): void
    {
        $publication = $this->publication();
        $before = $publication->refresh()->getRawOriginal();
        $payload = [...$this->reportPayload(), $field => $value];
        $this->postJson('/api/departamentos/'.$this->department->id.'/publicaciones', $payload)
            ->assertUnprocessable()->assertJsonValidationErrors($error);
        $this->patchJson('/api/departamentos/publicaciones/'.$publication->id, $payload)
            ->assertUnprocessable()->assertJsonValidationErrors($error);
        self::assertSame($before, $publication->refresh()->getRawOriginal());
        $this->assertDatabaseCount('observatorio_publicaciones', 1);
    }

    public function test_original_pdf_filename_is_validated_before_any_storage_write(): void
    {
        foreach (['ARTICULO', 'LIBRO', 'REPORTE'] as $type) {
            $file = UploadedFile::fake()->create(str_repeat('x', 252).'.pdf', 1, 'application/pdf');
            $this->postJson('/api/departamentos/'.$this->department->id.'/publicaciones',
                [...$this->reportPayload(), 'tipo' => $type, 'archivo' => $file])
                ->assertUnprocessable()->assertJsonValidationErrors('archivo');
        }
        $this->assertDatabaseCount('observatorio_publicaciones', 0);
        self::assertSame([], Storage::disk('local')->allFiles());
    }

    public function test_native_author_normalization_valid_limits_and_review_states_remain_usable(): void
    {
        $id = $this->postJson('/api/departamentos/'.$this->department->id.'/publicaciones',
            [...$this->reportPayload(), 'autores' => ['  María Pérez  ', '', null, 'Juan']])
            ->assertCreated()->json('data.id');
        self::assertSame(['María Pérez', 'Juan'], ObservatorioPublicacion::findOrFail($id)->autores);
        $this->patchJson('/api/departamentos/publicaciones/'.$id, [...$this->reportPayload(), 'autores' => ' María Pérez '])
            ->assertOk();
        self::assertSame(['María Pérez'], ObservatorioPublicacion::findOrFail($id)->autores);
        $this->patchJson('/api/departamentos/publicaciones/'.$id, [...$this->reportPayload(), 'autores' => array_fill(0, 100, str_repeat('é', 255))])
            ->assertOk();
        foreach (['SUSPENDIDO', 'ARCHIVADO', 'RECHAZADO'] as $state) {
            $this->patchJson('/api/departamentos/publicaciones/'.$id,
                [...$this->reportPayload(), 'estado' => $state, 'observacion_revision' => 'Motivo visible'])
                ->assertOk()->assertJsonPath('data.estado', $state);
        }
        $this->query('/api/departamentos/'.$this->department->id.'/biblioteca/publicaciones', ['q' => 'Motivo'])
            ->assertOk()->assertJsonPath('meta.total', 1);
    }

    public static function invalidSharePointIds(): array
    {
        return [[['invalid']], ["A\0B"], ['item?query=1'], ['item#fragment'], ['../items'], ['item\\path'],
            ["item\nother"], [str_repeat('x', 1025)]];
    }

    #[DataProvider('invalidSharePointIds')]
    public function test_invalid_sharepoint_ids_never_call_provider_or_import(string|array $id): void
    {
        $this->instance(SharePointService::class, \Mockery::mock(SharePointService::class));
        foreach (['articulos', 'reportes', 'libros', 'atlas'] as $type) {
            $base = '/api/departamentos/'.$this->department->id.'/publicaciones/'.$type.'/sharepoint';
            $this->query($base.'/browse', ['item_id' => $id])->assertUnprocessable()->assertJsonValidationErrors('item_id');
            $this->postJson($base.'/import-many', ['sharepoint_file_ids' => [$id]])
                ->assertUnprocessable()->assertJsonValidationErrors('sharepoint_file_ids.0');
            if ($type !== 'articulos') $this->postJson($base.'/import', ['sharepoint_file_id' => $id])
                ->assertUnprocessable()->assertJsonValidationErrors('sharepoint_file_id');
        }
        $base = '/api/departamentos/publicaciones/atlas-global/sharepoint';
        $this->query($base.'/browse', ['item_id' => $id])->assertUnprocessable()->assertJsonValidationErrors('item_id');
        $this->postJson($base.'/import-many', ['sharepoint_file_ids' => [$id]])
            ->assertUnprocessable()->assertJsonValidationErrors('sharepoint_file_ids.0');
        $this->assertDatabaseCount('observatorio_publicaciones', 0);
    }

    public function test_bulk_import_lists_are_bounded_distinct_and_require_live_categories_before_provider_calls(): void
    {
        $this->instance(SharePointService::class, \Mockery::mock(SharePointService::class));
        $url = '/api/departamentos/'.$this->department->id.'/publicaciones/libros/sharepoint/import-many';
        foreach ([[], ['same', 'same'], ['named' => 'file'], array_fill(0, 51, 'file')] as $ids) {
            $this->postJson($url, ['sharepoint_file_ids' => $ids])->assertUnprocessable();
        }
        $this->category->delete();
        $this->postJson('/api/departamentos/publicaciones/atlas-global/sharepoint/import-many',
            ['sharepoint_file_ids' => ['file'], 'atlas_categoria_id' => $this->category->id])
            ->assertUnprocessable()->assertJsonValidationErrors('atlas_categoria_id');
        $this->postJson('/api/departamentos/'.$this->department->id.'/publicaciones/reportes/sharepoint/import',
            ['sharepoint_file_id' => 'file', 'descripcion' => "A\0B"])->assertUnprocessable()->assertJsonValidationErrors('descripcion');
        $this->assertDatabaseCount('observatorio_publicaciones', 0);
        self::assertSame([], Storage::disk('local')->allFiles());
    }

    public function test_sharepoint_opaque_ids_are_encoded_as_one_uri_segment_in_the_real_service(): void
    {
        config(['services.sharepoint.tenant_id' => 'editorial-test-tenant',
            'services.sharepoint.client_id' => 'editorial-test-client', 'services.sharepoint.client_secret' => str_repeat('e', 32),
            'services.sharepoint.drive_id' => 'editorial-drive', 'services.sharepoint.folder_path' => '',
            'services.sharepoint.verify_pdf_content' => false]);
        $reportId = 'report%2Fparent:!_-';
        $pdfId = 'pdf%2Fparent:!_-';
        Http::fake(function ($request) use ($reportId, $pdfId) {
            $path = parse_url($request->url(), PHP_URL_PATH);
            if ($path === '/editorial-test-tenant/oauth2/v2.0/token') {
                return Http::response(['access_token' => 'synthetic-token', 'expires_in' => 3600]);
            }
            if (in_array($path, ['/v1.0/drives/editorial-drive/root', '/v1.0/drives/editorial-drive/items/root'], true)) {
                return Http::response(['id' => 'root', 'name' => 'Root', 'folder' => []]);
            }
            if ($path === '/v1.0/drives/editorial-drive/items/'.rawurlencode($reportId)) {
                return Http::response(['id' => $reportId, 'name' => 'report.link',
                    'webUrl' => 'https://app.powerbi.com/view?r=synthetic', 'file' => ['mimeType' => 'text/plain']]);
            }
            if ($path === '/v1.0/drives/editorial-drive/items/'.rawurlencode($pdfId)) {
                return Http::response(['id' => $pdfId, 'name' => 'document.pdf', 'file' => ['mimeType' => 'application/pdf'],
                    'parentReference' => ['id' => 'root', 'driveId' => 'editorial-drive']]);
            }
            throw new \RuntimeException('Unexpected synthetic Graph endpoint.');
        });
        $service = app(SharePointService::class);
        self::assertSame('https://app.powerbi.com/view?r=synthetic', $service->getPowerBiLink($reportId)['powerbi_url']);
        self::assertSame($pdfId, $service->getPdfFileInsideRoot($pdfId)['id']);
        Http::assertSentCount(5);
    }

    public function test_authorization_precedes_validation_and_scope_is_queried_after_revocation(): void
    {
        $this->instance(SharePointService::class, \Mockery::mock(SharePointService::class));
        foreach (['USER', 'SUBSCRIBER', 'EDITOR', 'ADMIN_OBSERVATORIO'] as $role) {
            Sanctum::actingAs($this->user($role));
            $this->postJson('/api/atlas/categorias', [])->assertForbidden();
            $this->postJson('/api/atlas/categorias/'.$this->category->id.'/enlaces', [])->assertForbidden();
            $this->postJson('/api/departamentos/'.$this->department->id.'/publicaciones/libros/sharepoint/import-many', [])
                ->assertForbidden();
        }
        $private = $this->department(false);
        $editor = $this->user('EDITOR');
        $editor->departamentos()->attach($private->id, ['id' => (string) Str::uuid(), 'rol' => 'EDITOR']);
        Sanctum::actingAs($editor);
        $this->query('/api/departamentos/'.$private->id.'/biblioteca/publicaciones', ['q' => ['invalid']])->assertUnprocessable();
        $editor->departamentos()->detach();
        $this->query('/api/departamentos/'.$private->id.'/biblioteca/publicaciones', ['q' => ['invalid']])->assertForbidden();
        $this->postJson('/api/departamentos/'.$private->id.'/publicaciones', [])->assertForbidden();
        Sanctum::actingAs($this->user('ADMIN_OBSERVATORIO'));
        $this->query('/api/departamentos/'.$this->department->id.'/biblioteca/publicaciones', ['q' => ['invalid']])->assertForbidden();
        $this->app['auth']->forgetGuards();
        $this->postJson('/api/atlas/categorias', [])->assertUnauthorized();
        $this->getJson('/api/publico/atlas/directorio')->assertOk();
    }

    public function test_configuration_input_and_route_uuids_fail_before_writes_or_database_uuid_casts(): void
    {
        foreach ([["invalid"], "https://example.test/A\0B", 'javascript:alert(1)'] as $url) {
            $this->putJson('/api/admin/configuracion', ['visor_geografico_url' => $url])
                ->assertUnprocessable()->assertJsonValidationErrors('visor_geografico_url');
        }
        $this->assertDatabaseCount('site_settings', 0);
        foreach (['/api/publico/departamentos/not-a-uuid', '/api/publico/departamentos/not-a-uuid/atlas',
            '/api/departamentos/not-a-uuid/biblioteca/publicaciones',
            '/api/departamentos/publicaciones/not-a-uuid/download'] as $url) $this->getJson($url)->assertNotFound();
        $this->postJson('/api/departamentos/not-a-uuid/publicaciones', [])->assertNotFound();
        $this->patchJson('/api/departamentos/publicaciones/not-a-uuid', [])->assertNotFound();
        $this->putJson('/api/atlas/categorias/not-a-uuid', [])->assertNotFound();
        $this->postJson('/api/atlas/categorias/not-a-uuid/enlaces', [])->assertNotFound();
        $this->patchJson('/api/atlas/enlaces/not-a-uuid', [])->assertNotFound();
        $this->assertDatabaseCount('observatorio_publicaciones', 0);
    }
}
