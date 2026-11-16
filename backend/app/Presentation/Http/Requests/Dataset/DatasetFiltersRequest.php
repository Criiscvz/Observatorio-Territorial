<?php

declare(strict_types=1);

namespace App\Presentation\Http\Requests\Dataset;

use Illuminate\Foundation\Http\FormRequest;
class DatasetFiltersRequest extends FormRequest
{
    public function authorize(): bool { return $this->user() !== null; }
    public function rules(): array
    {
        return ['departamento_id' => ['bail', 'nullable', 'uuid'],
            'page' => ['bail', 'sometimes', 'integer', 'min:1', 'max:1000000'],
            'per_page' => ['bail', 'sometimes', 'integer', 'in:15']];
    }
}
