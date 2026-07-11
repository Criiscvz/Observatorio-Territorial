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

    protected function prepareForValidation(): void
    {
        if ($this->filled('rol')) {
            $this->merge(['rol' => $this->normalizeRole($this->input('rol'))]);
        }
    }

    public function rules(): array
    {
        return [
            'rol' => ['required', 'string', 'in:ADMIN,USER,SUBSCRIBER,EDITOR'],
        ];
    }

    public function messages(): array
    {
        return [
            'rol.required' => 'El rol es obligatorio',
            'rol.in' => 'El rol debe ser ADMIN, USER, SUBSCRIBER o EDITOR',
        ];
    }

    private function normalizeRole(string $role): string
    {
        $normalized = strtoupper(trim($role));

        return in_array($normalized, ['SUSCRIPTOR', 'SUBSCRIPTOR'], true) ? 'SUBSCRIBER' : $normalized;
    }
}
