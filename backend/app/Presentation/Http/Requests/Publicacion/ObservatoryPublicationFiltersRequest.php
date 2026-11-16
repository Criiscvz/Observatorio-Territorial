<?php

declare(strict_types=1);

namespace App\Presentation\Http\Requests\Publicacion;

use App\Models\Departamento;
use App\Models\ObservatorioPublicacion;
use App\Support\Authorization\PublicationDepartmentAccess;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class ObservatoryPublicationFiltersRequest extends FormRequest
{
    public function authorize(PublicationDepartmentAccess $access): bool
    {
        $department = $this->route('departamento');
        if (! $this->user() || ! $department instanceof Departamento) return false;
        $access->ensure($this->user(), $department);
        return true;
    }

    public function rules(): array
    {
        $library = $this->route()->getActionMethod() === 'library';
        return [
            'tipo' => ['bail', 'nullable', 'string', Rule::in($library ? ['ARTICULO', 'REPORTE', 'LIBRO'] : ['ARTICULO', 'REPORTE', 'LIBRO', 'ATLAS'])],
            'estado' => ['bail', 'nullable', 'string', Rule::in(ObservatorioPublicacion::ESTADOS)],
            ...($library ? PublicationInputRules::pagination() + ['q' => PublicationInputRules::text(200)] : []),
        ];
    }
}
