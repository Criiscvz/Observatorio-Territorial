<?php

declare(strict_types=1);

namespace App\Presentation\Http\Requests\Publicacion;

use App\Application\Publicaciones\PublicPublicationCatalog;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class PublicCatalogRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    public function rules(): array
    {
        return PublicationInputRules::pagination() + [
            'tipo' => ['bail', 'nullable', 'string', Rule::in(PublicPublicationCatalog::TYPES)],
            'departamento_id' => ['bail', 'nullable', 'uuid'],
            'categoria_id' => ['bail', 'nullable', 'uuid'],
            'q' => PublicationInputRules::text(200),
        ];
    }
}
