// Ledger control bot: change the website and draft social posts from Telegram. Served at /api/telegram (Telegram's webhook).
//   any message        -> Claude makes that change on GitHub (.github/workflows/telegram.yml), runs the tests and sends back a preview
//   /post <idea>       -> Claude drafts posts for X, LinkedIn, TikTok and YouTube, with one-tap share buttons
//   /status            -> the change waiting to be published, with its preview link
//   /publish, /discard -> put the waiting change live, or throw it away (also available as buttons)
// Only Telegram accounts listed in TELEGRAM_ALLOWED_IDS can use it. Nothing goes live until you press Publish.
// Privacy: message text is never logged. Setup: see "Telegram control bot" in DEVELOPING.md.

import { json, readJson, limit } from '../lib/http.mjs';
import { safeEqual } from '../lib/plan.mjs';
import { CHANGE_BRANCH, TESTS_PASS, allowedIds, webhookSecret, escHtml, tg, say, gh, pendingChange, previewUrl, liveUrl } from '../lib/telegram.mjs';

const MAX_REQUEST = 3000;
const seen = new Set();          // update ids already handled; Telegram resends if we are slow (best effort, per instance)

const HELP = `<b>Ledger control bot</b>

Send any message to change the website, for example:
<i>Make the Ledger Plus button bigger and say "Start free"</i>

I make the change on GitHub, run the tests and send you a preview. Nothing goes live until you tap <b>Publish</b>. Send more messages before publishing and they are added to the same change.

/post <i>idea</i> drafts posts for X, LinkedIn, TikTok and YouTube
/status shows the waiting change
/publish puts it live · /discard throws it away

Each request takes 1–5 minutes.`;

const buttons = n => ({ inline_keyboard: [[
  { text: '✅ Publish', callback_data: 'pub:' + n }, { text: '🗑 Discard', callback_data: 'del:' + n }
], [{ text: '👀 Open preview', url: previewUrl(n) }]] });

async function dispatch(kind, chatId, text, context) {
  const payload = { chat_id: String(chatId), text: text.slice(0, MAX_REQUEST) };
  if (context) payload.context = context.slice(0, 1500);
  const r = await gh('POST', '/dispatches', { event_type: 'telegram-' + kind, client_payload: payload });
  return r.status === 204 ? null : (r.data && r.data.message) || 'GitHub said no (' + r.status + ').';
}

async function status(chatId) {
  const pr = await pendingChange();
  if (!pr) return say(chatId, `Nothing is waiting. The live site is ${liveUrl()}`);
  const ok = String(pr.body || '').includes(TESTS_PASS);
  return say(chatId, `<b>Waiting to publish:</b> ${escHtml(pr.title)}\nTests: ${ok ? 'passed ✅' : 'failed ❌ (send a fix, or discard)'}\nChanges: ${pr.html_url}`, { reply_markup: buttons(pr.number) });
}

// Merge (publish) or close (discard) the Telegram change. Refuses anything that is not the bot's own branch.
async function decide(chatId, action, number) {
  const pr = await pendingChange();
  if (!pr || (number && pr.number !== number)) return say(chatId, 'That change is no longer waiting. Send /status to see what is.');
  if (pr.head.ref !== CHANGE_BRANCH || pr.base.ref !== 'main') return say(chatId, 'That is not a Telegram change, so I will not touch it.');
  if (action === 'publish') {
    if (!String(pr.body || '').includes(TESTS_PASS)) return say(chatId, 'The tests failed on this change, so I will not publish it. Send a message describing the fix, or /discard it.');
    const m = await gh('PUT', `/pulls/${pr.number}/merge`, { merge_method: 'squash', commit_title: `${pr.title} (#${pr.number})` });
    if (m.status !== 200) return say(chatId, `I could not publish it: ${escHtml((m.data && m.data.message) || 'unknown error')}. Open ${pr.html_url} to check.`);
    await gh('DELETE', '/git/refs/heads/' + CHANGE_BRANCH);
    return say(chatId, `✅ Published. It will be live at ${liveUrl()} in about a minute. Installed apps update the next time they are opened.`);
  }
  const c = await gh('PATCH', `/pulls/${pr.number}`, { state: 'closed' });
  if (c.status !== 200) return say(chatId, `I could not discard it: ${escHtml((c.data && c.data.message) || 'unknown error')}.`);
  await gh('DELETE', '/git/refs/heads/' + CHANGE_BRANCH);
  return say(chatId, '🗑 Discarded. The live site is unchanged.');
}

