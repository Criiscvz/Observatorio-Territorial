<?php

declare(strict_types=1);

namespace App\Presentation\Http\Requests\User;

use Illuminate\Foundation\Http\FormRequest;

class CreateUserRequest extends FormRequest
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
            'name' => AccountInputRules::text(255, true),
            'email' => [...AccountInputRules::text(255, true), 'email', 'unique:users,email'],
            'password' => AccountInputRules::password(),
            'rol' => ['bail', 'sometimes', 'string', 'in:ADMIN,USER,SUBSCRIBER,EDITOR,ADMIN_OBSERVATORIO'],
            'is_active' => ['sometimes', 'boolean'],
            'telefono' => AccountInputRules::text(20),
            'cargo' => AccountInputRules::text(100),
            'bio' => AccountInputRules::text(500),
        ];
    }

    public function messages(): array
    {
        return [
            ...AccountInputRules::passwordMessages(),
            'name.required' => 'El nombre es obligatorio',
            'name.max' => 'El nombre no puede exceder 255 caracteres',
            'email.required' => 'El email es obligatorio',
            'email.email' => 'El email debe tener un formato válido',
            'email.unique' => 'Este email ya está registrado',
            'password.required' => 'La contraseña es obligatoria',
            'rol.in' => 'El rol debe ser Administrador, Supervisor, Editor, Suscriptor o Usuario',
            'is_active.boolean' => 'El campo is_active debe ser verdadero o falso',
        ];
    }
}
