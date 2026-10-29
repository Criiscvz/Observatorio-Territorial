// Operator-only HTTP recovery checks against the prepared local rehearsal.
// Requires Node 22+, Docker and ignored synthetic credentials/file manifests.
// Never accepts a production endpoint or credentials through command arguments.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const dir = path.join(process.cwd(), 'storage/codex-local/ensayo');
const secret = JSON.parse(fs.readFileSync(path.join(dir, 'credentials.private.json')));
const files = JSON.parse(fs.readFileSync(path.join(dir, 'files-manifest.json')));
const base = 'http://localhost:8101';
const origin = 'http://localhost:4300';
assert.equal(new URL(base).hostname, 'localhost');
assert.equal(new URL(base).port, '8101');
const isolation = spawnSync('docker', ['inspect','subsanacion-ensayo-db','--format','{{index .Config.Labels "observatorio.purpose"}}'], {encoding:'utf8',windowsHide:true});
assert.equal(isolation.status, 0, 'The prepared rehearsal database must exist');
assert.equal(isolation.stdout.trim(), 'rehearsal', 'Refusing a database without the rehearsal label');
const sql = `select json_build_object(
  'users', (select json_agg(x) from (
    select u.id, u.rol, coalesce((
      select json_agg(ud.departamento_id) from usuario_departamento ud where ud.user_id=u.id
    ), '[]'::json) assigned from users u
  ) x),
  'publications', (select json_agg(p) from (
    select id, departamento_id, creado_por, tipo, estado, solo_suscriptores, archivo_pdf,
      exists(select 1 from departamentos d
        where d.id=observatorio_publicaciones.departamento_id and d.deleted_at is null
      ) active_department
    from observatorio_publicaciones
  ) p)
)::text;`;
const query = spawnSync('docker', ['exec','subsanacion-ensayo-db','psql','-U','ensayo','-d','observatorio_ensayo_test','-At','-c',sql], {encoding:'utf8',windowsHide:true});
assert.equal(query.status,0,query.stderr);
const data = JSON.parse(query.stdout.trim());
let checks = 0;
function check(value,message) { assert(value,message); checks++; }
function client() {
  const jar = new Map();
  return async (route, options={}) => {
    assert(route.startsWith('/') && !route.startsWith('//'));
    const headers = {Accept:'application/json',Origin:origin,Referer:origin+'/',...options.headers};
    if(jar.size) headers.Cookie = [...jar].map(([k,v])=>k+'='+v).join('; ');
    if(options.method && jar.has('XSRF-TOKEN')) headers['X-XSRF-TOKEN'] = decodeURIComponent(jar.get('XSRF-TOKEN'));
    if(options.body) headers['Content-Type'] = 'application/json';
    const response = await fetch(base+route,{...options,headers,redirect:'manual',signal:AbortSignal.timeout(45000)});
    for(const cookie of response.headers.getSetCookie()) { const first=cookie.split(';')[0]; const i=first.indexOf('='); jar.set(first.slice(0,i),first.slice(i+1)); }
    return response;
  };
}
async function login(user) {
  assert(user, 'A synthetic account for each of the five roles is required');
  const c=client();
  check((await c('/sanctum/csrf-cookie')).status===204,'CSRF cookie');
  const account=secret.users.find(u=>u.id===user.id);
  assert(account?.email.endsWith('@example.invalid'), 'Only synthetic accounts are allowed');
  const response=await c('/api/login',{method:'POST',body:JSON.stringify({email:account.email,password:secret.password})});
  check(response.status===200,'Synthetic '+user.rol+' login status '+response.status);
  const current=await c('/api/user');
  const body=await current.json();
  check(current.status===200 && (body.data??body).rol===user.rol,'Restored role');
  return c;
}
(async()=>{
  const anonymous=client();
  check((await anonymous('/api/health?deep=1')).status===200,'Local health');
  check((await anonymous('/api/user')).status===401,'Anonymous session denied');
  check((await anonymous('/api/admin/inicio')).status===401,'Anonymous administration denied');
  const noCsrf=await client()('/api/login',{method:'POST',body:'{}'});
  check(noCsrf.status===419,'CSRF required');
  const selected = role => data.users.filter(u=>u.rol===role && secret.users.some(a=>a.id===u.id)).sort((a,b)=>b.assigned.length-a.assigned.length)[0];
  const admin=await login(selected('ADMIN'));
  const summary=await admin('/api/admin/inicio'); check(summary.status===200,'Admin summary');
  const listing=await admin('/api/admin/publicaciones'); const page=await listing.json();
  check(listing.status===200 && page.meta.per_page===20 && page.data.length<=20,'Pagination 20');
  check(page.meta.total===data.publications.filter(p=>p.tipo!=='ATLAS' && p.active_department).length,'Restored publication count');
  check(listing.headers.get('access-control-allow-origin')===origin,'CORS rehearsal origin');
  let pdfCount=0;
  for(const p of data.publications.filter(p=>p.archivo_pdf)) {
    const r=await admin('/api/departamentos/publicaciones/'+p.id+'/download?context=management');
    check(r.status===200 && r.headers.get('content-type').startsWith('application/pdf'),'Restored PDF download');
    const bytes=Buffer.from(await r.arrayBuffer());
    const entry=files.find(f=>f.path.endsWith('/'+p.archivo_pdf));
    check(entry && crypto.createHash('sha256').update(bytes).digest('hex')===entry.sha256,'HTTP PDF checksum');
    check(r.headers.get('cache-control').includes('no-store'),'Private file cache control');
    pdfCount++;
  }
  const restricted=data.publications.filter(p=>p.archivo_pdf && (p.solo_suscriptores || p.estado!=='PUBLICACION'));
  for(const p of restricted) check([401,403,404].includes((await anonymous('/api/departamentos/publicaciones/'+p.id+'/download')).status),'Restricted PDF anonymous denied');
  for(const [role,route] of [['EDITOR','editor'],['ADMIN_OBSERVATORIO','observatorio-admin']]) {
    const u=selected(role); const c=await login(u);
    check((await c('/api/admin/inicio')).status===403,'Administration denied to '+role);
    const result=await c('/api/'+route+'/publicaciones'); const body=await result.json();
    check(result.status===200 && body.data.every(p=>u.assigned.includes(p.departamento_id)),'Observatory scope '+role);
    if(role==='EDITOR') check(body.data.every(p=>data.publications.find(x=>x.id===p.id).creado_por===u.id),'Editor own publications');
    check((await c('/api/'+route+'/inicio')).status===200,'Scoped dashboard');
    check((await c('/api/logout',{method:'POST'})).status===200,'Logout');
    check((await c('/api/user')).status===401,'Session invalid after logout');
  }
  for(const role of ['USER','SUBSCRIBER']) {
    const c=await login(selected(role));
    check((await c('/api/admin/inicio')).status===403,'No admin for '+role);
    check((await c('/api/logout',{method:'POST'})).status===200,'Logout '+role);
  }
  check((await admin('/api/logout',{method:'POST'})).status===200,'Admin logout');
  check((await admin('/api/user')).status===401,'Admin session invalidated');
  const result={ok:true,checks,pdfCount,restrictedPdfCount:restricted.length,roles:5,base,frontend:origin,productionRequests:0};
  fs.writeFileSync(path.join(dir,'http-results.json'),JSON.stringify(result,null,2));
  console.log(JSON.stringify(result));
})().catch(e=>{console.error(e.message);process.exitCode=1;});
