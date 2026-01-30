<?php

namespace App\Services;

use App\Models\Dataset;
use App\Models\RegistroDato;
use App\Models\VariableMetadato;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Maatwebsite\Excel\Facades\Excel;
use PhpOffice\PhpSpreadsheet\IOFactory;
use PhpOffice\PhpSpreadsheet\Shared\Date as ExcelDate;

class ExcelImportService
{
    /**
     * Número de filas a analizar para detectar tipos
     */
    protected int $sampleSize = 100;

    /**
     * Umbral para detectar categóricos (% de valores únicos)
     */
    protected float $categoricalThreshold = 0.2;

    /**
     * Analiza un archivo Excel y detecta los tipos de columnas
     */
    public function analizar(Dataset $dataset): array
    {
        $path = storage_path('app/datasets/' . $dataset->nombre_archivo);
        
        if (!file_exists($path)) {
            throw new \Exception('Archivo no encontrado: ' . $dataset->nombre_archivo);
        }

        $spreadsheet = IOFactory::load($path);
        $worksheet = $spreadsheet->getActiveSheet();
        $highestRow = $worksheet->getHighestRow();
        $highestColumn = $worksheet->getHighestColumn();

        // Obtener encabezados (primera fila)
        $headers = [];
        $headerRow = $worksheet->rangeToArray('A1:' . $highestColumn . '1', null, true, true, true)[1];
        
        foreach ($headerRow as $col => $value) {
            if ($value !== null && $value !== '') {
                $headers[$col] = $this->normalizarNombreColumna($value);
            }
        }

        if (empty($headers)) {
            throw new \Exception('El archivo no tiene encabezados válidos');
        }

        // Leer datos de muestra para análisis
        $sampleRows = min($this->sampleSize, $highestRow - 1);
        $endRow = $sampleRows + 1;
        
        $dataRange = $worksheet->rangeToArray('A2:' . $highestColumn . $endRow, null, true, true, true);

        // Analizar cada columna
        $columnas = [];
        $columnIndex = 0;

        foreach ($headers as $col => $nombreColumna) {
            $valores = [];
            foreach ($dataRange as $row) {
                if (isset($row[$col])) {
                    $valores[] = $row[$col];
                }
            }

            $tipoDetectado = $this->detectarTipo($valores);
            
            // Obtener valores únicos para categóricos
            $opciones = null;
            if ($tipoDetectado === 'CATEGORICO') {
                $opciones = array_values(array_unique(array_filter($valores, fn($v) => $v !== null && $v !== '')));
                sort($opciones);
            }

            $columnas[] = [
                'nombre_columna' => $nombreColumna,
                'nombre_original' => $headerRow[$col],
                'tipo_detectado' => $tipoDetectado,
                'tipo_dato' => $tipoDetectado, // Usuario puede cambiar
                'es_visible' => true,
                'orden' => $columnIndex,
                'opciones' => $opciones,
                'muestra_valores' => array_slice(array_filter($valores, fn($v) => $v !== null), 0, 5),
            ];

            $columnIndex++;
        }

        // Obtener preview de datos
        $preview = [];
        $previewRows = min(10, count($dataRange));
        $rowIndex = 0;

        foreach ($dataRange as $row) {
            if ($rowIndex >= $previewRows) break;
            
            $fila = [];
            foreach ($headers as $col => $nombreColumna) {
                $fila[$nombreColumna] = $row[$col] ?? null;
            }
            $preview[] = $fila;
            $rowIndex++;
        }

        return [
            'columnas' => $columnas,
            'preview' => $preview,
            'total_filas' => $highestRow - 1,
        ];
    }

