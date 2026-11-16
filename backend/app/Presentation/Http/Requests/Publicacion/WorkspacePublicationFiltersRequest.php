<?php

declare(strict_types=1);

namespace App\Presentation\Http\Requests\Publicacion;

use App\Models\ObservatorioPublicacion;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class WorkspacePublicationFiltersRequest extends FormRequest
{
    public function authorize(): bool
    {
        return in_array($this->user()?->rol, ['ADMIN', 'EDITOR', 'ADMIN_OBSERVATORIO'], true);
    }

    public function rules(): array
    {
        return PublicationInputRules::pagination(nullablePage: true) + [
            'estado' => ['bail', 'nullable', 'string', Rule::in(ObservatorioPublicacion::ESTADOS)],
            'tipo' => ['bail', 'nullable', 'string', Rule::in(['ARTICULO', 'REPORTE', 'LIBRO'])],
            'departamento_id' => ['bail', 'nullable', 'uuid'],
            'q' => PublicationInputRules::text(255),
        ];
    }
}
