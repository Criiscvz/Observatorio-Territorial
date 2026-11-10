import assert from 'node:assert/strict';
import test from 'node:test';
import {createServer} from 'node:http';
import {checkHealth} from './check-operational-health.mjs';

async function server(handler, run) {
  const instance=createServer(handler);
  await new Promise(resolve=>instance.listen(0,'127.0.0.1',resolve));
  try { await run('http://127.0.0.1:'+instance.address().port); }
  finally { instance.closeAllConnections(); await new Promise(resolve=>instance.close(resolve)); }
}
test('checks both liveness and the real health body, not merely HTTP 200', async()=>{
  await server((req,res)=>{
    res.setHeader('X-Request-ID','11111111-1111-4111-8111-111111111111');
    res.end(JSON.stringify(req.url.includes('deep') ? {ok:true,services:{postgres:'ok',mongodb:'ok'}} : {ok:true}));
  },async origin=>{
    const result=await checkHealth(origin); assert.equal(result.ok,true);
    assert.equal(result.checks.length,2); assert(result.checks.every(check=>check.correlation_available));
  });
});
test('a dependency outage with HTTP 200 is unhealthy',async()=>{
  await server((req,res)=>res.end(JSON.stringify({ok:!req.url.includes('deep'),services:{postgres:'ok',mongodb:'error'}})),async origin=>{
    const result=await checkHealth(origin); assert.equal(result.ok,false); assert.equal(result.checks[1].status,200);
  });
});
test('malformed, sensitive responses are never returned as diagnostics',async()=>{
  await server((req,res)=>res.end('private-synthetic-response-do-not-log'),async origin=>{
    const result=await checkHealth(origin); assert.equal(result.ok,false);
    assert(!JSON.stringify(result).includes('private-synthetic-response'));
  });
});
test('timeouts terminate both probes safely',async()=>{
  await server(()=>{},async origin=>{
    const result=await checkHealth(origin,{timeout:50}); assert.equal(result.ok,false);
    assert(result.checks.every(check=>check.status===null));
  });
});
test('credentials, query strings, paths and remote cleartext are refused before network access',async()=>{
  for(const address of ['https://user:secret@example.test','https://example.test?token=value','https://example.test/api',
    'https://example.test/#secret','http://example.test','file:///tmp/file']) await assert.rejects(()=>checkHealth(address));
});
