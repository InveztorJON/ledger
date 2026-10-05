// Ledger Plus admin page: review proofs of payment, approve or reject, and remind people before their month ends.
'use strict';
const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const naira = n => '₦' + Math.round(n).toLocaleString('en-NG');
const fmt = iso => iso ? new Date(iso).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Africa/Lagos' }) : '';
const fmtT = iso => iso ? new Date(iso).toLocaleString('en-NG', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'Africa/Lagos' }) : '';

let KEY = '';
try { KEY = sessionStorage.getItem('ledger_admin') || ''; } catch (e) {}
let data = null, filter = 'review', busy = {}, msg = '', rejecting = null, confirming = null;
const thumbs = {};            // proof key -> object URL

async function api(path, opts = {}) {
  const r = await fetch('/api/admin/' + path, { ...opts, headers: { 'x-admin-key': KEY, 'content-type': 'application/json', ...(opts.headers || {}) } });
  if (r.status === 401 || r.status === 503 || r.status === 429) {
    const d = await r.json().catch(() => ({}));
    const e = new Error(d.error || 'Not allowed'); e.status = r.status; throw e;
  }
  if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error(d.error || 'Something went wrong'); }
  return r;
}

async function load() {
  try {
    data = await (await api('list')).json();
    msg = '';
  } catch (e) {
    if (e.status === 401 || e.status === 503 || e.status === 429) { KEY = ''; try { sessionStorage.removeItem('ledger_admin'); } catch (x) {} msg = e.message; }
    else msg = e.message;
  }
  render();
  loadThumbs();
}

async function loadThumbs() {
  if (!data) return;
  for (const s of visible()) {
    const p = s.proofs[0];
    if (!p || p.type === 'application/pdf' || thumbs[p.key]) continue;
    thumbs[p.key] = 'loading';
    try { const b = await (await api('proof?key=' + encodeURIComponent(p.key))).blob(); thumbs[p.key] = URL.createObjectURL(b); }
    catch (e) { thumbs[p.key] = 'error'; }
    const el = document.querySelector(`[data-thumb="${CSS.escape(p.key)}"]`);
    if (el) el.innerHTML = thumbHTML(p);
  }
}

const groups = () => {
  const subs = data ? data.subscriptions : [];
  const soon = s => s.status === 'active' && s.daysLeft <= data.plan.remindDays;
  return {
    review: subs.filter(s => s.pending),
    expiring: subs.filter(s => soon(s) && !s.pending),
    active: subs.filter(s => s.status === 'active'),
    all: subs
  };
};
const visible = () => (data ? groups()[filter] : []);

