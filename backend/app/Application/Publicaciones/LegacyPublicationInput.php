<?php

declare(strict_types=1);

namespace App\Application\Publicaciones;

use Illuminate\Http\Request;

/** Boundary port: validate the transport after the bridge has resolved and locked its destination. */
interface LegacyPublicationInput
{
    public function create(Request $request, string $source): array;
    public function update(Request $request, string $source): array;
}
