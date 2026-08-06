<?php

declare(strict_types=1);

namespace App\Infrastructure\Services;

use Illuminate\Http\Client\PendingRequest;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use RuntimeException;

class SharePointService
{
    private const GRAPH_BASE_URL = 'https://graph.microsoft.com/v1.0';
    private const GRAPH_SELECT = 'id,name,webUrl,size,file,folder,parentReference,lastModifiedDateTime,createdDateTime,createdBy';
    private const CACHE_TTL_SECONDS = 300;
    private const CHILDREN_CACHE_TTL_SECONDS = 120;

    public function listFolderFiles(): array
    {
        return $this->listPdfFiles();
    }

    public function browseAtlasFolder(?string $itemId = null): array
    {
        return $this->browsePdfFolder('folder_path', $itemId);
    }

    public function browseBarometerFolder(?string $itemId = null): array
    {
        return $this->browsePdfFolder('barometer_folder_path', $itemId, true);
    }

    private function browsePdfFolder(string $configKey, ?string $itemId, bool $required = false): array
    {
        $root = $this->configuredRootItem($configKey, $required);
        $folder = $itemId ? $this->getDriveItem($itemId) : $root;

        if (! isset($folder['folder'])) {
            throw new RuntimeException('El elemento seleccionado no es una carpeta de SharePoint.');
        }

        $ancestors = $this->ancestorsToRoot($folder, (string) $root['id']);
        if ($ancestors === []) {
            throw new RuntimeException('La carpeta solicitada esta fuera de la ruta autorizada.');
        }

        return [
            'current' => $this->mapNavigationItem($folder),
            'root' => $this->mapNavigationItem($root),
            'parent' => count($ancestors) > 1 ? $this->mapNavigationItem($ancestors[count($ancestors) - 2]) : null,
            'breadcrumbs' => array_map(fn(array $item) => $this->mapNavigationItem($item), $ancestors),
            'items' => collect($this->listChildren($folder['id']))
                ->filter(fn(array $item) => isset($item['folder']) || $this->isPdfDriveItem($item))
                ->map(fn(array $item) => $this->mapBrowserItem($item))
                ->values()
                ->all(),
        ];
    }

    public function getPdfFileInsideRoot(string $fileId): array
    {
        return $this->getPdfFileInsideConfiguredRoot($fileId, 'folder_path');
    }

    public function getPdfFileInsideBarometerRoot(string $fileId): array
    {
        return $this->getPdfFileInsideConfiguredRoot($fileId, 'barometer_folder_path', true);
    }

    private function getPdfFileInsideConfiguredRoot(
        string $fileId,
        string $configKey,
        bool $required = false,
    ): array {
        $root = $this->configuredRootItem($configKey, $required);
        $item = $this->getDriveItem($fileId);

        if ($this->ancestorsToRoot($item, (string) $root['id']) === []) {
            throw new RuntimeException('El archivo solicitado esta fuera de la ruta autorizada.');
        }

        if (! $this->isPdfDriveItem($item)) {
            throw new RuntimeException('El elemento seleccionado no es un PDF valido.');
        }

        if ((bool) config('services.sharepoint.verify_pdf_content', false)) {
            $this->ensureFileContentIsReadable($fileId);
        }

        return $this->mapDriveItem($item) + [
            'parent_id' => $item['parentReference']['id'] ?? null,
            'parent_path' => $item['parentReference']['path'] ?? null,
        ];
    }

    public function listPdfFiles(): array
    {
        $path = $this->folderPath('folder_path');
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
        $path = $this->folderPath('folder_path');
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
            ->timeout(12)
            ->retry(1, 200)
            ->acceptJson()
            ->baseUrl(self::GRAPH_BASE_URL);
    }

    private function graphAbsolute(): PendingRequest
    {
        return Http::withToken($this->accessToken())
            ->timeout(12)
            ->retry(1, 200)
            ->acceptJson();
    }

