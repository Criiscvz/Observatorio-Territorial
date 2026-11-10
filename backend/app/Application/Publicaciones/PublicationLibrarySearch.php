<?php

declare(strict_types=1);

namespace App\Application\Publicaciones;

/** Fixed identifiers only; search input is always a bound literal. */
final class PublicationLibrarySearch
{
    public static function apply($query, string $term, bool $management = false, ?array $searchColumns = null): void
    {
        if (trim($term) === '') { return; }
        $normalize = static function (string $sql): string {
            $sql = "COALESCE({$sql}, '')";
            foreach (array_combine(mb_str_split('ÁÉÍÓÚÜÑáéíóúüñ'), mb_str_split('AEIOUUNaeiouun')) as $from => $to) {
                $sql = "REPLACE({$sql}, '{$from}', '{$to}')";
            }
            return 'LOWER('.$sql.')';
        };
        $term = mb_strtolower(strtr(trim($term), array_combine(mb_str_split('ÁÉÍÓÚÜÑáéíóúüñ'), mb_str_split('AEIOUUNaeiouun'))));
        $like = '%'.str_replace(['!', '%', '_'], ['!!', '!%', '!_'], $term).'%';
        $query->where(function ($q) use ($like, $normalize, $management, $searchColumns): void {
            $columns = $searchColumns ?? ['titulo', 'codigo', 'fuente', 'CAST(autores AS TEXT)'];
            if ($management) { $columns[] = 'observacion_revision'; }
            foreach ($columns as $column) { $q->orWhereRaw($normalize($column)." LIKE ? ESCAPE '!'", [$like]); }
            if ($management) {
                $q->orWhereHas('creadoPor', fn ($owner) => $owner->whereRaw($normalize('name')." LIKE ? ESCAPE '!'", [$like]));
                $q->orWhereRaw($normalize("CASE estado WHEN 'PUBLICACION' THEN 'Publicado' WHEN 'EN_REVISION' THEN 'En revisión' WHEN 'SUSPENDIDO' THEN 'Suspendido' WHEN 'ARCHIVADO' THEN 'Archivado' WHEN 'RECHAZADO' THEN 'Rechazado' END")." LIKE ? ESCAPE '!'", [$like]);
            }
        });
    }
}
