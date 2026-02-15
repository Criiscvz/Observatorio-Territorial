<?php

declare(strict_types=1);

namespace App\Presentation\Http\Requests\Public;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UnivariableStatsRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'dataset_id' => ['required', 'string', 'uuid'],
            'variable_id' => ['required', 'string', 'uuid'],
            'chart_type' => ['nullable', 'string'],
            'limit' => ['nullable', 'integer', 'min:1', 'max:100'],
            'filters' => ['nullable', 'array'],
            'filters.*.column' => ['required_with:filters', 'string'],
            'filters.*.operator' => ['required_with:filters', 'string', Rule::in(['eq', 'neq', 'in', 'not_in', 'gt', 'gte', 'lt', 'lte', 'between', 'contains', 'not_contains'])],
            'filters.*.value' => ['required_with:filters'],
        ];
    }
}
