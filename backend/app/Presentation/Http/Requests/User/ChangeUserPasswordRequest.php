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
            'password' => ['required', 'string', 'min:8', 'max:72', 'confirmed',
                function (string $attribute, mixed $value, \Closure $fail) {
                    // Bcrypt only uses the first 72 bytes; never accept a truncated credential.
                    if (is_string($value) && strlen($value) > 72) $fail('La contraseña es demasiado larga. Utiliza una más corta.');
                }],
            'password_confirmation' => ['required', 'string'],
        ];
    }

    public function messages(): array
    {
        return [
            'password.required' => 'Escribe la nueva contraseña.',
            'password.min' => 'La contraseña debe tener al menos 8 caracteres.',
            'password.max' => 'La contraseña es demasiado larga. Utiliza una más corta.',
            'password.confirmed' => 'Las contraseñas no coinciden.',
            'password_confirmation.required' => 'Confirma la nueva contraseña.',
        ];
    }
}
