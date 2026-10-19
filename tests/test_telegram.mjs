// Tests for the Telegram control bot (telegram.mjs, lib/telegram.mjs, the admin "Connect Telegram bot" action and tools/telegram_report.mjs).
// Telegram and GitHub are mocked. Run: node tests/test_telegram.mjs
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

process.env.URL = 'https://ledger.example';
process.env.ADMIN_KEY = 'correct-horse-battery';
process.env.TELEGRAM_BOT_TOKEN = '123:abc';
process.env.TELEGRAM_ALLOWED_IDS = '111, 222';
process.env.LEDGER_GITHUB_TOKEN = 'gh-token';
globalThis.__LEDGER_STORES__ = { getSub: async () => null, putSub: async () => {}, listSubIds: async () => [], putProof: async () => {}, getProof: async () => null };
const logs = []; console.error = (...a) => logs.push(a.join(' '));

// Mocked Telegram + GitHub
let calls = [], openPr = null, dispatchStatus = 204, mergeStatus = 200;
const pr = (over = {}) => ({ number: 7, title: 'Telegram: bigger button', html_url: 'https://github.com/InveztorJON/ledger/pull/7', body: 'x\n<!-- tests: pass -->', head: { ref: 'telegram/changes' }, base: { ref: 'main' }, ...over });
globalThis.fetch = async (url, init = {}) => {
  const u = String(url), method = init.method || 'GET', body = init.body ? JSON.parse(init.body) : null;
  calls.push({ u, method, body, headers: init.headers || {} });
  const ok = (data, status = 200) => new Response(data === null ? null : JSON.stringify(data), { status });
  if (u.startsWith('https://api.telegram.org/')) {
    const m = u.split('/').pop();
    return ok({ ok: true, result: m === 'getMe' ? { username: 'ledger_ctl_bot' } : true });
  }
  if (u.includes('/dispatches')) return ok(dispatchStatus === 204 ? null : { message: 'Bad credentials' }, dispatchStatus);
  if (u.includes('/pulls?')) return ok(openPr ? [openPr] : []);
  if (u.match(/\/pulls\/\d+\/merge$/)) return ok({ merged: mergeStatus === 200, message: mergeStatus === 200 ? 'ok' : 'Pull Request is not mergeable' }, mergeStatus);
  if (u.match(/\/pulls\/\d+$/) && method === 'PATCH') return ok({ state: 'closed' });
  if (u.includes('/git/refs/heads/')) return ok(null, 204);
  return ok({ message: 'unexpected ' + u }, 404);
};

const { default: bot } = await import(path.join(root, 'netlify/functions/telegram.mjs'));
const { default: admin } = await import(path.join(root, 'netlify/functions/admin.mjs'));
const lib = await import(path.join(root, 'netlify/lib/telegram.mjs'));
const report = await import(path.join(root, 'tools/telegram_report.mjs'));
const SECRET = await lib.webhookSecret();

const results = []; const t = (name, ok, d = '') => { results.push(!!ok); console.log((ok ? 'PASS ' : 'FAIL ') + name + (ok ? '' : ' ' + d)); };
let upd = 1;
const send = async (update, { secret = SECRET, method = 'POST' } = {}) => {
  calls = [];
  const headers = { 'content-type': 'application/json' }; if (secret) headers['x-telegram-bot-api-secret-token'] = secret;
  const r = await bot(new Request('https://ledger.example/api/telegram', { method, headers, body: method === 'POST' ? JSON.stringify({ update_id: upd++, ...update }) : undefined }));
  return r.status;
};
const text = (s, from = 111, extra = {}) => ({ message: { message_id: 1, from: { id: from, is_bot: false }, chat: { id: from, type: 'private' }, text: s, ...extra } });
const button = (data, from = 111) => ({ callback_query: { id: 'cb1', from: { id: from }, data, message: { message_id: 9, chat: { id: from } } } });
const sent = () => calls.filter(c => c.u.endsWith('/sendMessage')).map(c => c.body);
const lastSent = () => sent().pop() || {};
const gh = (frag, method) => calls.filter(c => c.u.startsWith('https://api.github.com/') && c.u.includes(frag) && (!method || c.method === method));

// Gatekeeping
t('GET is refused', (await send({}, { method: 'GET' })) === 405);
t('a call without Telegram\'s secret header is refused', (await send(text('hi'), { secret: null })) === 401 && calls.length === 0);
t('a call with a wrong secret is refused', (await send(text('hi'), { secret: 'nope' })) === 401 && calls.length === 0);
t('the webhook secret is derived from the bot token (48 hex chars)', /^[0-9a-f]{48}$/.test(SECRET));
delete process.env.TELEGRAM_BOT_TOKEN;
t('without TELEGRAM_BOT_TOKEN the bot is off (503)', (await send(text('hi'))) === 503);
process.env.TELEGRAM_BOT_TOKEN = '123:abc';

t('a stranger is told their ID and nothing is started', (await send(text('delete everything', 999))) === 200
  && /private bot/.test(lastSent().text) && lastSent().text.includes('999') && gh('/dispatches').length === 0);
