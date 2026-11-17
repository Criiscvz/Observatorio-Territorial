<?php

declare(strict_types=1);

namespace App\Presentation\Http\Requests\Departamento;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateDepartamentoRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->isAdmin() === true;
    }

    public function rules(): array
    {
        return [
            'nombre' => DepartamentoInputRules::text(255),
            'codigo_interno' => [...DepartamentoInputRules::text(50),
                Rule::unique('departamentos', 'codigo_interno')->ignore($this->route('departamento'))],
            'descripcion' => DepartamentoInputRules::text(1000),
            'icono' => DepartamentoInputRules::text(50),
            'publico' => ['bail', 'nullable', 'boolean'],
            'foto' => DepartamentoInputRules::photo(),
            'eliminar_foto' => ['sometimes', 'boolean'],
        ];
    }
}
