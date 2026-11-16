<?php

declare(strict_types=1);

namespace App\Presentation\Http\Requests\User;

use Illuminate\Foundation\Http\FormRequest;

class UpdateUserRoleRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->isAdmin() === true;
    }

    protected function prepareForValidation(): void
    {
        if ($this->exists('rol')) {
            $this->merge(['rol' => AccountInputRules::normalizeRole($this->input('rol'))]);
        }
    }

    public function rules(): array
    {
        return [
            'rol' => ['bail', 'required', 'string', 'in:ADMIN,USER,SUBSCRIBER,EDITOR,ADMIN_OBSERVATORIO'],
        ];
    }

    public function messages(): array
    {
        return [
            'rol.required' => 'El rol es obligatorio',
            'rol.in' => 'El rol debe ser Administrador, Supervisor, Editor, Suscriptor o Usuario',
        ];
    }
}
