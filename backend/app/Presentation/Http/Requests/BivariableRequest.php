<?php

declare(strict_types=1);

namespace App\Presentation\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class BivariableRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'dataset_id' => ['required', 'uuid'],
            'variable_x_id' => ['required', 'uuid'],
            'variable_y_id' => ['required', 'uuid', 'different:variable_x_id'],
            'chart_type' => ['nullable', 'string', 'in:scatter,grouped_bar,stacked_bar,heatmap'],
            'limit' => ['nullable', 'integer', 'min:5', 'max:100'],
        ];
    }

    public function messages(): array
    {
        return [
            'variable_y_id.different' => 'Las variables X e Y deben ser diferentes',
        ];
    }
}
