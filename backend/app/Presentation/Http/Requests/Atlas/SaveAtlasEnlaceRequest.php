<?php

declare(strict_types=1);

namespace App\Presentation\Http\Requests\Atlas;

use App\Models\ObservatorioPublicacion;
use App\Presentation\Http\Requests\Publicacion\PublicationInputRules;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class SaveAtlasEnlaceRequest extends FormRequest
{
    public function authorize(): bool
    {
        if (! $this->user()?->isAdmin()) return false;
        $publication = $this->route('publicacion');
        if ($publication instanceof ObservatorioPublicacion) {
            abort_unless($publication->tipo === 'ATLAS' && $publication->departamento_id === null, 404);
        }
        return true;
    }

    public function rules(): array
    {
        return [
            'titulo' => PublicationInputRules::text(255, true),
            'fecha_publicacion' => ['bail', 'required', 'date_format:Y-m-d', 'after_or_equal:0001-01-01', 'before_or_equal:9999-12-31'],
            'link_url' => [...PublicationInputRules::text(2048, true), 'url:http,https'],
            'fuente' => PublicationInputRules::text(255), 'descripcion' => PublicationInputRules::text(3000),
            'archivo' => ['prohibited'],
            ...($this->isMethod('patch') ? ['atlas_categoria_id' => ['bail', 'required', 'uuid', Rule::exists('atlas_categorias', 'id')->whereNull('deleted_at')]] : []),
        ];
    }
}
