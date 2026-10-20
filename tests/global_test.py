# Global statements and currencies: US, UK, euro, African formats, structured files, display. Run: python tests/global_test.py http://127.0.0.1:8899
import asyncio, sys
from playwright.async_api import async_playwright
URL = sys.argv[1].rstrip('/')
R = []
def rec(n, ok, d=''):
    R.append(bool(ok)); print(('PASS ' if ok else 'FAIL ') + n + ('' if ok else f' {d}'))

US = """Date,Description,Amount,Running Bal.
01/05/2026,STARBUCKS STORE 1234,-5.75,2494.25
01/13/2026,WHOLE FOODS MARKET,-84.10,2410.15
01/15/2026,DIRECT DEP ACME CORP PAYROLL,2500.00,4910.15
01/18/2026,NETFLIX.COM,-15.49,4894.66
01/22/2026,UBER TRIP,-23.40,4871.26
01/27/2026,CHASE CREDIT CRD AUTOPAY,-300.00,4571.26
""" + "Statement in USD\n"
UK = """Date,Description,Paid out,Paid in,Balance
13/01/2026,TESCO STORES 3021,£42.18,,1957.82
15/01/2026,SALARY ACME LTD,,£2400.00,4357.82
19/01/2026,TFL TRAVEL CH,£6.60,,4351.22
21/01/2026,BRITISH GAS DIRECT DEBIT,£88.00,,4263.22
27/01/2026,AMAZON.CO.UK,£19.99,,4243.23
"""
DE = """Buchungstag;Verwendungszweck;Betrag;Saldo
13.01.2026;REWE MARKT GMBH;-84,10;2.415,90
15.01.2026;GEHALT ACME GMBH;2.500,00;4.915,90
19.01.2026;MIETE JANUAR;-1.234,56;3.681,34
21.01.2026;DEUTSCHE BAHN;-49,90;3.631,44
27.01.2026;AMAZON EU SARL;-19,99;3.611,45
Konto DE89370400440532013000 EUR
"""
FR = "Date;Libellé;Débit;Crédit;Solde\n" + "\n".join([
    "13/01/2026;CARTE CARREFOUR;84,10;;2 415,90 EUR",
    "15/01/2026;VIREMENT SALAIRE ACME;;2 500,00;4 915,90 EUR",
    "19/01/2026;LOYER JANVIER;1 234,56;;3 681,34 EUR",
    "21/01/2026;SNCF;49,90;;3 631,44 EUR"]) + "\n"
