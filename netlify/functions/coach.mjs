// Ledger AI coach — Netlify Function (served at /api/coach).
// Holds the Anthropic API key on the server so it never reaches users' phones.
// Privacy: request bodies are never logged or stored.
//
// Environment variables (set in Netlify > Site configuration > Environment variables):
//   ANTHROPIC_API_KEY   required. Your key from console.anthropic.com
//   COACH_MODEL         optional. Defaults to claude-haiku-4-5-20251001 (fast and low cost)
//   COACH_HOURLY_LIMIT  optional. Questions per person per hour. Default 20
//   COACH_DAILY_LIMIT   optional. Questions per server instance per day. Default 2000
//   ANTHROPIC_BASE_URL  optional. Set automatically by Netlify AI Gateway; otherwise Anthropic's API is used directly

const RULES = `You are the coach inside Ledger, a money-habits app for people in Nigeria. You teach and encourage. You are not a licensed financial adviser.
Rules:
- Base every answer on the user's numbers below. Use ₦ and round to the nearest ₦100.
- Keep answers under 140 words. Warm, plain and direct. End with one concrete next step the user can do this week.
- Education only. Never recommend a specific bank, fintech app, loan app, fund, stock, crypto asset or investment product, and never tell the user to buy, sell or invest in any specific asset. You may explain general ideas (budgeting, emergency funds, inflation, interest, fees, debt payoff methods) and suggest they compare regulated options themselves.
- Never promise returns or outcomes.
- For tax or legal questions, debts they cannot repay, or gambling that feels out of control, say that a qualified professional or someone they trust can help, and still give one small safe step.
- Do not claim you can see individual transactions, connect to a bank or move money.
- Only discuss the user's money, habits and financial education. Politely decline anything unrelated.
- Plain text only: no headings, no tables. Short dash lists are fine.`;

const hits = new Map();          // ip -> [timestamps]; best effort, per server instance
let day = '', dayCount = 0;

const json = (status, body) => new Response(JSON.stringify(body), {
  status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' }
});

function allowedOrigin(req) {
  const origin = req.headers.get('origin');
  if (!origin) return true;      // same-origin fetches from some browsers omit it
  let self = null; try { self = new URL(req.url).origin; } catch {}
  const ok = [self, process.env.URL, process.env.DEPLOY_PRIME_URL, process.env.DEPLOY_URL, 'http://localhost:8888']
    .filter(Boolean).map(u => { try { return new URL(u).origin; } catch { return null; } });
  return ok.includes(origin);
}

function clean(body) {
  if (!body || typeof body !== 'object') return null;
  const summary = typeof body.summary === 'string' ? body.summary.slice(0, 4000) : '';
  let msgs = Array.isArray(body.messages) ? body.messages : [];
  msgs = msgs
    .filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
    .map(m => ({ role: m.role, content: m.content.slice(0, 1500) }))
    .slice(-10);
  while (msgs.length && msgs[0].role !== 'user') msgs.shift();
  // merge consecutive turns with the same role (the API needs alternation)
  const merged = [];
  for (const m of msgs) {
    const last = merged[merged.length - 1];
    if (last && last.role === m.role) last.content += '\n\n' + m.content; else merged.push({ ...m });
  }
  if (!summary || !merged.length || merged[merged.length - 1].role !== 'user') return null;
  return { summary, messages: merged };
}

export default async (req, context) => {
  if (req.method !== 'POST') return json(405, { error: 'Use POST' });
  if (!allowedOrigin(req)) return json(403, { error: 'Not allowed' });
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return json(503, { error: 'Coach is not set up yet' });

  const len = Number(req.headers.get('content-length') || 0);
  if (len > 30000) return json(413, { error: 'Too large' });
  let body; try { body = await req.json(); } catch { return json(400, { error: 'Bad request' }); }
  const input = clean(body);
  if (!input) return json(400, { error: 'Bad request' });

  // rate limits
  const now = Date.now(), ip = (context && context.ip) || req.headers.get('x-nf-client-connection-ip') || 'unknown';
  const hourly = Number(process.env.COACH_HOURLY_LIMIT || 20), daily = Number(process.env.COACH_DAILY_LIMIT || 2000);
  const recent = (hits.get(ip) || []).filter(t => now - t < 3600e3);
  if (recent.length >= hourly) return json(429, { error: 'Too many questions' });
  const today = new Date(now).toISOString().slice(0, 10);
  if (today !== day) { day = today; dayCount = 0; }
  if (dayCount >= daily) return json(429, { error: 'Coach is busy today' });
  recent.push(now); hits.set(ip, recent); dayCount++;
  if (hits.size > 5000) hits.clear();

  try {
    const base = (process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com').replace(/\/+$/, '');
    const r = await fetch(base + '/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model: process.env.COACH_MODEL || 'claude-haiku-4-5-20251001',
        max_tokens: 500,
        system: RULES + "\n\nThe user's numbers (monthly averages from their uploaded statement):\n" + input.summary,
        messages: input.messages
      })
    });
    if (!r.ok) {
      console.error('coach upstream status', r.status);          // status only, never content
      return json(r.status === 429 ? 429 : 502, { error: 'Coach is unavailable right now' });
    }
    const data = await r.json();
    const text = (data.content || []).filter(c => c.type === 'text').map(c => c.text).join('\n').trim();
    if (!text) return json(502, { error: 'Empty answer' });
    return json(200, { text });
  } catch (e) {
    console.error('coach error', e && e.name);
    return json(502, { error: 'Coach is unavailable right now' });
  }
};

export const config = { path: '/api/coach' };
