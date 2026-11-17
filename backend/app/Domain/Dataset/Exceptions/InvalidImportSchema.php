<?php

declare(strict_types=1);

namespace App\Domain\Dataset\Exceptions;

final class InvalidImportSchema extends \RuntimeException
{
    public function __construct(public readonly string $field, string $message)
    {
        parent::__construct($message);
    }
}
