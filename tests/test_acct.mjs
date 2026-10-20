// Tests for accounts, the server-side trial and shared rate limits. Run: node tests/test_acct.mjs
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const A = new Map(), S = new Map(), H = new Map();
globalThis.__LEDGER_STORES__ = {
  getAcct: async k => A.has(k) ? JSON.parse(A.get(k)) : null, putAcct: async r => { A.set(r.key, JSON.stringify(r)); },
  getSub: async id => S.has(id) ? JSON.parse(S.get(id)) : null, putSub: async r => { S.set(r.id, JSON.stringify(r)); }, listSubIds: async () => [...S.keys()],
  // a shared counter like the real one: it does not care which "server" asks
  hit: async (name, key, win, rec = true) => { const k = name + '|' + key + '|' + Math.floor(Date.now() / win); if (rec) H.set(k, (H.get(k) || 0) + 1); return H.get(k) || 0; }
};
const outbox = []; globalThis.__LEDGER_MAIL__ = async m => { outbox.push(m); };
process.env.MAIL_USER = 'l@example.com'; process.env.MAIL_PASS = 'x';
const acct = (await import(path.join(root, 'netlify/functions/acct.mjs'))).default;
const sub = (await import(path.join(root, 'netlify/functions/sub.mjs'))).default;
let fails = 0; const t = (n, ok, d = '') => { if (!ok) fails++; console.log((ok ? 'PASS ' : 'FAIL ') + n + (ok ? '' : ' ' + d)); };
let ipn = 0;
const call = async (a, body, ip) => { const r = await acct(new Request('https://x.test/api/acct/' + a, { method: 'POST', headers: { 'x-nf-client-connection-ip': ip || ('10.0.0.' + ++ipn) }, body: JSON.stringify(body) })); return { s: r.status, b: await r.json() }; };
const lastCode = () => (outbox[outbox.length - 1].text.match(/code is (\d{6})/) || [])[1];
const E = 'ada.obi+promo@gmail.com', PW = 'correct horse 9';
let r = await call('signup', { email: 'nope', password: PW, agree: true }); t('bad email refused', r.s === 400);
r = await call('signup', { email: E, password: 'short', agree: true }); t('short password refused', r.s === 400);
r = await call('signup', { email: E, password: 'password', agree: true }); t('common password refused', r.s === 400);
r = await call('signup', { email: E, password: PW, agree: false }); t('must agree to terms', r.s === 400);
r = await call('signup', { email: E, password: PW, agree: true }); t('signup sends a code and waits', r.s === 200 && r.b.pending && outbox.length === 1);
r = await call('login', { email: E, password: PW }); t('login before confirming the email asks for the code', r.b.needVerify === true || r.s === 429, JSON.stringify(r));
r = await call('verify', { email: E, code: '000000' }); t('wrong code refused', r.s === 400);
r = await call('verify', { email: E, code: lastCode() }); t('right code confirms and signs in', r.s === 200 && r.b.token && r.b.trial.started === false && r.b.trial.daysLeft === 7, JSON.stringify(r));
const me = { k: r.b.k, token: r.b.token };
r = await call('signup', { email: 'adaobi@gmail.com', password: PW, agree: true }); t('the same inbox cannot sign up twice (dots and +tags are ignored at Gmail)', r.s === 409, JSON.stringify(r));
r = await call('signup', { email: 'ADA.OBI@googlemail.com', password: PW, agree: true }); t('googlemail.com counts as gmail.com', r.s === 409);
r = await call('login', { email: 'ada.obi@gmail.com', password: 'wrong password 1' }); t('wrong password refused', r.s === 401);
r = await call('login', { email: 'nobody@example.com', password: PW }); t('unknown email gets the same answer as a wrong password', r.s === 401 && r.b.error === 'Email or password is not right.');
r = await call('status', me); t('status shows the trial not started', r.s === 200 && !r.b.trial.started);
r = await call('status', { k: me.k, token: 'x' }); t('a wrong token is refused', r.s === 401);
r = await call('use', me); t('first statement starts the 7-day trial', r.s === 200 && r.b.trial.started && r.b.trial.used === 1 && r.b.trial.daysLeft === 7);
const start1 = r.b.trial.start;
// trial belongs to the account: logging in again (new device) sees the same trial
r = await call('login', { email: E, password: PW }); const dev2 = { k: r.b.k, token: r.b.token };
t('a second device sees the same trial start', r.s === 200 && r.b.trial.start === start1 && r.b.trial.used === 1);
r = await call('use', dev2); t('uploads on any device add up', r.b.trial.used === 2);
// trial limits
const rec = JSON.parse(A.get(me.k)); rec.trialUsed = 20; A.set(me.k, JSON.stringify(rec));
r = await call('use', me); t('20 uploads used → trial over (402)', r.s === 402 && r.b.trial.over);
rec.trialUsed = 3; rec.trialStart = Date.now() - 8 * 864e5; A.set(me.k, JSON.stringify(rec));
r = await call('use', me); t('7 days passed → trial over (402)', r.s === 402);
// logging out and back in does not reset it, nor does a deleted browser (no state lives there)
r = await call('logout', me); t('logout works', r.s === 200);
r = await call('status', me); t('logged-out token no longer works', r.s === 401);
r = await call('login', { email: E, password: PW }); t('trial is still over after logging in again', r.b.trial.over === true);
// password reset
r = await call('forgot', { email: E }); const n1 = outbox.length; t('forgot sends a code', r.s === 200 && /reset/.test(outbox[outbox.length - 1].subject));
r = await call('forgot', { email: 'ghost@example.com' }); t('forgot gives the same answer for unknown emails and sends nothing', r.s === 200 && outbox.length === n1);
r = await call('reset', { email: E, code: lastCode(), password: 'another long pass 7' }); t('reset with the code sets a new password', r.s === 200 && r.b.token);
r = await call('login', { email: E, password: PW }); t('old password stops working', r.s === 401);
r = await call('status', dev2); t('reset signs other devices out', r.s === 401);
r = await call('login', { email: E, password: 'another long pass 7' }); t('new password works', r.s === 200);
// deleting the account removes the email and password but not the trial dates
{ await call('signup', { email: 'gone@example.com', password: PW, agree: true });
  let g = await call('verify', { email: 'gone@example.com', code: lastCode() }); const gm = { k: g.b.k, token: g.b.token };
  await call('use', gm);
  g = await call('delete', { ...gm, password: 'wrong wrong 123' }); t('delete needs the password', g.s === 401);
  g = await call('delete', { ...gm, password: PW }); t('delete works', g.s === 200);
  const tomb = JSON.parse(A.get(gm.k)); t('only the trial dates are kept after deletion', !tomb.email && !tomb.hash && !tomb.tokens && tomb.trialUsed === 1 && tomb.deleted);
  g = await call('status', gm); t('old sign-in no longer works', g.s === 401);
  g = await call('login', { email: 'gone@example.com', password: PW }); t('cannot log in to a deleted account', g.s === 401);
  await call('signup', { email: 'gone@example.com', password: PW, agree: true }); g = await call('verify', { email: 'gone@example.com', code: lastCode() });
  t('signing up again with the same email inherits the used trial, not a fresh one', g.s === 200 && g.b.trial.started && g.b.trial.used === 1, JSON.stringify(g.b)); }
