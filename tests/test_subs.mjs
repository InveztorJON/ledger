// Tests for Ledger Plus subscriptions (sub.mjs, admin.mjs, lib/plan.mjs) with in-memory storage and a mocked AI.
// Run: node tests/test_subs.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const mem = { subs: new Map(), proofs: new Map() };
globalThis.__LEDGER_STORES__ = {
  getSub: async id => mem.subs.has(id) ? JSON.parse(mem.subs.get(id)) : null,
  putSub: async rec => { mem.subs.set(rec.id, JSON.stringify(rec)); },
  listSubIds: async () => [...mem.subs.keys()],
  putProof: async (k, b, type) => { mem.proofs.set(k, { bytes: b, type }); },
  getProof: async k => mem.proofs.get(k) || null
};
let aiReply = null, aiCalls = 0;
globalThis.fetch = async (url, init) => { aiCalls++; return new Response(JSON.stringify({ content: [{ type: 'text', text: JSON.stringify(aiReply) }] }), { status: 200 }); };
const logs = []; console.error = (...a) => logs.push(a.join(' '));
process.env.URL = 'https://ledger.example';
process.env.ADMIN_KEY = 'correct-horse-battery';
process.env.ANTHROPIC_API_KEY = 'k';

const { default: sub } = await import(path.join(root, 'netlify/functions/sub.mjs'));
const { default: admin } = await import(path.join(root, 'netlify/functions/admin.mjs'));
const plan = await import(path.join(root, 'netlify/lib/plan.mjs'));

const results = []; const t = (name, ok, d = '') => { results.push(!!ok); console.log((ok ? 'PASS ' : 'FAIL ') + name + (ok ? '' : ' ' + d)); };
let ipSeq = 1;
const S = async (action, body, { ip, origin } = {}) => {
  const headers = { 'content-type': 'application/json' }; if (origin) headers.origin = origin;
  const r = await sub(new Request('https://ledger.example/api/sub/' + action, { method: 'POST', headers, body: JSON.stringify(body) }), { ip: ip || '10.0.0.' + (ipSeq++) });
  return { status: r.status, body: await r.json() };
};
const AD = async (action, body, { key = 'correct-horse-battery', method = 'POST', qs = '', ip = '7.7.7.7' } = {}) => {
  const r = await admin(new Request('https://ledger.example/api/admin/' + action + qs, { method, headers: { 'x-admin-key': key, 'content-type': 'application/json' }, body: method === 'POST' ? JSON.stringify(body) : undefined }), { ip });
  const ct = r.headers.get('content-type') || '';
  return { status: r.status, body: ct.includes('json') ? await r.json() : new Uint8Array(await r.arrayBuffer()), ct };
};
const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]), Buffer.alloc(200, 1)]).toString('base64');

// plan settings match the app
const appJs = fs.readFileSync(path.join(root, 'site/app.js'), 'utf8');
const m = appJs.match(/window\.LEDGER_PLAN\s*=\s*(\{[^;]*\});/);
const appPlan = m ? Function('return ' + m[1])() : {};
t('app and server agree on price, free uploads and bank account',
  appPlan.freeUploads === plan.PLAN.freeUploads && appPlan.priceNaira === plan.PLAN.priceNaira && appPlan.accountNumber === plan.PLAN.accountNumber && appPlan.accountName === plan.PLAN.accountName && appPlan.bank === plan.PLAN.bank && appPlan.remindDays === plan.PLAN.remindDays,
  JSON.stringify(appPlan));
t('plan is ₦1,500, 5 free uploads, JONSPIRE LIMITED UBA 1029821937, remind 3 days before',
  plan.PLAN.priceNaira === 1500 && plan.PLAN.freeUploads === 5 && plan.PLAN.accountName === 'JONSPIRE LIMITED' && plan.PLAN.bank === 'UBA' && plan.PLAN.accountNumber === '1029821937' && plan.PLAN.remindDays === 3);

// helpers
t('phone numbers normalise', plan.normPhone('0803 123 4567') === '2348031234567' && plan.normPhone('+234 803 123 4567') === '2348031234567' && plan.normPhone('12345') === null);
t('one month: 31 Jan → 28 Feb, 15 Mar → 15 Apr', plan.addMonth('2027-01-31T10:00:00.000Z').startsWith('2027-02-28') && plan.addMonth('2026-03-15T08:00:00.000Z').startsWith('2026-04-15'));

