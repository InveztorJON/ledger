// Local test server: static site + /api/coach, /api/sub/*, /api/admin/* with mocked Anthropic API and in-memory storage.
// Usage: node serve.mjs <siteDir> <port>   (admin password: test-admin-key-123)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const [,, dir, port = '8899'] = process.argv;
process.env.ANTHROPIC_API_KEY = 'test-key';
process.env.URL = `http://127.0.0.1:${port}`;
process.env.COACH_HOURLY_LIMIT = '5';
process.env.ADMIN_KEY = 'test-admin-key-123';
const mem = { subs: new Map(), proofs: new Map() };
globalThis.__LEDGER_STORES__ = {
  getSub: async id => mem.subs.has(id) ? JSON.parse(mem.subs.get(id)) : null,
  putSub: async rec => { mem.subs.set(rec.id, JSON.stringify(rec)); },
  listSubIds: async () => [...mem.subs.keys()],
  putProof: async (k, b, type) => { mem.proofs.set(k, { bytes: b, type }); },
  getProof: async k => mem.proofs.get(k) || null
};
globalThis.__lastUpstream = null;
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, init) => {
  if (String(url).startsWith('https://api.anthropic.com')) {
    const body = JSON.parse(init.body); globalThis.__lastUpstream = { headers: init.headers, body };
    const q = body.messages[body.messages.length - 1].content;
    if (Array.isArray(q)) {   // receipt check
      const ids = [...mem.subs.keys()]; const id = ids[ids.length - 1];
      const read = { is_receipt: true, amount_naira: 10000, beneficiary_account: '1029821937', beneficiary_name: 'JONSPIRE LIMITED', beneficiary_bank: 'UBA', date: new Date().toISOString().slice(0, 10), narration: 'Ledger ' + id, sender_name: 'ADA OBI', transaction_status: 'Successful', edits_suspected: false, notes: '' };
      return new Response(JSON.stringify({ content: [{ type: 'text', text: JSON.stringify(read) }] }), { status: 200 });
    }
    return new Response(JSON.stringify({ content: [{ type: 'text', text: `Mock coach answer to: ${q}` }] }), { status: 200 });
  }
  return realFetch(url, init);
};
const fn = n => import(path.resolve(dir, '..', 'netlify', 'functions', n + '.mjs')).then(m => m.default);
const coach = await fn('coach'), sub = await fn('sub'), admin = await fn('admin');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.txt': 'text/plain' };
http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${port}`);
  const handler = url.pathname === '/api/coach' ? coach : url.pathname.startsWith('/api/sub/') ? sub : url.pathname.startsWith('/api/admin/') ? admin : null;
  if (url.pathname === '/__setEnd') {   // test hook: move a subscription's end date to now + days
    const rec = JSON.parse(mem.subs.get(url.searchParams.get('id')));
    rec.end = new Date(Date.now() + Number(url.searchParams.get('days')) * 864e5).toISOString();
    // keep the paid-month record consistent with the new end date (one period, usage carried over)
    const used = (rec.periods || []).reduce((m, p) => Math.max(m, p.used || 0), 0);
    rec.periods = [{ start: new Date(Date.now() - 864e5).toISOString(), end: rec.end, approvedAt: rec.end, proof: 'test', used }];
    mem.subs.set(rec.id, JSON.stringify(rec)); res.writeHead(200); res.end('ok'); return;
  }
  if (handler) {
    const chunks = []; for await (const c of req) chunks.push(c);
    const r = await handler(new Request(url, { method: req.method, headers: req.headers, body: req.method === 'POST' ? Buffer.concat(chunks) : undefined }), { ip: req.headers['x-test-ip'] || '1.1.1.1' });
    res.writeHead(r.status, Object.fromEntries(r.headers)); res.end(Buffer.from(await r.arrayBuffer())); return;
  }
  if (url.pathname === '/__last') { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify(globalThis.__lastUpstream)); return; }
  let p = path.join(dir, decodeURIComponent(url.pathname)); if (p.endsWith('/')) p += 'index.html';
  if (!fs.existsSync(p)) { res.writeHead(404); res.end('not found'); return; }
  res.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(res);
}).listen(+port, () => console.log('serving on', port));
