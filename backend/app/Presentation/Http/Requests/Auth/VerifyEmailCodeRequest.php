<?php

declare(strict_types=1);

namespace App\Presentation\Http\Requests\Auth;

use Illuminate\Foundation\Http\FormRequest;

class VerifyEmailCodeRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    public function rules(): array
    {
        return [
            'email' => ['required', 'email', 'max:255'],
            'code' => ['required', 'string', 'regex:/^\d{6}$/'],
        ];
    }
}
