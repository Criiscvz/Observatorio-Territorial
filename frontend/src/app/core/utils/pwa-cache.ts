// Only the root-scoped API caches created by the previous configuration.
// Never remove app-shell/static caches or caches owned by other applications.
const LEGACY_API_CACHE = /^ngsw:\/:(?:\d+:data:(?:barometro-categorias|barometro-datasets|public-data):cache|db:\d+:data:(?:barometro-categorias|barometro-datasets|public-data):(?:age|lru))$/;

export async function clearLegacyApiCaches(
  storage?: Pick<CacheStorage, 'keys' | 'delete'>,
): Promise<void> {
  try {
    const cacheStorage = storage ?? globalThis.caches;
    if (!cacheStorage) return;

    const names = await cacheStorage.keys();
    await Promise.all(
      names.filter((name) => LEGACY_API_CACHE.test(name))
        .map((name) => cacheStorage.delete(name)),
    );
  } catch {
    // API requests bypass the worker even if storage is unavailable.
    // Retry the cleanup on the next application load, without blocking sign-in.
    console.warn('No se pudo limpiar la caché API anterior de la PWA.');
  }
}
