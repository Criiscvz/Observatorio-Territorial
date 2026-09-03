<?php

declare(strict_types=1);

namespace App\Application\Auth\DTOs;

final readonly class RegisterDTO
{
    public function __construct(
        public string $name,
        public string $email,
        public string $password,
    ) {}

    public static function fromArray(array $data): self
    {
        return new self(
            name: $data['name'],
            email: strtolower(trim($data['email'])),
            password: $data['password'],
        );
    }
}
