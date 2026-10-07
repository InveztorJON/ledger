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
        rec('New user starts with 2 free uploads', await pg.evaluate('freeLeft()') == 2)
        await pg.evaluate("tab='statements';render()")
        rec('Statements panel shows the free trial', '2 of 2' in await pg.inner_text('.planline'))
        for k in range(2):
            await pg.set_input_files('#fileIn', statement(k))
            await until(pg, f'S.statements.length==={k + 1}', 5000)
        rec('2 statements upload during the trial', await pg.evaluate('S.statements.length') == 2 and await pg.evaluate('P.used') == 2)
        await pg.evaluate("tab='statements';render()")
        rec('After 2, the panel says free uploads are used', 'Free uploads used' in await pg.inner_text('.planline'))
        await pg.evaluate("document.querySelectorAll('.celebrate').forEach(e=>e.remove())")
        await pg.click('.drop')
        await pg.wait_for_selector('#planSheet')
        t = await pg.inner_text('#planSheet')
        rec('3rd upload opens the subscription sheet', "used your 2 free statement uploads" in t and '₦10,000' in t, t[:200])
                # sneaking a file in directly is still blocked
        await pg.evaluate('closeSheet()')
        await pg.set_input_files('#fileIn', statement(6))
        await pg.wait_for_timeout(500)
        rec('A 3rd file is not read without a subscription', await pg.evaluate('S.statements.length') == 2)
        rec('Existing data stays viewable', await pg.evaluate('S.txns.length') > 30)

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
        rec('Pay step shows JONSPIRE LIMITED, UBA, 1029821937, ₦10,000 and the reference code',
            'JONSPIRE LIMITED' in t and 'UBA' in t and '1029821937' in t and '₦10,000' in t and code and code in t, t)
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
        await pg.set_input_files('#fileIn', statement(3))
        await until(pg, 'S.statements.length===3', 5000)
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
        rec('WhatsApp reminder has the date, price, account and code', href and '1029821937' in href and code in href and '%E2%82%A610%2C000' in href, href)
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
        # --- monthly allowance: 80% warning, then 20 of 20 ---
        await pg.evaluate("closeSheet();document.querySelectorAll('.celebrate').forEach(e=>e.remove())")
        await pg.goto(f'{URL}/__setEnd?id={code}&days=20'); await pg.goto(URL + '/'); await pg.wait_for_timeout(1200)
        await pg.evaluate("refreshPlan()"); await until(pg, 'planActive()', 5000)
        rec('Paid month counts uploads on the server (1 of 20 so far)', await pg.evaluate('P.sub.usage&&P.sub.usage.used') == 1, await pg.evaluate('JSON.stringify(P.sub.usage)'))
        await pg.evaluate("(async()=>{for(let i=0;i<13;i++)await subApi('use',{id:P.id,token:P.token});takeSub(await subApi('status',{id:P.id,token:P.token}));render();})()")
        await until(pg, 'monthUsed()===14', 5000)
        await pg.evaluate("tab='me';render()")
        rec('Plan card shows a usage meter', '14 of 20' in await pg.inner_text('#plan'))
        await pg.evaluate("tab='statements';render()")
        rec('Statements panel shows uploads used this month', '14 of 20' in await pg.inner_text('.planline'))
        await pg.evaluate("(async()=>{await subApi('use',{id:P.id,token:P.token});takeSub(await subApi('status',{id:P.id,token:P.token}));})()")
        await until(pg, 'monthUsed()===15', 5000)
        rec('No warning at 15 of 20', not await pg.evaluate("monthWarn()"))
        await ctx.set_offline(True)
        await pg.set_input_files('#fileIn', statement(4))
        await until(pg, 'S.statements.length===4', 5000)
        rec('An upload made offline is remembered and counted at once', await pg.evaluate('P.pendingUse') == 1 and await pg.evaluate('monthUsed()') == 16)
        await ctx.set_offline(False)
        await pg.evaluate("dispatchEvent(new Event('online'))")
        await until(pg, '(P.pendingUse||0)===0&&P.sub.usage.used===16', 8000)
        rec('Back online, the server count catches up (16 of 20)', True)
        await until(pg, 'monthUsed()===16', 5000)
        await pg.wait_for_selector('#planSheet', timeout=5000)
        t = await pg.inner_text('#planSheet')
        rec('At 16 of 20 (80%) a renew-or-cancel prompt opens', '16 of 20 uploads used' in t and 'Renew for' in t and 'Cancel renewal' in t, t[:300])
        await pg.evaluate("closeSheet();tab='home';render()")
        rec('Home shows the 80% banner with Renew and Cancel', await pg.locator('.banner:has-text("16 of 20 uploads used")').count() == 1)
        rec('Uploads still allowed at 16', await pg.evaluate('canUpload()'))
        await pg.evaluate("(async()=>{for(let i=0;i<3;i++)await subApi('use',{id:P.id,token:P.token});takeSub(await subApi('status',{id:P.id,token:P.token}));})()")
        await until(pg, 'monthUsed()===19', 5000)
        await pg.evaluate("document.querySelectorAll('.celebrate').forEach(e=>e.remove());closeSheet()")
        await pg.evaluate("tab='statements';render()")
        await pg.set_input_files('#fileIn', statement(5))
        await until(pg, 'S.statements.length===5', 5000)
        await until(pg, 'monthFull()', 5000)
        await pg.wait_for_selector('#planSheet', timeout=5000)
        t = await pg.inner_text('#planSheet')
        rec('At 20 of 20 the sheet says all uploads are used', 'used all 20 uploads' in t and 'Renew for' in t, t[:300])
        await pg.evaluate("closeSheet();document.querySelectorAll('.celebrate').forEach(e=>e.remove())")
        rec('Uploads are locked at 20 of 20', not await pg.evaluate('canUpload()'))
        await pg.evaluate("tab='statements';render()")
        await pg.set_input_files('#fileIn', statement(7))
        await pg.wait_for_timeout(600)
        rec('A 21st statement is not read', await pg.evaluate('S.statements.length') == 5)
        rec('The full-month sheet opens when trying to upload', await pg.locator('#planSheet').count() == 1)
        await pg.evaluate("openPlan('full');planView='pay';openPlan()")
        rec('Renew screen says the new month starts straight away', 'as soon as your payment is verified' in await pg.inner_text('#planSheet') and '₦10,000' in await pg.inner_text('#planSheet'))
        await pg.evaluate("closeSheet()")
        # --- free-trial count survives clearing local storage only ---
        ctx3 = await b.new_context(viewport={'width': 360, 'height': 780})
        await ctx3.route('**/*', route)
        await ctx3.add_cookies([{'name': 'ledger_trial', 'value': '2', 'url': URL + '/'}])
        p3 = await ctx3.new_page()
        await p3.goto(URL + '/'); await p3.wait_for_timeout(600)
        rec('A fresh browser profile that still has the trial cookie gets no new free uploads', await p3.evaluate('freeLeft()') == 0)
        await ctx3.close()
        rec('The trial cookie is first-party, SameSite=Strict', any(c['name'] == 'ledger_trial' and c['sameSite'] == 'Strict' for c in await ctx.cookies()))
        rec('Wipe keeps the subscription', await pg.evaluate("ACT.wipe();!!P.id&&P.used===2"))
        rec('No JavaScript or security-policy errors', not errs, errs[:3])
        await b.close()
    print(f'{sum(R)}/{len(R)} passed')
    sys.exit(0 if all(R) else 1)

asyncio.run(main())
