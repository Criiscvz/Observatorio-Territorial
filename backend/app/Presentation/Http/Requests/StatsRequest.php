<?php

declare(strict_types=1);

namespace App\Presentation\Http\Requests;

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
            'variable_id' => ['required', 'uuid'],
            'chart_type' => ['nullable', 'string', 'in:bar,pie,line,histogram,donut,area'],
            'limit' => ['nullable', 'integer', 'min:5', 'max:100'],
        ];
    }
}
