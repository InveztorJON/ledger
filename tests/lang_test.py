import sys
from playwright.sync_api import sync_playwright
U=sys.argv[1].rstrip('/');ok=0;n=0
def chk(name,c):
    global ok,n;n+=1;ok+=bool(c);print(('PASS ' if c else 'FAIL ')+name)
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/opt/pw-browsers/chromium');pg=b.new_page();errs=[]
    pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto(U+'/');pg.wait_for_selector('#tabs .tab')
    pg.click('#tabs [data-arg=me]')
    pg.click('[data-act=set-lang][data-arg=fr]')
    chk('tabs translate to French','Accueil' in pg.inner_text('#tabs'))
    chk('html lang set',pg.evaluate('document.documentElement.lang')=='fr')
    chk('CSV button present',pg.locator('[data-act=export-csv]').count()==1)
    pg.click('[data-act=set-lang][data-arg=sw]')
    chk('Swahili tabs','Nyumbani' in pg.inner_text('#tabs'))
    pg.click('[data-act=set-lang][data-arg=en]')
    chk('back to English','Home' in pg.inner_text('#tabs'))
    chk('no JS errors',not errs)
    b.close()
print(f'{ok}/{n} passed');sys.exit(0 if ok==n else 1)
