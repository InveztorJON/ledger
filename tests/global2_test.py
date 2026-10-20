# More countries/formats for statement reading. Run: python tests/global2_test.py http://127.0.0.1:8899
import asyncio, sys
from playwright.async_api import async_playwright
URL = sys.argv[1].rstrip('/')
R = []
def rec(n, ok, d=''):
    R.append(bool(ok)); print(('PASS ' if ok else 'FAIL ') + n + ('' if ok else f' {d}'))
ES = "Fecha;Concepto;Importe;Saldo\n" + "\n".join(["13/01/2026;COMPRA MERCADONA;-84,10;2.415,90","15/01/2026;NOMINA ACME SL;2.500,00;4.915,90","19/01/2026;ALQUILER ENERO;-1.234,56;3.681,34","21/01/2026;RECIBO IBERDROLA;-49,90;3.631,44","27/01/2026;TRANSFERENCIA RECIBIDA;100,00;3.731,44","IBAN ES9121000418450200051332"]) + "\n"
PT = "Data;Descrição;Débito;Crédito;Saldo\n" + "\n".join(["13/01/2026;COMPRA CONTINENTE;84,10;;2.415,90","15/01/2026;SALARIO ACME LDA;;2.500,00;4.915,90","19/01/2026;RENDA JANEIRO;1.234,56;;3.681,34","21/01/2026;CP COMBOIOS;49,90;;3.631,44","IBAN PT50000201231234567890154"]) + "\n"
IT = "Data;Descrizione;Importo;Saldo\n" + "\n".join(["13/01/2026;PAGAMENTO COOP;-84,10;2.415,90","15/01/2026;STIPENDIO ACME SRL;2.500,00;4.915,90","19/01/2026;AFFITTO GENNAIO;-1.234,56;3.681,34","IBAN IT60X0542811101000000123456"]) + "\n"
NL = "Datum;Omschrijving;Bedrag;Saldo\n" + "\n".join(["13-01-2026;ALBERT HEIJN 1234;-84,10;2415,90","15-01-2026;SALARIS ACME BV;2500,00;4915,90","19-01-2026;HUUR JANUARI;-1234,56;3681,34","21-01-2026;NS REIZEN;-49,90;3631,44","IBAN NL91ABNA0417164300"]) + "\n"
CH = "Datum,Beschreibung,Betrag,Saldo\n" + "\n".join(["13.01.2026,COOP,-84.10,\"2'415.90\"","15.01.2026,LOHN ACME AG,\"2'500.00\",\"4'915.90\"","19.01.2026,MIETE,-1234.56,\"3'681.34\"","CHF statement"]) + "\n"
EG = "Date,Description,Debit,Credit,Balance\n" + "\n".join(["13/01/2026,CARREFOUR MAADI,1250.50,,48749.50","15/01/2026,SALARY ACME EGYPT,,30000.00,78749.50","19/01/2026,VODAFONE EGYPT,200.00,,78549.50","EGP"]) + "\n"
GH = "Date,Narration,Debit,Credit,Balance\n" + "\n".join(["13/01/2026,MTN MOMO TRANSFER,GHS 250.00,,4750.00","15/01/2026,SALARY ACME GH,,GHS 6000.00,10750.00","19/01/2026,ECG PREPAID,GHS 120.00,,10630.00","GCB Bank"]) + "\n"
MA = "Date;Libellé;Débit;Crédit;Solde\n" + "\n".join(["13/01/2026;CARREFOUR CASABLANCA;840,10;;24159,90","15/01/2026;VIREMENT SALAIRE;;15000,00;39159,90","19/01/2026;LOYER;5000,00;;34159,90","MAD"]) + "\n"
TZ = "Date,Details,Amount,Balance\n" + "\n".join(["13-Jan-2026,VODACOM M-PESA,\"-25,000\",\"475,000\"","15-Jan-2026,SALARY ACME TZ,\"1,500,000\",\"1,975,000\"","19-Jan-2026,TANESCO LUKU,\"-50,000\",\"1,925,000\"","TZS"]) + "\n"
UG = "Date,Description,Debit,Credit,Balance\n" + "\n".join(["13/01/2026,MTN MOBILE MONEY,25000,,475000","15/01/2026,SALARY ACME UG,,1500000,1975000","19/01/2026,UMEME,50000,,1925000","UGX"]) + "\n"
XOF = "Date;Libellé;Débit;Crédit;Solde\n" + "\n".join(["13/01/2026;ORANGE MONEY;25 000;;475 000","15/01/2026;SALAIRE ACME SN;;1 500 000;1 975 000","19/01/2026;SENELEC;50 000;;1 925 000","XOF"]) + "\n"
AU = "Date,Description,Amount\n" + "\n".join(["13/01/2026,WOOLWORTHS,-84.10","15/01/2026,SALARY ACME PTY,3500.00","19/01/2026,RENT,-1200.00","A$ AUD"]) + "\n"
PDFLIKE = "Statement of Account  01 Jan 2026 - 31 Jan 2026   Currency: GBP\n13 Jan 2026  TESCO STORES 3021   42.18   1,957.82\n15 Jan 2026  SALARY ACME LTD   2,400.00   4,357.82\n19 Jan 2026  TFL TRAVEL CH   6.60   4,351.22\n21 Jan 2026  BRITISH GAS DIRECT DEBIT   88.00   4,263.22\n"
FRDATE = "Date;Libellé;Montant;Solde\n13 janv. 2026;CARTE LECLERC;-84,10;2415,90\n15 janv. 2026;VIREMENT SALAIRE;2500,00;4915,90\n19 févr. 2026;LOYER;-900,00;3000,00\nEUR\n"
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args=['--no-sandbox'])
        pg = await (await b.new_context(viewport={'width': 390, 'height': 800}, locale='en-GB')).new_page()
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(URL + '/'); await pg.wait_for_timeout(800)
        P = lambda t, k='text': pg.evaluate("([t,k])=>{const r=parseStatement(textToRows(t),k);return {cur:r.cur,t:r.txns}}", [t, k])
        has = lambda r, amt, date=None: any(abs(x['amt'] - amt) < 0.005 and (date is None or x['date'] == date) for x in r['t'])
        r = await P(ES); rec('Spanish (EUR, Importe, Nómina)', r['cur'] == 'EUR' and len(r['t']) == 5 and has(r, -1234.56, '2026-01-19') and has(r, 2500), r)
        r = await P(PT); rec('Portuguese (EUR, Débito/Crédito)', r['cur'] == 'EUR' and len(r['t']) == 4 and has(r, -1234.56) and has(r, 2500), r)
        r = await P(IT); rec('Italian (EUR, Importo)', r['cur'] == 'EUR' and len(r['t']) == 3 and has(r, -84.10) and has(r, 2500), r)
        r = await P(NL); rec('Dutch (EUR, dd-mm-yyyy)', r['cur'] == 'EUR' and len(r['t']) == 4 and has(r, -1234.56, '2026-01-19'), r)
        r = await P(CH); rec('Swiss (CHF, apostrophe thousands)', r['cur'] == 'CHF' and len(r['t']) == 3 and has(r, 2500) and has(r, -1234.56), r)
        r = await P(EG); rec('Egyptian (EGP)', r['cur'] == 'EGP' and len(r['t']) == 3 and has(r, -1250.50) and has(r, 30000), r)
        r = await P(GH); rec('Ghanaian (GHS with prefixes)', r['cur'] == 'GHS' and len(r['t']) == 3 and has(r, -250) and has(r, 6000), r)
        r = await P(MA); rec('Moroccan (MAD, French headers)', r['cur'] == 'MAD' and len(r['t']) == 3 and has(r, -840.10) and has(r, 15000), r)
        r = await P(TZ); rec('Tanzanian (TZS, no decimals)', r['cur'] == 'TZS' and len(r['t']) == 3 and has(r, -25000) and has(r, 1500000), r)
        r = await P(UG); rec('Ugandan (UGX, whole shillings)', r['cur'] == 'UGX' and len(r['t']) == 3 and has(r, -25000) and has(r, 1500000), r)
        r = await P(XOF); rec('West African CFA (XOF, space thousands)', r['cur'] == 'XOF' and len(r['t']) == 3 and has(r, -25000) and has(r, 1500000), r)
        r = await P(AU); rec('Australian (AUD)', r['cur'] == 'AUD' and len(r['t']) == 3 and has(r, -84.10), r)
        r = await P(PDFLIKE, 'pdf'); rec('PDF-style lines with 01 Jan 2026 dates and a Currency: GBP header', r['cur'] == 'GBP' and len(r['t']) == 4 and has(r, -42.18, '2026-01-13') and has(r, 2400, '2026-01-15'), r)
        r = await P(FRDATE); rec('French month names (janv., févr.)', r['cur'] == 'EUR' and any(x['date'] == '2026-01-13' for x in r['t']) and any(x['date'] == '2026-02-19' for x in r['t']), r)
        a = await pg.evaluate("[monthNum('Janvier'),monthNum('févr.'),monthNum('März'),monthNum('Dezember'),monthNum('agosto'),monthNum('Mar'),monthNum('xyz')]")
        rec('Month names in several languages', a == [1, 2, 3, 12, 8, 3, None], a)
        rec('No JavaScript errors', not errs, errs[:3])
        await b.close()
    print(f'{sum(R)}/{len(R)} passed'); sys.exit(0 if all(R) else 1)
asyncio.run(main())
