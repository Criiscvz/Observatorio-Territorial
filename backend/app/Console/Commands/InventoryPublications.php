<?php

declare(strict_types=1);

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

/** Counts only: never migrates, emits source values, or infers missing owners. */
class InventoryPublications extends Command
{
    protected $signature = 'publications:inventory {--json : Emit aggregate counts only}';
    protected $description = 'Read-only inventory and blockers for publication consolidation';

    public function handle(): int
    {
        $legacy = [];
        foreach (['articulos', 'reportes'] as $table) {
            $active = DB::table($table)->whereNull('deleted_at');
            $legacy[$table] = [
                'total' => DB::table($table)->count(), 'active' => (clone $active)->count(),
                'soft_deleted' => DB::table($table)->whereNotNull('deleted_at')->count(),
                'without_department' => (clone $active)->whereNull('departamento_id')->count(),
                'without_publication_date' => (clone $active)->whereNull('fecha_publicacion')->count(),
                'with_category' => (clone $active)->whereNotNull('categoria_id')->count(),
                'private' => (clone $active)->where('visibilidad', 'privado')->count(),
                'invalid_department' => (clone $active)->whereNotNull('departamento_id')
                    ->whereNotExists(fn ($q) => $q->selectRaw('1')->from('departamentos as d')
                        ->whereColumn('d.id', $table.'.departamento_id')->whereNull('d.deleted_at'))->count(),
                'id_collision_with_target' => (clone $active)->whereExists(fn ($q) => $q->selectRaw('1')
                    ->from('observatorio_publicaciones as p')->whereColumn('p.id', $table.'.id'))->count(),
            ];
        }
        $unified = DB::table('observatorio_publicaciones');
        $result = [
            'read_only' => true, 'target' => 'observatorio_publicaciones', 'legacy' => $legacy,
            'target_total' => (clone $unified)->count(),
            'target_by_type' => (clone $unified)->selectRaw('tipo, COUNT(*) total')->groupBy('tipo')->pluck('total', 'tipo')->all(),
            'target_without_department' => (clone $unified)->whereIn('tipo', ['ARTICULO', 'REPORTE', 'LIBRO'])->whereNull('departamento_id')->count(),
            'legacy_owner_decisions_required' => array_sum(array_column($legacy, 'active')),
            'automatic_migration_enabled' => false,
            'source_tables_retained' => true,
        ];
        if ($this->option('json')) {
            $this->line(json_encode($result, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE));
        } else {
            $this->table(['Source', 'Active', 'Deleted', 'Missing department', 'Missing date', 'ID collision'],
                array_map(fn ($table, $row) => [$table, $row['active'], $row['soft_deleted'], $row['without_department'],
                    $row['without_publication_date'], $row['id_collision_with_target']], array_keys($legacy), $legacy));
            $this->info('Read-only inventory complete. No automatic migration or table deletion is enabled.');
        }
        return self::SUCCESS;
    }
}
