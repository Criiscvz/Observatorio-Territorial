import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url));
const destination=new URL('../storage/codex-local/portable/.env',import.meta.url);
const ignored=spawnSync('git',['check-ignore','storage/codex-local/portable/.env'],{cwd:root,encoding:'utf8',windowsHide:true});
assert.equal(ignored.status,0,'The private rehearsal environment must be ignored by Git.');
await mkdir(new URL('./',destination),{recursive:true});
const values={PORTABLE_APP_KEY:`base64:${randomBytes(32).toString('base64')}`,
  PORTABLE_DB_OWNER_PASSWORD:randomBytes(32).toString('hex'),PORTABLE_DB_APP_PASSWORD:randomBytes(32).toString('hex'),
  PORTABLE_MONGO_ROOT_PASSWORD:randomBytes(32).toString('hex'),PORTABLE_MONGO_APP_PASSWORD:randomBytes(32).toString('hex'),PORTABLE_HTTP_PORT:'4400'};
let created=true;
try { await writeFile(destination,Object.entries(values).map(([key,value])=>`${key}=${value}`).join('\n')+'\n',{flag:'wx',mode:0o600}); }
catch(error){if(error.code!=='EEXIST')throw error;created=false;const previous=await readFile(destination,'utf8');
  for(const key of Object.keys(values))assert(new RegExp(`^${key}=.+$`,'m').test(previous),'Existing environment is incomplete; values suppressed.');}
console.log(JSON.stringify({created,privateFile:'storage/codex-local/portable/.env',secretsPrinted:false}));
