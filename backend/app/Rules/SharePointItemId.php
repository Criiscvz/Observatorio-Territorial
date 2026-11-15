<?php

declare(strict_types=1);

namespace App\Rules;

use Closure;
use Illuminate\Contracts\Validation\ValidationRule;

/** These are opaque item IDs, not Graph paths, queries or URLs. */
final class SharePointItemId implements ValidationRule
{
    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        if (is_string($value) && (! mb_check_encoding($value, 'UTF-8')
            || strpbrk($value, "/\\?#") !== false || preg_match('/[\x00-\x1F\x7F]/', $value))) {
            $fail('El campo :attribute debe ser un identificador de SharePoint, no una ruta o URL.');
        }
    }
}
