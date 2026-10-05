// Ledger Plus: plan settings and subscription rules shared by the server functions.
// Keep PLAN in sync with window.LEDGER_PLAN at the top of site/app.js (tests/test_subs.mjs checks this).

export const PLAN = {
  freeUploads: 5,
  priceNaira: 1500,
  bank: 'UBA',
  accountName: 'JONSPIRE LIMITED',
  accountNumber: '1029821937',
  remindDays: 3
};

const DAY = 864e5;
const ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';   // no 0/O/1/I to avoid misreading

export function newId() {
  const b = crypto.getRandomValues(new Uint8Array(6));
  return 'LDG-' + Array.from(b, x => ALPHABET[x % ALPHABET.length]).join('');
}
export function newToken() {
  return Array.from(crypto.getRandomValues(new Uint8Array(24)), x => x.toString(16).padStart(2, '0')).join('');
}
export async function sha256(s) {
  const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(s)));
  return Array.from(new Uint8Array(h), x => x.toString(16).padStart(2, '0')).join('');
}
export function safeEqual(a, b) {
  a = String(a || ''); b = String(b || '');
  let d = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) d |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return d === 0;
}

// Nigerian phone numbers to one form: 2348012345678. Returns null if it doesn't look like one.
export function normPhone(p) {
  let d = String(p || '').replace(/[^\d+]/g, '');
  if (d.startsWith('+')) d = d.slice(1);
  if (d.startsWith('0') && d.length === 11) d = '234' + d.slice(1);
  if (d.length === 10 && /^[789]/.test(d)) d = '234' + d;
  return /^234[789]\d{9}$/.test(d) ? d : null;
}
export const cleanText = (s, n) => String(s || '').replace(/[\u0000-\u001f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);
export const validId = id => typeof id === 'string' && /^LDG-[2-9A-HJ-NP-Z]{6}$/.test(id);

// One calendar month later, in UTC. 31 Jan -> 28/29 Feb.
export function addMonth(iso) {
  const d = new Date(iso);
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + 1);
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, last));
  return d.toISOString();
}

// What the app is allowed to see about a subscription.
export function publicView(rec, now = Date.now()) {
  const end = rec.end ? Date.parse(rec.end) : 0;
  const active = end > now;
  const pending = (rec.proofs || []).some(p => p.state === 'pending');
  const last = (rec.proofs || []).slice(-1)[0];
  const daysLeft = active ? Math.ceil((end - now) / DAY) : 0;
  let status = active ? 'active' : rec.end ? 'expired' : 'unpaid';
  if (!active && pending) status = 'pending';
  else if (!active && last && last.state === 'rejected') status = 'rejected';
  return {
    id: rec.id, name: rec.name, status, end: rec.end || null, daysLeft,
    cancelAtEnd: !!rec.cancelAtEnd, pending,
    renewDue: active && daysLeft <= PLAN.remindDays && !rec.cancelAtEnd && !pending,
    rejectedReason: last && last.state === 'rejected' ? last.reason || '' : '',
    plan: { priceNaira: PLAN.priceNaira, bank: PLAN.bank, accountName: PLAN.accountName, accountNumber: PLAN.accountNumber }
  };
}

// Approving a payment: a renewal paid before the end continues from the old end, so no days are lost.
export function applyApproval(rec, proofKey, now = Date.now()) {
  const p = (rec.proofs || []).find(x => x.key === proofKey);
  if (!p) throw new Error('proof not found');
  if (p.state === 'approved') return rec;
  const startMs = Math.max(now, rec.end ? Date.parse(rec.end) : 0);
  const start = new Date(startMs).toISOString();
  const end = addMonth(start);
  p.state = 'approved'; p.decidedAt = new Date(now).toISOString(); p.reason = '';
  rec.periods = rec.periods || [];
  rec.periods.push({ start, end, approvedAt: p.decidedAt, proof: proofKey });
  rec.end = end;
  rec.cancelAtEnd = false;
  return rec;
}
export function applyRejection(rec, proofKey, reason, now = Date.now()) {
  const p = (rec.proofs || []).find(x => x.key === proofKey);
  if (!p) throw new Error('proof not found');
  p.state = 'rejected'; p.decidedAt = new Date(now).toISOString();
  p.reason = cleanText(reason, 300) || "We couldn't match this payment to our account.";
  return rec;
}

// Compare what the AI read from a receipt with what we expect.
export function judgeReceipt(read, rec, uploadedAt) {
  const flags = [];
  const amount = Number(read && read.amount_naira);
  const acct = String((read && read.beneficiary_account) || '').replace(/\D/g, '');
  const name = String((read && read.beneficiary_name) || '');
  const bank = String((read && read.beneficiary_bank) || '');
  const narr = String((read && read.narration) || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const ok = {
    receipt: !!(read && read.is_receipt),
    amount: amount >= PLAN.priceNaira,
    account: acct === PLAN.accountNumber,
    name: /jon\s*spire/i.test(name),
    bank: !bank || /\buba\b|united bank/i.test(bank),
    reference: narr.includes(rec.id.replace('-', '')) || narr.includes(rec.id.replace('-', '').slice(3)),
    date: false,
    edits: !(read && read.edits_suspected)
  };
  if (read && read.date) {
    const d = Date.parse(read.date + 'T12:00:00Z'), up = Date.parse(uploadedAt);
    ok.date = d <= up + DAY && d >= up - 10 * DAY;
  }
  if (!ok.receipt) flags.push("Doesn't look like a transfer receipt");
  if (!ok.amount) flags.push(amount ? `Amount is ₦${amount.toLocaleString('en-NG')}, less than ₦${PLAN.priceNaira.toLocaleString('en-NG')}` : 'Amount not found');
  if (!ok.account) flags.push(acct ? `Paid to account ${acct}, not ${PLAN.accountNumber}` : 'Account number not found');
  if (!ok.name) flags.push(name ? `Beneficiary is "${name}"` : 'Beneficiary name not found');
  if (!ok.bank) flags.push(`Bank shown is "${bank}"`);
  if (!ok.date) flags.push(read && read.date ? `Dated ${read.date}, not within the last 10 days` : 'Date not found');
  if (!ok.reference) flags.push(`Reference ${rec.id} not in the narration`);
  if (!ok.edits) flags.push('The image may have been edited');
  const verdict = ok.receipt && ok.amount && ok.account && ok.date && ok.edits ? 'looks_right' : 'check_carefully';
  return { verdict, ok, flags };
}
