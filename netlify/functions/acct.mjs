// Ledger accounts. Served at /api/acct/<action>. Request bodies are never logged.
//   signup {email, password, agree}   -> creates the account, emails a 6-digit code
//   verify {email, code}              -> confirms the email, signs in, returns {token, ...view}
//   resend {email}                    -> sends a new code
//   login  {email, password}          -> returns {token, ...view}
//   forgot {email}                    -> emails a code to choose a new password
//   reset  {email, code, password}    -> sets the new password and signs in
//   status {k, token}                 -> the account view (trial and plan)
//   use    {k, token}                 -> counts one statement upload against the free trial (starts it on the first one)
//   logout {k, token}                 -> signs this device out
//   delete {k, token, password}       -> deletes the account (email, password, sign-ins). Only the trial dates stay, so deleting can't be used to get a second trial.
import { json, allowedOrigin, clientIp, glimit, readJson } from '../lib/http.mjs';
import { stores } from '../lib/store.mjs';
import { sendMail, validEmail, mailEnabled } from '../lib/mail.mjs';
import { sha256, safeEqual, newToken as newSubToken } from '../lib/plan.mjs';
import * as A from '../lib/acct.mjs';

const MIN = 6e4;
const codeMail = (rec, code, why) => ({ to: rec.email, subject: `${code} is your Ledger ${why === 'reset' ? 'password reset' : 'confirmation'} code`,
  text: `Your Ledger code is ${code}\n\n${why === 'reset' ? 'Use it to choose a new password.' : 'Use it to confirm this email address and start your account.'} It works for ${A.CODE_MINUTES} minutes. If you didn't ask for it, ignore this email: nothing happens until the code is entered.\n\nLedger by Jonspire Limited` });

async function issueCode(st, rec, kind) {
  if (!(await glimit(st, 'acct-mail-all', 'all', 300, 864e5))) return 'Sign-up is very busy right now. Try again later.';
  const now = Date.now(), c = rec.send && now - rec.send.first < 3600e3 ? rec.send : { n: 0, first: now };
  if (c.n >= 5) return 'Too many codes requested. Try again in an hour.';
  if (rec.code && now - rec.code.sentAt < 45e3) return 'Wait a minute before asking for another code.';
  const code = A.newCode();
  rec.code = { h: await A.codeHash(code, rec.key), exp: now + A.CODE_MINUTES * MIN, tries: 0, kind, sentAt: now };
  rec.send = { n: c.n + 1, first: c.first };
  await st.putAcct(rec);
  const ok = await sendMail(codeMail(rec, code, kind));
  return ok ? '' : "We couldn't send the email. Check the address and try again.";
}
async function signedIn(st, rec) {
  const token = A.newToken(); await A.addToken(rec, token);
  await A.linkSubscription(st, rec);
  rec.lastLogin = new Date().toISOString();
  await st.putAcct(rec);
  const out = { token, ...(await A.view(st, rec)) };
  if (rec.subId) {   // a signed-in subscriber gets their plan on this device without the phone-number restore step
    const sub = await st.getSub(rec.subId);
    if (sub) { const t = newSubToken(); sub.tokens = [...(sub.tokens || []), await sha256(t)].slice(-3); await st.putSub(sub); out.subToken = t; }
  }
  return out;
}
async function checkCode(rec, code, kind) {
  const c = rec.code, now = Date.now();
  if (!c || c.kind !== kind || now > c.exp || c.tries >= 5) return false;
  c.tries++;
  return safeEqual(await A.codeHash(String(code || '').replace(/\D/g, ''), rec.key), c.h);
}

