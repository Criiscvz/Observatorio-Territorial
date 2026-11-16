<?php

declare(strict_types=1);

namespace App\Presentation\Http\Requests\Publicacion;

use Illuminate\Foundation\Http\FormRequest;

class PublicationReadRequest extends FormRequest
{
    // Resource authorization remains in the shared PDF/legacy read use case.
    public function authorize(): bool { return true; }
    public function validationData(): array { return $this->query->all(); }
    public function rules(): array { return ['context' => ['bail', 'nullable', 'string', 'in:public,management']]; }
    public function management(): bool { return ($this->validated()['context'] ?? null) === 'management'; }
}
