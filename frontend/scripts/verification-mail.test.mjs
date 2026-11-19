import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { canonicalMessage, createVerificationHandler } from '../server/verification-mail.mjs';

const instant = 1795032000000;
const key = '1a'.repeat(32);
const defaults = { VERIFICATION_RELAY_SECRET: key, GMAIL_SMTP_USER: 'sender@example.test', GMAIL_SMTP_PASSWORD: 'synthetic-only' };
const payload = (changes = {}) => ({ kind: 'verification', timestamp: instant / 1000,
  nonce: '00000000-0000-4000-8000-000000000001', recipient: 'recipient@gmail.com', code: '135790', ...changes });
function request(body = payload(), changes = {}) {
  const signature = createHmac('sha256', Buffer.from(key, 'hex')).update(canonicalMessage(body)).digest('hex');
  return new Request('https://app.example.test/_internal/verification-mail', {
    method: 'POST', body: JSON.stringify(body),
    ...changes, headers: { 'Content-Type': 'application/json', 'X-Observatorio-Signature': signature, ...changes.headers },
  });
}
function setup({ env = defaults, result = { accepted: ['recipient@gmail.com'], rejected: [] }, failure, verified = true } = {}) {
  const calls = { create: [], sent: [], verify: 0, close: 0 };
  const handler = createVerificationHandler({ readEnv: () => env, now: () => instant, makeTransport: options => {
    calls.create.push(options);
    return { sendMail: async message => { calls.sent.push(message); if (failure) throw failure; return result; },
      verify: async () => { calls.verify++; if (failure) throw failure; return verified; }, close: () => { calls.close++; } };
  } });
  return { handler, calls };
}

