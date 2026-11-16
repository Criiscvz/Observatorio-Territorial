<?php

declare(strict_types=1);

namespace App\Rules;

use Closure;
use Illuminate\Contracts\Validation\ValidationRule;

/** Retained Mongo filters are data: flat operands, known operators and bounded size. */
final class StatisticsFilters implements ValidationRule
{
    private const OPERATORS = ['eq', 'neq', 'in', 'not_in', 'gt', 'gte', 'lt', 'lte', 'between', 'contains', 'not_contains'];

    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        if (! is_array($value)) return; // The array rule reports wrong root types.
        if (! array_is_list($value) || count($value) > 50) {
            $fail('Envía una lista de hasta 50 filtros.');
            return;
        }
        foreach ($value as $filter) {
            if (! $this->validFilter($filter)) {
                $fail('Cada filtro debe indicar columna, operador y valores simples compatibles; las listas admiten hasta 100 valores.');
                return;
            }
        }
        $json = json_encode($value, JSON_UNESCAPED_UNICODE);
        if ($json === false || strlen($json) > 32768) $fail('Los filtros no deben superar 32 KiB.');
    }

    private function validFilter(mixed $filter): bool
    {
        if (! is_array($filter) || array_is_list($filter)
            || array_diff(array_keys($filter), ['column', 'operator', 'value', 'type']) !== []
            || ! is_string($filter['column'] ?? null) || mb_strlen($filter['column']) > 500
            || preg_match('/^[^\x00-\x1F\x7F]+$/u', $filter['column']) !== 1
            || str_starts_with($filter['column'], '.') || str_ends_with($filter['column'], '.')
            || str_contains($filter['column'], '..') || preg_match('/(?:^|\.)\$/', $filter['column']) === 1
            || ! in_array($filter['operator'] ?? null, self::OPERATORS, true)
            || (isset($filter['type']) && ! in_array($filter['type'], ['NUMERICO', 'CATEGORICO', 'FECHA', 'TEXTO'], true))
            || ! array_key_exists('value', $filter)) return false;

        $value = $filter['value']; $operator = $filter['operator'];
        if (in_array($operator, ['in', 'not_in', 'between'], true)) {
            if (! is_array($value) || ! array_is_list($value) || $value === []
                || count($value) > 100 || ($operator === 'between' && count($value) !== 2)) return false;
            foreach ($value as $item) if (! $this->scalar($item, $operator !== 'between')) return false;
            return true;
        }
        return $this->scalar($value);
    }

    private function scalar(mixed $value, bool $nullable = false): bool
    {
        if ($value === null) return $nullable;
        if (is_string($value)) return $value !== '' && mb_strlen($value) <= 2048
            && ! str_contains($value, "\0") && mb_check_encoding($value, 'UTF-8');
        if (is_float($value)) return is_finite($value);
        return is_bool($value) || is_int($value);
    }
}
