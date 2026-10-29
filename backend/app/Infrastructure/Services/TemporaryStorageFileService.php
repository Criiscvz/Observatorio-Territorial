<?php

declare(strict_types=1);

namespace App\Infrastructure\Services;

use Illuminate\Support\Facades\Storage;
use RuntimeException;

/**
 * Materializes an object-storage file in /tmp for libraries that require a
 * local pathname (PhpSpreadsheet). Callers must remove the returned file.
 */
class TemporaryStorageFileService
{
    public function download(string $path): string
    {
        $stream = Storage::disk(config('filesystems.default'))->readStream($path);

        if ($stream === false) {
            throw new RuntimeException("No se pudo leer el archivo almacenado: {$path}");
        }

        $temporaryPath = tempnam(sys_get_temp_dir(), 'observatorio-dataset-');

        if ($temporaryPath === false) {
            fclose($stream);
            throw new RuntimeException('No se pudo crear un archivo temporal para el dataset.');
        }

        $temporaryStream = fopen($temporaryPath, 'wb');

        if ($temporaryStream === false) {
            fclose($stream);
            @unlink($temporaryPath);
            throw new RuntimeException('No se pudo abrir el archivo temporal para el dataset.');
        }

        stream_copy_to_stream($stream, $temporaryStream);
        fclose($stream);
        fclose($temporaryStream);

        return $temporaryPath;
    }
}
