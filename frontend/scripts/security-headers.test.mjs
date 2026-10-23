import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import test from 'node:test';
import { JSDOM } from 'jsdom';

const frontendRoot = new URL('../', import.meta.url);
const vercel = JSON.parse(await readFile(new URL('vercel.json', frontendRoot), 'utf8'));
const angular = JSON.parse(await readFile(new URL('angular.json', frontendRoot), 'utf8'));
const pwa = JSON.parse(await readFile(new URL('ngsw-config.json', frontendRoot), 'utf8'));

test('la PWA no almacena respuestas API ni sesiones en dataGroups', () => {
  assert.deepEqual(pwa.dataGroups, []);
  assert.ok(pwa.assetGroups.every((group) => !(group.resources.urls?.length)));
  for (const group of pwa.assetGroups) {
    assert.ok(group.resources.files.every((pattern) => !pattern.startsWith('/api')
      && !pattern.startsWith('/sanctum') && !pattern.startsWith('/storage')));
  }
});

test('el worker generado no contiene cachés de datos API',
  { skip: process.env.SECURITY_CHECK_BUILD !== '1' }, async () => {
    const sw = JSON.parse(await readFile(new URL('dist/frontend/browser/ngsw.json', frontendRoot), 'utf8'));
    assert.deepEqual(sw.dataGroups, []);
    assert.ok(sw.assetGroups.every((group) => group.patterns.length === 0));
  });

test('la precarga incluye el HTML CSR que genera Angular con SSR', () => {
  assert.ok(pwa.assetGroups.some((group) => group.installMode === 'prefetch'
    && group.resources.files.includes('/index.csr.html')));
  assert.ok(pwa.assetGroups.some((group) => group.installMode === 'prefetch'
    && group.resources.files.includes('/assets/i18n/*.json')));
});

test('el índice publicado coincide con el shell precargado y su hash',
  { skip: process.env.SECURITY_CHECK_BUILD !== '1' }, async () => {
    const dist = new URL('dist/frontend/browser/', frontendRoot);
    const sw = JSON.parse(await readFile(new URL('ngsw.json', dist), 'utf8'));
    assert.equal(sw.index, '/index.csr.html');
    const shell = await readFile(new URL('index.csr.html', dist));
    const published = await readFile(new URL('index.html', dist));
    assert.deepEqual(published, shell);
    assert.ok(sw.assetGroups.some((group) => group.installMode === 'prefetch'
      && group.urls.includes(sw.index)));
    assert.equal(sw.hashTable[sw.index], createHash('sha1').update(shell).digest('hex'));
    for (const language of ['es', 'en']) {
      const path = `/assets/i18n/${language}.json`;
      const bytes = await readFile(new URL(path.slice(1), dist));
      assert.ok(sw.assetGroups.some((group) => group.installMode === 'prefetch'
        && group.urls.includes(path)), path);
      assert.equal(sw.hashTable[path], createHash('sha1').update(bytes).digest('hex'), path);
    }
    const html = new JSDOM(shell.toString('utf8'));
    try {
      for (const script of html.window.document.querySelectorAll('script[src]')) {
        const url = new URL(script.getAttribute('src'), 'https://app.test/').pathname;
        const bytes = await readFile(new URL(url.slice(1), dist));
        assert.equal(sw.hashTable[url], createHash('sha1').update(bytes).digest('hex'), url);
      }
    } finally {
      html.window.close();
    }
  });
const cspRules = vercel.headers.filter((rule) =>
  rule.headers.some((header) => header.key.toLowerCase() === 'content-security-policy'),
);
assert.equal(cspRules.length, 1, 'Debe existir una única política para el frontend.');
const rule = cspRules[0];
const routePattern = new RegExp(`^${rule.source}$`);
const headers = new Map(rule.headers.map(({ key, value }) => [key.toLowerCase(), value]));
const directives = new Map(
  headers.get('content-security-policy').split(';').map((entry) => {
    const [name, ...sources] = entry.trim().split(/\s+/);
    return [name, sources];
  }),
);

test('protege la portada, rutas SPA, recursos y visor PDF local', () => {
  for (const path of ['/', '/auth/login', '/auth/register', '/admin/dashboard',
    '/admin/atlas/categorias', '/publico/atlas', '/main-123.js', '/manifest.webmanifest',
    '/1-recuperacion-economica.pdf', '/apiary', '/sanctum-info', '/storage-info']) {
    assert.ok(routePattern.test(path), path);
  }
});

