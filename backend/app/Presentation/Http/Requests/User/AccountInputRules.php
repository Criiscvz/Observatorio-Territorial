<?php

declare(strict_types=1);

namespace App\Presentation\Http\Requests\User;

use App\Rules\{BcryptPasswordBytes, DatabaseText};

final class AccountInputRules
{
    public const ROLES = ['ADMIN', 'USER', 'SUBSCRIBER', 'EDITOR', 'ADMIN_OBSERVATORIO'];

    public static function text(int $max, bool $required = false): array
    {
        return ['bail', $required ? 'required' : 'nullable', 'string', 'max:'.$max, new DatabaseText];
    }

    public static function password(bool $required = true): array
    {
        return ['bail', $required ? 'required' : 'nullable', 'string', 'min:8', 'max:72',
            new DatabaseText, new BcryptPasswordBytes];
    }

    public static function pagination(): array
    {
        return ['per_page' => ['bail', 'sometimes', 'integer', 'min:1', 'max:100'],
            'page' => ['bail', 'sometimes', 'integer', 'min:1', 'max:1000000']];
    }

    public static function normalizeRole(mixed $role): mixed
    {
        if (! is_string($role) || strlen($role) > 255) return $role;
        $normalized = strtoupper(trim($role));
        return in_array($normalized, ['SUSCRIPTOR', 'SUBSCRIPTOR'], true) ? 'SUBSCRIBER' : $normalized;
    }
}
