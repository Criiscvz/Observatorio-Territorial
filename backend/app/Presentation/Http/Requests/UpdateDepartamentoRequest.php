<?php

declare(strict_types=1);

namespace App\Presentation\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class UpdateDepartamentoRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'nombre' => ['sometimes', 'string', 'max:255'],
            'descripcion' => ['nullable', 'string', 'max:1000'],
            'publico' => ['sometimes', 'boolean'],
        ];
    }
}
