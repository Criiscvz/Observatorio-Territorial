<?php

declare(strict_types=1);

namespace App\Application\Publicaciones;

use Illuminate\Database\Query\Builder;
use Illuminate\Support\Facades\DB;

/** Transitional SQL read model. Each source remains identifiable until reconciliation. */
class PublicPublicationCatalog
{
    public const TYPES = ['ARTICULO', 'REPORTE', 'LIBRO'];

    public function query(array $filters = []): Builder
    {
        $sources = $this->publications()->unionAll($this->legacy('articulos'))->unionAll($this->legacy('reportes'));
        $query = DB::query()->fromSub($sources, 'catalog');
        foreach (['tipo', 'departamento_id', 'categoria_id'] as $key) {
            if (filled($filters[$key] ?? null)) {
                $query->where($key, $filters[$key]);
            }
        }
        if (filled($filters['q'] ?? null)) {
            // Translate accents consistently without requiring a PostgreSQL extension.
            $search = '%'.$this->normalize((string) $filters['q']).'%';
            $query->where(function (Builder $q) use ($search): void {
                foreach (['titulo', 'codigo', 'autores', 'fuente'] as $column) {
                    $q->orWhereRaw($this->normalizedSql($column).' LIKE ? ESCAPE \'!\'', [$search]);
                }
            });
        }
        return $query;
    }

    public function ordered(array $filters = []): Builder
    {
        return $this->query($filters)->orderByRaw('fecha_publicacion DESC NULLS LAST')
            ->orderByDesc('created_at')->orderBy('origen')->orderBy('id');
    }

    protected function publications(): Builder
    {
        return DB::table('observatorio_publicaciones as p')
            ->join('departamentos as d', 'd.id', '=', 'p.departamento_id')
            ->whereNull('d.deleted_at')->where('d.publico', true)
            ->where('p.estado', 'PUBLICACION')->whereIn('p.tipo', self::TYPES)
            ->selectRaw("CAST(p.id AS TEXT) id, 'publicaciones' origen, p.tipo, p.codigo, p.titulo, p.descripcion,
                CAST(p.autores AS TEXT) autores, p.fuente, p.fecha_publicacion, p.created_at, p.updated_at,
                CAST(p.departamento_id AS TEXT) departamento_id, d.nombre departamento_nombre,
                CAST(NULL AS TEXT) categoria_id, CAST(NULL AS TEXT) categoria_nombre,
                CAST(NULL AS TEXT) categoria_codigo, CAST(NULL AS TEXT) categoria_color, CAST(NULL AS TEXT) categoria_icono,
                p.solo_suscriptores, p.link_url, p.archivo_pdf,
                p.sharepoint_url, p.sharepoint_file_type, p.sharepoint_file_id,
                CAST(NULL AS TEXT) ficha_indicador, CAST(NULL AS TEXT) fecha_recepcion");
    }

    protected function legacy(string $table): Builder
    {
        $article = $table === 'articulos';
        $query = DB::table($table.' as p')->leftJoin('departamentos as d', 'd.id', '=', 'p.departamento_id')
            ->leftJoin('categorias_dataset as c', 'c.id', '=', 'p.categoria_id')
            ->whereNull('p.deleted_at')
            ->where(fn (Builder $q) => $q->whereNull('p.visibilidad')->orWhereIn('p.visibilidad', ['publico', 'suscriptor']))
            ->where(fn (Builder $q) => $q->whereNull('p.departamento_id')->orWhere(fn (Builder $d) =>
                $d->whereNotNull('d.id')->whereNull('d.deleted_at')->where('d.publico', true)));
        if ($article) {
            $query->where(fn (Builder $q) => $q->whereNull('p.estado')->orWhereIn('p.estado', ['PUBLICADO', 'PUBLICACION']));
        }
        // These expressions are fixed internal identifiers, never request input.
        $title = $article ? 'p.titulo' : 'p.nombre_indicador';
        $description = $article ? 'p.descripcion' : 'p.descripcion_indicador';
        $authors = $article ? 'p.autor' : 'CAST(NULL AS TEXT)';
        $link = $article ? 'p.enlace' : 'p.link_url';
        $file = $article ? 'CAST(NULL AS TEXT)' : 'p.ficha_indicador';
        $received = $article ? 'CAST(p.fecha_recepcion AS TEXT)' : 'CAST(NULL AS TEXT)';
        return $query->selectRaw("CAST(p.id AS TEXT) id, ? origen, ? tipo, CAST(NULL AS TEXT) codigo,
            {$title} titulo, {$description} descripcion, {$authors} autores, p.fuente,
            p.fecha_publicacion, p.created_at, p.updated_at, CAST(p.departamento_id AS TEXT) departamento_id,
            d.nombre departamento_nombre, CAST(p.categoria_id AS TEXT) categoria_id,
            c.nombre categoria_nombre, c.codigo categoria_codigo, c.color categoria_color, c.icono categoria_icono,
            CASE WHEN p.visibilidad = 'suscriptor' THEN true ELSE false END solo_suscriptores,
            {$link} link_url, CAST(NULL AS TEXT) archivo_pdf, CAST(NULL AS TEXT) sharepoint_url,
            CAST(NULL AS TEXT) sharepoint_file_type, CAST(NULL AS TEXT) sharepoint_file_id,
            {$file} ficha_indicador, {$received} fecha_recepcion", [$table, $article ? 'ARTICULO' : 'REPORTE']);
    }

    private function normalize(string $value): string
    {
        return str_replace(['!', '%', '_'], ['!!', '!%', '!_'], mb_strtolower(strtr(trim($value),
            array_combine(mb_str_split('ÁÉÍÓÚÜÑáéíóúüñ'), mb_str_split('AEIOUUNaeiouun')))));
    }

    private function normalizedSql(string $column): string
    {
        $sql = 'COALESCE('.$column.", '')";
        foreach (array_combine(mb_str_split('ÁÉÍÓÚÜÑáéíóúüñ'), mb_str_split('AEIOUUNaeiouun')) as $from => $to) {
            $sql = "REPLACE({$sql}, '{$from}', '{$to}')";
        }
        return 'LOWER('.$sql.')';
    }
}
