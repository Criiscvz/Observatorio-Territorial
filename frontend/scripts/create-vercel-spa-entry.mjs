import { copyFile, access, constants } from 'node:fs/promises';

const source = new URL('../dist/frontend/browser/index.csr.html', import.meta.url);
const destination = new URL('../dist/frontend/browser/index.html', import.meta.url);

try {
  await access(source, constants.R_OK);
} catch {
  throw new Error('Angular did not generate dist/frontend/browser/index.csr.html');
}

await copyFile(source, destination);
