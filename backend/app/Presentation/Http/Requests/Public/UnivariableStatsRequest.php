<?php

declare(strict_types=1);

namespace App\Presentation\Http\Requests\Public;

use Illuminate\Foundation\Http\FormRequest;

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
        ];
    }
}
