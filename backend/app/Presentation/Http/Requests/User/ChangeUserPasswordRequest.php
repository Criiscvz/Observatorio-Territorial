<?php

declare(strict_types=1);

namespace App\Presentation\Http\Requests\User;

use Illuminate\Foundation\Http\FormRequest;

class ChangeUserPasswordRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->isAdmin() === true;
    }

    public function rules(): array
    {
        return [
            'password' => [...AccountInputRules::password(), 'confirmed'],
            'password_confirmation' => ['bail', 'required', 'string', 'max:72'],
        ];
    }

    public function messages(): array
    {
        return [
            ...AccountInputRules::passwordMessages(),
            'password.required' => 'Escribe la nueva contraseña.',
            'password.confirmed' => 'Las contraseñas no coinciden.',
            'password_confirmation.required' => 'Confirma la nueva contraseña.',
        ];
    }
}
