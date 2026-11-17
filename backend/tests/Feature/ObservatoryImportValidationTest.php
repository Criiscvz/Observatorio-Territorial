<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Domain\Dataset\Repositories\RegistroDatoRepositoryInterface;
use App\Infrastructure\Persistence\Eloquent\Models\{DatasetModel, VariableMetadatoModel};
use App\Models\{Departamento, User};
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\{DB, Http, Storage};
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class ObservatoryImportValidationTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;
    private Departamento $department;
    private DatasetModel $dataset;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('local'); config(['filesystems.default' => 'local']);
        Http::preventStrayRequests();
        $this->admin = User::withoutEvents(fn () => User::factory()->create(['rol' => 'ADMIN']));
        $this->department = Departamento::create(['nombre' => 'Ensayo', 'codigo_interno' => 'synthetic', 'publico' => false]);
        $this->dataset = DatasetModel::create(['nombre' => 'Ensayo', 'nombre_archivo' => 'synthetic.csv',
            'departamento_id' => $this->department->id, 'subido_por' => $this->admin->id, 'estado' => 'PENDIENTE']);
        Storage::put('datasets/synthetic.csv', "Grupo,Valor\nCentro,2\nNorte,0\n");
        Sanctum::actingAs($this->admin);
    }

    private function column(array $changes = []): array
    {
        return array_replace(['nombre_columna' => 'grupo', 'nombre_original' => 'Grupo',
            'tipo_dato' => 'TEXTO', 'tipo_detectado' => 'TEXTO'], $changes);
    }

    private function snapshot(): array
    {
        return ['departamentos' => DB::table('departamentos')->orderBy('id')->get()->toJson(),
            'datasets' => DB::table('datasets')->orderBy('id')->get()->toJson(),
            'variables' => DB::table('variables_metadatos')->orderBy('id')->get()->toJson(),
            'assignments' => DB::table('usuario_departamento')->orderBy('id')->get()->toJson(),
            'files' => array_map(fn ($p) => [$p, hash('sha256', Storage::get($p))], Storage::allFiles())];
    }

    public static function invalidDepartmentText(): array
    {
        return [['nombre', "A\0B"], ['nombre', ['bad']], ['nombre', str_repeat('é', 256)],
            ['codigo_interno', "A\0B"], ['codigo_interno', str_repeat('x', 51)],
            ['descripcion', "A\0B"], ['descripcion', str_repeat('x', 1001)],
            ['icono', "A\0B"], ['icono', str_repeat('x', 101)], ['publico', ['bad']]];
    }

    #[DataProvider('invalidDepartmentText')]
    public function test_invalid_observatory_metadata_has_no_side_effects(string $field, mixed $value): void
    {
        $before = $this->snapshot();
        $data = ['nombre' => 'Nuevo', 'codigo_interno' => 'new-code', $field => $value];
        $this->postJson('/api/departamentos', $data)->assertUnprocessable()->assertJsonValidationErrors($field);
        $this->putJson('/api/departamentos/'.$this->department->id, [$field => $value])
            ->assertUnprocessable()->assertJsonValidationErrors($field);
        $this->assertSame($before, $this->snapshot());
    }

    public function test_observatory_update_rejects_duplicate_code_including_deleted_rows_and_keeps_own_code(): void
    {
        $other = Departamento::create(['nombre' => 'Otro', 'codigo_interno' => 'other-code']);
        foreach ([false, true] as $deleted) {
            if ($deleted) $other->delete();
            $before = $this->snapshot();
            $this->putJson('/api/departamentos/'.$this->department->id, ['codigo_interno' => 'other-code', 'id' => $other->id])
                ->assertUnprocessable()->assertJsonValidationErrors('codigo_interno');
            $this->assertSame($before, $this->snapshot());
        }
        $this->putJson('/api/departamentos/'.$this->department->id, ['codigo_interno' => 'synthetic',
            'nombre' => str_repeat('é', 255), 'descripcion' => str_repeat('d', 1000), 'icono' => str_repeat('x', 50), 'publico' => '1'])
            ->assertOk()->assertJsonPath('publico', true);
    }

    public function test_real_photo_preview_storage_and_removal_still_work_and_disguised_photo_is_rejected(): void
    {
        $before = $this->snapshot();
        $this->post('/api/departamentos', ['nombre' => 'Nuevo', 'codigo_interno' => 'photo-bad',
            'foto' => UploadedFile::fake()->image('image.txt')], ['Accept' => 'application/json'])
            ->assertUnprocessable()->assertJsonValidationErrors('foto');
        $this->assertSame($before, $this->snapshot());
        $created = $this->post('/api/departamentos', ['nombre' => 'Foto', 'codigo_interno' => 'photo-ok', 'publico' => '0',
            'foto' => UploadedFile::fake()->image('image.png', 20, 30)], ['Accept' => 'application/json'])
            ->assertCreated()->assertJsonPath('publico', false)->json();
        $this->assertStringStartsWith('data:image/jpeg;base64,', $created['foto_url']);
        $this->putJson('/api/departamentos/'.$created['id'], ['eliminar_foto' => '1'])->assertOk()->assertJsonPath('foto_url', null);
    }

    public static function invalidColumns(): array
    {
        return [['nombre_columna', 'unknown.field'], ['nombre_columna', '$field'], ['nombre_columna', str_repeat('x', 256)],
            ['nombre_original', "A\0B"], ['nombre_original', str_repeat('é', 256)],
            ['tipo_detectado', 'INVALID'], ['tipo_dato', 'INVALID'], ['orden', 2147483648], ['orden', -1],
            ['es_visible', null], ['es_visible', 'false'], ['opciones', ['nested' => ['object']]],
            ['opciones', [['nested']]], ['opciones', ["A\0B"]], ['opciones', [str_repeat('x', 2049)]],
            ['opciones', array_fill(0, 101, 'x')], ['opciones', array_fill(0, 100, str_repeat('x', 1000))],
            ['muestra_valores', array_fill(0, 6, 'x')], ['muestra_valores', [['nested']]], ['unknown', true]];
    }

    #[DataProvider('invalidColumns')]
    public function test_invalid_column_values_never_start_storage_or_row_replacement(string $field, mixed $value): void
    {
        $this->mock(RegistroDatoRepositoryInterface::class)->shouldNotReceive('deleteByDatasetId', 'insertBatch');
        $before = $this->snapshot();
        $r = $this->postJson('/api/datasets/'.$this->dataset->id.'/import', ['columnas' => [$this->column([$field => $value])]])
            ->assertUnprocessable();
        $r->assertJsonValidationErrors($field === 'unknown' ? 'columnas.0' : 'columnas.0.'.$field);
        $this->assertSame($before, $this->snapshot());
    }

    public function test_bad_batches_reject_without_expanding_wildcards(): void
    {
        $this->mock(RegistroDatoRepositoryInterface::class)->shouldNotReceive('deleteByDatasetId', 'insertBatch');
        foreach ([[], ['named' => $this->column()], array_fill(0, 201, $this->column()),
            [$this->column(), $this->column()], [$this->column(['opciones' => array_fill(0, 100, str_repeat('x', 2048))]),
                $this->column(['nombre_columna' => 'valor', 'opciones' => array_fill(0, 100, str_repeat('x', 2048))])]] as $columns) {
            $before = $this->snapshot();
            $this->postJson('/api/datasets/'.$this->dataset->id.'/import', ['columnas' => $columns])->assertUnprocessable();
            $this->assertSame($before, $this->snapshot());
        }
    }

    public function test_real_csv_import_preserves_numeric_strings_order_options_and_column_selection(): void
    {
        $repository = $this->mock(RegistroDatoRepositoryInterface::class);
        $repository->shouldReceive('deleteByDatasetId')->once()->with($this->dataset->id)->andReturn(true);
        $repository->shouldReceive('insertBatch')->once()->with($this->dataset->id, [['ValorRenombrado' => 2.0], ['ValorRenombrado' => 0.0]])->andReturn(2);
        $this->postJson('/api/datasets/'.$this->dataset->id.'/import', ['columnas' => [$this->column([
            'nombre_columna' => 'ValorRenombrado', 'nombre_original' => 'Valor', 'tipo_dato' => 'NUMERICO', 'tipo_detectado' => 'NUMERICO',
            'es_visible' => '0', 'orden' => '2147483647', 'opciones' => [2, 0, null, false], 'muestra_valores' => [2, 0]])]])
            ->assertOk()->assertJsonPath('estado', 'COMPLETADO')->assertJsonPath('total_registros', 2);
        $variable = VariableMetadatoModel::where('dataset_id', $this->dataset->id)->sole();
        $this->assertFalse($variable->es_visible); $this->assertSame(0, $variable->orden);
        $this->assertSame([2, 0, null, false], $variable->opciones);
        $this->assertSame('ValorRenombrado', $variable->nombre_columna);
        Http::assertNothingSent();
    }

    public function test_nonexistent_source_columns_and_colliding_headers_keep_existing_data(): void
    {
        $this->mock(RegistroDatoRepositoryInterface::class)->shouldNotReceive('deleteByDatasetId', 'insertBatch');
        VariableMetadatoModel::create(['dataset_id' => $this->dataset->id, 'nombre_columna' => 'previous',
            'nombre_original' => 'Anterior', 'tipo_dato' => 'TEXTO', 'tipo_detectado' => 'TEXTO']);
        foreach (["Grupo,Valor\nA,1\n", "Grupo,Grúpo\nA,1\n"] as $csv) {
            Storage::put('datasets/synthetic.csv', $csv);
            $before = $this->snapshot();
            $original = str_contains($csv, 'Grúpo') ? 'Grupo' : 'No existe';
            $this->postJson('/api/datasets/'.$this->dataset->id.'/import', ['columnas' => [$this->column(['nombre_original' => $original])]])
                ->assertUnprocessable();
            $this->assertSame($before, $this->snapshot());
        }
    }

    public function test_upload_metadata_is_validated_before_file_storage_and_repeated_names_do_not_collide(): void
    {
        foreach (['nombre' => "A\0B", 'descripcion' => "A\0B", 'departamento_id' => 'not-a-uuid'] as $field => $value) {
            $before = $this->snapshot();
            $this->post('/api/datasets', ['departamento_id' => $this->department->id, 'nombre' => 'Nuevo', $field => $value,
                'archivo' => UploadedFile::fake()->createWithContent('data.csv', "Grupo,Valor\nA,1\n")], ['Accept' => 'application/json'])
                ->assertUnprocessable()->assertJsonValidationErrors($field);
            $this->assertSame($before, $this->snapshot());
        }
        $names = [];
        foreach (["A,1", "B,2"] as $row) {
            $result = $this->post('/api/datasets', ['departamento_id' => $this->department->id, 'nombre' => 'Nuevo',
                'archivo' => UploadedFile::fake()->createWithContent('data.csv', "Grupo,Valor\n".$row."\n")], ['Accept' => 'application/json'])
                ->assertCreated()->json();
            $filename = DatasetModel::findOrFail($result['id'])->nombre_archivo;
            $this->assertMatchesRegularExpression('/^[a-f0-9-]{36}\.csv$/', $filename);
            $names[] = $filename;
            $this->assertSame("Grupo,Valor\n".$row."\n", Storage::get('datasets/'.$filename));
        }
        $this->assertNotSame($names[0], $names[1]);
    }

    public function test_deleted_department_and_non_admin_cannot_upload_or_confirm(): void
    {
        $this->department->delete();
        $before = $this->snapshot();
        $this->post('/api/datasets', ['departamento_id' => $this->department->id, 'nombre' => 'Nuevo',
            'archivo' => UploadedFile::fake()->createWithContent('data.csv', "Grupo,Valor\nA,1\n")], ['Accept' => 'application/json'])
            ->assertUnprocessable()->assertJsonValidationErrors('departamento_id');
        $this->postJson('/api/datasets/'.$this->dataset->id.'/import', ['columnas' => [$this->column()]])->assertForbidden();
        Sanctum::actingAs(User::factory()->create(['rol' => 'USER']));
        $this->postJson('/api/datasets/'.$this->dataset->id.'/import', ['columnas' => [$this->column()]])->assertForbidden();
        $this->postJson('/api/departamentos', ['nombre' => 'No permitido', 'codigo_interno' => 'no'])->assertForbidden();
        $this->assertSame($before, $this->snapshot());
    }

    public function test_two_hundred_columns_are_accepted_and_server_owns_dataset_identity(): void
    {
        $headers = $values = $columns = [];
        for ($i = 0; $i < 200; $i++) {
            $headers[] = 'Field '.$i; $values[] = 'v'.$i;
            $columns[] = $this->column(['nombre_columna' => 'field_'.$i, 'nombre_original' => 'Field '.$i]);
        }
        Storage::put('datasets/synthetic.csv', implode(',', $headers)."\n".implode(',', $values)."\n");
        $repository = $this->mock(RegistroDatoRepositoryInterface::class);
        $repository->shouldReceive('deleteByDatasetId')->once()->with($this->dataset->id)->andReturn(false);
        $repository->shouldReceive('insertBatch')->once()->with($this->dataset->id,
            [array_combine(array_column($columns, 'nombre_columna'), $values)])->andReturn(1);
        $this->postJson('/api/datasets/'.$this->dataset->id.'/import', ['columnas' => $columns,
            'dataset_id' => (string) Str::uuid(), 'estado' => 'ERROR', 'total_registros' => 999])
            ->assertOk()->assertJsonPath('total_registros', 1)->assertJsonPath('estado', 'COMPLETADO');
        $this->assertSame(200, VariableMetadatoModel::where('dataset_id', $this->dataset->id)->count());
        $this->assertSame([0, 199], [VariableMetadatoModel::where('nombre_columna', 'field_0')->sole()->orden,
            VariableMetadatoModel::where('nombre_columna', 'field_199')->sole()->orden]);
    }

    public function test_binary_text_inputs_fail_before_sql_and_file_reads(): void
    {
        foreach (['/api/departamentos', '/api/departamentos/'.$this->department->id, '/api/datasets'] as $url) {
            $before = $this->snapshot();
            $this->call($url === '/api/departamentos/'.$this->department->id ? 'PUT' : 'POST', $url,
                ['nombre' => "bad\xFFname", 'codigo_interno' => 'new-invalid', 'departamento_id' => $this->department->id],
                [], ['archivo' => UploadedFile::fake()->createWithContent('data.csv', "a,b\n1,2\n")], ['HTTP_ACCEPT' => 'application/json'])
                ->assertUnprocessable()->assertJsonValidationErrors('nombre');
            $this->assertSame($before, $this->snapshot());
        }
        $before = $this->snapshot();
        $this->call('POST', '/api/datasets/'.$this->dataset->id.'/import', ['columnas' => [$this->column(['nombre_original' => "bad\xFFname"])]],
            [], [], ['HTTP_ACCEPT' => 'application/json'])->assertUnprocessable()->assertJsonValidationErrors('columnas');
        $this->assertSame($before, $this->snapshot());
    }

    public function test_mismatched_extensions_are_rejected_and_processed_dataset_is_unchanged(): void
    {
        $before = $this->snapshot();
        $this->post('/api/datasets', ['departamento_id' => $this->department->id, 'nombre' => 'Nuevo',
            'archivo' => UploadedFile::fake()->createWithContent('data.txt', "Grupo,Valor\nA,1\n")], ['Accept' => 'application/json'])
            ->assertUnprocessable()->assertJsonValidationErrors('archivo');
        $this->assertSame($before, $this->snapshot());
        $this->dataset->update(['estado' => 'COMPLETADO', 'total_registros' => 4]); $before = $this->snapshot();
        $this->postJson('/api/datasets/'.$this->dataset->id.'/import', ['columnas' => [$this->column()]])->assertStatus(400);
        $this->assertSame($before, $this->snapshot());
    }
}
