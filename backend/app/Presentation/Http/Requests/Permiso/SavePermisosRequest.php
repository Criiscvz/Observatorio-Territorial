<?php

declare(strict_types=1);

namespace App\Presentation\Http\Requests\Permiso;

use App\Domain\Permiso\Entities\Permiso;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class SavePermisosRequest extends FormRequest
{
    public const MAX_PERMISSIONS = 1000;

    public function authorize(): bool
    {
        $target = $this->route('user');
        if (! $target instanceof \App\Models\User) $target = \App\Models\User::findOrFail($target);
        return $this->user()?->can('assignAccess', $target) === true;
    }

    public function rules(): array
    {
        $incoming = $this->input('permisos');
        // Do not expand wildcards or perform per-row exists queries for an invalid batch.
        $bounded = is_array($incoming) && array_is_list($incoming)
            && count($incoming) > 0 && count($incoming) <= self::MAX_PERMISSIONS;
        return [
            'permisos' => ['bail', 'required', 'array', 'list', 'min:1', 'max:'.self::MAX_PERMISSIONS],
            ...($bounded ? [
                'permisos.*' => ['bail', 'required', 'array'],
                'permisos.*.modulo' => ['bail', 'required', 'string', Rule::in(Permiso::MODULOS)],
                'permisos.*.nivel' => ['bail', 'required', 'string', Rule::in(Permiso::NIVELES)],
                'permisos.*.departamento_id' => ['bail', 'nullable', 'uuid', Rule::exists('departamentos', 'id')->whereNull('deleted_at')],
                'permisos.*.puede_revisar' => ['sometimes', 'boolean'],
                'permisos.*.puede_agregar_editores' => ['sometimes', 'boolean'],
            ] : []),
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
