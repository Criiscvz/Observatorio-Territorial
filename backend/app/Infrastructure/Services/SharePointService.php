<?php

declare(strict_types=1);

namespace App\Infrastructure\Services;

use Illuminate\Http\Client\PendingRequest;
use Illuminate\Support\Facades\Http;
use RuntimeException;

class SharePointService
{
    private const GRAPH_BASE_URL = 'https://graph.microsoft.com/v1.0';

    public function listFolderFiles(): array
    {
        return $this->listPdfFiles();
    }

    public function listPdfFiles(): array
    {
        $path = $this->folderPath();
        $endpoint = $path === ''
            ? "/drives/{$this->driveId()}/root/children"
            : "/drives/{$this->driveId()}/root:/{$path}:/children";

        $response = $this->graph()->get($endpoint);

        if ($response->failed()) {
            throw new RuntimeException('No se pudieron listar archivos de SharePoint: '.$response->body());
        }

        return collect($response->json('value', []))
            ->filter(fn(array $item) => isset($item['file']))
            ->filter(function (array $item) {
                $name = strtolower((string) ($item['name'] ?? ''));
                $mimeType = strtolower((string) ($item['file']['mimeType'] ?? ''));

                return str_ends_with($name, '.pdf') || $mimeType === 'application/pdf';
            })
            ->map(fn(array $item) => $this->mapDriveItem($item))
            ->values()
            ->all();
    }

    public function listPowerBiLinks(): array
    {
        $path = $this->folderPath();
        $endpoint = $path === ''
            ? "/drives/{$this->driveId()}/root/children"
            : "/drives/{$this->driveId()}/root:/{$path}:/children";

        $response = $this->graph()->get($endpoint);

        if ($response->failed()) {
            throw new RuntimeException('No se pudieron listar enlaces de SharePoint: '.$response->body());
        }

        return collect($response->json('value', []))
            ->filter(fn(array $item) => isset($item['file']))
            ->map(fn(array $item) => $this->mapPowerBiItem($item))
            ->filter()
            ->values()
            ->all();
    }

    public function getFile(string $fileId): array
    {
        $response = $this->graph()->get("/drives/{$this->driveId()}/items/{$fileId}");

        if ($response->failed()) {
            throw new RuntimeException('No se pudo obtener el archivo de SharePoint: '.$response->body());
        }

        $item = $response->json();
        if (! isset($item['file'])) {
            throw new RuntimeException('El elemento seleccionado no es un archivo de SharePoint.');
        }

        return $this->mapDriveItem($item);
    }

    public function getPowerBiLink(string $fileId): array
    {
        $response = $this->graph()->get("/drives/{$this->driveId()}/items/{$fileId}");

        if ($response->failed()) {
            throw new RuntimeException('No se pudo obtener el enlace de SharePoint: '.$response->body());
        }

        $item = $response->json();
        $mapped = $this->mapPowerBiItem($item);
        if (! $mapped) {
            throw new RuntimeException('El elemento seleccionado no contiene una URL de Power BI valida.');
        }

        return $mapped;
    }

    private function graph(): PendingRequest
    {
        return Http::withToken($this->accessToken())
            ->acceptJson()
            ->baseUrl(self::GRAPH_BASE_URL);
    }

    private function accessToken(): string
    {
        $tenantId = $this->requiredConfig('tenant_id');
        $response = Http::asForm()->post(
            "https://login.microsoftonline.com/{$tenantId}/oauth2/v2.0/token",
            [
                'client_id' => $this->requiredConfig('client_id'),
                'client_secret' => $this->requiredConfig('client_secret'),
                'scope' => 'https://graph.microsoft.com/.default',
                'grant_type' => 'client_credentials',
            ],
        );

        if ($response->failed()) {
            throw new RuntimeException('No se pudo obtener token de Microsoft Graph: '.$response->body());
        }

        $token = $response->json('access_token');
        if (! is_string($token) || $token === '') {
            throw new RuntimeException('Microsoft Graph no devolvio access_token.');
        }

        return $token;
    }

    private function folderPath(): string
    {
        $folder = trim((string) config('services.sharepoint.folder_path', ''), '/');

        return collect($folder === '' ? [] : explode('/', $folder))
            ->map(fn(string $segment) => rawurlencode($segment))
            ->implode('/');
    }

    private function driveId(): string
    {
        return $this->requiredConfig('drive_id');
    }

    private function mapDriveItem(array $item): array
    {
        return [
            'id' => $item['id'] ?? null,
            'name' => $item['name'] ?? null,
            'web_url' => $item['webUrl'] ?? null,
            'mime_type' => $item['file']['mimeType'] ?? null,
            'size' => $item['size'] ?? null,
            'created_at' => $item['createdDateTime'] ?? null,
            'last_modified_at' => $item['lastModifiedDateTime'] ?? null,
            'created_by' => $item['createdBy']['user']['displayName'] ?? null,
        ];
    }

    private function mapPowerBiItem(array $item): ?array
    {
        $name = (string) ($item['name'] ?? '');
        $mimeType = strtolower((string) ($item['file']['mimeType'] ?? ''));
        $extension = strtolower(pathinfo($name, PATHINFO_EXTENSION));

        if ($extension === 'pdf' || $mimeType === 'application/pdf') {
            return null;
        }

        if (! in_array($extension, ['url', 'txt', 'link', 'webloc'], true)
            && ! str_contains(strtolower($name), 'powerbi')
            && ! str_contains(strtolower((string) ($item['webUrl'] ?? '')), 'powerbi.com')) {
            return null;
        }

        $url = $this->extractPowerBiUrl($item);
        if (! $url) {
            return null;
        }

        return [
            ...$this->mapDriveItem($item),
            'powerbi_url' => $url,
        ];
    }

    private function extractPowerBiUrl(array $item): ?string
    {
        $webUrl = (string) ($item['webUrl'] ?? '');
        if ($this->isPowerBiUrl($webUrl)) {
            return $webUrl;
        }

        $id = (string) ($item['id'] ?? '');
        if ($id === '') {
            return null;
        }

        $response = $this->graph()->get("/drives/{$this->driveId()}/items/{$id}/content");
        if ($response->failed()) {
            return null;
        }

        preg_match('/https?:\/\/[^\s"\'<>]+/i', $response->body(), $matches);
        $url = $matches[0] ?? null;

        return $this->isPowerBiUrl((string) $url) ? $url : null;
    }

    private function isPowerBiUrl(string $url): bool
    {
        return filter_var($url, FILTER_VALIDATE_URL) !== false
            && str_contains(strtolower(parse_url($url, PHP_URL_HOST) ?: ''), 'powerbi.com');
    }

    private function requiredConfig(string $key): string
    {
        $value = config("services.sharepoint.{$key}");
        if (! is_string($value) || trim($value) === '') {
            throw new RuntimeException("Falta configurar services.sharepoint.{$key}.");
        }

        return $value;
    }
}
