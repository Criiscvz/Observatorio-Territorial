<?php

namespace Database\Seeders;

use App\Infrastructure\Persistence\Eloquent\Models\DepartamentoModel;
use Illuminate\Database\Seeder;

class DepartamentoSeeder extends Seeder
{
    /**
     * Lista de departamentos iniciales con sus iconos.
     * Los iconos usan Material Icons (compatibles con Angular Material).
     */
    private array $departamentos = [
        [
            'nombre' => 'Social',
            'codigo_interno' => 'SOCIAL',
            'descripcion' => 'Departamento de estadísticas sociales, demografía y bienestar de la población.',
            'icono' => 'groups',
            'publico' => true,
        ],
        [
            'nombre' => 'Laboral',
            'codigo_interno' => 'LABORAL',
            'descripcion' => 'Departamento de estadísticas laborales, empleo y mercado de trabajo.',
            'icono' => 'work',
            'publico' => true,
        ],
        [
            'nombre' => 'Electoral',
            'codigo_interno' => 'ELECTORAL',
            'descripcion' => 'Departamento de estadísticas electorales, participación ciudadana y procesos democráticos.',
            'icono' => 'how_to_vote',
            'publico' => true,
        ],
        [
            'nombre' => 'Turístico',
            'codigo_interno' => 'TURISTICO',
            'descripcion' => 'Departamento de estadísticas turísticas, visitantes y actividad hotelera.',
            'icono' => 'flight_takeoff',
            'publico' => true,
        ],
    ];

    /**
     * Seed the application's database with initial departments.
     */
    public function run(): void
    {
        foreach ($this->departamentos as $departamentoData) {
            $existing = DepartamentoModel::where('codigo_interno', $departamentoData['codigo_interno'])->first();

            if ($existing) {
                // Actualizar si ya existe (por ejemplo, para añadir el icono)
                $existing->update([
                    'icono' => $departamentoData['icono'],
                    'descripcion' => $departamentoData['descripcion'],
                ]);
                $this->command->info("Departamento actualizado: {$departamentoData['nombre']}");
            } else {
                DepartamentoModel::create($departamentoData);
                $this->command->info("Departamento creado: {$departamentoData['nombre']}");
            }
        }

        $this->command->info('Seeders de departamentos ejecutados correctamente.');
    }
}
