const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const {spawnSync} = require('node:child_process');
const {randomBytes} = require('node:crypto');

// Exercise the actual Nginx location selection with a synthetic PHP front controller.
// No application source, .env, database, real uploads or host ports enter the containers.
const images = {
  php: 'php@sha256:93aa3f61216b73cc6f878235c9772849449f4efc18dfe3d6678eed645076c00d',
  nginx: 'nginxinc/nginx-unprivileged@sha256:f5116ed4606f3eb015dd4a8e28cb9b351476dc0ad4bc6e9f93b19cec130cdf03',
};
const root = path.resolve('storage/codex-local');
fs.mkdirSync(root, {recursive:true});
const fixture = fs.mkdtempSync(path.join(root, 'a02-ingress-'));
assert(path.resolve(fixture).startsWith(root + path.sep));
fs.chmodSync(fixture, 0o755); // Synthetic config must be readable by the unprivileged Nginx user.
const purpose = 'a02-synthetic-api-ingress', suffix = randomBytes(5).toString('hex');
const network = 'obs-ingress-' + suffix;
const ids = []; let networkId;
const log = fs.openSync(path.join(root, 'api-ingress-check.log'), 'w');
function docker(args, optional = false) {
  const r = spawnSync('docker', ['--context', 'default', ...args], {encoding:'utf8', windowsHide:true, timeout:180000, maxBuffer:4*1024*1024});
  fs.writeSync(log, (r.stdout || '') + '\n' + (r.stderr || ''));
  assert(optional || (!r.error && r.status === 0), 'Synthetic ingress operation failed; private log retained.');
  return r;
}
function start(image, alias, mounts, command) {
  const id = docker(['run', '--detach', '--read-only', '--tmpfs', '/tmp', '--network', network,
    '--network-alias', alias, '--label', 'observatorio.purpose=' + purpose, ...mounts, '--entrypoint', command[0], image, ...command.slice(1)]).stdout.trim();
  assert(/^[a-f0-9]{64}$/.test(id)); ids.push(id); return id;
}
function probe(client, uri, method = 'GET', body = '') {
  const code = '$u=$argv[1];$b=file_get_contents("http://edge:8080".$u,false,stream_context_create(["http"=>["ignore_errors"=>true,"timeout"=>5,"method"=>$argv[2],"header"=>"Content-Type: application/json","content"=>$argv[3]]]));preg_match("#HTTP/\\S+ (\\d+)#",$http_response_header[0]??"",$m);echo json_encode(["status"=>(int)($m[1]??0),"body"=>$b]);';
  const r = docker(['exec', client, 'php', '-r', code, uri, method, body], true);
  try { return JSON.parse(r.stdout); } catch { return {status:0}; }
}
try {
  const sourceFile = process.argv[2] === '--config' ? process.argv[3] : 'backend/docker/nginx.conf';
  const source = fs.readFileSync(sourceFile, 'utf8');
  assert(source.includes('fastcgi_pass 127.0.0.1:9000;'));
  fs.mkdirSync(path.join(fixture, 'public/assets'), {recursive:true});
  fs.mkdirSync(path.join(fixture, 'public/api'), {recursive:true});
  fs.writeFileSync(path.join(fixture, 'public/index.php'), '<?php header("Content-Type: application/json"); echo json_encode(["synthetic_front_controller"=>true,"uri"=>$_SERVER["REQUEST_URI"],"method"=>$_SERVER["REQUEST_METHOD"],"body"=>file_get_contents("php://input")]);');
  fs.writeFileSync(path.join(fixture, 'public/assets/synthetic.css'), '/* synthetic-static-asset */');
  fs.writeFileSync(path.join(fixture, 'public/api/static.png'), 'API paths must not bypass the front controller.');
  fs.writeFileSync(path.join(fixture, 'server.conf'), source.replaceAll('__PORT__', '8080')
    .replace('fastcgi_pass 127.0.0.1:9000;', 'fastcgi_pass php:9000;').replace('include fastcgi_params;', 'include /etc/nginx/fastcgi_params;'));
  fs.writeFileSync(path.join(fixture, 'nginx.conf'), 'pid /tmp/nginx.pid;\nerror_log /dev/stderr warn;\nevents {}\nhttp {\ninclude /etc/nginx/mime.types;\nclient_body_temp_path /tmp/client;\nproxy_temp_path /tmp/proxy;\nfastcgi_temp_path /tmp/fastcgi;\nuwsgi_temp_path /tmp/uwsgi;\nscgi_temp_path /tmp/scgi;\ninclude /fixture/server.conf;\n}\n');
  networkId = docker(['network', 'create', '--label', 'observatorio.purpose=' + purpose, network]).stdout.trim();
  assert(/^[a-f0-9]{64}$/.test(networkId));
  const publicMount = ['--mount', 'type=bind,source=' + path.join(fixture, 'public') + ',target=/var/www/html/public,readonly'];
  const php = start(images.php, 'php', publicMount, ['php-fpm', '-F']);
  start(images.nginx, 'edge', [...publicMount, '--mount', 'type=bind,source=' + fixture + ',target=/fixture,readonly'], ['nginx', '-c', '/fixture/nginx.conf', '-g', 'daemon off;']);
  let ready = false;
  for (let n=0; n<30; n++) {
    if (probe(php, '/api/publico/atlas').status === 200) {ready=true;break;}
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,500);
  }
  assert(ready, 'Synthetic ingress did not become ready; private log retained.');
  const api = ['/api/avatars/synthetic.png', '/api/avatars/synthetic.jpg?test=1', '/api/reportes/fichas/synthetic.pdf', '/api/publico/atlas', '/api/static.png'];
  for (const uri of api) {
    const result = probe(php, uri);
    assert.equal(result.status, 200, uri + ' must reach the front controller.');
    assert.deepEqual(JSON.parse(result.body), {synthetic_front_controller:true, uri, method:'GET', body:''});
  }
  const postUri='/api/login?source=synthetic',postBody='{"email":["synthetic"]}';
  const post=probe(php,postUri,'POST',postBody);
  assert.equal(post.status,200);
  assert.deepEqual(JSON.parse(post.body),{synthetic_front_controller:true,uri:postUri,method:'POST',body:postBody});
  const css = probe(php, '/assets/synthetic.css');
  assert.equal(css.status,200); assert.equal(css.body,'/* synthetic-static-asset */');
  assert.equal(probe(php,'/assets/missing.png').status,404);
  assert.equal(probe(php,'/.env').status,403);
  console.log(JSON.stringify({ok:true,synthetic:true,productionAccess:false,hostPorts:0,apiRequests:api.length+1,staticAndDenyChecks:3}));
} finally {
  for (const id of ids.reverse()) {
    const inspected = docker(['inspect', id], true);
    if (inspected.status !== 0) continue;
    const info = JSON.parse(inspected.stdout)[0];
    assert.equal(info.Config.Labels['observatorio.purpose'],purpose);
    docker(['logs', id], true); docker(['stop', id]); docker(['rm', id]);
  }
  if (networkId) {
    const info = JSON.parse(docker(['network','inspect',networkId]).stdout)[0];
    assert.equal(info.Labels['observatorio.purpose'],purpose); docker(['network','rm',networkId]);
  }
  fs.closeSync(log);
  assert(path.resolve(fixture).startsWith(root + path.sep) && !fs.lstatSync(fixture).isSymbolicLink());
  fs.rmSync(fixture, {recursive:true});
}
