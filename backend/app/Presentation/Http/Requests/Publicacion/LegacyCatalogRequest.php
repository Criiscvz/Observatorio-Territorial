<?php

declare(strict_types=1);

namespace App\Presentation\Http\Requests\Publicacion;

use Illuminate\Foundation\Http\FormRequest;
class LegacyCatalogRequest extends FormRequest
{
    public function authorize(): bool { return true; }
    public function rules(): array
    {
        return ['departamento_id' => ['bail', 'nullable', 'uuid'], 'categoria_id' => ['bail', 'nullable', 'uuid'],
            'context' => ['bail', 'nullable', 'string', 'in:public,management']];
    }
}