// start
let r = await S('start', { name: 'Ada Obi', phone: '08031234567', agree: true });
t('start creates a subscription with a code and token', r.status === 200 && /^LDG-[2-9A-HJ-NP-Z]{6}$/.test(r.body.id) && r.body.token && r.body.status === 'unpaid', JSON.stringify(r.body));
const { id, token } = r.body;
t('start returns the bank details', r.body.plan.accountNumber === '1029821937' && r.body.plan.accountName === 'JONSPIRE LIMITED' && r.body.plan.priceNaira === 1500);
t('token is stored only as a hash', !mem.subs.get(id).includes(token));
t('start needs agreement', (await S('start', { name: 'Ada Obi', phone: '08031234567' })).status === 400);
t('start rejects a bad phone', (await S('start', { name: 'Ada Obi', phone: '123', agree: true })).status === 400);
t('start rejects other websites', (await S('start', { name: 'Ada Obi', phone: '08031234567', agree: true }, { origin: 'https://evil.example' })).status === 403);
t('name is cleaned of markup', (await S('start', { name: '<b>Ada</b> Obi', phone: '08031234567', agree: true })).body.name === 'b Ada /b Obi');

// auth
t('status needs the right token', (await S('status', { id, token: 'nope' })).status === 401 && (await S('status', { id, token })).status === 200);

// proof
t('proof rejects a non-image', (await S('proof', { id, token, file: { type: 'image/png', data: Buffer.from('hello world').toString('base64') } })).status === 400);
t('proof rejects unsupported types', (await S('proof', { id, token, file: { type: 'text/html', data: png } })).status === 400);
r = await S('proof', { id, token, file: { type: 'image/png', data: png } });
t('proof upload → pending', r.status === 200 && r.body.status === 'pending' && r.body.pending === true, JSON.stringify(r.body));
t('proof file stored', mem.proofs.size === 1);

// admin auth
t('admin refuses a wrong password', (await AD('list', null, { method: 'GET', key: 'wrong', ip: '8.8.8.8' })).status === 401);
for (let i = 0; i < 10; i++) await AD('list', null, { method: 'GET', key: 'wrong', ip: '9.9.9.9' });
t('admin locks out after 10 wrong passwords, even for the right one', (await AD('list', null, { method: 'GET', ip: '9.9.9.9' })).status === 429);
const saved = process.env.ADMIN_KEY; delete process.env.ADMIN_KEY;
t('admin is closed when ADMIN_KEY is not set', (await AD('list', null, { method: 'GET' })).status === 503);
process.env.ADMIN_KEY = saved;

// admin list + proof
r = await AD('list', null, { method: 'GET' });
const row = r.body.subscriptions.find(s => s.id === id);
t('admin list shows the pending proof first', r.status === 200 && r.body.subscriptions[0].id === id && row.proofs[0].state === 'pending' && row.phone === '2348031234567');
const key = row.proofs[0].key;
r = await AD('proof', null, { method: 'GET', qs: '?key=' + encodeURIComponent(key) });
t('admin can open the proof file', r.status === 200 && r.ct === 'image/png' && r.body[0] === 0x89);
t('admin proof key is validated', (await AD('proof', null, { method: 'GET', qs: '?key=../../etc' })).status === 400);

// AI check
aiReply = { is_receipt: true, amount_naira: 1500, beneficiary_account: '1029821937', beneficiary_name: 'JONSPIRE LIMITED', beneficiary_bank: 'UBA', date: new Date().toISOString().slice(0, 10), narration: 'Ledger ' + id, sender_name: 'ADA OBI', transaction_status: 'Successful', edits_suspected: false, notes: '' };
r = await AD('check', { id, key });
let chk = r.body.proofs[0].check;
t('AI check: matching receipt looks right', r.status === 200 && chk.verdict === 'looks_right' && chk.flags.length === 0, JSON.stringify(chk));
aiReply = { ...aiReply, amount_naira: 1000, beneficiary_account: '0123456789', narration: 'food' };
chk = (await AD('check', { id, key })).body.proofs[0].check;
t('AI check: wrong amount and account are flagged', chk.verdict === 'check_carefully' && chk.flags.some(f => f.includes('₦1,000')) && chk.flags.some(f => f.includes('0123456789')) && chk.flags.some(f => f.includes('Reference')));
t('AI check never logs receipt contents', !logs.join(' ').includes('JONSPIRE') && !logs.join(' ').includes('ADA OBI'));

