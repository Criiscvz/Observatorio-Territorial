<?php

declare(strict_types=1);

namespace App\Presentation\Http\Requests\Profile;

use App\Presentation\Http\Requests\User\AccountInputRules;
use Illuminate\Foundation\Http\FormRequest;

class UpdateProfileRequest extends FormRequest
{
    public function authorize(): bool { return $this->user() !== null; }

    public function rules(): array
    {
        return CommunityProfileRules::rules($this) + [
            'name' => ['sometimes', ...AccountInputRules::text(255, true)],
            'telefono' => AccountInputRules::text(20),
            'cargo' => AccountInputRules::text(100),
            'bio' => AccountInputRules::text(500),
        ];
    }
}