await send(text('again', 999)); await send(text('again', 999)); await send(text('again', 999));
t('a stranger gets at most 3 replies a day', sent().length === 0);
t('a stranger\'s button press does nothing', (await send(button('pub:7', 999))) === 200 && gh('/merge').length === 0);
t('strangers in group chats get no reply', (await send({ message: { message_id: 1, from: { id: 555 }, chat: { id: -100, type: 'group' }, text: 'hi' } })) === 200 && sent().length === 0);

// Requests
await send(text('Make the Ledger Plus button bigger'));
let d = gh('/dispatches', 'POST')[0];
t('a message starts a website change on GitHub', d && d.body.event_type === 'telegram-edit' && d.body.client_payload.text === 'Make the Ledger Plus button bigger' && d.body.client_payload.chat_id === '111', JSON.stringify(d && d.body));
t('the GitHub call uses the token and the right repository', d && d.u === 'https://api.github.com/repos/InveztorJON/ledger/dispatches' && d.headers.authorization === 'Bearer gh-token');
t('the owner is told it has started', /On it/.test(lastSent().text));
t('the second allowed ID works too', (await send(text('Fix the typo on the terms page', 222))) === 200 && gh('/dispatches').length === 1);

await send(text('Yes, use green', 111, { reply_to_message: { from: { is_bot: true }, text: 'Which colour should the button be?' } }));
d = gh('/dispatches')[0];
t('replying to the bot passes its question along as context', d && d.body.client_payload.context === 'Which colour should the button be?');
await send(text('x'.repeat(5000)));
t('very long requests are trimmed to 3000 characters', gh('/dispatches')[0].body.client_payload.text.length === 3000);

await send(text('/post'));
t('/post without an idea explains how to use it', /Tell me what to post about/.test(lastSent().text) && gh('/dispatches').length === 0);
await send(text('/post Ledger Plus is now ₦6,000'));
d = gh('/dispatches')[0];
t('/post <idea> starts the social drafts job', d && d.body.event_type === 'telegram-post' && d.body.client_payload.text === 'Ledger Plus is now ₦6,000' && /Writing your posts/.test(lastSent().text));
await send(text('/help'));
t('/help explains the bot', /Ledger control bot/.test(lastSent().text) && gh('/dispatches').length === 0);
await send(text('/frobnicate'));
t('unknown commands are not sent to Claude', /do not know that command/.test(lastSent().text) && gh('/dispatches').length === 0);
await send({ message: { message_id: 1, from: { id: 111 }, chat: { id: 111, type: 'private' }, photo: [{}] } });
t('a photo without text gets a friendly note', /Send me text/.test(lastSent().text));

dispatchStatus = 401;
await send(text('Change the headline'));
t('if GitHub refuses, the owner is told why', /could not start that: Bad credentials/.test(lastSent().text));
dispatchStatus = 204;

const dupId = upd;
await send(text('Same message'));
upd = dupId; await send(text('Same message'));
t('a resent Telegram update is handled once', gh('/dispatches').length === 0);

// Status, publish, discard
openPr = null;
await send(text('/status'));
t('/status with nothing waiting shows the live link', /Nothing is waiting/.test(lastSent().text));
openPr = pr();
await send(text('/status'));
const st = lastSent();
t('/status shows the waiting change with Publish and preview buttons', /Waiting to publish/.test(st.text) && st.reply_markup.inline_keyboard[0][0].callback_data === 'pub:7'
  && st.reply_markup.inline_keyboard[1][0].url === 'https://deploy-preview-7--jonspire-ledger.netlify.app');

await send(button('pub:7'));
let m = gh('/pulls/7/merge', 'PUT')[0];
t('Publish merges the change into main (squash)', m && m.body.merge_method === 'squash');
t('Publish deletes the telegram/changes branch and says it is live', gh('/git/refs/heads/telegram/changes', 'DELETE').length === 1 && /Published/.test(lastSent().text));
t('the buttons are removed after a tap', calls.some(c => c.u.endsWith('/editMessageReplyMarkup')) && calls.some(c => c.u.endsWith('/answerCallbackQuery')));

openPr = pr({ body: 'Tests: failed' });
await send(button('pub:7'));
t('a change with failing tests is never published', gh('/merge').length === 0 && /tests failed/.test(lastSent().text));
openPr = pr({ head: { ref: 'claude/other-work' } });
await send(text('/publish'));
t('a pull request that is not the bot\'s own is never touched', gh('/merge').length === 0 && /not a Telegram change/.test(lastSent().text));
openPr = pr({ number: 8 });
await send(button('pub:7'));
t('an old Publish button does not publish a newer change', gh('/merge').length === 0 && /no longer waiting/.test(lastSent().text));
openPr = pr(); mergeStatus = 405;
await send(text('/publish'));
t('if GitHub cannot merge, the owner is told', /could not publish it: Pull Request is not mergeable/.test(lastSent().text) && gh('/git/refs', 'DELETE').length === 0);
mergeStatus = 200;
await send(button('del:7'));
t('Discard closes the change and deletes the branch', gh('/pulls/7', 'PATCH')[0]?.body.state === 'closed' && gh('/git/refs/heads/telegram/changes', 'DELETE').length === 1 && /Discarded/.test(lastSent().text));
openPr = null;
await send(text('/discard'));
t('/discard with nothing waiting says so', /no longer waiting/.test(lastSent().text));

