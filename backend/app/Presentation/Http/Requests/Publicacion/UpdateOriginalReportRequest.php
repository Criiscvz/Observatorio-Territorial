<?php

declare(strict_types=1);

namespace App\Presentation\Http\Requests\Publicacion;

class UpdateOriginalReportRequest extends OriginalPublicationRequest
{
    protected function prepareForValidation(): void
    {
        $url = $this->input('link_url');
        if (is_string($url) && $url !== '' && strlen($url) <= 500 && ! preg_match('#^https?://#i', $url)) {
            $this->merge(['link_url' => 'https://'.$url]);
        }
    }

    public function rules(): array
    {
        return ['nombre_indicador' => ['sometimes', ...PublicationInputRules::text(255, true)],
            'descripcion_indicador' => PublicationInputRules::text(3000),
            'fecha_publicacion' => $this->dateRules(), 'link_url' => $this->urlRules(255),
            'fuente' => PublicationInputRules::text(255),
            'visibilidad' => ['bail', 'sometimes', 'string', 'in:publico,suscriptor,privado'],
            'categoria_id' => ['bail', 'nullable', 'uuid', 'exists:categorias_dataset,id'],
            'departamento_id' => ['bail', 'nullable', 'uuid', 'exists:departamentos,id'],
            'ficha' => ['bail', 'nullable', 'file', 'mimes:pdf,doc,docx,xls,xlsx',
                'extensions:pdf,doc,docx,xls,xlsx', 'max:10240']];
    }
}
