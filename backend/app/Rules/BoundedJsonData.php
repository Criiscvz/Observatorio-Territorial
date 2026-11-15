<?php

declare(strict_types=1);

namespace App\Rules;

use Closure;
use Illuminate\Contracts\Validation\ValidationRule;

/** Data-only JSON; bounds apply to the complete value, not just its first level. */
final class BoundedJsonData implements ValidationRule
{
    public function __construct(private readonly bool $object = false) {}

    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        if (! is_array($value)) return; // The array rule supplies the type error.
        $nodes = 0;
        if (($this->object && $value !== [] && array_is_list($value))
            || ! $this->validNode($value, 0, $nodes)) {
            $fail('El campo :attribute debe contener datos JSON válidos, sin caracteres nulos, con hasta 5 niveles y 500 elementos.');
            return;
        }

        $json = json_encode($value, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        if ($json === false || strlen($json) > 32768) {
            $fail('El campo :attribute no debe superar 32 KiB de datos JSON.');
        }
    }

    private function validNode(mixed $value, int $depth, int &$nodes): bool
    {
        if (++$nodes > 500 || $depth > 5) return false;
        if (is_array($value)) {
            if (count($value) > 100) return false;
            foreach ($value as $key => $child) {
                if (is_string($key) && (mb_strlen($key) > 128 || str_contains($key, "\0"))) return false;
                if (! $this->validNode($child, $depth + 1, $nodes)) return false;
            }
            return true;
        }
        if (is_string($value)) return mb_strlen($value) <= 2048 && ! str_contains($value, "\0");
        if (is_float($value)) return is_finite($value);

        return $value === null || is_int($value) || is_bool($value);
    }
}