    private function accessToken(): string
    {
        $tenantId = $this->requiredConfig('tenant_id');
        $clientId = $this->requiredConfig('client_id');
        $cacheKey = 'sharepoint:graph-token:'.sha1($tenantId.'|'.$clientId);

        $cache = Cache::store('array');
        $cachedToken = $cache->get($cacheKey);
        if (is_string($cachedToken) && $cachedToken !== '') {
            return $cachedToken;
        }

        $response = Http::asForm()->post(
            "https://login.microsoftonline.com/{$tenantId}/oauth2/v2.0/token",
            [
                'client_id' => $clientId,
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

        $expiresIn = (int) $response->json('expires_in', 3600);
        $cache->put($cacheKey, $token, now()->addSeconds(max(60, $expiresIn - 300)));

        return $token;
    }

    private function folderPath(string $configKey, bool $required = false): string
    {
        $folder = trim((string) config("services.sharepoint.{$configKey}", ''), '/');

        if ($required && $folder === '') {
            throw new RuntimeException("Falta configurar services.sharepoint.{$configKey}.");
        }

        return collect($folder === '' ? [] : explode('/', $folder))
            ->map(fn(string $segment) => rawurlencode($segment))
            ->implode('/');
    }

    private function configuredRootItem(string $configKey, bool $required = false): array
    {
        $path = $this->folderPath($configKey, $required);
        $endpoint = $path === ''
            ? "/drives/{$this->driveId()}/root"
            : "/drives/{$this->driveId()}/root:/{$path}:";

        $item = Cache::store('array')->remember(
            'sharepoint:root:'.sha1($this->driveId().'|'.$path),
            self::CACHE_TTL_SECONDS,
            function () use ($endpoint) {
                $response = $this->graph()->get($endpoint, [
                    '$select' => self::GRAPH_SELECT,
                ]);
                if ($response->failed()) {
                    throw new RuntimeException('No se pudo obtener la carpeta raiz autorizada de SharePoint: '.$response->body());
                }

                return $response->json();
            },
        );
        if (! isset($item['folder'])) {
            throw new RuntimeException('La ruta autorizada de SharePoint no apunta a una carpeta.');
        }

        return $item;
    }

    private function getDriveItem(string $itemId): array
    {
        return Cache::store('array')->remember(
            'sharepoint:item:'.sha1($this->driveId().'|'.$itemId),
            self::CACHE_TTL_SECONDS,
            function () use ($itemId) {
                $response = $this->graph()->get("/drives/{$this->driveId()}/items/{$itemId}", [
                    '$select' => self::GRAPH_SELECT,
                ]);
                if ($response->failed()) {
                    throw new RuntimeException('No se pudo obtener el elemento de SharePoint: '.$response->body());
                }

                return $response->json();
            },
        );
    }

    private function listChildren(string $folderId): array
    {
        return Cache::store('array')->remember(
            'sharepoint:children:'.sha1($this->driveId().'|'.$folderId),
            self::CHILDREN_CACHE_TTL_SECONDS,
            fn() => $this->fetchChildren($folderId),
        );
    }

    private function fetchChildren(string $folderId): array
    {
        $items = [];
        $endpoint = "/drives/{$this->driveId()}/items/{$folderId}/children?\$top=200&\$select=".rawurlencode(self::GRAPH_SELECT);

        do {
            $response = str_starts_with($endpoint, 'http')
                ? $this->graphAbsolute()->get($endpoint)
                : $this->graph()->get($endpoint);

            if ($response->failed()) {
                throw new RuntimeException('No se pudo listar la carpeta de SharePoint: '.$response->body());
            }

            $payload = $response->json();
            array_push($items, ...($payload['value'] ?? []));
            $endpoint = $payload['@odata.nextLink'] ?? null;
        } while ($endpoint);

        return $items;
    }

    private function ensureFileContentIsReadable(string $fileId): void
    {
        Cache::store('array')->remember(
            'sharepoint:readable:'.sha1($this->driveId().'|'.$fileId),
            self::CACHE_TTL_SECONDS,
            function () use ($fileId) {
                $this->verifyFileContentIsReadable($fileId);

                return true;
            },
        );
    }

    private function verifyFileContentIsReadable(string $fileId): void
    {
        $endpoint = "/drives/{$this->driveId()}/items/{$fileId}/content";
        $response = $this->graph()->head($endpoint);

        if ($response->successful()) {
            return;
        }

        $response = $this->graph()
            ->withHeaders(['Range' => 'bytes=0-0'])
            ->get($endpoint);

        if ($response->failed()) {
            throw new RuntimeException('No se pudo leer el contenido del PDF seleccionado: '.$response->body());
        }
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

    private function mapBrowserItem(array $item): array
    {
        $isFolder = isset($item['folder']);

        return [
            'id' => $item['id'] ?? null,
            'parent_id' => $item['parentReference']['id'] ?? null,
            'name' => $item['name'] ?? null,
            'type' => $isFolder ? 'folder' : 'pdf',
            'web_url' => $item['webUrl'] ?? null,
            'mime_type' => $item['file']['mimeType'] ?? null,
            'size' => $isFolder ? null : ($item['size'] ?? null),
            'last_modified_at' => $item['lastModifiedDateTime'] ?? null,
            'is_pdf' => ! $isFolder && $this->isPdfDriveItem($item),
            'selectable' => ! $isFolder && $this->isPdfDriveItem($item),
        ];
    }

    private function mapNavigationItem(array $item): array
    {
        return [
            'id' => $item['id'] ?? null,
            'parent_id' => $item['parentReference']['id'] ?? null,
            'name' => $item['name'] ?? null,
            'web_url' => $item['webUrl'] ?? null,
        ];
    }

    private function isPdfDriveItem(array $item): bool
    {
        if (! isset($item['file'])) {
            return false;
        }

        $name = strtolower((string) ($item['name'] ?? ''));
        $mimeType = strtolower((string) ($item['file']['mimeType'] ?? ''));

        return str_ends_with($name, '.pdf') || $mimeType === 'application/pdf';
    }

    private function isItemInsideRoot(array $item, string $rootId): bool
    {
        $current = $item;
        for ($depth = 0; $depth < 50; $depth++) {
            if (($current['id'] ?? null) === $rootId) {
                return true;
            }

            $parentId = $current['parentReference']['id'] ?? null;
            if (! $parentId) {
                return false;
            }

            $current = $this->getDriveItem($parentId);
        }

        return false;
    }

    private function ancestorsToRoot(array $item, string $rootId): array
    {
        $items = [];
        $current = $item;

        for ($depth = 0; $depth < 50; $depth++) {
            array_unshift($items, $current);
            if (($current['id'] ?? null) === $rootId) {
                return $items;
            }

            $parentId = $current['parentReference']['id'] ?? null;
            if (! $parentId) {
                return [];
            }

            $current = $this->getDriveItem($parentId);
        }

        return [];
    }

    private function parentInsideRoot(array $folder, string $rootId): ?array
    {
        if (($folder['id'] ?? null) === $rootId) {
            return null;
        }

        $parentId = $folder['parentReference']['id'] ?? null;
        if (! $parentId) {
            return null;
        }

        $parent = $this->getDriveItem($parentId);

        return $this->isItemInsideRoot($parent, $rootId) ? $this->mapNavigationItem($parent) : null;
    }

    private function breadcrumbs(array $folder, array $root): array
    {
        $items = [];
        $current = $folder;

        for ($depth = 0; $depth < 50; $depth++) {
            array_unshift($items, $this->mapNavigationItem($current));
            if (($current['id'] ?? null) === ($root['id'] ?? null)) {
                break;
            }

            $parentId = $current['parentReference']['id'] ?? null;
            if (! $parentId) {
                break;
            }

            $current = $this->getDriveItem($parentId);
        }

        return $items;
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
