// Tests for the hardening pass. Run: node tests/test_loopholes.mjs
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const mem = new Map();
globalThis.__LEDGER_STORES__ = { getSub: async id => mem.has(id) ? JSON.parse(mem.get(id)) : null, putSub: async r => { mem.set(r.id, JSON.stringify(r)); }, listSubIds: async () => [...mem.keys()], putProof: async () => {}, getProof: async () => ({ bytes: new Uint8Array([1]), type: 'application/pdf' }) };
const outbox = []; globalThis.__LEDGER_MAIL__ = async m => { outbox.push(m); };
process.env.MAIL_USER = 'l@example.com'; process.env.MAIL_PASS = 'x'; process.env.ADMIN_KEY = 'admin-key-123456';
const whop = (await import(path.join(root, 'netlify/functions/whop.mjs')));
const sub = (await import(path.join(root, 'netlify/functions/sub.mjs'))).default;
const admin = (await import(path.join(root, 'netlify/functions/admin.mjs'))).default;
let fails = 0; const t = (n, ok, d = '') => { if (!ok) fails++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (ok ? '' : ' ' + d)); };
const SECRET = 'ws_' + crypto.randomBytes(24).toString('hex'); process.env.WHOP_WEBHOOK_SECRET = SECRET;
const hook = async ev => { const body = JSON.stringify(ev), ts = Math.floor(Date.now() / 1000);
  const h = { 'webhook-id': 'm' + Math.random(), 'webhook-timestamp': String(ts) }; h['webhook-signature'] = 'v1,' + crypto.createHmac('sha256', Buffer.from(SECRET)).update(`${h['webhook-id']}.${ts}.${body}`).digest('base64');
  const r = await whop.default(new Request('https://x.test/api/whop', { method: 'POST', headers: h, body })); return { s: r.status, b: await r.json() }; };
const pay = id => ({ type: 'payment.succeeded', data: { id, status: 'paid', plan: { id: whop.WHOP_PLAN_ID }, user: { email: 'victim@example.com' } } });
const base = { phone: '2348031234567', end: null, cancelAtEnd: false, periods: [], proofs: [], tokens: [] };
// 1. two people registered the same email: the newest one gets the payment
mem.set('LDG-AAAAAA', JSON.stringify({ ...base, id: 'LDG-AAAAAA', name: 'Attacker', email: 'victim@example.com', createdAt: '2026-01-01T00:00:00Z' }));
mem.set('LDG-BBBBBB', JSON.stringify({ ...base, id: 'LDG-BBBBBB', name: 'Victim', email: 'victim@example.com', createdAt: '2026-02-01T00:00:00Z' }));
let r = await hook(pay('pay_1'));
t('payment goes to the newest registration for that email', r.b.activated === 'LDG-BBBBBB', JSON.stringify(r));
r = await hook(pay('pay_1'));
t('a repeat delivery stays on the same record', r.b.duplicate === true);
// 2. restore lockout
const post = (fn, p, body, ip = '9.9.9.9') => fn(new Request('https://x.test' + p, { method: 'POST', headers: { 'content-type': 'application/json', 'x-nf-client-connection-ip': ip + Math.random() }, body: JSON.stringify(body) }));
for (let i = 0; i < 5; i++) await post(sub, '/api/sub/restore', { id: 'LDG-BBBBBB', phone: '08099999999' });
r = await post(sub, '/api/sub/restore', { id: 'LDG-BBBBBB', phone: '08031234567' });
t('after 5 wrong phones the code is locked even for the right phone', r.status === 429);
const lock = JSON.parse(mem.get('LDG-BBBBBB')); lock.lock.until = Date.now() - 1; mem.set('LDG-BBBBBB', JSON.stringify(lock));
r = await post(sub, '/api/sub/restore', { id: 'LDG-BBBBBB', phone: '08031234567' });
t('lock expires and the right phone then works', r.status === 200);
// 3. admin revoke ends access now
const adm = (p, body) => admin(new Request('https://x.test' + p, { method: 'POST', headers: { 'x-admin-key': process.env.ADMIN_KEY, 'x-nf-client-connection-ip': '1.1.1.1' }, body: JSON.stringify(body) }));
let v = await (await adm('/api/admin/revoke', { id: 'LDG-BBBBBB' })).json();
t('admin revoke ends an active subscription immediately', v.status === 'expired' && v.daysLeft === 0, JSON.stringify(v));
t('revoke needs the admin key', (await admin(new Request('https://x.test/api/admin/revoke', { method: 'POST', body: '{"id":"LDG-BBBBBB"}' }))).status === 401);
// 4. proofs are served sandboxed
const pr = await admin(new Request('https://x.test/api/admin/proof?key=LDG-BBBBBB/1', { headers: { 'x-admin-key': process.env.ADMIN_KEY } }));
t('proof files are served with a sandbox CSP', (pr.headers.get('content-security-policy') || '') === 'sandbox');
console.log(fails ? fails + ' failed' : 'all passed'); process.exit(fails ? 1 : 0);
