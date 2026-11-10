import { test, expect, fixture, pdf, login, library, checkPdf, apiWrite, apiGet } from './fixtures';

test('sesión entre pestañas y cierre con confirmación', async ({session}) => {
  const page = await session();
  await page.goto('/auth/login');
  await page.locator('.login-submit').click();
  await expect(page.locator('#login-email')).toHaveAttribute('aria-invalid','true');
  await login(page, 'admin');
  const second = await page.context().newPage();
  await second.goto('/');
  await expect(second.locator('.account-logout')).toBeVisible();
  await page.locator('.account-logout').click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('dialog').getByRole('button', {name:'Cancelar', exact:true}).click();
  expect((await apiGet(page, '/api/user')).status()).toBe(200);
  await page.locator('.account-logout').click();
  await page.getByRole('dialog').getByRole('button', {name:/^Cerrar sesión$/i}).click();
  await expect(page.locator('.account-logout')).toHaveCount(0);
  await expect(second.locator('.account-logout')).toHaveCount(0);
  expect((await apiGet(page, '/api/user')).status()).toBe(401);
});

test('biblioteca paginada, búsqueda y PDF público con ficha y pantalla completa', async ({session}, info) => {
  const page = await session();
  const worker = await page.request.get('/assets/pdfjs/pdf.worker.min.mjs');
  expect(worker.status()).toBe(200);
  expect(worker.headers()['content-type']).toContain('javascript');
  expect(worker.headers()['x-content-type-options']).toBe('nosniff');
  await page.goto('/publico/departamentos/' + fixture.health);
  await expect(page.locator('html')).toHaveAttribute('style',new RegExp('color-scheme: ' + (info.project.name === 'movil' ? 'dark' : 'light')));
  await expect(page.locator('.public-library-row')).toHaveCount(20);
  const range = await page.locator('.public-pagination').innerText();
  const total = Number(/1–20 de (\d+)/.exec(range)![1]);
  expect(total).toBeGreaterThanOrEqual(21);
  await page.getByRole('button', {name:'Página siguiente', exact:true}).click();
  await expect(page.locator('.public-library-row')).toHaveCount(Math.min(20, total - 20));
  await page.getByRole('searchbox', {name:'Buscar publicaciones'}).fill('Articulo E2E 01');
  await expect(page.locator('.public-library-row')).toHaveCount(1);
  await page.locator('.public-library-row').getByRole('button', {name:'Leer artículo', exact:true}).click();
  await expect(page.locator('.reader-description')).toContainText('Descripcion sintetica visible en la ficha del visor.');
  await checkPdf(page, 'Articulo E2E 01');
  await page.screenshot({path:info.outputPath('public-reader.png')});
  await page.getByRole('button', {name:'Cerrar visor'}).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

for (const item of [
  {tipo:'ARTICULO', tab:'Artículos', estado:'RECHAZADO'},
  {tipo:'LIBRO', tab:'Libros', estado:'SUSPENDIDO'},
  {tipo:'REPORTE', tab:'Reportes', estado:'ARCHIVADO'},
]) {
  test(`crear ${item.tipo}, previsualizar y revisar ${item.estado}`, async ({session}, info) => {
    const title = `${item.tipo} nuevo ${info.project.name}`;
    const editor = await session('editor');
    await editor.goto('/admin/publicaciones/nueva');
    const destination = editor.locator('.destination-form');
    await expect(destination.locator('select[formcontrolname="departamento"] option')).toHaveCount(2);
    await destination.locator('select[formcontrolname="departamento"]').selectOption(fixture.health);
    await destination.locator('select[formcontrolname="tipo"]').selectOption(item.tipo);
    await destination.getByRole('button', {name:'Abrir formulario'}).click();
    const form = editor.locator('#publication-editor');
    await expect(form.locator('#editor-title')).toContainText('Observatorio E2E Salud');
    // Opening the panel scrolls smoothly: measure both boxes in the same frame.
    const [left, right] = await editor.evaluate(() => ['.destination-form','#publication-editor']
      .map(selector => document.querySelector(selector)!.getBoundingClientRect().toJSON()));
    if (info.project.name === 'movil') expect(right.y).toBeGreaterThanOrEqual(left.y + left.height - 2);
    else expect(right.x).toBeGreaterThanOrEqual(left.x + left.width);
    await form.getByRole('button', {name:'Continuar', exact:true}).click();
    await expect(form.locator('input[name="titulo"]')).toHaveAttribute('aria-invalid','true');
    await form.locator('input[name="titulo"]').fill(title);
    await form.locator('input[name="fecha_publicacion"]').fill('2026-11-05');
    await form.locator('textarea[name="descripcion"]').fill('Descripcion nueva E2E');
    let writes = 0;
    editor.on('request', request => {if (request.method() === 'POST' && request.url().endsWith('/publicaciones')) writes++;});
    if (item.tipo === 'REPORTE') {
      await form.locator('input[name="link_url"]').fill('https://app.powerbi.com/view?r=eyJrIjoiMDAwMDAwMDAtMDAwMC00MDAwLTgwMDAtMDAwMDAwMDAwMDAxIn0=');
      await form.getByRole('button', {name:'Probar enlace'}).click();
      await expect(editor.getByRole('dialog').locator('iframe')).toBeVisible();
    } else {
      await form.getByRole('button', {name:'Continuar', exact:true}).click();
      await editor.locator('#publication-workspace-pdf').setInputFiles(pdf);
      await form.getByRole('button', {name:'Vista previa del PDF'}).click();
      await checkPdf(editor, title);
    }
    expect(writes).toBe(0);
    await editor.getByRole('button', {name:'Cerrar visor'}).click();
    if (item.tipo === 'REPORTE') await form.getByRole('button', {name:'Continuar', exact:true}).click();
    await expect(form.locator('select[name="estado"]')).toHaveCount(0);
    const created = editor.waitForResponse(r => r.request().method() === 'POST' && r.url().endsWith('/publicaciones'));
    await form.getByRole('button', {name:'Enviar a revisión'}).click();
    const response = await created;
    expect(response.status()).toBe(201);
    const body = await response.json(); const publication = body.data ?? body;
    expect(publication.estado).toBe('EN_REVISION');
    expect(writes).toBe(1);
    await expect(form.getByRole('heading', {name:'Publicación enviada a revisión'})).toBeVisible();

    const supervisor = await session('supervisor');
    const row = await library(supervisor, title, item.tab);
    await row.getByRole('button', {name:'Editar ' + title, exact:true}).click();
    const modal = supervisor.getByRole('dialog');
    await modal.getByRole('button', {name:'Continuar', exact:true}).click();
    await modal.locator('select[name="estado"]').selectOption(item.estado);
    await modal.getByRole('button', {name:'Guardar cambios', exact:true}).click();
    await expect(modal.locator('textarea[name="observacion_revision"]')).toHaveAttribute('aria-invalid','true');
    const reason = 'Motivo E2E ' + item.estado;
    await modal.locator('textarea[name="observacion_revision"]').fill(reason);
    const saved = supervisor.waitForResponse(r => r.request().method() === 'POST' && r.url().endsWith('/publicaciones/' + publication.id));
    await modal.getByRole('button', {name:'Guardar cambios', exact:true}).click();
    expect((await saved).status()).toBe(200);
    await expect(modal).toHaveCount(0);
    const own = await library(editor, title, item.tab);
    await expect(own.locator('.state')).toHaveAttribute('data-state', item.estado);
    await expect(own.locator('.review-note-preview')).toContainText(reason);
    if (item.estado === 'RECHAZADO') {
      await expect(own.getByRole('button', {name:'Editar ' + title, exact:true})).toHaveCount(0);
      await expect(own.getByRole('button', {name:'Eliminar ' + title, exact:true})).toHaveCount(0);
      expect((await apiWrite(editor,'PATCH','/api/departamentos/publicaciones/' + publication.id,{titulo:'Cambio prohibido'})).status()).toBe(403);
      expect((await apiWrite(editor,'DELETE','/api/departamentos/publicaciones/' + publication.id)).status()).toBe(403);
      await own.getByRole('button', {name:'Ver detalles de ' + title, exact:true}).click();
      await editor.getByRole('button', {name:'Ver PDF', exact:true}).click();
      await expect(editor.getByRole('dialog').locator('canvas')).toBeVisible();
    }
  });
}

test('alcance del supervisor y PDF reservado para suscriptores', async ({session}) => {
  const supervisor = await session('supervisor');
  await supervisor.goto('/admin/publicaciones/nueva');
  await expect(supervisor.locator('select[formcontrolname="departamento"] option')).toHaveCount(2);
  expect((await apiGet(supervisor, '/api/departamentos/' + fixture.other + '/biblioteca/publicaciones')).status()).toBe(403);
  const path = '/api/departamentos/publicaciones/' + fixture.restricted + '/download';
  for (const role of [undefined, 'user', 'subscriber'] as const) {
    const page = await session(role);
    const response = await apiGet(page, path);
    if (role === 'subscriber') {
      expect(response.status()).toBe(200);
      expect(response.headers()['content-type']).toContain('application/pdf');
      expect((await response.body()).subarray(0,5).toString()).toBe('%PDF-');
    } else expect([401,403,404]).toContain(response.status());
  }
});

test('Atlas y reporte abren el visor integrado', async ({session}) => {
  const page = await session();
  await page.goto('/publico/atlas');
  await page.locator('.directory-row').filter({hasText:'Categoria E2E'}).getByRole('button', {name:/Explorar/}).click();
  await page.getByRole('button', {name:'Ver Atlas Atlas E2E', exact:true}).click();
  let dialog = page.getByRole('dialog');
  await expect(dialog.locator('iframe')).toBeVisible();
  await expect(dialog.locator('.reader-info')).toContainText('Categoria E2E');
  await dialog.getByRole('button', {name:'Pantalla completa', exact:true}).click();
  await expect(dialog.locator('.reader-info')).toHaveCount(0);
  await dialog.getByRole('button', {name:'Salir de pantalla completa'}).click();
  await dialog.getByRole('button', {name:'Cerrar visor'}).click();
  await page.goto('/publico/departamentos/' + fixture.health);
  await page.getByRole('tab', {name:/Reportes/}).click();
  await page.locator('.public-library-row').filter({hasText:'Reporte E2E'}).getByRole('button', {name:/Ver reporte/}).click();
  dialog = page.getByRole('dialog');
  await expect(dialog.locator('iframe')).toBeVisible();
  await expect(dialog.getByRole('button', {name:/Abrir aparte/})).toHaveCount(0);
});

test('SharePoint importa y conserva una copia PDF con Graph controlado', async ({session}) => {
  const page = await session('admin');
  await page.goto('/admin/publicaciones/nueva');
  await page.locator('select[formcontrolname="departamento"]').selectOption(fixture.health);
  await page.getByRole('button', {name:'Abrir formulario'}).click();
  await page.getByRole('button', {name:/Importar desde SharePoint/}).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText('Importacion E2E.pdf', {exact:true})).toBeVisible();
  await dialog.getByRole('checkbox', {name:/Seleccionar PDFs visibles/}).check();
  const imported = page.waitForResponse(r => r.url().includes('/articulos/sharepoint/import-many') && r.request().method() === 'POST');
  await dialog.getByRole('button', {name:/Importar seleccionados/}).click();
  const response = await imported;
  expect(response.status()).toBe(200);
  const row = await library(page,'Importacion E2E');
  await row.getByRole('button', {name:/Ver detalles de/}).click();
  await page.getByRole('button', {name:'Ver PDF', exact:true}).click();
  await expect(page.getByRole('dialog').locator('canvas')).toBeVisible();
});
