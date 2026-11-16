<?php

declare(strict_types=1);

namespace App\Rules;

use Closure;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Http\UploadedFile;

final class PublicationPdfFilename implements ValidationRule
{
    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        if ($value instanceof UploadedFile && (mb_strlen($value->getClientOriginalName()) > 255
            || str_contains($value->getClientOriginalName(), "\0") || ! mb_check_encoding($value->getClientOriginalName(), 'UTF-8'))) {
            $fail('El nombre original del PDF no debe superar 255 caracteres ni contener caracteres nulos.');
        }
    }
}
