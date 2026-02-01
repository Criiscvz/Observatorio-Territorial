<?php

declare(strict_types=1);

namespace App\Presentation\Http\Requests\User;

use Illuminate\Foundation\Http\FormRequest;

class UpdateUserRoleRequest extends FormRequest
{
    public function authorize(): bool
    {
        // La autorización se verifica en el UseCase
        return true;
    }

    public function rules(): array
    {
        return [
            'rol' => ['required', 'string', 'in:ADMIN,USER'],
        ];
    }

    public function messages(): array
    {
        return [
            'rol.required' => 'El rol es obligatorio',
            'rol.in' => 'El rol debe ser ADMIN o USER',
        ];
    }
}
