<?php

declare(strict_types=1);

namespace App\Infrastructure\Services;

use Illuminate\Support\Str;
use App\Domain\Dataset\Exceptions\InvalidImportSchema;
use App\Domain\Dataset\ImportLimits;
use PhpOffice\PhpSpreadsheet\IOFactory;
use PhpOffice\PhpSpreadsheet\Shared\Date as ExcelDate;

class ExcelReaderService
{
    protected int $sampleSize = 100;
    protected float $categoricalThreshold = 0.2;

    public function analyze(string $filePath): array
    {
        if (!file_exists($filePath)) {
            throw new \Exception('Archivo no encontrado: ' . basename($filePath));
        }

        $spreadsheet = IOFactory::load($filePath);
        try {
            $worksheet = $spreadsheet->getActiveSheet();
            $highestRow = $worksheet->getHighestRow();
            $highestColumn = $worksheet->getHighestColumn();

            $headers = $this->extractHeaders($worksheet, $highestColumn);

            if (empty($headers)) {
                throw new InvalidImportSchema('archivo', 'El archivo no tiene encabezados válidos');
            }

            $sampleRows = min($this->sampleSize, $highestRow - 1);
            $endRow = $sampleRows + 1;
            $dataRange = $worksheet->rangeToArray('A2:' . $highestColumn . $endRow, null, true, true, true);

            $columnas = $this->analyzeColumns($headers, $dataRange);
            $preview = $this->extractPreview($headers, $dataRange);

            return [
                'columnas' => $columnas,
                'preview' => $preview,
                'total_filas' => $highestRow - 1,
            ];
        } finally {
            $spreadsheet->disconnectWorksheets();
        }
    }

    public function import(string $filePath, array $columnasConfirmadas): \Generator
    {
        $spreadsheet = IOFactory::load($filePath);
        try {
            $worksheet = $spreadsheet->getActiveSheet();
            $highestRow = $worksheet->getHighestRow();
            $highestColumn = $worksheet->getHighestColumn();

            $headers = $this->extractHeaders($worksheet, $highestColumn);

            $columnasMap = [];
            $targetNames = [];
            foreach ($columnasConfirmadas as $columna) {
                // The form permits renaming a column. Resolve its immutable original
                // header to a source position, then write using the chosen output name.
                $source = array_search($columna['nombre_original'] ?? $columna['nombre_columna'],
                    array_map(fn ($header) => isset($columna['nombre_original']) ? Str::trim($header['original']) : $header['normalized'], $headers), true);
                if ($source === false || isset($columnasMap[$source]) || isset($targetNames[$columna['nombre_columna']])) {
                    throw new InvalidImportSchema('columnas', 'Las columnas deben ser únicas y pertenecer al archivo seleccionado.');
                }
                $columnasMap[$source] = $columna;
                $targetNames[$columna['nombre_columna']] = true;
            }

            for ($row = 2; $row <= $highestRow; $row++) {
                $rowData = $worksheet->rangeToArray('A' . $row . ':' . $highestColumn . $row, null, true, true, true)[$row];

                $registro = [];
                foreach ($columnasMap as $col => $column) {
                    $valor = $rowData[$col] ?? null;
                    $tipoDato = $column['tipo_dato'];

                    $registro[$column['nombre_columna']] = $this->convertValue($valor, $tipoDato);
                }

                if (!empty(array_filter($registro, fn($v) => $v !== null))) {
                    yield $registro;
                }
            }
        } finally {
            $spreadsheet->disconnectWorksheets();
        }
    }

    private function extractHeaders($worksheet, string $highestColumn): array
    {
        $headers = [];
        $names = [];
        $headerRow = $worksheet->rangeToArray('A1:' . $highestColumn . '1', null, true, true, true)[1];

        foreach ($headerRow as $col => $value) {
            if ($value !== null && $value !== '') {
                $value = (string) $value;
                if (! mb_check_encoding($value, 'UTF-8') || str_contains($value, "\0") || mb_strlen($value) > 255) {
                    throw new InvalidImportSchema('archivo', 'Los encabezados deben ser texto válido de hasta 255 caracteres, sin caracteres nulos.');
                }
                $normalized = $this->normalizeColumnName($value);
                if (isset($names[$normalized]) || count($headers) >= ImportLimits::MAX_COLUMNS || strlen($normalized) > 255) {
                    throw new InvalidImportSchema('archivo', 'El archivo admite hasta 200 columnas con encabezados normalizados únicos de hasta 255 caracteres.');
                }
                $names[$normalized] = true;
                $headers[$col] = [
                    'normalized' => $normalized,
                    'original' => $value,
                ];
            }
        }

        return $headers;
    }