    /**
     * Importa los datos confirmados al sistema
     */
    public function importar(Dataset $dataset, array $columnasConfirmadas): array
    {
        $path = storage_path('app/datasets/' . $dataset->nombre_archivo);
        $spreadsheet = IOFactory::load($path);
        $worksheet = $spreadsheet->getActiveSheet();
        $highestRow = $worksheet->getHighestRow();
        $highestColumn = $worksheet->getHighestColumn();

        // Obtener encabezados
        $headerRow = $worksheet->rangeToArray('A1:' . $highestColumn . '1', null, true, true, true)[1];
        
        $headers = [];
        foreach ($headerRow as $col => $value) {
            if ($value !== null && $value !== '') {
                $headers[$col] = $this->normalizarNombreColumna($value);
            }
        }

        // Crear mapeo de columnas confirmadas
        $columnasMap = [];
        foreach ($columnasConfirmadas as $columna) {
            $columnasMap[$columna['nombre_columna']] = $columna;
        }

        // Guardar metadatos de variables
        DB::transaction(function () use ($dataset, $columnasMap, $headers) {
            // Eliminar metadatos anteriores si existen
            $dataset->variablesMetadatos()->delete();

            foreach ($columnasMap as $nombreColumna => $columna) {
                VariableMetadato::create([
                    'dataset_id' => $dataset->id,
                    'nombre_columna' => $nombreColumna,
                    'nombre_original' => $columna['nombre_original'] ?? $nombreColumna,
                    'tipo_dato' => $columna['tipo_dato'],
                    'tipo_detectado' => $columna['tipo_detectado'] ?? $columna['tipo_dato'],
                    'es_visible' => $columna['es_visible'] ?? true,
                    'orden' => $columna['orden'] ?? 0,
                    'opciones' => $columna['opciones'] ?? null,
                ]);
            }
        });

        // Importar datos en lotes
        $batchSize = 500;
        $totalRegistros = 0;

        DB::transaction(function () use ($dataset, $worksheet, $highestRow, $highestColumn, $headers, $columnasMap, $batchSize, &$totalRegistros) {
            // Eliminar registros anteriores si existen
            $dataset->registrosDatos()->delete();

            $batch = [];

            for ($row = 2; $row <= $highestRow; $row++) {
                $rowData = $worksheet->rangeToArray('A' . $row . ':' . $highestColumn . $row, null, true, true, true)[$row];
                
                $registro = [];
                foreach ($headers as $col => $nombreColumna) {
                    if (!isset($columnasMap[$nombreColumna])) continue;
                    
                    $valor = $rowData[$col] ?? null;
                    $tipoDato = $columnasMap[$nombreColumna]['tipo_dato'];
                    
                    // Convertir valor según tipo
                    $registro[$nombreColumna] = $this->convertirValor($valor, $tipoDato);
                }

                if (!empty(array_filter($registro, fn($v) => $v !== null))) {
                    $batch[] = [
                        'dataset_id' => $dataset->id,
                        'data' => json_encode($registro),
                        'created_at' => now(),
                        'updated_at' => now(),
                    ];
                    $totalRegistros++;
                }

                // Insertar lote
                if (count($batch) >= $batchSize) {
                    RegistroDato::insert($batch);
                    $batch = [];
                }
            }

            // Insertar registros restantes
            if (!empty($batch)) {
                RegistroDato::insert($batch);
            }
        });

        // Actualizar estado del dataset
        $dataset->update([
            'estado' => 'COMPLETADO',
            'total_registros' => $totalRegistros,
        ]);

        return [
            'total_registros' => $totalRegistros,
        ];
    }

    /**
     * Detecta el tipo de dato de una columna basándose en los valores
     */
    protected function detectarTipo(array $valores): string
    {
        $valoresNoVacios = array_filter($valores, fn($v) => $v !== null && $v !== '');
        
        if (empty($valoresNoVacios)) {
            return 'TEXTO';
        }

        $total = count($valoresNoVacios);
        $numericos = 0;
        $fechas = 0;

        foreach ($valoresNoVacios as $valor) {
            // Verificar si es numérico
            if (is_numeric($valor)) {
                $numericos++;
                continue;
            }

            // Verificar si es fecha de Excel
            if (is_float($valor) && $valor > 25569 && $valor < 50000) {
                $fechas++;
                continue;
            }

            // Verificar patrones de fecha
            if ($this->esFecha($valor)) {
                $fechas++;
            }
        }

        // 80% o más son numéricos
        if ($numericos / $total >= 0.8) {
            return 'NUMERICO';
        }

        // 80% o más son fechas
        if ($fechas / $total >= 0.8) {
            return 'FECHA';
        }

        // Verificar si es categórico (pocos valores únicos)
        $unicos = array_unique($valoresNoVacios);
        if (count($unicos) / $total <= $this->categoricalThreshold && count($unicos) <= 50) {
            return 'CATEGORICO';
        }

        return 'TEXTO';
    }

    /**
     * Verifica si un valor parece ser una fecha
     */
    protected function esFecha($valor): bool
    {
        if (!is_string($valor)) {
            return false;
        }

        // Patrones comunes de fecha
        $patrones = [
            '/^\d{4}-\d{2}-\d{2}$/',                    // 2024-01-15
            '/^\d{2}\/\d{2}\/\d{4}$/',                  // 15/01/2024
            '/^\d{2}-\d{2}-\d{4}$/',                    // 15-01-2024
            '/^\d{1,2}\s+\w+\s+\d{4}$/',               // 15 enero 2024
            '/^\d{4}\/\d{2}\/\d{2}$/',                  // 2024/01/15
        ];

        foreach ($patrones as $patron) {
            if (preg_match($patron, trim($valor))) {
                return true;
            }
        }

        return false;
    }

    /**
     * Convierte un valor al tipo especificado
     */
    protected function convertirValor($valor, string $tipo): mixed
    {
        if ($valor === null || $valor === '') {
            return null;
        }

        switch ($tipo) {
            case 'NUMERICO':
                if (is_numeric($valor)) {
                    return floatval($valor);
                }
                // Intentar limpiar formato numérico
                $limpio = preg_replace('/[^0-9.\-]/', '', (string) $valor);
                return is_numeric($limpio) ? floatval($limpio) : null;

            case 'FECHA':
                // Si es número de Excel, convertir
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

    /**
     * Normaliza el nombre de una columna para uso interno
     */
    protected function normalizarNombreColumna(string $nombre): string
    {
        // Remover caracteres especiales y normalizar
        $normalizado = Str::slug($nombre, '_');
        
        // Asegurar que no empiece con número
        if (preg_match('/^\d/', $normalizado)) {
            $normalizado = 'col_' . $normalizado;
        }

        // Si está vacío, generar nombre genérico
        if (empty($normalizado)) {
            $normalizado = 'columna_' . Str::random(4);
        }

        return $normalizado;
    }
}
