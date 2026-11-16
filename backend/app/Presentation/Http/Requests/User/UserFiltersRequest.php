<?php

declare(strict_types=1);

namespace App\Presentation\Http\Requests\User;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UserFiltersRequest extends FormRequest
{
    public function authorize(): bool { return $this->user()?->isAdmin() === true; }

    public function rules(): array
    {
        return AccountInputRules::pagination() + [
            'search' => AccountInputRules::text(255),
            'rol' => ['bail', 'nullable', 'string', Rule::in(AccountInputRules::ROLES)],
        ];
    }
}
