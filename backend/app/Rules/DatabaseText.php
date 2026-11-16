<?php

declare(strict_types=1);

namespace App\Rules;

use Closure;
use Illuminate\Contracts\Validation\ValidationRule;

/** PostgreSQL text requires UTF-8 data without zero bytes. */
final class DatabaseText implements ValidationRule
{
    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        if (is_string($value) && (str_contains($value, "\0") || ! mb_check_encoding($value, 'UTF-8'))) {
            $fail('El campo :attribute contiene un carácter no permitido.');
        }
    }
}
