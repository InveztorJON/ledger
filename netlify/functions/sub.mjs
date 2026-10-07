// Ledger Plus subscriptions for app users. Served at /api/sub/<action>.
//   start    {name, phone, email?, agree}        -> creates a subscription record, returns {id, token, ...status}
//   status   {id, token}                          -> current status
//   proof    {id, token, file:{type, data}}       -> stores a proof of payment for review (base64, image or PDF)
//   cancel   {id, token}                          -> won't renew; access continues until the end date
//   resume   {id, token}                          -> undo cancel
//   use      {id, token}                          -> counts one statement upload against this month's allowance (20)
//   restore  {id, phone}                          -> use the subscription on another device; returns a new token
// Privacy: request bodies are never logged.

import { json, allowedOrigin, clientIp, limit, readJson } from '../lib/http.mjs';
import { PLAN, newId, newToken, sha256, normPhone, cleanText, validId, publicView, applyUse, usageOf, warnCount } from '../lib/plan.mjs';
import { stores } from '../lib/store.mjs';
import { sendMail, validEmail, adminAddress } from '../lib/mail.mjs';
import * as mail from '../lib/emails.mjs';

const MAX_PROOF = 3.5 * 1024 * 1024;
const TYPES = {
  'image/jpeg': b => b[0] === 0xFF && b[1] === 0xD8 && b[2] === 0xFF,
  'image/png': b => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4E && b[3] === 0x47,
  'image/webp': b => b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45,
  'application/pdf': b => b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46
};

async function authed(st, body) {
  if (!body || !validId(body.id) || typeof body.token !== 'string') return null;
  const rec = await st.getSub(body.id);
  if (!rec) return null;
  const h = await sha256(body.token);
  return (rec.tokens || []).includes(h) ? rec : null;
}
const addToken = async (rec, token) => { rec.tokens = [...(rec.tokens || []), await sha256(token)].slice(-3); };

export default async (req, context) => {
  if (req.method !== 'POST') return json(405, { error: 'Use POST' });
  if (!allowedOrigin(req)) return json(403, { error: 'Not allowed' });
  const action = new URL(req.url).pathname.split('/').filter(Boolean).pop();
  const ip = clientIp(req, context);
  if (!limit('sub-all', ip, 120)) return json(429, { error: 'Too many requests. Try again later.' });

  const { body, error } = await readJson(req, action === 'proof' ? 5.2 * 1024 * 1024 : 4000);
  if (error) return error;
  let st;
  try { st = await stores(); } catch (e) { console.error('store unavailable', e && e.name); return json(503, { error: 'Subscriptions are unavailable right now. Try again soon.' }); }

  try {
    if (action === 'start') {
      if (!limit('sub-start', ip, 8)) return json(429, { error: 'Too many sign-ups from this network. Try again later.' });
      const name = cleanText(body.name, 80), phone = normPhone(body.phone), email = cleanText(body.email, 120);
      if (name.length < 3) return json(400, { error: 'Enter your full name as it appears on your bank account.' });
      if (!phone) return json(400, { error: 'Enter a Nigerian phone number, like 0803 123 4567.' });
      if (!validEmail(email)) return json(400, { error: 'Enter a valid email address. We send your receipt confirmation and renewal reminders there.' });
      if (body.agree !== true) return json(400, { error: 'Please agree to the terms and privacy policy.' });
      let id; for (let i = 0; i < 5; i++) { id = newId(); if (!(await st.getSub(id))) break; }
      const token = newToken();
      const rec = { id, name, phone, email, createdAt: new Date().toISOString(), agreedAt: new Date().toISOString(), end: null, cancelAtEnd: false, periods: [], proofs: [], tokens: [] };
      await addToken(rec, token);
      await st.putSub(rec);
      return json(200, { token, ...publicView(rec) });
    }

    if (action === 'restore') {
      if (!limit('sub-restore', ip, 6)) return json(429, { error: 'Too many tries. Try again in an hour.' });
      const id = String(body.id || '').toUpperCase().replace(/\s/g, '').replace(/^LDG(?!-)/, 'LDG-');
      const phone = normPhone(body.phone);
      const rec = validId(id) && phone ? await st.getSub(id) : null;
      if (!rec || rec.phone !== phone) return json(404, { error: "We couldn't find a subscription with that code and phone number." });
      const token = newToken();
      await addToken(rec, token);
      await st.putSub(rec);
      return json(200, { token, ...publicView(rec) });
    }

    const rec = await authed(st, body);
    if (!rec) return json(401, { error: 'Subscription not found on this device. Use "Restore" with your code and phone number.' });

    if (action === 'status') return json(200, publicView(rec));

    if (action === 'use') {
      if (!(rec.end && Date.parse(rec.end) > Date.now())) return json(402, { error: 'Ledger Plus is not active.', ...publicView(rec) });
      const ok = applyUse(rec);
      if (ok) {
        await st.putSub(rec);
        const u = usageOf(rec);   // emails go out exactly once: when the count first reaches 80% and when it reaches the full allowance
        if (u.used === warnCount()) await sendMail(mail.usageWarn(rec, u.used, u.limit));
        else if (u.limitReached) await sendMail(mail.usageFull(rec, u.limit));
      }
      return json(ok ? 200 : 402, ok ? publicView(rec) : { error: "You've used all your statement uploads for this month.", ...publicView(rec) });
    }

    if (action === 'cancel' || action === 'resume') {
      if (!(rec.end && Date.parse(rec.end) > Date.now())) return json(400, { error: 'There is no active subscription to change.' });
      rec.cancelAtEnd = action === 'cancel';
      await st.putSub(rec);
      return json(200, publicView(rec));
    }

    if (action === 'proof') {
      if (!limit('sub-proof', rec.id, 6, 864e5)) return json(429, { error: 'Too many uploads today. Contact us if you need help.' });
      const f = body.file || {};
      const check = TYPES[f.type];
      if (!check || typeof f.data !== 'string') return json(400, { error: 'Upload a photo, screenshot or PDF of your receipt.' });
      let bytes;
      try { bytes = Uint8Array.from(atob(f.data), c => c.charCodeAt(0)); } catch { return json(400, { error: 'That file could not be read.' }); }
      if (!bytes.length || bytes.length > MAX_PROOF) return json(413, { error: 'That file is too large. Use a screenshot under 3.5 MB.' });
      if (!check(bytes)) return json(400, { error: "That file isn't a valid image or PDF." });
      const key = `${rec.id}/${Date.now()}`;
      await st.putProof(key, bytes, f.type);
      for (const p of rec.proofs) if (p.state === 'pending') p.state = 'replaced';
      rec.proofs.push({ key, at: new Date().toISOString(), type: f.type, size: bytes.length, state: 'pending' });
      rec.proofs = rec.proofs.slice(-24);
      rec.cancelAtEnd = false;
      await st.putSub(rec);
      await sendMail(mail.receiptReceived(rec));
      if (adminAddress()) await sendMail(mail.adminNewProof(rec, adminAddress()));
      return json(200, publicView(rec));
    }

    return json(404, { error: 'Unknown action' });
  } catch (e) {
    console.error('sub error', action, e && e.name);
    return json(500, { error: 'Something went wrong. Try again.' });
  }
};

export const config = { path: '/api/sub/*' };
