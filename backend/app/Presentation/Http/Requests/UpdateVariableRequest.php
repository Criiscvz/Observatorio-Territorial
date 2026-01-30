<?php

declare(strict_types=1);

namespace App\Presentation\Http\Requests;

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
            'nombre_columna' => ['sometimes', 'string', 'max:255'],
            'tipo_dato' => ['sometimes', 'string', 'in:NUMERICO,CATEGORICO,FECHA,TEXTO'],
            'es_visible' => ['sometimes', 'boolean'],
        ];
    }
}
