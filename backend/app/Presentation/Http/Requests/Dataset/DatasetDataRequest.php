<?php

declare(strict_types=1);

namespace App\Presentation\Http\Requests\Dataset;

use Illuminate\Foundation\Http\FormRequest;
/** Shared pagination contract; each route/use case retains its access checks. */
class DatasetDataRequest extends FormRequest
{
    public function authorize(): bool { return true; }
    public function rules(): array
    {
        return ['page' => ['bail', 'sometimes', 'integer', 'min:1', 'max:1000000'],
            'per_page' => ['bail', 'sometimes', 'integer', 'min:1', 'max:100']];
    }
}
