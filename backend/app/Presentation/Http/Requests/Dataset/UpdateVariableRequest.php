<?php

declare(strict_types=1);

namespace App\Presentation\Http\Requests\Dataset;

use Illuminate\Foundation\Http\FormRequest;

class UpdateVariableRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'tipo_dato' => ['nullable', 'string', 'in:NUMERICO,CATEGORICO,FECHA,TEXTO'],
            'es_visible' => ['nullable', 'boolean'],
            'nombre_columna' => ['bail', 'nullable', 'string', 'max:100', new \App\Rules\DatabaseText],
        ];
    }

    public function messages(): array
    {
        return [
            'tipo_dato.in' => 'Tipo de dato inválido',
        ];
    }
}
