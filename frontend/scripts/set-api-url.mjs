import { readFile, writeFile } from 'node:fs/promises';

const apiUrl = process.env.API_URL?.replace(/\/$/, '');

if (!apiUrl || (!/^https:\/\//.test(apiUrl) && !/^\//.test(apiUrl))) {
  throw new Error(
    'API_URL must be an HTTPS API URL or a same-origin path such as /api.',
  );
}

const file = new URL('../src/environments/environment.prod.ts', import.meta.url);
const source = await readFile(file, 'utf8');
const property = /apiUrl: '[^']*'/;

if (!property.test(source)) {
  throw new Error('Could not set apiUrl in environment.prod.ts');
}

const output = source.replace(property, `apiUrl: '${apiUrl}'`);
if (output !== source) await writeFile(file, output);
