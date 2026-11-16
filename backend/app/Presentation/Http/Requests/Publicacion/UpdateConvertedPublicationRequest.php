<?php

declare(strict_types=1);

namespace App\Presentation\Http\Requests\Publicacion;

use App\Models\ObservatorioPublicacion;
use Illuminate\Validation\Rule;

class UpdateConvertedPublicationRequest extends LegacyPublicationRequest
{
    public function rules(): array
    {
        return ['titulo' => ['sometimes', ...PublicationInputRules::text(255, true)],
            'nombre_indicador' => ['sometimes', ...PublicationInputRules::text(255, true)],
            'descripcion' => PublicationInputRules::text(3000), 'descripcion_indicador' => PublicationInputRules::text(3000),
            'autor' => PublicationInputRules::text(255), 'fuente' => PublicationInputRules::text(255),
            'fecha_publicacion' => ['sometimes', ...$this->dateRules(true)], 'fecha_recepcion' => $this->dateRules(),
            'categoria_id' => ['bail', 'nullable', 'uuid', 'exists:categorias_dataset,id'],
            'departamento_id' => ['bail', 'sometimes', 'required', 'uuid'],
            'enlace' => $this->urlRules(), 'link_url' => $this->urlRules(),
            'estado' => ['bail', 'sometimes', 'required', 'string', Rule::in(['PUBLICADO', 'BORRADOR', ...ObservatorioPublicacion::ESTADOS])],
            'observacion_revision' => PublicationInputRules::text(2000),
            'visibilidad' => ['bail', 'sometimes', 'required', 'string', 'in:publico,suscriptor,privado'],
            'ficha' => $this->article() ? ['prohibited'] : $this->pdfRules()];
    }
}
