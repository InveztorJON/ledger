import asyncio, json, os, sys
from playwright.async_api import async_playwright
URL = sys.argv[1]
CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
R = []
def rec(n, ok, d=''):
    R.append(ok); print(('PASS ' if ok else 'FAIL ') + n + ('' if ok else f' {d}'))

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROME)
        ctx = await b.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True)
        async def route(r):
            u = r.request.url
            if u.startswith('http://127.0.0.1'): return await r.continue_()
            return await r.abort()
        await ctx.route('**/*', route)
        pg = await ctx.new_page()
        csp, errs = [], []
        pg.on('console', lambda m: ('Content Security Policy' in m.text or 'Refused' in m.text) and csp.append(m.text))
        pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(URL); await pg.wait_for_timeout(1500)
        rec('App loads from built files', await pg.locator('#story').count() == 1)
        rec('Runs in standalone mode (not the Claude viewer)', await pg.evaluate('IN_VIEWER') is False)
        man = await pg.evaluate("fetch('manifest.webmanifest').then(r=>r.json())")
        rec('Manifest has name, start_url, display and 192/512 icons', man['short_name'] == 'Ledger' and man['display'] == 'standalone' and {'192x192', '512x512'} <= {i['sizes'] for i in man['icons']})
        for i in man['icons']:
            ok = await pg.evaluate(f"fetch('{i['src']}').then(r=>r.ok&&r.headers.get('content-type')==='image/png')")
            rec(f"Icon {i['src']} served", ok)
        sw = await pg.evaluate("navigator.serviceWorker.ready.then(r=>!!r.active)")
        rec('Service worker installs and activates', sw)
        await pg.reload(); await pg.wait_for_timeout(800)
        rec('Page controlled by service worker after reload', await pg.evaluate('!!navigator.serviceWorker.controller'))
        # coach e2e through the server function
        await pg.evaluate("tab='coach';render()")
        await pg.click('[data-act="ai-on"]')
        await pg.fill('#chatIn', 'Where is my money leaking?')
        await pg.click('form[data-form="chat"] button[type=submit]')
        await pg.wait_for_selector('.msg.a:has-text("Mock coach answer")', timeout=5000)
        rec('AI coach answers through the server function', True)
        up = await pg.evaluate("fetch('/__last').then(r=>r.json())")
        body = json.dumps(up['body'])
        rec('Coach request carries summary, not transactions or names', 'Monthly income' in up['body']['system'] and 'IFEOMA' not in body.upper() and 'ADUNNI' not in body.upper() and 'SHOPRITE LEKKI' not in body.upper())
        for i in range(5):
            await pg.fill('#chatIn', f'q{i}'); await pg.click('form[data-form="chat"] button[type=submit]'); await pg.wait_for_timeout(250)
        rec('Rate limit shows a friendly message', await pg.locator('.msg.a.err', has_text='a lot of questions').count() >= 1)
        # offline
        await ctx.set_offline(True)
        await pg.reload(); await pg.wait_for_timeout(1200)
        rec('Opens offline after first visit', await pg.locator('#story').count() == 1)
        await pg.evaluate("tab='coach';chat=[];render()")
        await pg.fill('#chatIn', 'hello offline'); await pg.click('form[data-form="chat"] button[type=submit]'); await pg.wait_for_timeout(600)
        rec('Coach explains it needs internet when offline', await pg.locator('.msg.a.err', has_text='offline').count() == 1)
        await ctx.set_offline(False)
        for pgname in ['privacy.html', 'terms.html']:
            await pg.goto(URL + pgname); await pg.wait_for_timeout(300)
            rec(f'{pgname} loads', await pg.locator('h1').count() == 1)
        await pg.goto(URL); await pg.wait_for_timeout(600)
        await pg.evaluate("tab='me';render()")
        rec('Privacy and terms links in the app', await pg.locator('a[href="privacy.html"]').count() == 1 and await pg.locator('a[href="terms.html"]').count() == 1)
        rec('No content-security-policy violations', not csp, csp[:3])
        rec('No JavaScript errors', not errs, errs[:3])
        await pg.screenshot(path='pwa_me.png', full_page=True)
        await b.close()
    print(f'{sum(R)}/{len(R)} passed')
asyncio.run(main())
