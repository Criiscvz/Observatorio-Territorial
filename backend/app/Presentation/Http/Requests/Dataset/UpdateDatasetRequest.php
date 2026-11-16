<?php

declare(strict_types=1);

namespace App\Presentation\Http\Requests\Dataset;

class UpdateDatasetRequest extends DatasetMutationRequest
{
    public function authorize(): bool { return $this->user()?->isAdmin() === true; }
    public function rules(): array
    {
        return ['nombre' => ['sometimes', ...$this->textRules(255, true)],
            'descripcion' => $this->textRules(2000),
            'enlace_fuente' => [...$this->textRules(255), 'url:http,https']];
    }
}
