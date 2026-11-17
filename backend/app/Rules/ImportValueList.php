<?php

declare(strict_types=1);

namespace App\Rules;

use Closure;
use Illuminate\Contracts\Validation\ValidationRule;

/** Excel's analysis supplies a small flat list of data values, not arbitrary JSON. */
final class ImportValueList implements ValidationRule
{
    public function __construct(private readonly int $max = 100) {}

    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        if (! is_array($value)) return;
        $valid = array_is_list($value) && count($value) <= $this->max;
        if ($valid) foreach ($value as $item) {
            if (is_string($item)) $valid = mb_check_encoding($item, 'UTF-8')
                && mb_strlen($item) <= 2048 && ! str_contains($item, "\0");
            elseif (is_float($item)) $valid = is_finite($item);
            else $valid = $item === null || is_int($item) || is_bool($item);
            if (! $valid) break;
        }
        $json = $valid ? json_encode($value, JSON_UNESCAPED_UNICODE) : false;
        if ($json === false || strlen($json) > 32768) {
            $fail('El campo :attribute debe ser una lista de datos simples de hasta '.$this->max.' valores y 32 KiB.');
        }
    }
}
