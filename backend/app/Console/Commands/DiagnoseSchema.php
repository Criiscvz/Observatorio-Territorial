<?php

declare(strict_types=1);

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class DiagnoseSchema extends Command
{
    protected $signature = 'observatorio:diagnose';
    protected $description = 'Report table/column presence + pending migrations. Run this on prod when endpoints 500 with no obvious cause.';

    /**
     * Tables + columns that the controllers referenced in recent 500s depend on.
     * Keyed by table; values are columns the code expects.
     */
    private array $expected = [
        'departamentos' => ['id', 'nombre', 'codigo_interno', 'descripcion', 'publico', 'icono', 'deleted_at'],
        'datasets' => ['id', 'departamento_id', 'categoria_id', 'subido_por', 'nombre', 'opciones', 'estado', 'total_registros', 'deleted_at'],
        'dataset_fuentes' => ['id', 'dataset_id', 'titulo', 'url', 'descripcion', 'orden'],
        'graficos_predeterminados' => ['id', 'dataset_id', 'titulo', 'analisis', 'tipo_grafico', 'tipo_analisis', 'variable_x_id', 'variable_y_id', 'filtros', 'configuracion', 'activo', 'creado_por'],
        'categorias_dataset' => ['id', 'nombre', 'descripcion'],
        'variables_metadatos' => ['id', 'dataset_id', 'nombre_columna', 'nombre_original', 'tipo_dato', 'es_visible', 'opciones'],
        'registros_datos' => ['id', 'dataset_id', 'data'],
        'usuario_departamento' => ['user_id', 'departamento_id', 'rol'],
        'users' => ['id', 'email', 'rol', 'is_active'],
    ];

    public function handle(): int
    {
        $this->line('');
        $this->info('== Database connection ==');
        try {
            DB::connection()->getPdo();
            $driver = DB::connection()->getDriverName();
            $db = DB::connection()->getDatabaseName();
            $this->line("driver: {$driver}");
            $this->line("database: {$db}");
        } catch (\Throwable $e) {
            $this->error('Cannot connect to DB: ' . $e->getMessage());
            return self::FAILURE;
        }

        $this->line('');
        $this->info('== Schema check ==');
        $missing = [];
        foreach ($this->expected as $table => $cols) {
            if (!Schema::hasTable($table)) {
                $this->error("  [MISSING TABLE] {$table}");
                $missing[] = $table;
                continue;
            }
            $missingCols = [];
            foreach ($cols as $col) {
                if (!Schema::hasColumn($table, $col)) {
                    $missingCols[] = $col;
                }
            }
            if ($missingCols) {
                $this->warn("  [INCOMPLETE]    {$table} — missing: " . implode(', ', $missingCols));
                $missing[] = "{$table} (cols: " . implode(',', $missingCols) . ")";
            } else {
                $this->line("  [ok]            {$table}");
            }
        }

        $this->line('');
        $this->info('== Pending migrations ==');
        $this->call('migrate:status');

        $this->line('');
        if ($missing) {
            $this->error('Schema is drifted. Run: php artisan migrate --force');
            return self::FAILURE;
        }

        $this->info('Schema looks consistent with current code.');
        return self::SUCCESS;
    }
}
