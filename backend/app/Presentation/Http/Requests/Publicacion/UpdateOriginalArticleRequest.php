<?php

declare(strict_types=1);

namespace App\Presentation\Http\Requests\Publicacion;

class UpdateOriginalArticleRequest extends OriginalPublicationRequest
{
    public function rules(): array
    {
        return ['titulo' => ['sometimes', ...PublicationInputRules::text(255, true)],
            'descripcion' => PublicationInputRules::text(3000), 'autor' => PublicationInputRules::text(255),
            'fuente' => PublicationInputRules::text(255), 'estado' => PublicationInputRules::text(255),
            'enlace' => $this->urlRules(),
            'visibilidad' => ['bail', 'sometimes', 'string', 'in:publico,suscriptor,privado'],
            'fecha_publicacion' => $this->dateRules(), 'fecha_recepcion' => $this->dateRules(),
            'categoria_id' => ['bail', 'nullable', 'uuid', 'exists:categorias_dataset,id'],
            'departamento_id' => ['bail', 'nullable', 'uuid', 'exists:departamentos,id']];
    }

}
