<?php

declare(strict_types=1);

namespace App\Presentation\Http\Requests\Auth;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Str;

class LoginRequest extends FormRequest
{
    protected function prepareForValidation(): void
    {
        $this->merge(['email' => Str::lower(trim((string) $this->input('email')))]);
    }

    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'email' => ['required', 'email'],
            'password' => ['required', 'string'],
        ];
    }

    public function messages(): array
    {
        return [
            'email.required' => 'El correo electrónico es obligatorio',
            'email.email' => 'El correo electrónico debe ser válido',
            'password.required' => 'La contraseña es obligatoria',
        ];
    }
}
