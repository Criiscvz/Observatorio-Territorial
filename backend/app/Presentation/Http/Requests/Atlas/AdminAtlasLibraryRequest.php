<?php

declare(strict_types=1);

namespace App\Presentation\Http\Requests\Atlas;

use App\Presentation\Http\Requests\Publicacion\PublicationInputRules;
use Illuminate\Foundation\Http\FormRequest;

class AdminAtlasLibraryRequest extends FormRequest
{
    public function authorize(): bool { return $this->user()?->isAdmin() ?? false; }

    public function rules(): array
    {
        return PublicationInputRules::pagination() + [
            'categoria_id' => ['bail', 'nullable', 'uuid', 'exists:atlas_categorias,id'],
            'sin_categoria' => ['bail', 'sometimes', 'boolean'], 'q' => PublicationInputRules::text(200),
        ];
    }
}
