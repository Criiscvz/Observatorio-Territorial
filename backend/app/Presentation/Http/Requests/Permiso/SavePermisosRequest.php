<?php

declare(strict_types=1);

namespace App\Presentation\Http\Requests\Permiso;

use App\Domain\Permiso\Entities\Permiso;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class SavePermisosRequest extends FormRequest
{
    public function authorize(): bool
    {
        $target = $this->route('user');
        if (! $target instanceof \App\Models\User) $target = \App\Models\User::findOrFail($target);
        return $this->user()?->can('assignAccess', $target) === true;
    }

    public function rules(): array
    {
        return [
            'permisos' => ['required', 'array'],
            'permisos.*.modulo' => ['required', 'string', Rule::in(Permiso::MODULOS)],
            'permisos.*.nivel' => ['required', 'string', Rule::in(Permiso::NIVELES)],
            'permisos.*.departamento_id' => ['nullable', 'uuid', Rule::exists('departamentos', 'id')->whereNull('deleted_at')],
            'permisos.*.puede_revisar' => ['sometimes', 'boolean'],
            'permisos.*.puede_agregar_editores' => ['sometimes', 'boolean'],
        ];
    }

    public function messages(): array
    {
        return [
            'permisos.required' => 'Debe enviar al menos un permiso.',
            'permisos.*.modulo.in' => 'El módulo debe ser atlas, reportes u observatorios.',
            'permisos.*.nivel.in' => 'El nivel debe ser ninguno, lectura, escritura o admin.',
        ];
    }
}
