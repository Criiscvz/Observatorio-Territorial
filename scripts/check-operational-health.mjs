import { performance } from 'node:perf_hooks';
import { pathToFileURL } from 'node:url';

export async function checkHealth(address, {timeout = 5000} = {}) {
  const base = new URL(address);
  if (base.username || base.password || base.search || base.hash || base.pathname !== '/'
      || !(base.protocol === 'https:' || (base.protocol === 'http:' && ['localhost','127.0.0.1','[::1]'].includes(base.hostname)))) {
    throw new Error('Use an HTTPS origin or a local HTTP origin, without credentials, path or query.');
  }
  const checks = [];
  for (const deep of [false,true]) {
    const start = performance.now();
    try {
      const response = await fetch(new URL('/api/health' + (deep ? '?deep=1' : ''), base),
        {signal:AbortSignal.timeout(timeout), redirect:'error', headers:{Accept:'application/json'}});
      const text = await response.text();
      if (text.length > 16384) throw new Error('Unexpected health response.');
      const data = JSON.parse(text);
      checks.push({check:deep ? 'dependencies' : 'liveness', ok:response.status===200 && data.ok===true
        && (!deep || (data.services?.postgres==='ok' && data.services?.mongodb==='ok')),
        status:response.status, duration_ms:Math.round(performance.now()-start),
        correlation_available:/^[0-9a-f-]{36}$/.test(response.headers.get('x-request-id') || '')});
    } catch {
      // Never print the provider response, URL, exception, headers or connection details.
      checks.push({check:deep ? 'dependencies' : 'liveness', ok:false, status:null, duration_ms:Math.round(performance.now()-start)});
    }
  }
  return {ok:checks.every(check=>check.ok), checks};
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    if (process.argv.length!==4 || process.argv[2]!=='--url') throw new Error('Usage');
    const result = await checkHealth(process.argv[3]);
    console.log(JSON.stringify(result,null,2));
    process.exitCode=result.ok?0:1;
  } catch { console.error('Health check refused. Use --url with a safe origin and no credentials.'); process.exitCode=1; }
}
