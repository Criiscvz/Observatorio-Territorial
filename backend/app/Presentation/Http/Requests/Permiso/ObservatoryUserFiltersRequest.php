<?php

declare(strict_types=1);

namespace App\Presentation\Http\Requests\Permiso;

use App\Presentation\Http\Requests\User\AccountInputRules;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class ObservatoryUserFiltersRequest extends FormRequest
{
    public function authorize(): bool { return $this->user()?->isObservatoryAdmin() === true; }

    public function rules(): array
    {
        return AccountInputRules::pagination() + ['search' => AccountInputRules::text(255),
            'purpose' => ['bail', 'nullable', 'string', Rule::in(['permissions'])]];
    }
}
