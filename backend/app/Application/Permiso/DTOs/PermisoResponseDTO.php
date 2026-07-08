<?php

declare(strict_types=1);

namespace App\Application\Permiso\DTOs;

use App\Domain\Permiso\Entities\Permiso;

final readonly class PermisoResponseDTO
{
    public function __construct(
        public ?string $id,
        public int $userId,
        public string $modulo,
        public string $nivel,
        public ?string $departamentoId,
    ) {}

    public static function fromEntity(Permiso $permiso): self
    {
        return new self(
            id: $permiso->id,
            userId: $permiso->userId,
            modulo: $permiso->modulo,
            nivel: $permiso->nivel,
            departamentoId: $permiso->departamentoId,
        );
    }

    public static function fromNivel(int $userId, string $modulo, string $nivel, ?string $departamentoId = null): self
    {
        return new self(
            id: null,
            userId: $userId,
            modulo: $modulo,
            nivel: $nivel,
            departamentoId: $departamentoId,
        );
    }

    public function toArray(): array
    {
        return [
            'id' => $this->id,
            'user_id' => $this->userId,
            'modulo' => $this->modulo,
            'nivel' => $this->nivel,
            'departamento_id' => $this->departamentoId,
        ];
    }
}