function chip(s) {
  if (s.pending) return '<span class="chip warn">Needs review</span>';
  if (s.status === 'active') return `<span class="chip good">Active · ${s.daysLeft} day${s.daysLeft === 1 ? '' : 's'} left${s.cancelAtEnd ? ' · not renewing' : ''}</span>`;
  if (s.status === 'expired') return '<span class="chip">Expired</span>';
  if (s.status === 'rejected') return '<span class="chip bad">Rejected</span>';
  return '<span class="chip">Not paid yet</span>';
}
function wa(s, kind) {
  const first = String(s.name || '').split(' ')[0] || 'there';
  const P = data.plan;
  const text = kind === 'remind'
    ? `Hello ${first}, your Ledger Plus subscription ends on ${fmt(s.end)}. To renew, transfer ${naira(P.priceNaira)} to ${P.accountName}, ${P.bank} ${P.accountNumber}, with narration ${s.id}, then upload the receipt in the Ledger app. If you don't want to renew, you can cancel in the app under Me. Thank you! – Ledger by Jonspire`
    : kind === 'approved'
      ? `Hello ${first}, your payment has been verified. Ledger Plus is active until ${fmt(s.end)}. Open Ledger to upload your statements. Thank you! – Ledger by Jonspire`
      : `Hello ${first}, we couldn't verify your Ledger Plus payment yet. Please check you sent ${naira(P.priceNaira)} to ${P.accountName}, ${P.bank} ${P.accountNumber}, and upload a clear receipt in the app. – Ledger by Jonspire`;
  return `https://wa.me/${encodeURIComponent(s.phone)}?text=${encodeURIComponent(text)}`;
}
function thumbHTML(p) {
  if (p.type === 'application/pdf') return `<button class="btn q sm" data-act="open-pdf" data-arg="${esc(p.key)}">Open PDF receipt</button>`;
  const u = thumbs[p.key];
  if (!u || u === 'loading') return '<span class="tiny">Loading receipt…</span>';
  if (u === 'error') return '<span class="tiny">Could not load the receipt</span>';
  return `<img src="${u}" alt="Proof of payment" data-act="zoom" data-arg="${esc(p.key)}">`;
}
function checkHTML(s, p) {
  const c = p.check;
  if (busy[p.key] === 'check') return '<div class="status busy"><span class="spin" aria-hidden="true"></span>AI is reading the receipt…</div>';
  if (!c) return p.state === 'pending' ? `<button class="btn q sm" data-act="check" data-arg="${esc(s.id)}|${esc(p.key)}">Run AI check</button>` : '';
  if (c.error) return `<div class="status err small">${esc(c.error)} <button class="btn link" data-act="check" data-arg="${esc(s.id)}|${esc(p.key)}">Try again</button></div>`;
  const r = c.read || {};
  const good = c.verdict === 'looks_right';
  return `<div class="status ${good ? 'ok' : 'err'} small"><b>${good ? 'AI check: details match' : 'AI check: look carefully'}</b>${c.flags.length ? `<ul class="flags">${c.flags.map(f => `<li>${esc(f)}</li>`).join('')}</ul>` : ''}</div>
   <div class="read"><span>Amount</span><b>${r.amount_naira != null ? naira(r.amount_naira) : '—'}</b><span>Paid to</span><b>${esc([r.beneficiary_name, r.beneficiary_account, r.beneficiary_bank].filter(Boolean).join(' · ') || '—')}</b>
   <span>Date</span><b>${esc(r.date || '—')}</b><span>Narration</span><b>${esc(r.narration || '—')}</b><span>Sender</span><b>${esc(r.sender_name || '—')}</b><span>Status</span><b>${esc(r.transaction_status || '—')}</b>${r.notes ? `<span>Note</span><b>${esc(r.notes)}</b>` : ''}</div>`;
}
function proofHTML(s, p) {
  const isOpen = p.state === 'pending';
  let actions = '';
  if (isOpen) {
    if (confirming === p.key) actions = `<div class="status ok small"><b>Before approving:</b> open your UBA account and confirm you received ${naira(data.plan.priceNaira)} from ${esc(s.name)}${p.check && p.check.read && p.check.read.sender_name ? ` (receipt says ${esc(p.check.read.sender_name)})` : ''} on or after ${fmt(p.at)}.<div class="row" style="margin-top:10px"><button class="btn sm" data-act="approve" data-arg="${esc(s.id)}|${esc(p.key)}">Yes, money received. Approve</button><button class="btn q sm" data-act="cancel-confirm">Back</button></div></div>`;
    else if (rejecting === p.key) actions = `<div class="stack" style="gap:8px"><label class="f" for="rj">Reason the user will see<select id="rj"><option>We haven't received this payment in our account.</option><option>The amount is less than ${naira(data.plan.priceNaira)}.</option><option>The payment went to a different account.</option><option>The receipt is unclear. Please upload a clearer screenshot.</option><option>This receipt has already been used.</option></select></label><div class="row"><button class="btn danger sm" data-act="reject" data-arg="${esc(s.id)}|${esc(p.key)}">Reject</button><button class="btn q sm" data-act="cancel-confirm">Back</button></div></div>`;
    else actions = `<div class="row"><button class="btn sm" data-act="confirm" data-arg="${esc(p.key)}" ${busy[p.key] ? 'disabled' : ''}>Approve</button><button class="btn q sm" data-act="rejecting" data-arg="${esc(p.key)}" ${busy[p.key] ? 'disabled' : ''}>Reject</button></div>`;
  }
  const stateTxt = { pending: 'Waiting for review', approved: 'Approved', rejected: 'Rejected' + (p.reason ? `: ${p.reason}` : ''), replaced: 'Replaced by a newer receipt' }[p.state] || p.state;
  return `<div class="proof"><div class="thumb" data-thumb="${esc(p.key)}">${thumbHTML(p)}</div>
   <div class="stack" style="gap:10px"><p class="small"><b>Receipt uploaded ${fmtT(p.at)}</b> · ${esc(stateTxt)}</p>${checkHTML(s, p)}${actions}</div></div>`;
}
function subHTML(s) {
  const p = s.proofs[0];
  const links = [];
  if (s.status === 'active' && s.daysLeft <= data.plan.remindDays && !s.cancelAtEnd) links.push(`<a class="btn sm" href="${esc(wa(s, 'remind'))}" target="_blank" rel="noopener">Send renewal reminder on WhatsApp</a>`);
  if (p && p.state === 'approved' && s.status === 'active') links.push(`<a class="btn q sm" href="${esc(wa(s, 'approved'))}" target="_blank" rel="noopener">WhatsApp: payment verified</a>`);
  if (p && p.state === 'rejected') links.push(`<a class="btn q sm" href="${esc(wa(s, 'rejected'))}" target="_blank" rel="noopener">WhatsApp: payment not found</a>`);
  return `<section class="card sub"><div class="who"><div><h2>${esc(s.name)}</h2><div class="meta"><span class="num">${esc(s.id)}</span><span>+${esc(s.phone)}</span>${s.email ? `<span>${esc(s.email)}</span>` : ''}<span>Joined ${fmt(s.createdAt)}</span>${s.end ? `<span>${s.status === 'active' ? 'Paid until' : 'Ended'} ${fmt(s.end)}</span>` : ''}<span>${s.periods.length} month${s.periods.length === 1 ? '' : 's'} paid</span></div></div>${chip(s)}</div>
   ${p ? proofHTML(s, p) : '<p class="small muted">No receipt uploaded yet.</p>'}
   ${links.length ? `<div class="row">${links.join('')}</div>` : ''}</section>`;
}
function render() {
  const root = $('#root');
  if (!KEY) {
    root.innerHTML = `<section class="card stack" style="max-width:420px;margin:40px auto 0"><h1 style="font-size:1.5rem">Ledger Plus admin</h1><p class="muted small">Review payments and manage subscriptions.</p>
     <form class="stack" id="login" style="gap:10px"><label class="f" for="pw">Admin password<input type="password" id="pw" autocomplete="current-password" required></label>${msg ? `<div class="status err small">${esc(msg)}</div>` : ''}<button class="btn" type="submit">Sign in</button></form></section>`;
    $('#pw').focus();
    return;
  }
  if (!data) { root.innerHTML = '<p class="muted">Loading…</p>'; return; }
  const g = groups(), list = g[filter];
  const P = data.plan;
  const tab = (id, label) => `<button data-act="filter" data-arg="${id}" aria-pressed="${filter === id}">${label} (${g[id].length})</button>`;
  root.innerHTML = `<div class="bar"><div><h1 style="font-size:1.6rem">Ledger Plus admin</h1><p class="tiny">${naira(P.priceNaira)}/month · ${esc(P.accountName)} · ${esc(P.bank)} ${esc(P.accountNumber)} · ${P.freeUploads} free uploads · reminders ${P.remindDays} days before the end</p></div>
    <div class="row"><button class="btn q sm" data-act="reload">Refresh</button><button class="btn q sm" data-act="logout">Sign out</button></div></div>
   ${msg ? `<div class="status err">${esc(msg)}</div>` : ''}
   <div class="filters" role="group" aria-label="Show">${tab('review', 'Needs review')}${tab('expiring', 'Ending in 3 days')}${tab('active', 'Active')}${tab('all', 'Everyone')}</div>
   ${filter === 'review' && list.length ? '<p class="small muted">The AI check reads each receipt, but receipts can be faked. Approve only after you see the money in the UBA account.</p>' : ''}
   ${filter === 'expiring' && list.length ? '<p class="small muted">These people also see a "Renew or cancel" reminder in the app. A WhatsApp message helps if they rarely open it.</p>' : ''}
   ${list.length ? list.map(subHTML).join('') : `<div class="card empty">${filter === 'review' ? 'No receipts waiting. Nice.' : filter === 'expiring' ? 'Nobody ends in the next 3 days.' : 'Nothing here yet.'}</div>`}`;
}

