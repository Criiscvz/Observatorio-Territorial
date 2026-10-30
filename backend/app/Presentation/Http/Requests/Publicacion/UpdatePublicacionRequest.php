<?php

declare(strict_types=1);

namespace App\Presentation\Http\Requests\Publicacion;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use App\Models\ObservatorioPublicacion;

class UpdatePublicacionRequest extends FormRequest
{
    public function authorize(): bool
    {
        $publication = $this->route('publicacion');
        return $publication instanceof ObservatorioPublicacion
            && $this->user()?->can('update', $publication);
    }

    protected function prepareForValidation(): void
    {
        if (is_string($this->input('observacion_revision'))) {
            $this->merge(['observacion_revision' => trim($this->input('observacion_revision'))]);
        }
        if (! $this->filled('titulo') && $this->filled('nombre')) {
            $this->merge(['titulo' => $this->input('nombre')]);
        }

        if ($this->has('autores')) {
            $autores = is_array($this->input('autores')) ? $this->input('autores') : [$this->input('autores')];
            $autores = array_values(array_filter(array_map(
                fn (mixed $autor): string => is_string($autor) ? trim($autor) : '',
                $autores,
            )));

            $this->merge(['autores' => $autores ?: null]);
        }
    }

    public function rules(): array
    {
        $publicacion = $this->route('publicacion');
        $tipo = $publicacion?->tipo;

        return [
            'estado' => [
                Rule::requiredIf(in_array($this->user()?->rol, ['ADMIN', 'ADMIN_OBSERVATORIO'], true)),
                'nullable',
                Rule::in(ObservatorioPublicacion::ESTADOS),
            ],
            'observacion_revision' => [
                Rule::requiredIf($tipo !== 'ATLAS' && $this->user()?->canReviewObservatory($publicacion?->departamento_id)
                    && in_array($this->input('estado'), ObservatorioPublicacion::ESTADOS_CON_OBSERVACION, true)),
                Rule::prohibitedIf(! $this->user()?->canReviewObservatory($publicacion?->departamento_id)),
                'nullable', 'string', 'max:2000',
            ],
            'solo_suscriptores' => ['sometimes', 'boolean'],
            'atlas_categoria_id' => ['sometimes', 'nullable', Rule::prohibitedIf($tipo !== 'ATLAS' || $this->user()?->rol !== 'ADMIN'), 'uuid', Rule::exists('atlas_categorias', 'id')->whereNull('deleted_at')],
            'titulo' => ['required', 'string', 'max:255'],
            'fecha_publicacion' => ['required', 'date'],
            'link_url' => [
                Rule::requiredIf($tipo === 'REPORTE'),
                'nullable',
                'url:http,https',
                'max:2048',
            ],
            'descripcion' => ['nullable', 'string', 'max:3000'],
            'autores' => ['nullable', 'array'],
            'autores.*' => ['nullable', 'string', 'max:255'],
            'fuente' => ['nullable', 'string', 'max:255'],
            'archivo' => [
                'nullable',
                'file',
                'mimetypes:application/pdf,application/x-pdf',
                'mimes:pdf',
                'max:20480',
            ],
        ];
    }

    public function messages(): array
    {
        return [
            'estado.required' => 'El estado de publicación es obligatorio.',
            'estado.in' => 'El estado de publicación no es válido.',
            'observacion_revision.required' => 'Indica el motivo de la suspensión, archivo o rechazo de la publicación.',
            'observacion_revision.max' => 'La observación no debe superar los 2000 caracteres.',
            'observacion_revision.prohibited' => 'Solo el responsable de revisión puede registrar observaciones.',
            'solo_suscriptores.boolean' => 'La visibilidad para suscriptores no es válida.',
            'titulo.required' => 'El título o nombre es obligatorio.',
            'fecha_publicacion.required' => 'La fecha de publicación es obligatoria.',
            'fecha_publicacion.date' => 'La fecha de publicación no es válida.',
            'link_url.required' => 'El enlace URL es obligatorio.',
            'link_url.url' => 'El enlace debe ser una URL válida con http o https.',
            'archivo.mimetypes' => 'El documento debe ser un archivo PDF válido.',
            'archivo.mimes' => 'Solo se permiten archivos PDF.',
            'archivo.max' => 'El PDF no debe superar los 20 MB.',
        ];
    }
}
