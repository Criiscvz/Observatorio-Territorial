<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Domain\Permiso\Entities\Permiso;
use App\Domain\Permiso\Repositories\PermisoRepositoryInterface;
use App\Infrastructure\Persistence\Eloquent\Models\ArticuloModel;
use App\Infrastructure\Persistence\Eloquent\Models\DatasetFuenteModel;
use App\Infrastructure\Persistence\Eloquent\Models\GraficoPredeterminadoModel;
use App\Infrastructure\Persistence\Eloquent\Models\ReporteModel;
use App\Models\User;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Mockery\MockInterface;
use Tests\TestCase;

class ResourceAuthorizationTest extends TestCase
{
    private const DEPARTAMENTO_A = '11111111-1111-4111-8111-111111111111';
    private const DEPARTAMENTO_B = '22222222-2222-4222-8222-222222222222';
    private const DATASET_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    private const DATASET_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
    private const VARIABLE_A = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
    private const VARIABLE_B = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

    protected function setUp(): void
    {
        parent::setUp();

        Schema::create('users', function (Blueprint $table): void {
            $table->id();
            $table->string('name');
            $table->string('email')->unique();
            $table->string('password')->nullable();
            $table->string('rol');
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('departamentos', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('nombre');
            $table->boolean('publico')->default(false);
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('usuario_departamento', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->unsignedBigInteger('user_id');
            $table->uuid('departamento_id');
            $table->string('rol');
            $table->timestamps();
        });

        Schema::create('datasets', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('departamento_id');
            $table->string('nombre');
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('variables_metadatos', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('dataset_id');
            $table->string('nombre_columna');
            $table->string('nombre_original')->nullable();
            $table->string('tipo_dato');
            $table->string('tipo_detectado')->nullable();
            $table->boolean('es_visible')->default(true);
            $table->integer('orden')->default(0);
            $table->timestamps();
        });

        Schema::create('graficos_predeterminados', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('dataset_id');
            $table->string('titulo');
            $table->string('tipo_grafico');
            $table->string('tipo_analisis');
            $table->uuid('variable_x_id');
            $table->uuid('variable_y_id')->nullable();
            $table->unsignedBigInteger('creado_por')->nullable();
            $table->boolean('activo')->default(true);
            $table->timestamps();
        });

        Schema::create('dataset_fuentes', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('dataset_id');
            $table->string('titulo');
            $table->string('url');
            $table->timestamps();
        });

        Schema::create('articulos', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('departamento_id')->nullable();
            $table->string('titulo');
            $table->string('visibilidad')->nullable();
            $table->string('estado')->nullable();
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('reportes', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('departamento_id')->nullable();
            $table->string('nombre_indicador');
            $table->string('visibilidad')->nullable();
            $table->string('ficha_indicador')->nullable();
            $table->timestamps();
            $table->softDeletes();
        });

        DB::table('departamentos')->insert([
            ['id' => self::DEPARTAMENTO_A, 'nombre' => 'Observatorio A'],
            ['id' => self::DEPARTAMENTO_B, 'nombre' => 'Observatorio B'],
        ]);
        DB::table('datasets')->insert([
            'id' => self::DATASET_A,
            'departamento_id' => self::DEPARTAMENTO_A,
            'nombre' => 'Dataset A',
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        DB::table('datasets')->insert([
            'id' => self::DATASET_B,
            'departamento_id' => self::DEPARTAMENTO_B,
            'nombre' => 'Dataset B',
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        DB::table('variables_metadatos')->insert([
            'id' => self::VARIABLE_A,
            'dataset_id' => self::DATASET_A,
            'nombre_columna' => 'variable_a',
            'tipo_dato' => 'CATEGORICO',
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        DB::table('variables_metadatos')->insert([
            'id' => self::VARIABLE_B,
            'dataset_id' => self::DATASET_B,
            'nombre_columna' => 'variable_b',
            'tipo_dato' => 'CATEGORICO',
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    public function test_editor_cannot_manage_graphics_or_sources_of_another_observatory(): void
    {
        $this->signInEditorForDepartamentoA();
        $source = DatasetFuenteModel::create([
            'dataset_id' => self::DATASET_B,
            'titulo' => 'Fuente B',
            'url' => 'https://example.test/b',
        ]);
        $graphic = GraficoPredeterminadoModel::create([
            'dataset_id' => self::DATASET_B,
            'titulo' => 'Gráfico B',
            'tipo_grafico' => 'bar',
            'tipo_analisis' => 'univariable',
            'variable_x_id' => self::VARIABLE_B,
        ]);

        $this->postJson('/api/datasets/'.self::DATASET_B.'/fuentes', [
            'titulo' => 'Fuente no autorizada',
            'url' => 'https://example.test/blocked',
        ])->assertForbidden();
        $this->putJson('/api/fuentes/'.$source->id, ['titulo' => 'No permitido'])->assertForbidden();
        $this->deleteJson('/api/fuentes/'.$source->id)->assertForbidden();

        $this->postJson('/api/datasets/'.self::DATASET_B.'/graficos-predeterminados', [
            'titulo' => 'Gráfico no autorizado',
            'tipo_grafico' => 'bar',
            'tipo_analisis' => 'univariable',
            'variable_x_id' => self::VARIABLE_B,
        ])->assertForbidden();
        $this->putJson('/api/graficos-predeterminados/'.$graphic->id, ['titulo' => 'No permitido'])->assertForbidden();
        $this->deleteJson('/api/graficos-predeterminados/'.$graphic->id)->assertForbidden();
    }

    public function test_authorized_editor_can_manage_own_dataset_but_cannot_mix_its_variables(): void
    {
        $this->signInEditorForDepartamentoA();

        $this->postJson('/api/datasets/'.self::DATASET_A.'/fuentes', [
            'titulo' => 'Fuente autorizada',
            'url' => 'https://example.test/a',
        ])->assertCreated();
        $this->postJson('/api/datasets/'.self::DATASET_A.'/graficos-predeterminados', [
            'titulo' => 'Gráfico autorizado',
            'tipo_grafico' => 'bar',
            'tipo_analisis' => 'univariable',
            'variable_x_id' => self::VARIABLE_A,
        ])->assertCreated();
        $this->postJson('/api/datasets/'.self::DATASET_A.'/graficos-predeterminados', [
            'titulo' => 'Gráfico inconsistente',
            'tipo_grafico' => 'bar',
            'tipo_analisis' => 'univariable',
            'variable_x_id' => self::VARIABLE_B,
        ])->assertUnprocessable()->assertJsonValidationErrors('variable_x_id');
    }

    public function test_editor_with_module_permission_cannot_change_legacy_content_from_another_observatory(): void
    {
        $this->signInEditorForDepartamentoA();
        $this->grantLegacyContentPermissions();
        $article = ArticuloModel::create([
            'departamento_id' => self::DEPARTAMENTO_B,
            'titulo' => 'Artículo B',
            'estado' => 'PUBLICADO',
        ]);
        $report = ReporteModel::create([
            'departamento_id' => self::DEPARTAMENTO_B,
            'nombre_indicador' => 'Reporte B',
        ]);

        $this->postJson('/api/articulos', [
            'titulo' => 'Artículo no autorizado',
            'departamento_id' => self::DEPARTAMENTO_B,
        ])->assertForbidden();
        $this->putJson('/api/articulos/'.$article->id, ['titulo' => 'Cambio no autorizado'])->assertForbidden();
        $this->deleteJson('/api/articulos/'.$article->id)->assertForbidden();

        $this->postJson('/api/reportes', [
            'nombre_indicador' => 'Reporte no autorizado',
            'departamento_id' => self::DEPARTAMENTO_B,
        ])->assertForbidden();
        $this->putJson('/api/reportes/'.$report->id, ['nombre_indicador' => 'Cambio no autorizado'])->assertForbidden();
        $this->deleteJson('/api/reportes/'.$report->id)->assertForbidden();
    }

    public function test_private_legacy_content_and_its_file_are_not_publicly_available(): void
    {
        $article = ArticuloModel::create([
            'titulo' => 'Artículo privado',
            'visibilidad' => 'privado',
            'estado' => 'PUBLICADO',
        ]);
        $report = ReporteModel::create([
            'nombre_indicador' => 'Reporte privado',
            'visibilidad' => 'privado',
            'ficha_indicador' => 'https://example.test/api/reportes/fichas/secret.pdf',
        ]);
        config(['filesystems.default' => 'local']);
        Storage::fake('local');
        Storage::put('public/fichas/secret.pdf', 'contenido privado');

        $this->getJson('/api/articulos/'.$article->id)->assertNotFound();
        $this->getJson('/api/reportes/'.$report->id)->assertNotFound();
        $this->getJson('/api/reportes/fichas/secret.pdf')->assertNotFound();
    }

    private function signInEditorForDepartamentoA(): void
    {
        $editor = (new User())->forceFill([
            'id' => 10,
            'name' => 'Editor A',
            'email' => 'editor-a@example.test',
            'rol' => 'EDITOR',
            'is_active' => true,
        ]);
        Sanctum::actingAs($editor);
        DB::table('usuario_departamento')->insert([
            'id' => 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
            'user_id' => 10,
            'departamento_id' => self::DEPARTAMENTO_A,
            'rol' => 'EDITOR',
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    private function grantLegacyContentPermissions(): void
    {
        $this->mock(PermisoRepositoryInterface::class, function (MockInterface $mock): void {
            $mock->shouldReceive('findByUserId')->with(10)->andReturn(collect([
                new Permiso(id: 'permiso-atlas', userId: 10, modulo: 'atlas', nivel: 'admin'),
                new Permiso(id: 'permiso-reportes', userId: 10, modulo: 'reportes', nivel: 'admin'),
            ]));
        });
    }
}
