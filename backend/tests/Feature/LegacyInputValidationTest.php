<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Application\Publicaciones\LegacyPublicationRehearsal;
use App\Domain\Dataset\Repositories\RegistroDatoRepositoryInterface;
use App\Domain\Statistics\Services\StatisticsServiceInterface;
use App\Infrastructure\Persistence\Eloquent\Models\{ArticuloModel, DatasetModel, ReporteModel, VariableMetadatoModel};
use App\Models\{Departamento, Permiso, User};
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\{DB, Http, Storage};
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Mockery;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class LegacyInputValidationTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;
    private Departamento $department;
    private DatasetModel $dataset;
    private VariableMetadatoModel $variable;

    protected function setUp(): void
    {
        parent::setUp();
        config(['publications.legacy_rehearsal_enabled' => true, 'filesystems.default' => 'phase2-rehearsal']);
        Storage::fake('phase2-rehearsal');
        app(LegacyPublicationRehearsal::class)->prepare();
        $this->admin = $this->user('ADMIN');
        $this->department = $this->department();
        $this->assign($this->admin, $this->department);
        $this->dataset = DatasetModel::create(['departamento_id' => $this->department->id, 'subido_por' => $this->admin->id,
            'nombre' => 'Datos sintéticos', 'nombre_archivo' => 'synthetic.csv', 'estado' => 'COMPLETADO', 'total_registros' => 2,
            'opciones' => ['preserved' => 'synthetic']]);
        $this->variable = VariableMetadatoModel::create(['dataset_id' => $this->dataset->id, 'nombre_columna' => 'valor',
            'nombre_original' => 'Valor', 'tipo_dato' => 'NUMERICO', 'tipo_detectado' => 'NUMERICO', 'es_visible' => true, 'orden' => 1]);
        Sanctum::actingAs($this->admin);
        $this->app->instance(StatisticsServiceInterface::class, Mockery::mock(StatisticsServiceInterface::class));
        Http::preventStrayRequests();
    }

    private function user(string $role): User
    {
        return User::withoutEvents(fn () => User::factory()->create(['rol' => $role, 'is_active' => true]));
    }

    private function department(bool $public = true): Departamento
    {
        return Departamento::create(['nombre' => 'Ensayo APIs', 'codigo_interno' => (string) Str::uuid(), 'publico' => $public]);
    }

    private function assign(User $user, Departamento $department): void
    {
        $user->departamentos()->attach($department->id, ['id' => (string) Str::uuid(), 'rol' => $user->isAdmin() ? 'ADMIN' : 'EDITOR']);
    }

    private function snapshot(): array
    {
        $data = [];
        foreach (['datasets', 'variables_metadatos', 'articulos', 'reportes', 'observatorio_publicaciones', 'publication_origins', 'publicacion_contadores'] as $table) {
            $data[$table] = DB::table($table)->orderBy($table === 'publicacion_contadores' ? 'tipo' : 'id')->get()->toJson();
        }
        $data['files'] = Storage::allFiles();
        return $data;
    }

    private function originalArticle(): ArticuloModel
    {
        return ArticuloModel::create(['titulo' => 'Original sintético', 'estado' => 'PUBLICADO', 'departamento_id' => $this->department->id]);
    }

    private function originalReport(): ReporteModel
    {
        Storage::put('public/fichas/original.pdf', "%PDF-1.4\nSynthetic original\n%%EOF");
        return ReporteModel::create(['nombre_indicador' => 'Reporte original', 'departamento_id' => $this->department->id,
            'link_url' => 'https://example.test/report', 'ficha_indicador' => '/api/reportes/fichas/original.pdf']);
    }

    private function payload(string $source): array
    {
        return [($source === 'articulos' ? 'titulo' : 'nombre_indicador') => 'Publicación sintética',
            'departamento_id' => $this->department->id, 'fecha_publicacion' => '2026-11-15',
            ...($source === 'reportes' ? ['link_url' => 'https://example.test/report'] : [])];
    }

    public static function invalidPagination(): array
    {
        return [['page', 0], ['page', 1000001], ['page', ['bad']], ['per_page', 0], ['per_page', 101], ['per_page', ['bad']]];
    }

    #[DataProvider('invalidPagination')]
    public function test_data_pagination_is_validated_before_repository_access(string $field, mixed $value): void
    {
        $repo = Mockery::mock(RegistroDatoRepositoryInterface::class); $repo->shouldNotReceive('findByDatasetIdPaginated');
        $this->app->instance(RegistroDatoRepositoryInterface::class, $repo);
        foreach (['/api/datasets/', '/api/publico/datasets/'] as $prefix) {
            $this->getJson($prefix.$this->dataset->id.'/data?'.http_build_query([$field => $value]))
                ->assertUnprocessable()->assertJsonValidationErrors($field);
        }
    }

    public function test_dataset_directory_filters_and_fixed_page_size_reject_unsafe_queries(): void
    {
        foreach ([['departamento_id' => ['bad']], ['departamento_id' => "A\0B"], ['page' => 0],
            ['page' => 1000001], ['per_page' => 100], ['per_page' => ['bad']]] as $query) {
            $this->getJson('/api/datasets?'.http_build_query($query))->assertUnprocessable();
        }
        $response = $this->getJson('/api/datasets?departamento_id='.$this->department->id.'&page=1&per_page=15')
            ->assertOk()->assertJsonFragment(['id' => $this->dataset->id]);
        $this->assertTrue(array_is_list($response->json()));
    }

    public function test_public_and_private_data_keep_their_paginated_response_with_numeric_query_strings(): void
    {
        $repo = Mockery::mock(RegistroDatoRepositoryInterface::class);
        $repo->shouldReceive('findByDatasetIdPaginated')->twice()->withArgs(fn ($id, $size, $page = null) =>
            $id === $this->dataset->id && $size === 1 && ($page === null || $page === 2))
            ->andReturn(new LengthAwarePaginator([(object) ['id' => 'synthetic-row', 'data' => ['valor' => 2]]], 2, 1, 2));
        $this->app->instance(RegistroDatoRepositoryInterface::class, $repo);
        foreach (['/api/datasets/', '/api/publico/datasets/'] as $prefix) {
            $this->getJson($prefix.$this->dataset->id.'/data?page=2&per_page=1')->assertOk()
                ->assertJsonPath('pagination.current_page', 2)->assertJsonPath('pagination.per_page', 1)->assertJsonPath('data.0.data.valor', 2);
        }
    }

    public static function invalidDatasetChanges(): array
    {
        return [['nombre', "A\0B"], ['nombre', ['bad']], ['descripcion', str_repeat('a', 2001)],
            ['enlace_fuente', 'javascript:alert(1)'], ['enlace_fuente', 'https://example.test/'.str_repeat('x', 240)]];
    }

    #[DataProvider('invalidDatasetChanges')]
    public function test_invalid_dataset_updates_leave_sql_rows_unchanged(string $field, mixed $value): void
    {
        $before = $this->snapshot();
        $this->putJson('/api/datasets/'.$this->dataset->id, [$field => $value])->assertUnprocessable()->assertJsonValidationErrors($field);
        $this->assertSame($before, $this->snapshot());
    }

    public function test_bulk_and_single_variable_booleans_are_converted_only_after_validation(): void
    {
        $this->putJson('/api/variables/'.$this->variable->id, ['es_visible' => '0'])->assertOk()->assertJsonPath('es_visible', false);
        $this->postJson('/api/variables/bulk-update', ['variable_ids' => [$this->variable->id], 'es_visible' => '1'])
            ->assertOk()->assertJsonPath('updated', 1)->assertJsonPath('variables.0.es_visible', true);
        $before = $this->snapshot();
        foreach ([['variable_ids' => ['bad']], ['variable_ids' => [[$this->variable->id]]],
            ['variable_ids' => array_fill(0, 201, $this->variable->id)],
            ['variable_ids' => ['named' => $this->variable->id]],
            ['variable_ids' => [$this->variable->id], 'es_visible' => 'false']] as $bad) {
            $this->postJson('/api/variables/bulk-update', $bad)->assertUnprocessable();
            $this->assertSame($before, $this->snapshot());
        }
        $this->putJson('/api/variables/'.$this->variable->id, ['nombre_columna' => "A\0B"])->assertUnprocessable();
    }

    public static function invalidStopwords(): array
    {
        return [[[]], [[['bad']]], [[str_repeat('x', 101)]], [["A\0B"]], [array_fill(0, 1001, 'word')], [['named' => 'word']]];
    }

    #[DataProvider('invalidStopwords')]
    public function test_invalid_stopword_lists_do_not_replace_dataset_options(mixed $words): void
    {
        $before = $this->snapshot();
        $this->putJson('/api/stats/datasets/'.$this->dataset->id.'/stopwords', ['stopwords' => $words])->assertUnprocessable();
        $this->assertSame($before, $this->snapshot());
    }

    public function test_stopwords_keep_normalization_and_existing_options_and_require_current_assignment(): void
    {
        $this->putJson('/api/stats/datasets/'.$this->dataset->id.'/stopwords', ['stopwords' => [' Hola ', 'HOLA', 'de', 'a']])
            ->assertOk()->assertJsonPath('stopwords', ['hola', 'de'])->assertJsonPath('count', 2);
        $this->assertSame('synthetic', $this->dataset->fresh()->opciones['preserved']);
        $editor = $this->user('EDITOR'); $this->assign($editor, $this->department); Sanctum::actingAs($editor);
        $editor->departamentos()->detach(); $before = $this->snapshot();
        $this->putJson('/api/stats/datasets/'.$this->dataset->id.'/stopwords', ['stopwords' => ['other']])->assertForbidden();
        $this->assertSame($before, $this->snapshot());
    }

    public static function invalidFilters(): array
    {
        $row = ['column' => 'valor', 'operator' => 'eq', 'value' => 1];
        return [['not-array'], [['named' => $row]], [[null]], [array_fill(0, 51, $row)],
            [[['column' => ['bad'], 'operator' => 'eq', 'value' => 1]]],
            [[array_replace($row, ['column' => "A\0B"])]], [[array_replace($row, ['column' => str_repeat('x', 501)])]],
            [[array_replace($row, ['operator' => ['eq']])]], [[array_replace($row, ['operator' => 'where'])]],
            [[array_replace($row, ['value' => ['nested' => 'object']])]],
            [[array_replace($row, ['value' => "A\0B"])]], [[array_replace($row, ['value' => str_repeat('x', 2049)])]],
            [[array_replace($row, ['operator' => 'between', 'value' => [1]])]],
            [[array_replace($row, ['operator' => 'in', 'value' => 'not-a-list'])]],
            [[array_replace($row, ['operator' => 'in', 'value' => array_fill(0, 101, 'a')])]],
            [[array_replace($row, ['type' => ['NUMERICO']])]], [[array_replace($row, ['extra' => ['unknown']])]],
            [array_fill(0, 20, array_replace($row, ['value' => str_repeat('x', 2048)]))]];
    }

    #[DataProvider('invalidFilters')]
    public function test_all_retained_statistics_routes_reject_malformed_filters_before_mongo(mixed $filters): void
    {
        $payload = ['dataset_id' => $this->dataset->id, 'variable_id' => $this->variable->id,
            'variable_x_id' => $this->variable->id, 'variable_y_id' => $this->variable->id, 'filters' => $filters];
        foreach (['/api/stats', '/api/publico/stats'] as $prefix) {
            foreach (['univariable', 'bivariable', 'text-analysis'] as $action) {
                $this->postJson($prefix.'/'.$action, $payload)->assertUnprocessable()->assertJsonValidationErrors('filters');
            }
        }
    }

    public function test_stats_require_variable_ids_and_reject_invalid_limits_or_chart_types_without_provider_calls(): void
    {
        foreach (['/api/stats', '/api/publico/stats'] as $prefix) {
            foreach (['univariable', 'text-analysis'] as $action) {
                $this->postJson($prefix.'/'.$action, ['dataset_id' => $this->dataset->id])->assertUnprocessable()->assertJsonValidationErrors('variable_id');
            }
            foreach (['univariable', 'bivariable', 'text-analysis'] as $action) {
                foreach ([['limit' => ['bad']], ['limit' => 101], ['chart_type' => ['bad']]] as $bad) {
                    $this->postJson($prefix.'/'.$action, ['dataset_id' => $this->dataset->id, 'variable_id' => $this->variable->id,
                        'variable_x_id' => $this->variable->id, 'variable_y_id' => $this->variable->id, ...$bad])->assertUnprocessable();
                }
            }
        }
    }

    public function test_valid_statistics_filters_and_numeric_string_limit_reach_the_existing_service(): void
    {
        $filters = [['column' => '¿Año (estimado)?', 'operator' => 'in', 'value' => [2024, '2025'], 'type' => 'NUMERICO'],
            ['column' => 'valor', 'operator' => 'between', 'value' => [1, 9]]];
        $service = Mockery::mock(StatisticsServiceInterface::class);
        $service->shouldReceive('getNumericStats')->twice()->with($this->dataset->id, 'valor', 7, $filters)
            ->andReturn(['data' => ['labels' => ['synthetic'], 'values' => [2]], 'stats' => ['count' => 2]]);
        $service->shouldReceive('getScatterData')->once()->with($this->dataset->id, 'valor', 'valor', 7, $filters)
            ->andReturn(['data' => ['points' => [[1, 2]]], 'stats' => ['count' => 2]]);
        // The retained private scatter endpoint has always sampled at most 1000 points.
        $service->shouldReceive('getScatterData')->once()->with($this->dataset->id, 'valor', 'valor', 1000, $filters)
            ->andReturn(['data' => ['points' => [[1, 2]]], 'stats' => ['count' => 2]]);
        $this->app->instance(StatisticsServiceInterface::class, $service);
        foreach (['/api/stats/univariable', '/api/publico/stats/univariable'] as $url) {
            $this->postJson($url, ['dataset_id' => $this->dataset->id, 'variable_id' => $this->variable->id, 'limit' => '7', 'filters' => $filters])
                ->assertOk()->assertJsonPath('chart_type', 'histogram');
        }
        foreach (['/api/stats/bivariable', '/api/publico/stats/bivariable'] as $url) {
            $this->postJson($url, ['dataset_id' => $this->dataset->id, 'variable_x_id' => $this->variable->id,
                'variable_y_id' => $this->variable->id, 'limit' => '7', 'filters' => $filters])
                ->assertOk()->assertJsonPath('chart_type', 'scatter');
        }
    }

    public static function invalidPublicationFields(): array
    {
        return [['fuente', ['bad']], ['fuente', "A\0B"], ['autor', str_repeat('x', 256)], ['estado', ['PUBLICADO']],
            ['fecha_publicacion', '0000-01-01'], ['fecha_recepcion', ['bad']], ['categoria_id', ['bad']],
            ['visibilidad', ['publico']], ['enlace', ['bad']], ['observacion_revision', str_repeat('x', 2001)]];
    }

    #[DataProvider('invalidPublicationFields')]
    public function test_compatibility_creation_validates_before_rows_files_or_counters_change(string $field, mixed $value): void
    {
        $before = $this->snapshot();
        foreach (['articulos', 'reportes'] as $source) {
            $this->postJson('/api/'.$source, [...$this->payload($source), $field => $value])
                ->assertUnprocessable()->assertJsonValidationErrors($field);
            $this->assertSame($before, $this->snapshot());
        }
    }

    public function test_creation_cannot_choose_its_validation_source_or_submit_oversized_pdf_names(): void
    {
        $before = $this->snapshot();
        $this->postJson('/api/articulos', ['legacy_source' => 'reportes', 'nombre_indicador' => 'Wrong transport',
            'departamento_id' => $this->department->id, 'fecha_publicacion' => '2026-11-15'])->assertUnprocessable()->assertJsonValidationErrors('titulo');
        $this->postJson('/api/reportes', [...$this->payload('reportes'), 'ficha' =>
            UploadedFile::fake()->createWithContent(str_repeat('a', 256).'.pdf', "%PDF-1.4\nSynthetic\n%%EOF")])->assertUnprocessable();
        $this->assertSame($before, $this->snapshot());
    }

    public function test_converted_writes_keep_original_identity_and_reject_invalid_values_without_changing_origins(): void
    {
        foreach (['articulos', 'reportes'] as $source) {
            $id = $this->postJson('/api/'.$source, $this->payload($source))->assertCreated()->json('id');
            $before = $this->snapshot();
            foreach (['fuente' => "A\0B", 'estado' => ['PUBLICADO'], 'fecha_publicacion' => '0000-01-01'] as $field => $value) {
                $this->putJson('/api/'.$source.'/'.$id, [$field => $value])->assertUnprocessable()->assertJsonValidationErrors($field);
                $this->assertSame($before, $this->snapshot());
            }
            $title = $source === 'articulos' ? 'titulo' : 'nombre_indicador';
            $this->putJson('/api/'.$source.'/'.$id, [$title => 'Cambio compatible'])->assertOk()->assertJsonPath($title, 'Cambio compatible');
        }
        $this->assertDatabaseCount('articulos', 0); $this->assertDatabaseCount('reportes', 0);
        $this->assertDatabaseCount('publication_origins', 2);
    }

    public function test_original_article_and_report_updates_keep_error_contract_and_normalize_safe_report_urls(): void
    {
        $article = $this->originalArticle(); $report = $this->originalReport(); $before = $this->snapshot();
        foreach ([['/api/articulos/'.$article->id, ['descripcion' => "A\0B"]],
            ['/api/articulos/'.$article->id, ['enlace' => 'javascript:alert(1)']],
            ['/api/reportes/'.$report->id, ['link_url' => ['bad']]],
            ['/api/reportes/'.$report->id, ['link_url' => 'https://example.test/'.str_repeat('x', 240)]],
            ['/api/reportes/'.$report->id, ['ficha' => UploadedFile::fake()->createWithContent('unsafe.php', "%PDF-1.4\nSynthetic\n%%EOF")]]] as [$url, $payload]) {
            $this->putJson($url, $payload)->assertUnprocessable()->assertJsonPath('message', 'Datos de validación inválidos');
            $this->assertSame($before, $this->snapshot());
        }
        $this->putJson('/api/reportes/'.$report->id, ['link_url' => 'example.test/indicator'])->assertOk()
            ->assertJsonPath('link_url', 'https://example.test/indicator');
        $this->putJson('/api/articulos/'.$article->id, ['titulo' => 'Título vigente'])->assertOk()->assertJsonPath('titulo', 'Título vigente');
        $this->assertDatabaseCount('observatorio_publicaciones', 0);
    }

    public function test_original_report_destination_is_authorized_before_replacing_its_file(): void
    {
        $report = $this->originalReport(); $other = $this->department(false);
        $editor = $this->user('EDITOR'); $this->assign($editor, $this->department);
        Permiso::create(['user_id' => $editor->id, 'modulo' => 'reportes', 'nivel' => 'escritura', 'departamento_id' => null]);
        Sanctum::actingAs($editor); $before = $this->snapshot(); $oldBytes = Storage::get('public/fichas/original.pdf');
        $this->putJson('/api/reportes/'.$report->id, ['departamento_id' => $other->id,
            'ficha' => UploadedFile::fake()->createWithContent('new.pdf', "%PDF-1.4\nSynthetic replacement\n%%EOF")])->assertForbidden();
        $this->assertSame($before, $this->snapshot()); $this->assertSame($oldBytes, Storage::get('public/fichas/original.pdf'));
        $editor->departamentos()->detach();
        $this->putJson('/api/reportes/'.$report->id, ['link_url' => ['bad']])->assertForbidden();
    }

    public function test_legacy_catalog_filters_keep_the_array_response_and_reject_invalid_uuids(): void
    {
        foreach (['articulos', 'reportes'] as $source) {
            foreach (['departamento_id' => ['bad'], 'categoria_id' => "A\0B"] as $field => $value) {
                $this->getJson('/api/'.$source.'?'.http_build_query([$field => $value]))->assertUnprocessable();
            }
            $this->getJson('/api/'.$source.'?departamento_id='.$this->department->id)->assertOk()->assertExactJson([]);
        }
    }

    public function test_route_uuids_fail_before_queries_and_anonymous_management_stays_denied(): void
    {
        foreach (['/api/datasets/not-a-uuid', '/api/datasets/not-a-uuid/data',
            '/api/publico/datasets/not-a-uuid/data', '/api/stats/datasets/not-a-uuid/stopwords'] as $url) $this->getJson($url)->assertNotFound();
        $this->putJson('/api/variables/not-a-uuid', [])->assertNotFound();
        $this->postJson('/api/datasets/not-a-uuid/import', [])->assertNotFound();
        $this->app['auth']->forgetGuards();
        $this->putJson('/api/datasets/'.$this->dataset->id, ['nombre' => ['bad']])->assertUnauthorized();
        $this->postJson('/api/stats/univariable', [])->assertUnauthorized();
        $this->postJson('/api/variables/bulk-update', [])->assertUnauthorized();
    }
}
