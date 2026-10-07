# Excel (.xlsx) statement reading, using the self-hosted SheetJS. Run: python tests/xlsx_test.py http://127.0.0.1:8899
import asyncio, io, sys
from playwright.async_api import async_playwright
import openpyxl
URL = sys.argv[1].rstrip('/')
R = []
def rec(n, ok, d=''):
    R.append(bool(ok)); print(('PASS ' if ok else 'FAIL ') + n + ('' if ok else f' {d}'))
def book():
    wb = openpyxl.Workbook(); ws = wb.active; ws.title = 'Statement'
    ws.append(['Account Statement'])
    ws.append(['Date', 'Description', 'Debit', 'Credit', 'Balance'])
    bal = 400000
    for d in range(1, 16):
        amt = 1500 + d * 211; bal -= amt
        ws.append([f'{d:02d}/09/2026', f'POS PURCHASE SHOPRITE {d}', amt, None, bal])
    ws.append(['25/09/2026', 'SALARY CREDIT ACME', None, 350000, bal + 350000])
    out = io.BytesIO(); wb.save(out); return out.getvalue()
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args=['--no-sandbox'])
        pg = await (await b.new_context(viewport={'width': 390, 'height': 800})).new_page()
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: ('Content Security Policy' in m.text or 'Refused' in m.text) and errs.append(m.text))
        reqs = []
        pg.on('request', lambda r: reqs.append(r.url))
        await pg.goto(URL + '/'); await pg.wait_for_timeout(800)
        await pg.evaluate("S.consent.read=true;S.consent.store=true;save()")
        await pg.evaluate("tab='statements';render()")
        await pg.set_input_files('#fileIn', {'name': 'gtb.xlsx', 'mimeType': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'buffer': book()})
        for _ in range(60):
            if await pg.evaluate('S.statements.length') >= 1: break
            await pg.wait_for_timeout(250)
        n = await pg.evaluate('S.txns.length')
        rec('An .xlsx statement is read', await pg.evaluate('S.statements.length') == 1 and n == 16, n)
        rec('Kind is recorded as xlsx', await pg.evaluate("S.statements[0].kind") == 'xlsx')
        rec('Salary credit is seen as income', await pg.evaluate("S.txns.some(t=>t.amt>0&&/salary/i.test(t.desc))"))
        rec('The Excel reader came from this site, not another host', any(u.endswith('/vendor/xlsx.full.min.js') for u in reqs) and not any('cdnjs' in u for u in reqs))
        rec('No JavaScript or security-policy errors', not errs, errs[:3])
        await b.close()
    print(f'{sum(R)}/{len(R)} passed'); sys.exit(0 if all(R) else 1)
asyncio.run(main())
