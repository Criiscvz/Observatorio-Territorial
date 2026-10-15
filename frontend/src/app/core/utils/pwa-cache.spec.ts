import { clearLegacyApiCaches } from './pwa-cache';

describe('clearLegacyApiCaches', () => {
  afterEach(() => vi.restoreAllMocks());

  it('removes only legacy API data and metadata across configuration versions', async () => {
    const legacy = [
      'ngsw:/:1:data:barometro-categorias:cache',
      'ngsw:/:db:1:data:barometro-categorias:lru',
      'ngsw:/:db:1:data:barometro-categorias:age',
      'ngsw:/:2:data:barometro-datasets:cache',
      'ngsw:/:db:2:data:barometro-datasets:lru',
      'ngsw:/:db:2:data:barometro-datasets:age',
      'ngsw:/:1:data:public-data:cache',
      'ngsw:/:db:1:data:public-data:lru',
      'ngsw:/:db:1:data:public-data:age',
    ];
    const preserved = [
      'ngsw:/:db:control',
      'ngsw:/:hash:assets:app-shell:cache',
      'ngsw:/:db:hash:assets:static-assets:meta',
      'ngsw:/:1:data:another-group:cache',
      'ngsw:/other/:1:data:public-data:cache',
      'my-application-cache',
    ];
    const storage = {
      keys: vi.fn().mockResolvedValue([...legacy, ...preserved]),
      delete: vi.fn().mockResolvedValue(true),
    };
    await clearLegacyApiCaches(storage);
    expect(storage.delete.mock.calls.map(([name]) => name)).toEqual(legacy);
  });

  it('is safe to repeat after the old caches are removed', async () => {
    const storage = { keys: vi.fn().mockResolvedValue([]), delete: vi.fn() };
    await clearLegacyApiCaches(storage);
    await clearLegacyApiCaches(storage);
    expect(storage.delete).not.toHaveBeenCalled();
  });

  it('does not block startup if CacheStorage cannot be read', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const storage = { keys: vi.fn().mockRejectedValue(new Error('Unavailable')), delete: vi.fn() };
    await expect(clearLegacyApiCaches(storage)).resolves.toBeUndefined();
    expect(storage.delete).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('does not block startup if deleting a legacy cache fails', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const storage = {
      keys: vi.fn().mockResolvedValue(['ngsw:/:1:data:public-data:cache']),
      delete: vi.fn().mockRejectedValue(new Error('Unavailable')),
    };
    await expect(clearLegacyApiCaches(storage)).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalledTimes(1);
  });
});
