<?php

declare(strict_types=1);

namespace App\Presentation\Http\Requests\Publicacion;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdatePublicacionRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        if (! $this->filled('titulo') && $this->filled('nombre')) {
            $this->merge(['titulo' => $this->input('nombre')]);
        }
    }

    public function rules(): array
    {
        $publicacion = $this->route('publicacion');
        $tipo = $publicacion?->tipo;

        return [
            'estado' => [
                Rule::requiredIf($this->user()?->rol === 'ADMIN'),
                'nullable',
                Rule::in(['PUBLICACION', 'EN_REVISION', 'SUSPENDIDO', 'ARCHIVADO']),
            ],
            'solo_suscriptores' => ['sometimes', 'boolean'],
            'titulo' => ['required', 'string', 'max:255'],
            'fecha_publicacion' => ['required', 'date'],
            'link_url' => [
                Rule::requiredIf(in_array($publicacion?->tipo, ['ARTICULO', 'REPORTE'], true)),
                'nullable',
                'url:http,https',
                'max:2048',
            ],
            'descripcion' => ['required', 'string', 'max:3000'],
            'autores' => [
                $tipo === 'ARTICULO' ? 'required' : 'nullable',
                'string',
                'max:1000',
            ],
            'fuente' => ['required', 'string', 'max:255'],
            'archivo' => $tipo === 'REPORTE'
                ? ['prohibited']
                : [
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
            'solo_suscriptores.boolean' => 'La visibilidad para suscriptores no es válida.',
            'titulo.required' => 'El título o nombre es obligatorio.',
            'fecha_publicacion.required' => 'La fecha de publicación es obligatoria.',
            'fecha_publicacion.date' => 'La fecha de publicación no es válida.',
            'link_url.required' => 'El enlace URL es obligatorio.',
            'link_url.url' => 'El enlace debe ser una URL válida con http o https.',
            'descripcion.required' => 'La descripción es obligatoria.',
            'autores.required' => 'El autor o autores son obligatorios para un artículo.',
            'fuente.required' => 'La fuente es obligatoria.',
            'archivo.prohibited' => 'No debe subir PDF para este tipo de publicacion.',
            'archivo.mimetypes' => 'El documento debe ser un archivo PDF válido.',
            'archivo.mimes' => 'Solo se permiten archivos PDF.',
            'archivo.max' => 'El PDF no debe superar los 20 MB.',
        ];
    }
}
