<?php

declare(strict_types=1);

namespace App\Rules;

use Closure;
use Illuminate\Contracts\Validation\ValidationRule;

/** Screens new passwords locally. It never trims/normalizes the stored value. */
final class NewPassword implements ValidationRule
{
    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        if (! is_string($value) || ! mb_check_encoding($value, 'UTF-8') || strlen($value) > 72) return;
        $characters = mb_str_split($value);
        $padding = config('password_policy.paddingCharacters');
        $start = 0;
        $end = count($characters);
        while ($start < $end && in_array($characters[$start], $padding, true)) $start++;
        while ($end > $start && in_array($characters[$end - 1], $padding, true)) $end--;
        $candidate = implode('', array_slice($characters, $start, $end - $start));
        if ($end - $start < config('password_policy.minimumCharacters')
            || count(array_unique($characters)) === 1
            || in_array(strtolower($candidate), config('password_policy.blockedPasswords'), true)) {
            $fail('Elige una contraseña menos predecible. Puedes usar una frase larga.');
        }
    }
}
