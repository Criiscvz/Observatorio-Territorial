<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Infrastructure\Persistence\Eloquent\Models\CategoriaDatasetModel;
use App\Infrastructure\Persistence\Eloquent\Models\DatasetFuenteModel;
use App\Infrastructure\Persistence\Eloquent\Models\DatasetModel;
use App\Infrastructure\Persistence\Eloquent\Models\GraficoPredeterminadoModel;
use App\Infrastructure\Persistence\Eloquent\Models\VariableMetadatoModel;
use App\Models\Departamento;
use App\Models\User;
use App\Presentation\Http\Resources\Dataset\CategoriaDatasetResource;
use App\Presentation\Http\Resources\Dataset\DatasetFuenteResource;
use App\Presentation\Http\Resources\Dataset\GraficoPredeterminadoResource;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class DatasetResourceContractTest extends TestCase
{
    use RefreshDatabase;

    private User $owner;
    private CategoriaDatasetModel $category;
    private const CATEGORY_KEYS = ['id', 'nombre', 'codigo', 'descripcion', 'icono', 'color', 'orden', 'activo'];
    private const SOURCE_KEYS = ['id', 'dataset_id', 'titulo', 'url', 'descripcion', 'orden'];
    private const VARIABLE_KEYS = ['id', 'nombre_columna', 'nombre_original', 'tipo_dato'];
    private const CHART_KEYS = ['id', 'dataset_id', 'titulo', 'descripcion', 'analisis', 'tipo_grafico',
        'tipo_analisis', 'variable_x_id', 'variable_y_id', 'filtros', 'configuracion', 'orden', 'activo',
        'variable_x', 'variable_y'];

    protected function setUp(): void
    {
        parent::setUp();
        $this->owner = User::withoutEvents(fn () => User::factory()->create(['rol' => 'ADMIN', 'is_active' => true]));
        $this->category = CategoriaDatasetModel::create(['nombre' => 'Educación', 'codigo' => 'edu',
            'descripcion' => 'Categoría pública', 'icono' => 'school', 'color' => '#5343D9',
            'orden' => 2, 'activo' => true]);
        // Future/internal columns must not silently become part of these API contracts.
        foreach (['categorias_dataset', 'datasets', 'departamentos', 'variables_metadatos',
            'dataset_fuentes', 'graficos_predeterminados'] as $table) {
            Schema::table($table, fn (Blueprint $blueprint) =>
                $blueprint->string('internal_contract_probe')->default('not-for-api'));
        }
    }

    private function dataset(bool $public = true, string $state = 'COMPLETADO'): DatasetModel
    {
        $department = Departamento::create(['nombre' => 'Observatorio', 'codigo_interno' => (string) Str::uuid(),
            'publico' => $public, 'icono' => 'school']);

        return DatasetModel::create(['departamento_id' => $department->id, 'categoria_id' => $this->category->id,
            'subido_por' => $this->owner->id, 'nombre' => 'Datos de educación', 'nombre_archivo' => 'private/original.xlsx',
            'descripcion' => 'Resumen', 'enlace_fuente' => 'https://example.test/data',
            'estado' => $state, 'opciones' => ['internal' => 'private-options'], 'total_registros' => 7,
            'fecha_carga' => '2026-11-13 09:00:00']);
    }

    private function variable(DatasetModel $dataset, bool $visible = true): VariableMetadatoModel
    {
        return VariableMetadatoModel::create(['dataset_id' => $dataset->id, 'nombre_columna' => 'v_'.Str::random(8),
            'nombre_original' => 'Variable', 'tipo_dato' => 'CATEGORICO', 'tipo_detectado' => 'TEXTO',
            'es_visible' => $visible, 'orden' => 1, 'opciones' => ['private-metadata']]);
    }

    private function source(DatasetModel $dataset, int $order = 1): DatasetFuenteModel
    {
        return DatasetFuenteModel::create(['dataset_id' => $dataset->id, 'titulo' => 'Fuente',
            'url' => 'https://example.test/source', 'descripcion' => 'Referencia', 'orden' => $order]);
    }

    private function chart(DatasetModel $dataset, ?VariableMetadatoModel $x = null, array $extra = []): GraficoPredeterminadoModel
    {
        return GraficoPredeterminadoModel::create(['dataset_id' => $dataset->id, 'titulo' => 'Gráfico',
            'descripcion' => 'Descripción', 'analisis' => 'Nota editorial', 'tipo_grafico' => 'bar',
            'tipo_analisis' => 'univariable', 'variable_x_id' => ($x ?? $this->variable($dataset))->id,
            'variable_y_id' => null, 'creado_por' => $this->owner->id, 'activo' => true, 'orden' => 1,
            'filtros' => [['column' => 'grupo', 'operator' => 'eq', 'value' => 'A']],
            'configuracion' => ['legend' => true], ...$extra]);
    }

    private function onlyKeys(array $actual, array $expected): void
    {
        $keys = array_keys($actual);
        sort($keys);
        sort($expected);
        self::assertSame($expected, $keys);
    }

    private function assign(User $user, DatasetModel $dataset): void
    {
        $user->departamentos()->attach($dataset->departamento_id,
            ['id' => (string) Str::uuid(), 'rol' => 'EDITOR']);
    }

    private function readBoth(DatasetModel $dataset, int $status): void
    {
        foreach (['fuentes', 'graficos-predeterminados'] as $resource) {
            $response = $this->getJson('/api/datasets/'.$dataset->id.'/'.$resource)->assertStatus($status);
            if ($status === 404) $response->assertExactJson(['message' => 'Dataset no encontrado.']);
        }
    }

    public function test_category_list_and_detail_are_explicit_unwrapped_contracts(): void
    {
        CategoriaDatasetModel::create(['nombre' => 'Inactiva', 'codigo' => 'inactive', 'activo' => false]);
        $rows = $this->getJson('/api/categorias')->assertOk()->assertJsonCount(1)->json();
        $this->onlyKeys($rows[0], self::CATEGORY_KEYS);
        self::assertSame($this->category->id, $rows[0]['id']);
        self::assertSame(true, $rows[0]['activo']);
        self::assertSame(2, $rows[0]['orden']);
        $this->getJson('/api/categorias/edu')->assertOk()->assertExactJson($rows[0]);
        foreach (['inactive', 'missing'] as $code) {
            $this->getJson('/api/categorias/'.$code)->assertNotFound();
            $this->getJson('/api/categorias/'.$code.'/datasets')->assertNotFound();
        }
    }

    public function test_category_dataset_envelope_contains_only_public_complete_live_summaries(): void
    {
        $visible = $this->dataset();
        $variable = $this->variable($visible);
        $this->variable($visible, false);
        $this->dataset(false);
        $this->dataset(true, 'PENDIENTE');
        $this->dataset()->delete();
        $deletedParent = $this->dataset();
        Departamento::findOrFail($deletedParent->departamento_id)->delete();

        $response = $this->getJson('/api/categorias/edu/datasets')->assertOk()
            ->assertJsonCount(1, 'datasets')->assertJsonPath('datasets.0.id', $visible->id)
            ->assertJsonCount(1, 'datasets.0.variables_metadatos')->json();
        $this->onlyKeys($response, ['categoria', 'datasets']);
        $this->onlyKeys($response['categoria'], self::CATEGORY_KEYS);
        $row = $response['datasets'][0];
        $this->onlyKeys($row, ['id', 'departamento_id', 'categoria_id', 'nombre', 'descripcion',
            'enlace_fuente', 'estado', 'total_registros', 'fecha_carga', 'created_at',
            'departamento', 'variables_metadatos']);
        $this->onlyKeys($row['departamento'], ['id', 'nombre', 'icono']);
        $this->onlyKeys($row['variables_metadatos'][0], self::VARIABLE_KEYS);
        self::assertSame($variable->id, $row['variables_metadatos'][0]['id']);
        self::assertSame(7, $row['total_registros']);
        self::assertNotNull($row['created_at']); // The public card's displayed date is retained.
        self::assertStringNotContainsString('not-for-api', json_encode($response));
        self::assertStringNotContainsString('private/', json_encode($response));
        self::assertStringNotContainsString('private-metadata', json_encode($response));
    }

    public function test_empty_category_retains_the_envelope_and_public_empty_lists_are_arrays(): void
    {
        $this->getJson('/api/categorias/edu/datasets')->assertOk()->assertJsonPath('datasets', []);
        $dataset = $this->dataset();
        $this->getJson('/api/datasets/'.$dataset->id.'/fuentes')->assertOk()->assertExactJson([]);
        $this->getJson('/api/datasets/'.$dataset->id.'/graficos-predeterminados')->assertOk()->assertExactJson([]);
    }

    public function test_source_list_retains_order_types_and_content_without_internal_metadata(): void
    {
        $dataset = $this->dataset();
        $last = $this->source($dataset, 9);
        $first = $this->source($dataset, 1);
        $rows = $this->getJson('/api/datasets/'.$dataset->id.'/fuentes')->assertOk()->assertJsonCount(2)->json();
        self::assertSame([$first->id, $last->id], array_column($rows, 'id'));
        $this->onlyKeys($rows[0], self::SOURCE_KEYS);
        self::assertSame(1, $rows[0]['orden']);
        self::assertSame('https://example.test/source', $rows[0]['url']);
    }

    public function test_public_charts_only_reference_visible_variables_from_the_same_dataset(): void
    {
        $dataset = $this->dataset();
        $good = $this->chart($dataset);
        $hidden = $this->variable($dataset, false);
        $this->chart($dataset, $hidden);
        $this->chart($dataset, extra: ['variable_y_id' => $hidden->id]);
        $foreign = $this->variable($this->dataset(false));
        $this->chart($dataset, $foreign);
        $this->chart($dataset, extra: ['variable_y_id' => $foreign->id]);
        $this->chart($dataset, extra: ['activo' => false]);
        $row = $this->getJson('/api/datasets/'.$dataset->id.'/graficos-predeterminados')->assertOk()
            ->assertJsonCount(1)->assertJsonPath('0.id', $good->id)->json()[0];
        $this->onlyKeys($row, self::CHART_KEYS);
        $this->onlyKeys($row['variable_x'], self::VARIABLE_KEYS);
        self::assertNull($row['variable_y']);
        self::assertTrue($row['activo']);
        self::assertSame([['column' => 'grupo', 'operator' => 'eq', 'value' => 'A']], $row['filtros']);
        self::assertSame(['legend' => true], $row['configuracion']);
    }

    public static function rolesWithoutPrivateRead(): array
    {
        return [['USER'], ['SUBSCRIBER'], ['EDITOR'], ['ADMIN_OBSERVATORIO']];
    }

    #[DataProvider('rolesWithoutPrivateRead')]
    public function test_other_roles_and_unassigned_editors_cannot_read_private_dataset_resources(string $role): void
    {
        $dataset = $this->dataset(false);
        $this->source($dataset);
        $this->chart($dataset);
        $user = User::withoutEvents(fn () => User::factory()->create(['rol' => $role]));
        Sanctum::actingAs($user);
        $this->readBoth($dataset, 404);
    }

    public function test_anonymous_reads_deny_private_incomplete_deleted_and_unknown_parents(): void
    {
        foreach ([$this->dataset(false), $this->dataset(true, 'PROCESANDO')] as $dataset) {
            $this->source($dataset);
            $this->chart($dataset);
            $this->readBoth($dataset, 404);
        }
        $deleted = $this->dataset();
        $deleted->delete();
        $this->readBoth($deleted, 404);
        $parent = $this->dataset();
        Departamento::findOrFail($parent->departamento_id)->delete();
        $this->readBoth($parent, 404);
        $this->readBoth((new DatasetModel)->forceFill(['id' => (string) Str::uuid()]), 404);
    }

    public function test_admin_and_assigned_editor_keep_private_reads_but_revocation_is_immediate(): void
    {
        $dataset = $this->dataset(false, 'PENDIENTE');
        $this->source($dataset);
        $this->chart($dataset, $this->variable($dataset, false));
        Sanctum::actingAs($this->owner);
        $this->readBoth($dataset, 200);
        $editor = User::withoutEvents(fn () => User::factory()->create(['rol' => 'EDITOR']));
        $this->assign($editor, $dataset);
        Sanctum::actingAs($editor);
        $this->readBoth($dataset, 200);
        $this->getJson('/api/datasets/'.$dataset->id.'/graficos-predeterminados')->assertJsonCount(1);
        $editor->departamentos()->detach($dataset->departamento_id);
        $this->readBoth($dataset, 404);
    }

    public function test_inactive_admin_and_deleted_parent_do_not_authorize_private_reads(): void
    {
        $dataset = $this->dataset(false);
        $this->owner->is_active = false;
        Sanctum::actingAs($this->owner);
        $this->readBoth($dataset, 401); // The global active-account middleware runs before the controller.
        $this->owner->is_active = true;
        Sanctum::actingAs($this->owner);
        Departamento::findOrFail($dataset->departamento_id)->delete();
        $this->readBoth($dataset, 404);
    }

    public function test_source_create_update_and_delete_preserve_statuses_and_explicit_fields(): void
    {
        $dataset = $this->dataset(false);
        Sanctum::actingAs($this->owner);
        $row = $this->postJson('/api/datasets/'.$dataset->id.'/fuentes', ['titulo' => 'Nueva fuente',
            'url' => 'example.test/path', 'dataset_id' => (string) Str::uuid(),
            'internal_contract_probe' => 'injected'])->assertCreated()->json();
        $this->onlyKeys($row, self::SOURCE_KEYS);
        self::assertSame($dataset->id, $row['dataset_id']);
        self::assertSame('https://example.test/path', $row['url']);
        $updated = $this->putJson('/api/fuentes/'.$row['id'], ['titulo' => 'Actualizada'])
            ->assertOk()->assertJsonPath('titulo', 'Actualizada')->json();
        $this->onlyKeys($updated, self::SOURCE_KEYS);
        $this->deleteJson('/api/fuentes/'.$row['id'])->assertOk();
        $this->putJson('/api/fuentes/'.$row['id'], ['titulo' => 'Ausente'])->assertNotFound();
    }

    public function test_chart_mutations_preserve_contract_and_server_owned_dataset_and_creator(): void
    {
        $dataset = $this->dataset(false);
        $editor = User::withoutEvents(fn () => User::factory()->create(['rol' => 'EDITOR']));
        $this->assign($editor, $dataset);
        Sanctum::actingAs($editor);
        $variable = $this->variable($dataset);
        $row = $this->postJson('/api/datasets/'.$dataset->id.'/graficos-predeterminados', [
            'titulo' => 'Nuevo gráfico', 'tipo_grafico' => 'bar', 'tipo_analisis' => 'univariable',
            'variable_x_id' => $variable->id, 'creado_por' => $this->owner->id,
            'dataset_id' => (string) Str::uuid(), 'internal_contract_probe' => 'injected',
        ])->assertCreated()->json();
        $this->onlyKeys($row, self::CHART_KEYS);
        $this->onlyKeys($row['variable_x'], self::VARIABLE_KEYS);
        self::assertSame($dataset->id, $row['dataset_id']);
        $this->assertDatabaseHas('graficos_predeterminados', ['id' => $row['id'],
            'creado_por' => $editor->id, 'internal_contract_probe' => 'not-for-api']);
        $updated = $this->putJson('/api/graficos-predeterminados/'.$row['id'],
            ['titulo' => 'Actualizado', 'variable_y_id' => $variable->id])->assertOk()->json();
        $this->onlyKeys($updated, self::CHART_KEYS);
        $this->onlyKeys($updated['variable_y'], self::VARIABLE_KEYS);
        $this->deleteJson('/api/graficos-predeterminados/'.$row['id'])->assertOk();
        $this->putJson('/api/graficos-predeterminados/'.$row['id'], ['titulo' => 'Ausente'])->assertNotFound();
    }

    public function test_source_url_validation_returns_422_for_non_strings_and_unsafe_schemes_without_writing(): void
    {
        $dataset = $this->dataset(false);
        $source = $this->source($dataset);
        Sanctum::actingAs($this->owner);
        foreach ([['unexpected'], 42, true, 'javascript:alert(1)', 'ftp://example.test/file'] as $url) {
            $this->postJson('/api/datasets/'.$dataset->id.'/fuentes', ['titulo' => 'Invalid', 'url' => $url])
                ->assertUnprocessable()->assertJsonValidationErrors('url');
            $this->putJson('/api/fuentes/'.$source->id, ['url' => $url])
                ->assertUnprocessable()->assertJsonValidationErrors('url');
        }
        $this->assertDatabaseCount('dataset_fuentes', 1);
        $this->assertDatabaseHas('dataset_fuentes', ['id' => $source->id, 'url' => 'https://example.test/source']);
    }

    public function test_loaded_unrelated_relations_and_extra_attributes_do_not_change_resource_contracts(): void
    {
        $dataset = $this->dataset();
        $source = $this->source($dataset)->refresh();
        $chart = $this->chart($dataset)->refresh()->load(['variableX', 'variableY']);
        foreach ([[$this->category->refresh(), CategoriaDatasetResource::class, self::CATEGORY_KEYS],
            [$source, DatasetFuenteResource::class, self::SOURCE_KEYS],
            [$chart, GraficoPredeterminadoResource::class, self::CHART_KEYS]] as [$model, $resource, $keys]) {
            $model->setRelation('private_owner', $this->owner);
            $model->setAttribute('future_secret_column', 'must-not-leak');
            $array = (new $resource($model))->resolve(request());
            $this->onlyKeys($array, $keys);
            self::assertStringNotContainsString('must-not-leak', json_encode($array));
            self::assertStringNotContainsString($this->owner->email, json_encode($array));
        }
    }
}
