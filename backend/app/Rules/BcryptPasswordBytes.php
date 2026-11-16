<?php

declare(strict_types=1);

namespace App\Rules;

use Closure;
use Illuminate\Contracts\Validation\ValidationRule;

/** Bcrypt consumes at most 72 bytes, including multibyte passwords. */
final class BcryptPasswordBytes implements ValidationRule
{
    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        if (is_string($value) && strlen($value) > 72) {
            $fail('La contraseña es demasiado larga. Utiliza una de hasta 72 bytes.');
        }
    }
}
