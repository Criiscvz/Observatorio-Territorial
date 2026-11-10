<?php

declare(strict_types=1);

namespace App\Application\Publicaciones;

/** Only fixed operator-facing reasons may be returned by the preview. */
final class LegacyRehearsalBlocked extends \RuntimeException
{
}
