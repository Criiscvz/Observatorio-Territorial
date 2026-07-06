<?php

declare(strict_types=1);

namespace App\Domain\Contenido\Entities;

class Articulo
{
    public function __construct(
        public readonly ?string $id,
        public readonly ?string $categoriaId,
        public readonly ?string $departamentoId,
        public readonly string $titulo,
        public readonly ?string $descripcion,
        public readonly ?string $autor,
        public readonly ?string $fuente,
        public readonly ?string $estado,
        public readonly ?string $enlace,
        public readonly ?string $fechaPublicacion,
        public readonly ?string $fechaRecepcion,
    ) {}

    public static function create(
        string $titulo,
        ?string $categoriaId = null,
        ?string $departamentoId = null,
        ?string $descripcion = null,
        ?string $autor = null,
        ?string $fuente = null,
        ?string $estado = null,
        ?string $enlace = null,
        ?string $fechaPublicacion = null,
        ?string $fechaRecepcion = null,
    ): self {
        return new self(
            id: null,
            categoriaId: $categoriaId,
            departamentoId: $departamentoId,
            titulo: $titulo,
            descripcion: $descripcion,
            autor: $autor,
            fuente: $fuente,
            estado: $estado,
            enlace: $enlace,
            fechaPublicacion: $fechaPublicacion,
            fechaRecepcion: $fechaRecepcion,
        );
    }

    public function toArray(): array
    {
        return [
            'id' => $this->id,
            'categoria_id' => $this->categoriaId,
            'departamento_id' => $this->departamentoId,
            'titulo' => $this->titulo,
            'descripcion' => $this->descripcion,
            'autor' => $this->autor,
            'fuente' => $this->fuente,
            'estado' => $this->estado,
            'enlace' => $this->enlace,
            'fecha_publicacion' => $this->fechaPublicacion,
            'fecha_recepcion' => $this->fechaRecepcion,
        ];
    }
}
