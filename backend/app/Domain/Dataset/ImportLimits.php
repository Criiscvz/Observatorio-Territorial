<?php

declare(strict_types=1);

namespace App\Domain\Dataset;

final class ImportLimits
{
    public const MAX_COLUMNS = 200;
    public const MAX_METADATA_BYTES = 262144;
}
