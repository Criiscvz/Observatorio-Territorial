<?php

declare(strict_types=1);

namespace App\Presentation\Http\Requests\Auth;

use Illuminate\Foundation\Http\FormRequest;

class GoogleCodeExchangeRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    public function rules(): array
    {
        return ['code' => ['required', 'string', 'max:255']];
    }
}
