import { expect, test } from './fixtures';

test('gestiona un reporte Power BI y lo publica solo en su sección del Barómetro', async ({session}, info) => {
  const title = `Investigación Power BI ${info.project.name}`;
  const admin = await session('admin');
  await admin.goto('/admin/barometro');
  await admin.getByRole('link', {name: 'Gestionar Resultados Investigación ULEAM'}).click();
  await admin.getByRole('button', {name: 'Nueva publicación', exact: true}).click();
  const form = admin.getByRole('dialog', {name: 'Nueva publicación del Barómetro'});
  await expect(form.getByText('Resultados Investigación ULEAM')).toBeVisible();
  await form.locator('[formcontrolname="titulo"]').fill(title);
  await form.locator('[formcontrolname="fecha_publicacion"]').fill('2026-11-23');
  await form.locator('[formcontrolname="fuente"]').fill('ULEAM');
  await form.locator('[formcontrolname="link_url"]').fill('https://app.powerbi.com/view?r=reporte-barometro-e2e');
  await form.getByRole('button', {name: 'Vista previa', exact: true}).click();
  await expect(admin.getByRole('dialog').last().locator('iframe')).toBeVisible();
  await admin.getByRole('button', {name: 'Cerrar visor'}).click();
  await form.getByRole('button', {name: 'Guardar publicación'}).click();
  const row = admin.getByRole('row').filter({hasText: title});
  await expect(row).toContainText('En revisión');

  const portal = await session();
  const publicLibrary = '/publico/barometro/investigacion';
  await portal.goto(publicLibrary);
  const search = portal.getByRole('searchbox', {name: 'Buscar reportes del Barómetro'});
  await search.fill(title);
  await expect(portal.getByRole('heading', {name: 'No encontramos publicaciones'})).toBeVisible();

  const setState = async (estado: string) => {
    await row.getByRole('button', {name: `Editar ${title}`}).click();
    const editor = admin.getByRole('dialog', {name: 'Editar publicación del Barómetro'});
    await editor.locator('[formcontrolname="estado"]').selectOption(estado);
    await editor.getByRole('button', {name: 'Guardar publicación'}).click();
    await expect(editor).toHaveCount(0);
  };
  await setState('PUBLICACION');
  await expect(row).toContainText('Publicado');

  await portal.reload();
  await search.fill(title);
  const read = portal.getByRole('button', {name: `Ver reporte ${title}`});
  await read.click();
  await expect(portal.getByRole('dialog').locator('iframe')).toBeVisible();
  await portal.getByRole('button', {name: 'Cerrar visor'}).click();
  await portal.goto('/publico/barometro/vinculacion');
  await expect(portal.getByRole('heading', {name: 'Aún no hay reportes publicados'})).toBeVisible();

  await setState('ARCHIVADO');
  await expect(row).toContainText('Archivado');
  await portal.goto(publicLibrary);
  await search.fill(title);
  await expect(portal.getByRole('heading', {name: 'No encontramos publicaciones'})).toBeVisible();
});
