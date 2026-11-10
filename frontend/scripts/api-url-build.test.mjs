import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFile, mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';

async function fixture(source, run) {
  const parent = await realpath(tmpdir());
  const root = await mkdtemp(join(parent, 'observatorio-api-build-'));
  try {
    await mkdir(join(root,'scripts'));
    await mkdir(join(root,'src/environments'),{recursive:true});
    await copyFile(new URL('set-api-url.mjs',import.meta.url), join(root,'scripts/set-api-url.mjs'));
    const file = join(root,'src/environments/environment.prod.ts');
    await writeFile(file,source);
    await run(file, value => spawnSync(process.execPath,[join(root,'scripts/set-api-url.mjs')],
      {env:{...process.env,API_URL:value},encoding:'utf8',timeout:10000,windowsHide:true}));
  } finally {
    assert.equal(dirname(await realpath(root)),parent);
    await rm(root,{recursive:true,force:true});
  }
}

test('building the SPA then Docker with the same API origin is repeatable',async()=>{
  await fixture("export const environment = {production:true, apiUrl: 'https://unconfigured.invalid/api'};\n",async(file,build)=>{
    assert.equal(build('/api').status,0);
    const first = await readFile(file,'utf8');
    assert(first.includes("apiUrl: '/api'"));
    assert.equal(build('/api').status,0);
    assert.equal(await readFile(file,'utf8'),first);
  });
});
test('an existing API property is required even when the build origin is valid',async()=>{
  await fixture('export const environment = {production:true};\n',async(file,build)=>{
    const result=build('/api'); assert.notEqual(result.status,0);
    assert.match(result.stderr,/Could not set apiUrl/);
    assert.equal(await readFile(file,'utf8'),'export const environment = {production:true};\n');
  });
});
test('missing and unsupported origins fail without changing the source',async()=>{
  const source="export const environment = {apiUrl: '/api'};\n";
  await fixture(source,async(file,build)=>{
    for(const value of ['', 'http://example.test/api', 'invalid']) assert.notEqual(build(value).status,0);
    assert.equal(await readFile(file,'utf8'),source);
  });
});
test('HTTPS origin normalizes a trailing slash and can be applied twice',async()=>{
  await fixture("export const environment = {apiUrl: '/api'};\n",async(file,build)=>{
    const value='https://api.example.test/api/';
    assert.equal(build(value).status,0); assert.equal(build(value).status,0);
    assert((await readFile(file,'utf8')).includes("apiUrl: 'https://api.example.test/api'"));
  });
});
