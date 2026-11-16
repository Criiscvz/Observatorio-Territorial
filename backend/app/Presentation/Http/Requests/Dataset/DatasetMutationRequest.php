<?php

declare(strict_types=1);

namespace App\Presentation\Http\Requests\Dataset;

use Illuminate\Contracts\Validation\Validator;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Http\Exceptions\HttpResponseException;

abstract class DatasetMutationRequest extends FormRequest
{
    protected function failedValidation(Validator $validator): void
    {
        throw new HttpResponseException(response()->json([
            'message' => 'Datos de validación inválidos',
            'errors' => $validator->errors(),
        ], 422));
    }

    /** PostgreSQL text/varchar cannot store a zero byte, even when SQLite can. */
    protected function textRules(int $max, bool $required = false): array
    {
        return ['bail', ...($required ? ['required'] : ['nullable']), 'string', 'max:'.$max, new \App\Rules\DatabaseText];
    }
}
