<?php

declare(strict_types=1);

namespace App\Presentation\Http\Requests\Atlas;

use App\Models\AtlasCategoria;
use App\Presentation\Http\Requests\Publicacion\PublicationInputRules;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class SaveAtlasCategoriaRequest extends FormRequest
{
    public function authorize(): bool { return $this->user()?->isAdmin() ?? false; }

    protected function prepareForValidation(): void
    {
        if (is_string($this->input('nombre')) && mb_check_encoding($this->input('nombre'), 'UTF-8')) {
            $this->merge(['nombre' => AtlasCategoria::normalize($this->input('nombre'))]);
        }
    }

    public function rules(): array
    {
        return [
            'nombre' => PublicationInputRules::text(150, true),
            'descripcion' => PublicationInputRules::text(3000),
            'publico' => ['bail', 'sometimes', 'boolean'],
            'icono' => ['bail', 'sometimes', 'nullable', 'string', 'max:50', Rule::in(config('atlas.category_icons'))],
        ];
    }

    public function messages(): array { return ['nombre.required' => 'El nombre de la categoría es obligatorio.']; }

    public function after(): array
    {
        return [function (Validator $validator): void {
            if ($validator->errors()->has('nombre')) return;
            $key = AtlasCategoria::key($this->input('nombre'));
            if (mb_strlen($key) > 150) {
                $validator->errors()->add('nombre', 'El nombre normalizado no debe superar los 150 caracteres.');
                return;
            }
            $category = $this->route('categoria');
            if (AtlasCategoria::withTrashed()->where('nombre_clave', $key)
                ->when($category instanceof AtlasCategoria, fn ($q) => $q->whereKeyNot($category->id))->exists()) {
                $validator->errors()->add('nombre', 'Ya existe una categoría con ese nombre (incluso si fue eliminada).');
            }
        }];
    }
}
