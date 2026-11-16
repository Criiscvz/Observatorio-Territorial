<?php

declare(strict_types=1);

namespace App\Presentation\Http\Requests\Publicacion;

use App\Models\ObservatorioPublicacion;
use Illuminate\Validation\Rule;

class StoreLegacyPublicationRequest extends LegacyPublicationRequest
{
    public function rules(): array
    {
        return [
            $this->article() ? 'titulo' : 'nombre_indicador' => PublicationInputRules::text(255, true),
            'departamento_id' => ['bail', 'required', 'uuid'],
            'fecha_publicacion' => $this->dateRules(true), 'fecha_recepcion' => $this->dateRules(),
            'descripcion' => PublicationInputRules::text(3000), 'descripcion_indicador' => PublicationInputRules::text(3000),
            'autor' => PublicationInputRules::text(255), 'fuente' => PublicationInputRules::text(255),
            'categoria_id' => ['bail', 'nullable', 'uuid', 'exists:categorias_dataset,id'],
            'enlace' => $this->urlRules(), 'link_url' => $this->urlRules(2048, ! $this->article()),
            'estado' => ['bail', 'sometimes', 'string', Rule::in(['PUBLICADO', 'BORRADOR', ...ObservatorioPublicacion::ESTADOS])],
            'observacion_revision' => PublicationInputRules::text(2000),
            'visibilidad' => ['bail', 'sometimes', 'string', 'in:publico,suscriptor,privado'],
            'ficha' => $this->article() ? ['prohibited'] : $this->pdfRules(),
        ];
    }
}
