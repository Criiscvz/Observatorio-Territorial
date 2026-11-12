<?php

declare(strict_types=1);

namespace App\Presentation\Http\Responses;

use App\Application\Publicaciones\PublicationPdf;
use App\Infrastructure\Services\PublicationPdfStorage;
use Symfony\Component\HttpFoundation\StreamedResponse;

final class PublicationPdfResponse
{
    public function __construct(private readonly PublicationPdfStorage $storage) {}

    public function make(PublicationPdf $file): StreamedResponse
    {
        $stream = $this->storage->readStream($file->path);
        $filename = str_replace('"', '\"', $file->filename);

        return response()->stream(function () use ($stream): void {
            try { fpassthru($stream); }
            finally { fclose($stream); }
        }, 200, [
            'Content-Type' => 'application/pdf',
            'Cache-Control' => 'private, no-store',
            'X-Content-Type-Options' => 'nosniff',
            'Content-Disposition' => 'inline; filename="'.$filename.'"',
        ]);
    }
}
