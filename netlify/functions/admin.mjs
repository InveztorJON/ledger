// Ledger Plus admin: review payment proofs and manage subscriptions. Served at /api/admin/<action>.
// Every request needs the header x-admin-key matching the ADMIN_KEY environment variable in Netlify.
//   GET  list                       -> all subscriptions with status, newest proofs first
//   GET  proof?key=LDG-XXXXXX/123   -> the proof file
//   POST check   {id, key}          -> AI reads the receipt and compares it with what we expect
//   POST approve {id, key}          -> payment confirmed: one month starts now (or from the current end date)
//   POST reject  {id, key, reason}  -> payment not found; the user sees the reason and can upload again

import { json, clientIp, limit, blocked, readJson } from '../lib/http.mjs';
import { PLAN, safeEqual, validId, publicView, applyApproval, applyRejection, judgeReceipt } from '../lib/plan.mjs';
import { stores } from '../lib/store.mjs';

const READ_PROMPT = `This file was uploaded as proof of a bank transfer. Read it carefully and reply with one JSON object only, no other text:
{"is_receipt": true/false (is this a bank transfer receipt or confirmation screen?),
 "amount_naira": number or null,
 "beneficiary_account": "account number paid to" or null,
 "beneficiary_name": "account name paid to" or null,
 "beneficiary_bank": "bank paid to" or null,
 "date": "YYYY-MM-DD" or null,
 "narration": "narration, remark or description text" or null,
 "sender_name": "name of the person who paid" or null,
 "transaction_status": "e.g. Successful, Pending, Failed" or null,
 "edits_suspected": true/false (mismatched fonts, misaligned or pasted-looking numbers),
 "notes": "one short sentence on anything unusual"}`;

async function readReceipt(file) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return { error: 'AI check is not available (no AI key).' };
  const b64 = Buffer.from(file.bytes).toString('base64');
  const part = file.type === 'application/pdf'
    ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: b64 } }
    : { type: 'image', source: { type: 'base64', media_type: file.type, data: b64 } };
  const base = (process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com').replace(/\/+$/, '');
  const ctl = new AbortController(); const timer = setTimeout(() => ctl.abort(), 22000);
  try {
    const r = await fetch(base + '/v1/messages', {
      method: 'POST', signal: ctl.signal,
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model: process.env.COACH_MODEL || 'claude-haiku-4-5-20251001', max_tokens: 400,
        messages: [{ role: 'user', content: [part, { type: 'text', text: READ_PROMPT }] }] })
    });
    if (!r.ok) { console.error('check upstream status', r.status); return { error: 'AI check failed. Try again, or check by eye.' }; }
    const data = await r.json();
    const text = (data.content || []).filter(c => c.type === 'text').map(c => c.text).join('');
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) return { error: 'AI could not read this file. Check it by eye.' };
    return { read: JSON.parse(m[0]) };
  } catch (e) {
    return { error: e && e.name === 'AbortError' ? 'AI check took too long. Try again.' : 'AI check failed. Check it by eye.' };
  } finally { clearTimeout(timer); }
}

function summary(rec) {
  const v = publicView(rec);
  return {
    ...v, phone: rec.phone, email: rec.email, createdAt: rec.createdAt, periods: rec.periods || [],
    proofs: (rec.proofs || []).slice().reverse().map(({ key, at, type, size, state, reason, decidedAt, check }) => ({ key, at, type, size, state, reason, decidedAt, check }))
  };
}

export default async (req, context) => {
  const ip = clientIp(req, context);
  const adminKey = process.env.ADMIN_KEY;
  if (!adminKey || adminKey.length < 12) return json(503, { error: 'Admin is not set up. Add ADMIN_KEY (12+ characters) in Netlify environment variables.' });
  if (blocked('admin-bad', ip, 10, 900e3)) return json(429, { error: 'Too many wrong passwords. Wait 15 minutes.' });
  if (!safeEqual(req.headers.get('x-admin-key'), adminKey)) { limit('admin-bad', ip, 10, 900e3); return json(401, { error: 'Wrong admin password.' }); }

  const url = new URL(req.url);
  const action = url.pathname.split('/').filter(Boolean).pop();
  let st;
  try { st = await stores(); } catch (e) { return json(503, { error: 'Storage unavailable. Try again soon.' }); }

  try {
    if (req.method === 'GET' && action === 'list') {
      const ids = await st.listSubIds();
      const recs = (await Promise.all(ids.map(id => st.getSub(id)))).filter(Boolean).map(summary);
      const rank = s => s.pending ? 0 : s.renewDue || (s.status === 'active' && s.daysLeft <= PLAN.remindDays) ? 1 : s.status === 'active' ? 2 : s.status === 'expired' ? 3 : 4;
      recs.sort((a, b) => rank(a) - rank(b) || String(b.proofs[0]?.at || b.createdAt).localeCompare(String(a.proofs[0]?.at || a.createdAt)));
      return json(200, { plan: PLAN, now: new Date().toISOString(), subscriptions: recs });
    }

    if (req.method === 'GET' && action === 'proof') {
      const key = url.searchParams.get('key') || '';
      if (!/^LDG-[2-9A-HJ-NP-Z]{6}\/\d+$/.test(key)) return json(400, { error: 'Bad key' });
      const f = await st.getProof(key);
      if (!f) return json(404, { error: 'Not found' });
      return new Response(f.bytes, { status: 200, headers: { 'content-type': f.type, 'cache-control': 'no-store', 'content-disposition': 'inline' } });
    }

    if (req.method !== 'POST') return json(405, { error: 'Use POST' });
    const { body, error } = await readJson(req, 4000);
    if (error) return error;
    if (!validId(body.id)) return json(400, { error: 'Bad id' });
    const rec = await st.getSub(body.id);
    if (!rec) return json(404, { error: 'Subscription not found' });
    const proof = (rec.proofs || []).find(p => p.key === body.key);
    if (!proof) return json(404, { error: 'Proof not found' });

    if (action === 'check') {
      const f = await st.getProof(proof.key);
      if (!f) return json(404, { error: 'Proof file missing' });
      const out = await readReceipt(f);
      proof.check = out.read
        ? { at: new Date().toISOString(), read: out.read, ...judgeReceipt(out.read, rec, proof.at) }
        : { at: new Date().toISOString(), error: out.error };
      await st.putSub(rec);
      return json(200, summary(rec));
    }
    if (action === 'approve') {
      if (proof.state === 'rejected' || proof.state === 'pending' || proof.state === 'replaced') applyApproval(rec, proof.key);
      await st.putSub(rec);
      return json(200, summary(rec));
    }
    if (action === 'reject') {
      if (proof.state === 'approved') return json(400, { error: 'Already approved. A month was granted for this proof.' });
      applyRejection(rec, proof.key, body.reason);
      await st.putSub(rec);
      return json(200, summary(rec));
    }
    return json(404, { error: 'Unknown action' });
  } catch (e) {
    console.error('admin error', action, e && e.name);
    return json(500, { error: 'Something went wrong.' });
  }
};

export const config = { path: '/api/admin/*' };
