<?php

declare(strict_types=1);

namespace App\Domain\Permiso\Entities;

class Permiso
{
    public const MODULO_ATLAS = 'atlas';
    public const MODULO_REPORTES = 'reportes';
    public const MODULO_OBSERVATORIOS = 'observatorios';

    public const NIVEL_NINGUNO = 'ninguno';
    public const NIVEL_LECTURA = 'lectura';
    public const NIVEL_ESCRITURA = 'escritura';
    public const NIVEL_ADMIN = 'admin';

    public const MODULOS = [
        self::MODULO_ATLAS,
        self::MODULO_REPORTES,
        self::MODULO_OBSERVATORIOS,
    ];

    public const NIVELES = [
        self::NIVEL_NINGUNO,
        self::NIVEL_LECTURA,
        self::NIVEL_ESCRITURA,
        self::NIVEL_ADMIN,
    ];

    public function __construct(
        public readonly ?string $id,
        public readonly int $userId,
        public readonly string $modulo,
        public readonly string $nivel,
        public readonly ?string $departamentoId = null,
        public readonly ?\DateTimeImmutable $createdAt = null,
        public readonly ?\DateTimeImmutable $updatedAt = null,
    ) {}

    public static function create(
        int $userId,
        string $modulo,
        string $nivel = self::NIVEL_NINGUNO,
        ?string $departamentoId = null,
    ): self {
        return new self(
            id: null,
            userId: $userId,
            modulo: $modulo,
            nivel: $nivel,
            departamentoId: $departamentoId,
        );
    }

    public function withId(string $id): self
    {
        return new self(
            id: $id,
            userId: $this->userId,
            modulo: $this->modulo,
            nivel: $this->nivel,
            departamentoId: $this->departamentoId,
            createdAt: $this->createdAt,
            updatedAt: $this->updatedAt,
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
            'created_at' => $this->createdAt?->format('Y-m-d H:i:s'),
            'updated_at' => $this->updatedAt?->format('Y-m-d H:i:s'),
        ];
    }
}
