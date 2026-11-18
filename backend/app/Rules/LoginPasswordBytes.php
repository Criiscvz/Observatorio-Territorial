<?php

declare(strict_types=1);

namespace App\Rules;

use Closure;
use Illuminate\Contracts\Validation\ValidationRule;

/** Transport bound only: does not apply the creation policy to existing accounts. */
final class LoginPasswordBytes implements ValidationRule
{
    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        if (is_string($value) && strlen($value) > config('password_policy.loginMaximumBytes')) {
            $fail('La contraseña es demasiado larga. Utiliza una más corta.');
        }
    }
}
