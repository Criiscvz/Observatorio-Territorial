import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtemp,mkdir,readFile,readdir,realpath,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {dirname,join,relative,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
function docker(args,input){const r=spawnSync('docker',['--context','default',...args],{cwd:root,input,encoding:'utf8',timeout:120000,windowsHide:true});assert(!r.error&&r.status===0,'Synthetic portable-context check failed; diagnostics suppressed.');return r.stdout.trim();}
assert(/^(npipe:\/\/|unix:\/\/)/.test(docker(['context','inspect','default','--format','{{.Endpoints.docker.Host}}'])));
assert(/^Driver:\s+docker\s*$/m.test(docker(['buildx','inspect','default'])));
const parent=await realpath(tmpdir()),temporary=await mkdtemp(join(parent,'observatorio-portable-context-'));
const excluded=['.env','.env.production','app/.env.local','src/.env.local','public/.env.production','app/auth.json','src/private.key','public/private.pem','storage/app/private/doc.pdf','storage/logs/session.log','bootstrap/cache/config.php','tests/fixture.php','vendor/fixture','node_modules/fixture','dist/fixture','.git/config','output/backup.dump'];
const cases=[
  {name:'web',ignore:'frontend/.dockerignore',included:['package.json','package-lock.json','angular.json','src/app/app.ts','public/ULEAM.png','docker/portable-nginx.conf','scripts/set-api-url.mjs']},
  {name:'api',ignore:'backend/Dockerfile.portable.dockerignore',included:['artisan','composer.json','composer.lock','app/Models/User.php','config/app.php','database/migrations/fixture.php','public/index.php','resources/views/fixture.blade.php','routes/api.php','docker/portable-entrypoint.sh']},
  {name:'e2e',ignore:'backend/Dockerfile.e2e.dockerignore',included:['tests/E2E/E2EGraphProvider.php','tests/E2E/providers.php']},
];
async function inventory(dir,prefix=''){const files=[];for(const entry of await readdir(dir,{withFileTypes:true})){const file=prefix?prefix+'/'+entry.name:entry.name;if(entry.isDirectory())files.push(...await inventory(join(dir,entry.name),file));else files.push(file);}return files;}
let excludedCount=0;
try{
  for(const item of cases){const context=join(temporary,item.name),output=join(temporary,item.name+'-result');await mkdir(context);await writeFile(join(context,'.dockerignore'),await readFile(resolve(root,item.ignore)));
    const rejected=[...excluded,...(item.name==='e2e'?['app/Models/User.php','bootstrap/providers.php']:['tests/E2E/E2EGraphProvider.php','tests/E2E/providers.php','e2e/fixtures.ts'])];
    for(const file of [...rejected,...item.included]){const target=resolve(context,file);assert(!relative(context,target).startsWith('..'));await mkdir(dirname(target),{recursive:true});await writeFile(target,'synthetic-only\n');}
    docker(['build','--builder','default','--pull=false','--network=none','--no-cache','--provenance=false','--file','-','--output',`type=local,dest=${output}`,context],'FROM scratch\nCOPY . /\n');
    const files=new Set(await inventory(output));assert.deepEqual(rejected.filter(file=>files.has(file)),[],item.name);assert.deepEqual(item.included.filter(file=>!files.has(file)),[],item.name);
    excludedCount+=rejected.length;
  }
  console.log(JSON.stringify({ok:true,contexts:cases.length,syntheticOnly:true,excludedFixtures:excludedCount,includedFixtures:cases.reduce((sum,item)=>sum+item.included.length,0)}));
}finally{
  assert.equal(dirname(await realpath(temporary)),parent,'Unexpected cleanup target.');
  await rm(temporary,{recursive:true,force:true});
}
