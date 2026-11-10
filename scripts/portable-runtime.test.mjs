import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
const root=new URL('../',import.meta.url);
const read=async path=>(await readFile(new URL(path,root),'utf8')).replaceAll('\r\n','\n');
const [web,api,boot,compose,headers,nginx,webIgnore,apiIgnore,workflow,init]=await Promise.all([
  'frontend/Dockerfile.portable','backend/Dockerfile.portable','backend/docker/portable-entrypoint.sh','deploy/portable/compose.yml',
  'frontend/docker/portable-headers.conf','frontend/docker/portable-nginx.conf','frontend/.dockerignore',
  'backend/Dockerfile.portable.dockerignore','.github/workflows/security.yml','scripts/init-portable-env.mjs',
].map(read));

test('portable images lock all external bases and match the CI Node/PHP/MongoDB line',()=>{
  for(const source of [web,api])for(const match of source.matchAll(/^FROM (\S+)/gm)){
    if(['php-base'].includes(match[1]))continue;
    assert.match(match[1],/@sha256:[a-f0-9]{64}$/);
  }
  const version=/FROM node:([\d.]+)-alpine/.exec(web)[1];assert(workflow.includes(`node-version: '${version}'`));
  assert(api.includes('php:8.4-fpm-alpine'));assert(workflow.includes("php-version: '8.4'"));
  assert(api.includes('mongodb-2.5.2'));assert(workflow.includes('mongodb-2.5.2'));
});
test('the portable PHP build verifies production requirements instead of ignoring them',()=>{
  assert(!api.includes('--ignore-platform-reqs'));
  for(const value of ['composer install --no-dev','--no-scripts','--no-plugins','composer check-platform-reqs --no-dev','USER 10001:10001'])assert(api.includes(value));
  assert(!/COPY.*\.env/.test(api));assert(api.includes('FROM php-base AS runtime'));
});
test('only browser files reach the non-root frontend runtime, using a same-origin API',()=>{
  assert(web.includes('npm ci --no-audit --no-fund'));assert(web.includes('ENV API_URL=/api'));assert(web.includes('npm run build:vercel'));
  const runtime=web.slice(web.indexOf('FROM nginxinc/'));assert(runtime.includes('/app/dist/frontend/browser'));assert(!runtime.includes('node_modules'));assert(!runtime.includes('/server'));
  assert(runtime.includes('USER 101:101'));assert(runtime.includes('ENTRYPOINT ["nginx"]'));
});
test('normal portable startup cannot run a schema change or a seeder',()=>{
  assert(!/artisan\s+(?:migrate|db:seed)|RUN_MIGRATIONS/.test(boot));assert(boot.includes('APP_KEY'));
  assert(compose.includes('profiles: [tools]'));assert(compose.includes('command: [php, artisan, migrate, --force, \'--isolated=75\']'));
  assert(!compose.includes('--seed'));assert(!compose.includes('container_name:'));
});
test('the rehearsal has separate persistent volumes and no inherited database URLs or public database ports',()=>{
  assert(compose.includes('DB_URL: \'\''));assert(compose.includes('DATABASE_URL: \'\''));
  assert(compose.includes('DB_DATABASE: observatorio_portable_test'));assert(compose.includes('MONGODB_DATABASE: observatorio_portable_test'));
  assert.equal((compose.match(/^    ports:/gm)||[]).length,1);assert(compose.includes('127.0.0.1:${PORTABLE_HTTP_PORT:-4400}:8080'));
  for(const value of ['pg-data:','mongo-data:','app-storage:','internal: true','read_only: true','cap_drop: [ALL]','no-new-privileges:true'])assert(compose.includes(value));
  assert(compose.includes('DB_USERNAME: portable_app'));assert(compose.includes('mongodb://portable_app:'));
});
test('local CSP retains the published controls except the local transport/origin adaptations',async()=>{
  const vercel=JSON.parse(await read('frontend/vercel.json'));
  const published=vercel.headers.flatMap(rule=>rule.headers).find(header=>header.key==='Content-Security-Policy').value;
  const current=/add_header Content-Security-Policy "([^"]+)" always/.exec(headers)[1];
  const parse=source=>new Map(source.split(';').map(item=>item.trim().split(/\s+/)).filter(item=>item[0]).map(([key,...values])=>[key,values]));
  const expected=parse(published),actual=parse(current);expected.delete('upgrade-insecure-requests');expected.set('connect-src',["'self'"]);
  assert.deepEqual(actual,expected);
  for(const header of ['X-Frame-Options','X-Content-Type-Options','Referrer-Policy','Permissions-Policy'])assert(headers.includes(`add_header ${header} `));
});
test('the web runtime preserves API status/cookies, prevents arbitrary PHP paths and never caches sessions',()=>{
  assert(nginx.includes('fastcgi_param SCRIPT_FILENAME /var/www/html/public/index.php;'));assert(nginx.includes('fastcgi_pass api:9000;'));
  assert(nginx.includes('location ~ ^/(api|sanctum|storage)(/|$)'));assert(nginx.includes('location ~ \\.php$ { return 404; }'));
  assert(!/fastcgi_cache\s|proxy_cache\s/.test(nginx));assert(nginx.includes('try_files $uri =404'));
  for(const path of ['/index.html','/index.csr.html','/ngsw.json'])assert(nginx.includes(`location = ${path}`));
  assert(nginx.includes('add_header Cache-Control "no-store" always'));
});
test('both portable build contexts exclude local material even inside source/public trees',()=>{
  for(const ignore of [webIgnore,apiIgnore]){
    assert.match(ignore,/^\*\*$/m);
    for(const value of ['**/.env','**/.env.*','**/auth.json','**/*.key','**/*.pem','**/*.p12','**/*.pfx','**/*.log','**/*.bak'])assert(ignore.includes(value));
    assert(!ignore.includes('!storage/'));assert(!ignore.includes('!output/'));assert(!ignore.includes('!node_modules/'));assert(!ignore.includes('!.git/'));
  }
});
test('private rehearsal values are generated once and never written into the example template',async()=>{
  assert(init.includes('randomBytes(32)'));assert(init.includes("flag:'wx'"));assert(init.includes('mode:0o600'));assert(init.includes('secretsPrinted:false'));
  const template=await read('deploy/portable/.env.example');
  for(const line of template.split('\n').filter(line=>/^PORTABLE_.*(?:KEY|PASSWORD)=/.test(line)))assert(line.endsWith('='));
});
