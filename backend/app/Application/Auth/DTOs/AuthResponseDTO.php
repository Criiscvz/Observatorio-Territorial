<?php

declare(strict_types=1);

namespace App\Application\Auth\DTOs;

final readonly class AuthResponseDTO
{
    public function __construct(
        public int $userId,
        public string $name,
        public string $email,
        public string $token,
    ) {}

    public function toArray(): array
    {
        return [
            'user' => [
                'id' => $this->userId,
                'name' => $this->name,
                'email' => $this->email,
            ],
            'token' => $this->token,
        ];
    }
}