test('no sobreescribe las cabeceras de API, CSRF ni almacenamiento del backend', () => {
  for (const path of ['/api', '/api/health', '/api/departamentos/publicaciones/1/download',
    '/sanctum', '/sanctum/csrf-cookie', '/storage', '/storage/avatars/example.png']) {
    assert.equal(routePattern.test(path), false, path);
  }
});

test('solo permite scripts propios y rechaza manejadores inline y eval', () => {
  assert.deepEqual(directives.get('default-src'), ["'self'"]);
  assert.deepEqual(directives.get('script-src'), ["'self'"]);
  assert.deepEqual(directives.get('script-src-attr'), ["'none'"]);
  assert.ok(!headers.get('content-security-policy').includes("'unsafe-eval'"));
});

test('impide que otros sitios incrusten la aplicación sin romper el visor del mismo origen', () => {
  assert.deepEqual(directives.get('frame-ancestors'), ["'self'"]);
  assert.equal(headers.get('x-frame-options'), 'SAMEORIGIN');
});

test('restringe bases, formularios y objetos embebidos', () => {
  assert.deepEqual(directives.get('base-uri'), ["'self'"]);
  assert.deepEqual(directives.get('form-action'), ["'self'"]);
  assert.deepEqual(directives.get('object-src'), ["'none'"]);
});

test('sirve las fuentes propias y conserva los estilos dinámicos de Angular', () => {
  assert.deepEqual(directives.get('style-src'),
    ["'self'", "'unsafe-inline'"]);
  assert.deepEqual(directives.get('font-src'),
    ["'self'", 'data:']);
});

test('no depende de Google Fonts y declara las ligaduras del icono local', async () => {
  const html = await readFile(new URL('src/index.html', frontendRoot), 'utf8');
  const css = await readFile(new URL('src/fonts.css', frontendRoot), 'utf8');
  assert.ok(!/fonts\.(googleapis|gstatic)\.com/.test(html));
  assert.ok(angular.projects.frontend.architect.build.options.styles.includes('src/fonts.css'));
  assert.match(css, /font-family:\s*'Material Icons'/);
  assert.match(css, /font-display:\s*block/);
  assert.match(css, /font-feature-settings:\s*'liga'/);
  assert.match(css, /@fontsource\/material-icons\/files\/[^)]+\.woff2/);
  for (const weight of [300, 400, 500]) {
    assert.ok(css.includes(`@fontsource/roboto/latin-${weight}.css`));
  }
  const ngsw = JSON.parse(await readFile(new URL('ngsw-config.json', frontendRoot), 'utf8'));
  assert.ok(ngsw.assetGroups.some((group) => group.installMode === 'prefetch'
    && group.resources.files.includes('/media/*.woff2')));
});

test('permite imágenes propias, avatares HTTPS y previsualizaciones blob/data', () => {
  assert.deepEqual(directives.get('img-src'), ["'self'", 'data:', 'blob:', 'https:']);
});

test('limita conexiones al proxy del mismo origen y al backend HTTPS exacto', () => {
  assert.deepEqual(directives.get('connect-src'),
    ["'self'", 'https://observatorio-territorial.onrender.com']);
  assert.ok(directives.has('upgrade-insecure-requests'));
});

test('conserva PDF locales/blob y la PWA sin permitir marcos externos arbitrarios', () => {
  assert.deepEqual(directives.get('frame-src'), ["'self'", 'blob:', 'https://app.powerbi.com']);
  assert.deepEqual(directives.get('worker-src'), ["'self'"]);
  assert.deepEqual(directives.get('manifest-src'), ["'self'"]);
});

test('aplica nosniff, una política de referencia limitada y permisos no utilizados desactivados', () => {
  assert.equal(headers.get('x-content-type-options'), 'nosniff');
  assert.equal(headers.get('referrer-policy'), 'strict-origin-when-cross-origin');
  assert.equal(headers.get('permissions-policy'), 'camera=(), microphone=(), geolocation=()');
});

