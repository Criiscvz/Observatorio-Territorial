<?php

declare(strict_types=1);

namespace App\Presentation\Http\Requests;

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
            'columnas.*.orden' => ['integer'],
        ];
    }

    public function messages(): array
    {
        return [
            'columnas.required' => 'Debe especificar las columnas a importar',
            'columnas.min' => 'Debe incluir al menos una columna',
            'columnas.*.nombre_columna.required' => 'El nombre de columna es obligatorio',
            'columnas.*.tipo_dato.required' => 'El tipo de dato es obligatorio',
            'columnas.*.tipo_dato.in' => 'El tipo de dato debe ser NUMERICO, CATEGORICO, FECHA o TEXTO',
        ];
    }
}
