// Sends the result of a Telegram request back to the owner. Run by .github/workflows/telegram.yml.
//   node tools/telegram_report.mjs edit    after Claude changed the site (PR_NUMBER, PR_URL, TESTS, CHANGED)
//   node tools/telegram_report.mjs post    after Claude drafted social posts
//   node tools/telegram_report.mjs error   when the job failed (RUN_URL)
// Needs TELEGRAM_BOT_TOKEN and CHAT_ID. Claude's output is read from RESULT_FILE (claude -p --output-format json).
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

const site = () => process.env.NETLIFY_SITE_NAME || 'jonspire-ledger';
const LINK = () => `https://${site()}.netlify.app`;
const esc = s => String(s ?? '').replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
const cut = (s, n) => { s = String(s ?? '').trim(); return s.length > n ? s.slice(0, n - 1) + '…' : s; };
const msg = (text, reply_markup) => ({ text: cut(text, 4000), parse_mode: 'HTML', link_preview_options: { is_disabled: true }, ...(reply_markup ? { reply_markup } : {}) });
// A button that copies the text (Telegram allows up to 256 characters); longer text is shown in a tap-to-copy block instead.
const copyBtn = s => s.length <= 256 ? [{ text: '📋 Copy', copy_text: { text: s } }] : [];

export function claudeText(file) {
  try {
    const out = JSON.parse(fs.readFileSync(file, 'utf8'));
    return { text: String(out.result || '').trim(), error: !!out.is_error };
  } catch { return { text: '', error: true }; }
}

export function editMessages({ text, error }, { pr, prUrl, tests, changed }) {
  const files = String(changed || '').split('\n').map(s => s.trim()).filter(Boolean);
  if (!pr) {
    return [msg(error ? 'Claude could not finish that request. Try again, or say it a different way.'
      : `💬 ${esc(cut(text, 3000) || 'I did not change anything.')}\n\n<i>Nothing changed. Reply to this message to answer.</i>`)];
  }
  const ok = tests === 'pass';
  const head = `🛠 ${esc(cut(text, 2500) || 'Change made.')}\n\nFiles: ${esc(cut(files.join(', '), 400) || 'none')}\nTests: ${ok ? 'passed ✅' : 'failed ❌'}`;
  const preview = `https://deploy-preview-${pr}--${site()}.netlify.app`;
  const tail = ok
    ? `\n\nPreview (ready in about a minute): ${preview}\nTap <b>Publish</b> to put it live, or send another message to add to this change.`
    : `\n\nI will not publish a change with failing tests. Send a message describing the fix, or discard it.\nDetails: ${prUrl}`;
  const rows = ok ? [[{ text: '✅ Publish', callback_data: 'pub:' + pr }, { text: '🗑 Discard', callback_data: 'del:' + pr }], [{ text: '👀 Open preview', url: preview }]]
    : [[{ text: '🗑 Discard', callback_data: 'del:' + pr }]];
  return [msg(head + tail, { inline_keyboard: rows })];
}

export function postMessages({ text }) {
  const m = text.match(/\{[\s\S]*\}/);
  let p = null; try { p = m && JSON.parse(m[0]); } catch {}
  if (!p || typeof p !== 'object') return [msg('I could not write the posts this time. Try again with a little more detail.')];
  const out = [];
  const x = cut(p.x, 280);
  if (x) out.push(msg(`<b>X</b>\n\n${esc(x)}`, { inline_keyboard: [[{ text: '🐦 Post on X', url: 'https://x.com/intent/post?text=' + encodeURIComponent(x) }, ...copyBtn(x)]] }));
  const li = cut(p.linkedin, 2900);
  if (li) {
    const share = 'https://www.linkedin.com/feed/?shareActive=true&text=' + encodeURIComponent(li);
    out.push(msg(`<b>LinkedIn</b> (tap the text to copy it)\n\n<code>${esc(li)}</code>`,
      { inline_keyboard: [[{ text: '💼 Open LinkedIn', url: share.length <= 2000 ? share : 'https://www.linkedin.com/feed/?shareActive=true' }]] }));
  }
  const t = p.tiktok || {};
  if (t.script || t.caption) out.push(msg(`<b>TikTok</b>\nHook: ${esc(cut(t.hook, 200))}\n\nScript:\n${esc(cut(t.script, 1500))}\n\nCaption (tap to copy):\n<code>${esc(cut(t.caption, 600))}</code>`,
    copyBtn(cut(t.caption, 600)).length ? { inline_keyboard: [copyBtn(cut(t.caption, 600))] } : undefined));
  const y = p.youtube || {};
  if (y.title || y.script) out.push(msg(`<b>YouTube Shorts</b>\nTitle (tap to copy): <code>${esc(cut(y.title, 100))}</code>\n\nDescription (tap to copy):\n<code>${esc(cut(y.description, 1200))}</code>\n\nScript:\n${esc(cut(y.script, 1500))}`));
  out.push(msg(`Film the TikTok and YouTube videos on your phone, then paste the caption and title when you upload. Link to share: ${LINK()}`));
  return out;
}

export const errorMessages = runUrl => [msg(`⚠️ Something went wrong on GitHub, so nothing changed. Try again in a few minutes.${runUrl ? `\nDetails: ${runUrl}` : ''}`)];

async function send(params) {
  const r = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ chat_id: process.env.CHAT_ID, ...params })
  });
  if (!r.ok) {
    // Fall back to plain text if Telegram rejected the formatting or a button.
    const plain = { text: params.text.replace(/<[^>]+>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&') };
    await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ chat_id: process.env.CHAT_ID, ...plain })
    });
    console.log('telegram rejected a message, sent plain text instead:', r.status);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  if (!process.env.TELEGRAM_BOT_TOKEN || !/^-?\d+$/.test(process.env.CHAT_ID || '')) { console.log('No Telegram token or chat id; nothing to send.'); process.exit(0); }
  const kind = process.argv[2];
  const result = claudeText(process.env.RESULT_FILE || '');
  const list = kind === 'edit' ? editMessages(result, { pr: process.env.PR_NUMBER, prUrl: process.env.PR_URL, tests: process.env.TESTS, changed: process.env.CHANGED })
    : kind === 'post' ? postMessages(result)
    : errorMessages(process.env.RUN_URL);
  for (const m of list) await send(m);
}
