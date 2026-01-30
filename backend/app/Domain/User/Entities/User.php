<?php

declare(strict_types=1);

namespace App\Domain\User\Entities;

class User
{
    public function __construct(
        public readonly ?int $id,
        public readonly string $name,
        public readonly string $email,
        public readonly ?string $password = null,
        public readonly ?\DateTimeImmutable $emailVerifiedAt = null,
        public readonly ?\DateTimeImmutable $createdAt = null,
        public readonly ?\DateTimeImmutable $updatedAt = null,
    ) {}

    public static function create(
        string $name,
        string $email,
        string $password
    ): self {
        return new self(
            id: null,
            name: $name,
            email: $email,
            password: $password,
        );
    }

    public function withId(int $id): self
    {
        return new self(
            id: $id,
            name: $this->name,
            email: $this->email,
            password: $this->password,
            emailVerifiedAt: $this->emailVerifiedAt,
            createdAt: $this->createdAt,
            updatedAt: $this->updatedAt,
        );
    }

    public function toArray(): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'email' => $this->email,
        ];
    }
}
