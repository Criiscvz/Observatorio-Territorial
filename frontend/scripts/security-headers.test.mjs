import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import test from 'node:test';
import { JSDOM } from 'jsdom';

const frontendRoot = new URL('../', import.meta.url);
const vercel = JSON.parse(await readFile(new URL('vercel.json', frontendRoot), 'utf8'));
const angular = JSON.parse(await readFile(new URL('angular.json', frontendRoot), 'utf8'));
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

test('conserva Material Icons, Google Fonts y estilos dinámicos de Angular', () => {
  assert.deepEqual(directives.get('style-src'),
    ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com']);
  assert.deepEqual(directives.get('font-src'),
    ["'self'", 'data:', 'https://fonts.gstatic.com']);
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
  assert.deepEqual(directives.get('frame-src'), ["'self'", 'blob:']);
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
