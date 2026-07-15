<?php

declare(strict_types=1);

namespace App\Application\Auth\DTOs;

use App\Models\User;

final readonly class AuthResponseDTO
{
    public function __construct(
        public int $userId,
        public string $name,
        public string $email,
        public string $rol,
        public string $token,
        public string $expiresAt,
        public int $expiresIn,
        public ?array $perfil = null,
        public array $departamentos = [],
    ) {}

    public static function fromUser(User $user, string $token, \DateTimeInterface $expiresAt, int $expiresIn): self
    {
        return new self(
            userId: $user->id,
            name: $user->name,
            email: $user->email,
            rol: $user->rol ?? 'USER',
            token: $token,
            expiresAt: $expiresAt->format(DATE_ATOM),
            expiresIn: $expiresIn,
            perfil: $user->perfil ? [
                'id' => $user->perfil->id,
                'telefono' => $user->perfil->telefono,
                'cargo' => $user->perfil->cargo,
                'avatar' => $user->perfil->avatar,
                'bio' => $user->perfil->bio,
            ] : null,
            departamentos: $user->departamentos->map(fn($d) => [
                'id' => $d->id,
                'nombre' => $d->nombre,
                'codigo_interno' => $d->codigo_interno,
                'rol' => $d->pivot->rol,
            ])->toArray(),
        );
    }

    public function toArray(): array
    {
        return [
            'user' => [
                'id' => $this->userId,
                'name' => $this->name,
                'email' => $this->email,
                'rol' => $this->rol,
                'perfil' => $this->perfil,
                'departamentos' => $this->departamentos,
            ],
            'token' => $this->token,
            'expires_at' => $this->expiresAt,
            'expires_in' => $this->expiresIn,
        ];
    }
}
