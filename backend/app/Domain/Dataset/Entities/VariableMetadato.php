<?php

declare(strict_types=1);

namespace App\Domain\Dataset\Entities;

class VariableMetadato
{
    public const TIPO_NUMERICO = 'NUMERICO';
    public const TIPO_CATEGORICO = 'CATEGORICO';
    public const TIPO_FECHA = 'FECHA';
    public const TIPO_TEXTO = 'TEXTO';

    public function __construct(
        public readonly ?string $id,
        public readonly string $datasetId,
        public readonly string $nombreColumna,
        public readonly string $nombreOriginal,
        public readonly string $tipoDato,
        public readonly string $tipoDetectado,
        public readonly bool $esVisible,
        public readonly int $orden,
        public readonly ?array $opciones = null,
    ) {}

    public static function create(
        string $datasetId,
        string $nombreColumna,
        string $nombreOriginal,
        string $tipoDato,
        string $tipoDetectado,
        bool $esVisible = true,
        int $orden = 0,
        ?array $opciones = null
    ): self {
        return new self(
            id: null,
            datasetId: $datasetId,
            nombreColumna: $nombreColumna,
            nombreOriginal: $nombreOriginal,
            tipoDato: $tipoDato,
            tipoDetectado: $tipoDetectado,
            esVisible: $esVisible,
            orden: $orden,
            opciones: $opciones,
        );
    }

    public function update(
        ?string $tipoDato = null,
        ?bool $esVisible = null,
        ?string $nombreColumna = null
    ): self {
        return new self(
            id: $this->id,
            datasetId: $this->datasetId,
            nombreColumna: $nombreColumna ?? $this->nombreColumna,
            nombreOriginal: $this->nombreOriginal,
            tipoDato: $tipoDato ?? $this->tipoDato,
            tipoDetectado: $this->tipoDetectado,
            esVisible: $esVisible ?? $this->esVisible,
            orden: $this->orden,
            opciones: $this->opciones,
        );
    }

    public function isNumerico(): bool
    {
        return $this->tipoDato === self::TIPO_NUMERICO;
    }

    public function isCategorico(): bool
    {
        return $this->tipoDato === self::TIPO_CATEGORICO;
    }

    public function isFecha(): bool
    {
        return $this->tipoDato === self::TIPO_FECHA;
    }

    public function toArray(): array
    {
        return [
            'id' => $this->id,
            'dataset_id' => $this->datasetId,
            'nombre_columna' => $this->nombreColumna,
            'nombre_original' => $this->nombreOriginal,
            'tipo_dato' => $this->tipoDato,
            'tipo_detectado' => $this->tipoDetectado,
            'es_visible' => $this->esVisible,
            'orden' => $this->orden,
            'opciones' => $this->opciones,
        ];
    }
}
