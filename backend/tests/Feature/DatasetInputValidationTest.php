<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Infrastructure\Persistence\Eloquent\Models\DatasetFuenteModel;
use App\Infrastructure\Persistence\Eloquent\Models\DatasetModel;
use App\Infrastructure\Persistence\Eloquent\Models\GraficoPredeterminadoModel;
use App\Infrastructure\Persistence\Eloquent\Models\VariableMetadatoModel;
use App\Models\Departamento;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class DatasetInputValidationTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;
    private DatasetModel $dataset;
    private VariableMetadatoModel $x;

    protected function setUp(): void
    {
        parent::setUp();
        $this->admin = User::withoutEvents(fn () => User::factory()->create(['rol' => 'ADMIN']));
        $this->dataset = $this->makeDataset();
        $this->x = $this->makeVariable($this->dataset);
        Sanctum::actingAs($this->admin);
    }

    private function makeDataset(): DatasetModel
    {
        $department = Departamento::create(['nombre' => 'Observatorio de prueba',
            'codigo_interno' => (string) Str::uuid(), 'publico' => false]);

        return DatasetModel::create(['nombre' => 'Dataset de prueba', 'departamento_id' => $department->id,
            'subido_por' => $this->admin->id, 'nombre_archivo' => 'synthetic.xlsx', 'estado' => 'COMPLETADO']);
    }

    private function makeVariable(DatasetModel $dataset): VariableMetadatoModel
    {
        return VariableMetadatoModel::create(['dataset_id' => $dataset->id,
            'nombre_columna' => 'v_'.Str::random(8), 'nombre_original' => 'Variable de prueba',
            'tipo_dato' => 'CATEGORICO', 'es_visible' => true]);
    }

    private function sourcePayload(): array
    {
        return ['titulo' => 'Referencia', 'url' => 'https://example.test/source'];
    }

    private function chartPayload(): array
    {
        return ['titulo' => 'Gráfico', 'tipo_grafico' => 'bar', 'tipo_analisis' => 'univariable',
            'variable_x_id' => $this->x->id];
    }

    private function chart(): GraficoPredeterminadoModel
    {
        return GraficoPredeterminadoModel::create([...$this->chartPayload(),
            'dataset_id' => $this->dataset->id, 'creado_por' => $this->admin->id, 'orden' => 4]);
    }

    public static function invalidSources(): array
    {
        return [
            'title null' => ['titulo', null], 'title blank' => ['titulo', ' '],
            'title array' => ['titulo', ['invalid']], 'title max' => ['titulo', str_repeat('é', 256)],
            'title zero byte' => ['titulo', "text\0text"],
            'URL null' => ['url', null], 'URL array' => ['url', ['invalid']],
            'URL javascript' => ['url', 'javascript:alert(1)'], 'URL ftp' => ['url', 'ftp://example.test/file'],
            'URL over column limit' => ['url', 'https://example.test/'.str_repeat('x', 236)],
            'normalized URL over limit' => ['url', 'example.test/'.str_repeat('x', 235)],
            'description max' => ['descripcion', str_repeat('x', 501)],
            'description zero byte' => ['descripcion', "text\0text"],
            'order null' => ['orden', null], 'order negative' => ['orden', -1],
            'order too large' => ['orden', 2147483648], 'order fraction' => ['orden', 1.5],
            'order array' => ['orden', ['invalid']],
        ];
    }

    #[DataProvider('invalidSources')]
    public function test_invalid_source_inputs_return_422_without_any_write(string $field, mixed $value): void
    {
        $source = DatasetFuenteModel::create([...$this->sourcePayload(), 'dataset_id' => $this->dataset->id, 'orden' => 4]);
        $before = $source->refresh()->getRawOriginal();
        foreach ([['post', '/api/datasets/'.$this->dataset->id.'/fuentes', [...$this->sourcePayload(), $field => $value]],
            ['put', '/api/fuentes/'.$source->id, [$field => $value]]] as [$method, $url, $data]) {
            $this->json($method, $url, $data)->assertUnprocessable()->assertJsonValidationErrors($field)
                ->assertJsonPath('message', 'Datos de validación inválidos');
        }
        $this->assertDatabaseCount('dataset_fuentes', 1);
        self::assertSame($before, $source->refresh()->getRawOriginal());
    }

    public function test_source_boundaries_normalization_defaults_and_partial_updates_persist(): void
    {
        $url = 'https://example.test/'.str_repeat('x', 234);
        self::assertSame(255, strlen($url));
        $row = $this->postJson('/api/datasets/'.$this->dataset->id.'/fuentes', [
            'titulo' => str_repeat('é', 255), 'url' => substr($url, 8),
            'descripcion' => str_repeat('d', 500), 'orden' => 2147483647,
            'dataset_id' => (string) Str::uuid(), 'id' => (string) Str::uuid(),
        ])->assertCreated()->assertJsonPath('url', $url)->assertJsonPath('orden', 2147483647)->json();
        $this->assertDatabaseHas('dataset_fuentes', ['id' => $row['id'], 'url' => $url,
            'dataset_id' => $this->dataset->id]);
        $this->putJson('/api/fuentes/'.$row['id'], ['descripcion' => null])->assertOk()
            ->assertJsonPath('descripcion', null)->assertJsonPath('url', $url)
            ->assertJsonPath('orden', 2147483647);
        $default = $this->postJson('/api/datasets/'.$this->dataset->id.'/fuentes', $this->sourcePayload())
            ->assertCreated()->json();
        self::assertSame(0, DatasetFuenteModel::findOrFail($default['id'])->orden);
        foreach (['example.test:8443/path' => 'https://example.test:8443/path',
            '//example.test/source' => 'https://example.test/source',
            'HTTP://example.test/source' => 'HTTP://example.test/source'] as $input => $normalized) {
            $this->putJson('/api/fuentes/'.$row['id'], ['url' => $input])->assertOk()->assertJsonPath('url', $normalized);
        }
    }

    public static function invalidCharts(): array
    {
        return [
            'title max' => ['titulo', str_repeat('é', 256)], 'title null' => ['titulo', null],
            'title zero byte' => ['titulo', "text\0text"],
            'description max' => ['descripcion', str_repeat('x', 1001)],
            'analysis max' => ['analisis', str_repeat('x', 5001)],
            'chart type max' => ['tipo_grafico', str_repeat('x', 51)],
            'chart type array' => ['tipo_grafico', ['bar']], 'analysis invalid' => ['tipo_analisis', 'invalid'],
            'X null' => ['variable_x_id', null], 'X invalid UUID' => ['variable_x_id', 'invalid'],
            'Y invalid UUID' => ['variable_y_id', 'invalid'],
            'order null' => ['orden', null], 'order max' => ['orden', 2147483648],
            'active null' => ['activo', null], 'active string' => ['activo', 'yes'],
            'filter string' => ['filtros', 'invalid'],
            'filter map' => ['filtros', ['operator' => 'eq']],
            'filter count' => ['filtros', array_fill(0, 21, [])],
            'config scalar' => ['configuracion', 'invalid'],
            'config list' => ['configuracion', ['red', 'blue']],
            'config string limit' => ['configuracion', ['label' => str_repeat('x', 2049)]],
            'config depth' => ['configuracion', ['a' => ['b' => ['c' => ['d' => ['e' => ['f' => 1]]]]]]],
            'config node limit' => ['configuracion', array_fill_keys(range('a', 'f'), array_fill(0, 100, 1))],
            'config byte limit' => ['configuracion', array_fill_keys(range('a', 'z'), str_repeat('x', 2000))],
            'config zero byte' => ['configuracion', ['label' => "text\0text"]],
            'config key zero byte' => ['configuracion', ["k\0ey" => 'text']],
        ];
    }

    #[DataProvider('invalidCharts')]
    public function test_invalid_chart_inputs_return_422_without_any_write(string $field, mixed $value): void
    {
        $chart = $this->chart();
        $before = $chart->refresh()->getRawOriginal();
        foreach ([['post', '/api/datasets/'.$this->dataset->id.'/graficos-predeterminados', [...$this->chartPayload(), $field => $value]],
            ['put', '/api/graficos-predeterminados/'.$chart->id, [$field => $value]]] as [$method, $url, $data]) {
            $this->json($method, $url, $data)->assertUnprocessable()->assertJsonValidationErrors($field)
                ->assertJsonPath('message', 'Datos de validación inválidos');
        }
        $this->assertDatabaseCount('graficos_predeterminados', 1);
        self::assertSame($before, $chart->refresh()->getRawOriginal());
    }

    public function test_chart_valid_json_boundaries_and_partial_update_preserve_server_owned_values(): void
    {
        $config = ['legend' => true, 'colors' => ['#ff0000', '#0000ff'], 'axis' => ['label' => 'Año']];
        $filter = ['column' => $this->x->nombre_columna, 'operator' => 'in', 'value' => ['A', 'B'], 'type' => 'CATEGORICO'];
        $row = $this->postJson('/api/datasets/'.$this->dataset->id.'/graficos-predeterminados', [
            ...$this->chartPayload(), 'titulo' => str_repeat('é', 255), 'descripcion' => str_repeat('d', 1000),
            'analisis' => str_repeat('n', 5000), 'tipo_grafico' => str_repeat('c', 50),
            'filtros' => [$filter], 'configuracion' => $config, 'orden' => 2147483647,
            'creado_por' => 99999, 'dataset_id' => (string) Str::uuid(), 'activo' => false,
        ])->assertCreated()->assertJson(['filtros' => [$filter], 'configuracion' => $config])
            ->assertJsonPath('activo', true)->json();
        $this->assertDatabaseHas('graficos_predeterminados', ['id' => $row['id'], 'creado_por' => $this->admin->id,
            'dataset_id' => $this->dataset->id, 'orden' => 2147483647]);
        $this->putJson('/api/graficos-predeterminados/'.$row['id'], ['titulo' => 'Solo el título',
            'dataset_id' => (string) Str::uuid(), 'creado_por' => 99999])->assertOk()
            ->assertJson(['filtros' => [$filter], 'configuracion' => $config])
            ->assertJsonPath('orden', 2147483647);
        $this->putJson('/api/graficos-predeterminados/'.$row['id'], ['filtros' => null, 'configuracion' => null,
            'descripcion' => null, 'analisis' => null, 'activo' => false])->assertOk()
            ->assertJsonPath('filtros', null)->assertJsonPath('configuracion', null)->assertJsonPath('activo', false);
    }

    public function test_variables_and_filter_columns_must_belong_to_authorized_dataset(): void
    {
        $foreign = $this->makeVariable($this->makeDataset());
        $chart = $this->chart();
        foreach (['variable_x_id', 'variable_y_id'] as $field) {
            foreach ([$foreign->id, (string) Str::uuid()] as $id) {
                $this->postJson('/api/datasets/'.$this->dataset->id.'/graficos-predeterminados',
                    [...$this->chartPayload(), $field => $id])->assertUnprocessable()->assertJsonValidationErrors($field);
                $this->putJson('/api/graficos-predeterminados/'.$chart->id, [$field => $id])
                    ->assertUnprocessable()->assertJsonValidationErrors($field);
            }
        }
        $filter = ['column' => $foreign->nombre_columna, 'operator' => 'eq', 'value' => 'A'];
        $this->putJson('/api/graficos-predeterminados/'.$chart->id, ['filtros' => [$filter]])
            ->assertUnprocessable()->assertJsonValidationErrors('filtros.0.column');
        $this->assertDatabaseCount('graficos_predeterminados', 1);
        self::assertSame($this->x->id, $chart->refresh()->variable_x_id);
    }

    public function test_effective_bivariable_state_requires_y_and_explicit_null_clears_it_for_univariable(): void
    {
        $y = $this->makeVariable($this->dataset);
        $chart = $this->chart();
        $this->postJson('/api/datasets/'.$this->dataset->id.'/graficos-predeterminados',
            [...$this->chartPayload(), 'tipo_analisis' => 'bivariable'])
            ->assertUnprocessable()->assertJsonValidationErrors('variable_y_id');
        $this->putJson('/api/graficos-predeterminados/'.$chart->id, ['tipo_analisis' => 'bivariable'])
            ->assertUnprocessable()->assertJsonValidationErrors('variable_y_id');
        $this->putJson('/api/graficos-predeterminados/'.$chart->id,
            ['tipo_analisis' => 'bivariable', 'variable_y_id' => $y->id])->assertOk();
        $this->putJson('/api/graficos-predeterminados/'.$chart->id, ['variable_y_id' => null])
            ->assertUnprocessable()->assertJsonValidationErrors('variable_y_id');
        $this->putJson('/api/graficos-predeterminados/'.$chart->id, ['titulo' => 'Conserva Y'])
            ->assertOk()->assertJsonPath('variable_y_id', $y->id);
        $this->putJson('/api/graficos-predeterminados/'.$chart->id,
            ['tipo_analisis' => 'univariable', 'variable_y_id' => null])->assertOk()->assertJsonPath('variable_y_id', null);
        self::assertNull($chart->refresh()->variable_y_id);
    }

    public function test_filter_operator_value_contracts_reject_nested_or_mismatched_values(): void
    {
        $chart = $this->chart();
        $base = ['column' => $this->x->nombre_columna, 'operator' => 'eq', 'value' => 'A'];
        foreach ([['operator' => 'sql'], ['operator' => ['eq']], ['column' => ['invalid']],
            ['extra' => 'injected'], ['value' => ['nested' => ['data']]], ['operator' => 'in', 'value' => 'A'],
            ['operator' => 'in', 'value' => []], ['operator' => 'in', 'value' => [null]],
            ['operator' => 'between', 'value' => [1]], ['operator' => 'between', 'value' => [1, 2, 3]],
            ['operator' => 'contains', 'value' => false], ['operator' => 'gt', 'value' => null],
            ['value' => str_repeat('x', 513)], ['type' => 'invalid']] as $invalid) {
            $this->putJson('/api/graficos-predeterminados/'.$chart->id, ['filtros' => [[...$base, ...$invalid]]])
                ->assertUnprocessable();
        }
        $this->putJson('/api/graficos-predeterminados/'.$chart->id, ['filtros' => [array_diff_key($base, ['value' => true])]])
            ->assertUnprocessable()->assertJsonValidationErrors('filtros.0.value');
        foreach ([['operator' => 'eq', 'value' => null], ['operator' => 'neq', 'value' => false],
            ['operator' => 'between', 'value' => [1, 2]], ['operator' => 'contains', 'value' => 'A'],
            ['operator' => 'not_in', 'value' => ['A']], ['operator' => 'gte', 'value' => 0]] as $valid) {
            $this->putJson('/api/graficos-predeterminados/'.$chart->id, ['filtros' => [[...$base, ...$valid]]])->assertOk();
        }
    }

    public function test_oversized_filter_lists_are_rejected_before_expanding_variable_queries(): void
    {
        $chart = $this->chart();
        $filter = ['column' => $this->x->nombre_columna, 'operator' => 'eq', 'value' => 'A'];
        DB::enableQueryLog();
        try {
            $this->putJson('/api/graficos-predeterminados/'.$chart->id, ['filtros' => array_fill(0, 500, $filter)])
                ->assertUnprocessable()->assertJsonValidationErrors('filtros');
            self::assertSame([], array_values(array_filter(DB::getQueryLog(),
                fn (array $query): bool => str_contains($query['query'], 'variables_metadatos'))));
        } finally {
            DB::disableQueryLog();
        }
        self::assertNull($chart->refresh()->filtros);
    }

    public static function deniedRoles(): array
    {
        return [['USER'], ['SUBSCRIBER'], ['ADMIN_OBSERVATORIO'], ['EDITOR']];
    }

    #[DataProvider('deniedRoles')]
    public function test_authorization_precedes_validation_and_never_writes_outside_scope(string $role): void
    {
        $source = DatasetFuenteModel::create([...$this->sourcePayload(), 'dataset_id' => $this->dataset->id]);
        $chart = $this->chart();
        $user = User::withoutEvents(fn () => User::factory()->create(['rol' => $role]));
        Sanctum::actingAs($user);
        foreach (['fuentes', 'graficos-predeterminados'] as $resource) {
            $this->postJson('/api/datasets/'.$this->dataset->id.'/'.$resource, [])->assertForbidden();
        }
        $this->putJson('/api/fuentes/'.$source->id, ['url' => []])->assertForbidden();
        $this->putJson('/api/graficos-predeterminados/'.$chart->id, ['variable_x_id' => []])->assertForbidden();
        $this->assertDatabaseCount('dataset_fuentes', 1);
        $this->assertDatabaseCount('graficos_predeterminados', 1);
    }

    public function test_assigned_editor_keeps_mutations_and_revocation_denies_even_invalid_payloads(): void
    {
        $editor = User::withoutEvents(fn () => User::factory()->create(['rol' => 'EDITOR']));
        $editor->departamentos()->attach($this->dataset->departamento_id,
            ['id' => (string) Str::uuid(), 'rol' => 'EDITOR']);
        Sanctum::actingAs($editor);
        $source = $this->postJson('/api/datasets/'.$this->dataset->id.'/fuentes', $this->sourcePayload())
            ->assertCreated()->json();
        $chart = $this->postJson('/api/datasets/'.$this->dataset->id.'/graficos-predeterminados', $this->chartPayload())
            ->assertCreated()->json();
        $editor->departamentos()->detach($this->dataset->departamento_id);
        $this->putJson('/api/fuentes/'.$source['id'], ['url' => []])->assertForbidden();
        $this->putJson('/api/graficos-predeterminados/'.$chart['id'], ['variable_x_id' => []])->assertForbidden();
    }

    public function test_malformed_route_ids_return_404_and_missing_parents_are_resolved_before_payload_validation(): void
    {
        foreach (['not-a-uuid', '123', str_repeat('a', 300)] as $id) {
            foreach (['fuentes', 'graficos-predeterminados'] as $resource) {
                $this->getJson('/api/datasets/'.$id.'/'.$resource)->assertNotFound();
                $this->postJson('/api/datasets/'.$id.'/'.$resource, [])->assertNotFound();
                $this->putJson('/api/'.$resource.'/'.$id, [])->assertNotFound();
                $this->deleteJson('/api/'.$resource.'/'.$id)->assertNotFound();
            }
        }
        $unknown = (string) Str::uuid();
        foreach (['fuentes', 'graficos-predeterminados'] as $resource) {
            $this->postJson('/api/datasets/'.$unknown.'/'.$resource, [])->assertNotFound();
            $this->putJson('/api/'.$resource.'/'.$unknown, [])->assertNotFound();
        }
        foreach (['', '/datasets'] as $suffix) {
            $this->getJson('/api/categorias/'.str_repeat('a', 256).$suffix)->assertNotFound();
            $this->getJson('/api/categorias/bad%00code'.$suffix)->assertNotFound();
        }
        $this->assertDatabaseCount('dataset_fuentes', 0);
        $this->assertDatabaseCount('graficos_predeterminados', 0);
    }

    public function test_mutation_authentication_and_active_account_checks_still_precede_payload_validation(): void
    {
        $source = DatasetFuenteModel::create([...$this->sourcePayload(), 'dataset_id' => $this->dataset->id]);
        $chart = $this->chart();
        $this->app['auth']->forgetGuards();
        foreach (['fuentes', 'graficos-predeterminados'] as $resource) {
            $this->postJson('/api/datasets/'.$this->dataset->id.'/'.$resource, [])->assertUnauthorized();
        }
        $this->putJson('/api/fuentes/'.$source->id, [])->assertUnauthorized();
        $this->putJson('/api/graficos-predeterminados/'.$chart->id, [])->assertUnauthorized();
        $this->admin->is_active = false;
        Sanctum::actingAs($this->admin);
        $this->putJson('/api/fuentes/'.$source->id, [])->assertUnauthorized();
        $this->putJson('/api/graficos-predeterminados/'.$chart->id, [])->assertUnauthorized();
        $this->assertDatabaseCount('dataset_fuentes', 1);
        $this->assertDatabaseCount('graficos_predeterminados', 1);
    }
}