    private function analyzeColumns(array $headers, array $dataRange): array
    {
        $columnas = [];
        $columnIndex = 0;

        foreach ($headers as $col => $header) {
            $valores = [];
            foreach ($dataRange as $row) {
                if (isset($row[$col])) {
                    $valores[] = $row[$col];
                }
            }

            $tipoDetectado = $this->detectType($valores);

            $opciones = null;
            if ($tipoDetectado === 'CATEGORICO') {
                $opciones = array_values(array_unique(array_filter($valores, fn($v) => $v !== null && $v !== '')));
                sort($opciones);
            } elseif ($tipoDetectado === 'TEXTO') {
                // For TEXTO: extract top frequent values for filter dropdowns
                $uniqueValues = array_filter($valores, fn($v) => $v !== null && $v !== '');
                $uniqueCount = count(array_unique($uniqueValues));

                if ($uniqueCount <= 100) {
                    // Few unique values: store all (similar to CATEGORICO)
                    $opciones = array_values(array_unique($uniqueValues));
                    sort($opciones);
                } elseif ($uniqueCount > 100) {
                    // Many unique values: store top 50 most frequent
                    $freq = array_count_values(array_map('strval', $uniqueValues));
                    arsort($freq);
                    $opciones = array_values(array_slice(array_keys($freq), 0, 50));
                }
            }

            $columnas[] = [
                'nombre_columna' => $header['normalized'],
                'nombre_original' => $header['original'],
                'tipo_detectado' => $tipoDetectado,
                'tipo_dato' => $tipoDetectado,
                'es_visible' => true,
                'orden' => $columnIndex,
                'opciones' => $opciones,
                'muestra_valores' => array_slice(array_filter($valores, fn($v) => $v !== null), 0, 5),
            ];

            $columnIndex++;
        }

        return $columnas;
    }

    private function extractPreview(array $headers, array $dataRange): array
    {
        $preview = [];
        $previewRows = min(10, count($dataRange));
        $rowIndex = 0;

        foreach ($dataRange as $row) {
            if ($rowIndex >= $previewRows) break;

            $fila = [];
            foreach ($headers as $col => $header) {
                $fila[$header['normalized']] = $row[$col] ?? null;
            }
            $preview[] = $fila;
            $rowIndex++;
        }

        return $preview;
    }

    private function detectType(array $valores): string
    {
        $valoresNoVacios = array_filter($valores, fn($v) => $v !== null && $v !== '');

        if (empty($valoresNoVacios)) {
            return 'TEXTO';
        }

        $total = count($valoresNoVacios);
        $numericos = 0;
        $fechas = 0;

        foreach ($valoresNoVacios as $valor) {
            if (is_numeric($valor)) {
                $numericos++;
                continue;
            }

            if (is_float($valor) && $valor > 25569 && $valor < 50000) {
                $fechas++;
                continue;
            }

            if ($this->isDate($valor)) {
                $fechas++;
            }
        }

        if ($numericos / $total >= 0.8) {
            return 'NUMERICO';
        }

        if ($fechas / $total >= 0.8) {
            return 'FECHA';
        }

        $unicos = array_unique($valoresNoVacios);
        if (count($unicos) / $total <= $this->categoricalThreshold && count($unicos) <= 50) {
            return 'CATEGORICO';
        }

        return 'TEXTO';
    }

    private function isDate($valor): bool
    {
        if (!is_string($valor)) {
            return false;
        }

        $patrones = [
            '/^\d{4}-\d{2}-\d{2}$/',
            '/^\d{2}\/\d{2}\/\d{4}$/',
            '/^\d{2}-\d{2}-\d{4}$/',
            '/^\d{1,2}\s+\w+\s+\d{4}$/',
            '/^\d{4}\/\d{2}\/\d{2}$/',
        ];

        foreach ($patrones as $patron) {
            if (preg_match($patron, trim($valor))) {
                return true;
            }
        }

        return false;
    }

    private function convertValue($valor, string $tipo): mixed
    {
        if ($valor === null || $valor === '') {
            return null;
        }

        switch ($tipo) {
            case 'NUMERICO':
                if (is_numeric($valor)) {
                    return floatval($valor);
                }
                $limpio = preg_replace('/[^0-9.\-]/', '', (string) $valor);
                return is_numeric($limpio) ? floatval($limpio) : null;

            case 'FECHA':
                if (is_numeric($valor) && $valor > 25569) {
                    try {
                        return ExcelDate::excelToDateTimeObject($valor)->format('Y-m-d');
                    } catch (\Exception $e) {
                        return (string) $valor;
                    }
                }
                return (string) $valor;

            case 'CATEGORICO':
            case 'TEXTO':
            default:
                return trim((string) $valor);
        }
    }

    private function normalizeColumnName(string $nombre): string
    {
        $normalizado = Str::slug($nombre, '_');

        if (preg_match('/^\d/', $normalizado)) {
            $normalizado = 'col_' . $normalizado;
        }

        if ($normalizado === '') {
            throw new InvalidImportSchema('archivo', 'Cada encabezado debe contener letras o números para identificar su columna.');
        }

        return $normalizado;
    }
}
