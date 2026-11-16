<?php

declare(strict_types=1);

namespace App\Presentation\Http\Requests\User;

use Illuminate\Foundation\Http\FormRequest;

class ToggleUserStatusRequest extends FormRequest
{
    public function authorize(): bool { return $this->user()?->isAdmin() === true; }

    public function rules(): array
    {
        // Omission keeps the existing toggle action; null and truthy strings are invalid.
        return ['is_active' => ['bail', 'sometimes', 'required', 'boolean']];
    }
}
