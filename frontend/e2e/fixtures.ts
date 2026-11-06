import { test as base, expect, devices, type BrowserContext, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export const origin = 'http://localhost:4500';
const directory = resolve(__dirname, '../../storage/codex-local/e2e');
export const fixture: {run: string; password: string; health: string; other: string; category: string; restricted: string} = JSON.parse(readFileSync(resolve(directory, 'fixture.json'), 'utf8'));
export const pdf = resolve(directory, 'document.pdf');
type Role = 'admin' | 'supervisor' | 'editor' | 'subscriber' | 'user';
export const test = base.extend<{ session: (role?: Role) => Promise<Page> }>({
  session: async ({ browser }, use, info) => {
    const contexts: BrowserContext[] = [];
    const external: string[] = [];
    const errors: string[] = [];
    await use(async role => {
      const mobile = info.project.name === 'movil';
      const context = await browser.newContext({ ...(mobile ? devices['Pixel 7'] : devices['Desktop Chrome']),
        viewport: mobile ? {width:390, height:844} : {width:1366, height:768},
        colorScheme: mobile ? 'dark' : 'light', baseURL: origin, locale:'es-EC', serviceWorkers:'block' });
      contexts.push(context);
      await context.addInitScript(theme => {
        if (location.origin === 'http://localhost:4500') localStorage.setItem('observatorio-theme',theme);
      }, mobile ? 'dark' : 'light');
      context.on('page', child => child.on('pageerror', error => errors.push(error.message)));
      // Only the external Power BI document is simulated. App, PDF, API and cookies are real.
      await context.route('**/*', async route => {
        const url = new URL(route.request().url());
        if (url.origin === origin || ['blob:', 'data:'].includes(url.protocol)) return route.continue();
        if (url.hostname === 'app.powerbi.com' && route.request().resourceType() === 'document') {
          return route.fulfill({contentType:'text/html', body:'<!doctype html><html lang="es"><title>Power BI E2E</title><body>Reporte simulado E2E</body></html>'});
        }
        external.push(url.origin + url.pathname);
        await route.abort('blockedbyclient');
      });
      const page = await context.newPage();
      const marker = await context.request.get('/api/departamentos/publicos');
      expect(await marker.text()).toContain(fixture.run);
      if (role) await login(page, role);
      return page;
    });
    for (const [index, context] of contexts.entries()) {
      if (info.status !== info.expectedStatus) {
        for (const [number, page] of context.pages().entries()) {
          if (!page.isClosed()) await page.screenshot({path:info.outputPath(`session-${index}-page-${number}.png`)}).catch(() => undefined);
        }
      }
      await context.close();
    }
    expect(external, 'Unexpected external traffic').toEqual([]);
    expect(errors, 'Uncaught browser exceptions').toEqual([]);
  },
});
export { expect };
export async function login(page: Page, role: Role) {
  await page.goto('/auth/login');
  await page.locator('#login-email').fill(role + '@example.test');
  await page.locator('#login-password').fill(fixture.password);
  const response = page.waitForResponse(r => r.url().endsWith('/api/login') && r.request().method() === 'POST');
  await page.locator('.login-submit').click();
  expect((await response).status()).toBe(200);
  await expect(page.locator('.account-logout')).toBeVisible();
}
export async function apiWrite(page: Page, method: 'PATCH' | 'DELETE', path: string, data?: object) {
  const cookie = (await page.context().cookies()).find(c => c.name === 'XSRF-TOKEN');
  expect(cookie).toBeTruthy();
  return page.request.fetch(path, {method, data, headers:{Accept:'application/json', Origin:origin,
    Referer:origin+'/', 'X-XSRF-TOKEN':decodeURIComponent(cookie!.value)}});
}
export function apiGet(page: Page, path: string) {
  return page.request.get(path, {headers:{Accept:'application/json', Origin:origin, Referer:origin+'/'}});
}
export async function library(page: Page, title: string, type = 'Artículos') {
  await page.goto('/admin/departamentos/' + fixture.health);
  await page.getByRole('tab', {name:new RegExp(type)}).click();
  await page.getByRole('searchbox', {name:'Buscar en la biblioteca'}).fill(title);
  const row = page.locator('tr.library-row').filter({hasText:title});
  await expect(row).toHaveCount(1);
  return row;
}
export async function checkPdf(page: Page, title: string) {
  const dialog = page.getByRole('dialog').last();
  await expect(dialog.getByRole('heading', {name:title, exact:true})).toBeVisible();
  await expect(dialog.locator('.reader-paper canvas')).toBeVisible();
  await expect(dialog.getByRole('spinbutton', {name:'Ir a la página'})).toHaveValue('1');
  await dialog.getByRole('button', {name:'Página siguiente', exact:true}).click();
  await expect(dialog.getByRole('spinbutton', {name:'Ir a la página'})).toHaveValue('2');
  await expect(dialog.locator('canvas')).toHaveAttribute('aria-label', 'Página 2 de 2 de ' + title);
  await dialog.getByRole('button', {name:'Pantalla completa', exact:true}).click();
  await expect(dialog.locator('.reader-info')).toHaveCount(0);
  await expect(dialog.locator('canvas')).toBeVisible();
  const document = dialog.locator('.reader-document');
  await expect(document).toHaveAttribute('aria-busy','false');
  await expect.poll(async () => (await document.boundingBox())!.width).toBeGreaterThan(page.viewportSize()!.width - 40);
  await expect.poll(async () => {
    const area = (await document.boundingBox())!;
    const paper = (await dialog.locator('canvas').boundingBox())!;
    return paper.x >= area.x && paper.x + paper.width <= area.x + area.width + 1;
  }, {message:'Fit-to-width keeps both PDF edges inside the reader'}).toBe(true);
  await dialog.getByRole('button', {name:'Salir de pantalla completa'}).click();
  await expect(dialog.locator('.reader-info')).toBeVisible();
  await expect(document).toHaveAttribute('aria-busy','false');
}
