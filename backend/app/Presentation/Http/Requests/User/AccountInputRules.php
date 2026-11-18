<?php

declare(strict_types=1);

namespace App\Presentation\Http\Requests\User;

use App\Rules\{BcryptPasswordBytes, DatabaseText, NewPassword};

final class AccountInputRules
{
    public const ROLES = ['ADMIN', 'USER', 'SUBSCRIBER', 'EDITOR', 'ADMIN_OBSERVATORIO'];

    public static function text(int $max, bool $required = false): array
    {
        return ['bail', $required ? 'required' : 'nullable', 'string', 'max:'.$max, new DatabaseText];
    }

    public static function password(bool $required = true): array
    {
        return ['bail', $required ? 'required' : 'nullable', 'string',
            'min:'.config('password_policy.minimumCharacters'), 'max:72',
            new DatabaseText, new BcryptPasswordBytes, new NewPassword];
    }

    public static function passwordMessages(): array
    {
        return ['password.min' => 'La contraseña debe tener al menos '.config('password_policy.minimumCharacters').' caracteres.',
            'password.max' => 'La contraseña es demasiado larga. Utiliza una más corta.'];
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