ZA = """Date,Description,Amount,Balance
2026-01-05,WOOLWORTHS SANDTON,-612.40,24387.60
2026-01-13,SALARY ACME PTY,28500.00,52887.60
2026-01-18,ESKOM PREPAID,-500.00,52387.60
2026-01-22,UBER SA,-89.00,52298.60
ZAR statement
"""
KE = """Date,Details,Withdrawn,Paid In,Balance
05-Jan-2026,SAFARICOM AIRTIME,KES 500.00,,19500.00
13-Jan-2026,NAIVAS SUPERMARKET,"KES 3,250.00",,16250.00
15-Jan-2026,SALARY ACME LTD,,"KES 85,000.00",101250.00
22-Jan-2026,KPLC TOKEN,"KES 2,000.00",,99250.00
"""
CARD = """Transaction Date,Description,Amount
01/05/2026,STARBUCKS,5.75
01/13/2026,WHOLE FOODS,84.10
01/16/2026,PAYMENT THANK YOU,-300.00
01/18/2026,NETFLIX,15.49
01/22/2026,REFUND AMAZON,-23.40
USD
"""
OFX = """OFXHEADER:100
<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS><CURDEF>USD<BANKTRANLIST>
<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20260105120000<TRNAMT>-5.75<NAME>STARBUCKS<MEMO>STORE 1234</STMTTRN>
<STMTTRN><TRNTYPE>CREDIT<DTPOSTED>20260115120000<TRNAMT>2500.00<NAME>ACME PAYROLL</STMTTRN>
<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20260118120000<TRNAMT>-15.49<NAME>NETFLIX</STMTTRN>
</BANKTRANLIST></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>"""
QIF = """!Type:Bank
D01/13/2026
T-84.10
PWHOLE FOODS
^
D01/15/2026
T2,500.00
PACME PAYROLL
^
D01/27/2026
T-23.40
PUBER
^
"""
MT = """:20:STATEMENT
:25:DE89370400440532013000
:60F:C260101EUR2500,00
:61:2601130113D84,10NTRFNONREF
:86:REWE MARKT GMBH
:61:2601150115C2500,00NTRFNONREF
:86:GEHALT ACME GMBH
:61:2601190119D1234,56NTRFNONREF
:86:MIETE JANUAR
:62F:C260131EUR2681,34
"""
CAMT = """<?xml version="1.0"?><Document xmlns="urn:iso:std:camt.053.001.02"><BkToCstmrStmt><Stmt>
<Ntry><Amt Ccy="EUR">84.10</Amt><CdtDbtInd>DBIT</CdtDbtInd><BookgDt><Dt>2026-01-13</Dt></BookgDt><NtryDtls><TxDtls><RltdPties><Cdtr><Nm>REWE</Nm></Cdtr></RltdPties></TxDtls></NtryDtls></Ntry>
<Ntry><Amt Ccy="EUR">2500.00</Amt><CdtDbtInd>CRDT</CdtDbtInd><BookgDt><Dt>2026-01-15</Dt></BookgDt><AddtlNtryInf>GEHALT</AddtlNtryInf></Ntry>
<Ntry><Amt Ccy="EUR">49.90</Amt><CdtDbtInd>DBIT</CdtDbtInd><BookgDt><Dt>2026-01-21</Dt></BookgDt><AddtlNtryInf>BAHN</AddtlNtryInf></Ntry>
</Stmt></BkToCstmrStmt></Document>"""
NG = """Date,Description,Debit,Credit,Balance
13/09/2026,POS PURCHASE SHOPRITE,18500.00,,142300.00
15/09/2026,SALARY CREDIT ACME,,350000.00,492300.00
19/09/2026,NIP TRANSFER TO ADA,25000.00,,467300.00
"""

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args=['--no-sandbox'])
        pg = await (await b.new_context(viewport={'width': 390, 'height': 800}, locale='en-NG')).new_page()
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: ('Content Security Policy' in m.text or 'Refused' in m.text) and errs.append(m.text))
        await pg.goto(URL + '/'); await pg.wait_for_timeout(800)
        await pg.evaluate("S.consent.read=true;S.consent.store=true;save()")
        parse = lambda t: pg.evaluate("t=>{const r=parseStatement(textToRows(t),'text');return {cur:r.cur,t:r.txns}}", t)
        async def get(t): return await parse(t)

        r = await get(US)
        rec('US statement: USD, 6 rows', r['cur'] == 'USD' and len(r['t']) == 6, r)
        rec('US dates are month first (01/13/2026 is 13 Jan)', any(x['date'] == '2026-01-13' for x in r['t']))
        rec('US payroll is income, purchases are spending', all((x['amt'] > 0) == ('PAYROLL' in x['desc']) for x in r['t']))
        r = await get(UK)
        rec('UK statement: GBP, paid in / paid out columns', r['cur'] == 'GBP' and len(r['t']) == 5 and sum(1 for x in r['t'] if x['amt'] > 0) == 1, r)
        rec('UK dates are day first', any(x['date'] == '2026-01-13' for x in r['t']))
        r = await get(DE)
        rec('German statement: EUR, comma decimals', r['cur'] == 'EUR' and len(r['t']) == 5, r)
        rec('German 1.234,56 reads as 1234.56', any(abs(x['amt'] + 1234.56) < 0.001 for x in r['t']), r['t'])
        rec('German dd.mm.yyyy dates', any(x['date'] == '2026-01-19' for x in r['t']))
        r = await get(FR)
        rec('French statement: EUR, spaces as thousands, Débit/Crédit', r['cur'] == 'EUR' and len(r['t']) == 4 and any(abs(x['amt'] - 2500) < 0.001 for x in r['t']) and any(abs(x['amt'] + 1234.56) < 0.001 for x in r['t']), r)
        r = await get(ZA)
        rec('South African statement: ZAR, ISO dates', r['cur'] == 'ZAR' and len(r['t']) == 4 and any(abs(x['amt'] - 28500) < 0.001 for x in r['t']), r)
        r = await get(KE)
        rec('Kenyan statement: KES with 05-Jan-2026 dates and KES prefixes', r['cur'] == 'KES' and len(r['t']) == 4 and any(x['date'] == '2026-01-05' for x in r['t']) and any(abs(x['amt'] - 85000) < 0.001 for x in r['t']) and any(abs(x['amt'] + 3250) < 0.001 for x in r['t']), r)
        r = await get(CARD)
        rec('Card statement with positive purchases is flipped (payments are credits)', r['cur'] == 'USD' and any(x['amt'] < 0 and 'STARBUCKS' in x['desc'] for x in r['t']) and any(x['amt'] > 0 and 'PAYMENT' in x['desc'] for x in r['t']), r)
        r = await get(NG)
        rec('Nigerian statement still works and is NGN', r['cur'] == 'NGN' and len(r['t']) == 3 and any(abs(x['amt'] - 350000) < 0.001 for x in r['t']), r)

        s = lambda t: pg.evaluate("t=>{const r=parseStructured(t,'USD');return r?{cur:r.cur,t:r.txns,m:r.method}:null}", t)
        r = await s(OFX)
        rec('OFX file: USD, 3 rows, signs from TRNAMT', r and r['m'] == 'ofx' and r['cur'] == 'USD' and len(r['t']) == 3 and r['t'][0]['amt'] == -5.75 and r['t'][1]['amt'] == 2500, r)
        r = await s(QIF)
        rec('QIF file: 3 rows, thousands separator, month-first dates', r and r['m'] == 'qif' and len(r['t']) == 3 and r['t'][1]['amt'] == 2500 and r['t'][0]['date'] == '2026-01-13', r)
        r = await s(MT)
        rec('MT940 file: EUR, debit and credit, narrative', r and r['cur'] == 'EUR' and len(r['t']) == 3 and r['t'][0]['amt'] == -84.10 and r['t'][1]['amt'] == 2500 and 'GEHALT' in r['t'][1]['desc'], r)
        r = await s(CAMT)
        rec('CAMT.053 file: EUR, DBIT/CRDT', r and r['cur'] == 'EUR' and len(r['t']) == 3 and r['t'][0]['amt'] == -84.10 and r['t'][1]['amt'] == 2500, r)
        rec('Plain CSV is not mistaken for a structured file', await pg.evaluate("parseStructured(arguments_[0]||'a,b\\n1,2')===null") if False else await pg.evaluate("parseStructured('a,b\\n1,2')") is None)

        f = lambda e: pg.evaluate(e)
        rec('USD shows with $ and cents', await f("moneyD(12.5,'USD')") == '$12.50' and await f("money(-1234.5,'USD')") == '-$1,235')
        rec('EUR and GBP symbols', await f("money(1234,'EUR')") == '€1,234' and await f("money(99,'GBP')") == '£99')
        rec('Zero-decimal currencies have no cents; code-style symbols get a space', await f("moneyD(1234,'UGX')") == 'USh 1,234' and await f("money(500,'KES')") == 'KSh 500')
        rec('Naira still shows with the naira sign', await f("money(18500,'NGN')") == '₦18,500')
        rec('Plan price is always shown in naira', await f("priceTxt()") == '₦9,000')
        rec('Thresholds scale to the currency (₦2,000 is about a dollar and a bit)', await f("setCur('USD');const x=localScale(2000);setCur('NGN');x") <= 2 and await f("localScale(2000)") == 2000)
        rec('Currency detection falls back to the hint', await f("detectCurrency('no money words here','ZAR')") == 'ZAR')
        rec('Currency is detected from an IBAN country', await f("detectCurrency('Account FR7630006000011234567890189','NGN')") == 'EUR')

        # ---- end to end through the app ----
        await pg.evaluate("tab='statements';render()")
        await pg.set_input_files('#fileIn', {'name': 'chase.csv', 'mimeType': 'text/csv', 'buffer': US.encode()})
        for _ in range(40):
            if await pg.evaluate('S.statements.length') >= 1: break
            await pg.wait_for_timeout(250)
        rec('Uploading a US statement sets the active currency to USD', await pg.evaluate('S.cur') == 'USD' and await pg.evaluate("S.txns.every(t=>t.cur==='USD')"))
        await pg.evaluate("tab='home';render()"); await pg.wait_for_timeout(1500)
        txt = await pg.inner_text('#view')
        rec('The home screen shows dollars and no naira signs', '$' in txt and '₦' not in txt, txt[:300])
        sub = await pg.evaluate("coachContext(getA())")
        rec('Coach summary states the currency and uses $', 'US dollar (USD' in sub and '$' in sub and '₦' not in sub, sub[:300])
        rules = await pg.evaluate("coachRules(getA())")
        rec('Coach rules name the currency and say not to convert', 'US dollar' in rules and 'Do not convert' in rules and 'Nigeria' not in rules)
        # second statement in another currency
        await pg.evaluate("document.querySelectorAll('.celebrate').forEach(e=>e.remove());tab='statements';render()")
        await pg.set_input_files('#fileIn', {'name': 'gtb.csv', 'mimeType': 'text/csv', 'buffer': NG.encode()})
        for _ in range(40):
            if await pg.evaluate('S.statements.length') >= 2: break
            await pg.wait_for_timeout(250)
        rec('A second statement in naira is kept separately', await pg.evaluate('S.cur') == 'NGN' and await pg.evaluate("S.txns.filter(t=>t.cur==='USD').length") == 6)
        await pg.evaluate("tab='statements';render()")
        rec('Currency chips appear when there is more than one currency', await pg.locator('[data-act="set-cur"]').count() == 2)
        await pg.click('[data-act="set-cur"][data-arg="USD"]')
        rec('Switching currency shows only that currency', await pg.evaluate('S.cur') == 'USD' and await pg.evaluate('getTxns().length') == 6)
        await pg.evaluate("document.querySelector('[data-change=\"stmt-cur\"]').value='EUR';document.querySelector('[data-change=\"stmt-cur\"]').dispatchEvent(new Event('change',{bubbles:true}))")
        await pg.wait_for_timeout(300)
        rec('A wrongly detected currency can be changed per statement', await pg.evaluate("S.statements.some(s=>s.cur==='EUR')") and await pg.evaluate('S.cur') == 'EUR')
        # old data without currency is treated as naira
        await pg.evaluate("localStorage.setItem('ledger_v3_test',1)")
        rec('Sample (demo) data stays naira', await pg.evaluate("S.demo=true;setCur(activeCur());const m=money(5000);S.demo=false;m") == '₦5,000')
        acc = await pg.get_attribute('#fileIn', 'accept')
        rec('Upload dialog accepts OFX, QIF and MT940 files', all(x in acc for x in ['.ofx', '.qif', '.sta']))
        rec('No JavaScript or security-policy errors', not errs, errs[:3])
        await b.close()
    print(f'{sum(R)}/{len(R)} passed'); sys.exit(0 if all(R) else 1)
asyncio.run(main())
