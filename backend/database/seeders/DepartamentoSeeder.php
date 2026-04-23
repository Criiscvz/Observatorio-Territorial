<?php

namespace Database\Seeders;

use App\Infrastructure\Persistence\Eloquent\Models\DepartamentoModel;
use Illuminate\Database\Seeder;

class DepartamentoSeeder extends Seeder
{
    /**
     * Lista de dimensiones territoriales con sus iconos.
     * Los iconos usan Material Icons (compatibles con Angular Material).
     */
    private array $departamentos = [
        [
            'nombre' => 'Vitalidad Ecológica',
            'codigo_interno' => 'VITALIDAD_ECOLOGICA',
            'descripcion' => 'Dimensión que analiza la biodiversidad, ecosistemas, recursos naturales y sostenibilidad ambiental del territorio.',
            'icono' => 'eco',
            'publico' => true,
        ],
        [
            'nombre' => 'Economía del Cuidado',
            'codigo_interno' => 'ECONOMIA_CUIDADO',
            'descripcion' => 'Dimensión dedicada al análisis del trabajo doméstico, cuidado de personas, economía solidaria y bienestar social.',
            'icono' => 'favorite',
            'publico' => true,
        ],
        [
            'nombre' => 'Saberes y Cultura Viva',
            'codigo_interno' => 'SABERES_CULTURA',
            'descripcion' => 'Dimensión que estudia el patrimonio cultural, conocimientos ancestrales, tradiciones y expresiones artísticas del territorio.',
            'icono' => 'auto_stories',
            'publico' => true,
        ],
        [
            'nombre' => 'Gobernanza Comunitaria',
            'codigo_interno' => 'GOBERNANZA',
            'descripcion' => 'Dimensión enfocada en la participación ciudadana, organización comunitaria, gestión territorial y políticas públicas.',
            'icono' => 'groups',
            'publico' => true,
        ],
        [
            'nombre' => 'Resiliencia',
            'codigo_interno' => 'RESILIENCIA',
            'descripcion' => 'Dimensión que evalúa la capacidad de adaptación, gestión de riesgos, seguridad alimentaria y respuesta ante crisis.',
            'icono' => 'shield',
            'publico' => true,
        ],
    ];

    /**
     * Seed the application's database with initial dimensions.
     */
    public function run(): void
    {
        // Eliminar dimensiones antiguas que no tienen datasets asociados
        $codigosNuevos = array_column($this->departamentos, 'codigo_interno');
        DepartamentoModel::whereDoesntHave('datasets')
            ->whereNotIn('codigo_interno', $codigosNuevos)
            ->each(function ($depto) {
                $this->command->info("Dimensión eliminada (sin datasets): {$depto->nombre}");
                $depto->delete();
            });

        foreach ($this->departamentos as $departamentoData) {
            $existing = DepartamentoModel::where('codigo_interno', $departamentoData['codigo_interno'])->first();

            if ($existing) {
                // Actualizar si ya existe
                $existing->update([
                    'nombre' => $departamentoData['nombre'],
                    'icono' => $departamentoData['icono'],
                    'descripcion' => $departamentoData['descripcion'],
                    'publico' => $departamentoData['publico'],
                ]);
                $this->command->info("Dimensión actualizada: {$departamentoData['nombre']}");
            } else {
                DepartamentoModel::create($departamentoData);
                $this->command->info("Dimensión creada: {$departamentoData['nombre']}");
            }
        }

        $this->command->info('Seeders de dimensiones ejecutados correctamente.');
    }
}
