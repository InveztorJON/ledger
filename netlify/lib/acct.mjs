// Ledger accounts: email + password, with the email confirmed by a code. The free trial belongs to the account, so a
// cleared browser or a new device can't start a second one. Everything here is shared by functions/acct.mjs and coach.mjs.
import { PLAN, sha256, safeEqual, validId } from './plan.mjs';

const DAY = 864e5;
const ITER = 150000;
export const CODE_MINUTES = 15;
export const TRIAL = { days: PLAN.trialDays, uploads: PLAN.monthlyUploads };

// One real inbox, one account: lowercase, drop "+tag", and ignore dots at Gmail addresses.
export function canonEmail(e) {
  const s = String(e || '').trim().toLowerCase();
  const m = s.match(/^([^@\s]+)@([^@\s]+)$/); if (!m) return '';
  let [, local, dom] = m;
  local = local.split('+')[0];
  if (dom === 'googlemail.com') dom = 'gmail.com';
  if (dom === 'gmail.com') local = local.replace(/\./g, '');
  return local && dom ? local + '@' + dom : '';
}
export const acctKey = async canon => (await sha256('ledger-acct|' + canon)).slice(0, 32);
export const validKey = k => typeof k === 'string' && /^[0-9a-f]{32}$/.test(k);

const hex = u8 => Array.from(u8, x => x.toString(16).padStart(2, '0')).join('');
const unhex = h => Uint8Array.from(h.match(/../g) || [], x => parseInt(x, 16));
async function derive(password, salt, iter = ITER) {
  const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  return hex(new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: iter }, k, 256)));
}
export async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return { salt: hex(salt), hash: await derive(password, salt), iter: ITER };
}
export async function checkPassword(rec, password) {
  const dummy = !rec || !rec.salt || !rec.hash;
  const salt = dummy ? new Uint8Array(16) : unhex(rec.salt);
  const h = await derive(String(password || ''), salt, dummy ? ITER : rec.iter || ITER);   // same work whether or not the account exists
  return !dummy && safeEqual(h, rec.hash);
}
const COMMON = new Set(['password', '12345678', '123456789', '1234567890', 'qwertyuiop', 'password1', 'iloveyou', '11111111', 'abcd1234', 'ledger123', 'letmein123', '00000000']);
export function passwordProblem(pw, canon) {
  if (typeof pw !== 'string' || pw.length < 8) return 'Choose a password with at least 8 characters.';
  if (pw.length > 128) return 'That password is too long (128 characters at most).';
  if (COMMON.has(pw.toLowerCase()) || /^(.)\1+$/.test(pw)) return 'That password is too easy to guess. Choose another.';
  if (canon && pw.toLowerCase() === canon.split('@')[0]) return 'Your password can\'t be your email name.';
  return '';
}

export const newCode = () => String(crypto.getRandomValues(new Uint32Array(1))[0] % 1000000).padStart(6, '0');
export const codeHash = (code, key) => sha256('code|' + key + '|' + code);
export const newToken = () => hex(crypto.getRandomValues(new Uint8Array(24)));
export async function addToken(rec, token) { rec.tokens = [...(rec.tokens || []), await sha256(token)].slice(-5); }

export async function authed(st, body) {
  if (!body || !validKey(body.k) || typeof body.token !== 'string') return null;
  const rec = await st.getAcct(body.k);
  if (!rec || !rec.verified) return null;
  const h = await sha256(body.token);
  return (rec.tokens || []).includes(h) ? rec : null;
}

// Is this account's paid plan running? (The subscription record is the source of truth.)
export async function planEnd(st, rec) {
  if (!rec.subId) return 0;
  const s = await st.getSub(rec.subId);
  return s && s.end ? Date.parse(s.end) : 0;
}
export function trialState(rec, now = Date.now()) {
  const start = rec.trialStart || 0, used = rec.trialUsed || 0;
  const end = start ? start + TRIAL.days * DAY : 0;
  const over = !!start && (now >= end || used >= TRIAL.uploads);
  return { started: !!start, start, end, used, limit: TRIAL.uploads, over, daysLeft: start ? Math.max(0, Math.ceil((end - now) / DAY)) : TRIAL.days };
}
export async function view(st, rec, now = Date.now()) {
  return { k: rec.key, email: rec.email, trial: trialState(rec, now), subId: rec.subId || null, planActive: (await planEnd(st, rec)) > now };
}
// May this account use the paid-for coach right now?
export async function mayCoach(st, rec, now = Date.now()) {
  if ((await planEnd(st, rec)) > now) return true;
  const t = trialState(rec, now);
  return t.started && !t.over;
}

// After the email is confirmed, attach any Ledger Plus subscription that was set up with this address earlier.
export async function linkSubscription(st, rec) {
  if (rec.subId) return;
  let best = null;
  for (const id of await st.listSubIds()) {
    const s = await st.getSub(id);
    if (!s || !s.email || canonEmail(s.email) !== rec.canon) continue;
    if (!best || String(s.end || '') > String(best.end || '')) best = s;
  }
  if (best) { rec.subId = best.id; best.acctKey = rec.key; await st.putSub(best); }
}
export { validId };
