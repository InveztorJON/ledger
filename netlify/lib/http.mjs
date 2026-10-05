// Small helpers shared by the Ledger server functions.

export const json = (status, body) => new Response(JSON.stringify(body), {
  status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' }
});

export function allowedOrigin(req) {
  const origin = req.headers.get('origin');
  if (!origin) return true;      // same-origin fetches from some browsers omit it
  let self = null; try { self = new URL(req.url).origin; } catch {}
  const ok = [self, process.env.URL, process.env.DEPLOY_PRIME_URL, process.env.DEPLOY_URL, 'http://localhost:8888']
    .filter(Boolean).map(u => { try { return new URL(u).origin; } catch { return null; } });
  return ok.includes(origin);
}

export const clientIp = (req, context) =>
  (context && context.ip) || req.headers.get('x-nf-client-connection-ip') || 'unknown';

// Best-effort per-instance limiter: limiter(name, max, windowMs)(key) -> true if allowed.
const buckets = new Map();
export function limit(name, key, max, windowMs = 3600e3) {
  const k = name + '|' + key, now = Date.now();
  const hits = (buckets.get(k) || []).filter(t => now - t < windowMs);
  if (hits.length >= max) { buckets.set(k, hits); return false; }
  hits.push(now); buckets.set(k, hits);
  if (buckets.size > 20000) buckets.clear();
  return true;
}

// True if the bucket is already full (does not record a hit).
export function blocked(name, key, max, windowMs = 3600e3) {
  const now = Date.now();
  return (buckets.get(name + '|' + key) || []).filter(t => now - t < windowMs).length >= max;
}

export async function readJson(req, maxBytes) {
  const len = Number(req.headers.get('content-length') || 0);
  if (len > maxBytes) return { error: json(413, { error: 'That file is too large.' }) };
  let text;
  try { text = await req.text(); } catch { return { error: json(400, { error: 'Bad request' }) }; }
  if (text.length > maxBytes) return { error: json(413, { error: 'That file is too large.' }) };
  try { return { body: JSON.parse(text) }; } catch { return { error: json(400, { error: 'Bad request' }) }; }
}
