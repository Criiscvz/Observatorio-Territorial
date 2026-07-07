<?php

namespace Database\Seeders;

use App\Infrastructure\Persistence\Eloquent\Models\ArticuloModel;
use App\Infrastructure\Persistence\Eloquent\Models\CategoriaDatasetModel;
use App\Infrastructure\Persistence\Eloquent\Models\DepartamentoModel;
use App\Infrastructure\Persistence\Eloquent\Models\ReporteModel;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

class ReporteArticuloSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $departamentos = DepartamentoModel::all();
        $categorias = CategoriaDatasetModel::all();

        if ($departamentos->isEmpty()) {
            $this->command->warn('No hay departamentos para asociar a los reportes y artículos.');
            return;
        }

        $powerBiLinks = [
            'https://app.powerbi.com/view?r=eyJrIjoiM2FkZDc0MWMtY2ZjZi00NDEyLWFiYTctZjBlMWM0YmQ1MmI0IiwidCI6IjMxYTE3OTAwLTc1ODktNGNmYy1iMTFhLWY0ZTgzYzI3YjhlZCIsImMiOjR9',
            'https://app.powerbi.com/view?r=eyJrIjoiZGVjMDNjYjItN2EyMC00ZmY4LWFkOGEtYWVjMTQwMWUzMmFmIiwidCI6IjMxYTE3OTAwLTc1ODktNGNmYy1iMTFhLWY0ZTgzYzI3YjhlZCIsImMiOjR9',
            'https://app.powerbi.com/view?r=eyJrIjoiYzA1NGExYjMtZGYzZC00MzgyLWI3YTYtZjZhOWI1MDM4YzIzIiwidCI6IjMxYTE3OTAwLTc1ODktNGNmYy1iMTFhLWY0ZTgzYzI3YjhlZCIsImMiOjR9'
        ];

        $pdfPath = '1-recuperacion-economica.pdf';

        // Generar algunos reportes y artículos
        foreach ($departamentos as $departamento) {
            $categoria_id = $categorias->isNotEmpty() ? $categorias->random()->id : null;

            // Generar Reportes
            for ($i = 0; $i < 2; $i++) {
                $link = $powerBiLinks[array_rand($powerBiLinks)];
                ReporteModel::create([
                    'id' => Str::uuid(),
                    'categoria_id' => $categoria_id,
                    'departamento_id' => $departamento->id,
                    'nombre_indicador' => 'Reporte ' . ($i + 1) . ' - ' . $departamento->nombre,
                    'descripcion_indicador' => 'Descripción detallada del indicador de ' . $departamento->nombre . ' mostrando su evolución y estado actual.',
                    'fecha_publicacion' => now()->subDays(rand(1, 365)),
                    'link_url' => $link,
                    'ficha_indicador' => 'Ficha técnica del reporte',
                    'fuente' => 'Observatorio Institucional',
                ]);
            }

            // Generar Artículos
            for ($i = 0; $i < 3; $i++) {
                ArticuloModel::create([
                    'id' => Str::uuid(),
                    'categoria_id' => $categoria_id,
                    'departamento_id' => $departamento->id,
                    'titulo' => 'Artículo de investigación ' . ($i + 1) . ' sobre ' . $departamento->nombre,
                    'descripcion' => 'Este artículo profundiza en los aspectos clave de la dimensión de ' . $departamento->nombre . ' y su impacto en el territorio.',
                    'autor' => 'Investigador Principal',
                    'fuente' => 'Revista Científica del Observatorio',
                    'estado' => 'PUBLICADO',
                    'enlace' => $pdfPath,
                    'fecha_publicacion' => now()->subDays(rand(1, 365)),
                    'fecha_recepcion' => now()->subDays(rand(366, 400)),
                ]);
            }
        }

        $this->command->info('Reportes y artículos sembrados exitosamente usando los enlaces proporcionados.');
    }
}