async function act(name, arg) {
  const [id, key] = String(arg || '').split('|');
  if (name === 'filter') { filter = arg; rejecting = confirming = null; render(); loadThumbs(); return; }
  if (name === 'reload') return load();
  if (name === 'logout') { KEY = ''; try { sessionStorage.removeItem('ledger_admin'); } catch (e) {} data = null; render(); return; }
  if (name === 'confirm') { confirming = arg; rejecting = null; render(); loadThumbs(); return; }
  if (name === 'rejecting') { rejecting = arg; confirming = null; render(); loadThumbs(); return; }
  if (name === 'cancel-confirm') { rejecting = confirming = null; render(); loadThumbs(); return; }
  if (name === 'zoom') { const u = thumbs[arg]; if (u && u !== 'loading' && u !== 'error') document.body.insertAdjacentHTML('beforeend', `<div class="big" data-act="unzoom"><img src="${u}" alt="Proof of payment, full size"></div>`); return; }
  if (name === 'unzoom') { const b = $('.big'); if (b) b.remove(); return; }
  if (name === 'open-pdf') {
    try { const b = await (await api('proof?key=' + encodeURIComponent(arg))).blob(); const u = URL.createObjectURL(new Blob([b], { type: 'application/pdf' })); window.open(u, '_blank', 'noopener'); }
    catch (e) { msg = e.message; render(); }
    return;
  }
  if (['check', 'approve', 'reject'].includes(name)) {
    busy[key] = name; render(); loadThumbs();
    try {
      const body = { id, key };
      if (name === 'reject') body.reason = ($('#rj') || {}).value || '';
      const upd = await (await api(name, { method: 'POST', body: JSON.stringify(body) })).json();
      const i = data.subscriptions.findIndex(s => s.id === id);
      if (i >= 0) data.subscriptions[i] = upd;
      if (name !== 'check') { rejecting = confirming = null; msg = ''; }
    } catch (e) { msg = e.message; }
    delete busy[key];
    render(); loadThumbs();
  }
}

document.addEventListener('click', e => { const el = e.target.closest('[data-act]'); if (!el) return; e.preventDefault(); act(el.dataset.act, el.dataset.arg); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') act('unzoom'); });
document.addEventListener('submit', e => {
  if (e.target.id !== 'login') return;
  e.preventDefault();
  KEY = $('#pw').value.trim();
  try { sessionStorage.setItem('ledger_admin', KEY); } catch (x) {}
  data = null; render(); load();
});
setInterval(() => { if (KEY && document.visibilityState === 'visible' && !Object.keys(busy).length && !confirming && !rejecting) load(); }, 60000);
render();
if (KEY) load();
