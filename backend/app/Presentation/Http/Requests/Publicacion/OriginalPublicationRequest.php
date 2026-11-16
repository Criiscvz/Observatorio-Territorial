<?php

declare(strict_types=1);

namespace App\Presentation\Http\Requests\Publicacion;

use Illuminate\Contracts\Validation\Validator;
use Illuminate\Http\Exceptions\HttpResponseException;

abstract class OriginalPublicationRequest extends LegacyPublicationRequest
{
    protected function failedValidation(Validator $validator): void
    {
        throw new HttpResponseException(response()->json(['message' => 'Datos de validación inválidos', 'errors' => $validator->errors()], 422));
    }
}
