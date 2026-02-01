<?php

declare(strict_types=1);

namespace App\Presentation\Http\Requests\Dataset;

use Illuminate\Foundation\Http\FormRequest;

class ConfirmImportRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'columnas' => ['required', 'array', 'min:1'],
            'columnas.*.nombre_columna' => ['required', 'string'],
            'columnas.*.nombre_original' => ['required', 'string'],
            'columnas.*.tipo_dato' => ['required', 'string', 'in:NUMERICO,CATEGORICO,FECHA,TEXTO'],
            'columnas.*.tipo_detectado' => ['required', 'string'],
            'columnas.*.es_visible' => ['boolean'],
            'columnas.*.orden' => ['integer', 'min:0'],
            'columnas.*.opciones' => ['nullable', 'array'],
        ];
    }

    public function messages(): array
    {
        return [
            'columnas.required' => 'Debe especificar las columnas a importar',
            'columnas.*.nombre_columna.required' => 'El nombre de columna es obligatorio',
            'columnas.*.tipo_dato.in' => 'Tipo de dato inválido',
        ];
    }
}
