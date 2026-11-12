<?php

declare(strict_types=1);

namespace App\Application\Publicaciones;

/** Authorized stored file; opening and sending its stream belongs to the HTTP adapter. */
final readonly class PublicationPdf
{
    public function __construct(public string $path, public string $filename) {}
}
