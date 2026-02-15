<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\DB;

class CategoriaDatasetSeeder extends Seeder
{
    /**
     * Categorías iniciales para clasificar los datasets.
     */
    private array $categorias = [
        [
            'nombre' => 'Investigación ULEAM',
            'codigo' => 'INVESTIGACION',
            'descripcion' => 'Datasets provenientes de proyectos de investigación académica de la ULEAM.',
            'icono' => 'science',
            'color' => '#6366F1',
            'orden' => 1,
        ],
        [
            'nombre' => 'Vinculación ULEAM',
            'codigo' => 'VINCULACION',
            'descripcion' => 'Datasets generados a través de programas de vinculación con la sociedad.',
            'icono' => 'handshake',
            'color' => '#14B8A6',
            'orden' => 2,
        ],
        [
            'nombre' => 'Barómetro ULEAM',
            'codigo' => 'BAROMETRO',
            'descripcion' => 'Datasets de indicadores y métricas del barómetro institucional.',
            'icono' => 'speed',
            'color' => '#F59E0B',
            'orden' => 3,
        ],
    ];

    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        foreach ($this->categorias as $categoria) {
            DB::table('categorias_dataset')->updateOrInsert(
                ['codigo' => $categoria['codigo']],
                array_merge($categoria, [
                    'id' => Str::uuid()->toString(),
                    'activo' => true,
                    'created_at' => now(),
                    'updated_at' => now(),
                ])
            );
        }
    }
}
