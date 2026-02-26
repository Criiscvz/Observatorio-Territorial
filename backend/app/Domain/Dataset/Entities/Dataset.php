<?php

declare(strict_types=1);

namespace App\Domain\Dataset\Entities;

class Dataset
{
    public const ESTADO_PENDIENTE = 'PENDIENTE';
    public const ESTADO_PROCESANDO = 'PROCESANDO';
    public const ESTADO_COMPLETADO = 'COMPLETADO';
    public const ESTADO_ERROR = 'ERROR';

    public function __construct(
        public readonly ?string $id,
        public readonly string $departamentoId,
        public readonly ?string $categoriaId,
        public readonly int $subidoPor,
        public readonly string $nombre,
        public readonly string $nombreArchivo,
        public readonly ?string $descripcion,
        public readonly ?string $enlaceFuente,
        public readonly string $estado,
        public readonly int $totalRegistros,
        public readonly ?\DateTimeImmutable $fechaCarga,
        public readonly ?\DateTimeImmutable $createdAt = null,
        public readonly ?\DateTimeImmutable $updatedAt = null,
        public readonly ?array $variablesMetadatos = null,
    ) {}

    public static function create(
        string $departamentoId,
        int $subidoPor,
        string $nombre,
        string $nombreArchivo,
        ?string $descripcion = null,
        ?string $categoriaId = null,
        ?string $enlaceFuente = null,
    ): self {
        return new self(
            id: null,
            departamentoId: $departamentoId,
            categoriaId: $categoriaId,
            subidoPor: $subidoPor,
            nombre: $nombre,
            nombreArchivo: $nombreArchivo,
            descripcion: $descripcion,
            enlaceFuente: $enlaceFuente,
            estado: self::ESTADO_PENDIENTE,
            totalRegistros: 0,
            fechaCarga: new \DateTimeImmutable(),
        );
    }

    public function withId(string $id): self
    {
        return new self(
            id: $id,
            departamentoId: $this->departamentoId,
            categoriaId: $this->categoriaId,
            subidoPor: $this->subidoPor,
            nombre: $this->nombre,
            nombreArchivo: $this->nombreArchivo,
            descripcion: $this->descripcion,
            enlaceFuente: $this->enlaceFuente,
            estado: $this->estado,
            totalRegistros: $this->totalRegistros,
            fechaCarga: $this->fechaCarga,
            createdAt: $this->createdAt,
            updatedAt: $this->updatedAt,
            variablesMetadatos: $this->variablesMetadatos,
        );
    }

    public function markAsProcesando(): self
    {
        return $this->withEstado(self::ESTADO_PROCESANDO);
    }

    public function markAsCompletado(int $totalRegistros): self
    {
        return new self(
            id: $this->id,
            departamentoId: $this->departamentoId,
            categoriaId: $this->categoriaId,
            subidoPor: $this->subidoPor,
            nombre: $this->nombre,
            nombreArchivo: $this->nombreArchivo,
            descripcion: $this->descripcion,
            enlaceFuente: $this->enlaceFuente,
            estado: self::ESTADO_COMPLETADO,
            totalRegistros: $totalRegistros,
            fechaCarga: $this->fechaCarga,
            createdAt: $this->createdAt,
            updatedAt: new \DateTimeImmutable(),
            variablesMetadatos: $this->variablesMetadatos,
        );
    }

    public function markAsError(): self
    {
        return $this->withEstado(self::ESTADO_ERROR);
    }

    private function withEstado(string $estado): self
    {
        return new self(
            id: $this->id,
            departamentoId: $this->departamentoId,
            categoriaId: $this->categoriaId,
            subidoPor: $this->subidoPor,
            nombre: $this->nombre,
            nombreArchivo: $this->nombreArchivo,
            descripcion: $this->descripcion,
            enlaceFuente: $this->enlaceFuente,
            estado: $estado,
            totalRegistros: $this->totalRegistros,
            fechaCarga: $this->fechaCarga,
            createdAt: $this->createdAt,
            updatedAt: new \DateTimeImmutable(),
            variablesMetadatos: $this->variablesMetadatos,
        );
    }

    public function isPendiente(): bool
    {
        return $this->estado === self::ESTADO_PENDIENTE;
    }

    public function isCompletado(): bool
    {
        return $this->estado === self::ESTADO_COMPLETADO;
    }

    public function withUpdatedFields(?string $nombre = null, ?string $descripcion = null, ?string $enlaceFuente = null): self
    {
        return new self(
            id: $this->id,
            departamentoId: $this->departamentoId,
            categoriaId: $this->categoriaId,
            subidoPor: $this->subidoPor,
            nombre: $nombre ?? $this->nombre,
            nombreArchivo: $this->nombreArchivo,
            descripcion: $descripcion !== null ? $descripcion : $this->descripcion,
            enlaceFuente: $enlaceFuente !== null ? $enlaceFuente : $this->enlaceFuente,
            estado: $this->estado,
            totalRegistros: $this->totalRegistros,
            fechaCarga: $this->fechaCarga,
            createdAt: $this->createdAt,
            updatedAt: new \DateTimeImmutable(),
            variablesMetadatos: $this->variablesMetadatos,
        );
    }

    public function toArray(): array
    {
        return [
            'id' => $this->id,
            'departamento_id' => $this->departamentoId,
            'categoria_id' => $this->categoriaId,
            'subido_por' => $this->subidoPor,
            'nombre' => $this->nombre,
            'nombre_archivo' => $this->nombreArchivo,
            'descripcion' => $this->descripcion,
            'enlace_fuente' => $this->enlaceFuente,
            'estado' => $this->estado,
            'total_registros' => $this->totalRegistros,
            'fecha_carga' => $this->fechaCarga?->format('Y-m-d H:i:s'),
        ];
    }
}