export default async (req, context) => {
  if (req.method !== 'POST') return json(405, { error: 'Use POST' });
  if (!allowedOrigin(req)) return json(403, { error: 'Not allowed' });
  const action = new URL(req.url).pathname.split('/').filter(Boolean).pop();
  const ip = clientIp(req, context);
  let st;
  try { st = await stores(); } catch (e) { console.error('store unavailable', e && e.name); return json(503, { error: 'Accounts are unavailable right now. Try again soon.' }); }
  if (!(await glimit(st, 'acct-all', ip, 120))) return json(429, { error: 'Too many requests. Try again later.' });
  const { body, error } = await readJson(req, 4000);
  if (error) return error;

  try {
    if (['signup', 'verify', 'resend', 'login', 'forgot', 'reset'].includes(action)) {
      const email = String(body.email || '').trim();
      const canon = validEmail(email) ? A.canonEmail(email) : '';
      if (!canon) return json(400, { error: 'Enter a valid email address.' });
      const key = await A.acctKey(canon);
      let rec = await st.getAcct(key);

      if (action === 'signup') {
        if (!(await glimit(st, 'acct-signup', ip, 6))) return json(429, { error: 'Too many sign-ups from this network. Try again later.' });
        if (!mailEnabled()) return json(503, { error: 'Sign-up is not available right now. Try again soon.' });
        if (body.agree !== true) return json(400, { error: 'Please agree to the terms and privacy policy.' });
        const problem = A.passwordProblem(body.password, canon); if (problem) return json(400, { error: problem });
        if (rec && rec.verified) return json(409, { error: 'There is already an account with this email. Log in instead, or reset your password.' });
        const pw = await A.hashPassword(body.password);
        rec = { ...(rec || {}), deleted: undefined, deletedAt: undefined, key, email, canon, ...pw, verified: false, createdAt: (rec && rec.createdAt) || new Date().toISOString(), agreedAt: new Date().toISOString(), tokens: [] };
        const err = await issueCode(st, rec, 'verify');
        return err ? json(429, { error: err }) : json(200, { pending: true });
      }
      if (action === 'resend' || action === 'forgot') {
        if (!(await glimit(st, 'acct-code', ip, 10))) return json(429, { error: 'Too many requests. Try again later.' });
        // Same answer whether or not the account exists, so this can't be used to find out who has one.
        if (rec && (action === 'resend' ? !rec.verified : rec.verified)) {
          const err = await issueCode(st, rec, action === 'resend' ? 'verify' : 'reset');
          if (err) return json(429, { error: err });
        }
        return json(200, { pending: true });
      }
      if (action === 'verify') {
        if (!(await glimit(st, 'acct-verify', ip, 20))) return json(429, { error: 'Too many tries. Try again later.' });
        if (!rec || rec.verified) return json(400, { error: 'That code is not right or has expired.' });
        const ok = await checkCode(rec, body.code, 'verify');
        if (!ok) { await st.putAcct(rec); return json(400, { error: 'That code is not right or has expired.' }); }
        rec.verified = true; delete rec.code;
        return json(200, await signedIn(st, rec));
      }
      if (action === 'reset') {
        if (!(await glimit(st, 'acct-verify', ip, 20))) return json(429, { error: 'Too many tries. Try again later.' });
        const problem = A.passwordProblem(body.password, canon); if (problem) return json(400, { error: problem });
        if (!rec || !rec.verified) return json(400, { error: 'That code is not right or has expired.' });
        const ok = await checkCode(rec, body.code, 'reset');
        if (!ok) { await st.putAcct(rec); return json(400, { error: 'That code is not right or has expired.' }); }
        Object.assign(rec, await A.hashPassword(body.password)); delete rec.code; delete rec.lock;
        rec.tokens = [];                                      // a reset signs every other device out
        return json(200, await signedIn(st, rec));
      }
      if (action === 'login') {
        if (!(await glimit(st, 'acct-login', ip, 15, 900e3))) return json(429, { error: 'Too many tries. Wait 15 minutes.' });
        const now = Date.now();
        if (rec && rec.lock && now < rec.lock.until) return json(429, { error: 'Too many wrong passwords for this account. Try again in 15 minutes, or reset your password.' });
        const good = await A.checkPassword(rec, body.password);
        if (!good) {
          if (rec) { const f = rec.lock && now - rec.lock.first < 900e3 ? rec.lock : { n: 0, first: now }; f.n++; rec.lock = f.n >= 5 ? { ...f, until: now + 900e3 } : f; await st.putAcct(rec); }
          return json(401, { error: 'Email or password is not right.' });
        }
        delete rec.lock;
        if (!rec.verified) {
          const err = await issueCode(st, rec, 'verify');
          return err ? json(429, { error: err }) : json(200, { needVerify: true });
        }
        return json(200, await signedIn(st, rec));
      }
    }

    const rec = await A.authed(st, body);
    if (!rec) return json(401, { error: 'Please log in again.' });
    if (action === 'status') return json(200, await A.view(st, rec));
    if (action === 'logout') { const h = await sha256(body.token); rec.tokens = (rec.tokens || []).filter(x => x !== h); await st.putAcct(rec); return json(200, { ok: true }); }
    if (action === 'delete') {
      if (!(await A.checkPassword(rec, body.password))) return json(401, { error: 'That password is not right.' });
      const tomb = { key: rec.key, deleted: true, deletedAt: new Date().toISOString(), trialStart: rec.trialStart || 0, trialUsed: rec.trialUsed || 0, createdAt: rec.createdAt };
      await st.putAcct(tomb);                                  // email, password hash, sign-ins and codes are gone
      if (rec.subId) { const sub = await st.getSub(rec.subId); if (sub) { delete sub.acctKey; sub.tokens = []; await st.putSub(sub); } }   // the subscription record itself stays for accounting
      return json(200, { ok: true });
    }
    if (action === 'use') {
      if (await A.planEnd(st, rec) > Date.now()) return json(200, await A.view(st, rec));   // a paid plan is counted by the subscription
      const t = A.trialState(rec);
      if (t.over) return json(402, { error: 'Your free trial has ended.', ...(await A.view(st, rec)) });
      if (!rec.trialStart) rec.trialStart = Date.now();
      rec.trialUsed = (rec.trialUsed || 0) + 1;
      await st.putAcct(rec);
      return json(200, await A.view(st, rec));
    }
    return json(404, { error: 'Unknown action' });
  } catch (e) {
    console.error('acct error', action, e && e.name);
    return json(500, { error: 'Something went wrong. Try again.' });
  }
};

export const config = { path: '/api/acct/*' };