test('only signed verification requests send a fixed template through Gmail with verified TLS', async () => {
  const { handler, calls } = setup();
  const response = await handler(request()); assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true }); assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(calls.create.length, 1); assert.equal(calls.create[0].host, 'smtp.gmail.com');
  assert.equal(calls.create[0].port, 465); assert.equal(calls.create[0].secure, true);
  assert.equal(calls.create[0].tls.rejectUnauthorized, true); assert.equal(calls.create[0].tls.minVersion, 'TLSv1.2');
  assert.equal(calls.create[0].debug, false); assert.equal(calls.create[0].logger, false);
  assert.equal(calls.create[0].disableUrlAccess, true); assert.equal(calls.create[0].disableFileAccess, true);
  assert.equal(calls.sent[0].from.address, defaults.GMAIL_SMTP_USER);
  assert.deepEqual(calls.sent[0].to, { address: 'recipient@gmail.com' });
  assert(calls.sent[0].text.includes('135790') && calls.sent[0].text.includes('10 minutos'));
  assert.equal(calls.sent[0].subject, 'Verifica tu correo electrónico'); assert.equal(calls.close, 1);
});
test('Outlook is a valid recipient of the same Gmail sender', async () => {
  const { handler, calls } = setup({ result: { accepted: ['recipient@outlook.com'], rejected: [] } });
  assert.equal((await handler(request(payload({ recipient: 'recipient@outlook.com' })))).status, 200);
  assert.equal(calls.sent[0].to.address, 'recipient@outlook.com');
});
test('the authenticated connection check does not send any message', async () => {
  const { handler, calls } = setup();
  assert.equal((await handler(request(payload({ kind: 'check', recipient: '', code: '' })))).status, 200);
  assert.equal(calls.verify, 1); assert.equal(calls.sent.length, 0); assert.equal(calls.close, 1);
});
test('an unsigned browser request cannot send mail', async () => {
  const { handler, calls } = setup();
  assert.equal((await handler(request(payload(), { headers: { 'X-Observatorio-Signature': '' } }))).status, 401);
  assert.equal(calls.create.length, 0);
});
for (const [name, patch] of Object.entries({ recipient: { recipient: 'other@gmail.com' }, code: { code: '246802' },
  kind: { kind: 'check', recipient: '', code: '' }, nonce: { nonce: '00000000-0000-4000-8000-000000000002' } })) {
  test('changing the signed ' + name + ' invalidates authentication', async () => {
    const original = request(), { handler, calls } = setup();
    const tampered = request(payload(patch), { headers: { 'X-Observatorio-Signature': original.headers.get('x-observatorio-signature') } });
    assert.equal((await handler(tampered)).status, 401); assert.equal(calls.create.length, 0);
  });
}
for (const delta of [-31, 31]) test('expired or future requests are rejected: ' + delta, async () => {
  const { handler, calls } = setup();
  assert.equal((await handler(request(payload({ timestamp: instant / 1000 + delta })))).status, 401);
  assert.equal(calls.create.length, 0);
});
test('a duplicate is rejected within the same warm instance, including simultaneous requests', async () => {
  const { handler, calls } = setup();
  const responses = await Promise.all([handler(request()), handler(request())]);
  assert.deepEqual(responses.map(value => value.status).sort(), [200, 409]); assert.equal(calls.sent.length, 1);
});
test('a sender cannot be controlled by request fields or header injection', async () => {
  for (const patch of [{ from: 'attacker@example.test' }, { html: '<script>arbitrary</script>' }, { attachments: [] },
    { recipient: 'one@gmail.com,two@gmail.com' }, { recipient: 'one@gmail.com\r\nBcc: other@gmail.com' },
    { code: '12345' }, { code: '135790\n' }, { nonce: 'invalid' }, { timestamp: '1795032000' }]) {
    const { handler, calls } = setup(); assert.equal((await handler(request(payload(patch)))).status, 400);
    assert.equal(calls.create.length, 0);
  }
});
test('disabled or malformed server configuration cannot use SMTP', async () => {
  for (const env of [{}, { ...defaults, VERIFICATION_RELAY_SECRET: 'short' }, { ...defaults, GMAIL_SMTP_PASSWORD: '' },
    { ...defaults, GMAIL_SMTP_USER: 'one@gmail.com\nother@gmail.com' }]) {
    const { handler, calls } = setup({ env }); assert.equal((await handler(request())).status, 503); assert.equal(calls.create.length, 0);
  }
});
test('methods and content types are limited', async () => {
  const { handler, calls } = setup();
  assert.equal((await handler(new Request('https://app.example.test/_internal/verification-mail'))).status, 405);
  assert.equal((await handler(request(payload(), { headers: { 'Content-Type': 'text/plain' } }))).status, 415);
  assert.equal(calls.create.length, 0);
});
test('oversized, invalid and unknown JSON bodies never reach SMTP', async () => {
  for (const body of ['x'.repeat(4097), '{', 'null', '[]']) {
    const { handler, calls } = setup();
    const response = await handler(new Request('https://app.example.test/_internal/verification-mail', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body,
    }));
    assert.equal(response.status, body.length > 4096 ? 413 : 400); assert.equal(calls.create.length, 0);
  }
});
test('provider errors and rejected messages expose only a generic result and are never retried', async () => {
  for (const options of [{ failure: new Error('synthetic provider credentials and code must stay private') },
    { result: { accepted: [], rejected: [] } }, { result: { accepted: ['one', 'two'], rejected: [] } },
    { result: { accepted: ['one'], rejected: ['two'] } }]) {
    const { handler, calls } = setup(options); const response = await handler(request());
    assert.equal(response.status, 503); assert.deepEqual(await response.json(), { ok: false, error: 'mail_unavailable' });
    assert.equal(calls.sent.length, 1); assert.equal(calls.close, 1);
  }
});
test('a failed SMTP authentication check sends no message', async () => {
  const { handler, calls } = setup({ verified: false });
  assert.equal((await handler(request(payload({ kind: 'check', recipient: '', code: '' })))).status, 503);
  assert.equal(calls.sent.length, 0); assert.equal(calls.close, 1);
});
for (const [code, category] of [['EAUTH', 'mail_authentication_failed'], ['ETIMEDOUT', 'mail_connection_failed']]) {
  test('operator checks report only a safe failure category: ' + code, async () => {
    const { handler, calls } = setup({ failure: Object.assign(new Error('synthetic private provider response'), { code }) });
    const response = await handler(request(payload({ kind: 'check', recipient: '', code: '' })));
    assert.equal(response.status, 503); assert.deepEqual(await response.json(), { ok: false, error: category });
    assert.equal(calls.sent.length, 0);
  });
}
test('the function is routed before the API proxy and SPA fallback and has no public environment file', async () => {
  const config = JSON.parse(await readFile(new URL('../vercel.json', import.meta.url), 'utf8'));
  assert.deepEqual(config.rewrites[0], { source: '/_internal/verification-mail', destination: '/api/verification-mail' });
  assert(config.rewrites.some(value => value.source === '/api/:path*' && value.destination.startsWith('https://observatorio-territorial-pruebas.onrender.com/')));
  const entry = await readFile(new URL('../api/verification-mail.mjs', import.meta.url), 'utf8');
  assert(entry.includes("../server/verification-mail.mjs")); assert(!entry.includes('import.meta.env'));
});