t('message text never appears in the logs', !logs.some(l => /bigger|Ledger Plus is now|delete everything/.test(l)), logs.join(' | '));

// Admin "Connect Telegram bot"
const AD = async (key = 'correct-horse-battery') => {
  calls = [];
  const r = await admin(new Request('https://ledger.example/api/admin/telegram-setup', { method: 'POST', headers: { 'x-admin-key': key, 'content-type': 'application/json' }, body: '{}' }), { ip: '8.8.8.' + upd++ });
  return { status: r.status, body: await r.json() };
};
t('Connect Telegram needs the admin password', (await AD('wrong-password-123')).status === 401 && calls.length === 0);
let a = await AD();
const hook = calls.find(c => c.u.endsWith('/setWebhook'));
t('Connect Telegram points the bot at /api/telegram with the derived secret', a.status === 200 && a.body.bot === 'ledger_ctl_bot' && hook && hook.body.url === 'https://ledger.example/api/telegram' && hook.body.secret_token === SECRET, JSON.stringify(a.body));
t('Connect Telegram reports the allowlist and GitHub token', a.body.allowed === 2 && a.body.github === true && calls.some(c => c.u.endsWith('/setMyCommands')));
delete process.env.TELEGRAM_BOT_TOKEN;
a = await AD();
t('Connect Telegram explains a missing bot token', a.status === 400 && /TELEGRAM_BOT_TOKEN/.test(a.body.error));
process.env.TELEGRAM_BOT_TOKEN = '123:abc';
t('allowed IDs ignore junk', (process.env.TELEGRAM_ALLOWED_IDS = '111,abc, 222 ,', lib.allowedIds().join() === '111,222'));

// Messages the GitHub job sends back
let out = report.editMessages({ text: 'Made the button bigger.', error: false }, { pr: '7', prUrl: 'u', tests: 'pass', changed: 'site/app.css\nsite/sw.js\n' });
t('report: a passing change offers Publish, Discard and the preview', out.length === 1 && out[0].reply_markup.inline_keyboard[0][0].callback_data === 'pub:7' && out[0].text.includes('deploy-preview-7--jonspire-ledger.netlify.app') && out[0].text.includes('site/app.css, site/sw.js'));
out = report.editMessages({ text: 'Tried.', error: false }, { pr: '7', prUrl: 'u', tests: 'fail', changed: 'site/app.js' });
t('report: a failing change offers only Discard', !JSON.stringify(out[0].reply_markup).includes('pub:') && /will not publish/.test(out[0].text));
out = report.editMessages({ text: 'Which page do you mean, <home> or terms?', error: false }, {});
t('report: no change sends Claude\'s question, escaped, with a reply hint', /Which page do you mean, &lt;home&gt; or terms\?/.test(out[0].text) && /Reply to this message/.test(out[0].text));
out = report.editMessages({ text: '', error: true }, {});
t('report: a Claude failure says so plainly', /could not finish/.test(out[0].text));

const drafts = { x: 'Ledger reads your bank statement on your phone. See where your money goes. https://jonspire-ledger.netlify.app', linkedin: 'Long post #Fintech',
  tiktok: { hook: 'Where did your salary go?', script: 'line 1\nline 2', caption: 'Try Ledger #money' }, youtube: { title: 'Find your money leaks', description: 'Desc', script: 's' } };
out = report.postMessages({ text: 'Here you go:\n' + JSON.stringify(drafts) });
const xMsg = out[0];
t('report: X draft gets a one-tap "Post on X" button with the text filled in', /x\.com\/intent\/post\?text=Ledger%20reads/.test(xMsg.reply_markup.inline_keyboard[0][0].url) && xMsg.reply_markup.inline_keyboard[0][1].copy_text.text === drafts.x);
t('report: LinkedIn, TikTok and YouTube drafts are all sent', out.length === 5 && /LinkedIn/.test(out[1].text) && /TikTok/.test(out[2].text) && /YouTube Shorts/.test(out[3].text) && out[1].reply_markup.inline_keyboard[0][0].url.startsWith('https://www.linkedin.com/feed/?shareActive=true&text='));
out = report.postMessages({ text: JSON.stringify({ ...drafts, x: 'y'.repeat(400) }) });
t('report: X posts are cut to 280 characters', decodeURIComponent(out[0].reply_markup.inline_keyboard[0][0].url.split('text=')[1]).length === 280);
out = report.postMessages({ text: 'not json' });
t('report: unreadable drafts get a friendly retry message', out.length === 1 && /could not write the posts/.test(out[0].text));
t('report: every message fits Telegram\'s limit', report.postMessages({ text: JSON.stringify({ ...drafts, linkedin: 'z'.repeat(9000) }) }).every(x => x.text.length <= 4000));

const passed = results.filter(Boolean).length;
console.log(`\n${passed}/${results.length} passed`);
process.exit(passed === results.length ? 0 : 1);
