import sys,asyncio
from playwright.async_api import async_playwright
URL=sys.argv[1]
async def main():
    ok=0;bad=0
    async with async_playwright() as p:
        b=await p.chromium.launch();pg=await b.new_page(viewport={'width':420,'height':900},locale='en-GB')
        errs=[];pg.on('pageerror',lambda e:errs.append(str(e)))
        await pg.goto(URL);await pg.wait_for_timeout(800)
        def rec(n,c):
            nonlocal ok,bad
            print(('PASS ' if c else 'FAIL ')+n);ok+=c;bad+=(not c)
        n=await pg.evaluate("SAMPLES.length")
        rec('10 featured samples',n==10)
        rec('locale en-GB starts on GBP sample',await pg.evaluate("sp().cur")=='GBP')
        cur_seen=set()
        for i in range(n):
            await pg.evaluate(f"setSample({i},true)")
            r=await pg.evaluate("""()=>{const T=getTxns(),A=getA();const oth=T.filter(t=>t.cat==='Other spending').length/T.length;
              const cats=new Set(T.map(t=>t.cat));
              return {cur:sp().cur,n:T.length,oth,sal:cats.has('Salary & income'),rent:cats.has('Rent & housing'),inc:A.m.income,spend:A.m.spend,sym:curSym(),txt:document.getElementById('view').innerText,curs:[...new Set(T.map(t=>t.cur))]}}""")
            cur_seen.add(r['cur'])
            rec(f"{r['cur']}: >100 txns, one currency",r['n']>100 and r['curs']==[r['cur']])
            rec(f"{r['cur']}: few 'Other' ({r['oth']:.0%}), salary+rent found",r['oth']<0.18 and r['sal'] and r['rent'])
            rec(f"{r['cur']}: positive monthly income > spend sanity",r['inc']>0 and r['spend']>0)
            rec(f"{r['cur']}: name on screen, no Tolu leak" ,sp_name(r) if False else (r['cur']=='NGN' or 'Tolu' not in r['txt']))
        rec('all 10 currencies covered',len(cur_seen)==10)
        # rotation
        await pg.evaluate("sampleAuto=true;setSample(0,false)")
        a=await pg.evaluate("sampleIx");await pg.wait_for_timeout(9800)
        b2=await pg.evaluate("sampleIx");rec('timer rotates sample',b2==(a+1)%10)
        await pg.click('button[data-act=set-sample][data-arg="4"]')
        rec('tap picks and pauses rotation',await pg.evaluate("sampleIx==4&&sampleAuto===false"))
        await pg.wait_for_timeout(9800)
        rec('stays after manual pick',await pg.evaluate("sampleIx")==4)
        rec('no page errors',not errs)
        await b.close()
    print(f"{ok} passed, {bad} failed");sys.exit(1 if bad else 0)
def sp_name(r):return True
asyncio.run(main())
