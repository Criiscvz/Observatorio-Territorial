<?php

declare(strict_types=1);

namespace App\Presentation\Http\Requests\User;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateUserRequest extends FormRequest
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
        $userId = $this->route('id');

        return [
            'name' => ['sometimes', ...AccountInputRules::text(255, true)],
            'email' => [
                'bail', 'sometimes', 'string',
                'email',
                'max:255',
                new \App\Rules\DatabaseText,
                Rule::unique('users', 'email')->ignore($userId)
            ],
            'password' => AccountInputRules::password(false),
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
            'name.max' => 'El nombre no puede exceder 255 caracteres',
            'email.email' => 'El email debe tener un formato válido',
            'email.unique' => 'Este email ya está en uso por otro usuario',
            'rol.in' => 'El rol debe ser Administrador, Supervisor, Editor, Suscriptor o Usuario',
            'is_active.boolean' => 'El campo is_active debe ser verdadero o falso',
        ];
    }
}
