<?php

declare(strict_types=1);

namespace App\Providers;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\ServiceProvider;

/** Only copied by Dockerfile.e2e. Real SharePointService/importer/storage remain in use. */
final class E2EGraphProvider extends ServiceProvider
{
    public function boot(): void
    {
        if (getenv('OBSERVATORIO_E2E') !== '1'
            || config('database.connections.pgsql.host') !== 'postgres'
            || config('database.connections.pgsql.database') !== 'observatorio_portable_test'
            || config('app.url') !== 'http://localhost:4500') {
            throw new \RuntimeException('Isolated E2E environment required.');
        }
        // APP_ENV stays production: the real HTTP CSRF middleware must remain active.
        config(['services.sharepoint.tenant_id' => 'e2e-tenant', 'services.sharepoint.client_id' => 'e2e-client',
            'services.sharepoint.client_secret' => str_repeat('e', 32), 'services.sharepoint.drive_id' => 'e2e-drive',
            'services.sharepoint.folder_path' => '', 'services.sharepoint.barometer_folder_path' => 'e2e',
            'services.sharepoint.verify_pdf_content' => true]);
        Http::preventStrayRequests();
        Http::fake(function ($request) {
            $url = $request->url();
            if ($url === 'https://login.microsoftonline.com/e2e-tenant/oauth2/v2.0/token') {
                return Http::response(['access_token' => str_repeat('e', 32), 'expires_in' => 3600]);
            }
            if (! str_starts_with($url, 'https://graph.microsoft.com/v1.0/drives/e2e-drive/')) {
                throw new \RuntimeException('Unexpected outbound request in E2E.');
            }
            $path = parse_url($url, PHP_URL_PATH);
            $root = ['id' => 'e2e-root', 'name' => 'Biblioteca E2E', 'folder' => ['childCount' => 1],
                'webUrl' => 'https://synthetic.sharepoint.com/e2e'];
            $file = ['id' => 'e2e-pdf', 'name' => 'Importacion E2E.pdf', 'file' => ['mimeType' => 'application/pdf'],
                'parentReference' => ['id' => 'e2e-root', 'driveId' => 'e2e-drive'], 'size' => strlen(self::pdf()),
                'webUrl' => 'https://synthetic.sharepoint.com/e2e/importacion.pdf',
                'createdDateTime' => '2026-11-05T12:00:00Z', 'lastModifiedDateTime' => '2026-11-05T12:00:00Z'];
            if (str_ends_with($path, '/content')) return Http::response(self::pdf(), 200, ['Content-Type' => 'application/pdf']);
            if (str_ends_with($path, '/children')) return Http::response(['value' => [$file]]);
            if (str_ends_with($path, '/items/e2e-pdf')) return Http::response($file);
            if (str_ends_with($path, '/root') || str_ends_with($path, '/root:/e2e:') || str_ends_with($path, '/items/e2e-root')) return Http::response($root);
            throw new \RuntimeException('Unexpected Graph resource in E2E.');
        });
    }

    public static function pdf(): string
    {
        $stream = "BT /F1 18 Tf 30 150 Td (Documento sintetico E2E) Tj ET";
        $page = '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 400 300] /Resources << /Font << /F1 6 0 R >> >> /Contents 5 0 R >>';
        $objects = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R 4 0 R] /Count 2 >>',
            $page, $page, '<< /Length '.strlen($stream)." >>\nstream\n".$stream."\nendstream", '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'];
        $pdf = "%PDF-1.4\n"; $offsets = [0];
        foreach ($objects as $i => $object) { $offsets[] = strlen($pdf); $pdf .= ($i + 1)." 0 obj\n".$object."\nendobj\n"; }
        $xref = strlen($pdf); $pdf .= "xref\n0 7\n0000000000 65535 f \n";
        foreach (array_slice($offsets, 1) as $offset) $pdf .= sprintf("%010d 00000 n \n", $offset);
        return $pdf."trailer\n<< /Size 7 /Root 1 0 R >>\nstartxref\n".$xref."\n%%EOF\n";
    }
}
