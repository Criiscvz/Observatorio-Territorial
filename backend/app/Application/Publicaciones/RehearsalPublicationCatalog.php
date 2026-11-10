<?php

declare(strict_types=1);

namespace App\Application\Publicaciones;

use Illuminate\Database\Query\Builder;

/** Guarded rehearsal entry point; production uses the same permanent map. */
class RehearsalPublicationCatalog extends PublicPublicationCatalog
{
    public function query(array $filters = []): Builder
    {
        app(LegacyPublicationRehearsal::class)->assertDisposable();
        return parent::query($filters);
    }
}
