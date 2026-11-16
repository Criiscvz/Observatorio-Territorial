<?php

declare(strict_types=1);

namespace App\Presentation\Http\Requests\Publicacion;

use Illuminate\Foundation\Http\FormRequest;

abstract class LegacyPublicationRequest extends FormRequest
{
    // The bridge/controller authorizes the resolved resource before late validation
    // and retains the transaction's second authorization check.
    public function authorize(): bool { return $this->user() !== null; }

    protected function article(): bool { return $this->attributes->get('legacy_source') === 'articulos'; }

    protected function dateRules(bool $required = false): array
    {
        return ['bail', $required ? 'required' : 'nullable', 'date',
            'after_or_equal:0001-01-01', 'before_or_equal:9999-12-31'];
    }

    protected function urlRules(int $max = 2048, bool $required = false): array
    {
        return [...PublicationInputRules::text($max, $required), 'url:http,https'];
    }

    protected function pdfRules(): array
    {
        return ['bail', 'sometimes', 'file', 'mimes:pdf',
            'mimetypes:application/pdf,application/x-pdf', 'max:20480', new \App\Rules\PublicationPdfFilename];
    }
}
