<?php

declare(strict_types=1);

namespace App\Presentation\Http\Requests\Publicacion;

use App\Rules\DatabaseText;

final class PublicationInputRules
{
    public static function text(int $max, bool $required = false): array
    {
        return ['bail', $required ? 'required' : 'nullable', 'string', 'max:'.$max, new DatabaseText];
    }

    public static function pagination(bool $nullablePage = false): array
    {
        return [
            'page' => ['bail', 'sometimes', ...($nullablePage ? ['nullable'] : []), 'integer', 'min:1', 'max:1000000'],
            'per_page' => ['bail', 'sometimes', 'integer', 'in:20'],
        ];
    }

    public static function normalizeAuthors(mixed $authors): mixed
    {
        if (is_string($authors)) $authors = [$authors];
        if (! is_array($authors) || count($authors) > 100) return $authors;
        $authors = array_values(array_filter(array_map(
            fn (mixed $author): mixed => is_string($author) ? trim($author) : $author,
            $authors,
        ), fn (mixed $author): bool => $author !== '' && $author !== null));
        return $authors ?: null;
    }

    public static function authors(mixed $authors): array
    {
        return ['autores' => ['bail', 'nullable', 'array', 'max:100'],
            ...(is_array($authors) && count($authors) <= 100 ? ['autores.*' => self::text(255)] : [])];
    }
}
