<?php

declare(strict_types=1);

namespace App\Presentation\Http\Requests\Atlas;

use App\Presentation\Http\Requests\Publicacion\PublicationInputRules;
use Illuminate\Foundation\Http\FormRequest;

class PublicAtlasFiltersRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    public function rules(): array
    {
        $library = $this->route()->getActionMethod() === 'atlasLibrary';
        return ['categoria_id' => ['bail', $library ? 'required' : 'nullable', 'uuid'],
            ...($library ? PublicationInputRules::pagination() + ['q' => PublicationInputRules::text(200)] : [])];
    }
}
