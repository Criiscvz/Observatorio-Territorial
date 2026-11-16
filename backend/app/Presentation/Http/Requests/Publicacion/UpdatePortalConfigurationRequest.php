<?php

declare(strict_types=1);

namespace App\Presentation\Http\Requests\Publicacion;

use Illuminate\Foundation\Http\FormRequest;

class UpdatePortalConfigurationRequest extends FormRequest
{
    public function authorize(): bool { return $this->user()?->isAdmin() ?? false; }

    public function rules(): array
    {
        return ['visor_geografico_url' => [...PublicationInputRules::text(2048, true), 'url:http,https']];
    }
}
