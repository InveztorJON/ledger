# End-to-end test of the free trial, payment, verification, renewal reminder and restore flows.
# Run: node tests/serve.mjs site 8899 &  then  python tests/plus_test.py http://127.0.0.1:8899
import asyncio, base64, struct, sys, zlib
from playwright.async_api import async_playwright
URL = sys.argv[1].rstrip('/')
CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
SHOTS = sys.argv[2] if len(sys.argv) > 2 else None
R = []
def rec(n, ok, d=''):
    R.append(bool(ok)); print(('PASS ' if ok else 'FAIL ') + n + ('' if ok else f' {d}'))

def statement(k):
    rows = ['Date,Description,Debit,Credit,Balance']
    bal = 500000
    for d in range(1, 21):
        amt = 1000 * (k + 1) + d * 37
        bal -= amt
        rows.append(f'{d:02d}/0{(k % 8) + 1}/2026,POS PURCHASE SHOP {k}-{d},{amt}.00,,{bal}.00')
    rows.append(f'25/0{(k % 8) + 1}/2026,SALARY CREDIT {k},,350000.00,{bal + 350000}.00')
    return {'name': f'statement-{k}.csv', 'mimeType': 'text/csv', 'buffer': '\n'.join(rows).encode()}

def png():
    w, h = 40, 30
    raw = b''.join(b'\x00' + b'\xff\x88\x22' * w for _ in range(h))
    def chunk(t, d): return struct.pack('>I', len(d)) + t + d + struct.pack('>I', zlib.crc32(t + d) & 0xffffffff)
    return b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 2, 0, 0, 0)) + chunk(b'IDAT', zlib.compress(raw)) + chunk(b'IEND', b'')

