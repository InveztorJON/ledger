# Browser test of the account screens against the real account functions. Run: node tests/serve.mjs site 8899 &  python tests/acct_test.py http://127.0.0.1:8899
import asyncio, json, sys, time
from playwright.async_api import async_playwright
URL = sys.argv[1].rstrip('/')
CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
R = []
def rec(n, ok, d=''):
    R.append(bool(ok)); print(('PASS ' if ok else 'FAIL ') + n + ('' if ok else f' {d}'))
EMAIL = f'new{time.time_ns()}@example.com'; PW = 'a long safe pass 42'

async def code_for(pg, email):
    m = await pg.evaluate("(e)=>fetch('/__mail?to='+encodeURIComponent(e)+'&n='+Date.now()+Math.random()).then(r=>r.json())", email)
    import re
    return re.search(r'code is (\d{6})', m['text']).group(1)

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROME)
        async def route(r): return await (r.continue_() if r.request.url.startswith('http://127.0.0.1') else r.abort())
        ctx = await b.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True)
        await ctx.route('**/*', route)
        await ctx.set_extra_http_headers({'x-test-ip': f'10.{time.time_ns() % 250}.{time.time_ns() // 7 % 250}.9'})
        pg = await ctx.new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: ('Content Security Policy' in m.text or 'Refused' in m.text) and errs.append(m.text))
        await pg.goto(URL + '/'); await pg.wait_for_timeout(700)
        await pg.evaluate("S.consent.read=true;S.consent.store=true;S.consent.ai=true;save()")
        await pg.evaluate("tab='me';render()")
        rec('Me tab invites a new person to create an account', 'Create your free account' in await pg.inner_text('#account'))
        await pg.click('[data-act="auth-open-signup"]')
        rec('Sign-up asks for email and a password (hidden by default)', await pg.locator('#auEmail').count() == 1 and await pg.get_attribute('#auPw', 'type') == 'password')
        await pg.check('#auShow'); rec('Show password reveals it', await pg.get_attribute('#auPw', 'type') == 'text')
        await pg.fill('#auEmail', EMAIL); await pg.fill('#auPw', 'short')
        await pg.click('#authSheet button[type=submit]'); await pg.wait_for_timeout(300)
        rec('Must tick the agreement', 'agree' in (await pg.inner_text('#authSheet')).lower())
        await pg.check('#auAgree'); await pg.fill('#auPw', 'short')
        await pg.click('#authSheet button[type=submit]'); await pg.wait_for_selector('#authSheet .status.err')
        rec('A weak password is explained, not accepted', 'at least 8' in await pg.inner_text('#authSheet .status.err'))
        await pg.fill('#auPw', PW); await pg.check('#auAgree') if not await pg.is_checked('#auAgree') else None
        await pg.click('#authSheet button[type=submit]'); await pg.wait_for_selector('#auCode')
        rec('Next step asks for the 6-digit code sent by email', EMAIL in await pg.inner_text('#authSheet'))
        rec('Still not signed in before the code', await pg.evaluate('signedIn()') is False)
        await pg.fill('#auCode', '000000'); await pg.click('#authSheet button[type=submit]'); await pg.wait_for_selector('#authSheet .status.err')
        rec('A wrong code is refused', 'not right' in await pg.inner_text('#authSheet .status.err'))
        await pg.fill('#auCode', await code_for(pg, EMAIL)); await pg.click('#authSheet button[type=submit]')
        await pg.wait_for_function('1', timeout=100) if False else None
        for _ in range(50):
            if await pg.evaluate('signedIn()'): break
            await pg.wait_for_timeout(100)
        rec('The right code confirms the email and signs in', await pg.evaluate('signedIn()') and await pg.locator('#authSheet').count() == 0)
        await pg.evaluate("tab='me';render()")
        rec('Me tab shows the signed-in email', EMAIL in await pg.inner_text('#account'))
        rec('Trial has not started until the first statement', await pg.evaluate('trialStarted()') is False)
        # coach with an account
        await pg.evaluate("tab='coach';render()")
        # needs numbers first: use a statement
        rows = ['Date,Description,Debit,Credit,Balance'] + [f'{d:02d}/08/2026,POS PURCHASE SHOP {d},{1000+d*10}.00,,{500000-d*1000}.00' for d in range(1, 20)] + ['25/08/2026,SALARY CREDIT,,350000.00,800000.00']
        await pg.evaluate("tab='statements';render()")
        await pg.set_input_files('#fileIn', {'name': 's.csv', 'mimeType': 'text/csv', 'buffer': '\n'.join(rows).encode()})
        for _ in range(60):
            if await pg.evaluate('S.statements.length') == 1 and await pg.evaluate('(P.pendingTrial||0)===0'): break
            await pg.wait_for_timeout(100)
        rec('First statement starts the 7-day trial on the server', await pg.evaluate('trialStarted()') and await pg.evaluate('trialData().used') == 1)
        await pg.evaluate("document.querySelectorAll('.celebrate').forEach(e=>e.remove());closeSheet();tab='coach';render()")
        await pg.fill('#chatIn', 'Where does my money go?'); await pg.click('form[data-form="chat"] button[type=submit]')
        await pg.wait_for_selector('.msg.a:has-text("Mock coach answer")', timeout=6000)
        rec('Signed-in account with a trial can ask the coach', True)
        # log out
        await pg.evaluate("tab='me';render()"); await pg.click('[data-act="logout"]')
        rec('Log out signs this phone out but keeps the statements', await pg.evaluate('signedIn()') is False and await pg.evaluate('S.statements.length') == 1)
        await pg.evaluate("document.querySelectorAll('.celebrate').forEach(e=>e.remove());tab='coach';render()")
        await pg.fill('#chatIn', 'Hello again'); await pg.click('form[data-form="chat"] button[type=submit]')
        await pg.wait_for_selector('#authSheet', timeout=3000)
        rec('Asking the coach when logged out opens the login sheet', 'Log in to Ledger' in await pg.inner_text('#authSheet'))
        await pg.evaluate('closeSheet()')
        await pg.evaluate("tab='statements';render()"); await pg.click('.drop')
        rec('Uploading when logged out opens sign-up, not the file picker', await pg.locator('#authSheet').count() == 1)
        # login with wrong then right password
        await pg.click('[data-act="auth-mode"][data-arg="login"]')
        await pg.fill('#auEmail', EMAIL); await pg.fill('#auPw', 'wrong pass 123456'); await pg.click('#authSheet button[type=submit]'); await pg.wait_for_selector('#authSheet .status.err')
        rec('Wrong password: one plain message that does not reveal whether the email exists', 'Email or password is not right' in await pg.inner_text('#authSheet .status.err'))
        await pg.fill('#auPw', PW); await pg.click('#authSheet button[type=submit]')
        for _ in range(50):
            if await pg.evaluate('signedIn()'): break
            await pg.wait_for_timeout(100)
        rec('Logging in again restores the same trial (not a new one)', await pg.evaluate('signedIn()') and await pg.evaluate('trialStarted()') and await pg.evaluate('trialData().used') == 1)
        # forgot password
        await pg.evaluate("logoutAcct()"); await pg.evaluate("openAuth('login','')")
        await pg.click('[data-act="auth-mode"][data-arg="forgot"]'); await pg.fill('#auEmail', EMAIL); await pg.click('#authSheet button[type=submit]'); await pg.wait_for_selector('#auCode')
        await pg.fill('#auCode', await code_for(pg, EMAIL)); await pg.fill('#auPw', 'brand new pass 777'); await pg.click('#authSheet button[type=submit]')
        for _ in range(120):
            if await pg.evaluate('signedIn()'): break
            await pg.wait_for_timeout(100)
        rec('Forgot password: code + new password signs in', await pg.evaluate('signedIn()'), str(await pg.evaluate('[authMode,authErr,authBusy]')) + str(await pg.evaluate("document.querySelector('#authSheet')?document.querySelector('#authSheet').innerText:'no sheet'")))
        sw = await pg.evaluate('document.documentElement.scrollWidth<=innerWidth')
        rec('No sideways scrolling', sw)
        rec('No JavaScript or security-policy errors', not errs, errs[:3])
        await b.close()
    print(f'{sum(R)}/{len(R)} passed'); sys.exit(0 if all(R) else 1)
asyncio.run(main())
