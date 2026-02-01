<?php

declare(strict_types=1);

namespace App\Presentation\Http\Requests\Dataset;

use Illuminate\Foundation\Http\FormRequest;

class UploadDatasetRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'departamento_id' => ['required', 'uuid', 'exists:departamentos,id'],
            'nombre' => ['required', 'string', 'max:255'],
            'descripcion' => ['nullable', 'string', 'max:1000'],
            'archivo' => ['required', 'file', 'mimes:xlsx,xls,csv', 'max:51200'],
        ];
    }

    public function messages(): array
    {
        return [
            'departamento_id.required' => 'El departamento es obligatorio',
            'departamento_id.exists' => 'El departamento seleccionado no existe',
            'nombre.required' => 'El nombre del dataset es obligatorio',
            'archivo.required' => 'Debe subir un archivo',
            'archivo.mimes' => 'El archivo debe ser Excel (.xlsx, .xls) o CSV',
            'archivo.max' => 'El archivo no debe superar los 50MB',
        ];
    }
}