// reject → user sees reason
r = await AD('reject', { id, key, reason: 'No ₦1,500 credit from Ada Obi found.' });
t('reject works', r.status === 200 && r.body.proofs[0].state === 'rejected');
r = await S('status', { id, token });
t('user sees rejected with the reason', r.body.status === 'rejected' && r.body.rejectedReason.includes('No ₦1,500'));

// new proof + approve → active for one month
await S('proof', { id, token, file: { type: 'image/png', data: png } });
const key2 = (await AD('list', null, { method: 'GET' })).body.subscriptions.find(s => s.id === id).proofs[0].key;
const before = Date.now();
r = await AD('approve', { id, key: key2 });
t('approve works', r.status === 200 && r.body.status === 'active');
r = await S('status', { id, token });
const end = Date.parse(r.body.end);
t('user is active for one calendar month from approval', r.body.status === 'active' && plan.addMonth(new Date(before).toISOString()).slice(0, 10) === r.body.end.slice(0, 10) && r.body.daysLeft >= 28 && r.body.daysLeft <= 31, JSON.stringify(r.body));
t('approving twice does not add another month', (await AD('approve', { id, key: key2 })).body.end === r.body.end);
t('cannot reject an approved payment', (await AD('reject', { id, key: key2 })).status === 400);
t('no renewal reminder at the start of the month', r.body.renewDue === false);

// reminder window: 3 days before the end
const rec = JSON.parse(mem.subs.get(id));
const v3 = plan.publicView(rec, end - 2.5 * 864e5), v4 = plan.publicView(rec, end - 3.5 * 864e5);
t('reminder shows 3 days before the end, not 4', v3.renewDue === true && v3.daysLeft === 3 && v4.renewDue === false);
t('after the end the status is expired', plan.publicView(rec, end + 1000).status === 'expired');

// cancel / resume
r = await S('cancel', { id, token });
t('cancel keeps access until the end and stops reminders', r.body.status === 'active' && r.body.cancelAtEnd === true && plan.publicView(JSON.parse(mem.subs.get(id)), end - 2 * 864e5).renewDue === false);
r = await S('resume', { id, token });
t('resume turns reminders back on', r.body.cancelAtEnd === false);

// early renewal continues from the old end
const recR = JSON.parse(mem.subs.get(id));
recR.proofs.push({ key: id + '/999', at: new Date().toISOString(), type: 'image/png', size: 1, state: 'pending' });
plan.applyApproval(recR, id + '/999', end - 2 * 864e5);
t('renewing early adds a month from the current end date, no days lost', recR.end === plan.addMonth(new Date(end).toISOString()));

// restore on another phone
r = await S('restore', { id: id.toLowerCase().replace('-', ''), phone: '+234 803 123 4567' });
t('restore with code and phone gives a new token', r.status === 200 && r.body.token && r.body.token !== token && r.body.status === 'active');
t('old token still works (up to 3 devices)', (await S('status', { id, token })).status === 200);
t('restore with the wrong phone fails', (await S('restore', { id, phone: '08099999999' })).status === 404);
const ipX = '5.5.5.5'; for (let i = 0; i < 6; i++) await S('restore', { id, phone: '08099999999' }, { ip: ipX });
t('restore is rate-limited', (await S('restore', { id, phone: '08031234567' }, { ip: ipX })).status === 429);

// big file
t('proof over 3.5 MB is refused', (await S('proof', { id, token, file: { type: 'image/png', data: Buffer.concat([Buffer.from([0x89, 0x50, 0x4E, 0x47]), Buffer.alloc(3.7 * 1024 * 1024)]).toString('base64') } })).status === 413);

const pass = results.filter(Boolean).length;
console.log(`${pass}/${results.length} passed`);
process.exit(pass === results.length ? 0 : 1);
