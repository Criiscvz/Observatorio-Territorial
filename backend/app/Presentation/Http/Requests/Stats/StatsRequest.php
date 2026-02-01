<?php

declare(strict_types=1);

namespace App\Presentation\Http\Requests\Stats;

use Illuminate\Foundation\Http\FormRequest;

class StatsRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'dataset_id' => ['required', 'uuid'],
            'variable_id' => ['nullable', 'uuid'],
            'variable_x_id' => ['nullable', 'uuid'],
            'variable_y_id' => ['nullable', 'uuid'],
            'chart_type' => ['nullable', 'string'],
            'limit' => ['nullable', 'integer', 'min:1', 'max:100'],
        ];
    }
}
