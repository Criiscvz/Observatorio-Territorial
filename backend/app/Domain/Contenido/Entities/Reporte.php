<?php

declare(strict_types=1);

namespace App\Domain\Contenido\Entities;

class Reporte
{
    public function __construct(
        public readonly ?string $id,
        public readonly ?string $categoriaId,
        public readonly string $nombreIndicador,
        public readonly ?string $descripcionIndicador,
        public readonly ?string $fechaPublicacion,
        public readonly ?string $linkUrl,
        public readonly ?string $fichaIndicador,
        public readonly ?string $fuente,
    ) {}

    public static function create(
        string $nombreIndicador,
        ?string $categoriaId = null,
        ?string $descripcionIndicador = null,
        ?string $fechaPublicacion = null,
        ?string $linkUrl = null,
        ?string $fichaIndicador = null,
        ?string $fuente = null,
    ): self {
        return new self(
            id: null,
            categoriaId: $categoriaId,
            nombreIndicador: $nombreIndicador,
            descripcionIndicador: $descripcionIndicador,
            fechaPublicacion: $fechaPublicacion,
            linkUrl: $linkUrl,
            fichaIndicador: $fichaIndicador,
            fuente: $fuente,
        );
    }

    public function toArray(): array
    {
        return [
            'id' => $this->id,
            'categoria_id' => $this->categoriaId,
            'nombre_indicador' => $this->nombreIndicador,
            'descripcion_indicador' => $this->descripcionIndicador,
            'fecha_publicacion' => $this->fechaPublicacion,
            'link_url' => $this->linkUrl,
            'ficha_indicador' => $this->fichaIndicador,
            'fuente' => $this->fuente,
        ];
    }
}
