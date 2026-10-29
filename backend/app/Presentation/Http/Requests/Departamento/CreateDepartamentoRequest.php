<?php

declare(strict_types=1);

namespace App\Presentation\Http\Requests\Departamento;

use Illuminate\Foundation\Http\FormRequest;

class CreateDepartamentoRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'nombre' => ['required', 'string', 'max:255'],
            'codigo_interno' => ['required', 'string', 'max:50', 'unique:departamentos,codigo_interno'],
            'descripcion' => ['nullable', 'string', 'max:1000'],
            'icono' => ['nullable', 'string', 'max:100'],
            'publico' => ['boolean'],
            'foto' => ['nullable', 'image', 'mimes:jpg,jpeg,png,webp', 'max:2048', 'dimensions:max_width=4096,max_height=4096'],
            'eliminar_foto' => ['sometimes', 'boolean'],
        ];
    }

    public function messages(): array
    {
        return [
            'nombre.required' => 'El nombre es obligatorio',
            'codigo_interno.required' => 'El código interno es obligatorio',
            'codigo_interno.unique' => 'Este código interno ya está en uso',
        ];
    }
}
