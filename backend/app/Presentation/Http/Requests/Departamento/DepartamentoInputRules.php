<?php

declare(strict_types=1);

namespace App\Presentation\Http\Requests\Departamento;

use App\Rules\DatabaseText;

final class DepartamentoInputRules
{
    public static function text(int $max, bool $required = false): array
    {
        return ['bail', $required ? 'required' : 'nullable', 'string', 'max:'.$max, new DatabaseText];
    }

    public static function photo(): array
    {
        return ['bail', 'nullable', 'file', 'image', 'mimes:jpg,jpeg,png,webp',
            'extensions:jpg,jpeg,png,webp', 'max:2048', 'dimensions:max_width=4096,max_height=4096'];
    }
}