// lockout
for (let i = 0; i < 5; i++) await call('login', { email: E, password: 'bad password ' + i });
r = await call('login', { email: E, password: 'another long pass 7' }); t('5 wrong passwords lock the account for a while', r.s === 429);
// code attempts
r = await call('signup', { email: 'zed@example.com', password: PW, agree: true }); const zc = lastCode();
for (let i = 0; i < 5; i++) await call('verify', { email: 'zed@example.com', code: '11111' + i });
r = await call('verify', { email: 'zed@example.com', code: zc }); t('after 5 wrong codes the real code stops working', r.s === 400);
// existing Plus subscriber is linked when the email is confirmed
S.set('LDG-ZZZZZZ', JSON.stringify({ id: 'LDG-ZZZZZZ', name: 'Old Sub', email: 'Legacy.User@example.com', phone: '2348031234567', end: new Date(Date.now() + 10 * 864e5).toISOString(), periods: [], proofs: [], tokens: [] }));
await call('signup', { email: 'legacyuser@example.com', password: PW, agree: true });
r = await call('verify', { email: 'legacyuser@example.com', code: lastCode() }); t('an existing Plus subscription with that email is linked (not for Gmail-style dots on other domains)', r.s === 200 && r.b.subId === null, JSON.stringify(r.b));
await call('signup', { email: 'legacy.user@example.com', password: PW, agree: true });
r = await call('verify', { email: 'legacy.user@example.com', code: lastCode() }); t('exact address match links the subscription and counts as a paid plan', r.b.subId === 'LDG-ZZZZZZ' && r.b.planActive === true, JSON.stringify(r.b));
t('signing in as a subscriber also hands over a working plan token for this device', !!r.b.subToken && JSON.parse(S.get('LDG-ZZZZZZ')).tokens.length === 1);
r = await call('use', { k: r.b.k, token: r.b.token }); t('a paid plan does not burn the free trial', r.s === 200 && r.b.trial.started === false);
// subscription start takes the confirmed email from the account
const sr = await sub(new Request('https://x.test/api/sub/start', { method: 'POST', headers: { 'x-nf-client-connection-ip': '55.5.5.5' }, body: JSON.stringify({ name: 'Ada Obi', phone: '08031234567', email: 'attacker-chosen@evil.test', agree: true, ak: me.k, at: 'wrong' }) }));
t('subscribing with a bad account token is refused', sr.status === 401);
r = await call('login', { email: E, password: 'another long pass 7' }, '77.7.7.7'); // locked, expected
// shared limits: sign-ups from one network, counted across "servers"
let blocked = 0; for (let i = 0; i < 9; i++) { const x = await call('signup', { email: `bulk${i}@example.com`, password: PW, agree: true }, '88.8.8.8'); if (x.s === 429) blocked++; }
t('too many sign-ups from one network are stopped (shared counter)', blocked >= 3, blocked);
console.log(fails ? fails + ' failed' : 'all passed'); process.exit(fails ? 1 : 0);