async def until(pg, expr, timeout=5000):
    # wait_for_function needs eval, which Ledger's security policy blocks, so poll instead
    for _ in range(timeout // 100):
        if await pg.evaluate(expr): return True
        await pg.wait_for_timeout(100)
    raise AssertionError('timed out waiting for ' + expr)

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROME)
        async def route(r):
            return await (r.continue_() if r.request.url.startswith('http://127.0.0.1') else r.abort())
        ctx = await b.new_context(viewport={'width': 360, 'height': 780}, is_mobile=True, has_touch=True)
        await ctx.route('**/*', route)
        pg = await ctx.new_page()
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: ('Content Security Policy' in m.text or 'Refused' in m.text) and errs.append(m.text))
        await pg.goto(URL + '/'); await pg.wait_for_timeout(800)
        await pg.evaluate("S.consent.read=true;S.consent.store=true;save()")

        # --- free trial ---
        rec('New user starts with 5 free uploads', await pg.evaluate('freeLeft()') == 5)
        await pg.evaluate("tab='statements';render()")
        rec('Statements panel shows the free trial', '5 of 5' in await pg.inner_text('.planline'))
        for k in range(5):
            await pg.set_input_files('#fileIn', statement(k))
            await until(pg, f'S.statements.length==={k + 1}', 5000)
        rec('5 statements upload during the trial', await pg.evaluate('S.statements.length') == 5 and await pg.evaluate('P.used') == 5)
        await pg.evaluate("tab='statements';render()")
        rec('After 5, the panel says free uploads are used', 'Free uploads used' in await pg.inner_text('.planline'))
        await pg.evaluate("document.querySelectorAll('.celebrate').forEach(e=>e.remove())")
        await pg.click('.drop')
        await pg.wait_for_selector('#planSheet')
        t = await pg.inner_text('#planSheet')
        rec('6th upload opens the subscription sheet', "used your 5 free statement uploads" in t and '₦1,500' in t, t[:200])
                # sneaking a file in directly is still blocked
        await pg.evaluate('closeSheet()')
        await pg.set_input_files('#fileIn', statement(6))
        await pg.wait_for_timeout(500)
        rec('A 6th file is not read without a subscription', await pg.evaluate('S.statements.length') == 5)
        rec('Existing data stays viewable', await pg.evaluate('S.txns.length') > 50)

        # --- details → pay ---
        await pg.evaluate("openPlan('limit')")
        await pg.click('#planSheet button[type=submit]')
        await pg.wait_for_timeout(200)
        rec('Needs the agreement tick', 'agree' in (await pg.inner_text('#planSheet')).lower() and await pg.evaluate('!P.id'))
        await pg.fill('#plName', 'Ada Obi'); await pg.fill('#plPhone', '0803 123 4567'); await pg.check('#plAgree')
        await pg.click('#planSheet button[type=submit]')
        await pg.wait_for_selector('#planSheet .paybox', timeout=5000)
        t = await pg.inner_text('#planSheet')
        code = await pg.evaluate('P.id')
        rec('Pay step shows JONSPIRE LIMITED, UBA, 1029821937, ₦1,500 and the reference code',
            'JONSPIRE LIMITED' in t and 'UBA' in t and '1029821937' in t and '₦1,500' in t and code and code in t, t)
        if SHOTS: await pg.screenshot(path=f'{SHOTS}/pay.png', full_page=False)
        rec('Token saved on the device, not shown', bool(await pg.evaluate('P.token')) and (await pg.evaluate('P.token')) not in t)

        # --- proof upload ---
        await pg.set_input_files('#proofIn', {'name': 'receipt.png', 'mimeType': 'image/png', 'buffer': png()})
        await pg.wait_for_selector('#planSheet:has-text("verifying your payment")', timeout=8000)
        rec('Proof uploads and shows "verifying"', True)
        if SHOTS: await pg.screenshot(path=f'{SHOTS}/pending.png')
        rec('Still locked while pending', await pg.evaluate('canUpload()') is False)

        # --- admin ---
        ad = await ctx.new_page()
        ad.on('pageerror', lambda e: errs.append('admin: ' + str(e)))
        await ad.goto(URL + '/admin.html')
        await ad.fill('#pw', 'wrong-password-x'); await ad.click('#login button')
        await ad.wait_for_selector('.status.err', timeout=5000)
        rec('Admin rejects a wrong password', 'Wrong admin password' in await ad.inner_text('#root'))
        await ad.fill('#pw', 'test-admin-key-123'); await ad.click('#login button')
        await ad.wait_for_selector('.sub', timeout=5000)
        t = await ad.inner_text('#root')
        rec('Admin lists the payment under "Needs review"', 'Needs review (1)' in t and 'Ada Obi' in t and code in t, t[:300])
        await ad.wait_for_selector('.thumb img', timeout=5000)
        rec('Admin sees the receipt image', True)
        await ad.click('[data-act="check"]')
        await ad.wait_for_selector('.status:has-text("AI check")', timeout=5000)
        rec('AI check reads the receipt and says the details match', 'details match' in await ad.inner_text('.sub'))
        await ad.click('[data-act="confirm"]')
        rec('Approve asks to confirm the money is in the UBA account first', 'open your UBA account' in await ad.inner_text('.sub'))
        if SHOTS: await ad.screenshot(path=f'{SHOTS}/admin.png', full_page=True)
        await ad.click('[data-act="approve"]')
        await until(ad, "document.querySelector('#root').innerText.includes('Needs review (0)')", 5000)
        await ad.click('[data-act="filter"][data-arg="active"]')
        rec('Approved person shows as active with a WhatsApp confirmation link', 'Active · ' in await ad.inner_text('#root') and await ad.locator('a[href^="https://wa.me/2348031234567"]').count() >= 1)

        # --- user unlocks ---
        await pg.click('[data-act="plan-refresh"]')
        await pg.wait_for_selector('.celebrate:has-text("Ledger Plus is active")', timeout=5000)
        rec('User sees "Ledger Plus is active" once approved', True)
        await pg.click('.celebrate button')
        end = await pg.evaluate('P.sub.end')
        days = await pg.evaluate('planDaysLeft()')
        rec('Active for one month from approval', 28 <= days <= 31, days)
        await pg.evaluate('closeSheet()')
        await pg.set_input_files('#fileIn', statement(6))
        await until(pg, 'S.statements.length===6', 5000)
        rec('Uploads work again after approval', True)
        rec('No renewal banner at the start of the month', await pg.evaluate("tab='home';render();[...document.querySelectorAll('.banner')].some(b=>b.innerText.includes('ends in'))") is False)

        # --- 3 days before the end ---
        await pg.goto(f'{URL}/__setEnd?id={code}&days=2.6'); await pg.goto(URL + '/'); await pg.wait_for_timeout(1200)
        await pg.evaluate("tab='home';render()")
        bn = pg.locator('.banner:has-text("Ledger Plus ends in")')
        rec('3 days before the end, Home shows "Renew or cancel"', await bn.count() == 1 and '3 days' in await bn.inner_text())
        if SHOTS: await pg.screenshot(path=f'{SHOTS}/reminder.png')
        await ad.goto(URL + '/admin.html'); await ad.wait_for_selector('.filters')
        rec('Admin lists them under "Ending in 3 days" with a WhatsApp reminder', 'Ending in 3 days (1)' in await ad.inner_text('#root'))
        await ad.click('[data-act="filter"][data-arg="expiring"]')
        href = await ad.get_attribute('a:has-text("renewal reminder")', 'href')
        rec('WhatsApp reminder has the date, price, account and code', href and '1029821937' in href and code in href and '%E2%82%A61%2C500' in href, href)
        await bn.locator('[data-act="plan-cancel-open"]').click()
        await pg.click('#planSheet [data-act="plan-cancel"]')
        await until(pg, 'P.sub.cancelAtEnd===true', 5000)
        await pg.evaluate("closeSheet();tab='home';render()")
        rec('Cancel stops the reminder and keeps access to the end', await pg.locator('.banner:has-text("Ledger Plus ends in")').count() == 0 and await pg.evaluate('canUpload()'))
        await pg.evaluate("openPlan('')")
        await pg.click('#planSheet [data-act="plan-resume"]')
        await until(pg, 'P.sub.cancelAtEnd===false', 5000)
        await pg.evaluate("closeSheet();tab='home';render()")
        rec('"Keep my subscription" brings the reminder back', await pg.locator('.banner:has-text("Ledger Plus ends in")').count() == 1)

        # --- renewal (early) ---
        await pg.click('.banner [data-act="plan-renew"]')
        t = await pg.inner_text('#planSheet')
        rec('Renew shows the bank details and keeps remaining days', '1029821937' in t and "don't lose any days" in t)
        await pg.set_input_files('#proofIn', {'name': 'r2.png', 'mimeType': 'image/png', 'buffer': png()})
        await pg.wait_for_selector('#planSheet:has-text("verifying your payment")', timeout=8000)
        old_end = await pg.evaluate('P.sub.end')
        await ad.goto(URL + '/admin.html'); await ad.wait_for_selector('.sub')
        await ad.click('[data-act="confirm"]'); await ad.click('[data-act="approve"]')
        await until(ad, "document.querySelector('#root').innerText.includes('Needs review (0)')", 5000)
        await pg.click('[data-act="plan-refresh"]'); await pg.wait_for_timeout(800)
        new_end = await pg.evaluate('P.sub.end')
        rec('Early renewal adds a month on top of the remaining days', new_end > old_end and 32 <= await pg.evaluate('planDaysLeft()') <= 35, (old_end, new_end))
        await pg.evaluate('closeSheet()')

        # --- expiry ---
        await pg.goto(f'{URL}/__setEnd?id={code}&days=-1'); await pg.goto(URL + '/'); await pg.wait_for_timeout(1200)
        await pg.evaluate("tab='home';render()")
        rec('After the end, Home says it ended and uploads lock again', await pg.locator('.banner:has-text("Ledger Plus ended")').count() == 1 and await pg.evaluate('canUpload()') is False)

        # --- restore on another phone ---
        ctx2 = await b.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True)
        await ctx2.route('**/*', route)
        p2 = await ctx2.new_page()
        await p2.goto(URL + '/'); await p2.wait_for_timeout(600)
        await p2.evaluate("tab='me';render()")
        await p2.click('[data-act="plan-restore-open"]')
        await p2.fill('#rsId', code.lower().replace('-', '')); await p2.fill('#rsPhone', '+2348031234567')
        await p2.click('#planSheet button[type=submit]')
        await until(p2, '!!P.id', 5000)
        rec('Restore on another phone links the subscription', await p2.evaluate('P.id') == code)

        # --- layout / errors ---
        await pg.evaluate("openPlan('limit');planView='pay';openPlan()")
        sw = await pg.evaluate('document.documentElement.scrollWidth<=innerWidth')
        rec('No sideways scrolling at 360px with the plan sheet open', sw)
        await pg.evaluate("closeSheet();tab='me';render()")
        rec('Me tab shows the plan card', await pg.locator('#plan').count() == 1)
        rec('Wipe keeps the subscription', await pg.evaluate("ACT.wipe();!!P.id&&P.used===5"))
        rec('No JavaScript or security-policy errors', not errs, errs[:3])
        await b.close()
    print(f'{sum(R)}/{len(R)} passed')
    sys.exit(0 if all(R) else 1)

asyncio.run(main())
