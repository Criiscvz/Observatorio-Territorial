import { createHmac, timingSafeEqual } from 'node:crypto';

const MAX_BYTES = 4096;
const WINDOW_SECONDS = 30;
const MAX_RECENT_REQUESTS = 1000;
const FIELDS = ['code', 'kind', 'nonce', 'recipient', 'timestamp'];
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;

function mailbox(value) {
  return typeof value === 'string' && value.length <= 255 &&
    /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/i.test(value);
}

export function canonicalMessage(body) {
  return ['observatorio-verification/v1', body.kind, String(body.timestamp), body.nonce, body.recipient, body.code].join('\n');
}

function reply(status, error) {
  return Response.json(error ? { ok: false, error } : { ok: true }, {
    status,
    headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' },
  });
}

async function readBody(request) {
  if (!request.body) return null;
  const reader = request.body.getReader(), chunks = [];
  let total = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_BYTES) { await reader.cancel(); return false; }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { return null; }
}

/** Server-only endpoint. Secrets and SMTP never enter the Angular build. */
export function createVerificationHandler({ readEnv, makeTransport, now = () => Date.now() }) {
  // Best-effort duplicate suppression in a warm instance. Authentication and the short
  // validity window apply across instances; this map is not a distributed one-use ledger.
  const recent = new Map();
  return async request => {
    if (request.method !== 'POST') return reply(405, 'method_not_allowed');
    const env = readEnv(), secret = env.VERIFICATION_RELAY_SECRET;
    if (!/^[a-f0-9]{64}$/i.test(secret || '') || !mailbox(env.GMAIL_SMTP_USER) || !env.GMAIL_SMTP_PASSWORD) {
      return reply(503, 'mail_unavailable');
    }
    if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') {
      return reply(415, 'invalid_request');
    }
    const size = request.headers.get('content-length');
    if (size && (!/^\d+$/.test(size) || Number(size) > MAX_BYTES)) return reply(413, 'invalid_request');
    let body;
    try { body = await readBody(request); } catch { return reply(400, 'invalid_request'); }
    if (body === false) return reply(413, 'invalid_request');
    if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).sort().join(',') !== FIELDS.join(',') ||
      !Number.isSafeInteger(body.timestamp) || !UUID.test(body.nonce || '') ||
      !['verification', 'check'].includes(body.kind) || typeof body.recipient !== 'string' || typeof body.code !== 'string' ||
      (body.kind === 'verification' ? (!mailbox(body.recipient) || !/^\d{6}$/.test(body.code)) : (body.recipient !== '' || body.code !== ''))) {
      return reply(400, 'invalid_request');
    }
    const seconds = Math.floor(now() / 1000), signature = request.headers.get('x-observatorio-signature') || '';
    if (Math.abs(seconds - body.timestamp) > WINDOW_SECONDS || !/^[a-f0-9]{64}$/i.test(signature)) return reply(401, 'unauthorized');
    const expected = createHmac('sha256', Buffer.from(secret, 'hex')).update(canonicalMessage(body)).digest();
    if (!timingSafeEqual(expected, Buffer.from(signature, 'hex'))) return reply(401, 'unauthorized');
    for (const [nonce, expires] of recent) if (expires < seconds) recent.delete(nonce);
    if (recent.has(body.nonce)) return reply(409, 'duplicate_request');
    if (recent.size >= MAX_RECENT_REQUESTS) return reply(429, 'mail_unavailable');
    recent.set(body.nonce, body.timestamp + WINDOW_SECONDS);

    let transport;
    try {
      transport = makeTransport({
        host: 'smtp.gmail.com', port: 465, secure: true,
        auth: { user: env.GMAIL_SMTP_USER, pass: env.GMAIL_SMTP_PASSWORD },
        tls: { minVersion: 'TLSv1.2', rejectUnauthorized: true },
        connectionTimeout: 5000, greetingTimeout: 5000, socketTimeout: 12000, dnsTimeout: 4000,
        logger: false, debug: false, disableFileAccess: true, disableUrlAccess: true,
      });
      if (body.kind === 'check') {
        if (await transport.verify() !== true) return reply(503, 'mail_unavailable');
      } else {
        const result = await transport.sendMail({
          from: { name: 'Observatorio Territorial ULEAM', address: env.GMAIL_SMTP_USER },
          to: { address: body.recipient },
          subject: 'Verifica tu correo electrónico',
          text: `Tu código de verificación es ${body.code}. Caduca en 10 minutos. Si no creaste una cuenta, ignora este mensaje.`,
          html: `<h2>Verifica tu correo</h2><p>Tu código de verificación es:</p><p style="font-size:32px;font-weight:bold;letter-spacing:6px">${body.code}</p><p>Caduca en 10 minutos. Si no creaste una cuenta, ignora este mensaje.</p>`,
          disableFileAccess: true, disableUrlAccess: true,
        });
        if (!Array.isArray(result?.accepted) || result.accepted.length !== 1 || result.rejected?.length) return reply(503, 'mail_unavailable');
      }
      return reply(200);
    } catch (error) {
      if (body.kind === 'check' && error?.code === 'EAUTH') return reply(503, 'mail_authentication_failed');
      if (body.kind === 'check' && ['ETIMEDOUT', 'ECONNECTION', 'ESOCKET', 'EDNS'].includes(error?.code)) {
        return reply(503, 'mail_connection_failed');
      }
      return reply(503, 'mail_unavailable');
    }
    finally { try { transport?.close(); } catch { /* Never expose provider errors or credentials. */ } }
  };
}
