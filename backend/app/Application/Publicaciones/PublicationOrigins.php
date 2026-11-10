<?php

declare(strict_types=1);

namespace App\Application\Publicaciones;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/** Permanent identity only. No snapshots, credentials or automatic conversion. */
final class PublicationOrigins
{
    public const TYPES = ['articulos' => 'ARTICULO', 'reportes' => 'REPORTE'];

    public static function hasTarget(string $id): bool
    {
        return Schema::hasTable('publication_origins') && DB::table('publication_origins')->where('target_id', $id)->exists();
    }
}
