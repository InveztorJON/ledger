// Whop webhook: switches Ledger Plus on automatically when a card payment is confirmed. Served at /api/whop.
// Setup (done by the owner in Netlify, never in code): WHOP_WEBHOOK_SECRET = the signing secret of the webhook in the Whop dashboard.
// Whop signs with the Standard Webhooks scheme: HMAC-SHA256 over "<webhook-id>.<webhook-timestamp>.<raw body>", header "webhook-signature: v1,<base64>".
// A payment is matched to a subscriber by email address, so people must use the same email in Ledger and at the Whop checkout.

import crypto from 'node:crypto';
import { json } from '../lib/http.mjs';
import { applyApproval, safeEqual } from '../lib/plan.mjs';
import { stores } from '../lib/store.mjs';
import { sendMail } from '../lib/mail.mjs';
import * as mail from '../lib/emails.mjs';

export const WHOP_PLAN_ID = 'plan_K5cA8QWGAioHD';

function keysFor(secret) {
  const ks = [Buffer.from(secret, 'utf8')];
  const raw = secret.replace(/^(whsec_|ws_)/, '');
  try { const d = Buffer.from(raw, 'base64'); if (d.length >= 16) ks.push(d); } catch { /* not base64 */ }
  return ks;
}
export function verifySignature(secret, headers, raw, now = Date.now()) {
  const id = headers.get('webhook-id'), ts = headers.get('webhook-timestamp'), sig = headers.get('webhook-signature');
  if (!id || !ts || !sig || !secret) return false;
  if (!/^\d{9,12}$/.test(ts) || Math.abs(now / 1000 - Number(ts)) > 300) return false;
  const signed = `${id}.${ts}.${raw}`;
  const given = sig.split(' ').map(p => p.split(',')[1]).filter(Boolean);
  for (const k of keysFor(secret)) {
    const want = crypto.createHmac('sha256', k).update(signed).digest('base64');
    if (given.some(g => safeEqual(g, want))) return true;
  }
  return false;
}

export default async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'Use POST' });
  const secret = process.env.WHOP_WEBHOOK_SECRET;
  if (!secret) return json(503, { error: 'Card payments are not connected yet' });
  const raw = await req.text();
  if (raw.length > 200000) return json(413, { error: 'Too large' });
  if (!verifySignature(secret, req.headers, raw)) return json(401, { error: 'Bad signature' });
  let ev; try { ev = JSON.parse(raw); } catch { return json(400, { error: 'Bad request' }); }
  if (ev.type !== 'payment.succeeded') return json(200, { ok: true, ignored: ev.type || 'unknown' });
  const pay = ev.data || {};
  const planId = pay.plan && pay.plan.id;
  if (planId !== WHOP_PLAN_ID) return json(200, { ok: true, ignored: 'other plan' });
  if (pay.status && pay.status !== 'paid') return json(200, { ok: true, ignored: 'not paid' });
  const email = String((pay.user && pay.user.email) || '').trim().toLowerCase();
  const payId = String(pay.id || ev.id || '');
  if (!email || !payId) return json(422, { error: 'Payment has no email' });
  let st; try { st = await stores(); } catch { return json(503, { error: 'Storage unavailable' }); }
  // Several people can type the same email. Prefer a record that already holds this payment, then the newest one,
  // so someone who registered another person's email earlier can't capture that person's payment.
  let rec = null;
  for (const id of await st.listSubIds()) {
    const r = await st.getSub(id);
    if (!r || !r.email || String(r.email).toLowerCase() !== email) continue;
    if ((r.proofs || []).some(p => p.key === 'whop:' + payId)) { rec = r; break; }
    if (!rec || String(r.createdAt) > String(rec.createdAt)) rec = r;
  }
  // 404 makes Whop retry later, which gives a payer who has not registered in Ledger yet time to do so.
  if (!rec) return json(404, { error: 'No Ledger subscriber with this email yet' });
  rec.proofs = rec.proofs || [];
  const key = 'whop:' + payId;
  if (rec.proofs.some(p => p.key === key)) return json(200, { ok: true, duplicate: true });
  rec.proofs.unshift({ key, at: new Date().toISOString(), type: 'whop', size: 0, state: 'pending', amount: pay.total, currency: pay.currency });
  applyApproval(rec, key);
  await st.putSub(rec);
  await sendMail(mail.approved(rec, rec.end));
  return json(200, { ok: true, activated: rec.id, end: rec.end });
};

export const config = { path: '/api/whop' };
