// Telegram and GitHub helpers for the Ledger control bot (netlify/functions/telegram.mjs and the admin "Connect Telegram" button).
// Environment variables (Netlify > Project configuration > Environment variables):
//   TELEGRAM_BOT_TOKEN     the token @BotFather gave you
//   TELEGRAM_ALLOWED_IDS   your Telegram user ID (several allowed, comma separated). Nobody else can use the bot.
//   LEDGER_GITHUB_TOKEN    a fine-grained GitHub token for this repository only: Contents and Pull requests, Read and write
//   LEDGER_GITHUB_REPO     optional. Defaults to InveztorJON/ledger
//   NETLIFY_SITE_NAME      optional. Defaults to jonspire-ledger (used for preview links)

export const CHANGE_BRANCH = 'telegram/changes';          // every Telegram edit lands here until you publish or discard it
export const TESTS_PASS = '<!-- tests: pass -->';         // the workflow writes this into the PR body when npm test passes

export const repo = () => process.env.LEDGER_GITHUB_REPO || 'InveztorJON/ledger';
export const siteName = () => process.env.NETLIFY_SITE_NAME || 'jonspire-ledger';
export const liveUrl = () => `https://${siteName()}.netlify.app`;
export const previewUrl = n => `https://deploy-preview-${n}--${siteName()}.netlify.app`;

export const allowedIds = () => String(process.env.TELEGRAM_ALLOWED_IDS || '')
  .split(/[,\s]+/).filter(s => /^\d{1,15}$/.test(s));

// Telegram signs each webhook call with this value (header x-telegram-bot-api-secret-token).
// It is derived from the bot token, so there is no extra secret to set up.
export async function webhookSecret() {
  const token = process.env.TELEGRAM_BOT_TOKEN || '';
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('ledger-telegram-webhook|' + token));
  return [...new Uint8Array(d)].map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 48);
}

export const escHtml = s => String(s ?? '').replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

// tg('sendMessage', {...}) -> Telegram's result, or null on failure. Never throws and never logs message text.
export async function tg(method, params) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return null;
  try {
    const r = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(params)
    });
    const d = await r.json().catch(() => ({}));
    if (!d.ok) { console.error('telegram', method, r.status); return null; }
    return d.result;
  } catch (e) { console.error('telegram', method, e && e.name); return null; }
}

export const say = (chatId, text, extra = {}) =>
  tg('sendMessage', { chat_id: chatId, text, parse_mode: 'HTML', link_preview_options: { is_disabled: true }, ...extra });

// gh('GET', '/pulls?state=open') -> {status, data}. Paths are relative to the repository.
export async function gh(method, path, body) {
  const token = process.env.LEDGER_GITHUB_TOKEN;
  if (!token) return { status: 0, data: { message: 'LEDGER_GITHUB_TOKEN is not set in Netlify.' } };
  try {
    const r = await fetch(`https://api.github.com/repos/${repo()}${path}`, {
      method,
      headers: { authorization: `Bearer ${token}`, accept: 'application/vnd.github+json', 'x-github-api-version': '2022-11-28', 'user-agent': 'ledger-telegram-bot', 'content-type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined
    });
    const text = await r.text();
    let data = null; try { data = text ? JSON.parse(text) : null; } catch {}
    return { status: r.status, data };
  } catch (e) { console.error('github', method, e && e.name); return { status: 0, data: { message: 'GitHub could not be reached.' } }; }
}

// The open pull request holding Telegram changes, or null.
export async function pendingChange() {
  const owner = repo().split('/')[0];
  const r = await gh('GET', `/pulls?state=open&base=main&head=${encodeURIComponent(owner + ':' + CHANGE_BRANCH)}`);
  return r.status === 200 && Array.isArray(r.data) && r.data[0] ? r.data[0] : null;
}

// Points Telegram at /api/telegram on this site. Used by the admin page's "Connect Telegram bot" button.
export async function connectWebhook(origin) {
  if (!process.env.TELEGRAM_BOT_TOKEN) return { ok: false, error: 'Add TELEGRAM_BOT_TOKEN in Netlify environment variables, then redeploy.' };
  const me = await tg('getMe', {});
  if (!me) return { ok: false, error: 'Telegram did not accept TELEGRAM_BOT_TOKEN. Copy it again from @BotFather.' };
  const set = await tg('setWebhook', {
    url: origin.replace(/\/+$/, '') + '/api/telegram',
    secret_token: await webhookSecret(),
    allowed_updates: ['message', 'callback_query'],
    drop_pending_updates: true
  });
  if (!set) return { ok: false, error: 'Telegram refused the webhook. Try again in a minute.' };
  await tg('setMyCommands', { commands: [
    { command: 'status', description: 'Show the change waiting to be published' },
    { command: 'publish', description: 'Put the waiting change live' },
    { command: 'discard', description: 'Throw the waiting change away' },
    { command: 'post', description: 'Draft social posts: /post your idea' },
    { command: 'help', description: 'How to use this bot' }
  ] });
  return { ok: true, bot: me.username, allowed: allowedIds().length, github: !!process.env.LEDGER_GITHUB_TOKEN };
}
