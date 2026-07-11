<?php

declare(strict_types=1);

namespace App\Presentation\Http\Requests\User;

use Illuminate\Foundation\Http\FormRequest;

class CreateUserRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        if ($this->filled('rol')) {
            $this->merge(['rol' => $this->normalizeRole($this->input('rol'))]);
        }
    }

    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'string', 'email', 'max:255', 'unique:users,email'],
            'password' => ['required', 'string', 'min:8'],
            'rol' => ['sometimes', 'string', 'in:ADMIN,USER,SUBSCRIBER,EDITOR'],
            'is_active' => ['sometimes', 'boolean'],
            'telefono' => ['nullable', 'string', 'max:20'],
            'cargo' => ['nullable', 'string', 'max:100'],
            'bio' => ['nullable', 'string', 'max:500'],
        ];
    }

    public function messages(): array
    {
        return [
            'name.required' => 'El nombre es obligatorio',
            'name.max' => 'El nombre no puede exceder 255 caracteres',
            'email.required' => 'El email es obligatorio',
            'email.email' => 'El email debe tener un formato válido',
            'email.unique' => 'Este email ya está registrado',
            'password.required' => 'La contraseña es obligatoria',
            'password.min' => 'La contraseña debe tener al menos 8 caracteres',
            'rol.in' => 'El rol debe ser ADMIN, USER, SUBSCRIBER o EDITOR',
            'is_active.boolean' => 'El campo is_active debe ser verdadero o falso',
        ];
    }

    private function normalizeRole(string $role): string
    {
        $normalized = strtoupper(trim($role));

        return in_array($normalized, ['SUSCRIPTOR', 'SUBSCRIPTOR'], true) ? 'SUBSCRIBER' : $normalized;
    }
}
