<?php

namespace Tests\Feature;

use App\Infrastructure\Persistence\Eloquent\Models\DatasetModel;
use App\Infrastructure\Persistence\Eloquent\Models\DepartamentoModel;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class AdminDatasetAccessTest extends TestCase
{
    use RefreshDatabase;

    public function test_global_admin_lists_datasets_without_department_assignment(): void
    {
        $admin = User::factory()->create([
            'rol' => 'ADMIN',
            'is_active' => true,
        ]);

        $departamento = DepartamentoModel::create([
            'nombre' => 'Observatorio de prueba',
            'codigo_interno' => 'OBS-TEST',
            'publico' => true,
        ]);

        DatasetModel::create([
            'departamento_id' => $departamento->id,
            'subido_por' => $admin->id,
            'nombre' => 'Dataset visible para administrador',
            'nombre_archivo' => 'dataset.csv',
            'estado' => 'COMPLETADO',
            'total_registros' => 1,
        ]);

        Sanctum::actingAs($admin);

        $this->getJson('/api/datasets')
            ->assertOk()
            ->assertJsonFragment([
                'nombre' => 'Dataset visible para administrador',
                'total_registros' => 1,
            ]);
    }
}
