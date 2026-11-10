<?php

// CLI fixture. Not an artisan command, route, or production build input.
declare(strict_types=1);

if (PHP_SAPI !== 'cli' || getenv('OBSERVATORIO_E2E') !== '1') throw new RuntimeException('E2E fixture refused.');
require 'vendor/autoload.php';
$app = require 'bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
if (config('app.url') !== 'http://localhost:4500' || config('database.connections.pgsql.host') !== 'postgres'
    || config('database.connections.pgsql.database') !== 'observatorio_portable_test'
    || App\Models\User::count() !== 0) throw new RuntimeException('E2E fixture requires a fresh isolated database.');
$input = json_decode(base64_decode('__E2E_INPUT_BASE64__'), true, flags: JSON_THROW_ON_ERROR);
$users = [];
foreach (['admin' => 'ADMIN', 'supervisor' => 'ADMIN_OBSERVATORIO', 'editor' => 'EDITOR', 'subscriber' => 'SUBSCRIBER', 'user' => 'USER'] as $name => $role) {
    $users[$name] = App\Models\User::withoutEvents(fn () => App\Models\User::create(['name' => 'E2E '.ucfirst($name),
        'email' => $name.'@example.test', 'password' => $input['password'], 'rol' => $role, 'is_active' => true, 'email_verified_at' => now()]));
}
$health = App\Models\Departamento::create(['nombre' => 'Observatorio E2E Salud', 'codigo_interno' => 'E2E-SALUD', 'publico' => true, 'descripcion' => 'Datos sinteticos '.$input['run']]);
$other = App\Models\Departamento::create(['nombre' => 'Observatorio E2E Trabajo', 'codigo_interno' => 'E2E-TRABAJO', 'publico' => false]);
$users['supervisor']->departamentos()->attach($health->id, ['id' => (string) Illuminate\Support\Str::uuid(), 'rol' => 'ADMIN', 'puede_revisar' => true, 'puede_agregar_editores' => true]);
$users['editor']->departamentos()->attach($health->id, ['id' => (string) Illuminate\Support\Str::uuid(), 'rol' => 'EDITOR', 'puede_revisar' => false, 'puede_agregar_editores' => false]);
$pdf = App\Providers\E2EGraphProvider::pdf();
Illuminate\Support\Facades\Storage::disk('local')->put('publicaciones/e2e/documento.pdf', $pdf);
$make = static fn (array $extra) => App\Models\ObservatorioPublicacion::create($extra + ['departamento_id' => $health->id,
    'creado_por' => $users['editor']->id, 'tipo' => 'ARTICULO', 'estado' => 'PUBLICACION', 'solo_suscriptores' => false,
    'fecha_publicacion' => '2026-11-05', 'descripcion' => 'Descripcion sintetica visible en la ficha del visor.',
    'autores' => ['Autoria E2E'], 'fuente' => 'Fuente E2E', 'archivo_pdf' => 'publicaciones/e2e/documento.pdf', 'nombre_archivo_original' => 'documento-e2e.pdf']);
for ($i = 1; $i <= 21; $i++) $make(['titulo' => sprintf('Articulo E2E %02d', $i), 'codigo' => sprintf('E2E-ART-%02d', $i)]);
$restricted = $make(['titulo' => 'Libro reservado E2E', 'codigo' => 'E2E-LIB', 'tipo' => 'LIBRO', 'solo_suscriptores' => true]);
$report = $make(['titulo' => 'Reporte E2E', 'codigo' => 'E2E-REP', 'tipo' => 'REPORTE', 'link_url' => 'https://app.powerbi.com/view?r='.base64_encode('{"k":"00000000-0000-4000-8000-000000000001"}')]);
$category = App\Models\AtlasCategoria::create(['nombre' => 'Categoria E2E', 'descripcion' => 'Visualizaciones sinteticas', 'publico' => true]);
$atlas = $make(['titulo' => 'Atlas E2E', 'codigo' => 'E2E-ATL', 'tipo' => 'ATLAS', 'departamento_id' => null, 'atlas_categoria_id' => $category->id,
    'creado_por' => $users['admin']->id, 'archivo_pdf' => null, 'nombre_archivo_original' => null, 'link_url' => $report->link_url]);
echo json_encode(['health' => $health->id, 'other' => $other->id, 'category' => $category->id,
    'restricted' => $restricted->id, 'report' => $report->id, 'atlas' => $atlas->id, 'pdf' => base64_encode($pdf)], JSON_THROW_ON_ERROR);
