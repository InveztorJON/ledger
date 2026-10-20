import sys,asyncio
from playwright.async_api import async_playwright
URL=sys.argv[1]
CSV="Date,Description,Debit,Credit,Balance\n2026-09-01,\"<img src=x onerror=window.__pwn=1>SALARY\",,300000,300000\n2026-09-02,\"<script>window.__pwn=2</script>POS SHOPRITE\",20000,,280000\n2026-09-03,\"\"\"><svg onload=window.__pwn=3>\",5000,,275000\n"
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch();pg=await b.new_page(viewport={'width':1200,'height':900})
        errs=[];pg.on('pageerror',lambda e:errs.append(str(e)))
        await pg.goto(URL);await pg.wait_for_timeout(600)
        await pg.evaluate("S.consent={read:true,store:true,ai:true,at:null};save&&save()")
        await pg.set_input_files('input[type=file]',files=[{'name':'bad.csv','mimeType':'text/csv','buffer':CSV.encode()}]);await pg.wait_for_timeout(1500)
        for tab in ['home','statements','grow','coach','me']:
            await pg.evaluate(f"tab='{tab}';render()");await pg.wait_for_timeout(200)
        pwn=await pg.evaluate("window.__pwn||0")
        inj=await pg.evaluate("document.querySelectorAll('img[src=x],svg[onload],#view script').length")
        has=await pg.evaluate("S.txns.length")
        print('txns',has,'pwn',pwn,'injected nodes',inj,'errors',errs[:2])
        ok=pwn==0 and inj==0 and has>0
        print('PASS' if ok else 'FAIL');await b.close();sys.exit(0 if ok else 1)
asyncio.run(main())
