<?php

declare(strict_types=1);

namespace App\Application\Publicaciones;

use Illuminate\Database\Query\Builder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/** Rehearsal-only source handoff. Not bound to HTTP or enabled in production. */
class RehearsalPublicationCatalog extends PublicPublicationCatalog
{
    public function query(array $filters = []): Builder
    {
        app(LegacyPublicationRehearsal::class)->assertDisposable();
        if (! Schema::hasColumns('phase2_publication_imports', ['categoria_id', 'fecha_recepcion', 'metadata_hash'])) {
            throw new LegacyRehearsalBlocked('Prepare the current schema in a fresh disposable database before catalog handoff.');
        }

        return parent::query($filters);
    }

    protected function publications(): Builder
    {
        $query = DB::query()->fromSub(parent::publications(), 'n')
            ->leftJoin('phase2_publication_imports as r', DB::raw('CAST(r.target_id AS TEXT)'), '=', 'n.id')
            ->leftJoin('categorias_dataset as c', 'c.id', '=', 'r.categoria_id');
        // Explicit projection: never expose snapshots, owner decisions or receipt hashes.
        foreach (['id', 'origen', 'tipo', 'codigo', 'titulo', 'descripcion', 'autores', 'fuente',
            'fecha_publicacion', 'created_at', 'updated_at', 'departamento_id', 'departamento_nombre'] as $field) {
            $query->addSelect('n.'.$field);
        }

        // UNION ALL aligns columns by position, not by their aliases.
        $query->selectRaw('CAST(r.categoria_id AS TEXT) categoria_id, c.nombre categoria_nombre,
            c.codigo categoria_codigo, c.color categoria_color, c.icono categoria_icono');
        foreach (['solo_suscriptores', 'link_url', 'archivo_pdf', 'sharepoint_url', 'sharepoint_file_type',
            'sharepoint_file_id', 'ficha_indicador'] as $field) {
            $query->addSelect('n.'.$field);
        }

        return $query->selectRaw('CAST(r.fecha_recepcion AS TEXT) fecha_recepcion');
    }

    protected function legacy(string $table): Builder
    {
        // The receipt is the source-to-target identity, including unpublished targets.
        // Filtering on target publication state here would resurrect an archived source.
        return parent::legacy($table)->whereNotExists(fn (Builder $receipt) => $receipt
            ->selectRaw('1')->from('phase2_publication_imports as r')
            ->where('r.source_table', $table)->whereColumn('r.source_id', 'p.id'));
    }
}