async function onMessage(msg) {
  const chatId = msg.chat.id;
  const text = String(msg.text || msg.caption || '').trim();
  if (!text) return say(chatId, 'Send me text. Photos and files are not supported yet; describe the change in words.');
  const [cmd] = text.split(/\s+/, 1);
  const name = cmd.startsWith('/') ? cmd.slice(1).split('@')[0].toLowerCase() : '';
  const rest = name ? text.slice(cmd.length).trim() : text;

  if (name === 'start' || name === 'help') return say(chatId, HELP);
  if (name === 'status') return status(chatId);
  if (name === 'publish' || name === 'discard') return decide(chatId, name, null);
  if (!limit('tg-request', String(msg.from.id), 30)) return say(chatId, 'That is 30 requests this hour. Wait a little and try again.');
  if (name === 'post') {
    if (!rest) return say(chatId, 'Tell me what to post about, for example:\n/post Ledger Plus is now ₦6,000 a month');
    const err = await dispatch('post', chatId, rest);
    return say(chatId, err ? `I could not start that: ${escHtml(err)}` : '✍️ Writing your posts. About a minute.');
  }
  if (name) return say(chatId, 'I do not know that command. Send /help.');
  const replyTo = msg.reply_to_message && msg.reply_to_message.from && msg.reply_to_message.from.is_bot ? String(msg.reply_to_message.text || '') : '';
  const err = await dispatch('edit', chatId, rest, replyTo);
  return say(chatId, err ? `I could not start that: ${escHtml(err)}` : '🛠 On it. I will send a preview in 1–5 minutes.');
}

async function onButton(q) {
  await tg('answerCallbackQuery', { callback_query_id: q.id });
  const [act, n] = String(q.data || '').split(':');
  const chatId = q.message && q.message.chat.id;
  if (!chatId || !/^\d+$/.test(n || '')) return;
  if (q.message) await tg('editMessageReplyMarkup', { chat_id: chatId, message_id: q.message.message_id, reply_markup: { inline_keyboard: [] } });
  if (act === 'pub') return decide(chatId, 'publish', Number(n));
  if (act === 'del') return decide(chatId, 'discard', Number(n));
}

export default async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'Use POST' });
  if (!process.env.TELEGRAM_BOT_TOKEN) return json(503, { error: 'Bot not set up' });
  if (!safeEqual(req.headers.get('x-telegram-bot-api-secret-token'), await webhookSecret())) return json(401, { error: 'Not allowed' });
  const { body, error } = await readJson(req, 100000);
  if (error) return error;

  // From here on always answer 200, or Telegram keeps resending the same update.
  try {
    if (seen.has(body.update_id)) return json(200, { ok: true });
    seen.add(body.update_id); if (seen.size > 5000) seen.clear();
    const from = (body.message && body.message.from) || (body.callback_query && body.callback_query.from);
    if (!from) return json(200, { ok: true });
    if (!allowedIds().includes(String(from.id))) {
      const chatId = body.message && body.message.chat.id;
      if (chatId && body.message.chat.type === 'private' && limit('tg-stranger', String(from.id), 3, 86400e3))
        await say(chatId, `This is a private bot. Your Telegram ID is <code>${from.id}</code>. If you own this bot, add that number to TELEGRAM_ALLOWED_IDS in Netlify.`);
      return json(200, { ok: true });
    }
    if (body.callback_query) await onButton(body.callback_query);
    else if (body.message) await onMessage(body.message);
  } catch (e) {
    console.error('telegram bot error', e && e.name);
  }
  return json(200, { ok: true });
};

export const config = { path: '/api/telegram' };
