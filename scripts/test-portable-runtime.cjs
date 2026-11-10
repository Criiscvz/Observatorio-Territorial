// Only the labelled, synthetic local Compose rehearsal. Never accepts DB URLs or project names.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),privateDir=path.join(root,'storage/codex-local/portable');
const project='observatorio-portable-ensayo',purpose='portable-rehearsal';
const envFile=path.join(privateDir,'.env'),composeFile=path.join(root,'deploy/portable/compose.yml');
const prefix=['--context','default','compose','--project-name',project,'--env-file',envFile,'-f',composeFile];
let checks=0;
function run(args,{input,raw=false,timeout=120000}={}){
  const r=spawnSync('docker',['--context','default',...args],{cwd:root,input,encoding:raw?null:'utf8',timeout,maxBuffer:32*1024*1024,windowsHide:true});
  if(r.error||r.status!==0){fs.mkdirSync(privateDir,{recursive:true});fs.writeFileSync(path.join(privateDir,'runtime-failure.log'),String(r.stdout||'')+'\n'+String(r.stderr||''));throw Error('Portable Docker operation failed; diagnostics saved privately in storage/codex-local/portable/runtime-failure.log.');}
  return raw?r.stdout:String(r.stdout).trim();
}
function compose(args,opts){return run(prefix.slice(2).concat(args),opts);}
function id(service){const value=compose(['ps','-q',service]);assert(/^[a-f0-9]{64}$/.test(value),'Expected one rehearsal service.');return value;}
function inspect(service){const item=JSON.parse(run(['inspect',id(service)]))[0];assert.equal(item.Config.Labels['com.docker.compose.project'],project);assert.equal(item.Config.Labels['observatorio.purpose'],purpose);return item;}
function php(code,opts={}){return compose(['exec','-T','api','php'],{...opts,input:'<?php\nrequire "vendor/autoload.php";\n$app=require "bootstrap/app.php";\n$app->make(Illuminate\\Contracts\\Console\\Kernel::class)->bootstrap();\nif(config("database.connections.pgsql.host")!=="postgres" || !str_ends_with(config("database.connections.pgsql.database"),"_test")) throw new RuntimeException("Not a rehearsal DB");\n'+code});}
function sql(query,db='observatorio_portable_test'){
  assert(/^[a-z0-9_]+_test$/.test(db));return compose(['exec','-T','postgres','psql','-X','-qAt','-U','portable_owner','-d',db,'-v','ON_ERROR_STOP=1'],{input:query});
}
function mongo(code,{restore=false,input,raw=false}={}){
  const auth=restore?'portable_root':'portable_app',password=restore?'MONGO_INITDB_ROOT_PASSWORD':'PORTABLE_MONGO_APP_PASSWORD',source=restore?'admin':'observatorio_portable_test';
  return compose(['exec','-T','mongo','sh','-c',`exec mongosh --quiet --username ${auth} --password "$${password}" --authenticationDatabase ${source} --eval "$1"`,'portable-mongo',code],{input,raw});
}
function pdf(){let text='%PDF-1.4\n',offsets=[0];const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 200] >>'];for(let i=0;i<objects.length;i++){offsets.push(Buffer.byteLength(text));text+=`${i+1} 0 obj\n${objects[i]}\nendobj\n`;}const xref=Buffer.byteLength(text);text+=`xref\n0 4\n0000000000 65535 f \n${offsets.slice(1).map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')}trailer\n<< /Size 4 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;return Buffer.from(text);}
function hash(bytes){return crypto.createHash('sha256').update(bytes).digest('hex');}
const env=Object.fromEntries(fs.readFileSync(envFile,'utf8').trim().split(/\r?\n/).map(line=>{const i=line.indexOf('=');return[line.slice(0,i),line.slice(i+1)];}));
assert.equal(env.PORTABLE_HTTP_PORT,'4400','The executable rehearsal binds only its documented port.');
const origin='http://localhost:4400';
function client(){const jar=new Map();return async(route,opts={})=>{
  assert(route.startsWith('/')&&!route.startsWith('//'));const headers={Accept:'application/json',Origin:origin,Referer:origin+'/',Connection:'close',...opts.headers};
  if(jar.size)headers.Cookie=[...jar].map(([key,value])=>key+'='+value).join('; ');
  if(opts.method&&jar.has('XSRF-TOKEN'))headers['X-XSRF-TOKEN']=decodeURIComponent(jar.get('XSRF-TOKEN'));
  if(typeof opts.body==='string')headers['Content-Type']='application/json';
  const response=await fetch(origin+route,{...opts,headers,redirect:'manual',signal:AbortSignal.timeout(30000)});
  for(const cookie of response.headers.getSetCookie()){const first=cookie.split(';')[0],i=first.indexOf('=');jar.set(first.slice(0,i),first.slice(i+1));}
  return response;
};}
async function get(c,route,status=200){let r;for(let attempt=0;attempt<4;attempt++){
  try{r=await c(route);break;}catch(error){if(attempt===3||!['ECONNRESET','ECONNREFUSED','UND_ERR_SOCKET','ETIMEDOUT'].includes(error.cause?.code))throw error;await new Promise(resolve=>setTimeout(resolve,250*(attempt+1)));}
}assert.equal(r.status,status,route);checks++;return r;}
async function login(account){const c=client();await get(c,'/sanctum/csrf-cookie',204);const r=await c('/api/login',{method:'POST',body:JSON.stringify(account)});assert.equal(r.status,200,'Synthetic rehearsal login');checks++;return c;}
async function file(c,url,bytes){const u=new URL(url,origin);assert.equal(u.origin,origin);const r=await get(c,u.pathname+u.search);assert(r.headers.get('content-type').includes('application/pdf'));assert.equal(hash(Buffer.from(await r.arrayBuffer())),hash(bytes));checks++;}

