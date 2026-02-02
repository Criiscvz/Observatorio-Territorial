<?php

declare(strict_types=1);

namespace App\Presentation\Http\Requests\Departamento;

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
            'nombre' => ['nullable', 'string', 'max:255'],
            'codigo_interno' => ['nullable', 'string', 'max:50'],
            'descripcion' => ['nullable', 'string', 'max:1000'],
            'icono' => ['nullable', 'string', 'max:50'],
            'publico' => ['nullable', 'boolean'],
        ];
    }
}
