// Local test server: static site + /api/coach with a mocked Anthropic API. Usage: node serve.mjs <siteDir> <port>
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const [,, dir, port = '8899'] = process.argv;
process.env.ANTHROPIC_API_KEY = 'test-key';
process.env.URL = `http://127.0.0.1:${port}`;
process.env.COACH_HOURLY_LIMIT = '5';
globalThis.__lastUpstream = null;
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, init) => {
  if (String(url).startsWith('https://api.anthropic.com')) {
    const body = JSON.parse(init.body); globalThis.__lastUpstream = { headers: init.headers, body };
    const q = body.messages[body.messages.length - 1].content;
    return new Response(JSON.stringify({ content: [{ type: 'text', text: `Mock coach answer to: ${q}` }] }), { status: 200 });
  }
  return realFetch(url, init);
};
const { default: coach } = await import(path.resolve(dir, '..', 'netlify', 'functions', 'coach.mjs'));
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.txt': 'text/plain' };
http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${port}`);
  if (url.pathname === '/api/coach') {
    const chunks = []; for await (const c of req) chunks.push(c);
    const r = await coach(new Request(url, { method: req.method, headers: req.headers, body: req.method === 'POST' ? Buffer.concat(chunks) : undefined }), { ip: req.headers['x-test-ip'] || '1.1.1.1' });
    res.writeHead(r.status, Object.fromEntries(r.headers)); res.end(await r.text()); return;
  }
  if (url.pathname === '/__last') { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify(globalThis.__lastUpstream)); return; }
  let p = path.join(dir, decodeURIComponent(url.pathname)); if (p.endsWith('/')) p += 'index.html';
  if (!fs.existsSync(p)) { res.writeHead(404); res.end('not found'); return; }
  res.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(res);
}).listen(+port, () => console.log('serving on', port));
