<?php

declare(strict_types=1);

namespace App\Presentation\Http\Requests\Departamento;

use Illuminate\Foundation\Http\FormRequest;

class CreateDepartamentoRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->isAdmin() === true;
    }

    public function rules(): array
    {
        return [
            'nombre' => DepartamentoInputRules::text(255, true),
            'codigo_interno' => [...DepartamentoInputRules::text(50, true), 'unique:departamentos,codigo_interno'],
            'descripcion' => DepartamentoInputRules::text(1000),
            'icono' => DepartamentoInputRules::text(100),
            'publico' => ['bail', 'sometimes', 'boolean'],
            'foto' => DepartamentoInputRules::photo(),
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
