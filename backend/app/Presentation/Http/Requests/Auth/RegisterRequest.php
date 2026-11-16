<?php

declare(strict_types=1);

namespace App\Presentation\Http\Requests\Auth;

use Illuminate\Foundation\Http\FormRequest;
use App\Models\User;
use Illuminate\Support\Str;
use App\Presentation\Http\Requests\Profile\CommunityProfileRules;
use App\Presentation\Http\Requests\User\AccountInputRules;

class RegisterRequest extends FormRequest
{
    protected function prepareForValidation(): void
    {
        if (is_string($this->input('email'))) {
            $this->merge(['email' => Str::lower(trim($this->input('email')))]);
        }
    }

    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return array_merge(CommunityProfileRules::rules($this), [
            'name' => AccountInputRules::text(255, true),
            'email' => [
                'bail', 'required', 'string', 'email', 'max:255', new \App\Rules\DatabaseText,
                function (string $attribute, mixed $value, \Closure $fail): void {
                    if (User::query()->whereRaw('LOWER(email) = ?', [(string) $value])->exists()) {
                        $fail('validation.unique')->translate();
                    }
                },
            ],
            'password' => [...AccountInputRules::password(), 'confirmed'],
            'password_confirmation' => ['bail', 'required', 'string', 'max:72'],
        ]);
    }

    public function messages(): array
    {
        return [
            'name.required' => 'El nombre es obligatorio',
            'email.required' => 'El correo electrónico es obligatorio',
            'email.email' => 'El correo electrónico debe ser válido',
            'email.unique' => 'Este correo electrónico ya está registrado',
            'password.required' => 'La contraseña es obligatoria',
            'password.min' => 'La contraseña debe tener al menos 8 caracteres',
            'password.confirmed' => 'Las contraseñas no coinciden',
        ];
    }
}
