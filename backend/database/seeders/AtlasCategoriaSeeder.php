<?php

namespace Database\Seeders;

use App\Models\AtlasCategoria;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class AtlasCategoriaSeeder extends Seeder
{
    public function run(): void
    {
        foreach (['Educación', 'Economía', 'Pobreza', 'Finanzas Públicas', 'Calidad Democrática',
            'Sectores Vulnerables', 'Ambiente', 'Hábitat y Vivienda', 'Ciencia y Tecnología', 'Salud'] as $nombre) {
            DB::transaction(function () use ($nombre) {
                $key = AtlasCategoria::key($nombre);
                if (AtlasCategoria::withTrashed()->where('clave_inicial', $key)->exists()) {
                    return;
                }
                DB::table('atlas_categorias')->insertOrIgnore([
                    'id' => (string) Str::uuid(), 'nombre' => $nombre, 'nombre_clave' => $key,
                    'clave_inicial' => $key, 'created_at' => now(), 'updated_at' => now(),
                ]);
                // Adopt an existing category without changing its name, description or deletion state.
                AtlasCategoria::withTrashed()->where('nombre_clave', $key)->whereNull('clave_inicial')
                    ->update(['clave_inicial' => $key]);
            });
        }
    }
}