(async()=>{
  fs.mkdirSync(privateDir,{recursive:true});
  assert(/^(npipe:\/\/|unix:\/\/)/.test(run(['context','inspect','default','--format','{{.Endpoints.docker.Host}}'])),'Only a local Docker engine is allowed.');
  const config=JSON.parse(compose(['config','--format','json']));
  assert.equal(config.services.api.environment.DB_DATABASE,'observatorio_portable_test');
  assert.equal(config.services.api.environment.DB_HOST,'postgres');assert.equal(config.services.api.environment.DATABASE_URL,'');assert.equal(config.services.api.environment.DB_URL,'');
  assert.equal(config.services.api.environment.MONGODB_DATABASE,'observatorio_portable_test');
  const mongoTarget=new URL(config.services.api.environment.MONGODB_URI);assert.equal(mongoTarget.hostname,'mongo');assert.equal(mongoTarget.username,'portable_app');
  assert.equal(mongoTarget.pathname,'/observatorio_portable_test');assert.equal(config.services.api.environment.FILESYSTEM_DISK,'local');
  assert.equal(config.networks.portable.internal,true);
  const existingVolumes=new Set(run(['volume','ls','--format','{{.Name}}']).split('\n'));
  for(const volume of Object.values(config.volumes))assert(!existingVolumes.has(volume.name),'Full rehearsal requires fresh volumes; preserve existing rehearsal data or explicitly remove only its labelled disposable volumes first.');
  for(const [name,service]of Object.entries(config.services)){
    assert(!service.container_name);if(name!=='web')assert(!service.ports?.length);
    for(const mount of service.volumes||[])if(mount.type==='bind')assert(['postgres-init.sh','mongo-init.js'].includes(path.basename(mount.source))&&mount.read_only);
  }
  assert(config.services.web.ports.every(port=>port.host_ip==='127.0.0.1'&&Number(port.published)===4400));checks+=8;
  compose(['up','-d','--wait','postgres','mongo']);inspect('postgres');inspect('mongo');
  // Explicit one-off schema task; never a service start or automatic seeder.
  compose(['run','--rm','--no-deps','schema']);
  const migrations=Number(sql('SELECT count(*) FROM migrations;'));assert(migrations>0);assert.equal(Number(sql('SELECT count(*) FROM users;')),0,'Rehearsal must start empty; no production or previous user data is accepted.');
  compose(['up','-d','--wait','api','web']);
  for(const service of ['api','web']){const item=inspect(service);assert.equal(item.HostConfig.ReadonlyRootfs,true);assert(item.Config.User&&!item.Config.User.startsWith('0'));assert(item.HostConfig.CapDrop.includes('ALL'));checks++;}
  assert.equal(compose(['exec','-T','api','id','-u']),'10001');assert.equal(compose(['exec','-T','web','id','-u']),'101');
  compose(['exec','-T','api','composer','check-platform-reqs','--no-dev']);
  compose(['exec','-T','api','php','-r','exit(file_exists(".env") || is_dir("vendor/phpunit") || is_dir("tests") ? 1 : 0);']);
  compose(['exec','-T','web','sh','-c','test ! -e /app/node_modules && test ! -e /usr/share/nginx/html/.env && test ! -e /usr/share/nginx/html/server/server.mjs']);checks+=4;
  const account={email:'portable-admin@example.test',password:crypto.randomBytes(24).toString('base64url')};
  fs.writeFileSync(path.join(privateDir,'private-access.json'),JSON.stringify({url:origin,...account},null,2),{mode:0o600});
  const seed=php(`$input=json_decode(${JSON.stringify(JSON.stringify(account))},true);\n`+
    '$user=App\\Models\\User::withoutEvents(fn()=>App\\Models\\User::create(["name"=>"Administrador de ensayo","email"=>$input["email"],"password"=>Illuminate\\Support\\Facades\\Hash::make($input["password"]),"rol"=>"ADMIN","is_active"=>true,"email_verified_at"=>now()]));\n'+
    '$department=App\\Models\\Departamento::create(["nombre"=>"Observatorio de ensayo","codigo_interno"=>"PORTABLE-TEST","descripcion"=>"Datos exclusivamente sintéticos","publico"=>true]);\n'+
    'Illuminate\\Support\\Facades\\DB::connection("mongodb")->getCollection("portable_probe")->insertOne(["marker"=>"portable-rehearsal","value"=>42]);\n'+
    'echo json_encode(["user"=>$user->id,"department"=>$department->id]);');
  const fixture=JSON.parse(seed);const anon=client();
  for(const route of ['/','/auth/login','/admin/dashboard','/publico/atlas']){const r=await get(anon,route);assert((await r.text()).includes('<app-root'));assert(r.headers.get('content-security-policy').includes("connect-src 'self'"));assert(!r.headers.get('content-security-policy').includes('onrender.com'));assert.equal(r.headers.get('x-content-type-options'),'nosniff');checks++;}
  const worker=await(await get(anon,'/ngsw.json')).json();assert.deepEqual(worker.dataGroups,[]);
  const shell=Buffer.from(await(await get(anon,worker.index)).arrayBuffer());assert.equal(crypto.createHash('sha1').update(shell).digest('hex'),worker.hashTable[worker.index]);
  assert.deepEqual(Buffer.from(await(await get(anon,'/index.html')).arrayBuffer()),shell);checks+=2;
  await get(anon,'/.env',404);await get(anon,'/missing.js',404);await get(anon,'/api/user',401);
  const health=await(await get(anon,'/api/health?deep=1')).json();assert.equal(health.ok,true);assert.deepEqual(health.services,{postgres:'ok',mongodb:'ok'});
  // Earlier stateful GETs may legitimately issue an XSRF cookie. Use a fresh jar.
  const rejected=await client()('/api/login',{method:'POST',body:JSON.stringify(account)});assert.equal(rejected.status,419,'Stateful login without CSRF must fail');checks++;
  const c=await login(account);assert.equal((await(await get(c,'/api/user')).json()).id,fixture.user);
  const bytes=pdf(),data=new FormData();for(const[key,value]of Object.entries({tipo:'LIBRO',estado:'EN_REVISION',titulo:'Libro del ensayo portable',fecha_publicacion:'2026-10-30',solo_suscriptores:'1',descripcion:'Prueba de persistencia y restauración',fuente:'Ensayo local'}))data.append(key,value);
  data.append('archivo',new Blob([bytes],{type:'application/pdf'}),'portable.pdf');
  const created=await c('/api/departamentos/'+fixture.department+'/publicaciones',{method:'POST',body:data});assert.equal(created.status,201,'Private PDF upload');checks++;
  const publication=(await created.json()).data;assert(/^[a-f0-9-]{36}$/.test(publication.id)&&publication.download_url);await file(c,publication.download_url,bytes);
  const download=new URL(publication.download_url,origin),denied=await anon(download.pathname+download.search);
  assert([401,403,404].includes(denied.status),'Anonymous private PDF must be denied, including concealed management identities');assert(!denied.headers.has('location'));assert(!denied.headers.get('content-type')?.includes('application/pdf'));checks++;
  await get(anon,'/storage/'+publication.id+'.pdf',404);
  const library=await(await get(c,'/api/departamentos/'+fixture.department+'/biblioteca/publicaciones')).json();assert.equal(library.meta.per_page,20);assert.equal(library.meta.total,1);
  const pathStored=sql(`SELECT archivo_pdf FROM observatorio_publicaciones WHERE id='${publication.id}';`);assert(/^[a-zA-Z0-9_./-]+$/.test(pathStored)&&!pathStored.includes('..'));
  const before={migrations,users:Number(sql('SELECT count(*) FROM users;')),publications:Number(sql('SELECT count(*) FROM observatorio_publicaciones;'))};
  const beforeApi=id('api');compose(['up','-d','--wait','--no-deps','--force-recreate','api']);compose(['up','-d','--wait','--no-deps','--force-recreate','web']);
  assert.notEqual(id('api'),beforeApi);assert.equal((await(await get(c,'/api/user')).json()).id,fixture.user);await file(c,publication.download_url,bytes);
  assert.equal(Number(sql('SELECT count(*) FROM migrations;')),before.migrations);assert.equal(Number(sql('SELECT count(*) FROM users;')),before.users);checks+=4;
  const pgDump=compose(['exec','-T','postgres','pg_dump','-Fc','-U','portable_owner','-d','observatorio_portable_test'],{raw:true});
  const mongoDump=compose(['exec','-T','mongo','sh','-c','exec mongodump --username portable_app --password "$PORTABLE_MONGO_APP_PASSWORD" --authenticationDatabase observatorio_portable_test --db observatorio_portable_test --archive'],{raw:true});
  const storageDump=compose(['exec','-T','api','tar','-czf','-','-C','/var/www/html/storage','app'],{raw:true});
  for(const[name,buffer]of Object.entries({'postgres.dump':pgDump,'mongo.archive':mongoDump,'storage.tar.gz':storageDump})){assert(buffer.length>0);fs.writeFileSync(path.join(privateDir,name),buffer,{mode:0o600});}
  const suffix=Date.now().toString(),restoredDb='portable_restore_'+suffix+'_test',restoredVolume=project+'-restore-'+suffix;
  assert(/^[a-z0-9_]+_test$/.test(restoredDb));
  compose(['exec','-T','postgres','createdb','-U','portable_owner','-O','portable_app',restoredDb]);
  compose(['exec','-T','postgres','pg_restore','--no-owner','--role=portable_app','-U','portable_owner','-d',restoredDb],{input:pgDump});
  compose(['exec','-T','mongo','sh','-c','exec mongorestore --username portable_root --password "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin --nsFrom "observatorio_portable_test.*" --nsTo "$1.*" --archive','portable-restore',restoredDb],{input:mongoDump});
  const restoredProbe=JSON.parse(mongo(`JSON.stringify(db.getSiblingDB('${restoredDb}').portable_probe.findOne({marker:'portable-rehearsal'},{_id:0}))`,{restore:true}));assert.equal(restoredProbe.value,42);
  mongo(`db.getSiblingDB('${restoredDb}').createUser({user:'portable_app',pwd:process.env.PORTABLE_MONGO_APP_PASSWORD,roles:[{role:'readWrite',db:'${restoredDb}'}]})`,{restore:true});
  run(['volume','create','--label','observatorio.purpose='+purpose,'--label','com.docker.compose.project='+project,restoredVolume]);
  const volume=JSON.parse(run(['volume','inspect',restoredVolume]))[0];assert.equal(volume.Labels['observatorio.purpose'],purpose);
  const mount=['--mount',`type=volume,source=${restoredVolume},target=/var/www/html/storage`];
  run(['run','--rm','-i','--network','none','--read-only',...mount,'--entrypoint','tar','observatorio-portable-api:phase4','-xzf','-','-C','/var/www/html/storage'],{input:storageDump});
  const restoredHash=run(['run','--rm','--network','none','--read-only',...mount,'--entrypoint','php','observatorio-portable-api:phase4','-r','echo hash_file("sha256","/var/www/html/storage/app/private/".$argv[1]);',pathStored]);assert.equal(restoredHash,hash(bytes));
  assert.equal(Number(sql('SELECT count(*) FROM users;',restoredDb)),before.users);assert.equal(Number(sql('SELECT count(*) FROM observatorio_publicaciones;',restoredDb)),before.publications);checks+=5;
  const overridePath=path.join(privateDir,'restore.override.json');
  fs.writeFileSync(overridePath,JSON.stringify({services:{api:{environment:{DB_DATABASE:restoredDb,MONGODB_DATABASE:restoredDb,MONGODB_URI:`mongodb://portable_app:${env.PORTABLE_MONGO_APP_PASSWORD}@mongo:27017/${restoredDb}?authSource=${restoredDb}`},volumes:['restored-storage:/var/www/html/storage']}},volumes:{'restored-storage':{external:true,name:restoredVolume}}}),{mode:0o600});
  function restored(args){return compose(['-f',overridePath,...args]);}
  try{
    restored(['up','-d','--wait','--no-deps','--force-recreate','api']);restored(['up','-d','--wait','--no-deps','--force-recreate','web']);
    assert.equal((await(await get(anon,'/api/health?deep=1')).json()).ok,true);
    const restoredClient=await login(account);await file(restoredClient,publication.download_url,bytes);
    const report=new FormData();for(const[k,v]of Object.entries({tipo:'REPORTE',estado:'EN_REVISION',titulo:'Solo en la restauración',fecha_publicacion:'2026-10-30',link_url:'https://app.powerbi.com/view?r=portable-rehearsal'}))report.append(k,v);
    assert.equal((await restoredClient('/api/departamentos/'+fixture.department+'/publicaciones',{method:'POST',body:report})).status,201);
    assert.equal(Number(sql('SELECT count(*) FROM observatorio_publicaciones;',restoredDb)),before.publications+1);assert.equal(Number(sql('SELECT count(*) FROM observatorio_publicaciones;')),before.publications);checks+=3;
  }finally{
    compose(['up','-d','--wait','--no-deps','--force-recreate','api']);compose(['up','-d','--wait','--no-deps','--force-recreate','web']);
  }
  const finalClient=await login(account);await file(finalClient,publication.download_url,bytes);
  const result={ok:true,project,url:origin,checks,syntheticOnly:true,productionRequests:0,productionWrites:0,appUsersNonRoot:true,phpPlatformVerified:true,frontendSpa:true,postgresAndMongoHealthy:true,privatePdfSha256:hash(bytes),recreatePreservedSessionAndPdf:true,runtimeDidNotMigrateOrSeed:true,backupsRestored:true,restoredApplicationVerified:true,restoredDb,restoredVolume,sourceRowsUnchangedAfterRestore:true,checkedAt:new Date().toISOString()};
  fs.writeFileSync(path.join(privateDir,'results.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
})().catch(error=>{console.error(error.message);process.exitCode=1;});
