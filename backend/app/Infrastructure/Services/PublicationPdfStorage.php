<?php

declare(strict_types=1);

namespace App\Infrastructure\Services;

use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use RuntimeException;

/** Private PDF storage and stream ownership; does not decide publication access. */
class PublicationPdfStorage
{
    public function __construct(private readonly SharePointService $sharePointService) {}

    /** Required removal before a native publication may be deleted; failure preserves its row. */
    public function deleteStored(string $path): void
    {
        try {
            $disk = Storage::disk(config('filesystems.default'));
            $deleted = ! $disk->exists($path) || $disk->delete($path);
        } catch (\Throwable $exception) {
            Log::error('PUBLICATION_PDF_DELETE_FAILED', ['exception' => $exception::class]);
            $deleted = false;
        }
        abort_unless($deleted, 503, 'No se pudo eliminar el PDF del almacenamiento. El registro se conserva para volver a intentarlo.');
    }

    /** Compensate an uncommitted copy without masking the original database/storage failure. */
    public function discard(string $path): void
    {
        try {
            if (! Storage::disk(config('filesystems.default'))->delete($path)) {
                Log::warning('PUBLICATION_PDF_CLEANUP_UNCONFIRMED');
            }
        } catch (\Throwable $exception) {
            Log::warning('PUBLICATION_PDF_CLEANUP_FAILED', ['exception' => $exception::class]);
        }
    }

    /** @return resource The caller closes the stream after sending the response. */
    public function readStream(string $path)
    {
        $diskName = (string) config('filesystems.default');
        $disk = null;
        try {
            $disk = Storage::disk($diskName);
            // Laravel's throw=false wrapper discards the provider exception.
            // Read through Flysystem so an outage is not mistaken for a missing PDF.
            $stream = $disk->getDriver()->readStream($path);
            if (! is_resource($stream)) {
                throw new RuntimeException('Unconfirmed PDF read.');
            }

            return $stream;
        } catch (\Throwable $exception) {
            if ($this->isMissingPdf($exception, $disk, $path)) {
                abort(404, 'Archivo no disponible. Un administrador debe volver a subir el PDF.');
            }

            $context = ['disk' => $diskName, 'exception' => get_class($exception)];
            for ($cause = $exception; $cause !== null; $cause = $cause->getPrevious()) {
                if ($cause instanceof \Aws\Exception\AwsException) {
                    $code = $cause->getAwsErrorCode();
                    $context['s3_code'] = is_string($code) && preg_match('/^[a-zA-Z0-9_]{1,100}$/D', $code) ? $code : 'Unknown';
                    $context['s3_status'] = $cause->getStatusCode();
                    break;
                }
            }
            // Do not log the path, raw exception, response body, URL or credentials.
            Log::error('ATLAS_STORAGE_READ_FAILED', $context);
            abort(503, 'El almacenamiento no está disponible en este momento. Intenta descargar el PDF nuevamente más tarde.');
        }
    }

    private function isMissingPdf(
        \Throwable $exception,
        ?\Illuminate\Filesystem\FilesystemAdapter $disk,
        string $path,
    ): bool {
        if (! $exception instanceof \League\Flysystem\UnableToReadFile) {
            return false;
        }

        for ($cause = $exception; $cause !== null; $cause = $cause->getPrevious()) {
            if ($cause instanceof \Aws\Exception\AwsException) {
                // A bare 404 can also mean NoSuchBucket or a gateway error.
                return $cause->getStatusCode() === 404 && $cause->getAwsErrorCode() === 'NoSuchKey';
            }
        }

        // Local disks (including Storage::fake) have no S3 error code. Confirm
        // absence separately; permission/read failures on existing files are 503.
        try {
            return $disk?->getAdapter() instanceof \League\Flysystem\Local\LocalFilesystemAdapter
                && ! $disk->getDriver()->fileExists($path);
        } catch (\Throwable) {
            return false;
        }
    }

    public function storeUploaded(UploadedFile $file, string $folder): string
    {
        $diskName = (string) config('filesystems.default');
        $stream = null;
        $path = null;
        try {
            if (config("filesystems.disks.{$diskName}.driver") === 's3') {
                // Use Flysystem directly here: Laravel's throw=false adapter discards
                // the S3 exception before this upload handler can diagnose it.
                $path = $folder.'/'.Str::uuid().'.pdf';
                $stream = fopen($file->getRealPath(), 'rb');
                if (! is_resource($stream)) {
                    throw new RuntimeException('No se pudo leer el archivo temporal.');
                }
                Storage::disk($diskName)->getDriver()->writeStream($path, $stream, ['mimetype' => 'application/pdf']);
            } else {
                $path = $file->storeAs($folder, Str::uuid().'.pdf', $diskName);
            }
        } catch (\Throwable $exception) {
            $context = ['disk' => $diskName, 'exception' => get_class($exception)];
            for ($cause = $exception; $cause !== null; $cause = $cause->getPrevious()) {
                if ($cause instanceof \Aws\Exception\AwsException) {
                    $code = $cause->getAwsErrorCode();
                    $context['s3_code'] = is_string($code) && preg_match('/^[a-zA-Z0-9_]{1,100}$/D', $code) ? $code : 'Unknown';
                    $context['s3_status'] = $cause->getStatusCode();
                    break;
                }
            }
            // Never log raw exception messages, URLs, request bodies or credentials.
            Log::error('ATLAS_STORAGE_WRITE_FAILED', $context);
            if (is_string($path) && $path !== '') $this->discard($path);
            $path = false;
        } finally {
            if (is_resource($stream)) {
                fclose($stream);
            }
        }
        if (! is_string($path) || $path === '') {
            Log::error('ATLAS_STORAGE_WRITE_UNCONFIRMED', ['disk' => $diskName]);
        }
        abort_unless(is_string($path) && $path !== '', 503,
            'No se pudo guardar el PDF en el almacenamiento. Revisa la configuración del servidor e intenta nuevamente. La publicación no se ha guardado.');

        return $path;
    }

    public function copyFromSharePoint(array $file, ?string $departmentId): string
    {
        if ((int) ($file['size'] ?? 0) > 20 * 1024 * 1024) throw new RuntimeException('El PDF supera el máximo de 20 MB.');
        $temporary = $this->sharePointService->downloadPdf((string) $file['id']);
        try {
            return $this->storeUploaded(new UploadedFile($temporary, (string) $file['name'], 'application/pdf', null, true),
                'publicaciones/'.($departmentId ?? 'atlas').'/sharepoint');
        } finally {
            @unlink($temporary);
        }
    }
}