test('mantiene intactos el proxy de API/CSRF/almacenamiento y el fallback SPA', () => {
  assert.deepEqual(vercel.rewrites, [
    { source: '/api/:path*', destination: 'https://observatorio-territorial.onrender.com/api/:path*' },
    { source: '/sanctum/:path*', destination: 'https://observatorio-territorial.onrender.com/sanctum/:path*' },
    { source: '/storage/:path*', destination: 'https://observatorio-territorial.onrender.com/storage/:path*' },
    { source: '/(.*)', destination: '/index.html' },
  ]);
  assert.equal(vercel.outputDirectory, 'dist/frontend/browser');
});

test('el build de producción no necesita el onload inline del CSS crítico', () => {
  const optimization = angular.projects.frontend.architect.build.configurations.production.optimization;
  assert.equal(optimization.styles.inlineCritical, false);
  assert.equal(optimization.styles.minify, true);
  assert.equal(optimization.scripts, true);
});

// SECURITY_CHECK_BUILD=1 exige validar el artefacto de build:vercel además de la configuración.
test('el HTML publicado no contiene JavaScript inline ejecutable',
  { skip: process.env.SECURITY_CHECK_BUILD !== '1' }, async () => {
    const html = await readFile(new URL('dist/frontend/browser/index.html', frontendRoot), 'utf8');
    const dom = new JSDOM(html);
    try {
      const document = dom.window.document;
      const inlineHandlers = [...document.querySelectorAll('*')].flatMap((element) =>
        [...element.attributes].filter(({ name }) => /^on/i.test(name)).map(({ name }) => name),
      );
      assert.deepEqual(inlineHandlers, []);
      for (const script of document.querySelectorAll('script:not([src])')) {
        assert.ok(['application/json', 'application/ld+json'].includes(script.type),
          'El HTML no debe incluir scripts inline ejecutables.');
      }
      assert.ok(document.querySelector('script[type="module"][src]'));
      assert.ok(document.querySelector('link[rel="stylesheet"][href]'));
      assert.equal(document.querySelector('link[rel="stylesheet"][media="print"]'), null);
    } finally {
      dom.window.close();
    }
  });

test('el bundle verificado no conserva el origen de bloqueo de API sin configurar',
  { skip: process.env.SECURITY_CHECK_BUILD !== '1' }, async () => {
    const dist = new URL('dist/frontend/browser/', frontendRoot);
    const files = (await readdir(dist)).filter((file) => file.endsWith('.js'));
    for (const file of files) {
      assert.ok(!(await readFile(new URL(file, dist), 'utf8')).includes('api-url-not-configured.invalid'), file);
    }
  });

test('el artefacto contiene fuentes WOFF2 y solo las referencia desde el mismo origen',
  { skip: process.env.SECURITY_CHECK_BUILD !== '1' }, async () => {
    const dist = new URL('dist/frontend/browser/', frontendRoot);
    const html = await readFile(new URL('index.html', dist), 'utf8');
    const styles = await Promise.all((await readdir(dist))
      .filter((file) => file.endsWith('.css')).map((file) => readFile(new URL(file, dist), 'utf8')));
    const css = styles.join('\n');
    assert.ok(!/fonts\.(googleapis|gstatic)\.com/.test(html + css));
    for (const family of ['Material Icons', 'Roboto']) {
      assert.ok(css.includes(family), family);
    }
    const fontUrls = [...css.matchAll(/url\((?:["'])?([^\s)'";]+\.woff2)(?:["'])?\)/g)]
      .map((match) => match[1]);
    assert.ok(fontUrls.length >= 4, 'Faltan los iconos o alguno de los pesos de Roboto.');
    for (const url of fontUrls) {
      assert.ok(!/^(?:https?:)?\/\//i.test(url), url);
      assert.ok(!(url.startsWith('..')), url);
      const bytes = await readFile(new URL(url.replace(/^\//, ''), dist));
      assert.equal(bytes.subarray(0, 4).toString('ascii'), 'wOF2', url);
    }
    const ngsw = JSON.parse(await readFile(new URL('ngsw.json', dist), 'utf8'));
    const prefetched = ngsw.assetGroups.filter((group) => group.installMode === 'prefetch')
      .flatMap((group) => group.urls);
    for (const url of fontUrls) {
      assert.ok(prefetched.includes(`/${url.replace(/^(?:\.\/|\/)/, '')}`), url);
    }
  });
