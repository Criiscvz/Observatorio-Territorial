// Explicit reset of ONLY the labelled disposable portable rehearsal.
const assert=require('node:assert/strict'),{spawnSync}=require('node:child_process'),path=require('node:path');
const root=path.resolve(__dirname,'..'),project='observatorio-portable-ensayo';
function docker(args,input){const r=spawnSync('docker',['--context','default',...args],{cwd:root,input,encoding:'utf8',windowsHide:true,timeout:120000});assert(!r.error&&r.status===0,'Portable reset failed; raw diagnostics suppressed.');return r.stdout.trim();}
assert(/^(npipe:\/\/|unix:\/\/)/.test(docker(['context','inspect','default','--format','{{.Endpoints.docker.Host}}'])));
const prefix=['compose','--project-name',project,'--env-file','storage/codex-local/portable/.env','-f','deploy/portable/compose.yml'];
const config=JSON.parse(docker([...prefix,'config','--format','json']));
assert.equal(config.services.api.environment.DB_HOST,'postgres');assert.equal(config.services.api.environment.DB_DATABASE,'observatorio_portable_test');
const containers=docker(['ps','-aq','--filter','label=com.docker.compose.project='+project]).split('\n').filter(Boolean);
for(const id of containers){const c=JSON.parse(docker(['inspect',id]))[0];assert.equal(c.Config.Labels['observatorio.purpose'],'portable-rehearsal');}
const volumes=docker(['volume','ls','--format','{{.Name}}']).split('\n');
for(const entry of Object.values(config.volumes))if(volumes.includes(entry.name)){
  assert(entry.name.startsWith(project+'_'));const v=JSON.parse(docker(['volume','inspect',entry.name]))[0];
  assert.equal(v.Labels['com.docker.compose.project'],project);assert.equal(v.Labels['observatorio.purpose'],'portable-rehearsal');
}
// Refuse a lab that has been populated with other users instead of synthetic fixtures.
const postgres=docker([...prefix,'ps','-q','postgres']);
if(postgres){const query="SELECT CASE WHEN to_regclass('public.users') IS NULL THEN 0 ELSE 1 END;";
  const exists=docker([...prefix,'exec','-T','postgres','psql','-X','-qAt','-U','portable_owner','-d','observatorio_portable_test'],query);
  if(exists==='1')assert.equal(docker([...prefix,'exec','-T','postgres','psql','-X','-qAt','-U','portable_owner','-d','observatorio_portable_test'],"SELECT count(*) FROM users WHERE email <> 'portable-admin@example.test';"),'0','Refusing to reset a lab with non-fixture users.');
}
docker([...prefix,'down','--volumes']);
console.log(JSON.stringify({reset:true,project,onlyLabelledDisposableVolumes:true,productionTouched:false}));
