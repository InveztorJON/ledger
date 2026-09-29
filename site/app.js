/* ===== Ledger settings: edit before launch ===== */
window.LEDGER_CONTACT_EMAIL = 'jonspirelimited@gmail.com';   // e.g. 'hello@yourdomain.com' — shown in the app for questions and feedback
/* ================================================= */
'use strict';
/* ================= utilities ================= */
const $=(s,r=document)=>r.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const naira=n=>(n<0?'-':'')+'₦'+Math.round(Math.abs(n)).toLocaleString('en-NG');
const nairaK=n=>{const a=Math.abs(n);const s=a>=1e6?(a/1e6).toFixed(a>=1e7?0:1).replace(/\.0$/,'')+'m':a>=1e4?Math.round(a/1e3)+'k':Math.round(a).toLocaleString('en-NG');return (n<0?'-':'')+'₦'+s;};
const pct=x=>Math.round(x*100)+'%';
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const MON_SHORT=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function todayISO(){const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
const isoDate=iso=>new Date(iso+'T00:00:00Z');
function addDays(iso,n){const d=isoDate(iso);d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);}
const daysBetween=(a,b)=>Math.round((isoDate(b)-isoDate(a))/864e5);
const dow=iso=>isoDate(iso).getUTCDay();
const fmtD=iso=>{const [y,m,d]=iso.split('-');return +d+' '+MON_SHORT[+m-1];};
const fmtDY=iso=>fmtD(iso)+' '+iso.slice(0,4);
function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
const reduceMotion=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;

const I={
  home:'<path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10v10h13V10"/>',
  doc:'<path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5"/><path d="M10 13h6M10 17h6"/>',
  grow:'<path d="M12 21v-9"/><path d="M12 12c0-4 3-7 8-7 0 5-3 7-8 7z"/><path d="M12 14c0-3-2.5-5.5-7-5.5 0 4 2.5 5.5 7 5.5z"/>',
  chat:'<path d="M4 5h16v11H9l-5 4z"/>',
  me:'<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/>',
  flame:'<path d="M12 3c1 3 5 5 5 10a5 5 0 0 1-10 0c0-2 1-3.5 2-4.5 0 2 1 3 2 3 0-3-1-5 1-8.5z"/>',
  lock:'<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  upload:'<path d="M12 16V4"/><path d="M7 9l5-5 5 5"/><path d="M5 20h14"/>',
  star:'<path d="M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6 6.6 19.5l1.2-6L3.3 9.3l6.1-.7z"/>',
  check:'<path d="M5 12.5l4.5 4.5L19 7"/>',
  x:'<path d="M6 6l12 12M18 6 6 18"/>',
  book:'<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 19V5"/>',
  bolt:'<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
  sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  drop:'<path d="M12 3s-6.5 7.5-6.5 12a6.5 6.5 0 0 0 13 0C18.5 10.5 12 3 12 3z"/>',
  pillar:'<path d="M3 9h18L12 3z"/><path d="M6 9v11M10 9v11M14 9v11M18 9v11M3 20h18"/>',
  cash:'<rect x="3" y="6" width="18" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/>',
  dice:'<rect x="4" y="4" width="16" height="16" rx="3"/><circle cx="9" cy="9" r="1"/><circle cx="15" cy="15" r="1"/><circle cx="15" cy="9" r="1"/><circle cx="9" cy="15" r="1"/>',
  bricks:'<rect x="3" y="14" width="8" height="6"/><rect x="13" y="14" width="8" height="6"/><rect x="8" y="7" width="8" height="6"/>',
  juggle:'<circle cx="6" cy="15" r="3"/><circle cx="18" cy="15" r="3"/><circle cx="12" cy="6" r="3"/>',
  scale:'<path d="M12 4v16M7 20h10M5 7h14"/><path d="M5 7l-3 6h6zM19 7l-3 6h6z"/>'
};
const ic=(n,cls='')=>`<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${I[n]}</svg>`;

/* ================= state & storage ================= */
const KEY='ledger_v3';
function freshState(){return{v:3,demo:true,consent:{read:false,store:false,ai:false,at:null},statements:[],txns:[],quiz:null,xp:0,badges:[],checkins:{},challenges:{active:[],done:[],ended:[]},lessons:{},tags:0,tagXP:{d:'',n:0},scoreHist:{},coachDays:{},tab:'home'};}
function load(){try{const s=JSON.parse(localStorage.getItem(KEY)||'null');if(s&&s.v===3)return Object.assign(freshState(),s);}catch(e){}return freshState();}
let S=load();
try{localStorage.removeItem('ledger_state');}catch(e){}
function save(){try{const c=JSON.parse(JSON.stringify(S));if(!S.consent.store){c.txns=[];c.statements=[];}localStorage.setItem(KEY,JSON.stringify(c));}catch(e){}}
let tab=S.tab||'home';
let dataVer=0, revealNext=false, U={}, pasteOpen=false, pasteDraft='', pendingFile=null;
const IN_VIEWER=!!window.claude;
const COACH_API='/api/coach';
const CONTACT_EMAIL=String(window.LEDGER_CONTACT_EMAIL||'');
let installEvt=null;
let chat=[], chatBusy=false, liveText='', chatCtl=null, chatDraft='', sampleFn=null, sampleState='pending';
let ciDraft={};

/* ================= categories ================= */
const CATS=[
 {c:'Rent & housing',t:'need'},{c:'Bills & power',t:'need'},{c:'Airtime & data',t:'need'},{c:'Transport',t:'need'},{c:'Groceries',t:'need'},{c:'Health',t:'need'},{c:'Education',t:'need'},
 {c:'Food & eating out',t:'want'},{c:'Shopping',t:'want'},{c:'Subscriptions',t:'want'},{c:'Fun & outings',t:'want'},{c:'Betting',t:'want'},{c:'Other spending',t:'want'},
 {c:'Loan repayments',t:'debt'},{c:'Savings & investing',t:'saving'},{c:'Bank fees & levies',t:'fee'},
 {c:'Transfers to people',t:'transfer'},{c:'Family & friends',t:'giving'},{c:'Giving & tithes',t:'giving'},{c:'Cash withdrawals',t:'cash'}
];
const CREDIT_CATS=[{c:'Salary & income',t:'income'},{c:'Transfers in',t:'income'},{c:'Refunds',t:'refund'},{c:'Betting',t:'want'},{c:'Savings & investing',t:'saving'}];
const typeOf=(cat,credit)=>((credit?CREDIT_CATS:CATS).find(x=>x.c===cat)||{t:credit?'income':'want'}).t;
const BETS='bet9ja|sportybet|betking|nairabet|1xbet|merrybet|msport|bangbet|betway|parimatch|betano|\\bbet\\b|betting|lotto|lottery|baba ijebu';
const DR=[
 ['Bills & power',/service charge|estate due/],
 ['Bank fees & levies',/sms ?alert|sms charge|sms notif|alert charge|stamp duty|\bemtl\b|money transfer levy|maint(enance)? fee|card maint|\bcot\b|commission on turnover|\bvat\b|nip charge|trf charge|transfer charge|transfer fee|charge ?\+ ?vat|bank charge|\bcharges?\b|\bfee\b|\blevy\b/],
 ['Savings & investing',/saving|autosave|target sav|fixed deposit|piggyvest|cowrywise|risevest|bamboo|trove|chaka|\binvest|safelock|\bvault\b|\bsave\b/],
 ['Betting',new RegExp(BETS)],
 ['Subscriptions',/netflix|spotify|showmax|apple\.com|itunes|icloud|youtube|google ?\*|google play|prime video|amazon prime|audiomack|boomplay|canva|chatgpt|openai|subscription|\bdstv\b|\bgotv\b|startimes/],
 ['Loan repayments',/\bloan|repayment|\brepay\b|fairmoney|palmcredit|\bcarbon\b|okash|renmoney|quickcheck|aella|easemoni|credit card/],
 ['Bills & power',/ikedc|ekedc|aedc|phed|kedco|eedc|ibedc|\bbedc|\bjed\b|electricity|\belectric\b|prepaid|\btoken\b|\bnepa\b|water bill|lawma|waste|spectranet|\bsmile\b|ipnx|fib(re|er)|starlink|internet|broadband/],
 ['Airtime & data',/airtime|data bundle|\bdata\b|recharge|\bvtu\b|\bmtn\b|\bglo\b|airtel|9mobile|etisalat/],
 ['Transport',/\buber\b|\bbolt\b|taxify|indrive|\brida\b|gokada|lagride|\bbrt\b|cowry|\bfuel\b|petrol|filling station|total ?energies|\bmobil\b|conoil|oando|\bnnpc\b|ardova|\bfare\b|transport|parking|\btoll\b/],
 ['Groceries',/shoprite|\bspar\b|ebeano|justrite|market square|supermarket|supermart|grocer|foodco|hubmart|\bmart\b|\bmarket\b/],
 ['Food & eating out',/chowdeck|glovo|jumia food|heyfood|chicken republic|\bkfc\b|domino|pizza|cold ?stone|mr ?biggs|sweet sensation|tantalizers|the place|kilimanjaro|bukka|\bbuka\b|restaurant|eatery|\bcafe|kitchen|grill|suya|shawarma|\bfood|burger|\bchops\b/],
 ['Fun & outings',/cinema|filmhouse|genesis|lounge|\bclub\b|\bbar\b|hotel|\bevent|ticket|arcade|\bspa\b|salon|barb/],
 ['Shopping',/jumia|konga|temu|aliexpress|shein|amazon|\bmall\b|fashion|boutique|\bstores?\b|clothing|\bwears?\b|\bslot\b|pointek|electronics/],
 ['Health',/pharmac|hospital|clinic|medplus|\bhmo\b|health|\blab\b|diagnost|dental|optical/],
 ['Education',/school|tuition|university|college|\bwaec\b|\bjamb\b|\bneco\b|course|udemy|coursera|\bexam|academy/],
 ['Giving & tithes',/tithe|offering|church|chapel|mosque|zakat|donation|charity|ministry/],
 ['Rent & housing',/\brent\b|landlord|house rent|apartment|caution fee|agency fee/],
 ['Cash withdrawals',/\batm\b|cash wd|cash withdrawal|\bwdl\b|withdrawal|cash out/],
 ['Transfers to people',/trf to|transfer to|\bnip\b|\btrf\b|transfer|\bto\b/]
];
const CR=[
 ['Salary & income',/salary|\bsal\b|payroll|wages|stipend|allowance|bonus|dividend|interest/],
 ['Betting',new RegExp(BETS)],
 ['Savings & investing',/saving|piggyvest|cowrywise|risevest|bamboo|trove|safelock|\bvault\b|target sav|\binvest|autosave/],
 ['Refunds',/reversal|\brvsl\b|refund|reversed|chargeback|cashback/]
];
function categorize(desc,credit){const d=desc.toLowerCase();for(const [c,rx] of (credit?CR:DR))if(rx.test(d))return c;return credit?'Transfers in':'Other spending';}
function merchantKey(desc){
  let d=' '+desc.toUpperCase()+' ';
  d=d.replace(/[^A-Z0-9&' ]/g,' ');
  d=d.replace(/\b(POS|WEB|PURCHASE|PURCH|PAYMENT|PYMT|PMT|TRF|TRANSFER|NIP|CR|DR|FRM|FROM|TO|VIA|REF|NGA|NG|NGN|LAG|LAGOS|ABUJA|MOB|USSD|APP|ONLINE|DEBIT|CREDIT|CARD|TXN|TRX|ORDER|WALLET|FUNDING|AND|THE|COM|WWW|LTD|LIMITED|NIGERIA)\b/g,' ');
  d=d.replace(/\b\w*\d{3,}\w*\b/g,' ').replace(/\s+/g,' ').trim();
  const w=d.split(' ').filter(x=>x.length>1).slice(0,3).join(' ');
  return w?w.toLowerCase().replace(/\b[a-z]/g,c=>c.toUpperCase()):'Unknown';
}
let idSeq=0;
function enrich(t,src){const credit=t.amt>0;const cat=categorize(t.desc,credit);return{id:src+'-'+(idSeq++).toString(36)+Math.random().toString(36).slice(2,6),date:t.date,desc:t.desc,amt:Math.round(t.amt*100)/100,cat,type:typeOf(cat,credit),mk:merchantKey(t.desc),src,tagged:false};}

/* ================= sample statement (fictional) ================= */
function makeSample(){
  const rnd=mulberry32(20260925);
  const R=(a,b)=>Math.round((a+rnd()*(b-a))/50)*50;
  const out=[];let bal=300000;
  const add=(iso,desc,amt,optional)=>{if(optional&&amt<0&&bal+amt<5000)return;bal+=amt;out.push({date:iso,desc,amt,balance:Math.round(bal*100)/100});};
  for(let iso='2026-07-01';iso<='2026-09-27';iso=addDays(iso,1)){
    const d=+iso.slice(8),w=dow(iso),wkend=w===0||w===5||w===6,rush=d>=25||d<=1;
    if(d===25){add(iso,'NIP CR/SALARY/ACME LOGISTICS LTD',420000);add(iso,'ELECTRONIC MONEY TRANSFER LEVY',-50);}
    if(d===26){add(iso,'NIP TRF TO MRS ADUNNI BELLO/RENT',-85000);add(iso,'NIP TRF CHARGE + VAT',-26.88);add(iso,'NIP TRF TO IFEOMA OKAFOR/MUM UPKEEP',-30000);add(iso,'NIP TRF CHARGE + VAT',-26.88);add(iso,'TARGET SAVINGS AUTOSAVE',-20000);}
    if(d===27)add(iso,'WEB PURCHASE JUMIA NG',-R(10000,28000),true);
    if(d===28&&iso<'2026-09-01'){add(iso,'POS PURCHASE THE PLACE LEKKI',-R(9000,16000),true);add(iso,'SMS ALERT CHARGES',-R(300,450));add(iso,'CARD MAINTENANCE FEE',-50);}
    if(d===3)add(iso,'CASHLITE LOAN REPAYMENT',-25000);
    if(d===5)add(iso,'NETFLIX.COM',-7000);
    if(d===12)add(iso,'SPOTIFY',-1700);
    if(d===20)add(iso,'SHOWMAX',-3500);
    if(d===8)add(iso,'IKEDC PREPAID TOKEN',-R(15000,20000));
    if(d===7)add(iso,'TRF TO GRACE CHAPEL/TITHE',-10000);
    if(d===2||d===16)add(iso,'POS PURCHASE SHOPRITE LEKKI',-R(18000,32000));
    if(d===6)add(iso,'ATM WDL LEKKI PHASE 1',-20000,true);
    if(d===10){add(iso,'NIP TRF TO CHINEDU OKAFOR',-R(5000,15000),true);add(iso,'NIP TRF CHARGE + VAT',-10.75);}
    if(d===4||d===14||d===24)add(iso,'MTN DATA BUNDLE',-R(3000,5000));
    if(rnd()<0.12)add(iso,'AIRTIME PURCHASE MTN',-R(500,1000));
    const fp=(wkend?0.45:0.15)*(rush?1.9:1);
    if(rnd()<fp)add(iso,['CHOWDECK ORDER','GLOVO NG','POS PURCHASE CHICKEN REPUBLIC'][Math.floor(rnd()*3)],-R(2500,7000),true);
    if(!wkend&&rnd()<0.3)add(iso,rnd()<0.6?'BOLT RIDE':'UBER TRIP',-R(1800,6500),true);
    if(rnd()<0.15)add(iso,'POS PURCHASE BUKKA HUT',-R(800,1900),true);
    const bp=(wkend?0.32:0.05)*(rush?1.7:1);
    if(rnd()<bp)add(iso,'SPORTYBET WALLET FUNDING',-R(500,3000),true);
    if(wkend&&rnd()<0.12){const v=R(2500,12000);add(iso,'SPORTYBET WITHDRAWAL',v);if(v>=10000)add(iso,'ELECTRONIC MONEY TRANSFER LEVY',-50);}
  }
  return out;
}
let DEMO=null;
const demoTxns=()=>DEMO||(DEMO=makeSample().map(t=>enrich(t,'demo')));
const getTxns=()=>S.demo?demoTxns():S.txns;

/* ================= statement parsing (runs on this device) ================= */
const MONTHS={jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,sept:9,oct:10,nov:11,dec:12};
function mkISO(y,m,d){y=+y;if(y<100)y+=2000;m=+m;d=+d;if(!(m>=1&&m<=12&&d>=1&&d<=31&&y>=2000&&y<=2100))return null;const dt=new Date(Date.UTC(y,m-1,d));return dt.getUTCMonth()===m-1?dt.toISOString().slice(0,10):null;}
function findDates(s,dayFirst){
  const out=[];const push=(m,iso)=>{if(iso)out.push({iso,start:m.index,end:m.index+m[0].length});};
  for(const m of s.matchAll(/\b(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})(?:[T ]\d{1,2}:\d{2}(?::\d{2})?)?\b/g))push(m,mkISO(m[1],m[2],m[3]));
  for(const m of s.matchAll(/\b(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{4}|\d{2})\b/g))push(m,dayFirst?mkISO(m[3],m[2],m[1]):mkISO(m[3],m[1],m[2]));
  for(const m of s.matchAll(/\b(\d{1,2})(?:st|nd|rd|th)?[-\s\/.]*(jan|feb|mar|apr|may|jun|jul|aug|sept?|oct|nov|dec)[a-z]*\.?[-\s\/.,]*(\d{4}|\d{2})\b/gi))push(m,mkISO(m[3],MONTHS[m[2].toLowerCase()],m[1]));
  for(const m of s.matchAll(/\b(jan|feb|mar|apr|may|jun|jul|aug|sept?|oct|nov|dec)[a-z]*\.?\s+(\d{1,2}),?\s+(\d{4})\b/gi))push(m,mkISO(m[3],MONTHS[m[1].toLowerCase()],m[2]));
  out.sort((a,b)=>a.start-b.start||b.end-a.end);
  const res=[];for(const d of out){if(res.length&&d.start<res[res.length-1].end)continue;res.push(d);}return res;
}
function moneyCell(t){
  const s=t.trim();
  if(!s||/^[-–—]+$/.test(s))return{empty:true};
  const m=s.match(/^(\(?)\s*([-+]?)\s*(?:₦|NGN|N)?\s*([-+]?)\s*(\d[\d,]*)(\.\d{1,2})?\s*(\)?)\s*(CR|DR)?\.?$/i);
  if(!m)return null;
  const ip=m[4],dec=m[5]||'';
  if(ip.includes(',')&&!/^\d{1,3}(,\d{3})+$/.test(ip))return null;
  const digits=ip.replace(/,/g,'');
  const signed=m[1]==='('||!!m[2]||!!m[3]||!!m[7];
  if(!dec&&!ip.includes(',')&&digits.length>=9)return null;
  if(!dec&&!ip.includes(',')&&!signed&&digits.length===4&&+digits>=1990&&+digits<=2099)return null;
  const v=parseFloat(digits+dec);
  let sign=0;if(m[2]==='+'||m[3]==='+')sign=1;if(m[1]==='('||m[2]==='-'||m[3]==='-')sign=-1;if(m[7])sign=m[7].toUpperCase()==='DR'?-1:1;
  return{money:{v,sign},zero:v===0};
}
const MONEY_IN_TEXT=/(^|\s)(\(?[-+]?(?:₦|NGN)?\s?(?:\d{1,3}(?:,\d{3})+|\d+)\.\d{2}\)?(?:\s?(?:CR|DR)\b)?)(?=\s|$)/gi;
const NOISE=/page \d|\bof \d+\b|statement of account|account (no|number|name|type)|customer|generated|printed|www\.|http|e-?mail|phone|tel:|address|branch:|currency|period|dear |disclaimer|this statement|kindly|thank you/i;
const H={vdate:/value\s*date/i,balance:/balance|^bal\.?$/i,debit:/debit|withdrawal|money out|paid out|outflow|^dr$/i,credit:/credit|deposit|lodgement|money in|paid in|inflow|^cr$/i,amount:/^(amount|amount\s*\(?ngn\)?|transaction amount|amt)$/i,date:/date/i,desc:/narration|description|details|remarks|particulars|memo|narrative|beneficiary/i};
function detectHeader(cells){
  const idx={};
  cells.forEach((raw,i)=>{const t=raw.trim().toLowerCase();if(!t||t.length>40)return;
    for(const k of ['vdate','balance','debit','credit','amount','date','desc']){if(H[k].test(t)){if(idx[k]==null)idx[k]=i;return;}}});
  if(idx.date==null&&idx.vdate!=null)idx.date=idx.vdate;
  return idx.date!=null&&((idx.debit!=null&&idx.credit!=null)||idx.amount!=null)&&(idx.desc!=null||idx.balance!=null)?idx:null;
}
function rowToRec(cells,ctx){
  const amounts=[],parts=[];
  const text=cells.map(c=>c.t).join(' ');
  const dates=findDates(text,ctx.dayFirst);
  cells.forEach(c=>{
    let t=c.t;const cd=findDates(t,ctx.dayFirst);
    for(const d of cd.slice().reverse())t=t.slice(0,d.start)+' '+t.slice(d.end);
    if(/^(CR|DR)$/i.test(t.trim())&&amounts.length){const last=amounts[amounts.length-1];last.sign=t.trim().toUpperCase()==='DR'?-1:1;return;}
    const a=moneyCell(t);
    if(a&&a.empty)return;
    if(a&&a.money){amounts.push({...a.money,zero:a.zero,x:c.x0!=null?(c.x0+c.x1)/2:null});return;}
    t=t.replace(MONEY_IN_TEXT,(all,pre,tok)=>{const b=moneyCell(tok);if(b&&b.money){amounts.push({...b.money,zero:b.zero,x:null});return pre;}return all;});
    parts.push(t);
  });
  return{date:dates.length?dates[0].iso:null,desc:parts.join(' ').replace(/\s+/g,' ').trim(),amounts};
}
function mappedRec(cells,h,ctx){
  const get=i=>i!=null&&cells[i]?cells[i].t:'';
  const d1=findDates(get(h.date),ctx.dayFirst)[0]||findDates(cells.map(c=>c.t).join(' '),ctx.dayFirst)[0];
  const used=[h.date,h.vdate,h.debit,h.credit,h.amount,h.balance];
  const desc=h.desc!=null?get(h.desc):cells.filter((c,i)=>!used.includes(i)).map(c=>c.t).join(' ');
  const val=i=>{if(i==null)return null;const a=moneyCell(get(i));return a&&a.money?a.money:null;};
  const r={date:d1?d1.iso:null,desc:desc.replace(/\s+/g,' ').trim(),mapped:true,amt:null,sign:0,definite:false,balance:null};
  if(h.debit!=null&&h.credit!=null){const d=val(h.debit),c=val(h.credit);if(d&&d.v>0){r.amt=d.v;r.sign=-1;r.definite=true;}else if(c&&c.v>0){r.amt=c.v;r.sign=1;r.definite=true;}}
  else{const a=val(h.amount);if(a&&a.v>0){r.amt=a.v;r.sign=a.sign;r.definite=a.sign!==0;}}
  const b=val(h.balance);if(b)r.balance=b.v*(b.sign<0?-1:1);
  return r;
}
function colOf(a,cols){
  if(!cols||a.x==null)return null;
  let hit=cols.find(c=>a.x>=c.left-6&&a.x<c.right);
  if(!hit||!['debit','credit','amount','balance'].includes(hit.k)){let bd=1e9;hit=null;for(const c of cols){if(!['debit','credit','amount','balance'].includes(c.k))continue;const d=Math.abs(c.mid-a.x);if(d<bd){bd=d;hit=c;}}}
  return hit?hit.k:null;
}
function finalizeAmounts(r,cols){
  const A=r.amounts;r.amt=null;r.sign=0;r.definite=false;r.balance=null;r.colHint=0;
  if(!A.length)return;
  let pick;
  if(A.length>=2){
    const bal=A[A.length-1];r.balance=bal.v*(bal.sign<0?-1:1);
    const before=A.slice(0,-1);pick=[...before].reverse().find(a=>!a.zero);
    if(!pick)return;
    if(before.length>=2&&!pick.sign&&before.filter(a=>a!==pick).every(a=>a.zero))r.colHint=before.indexOf(pick)===before.length-2?-1:1;
  }else pick=A[0];
  r.amt=pick.v;r.sign=pick.sign;
  const k=colOf(pick,cols);if(k==='debit')r.colHint=-1;else if(k==='credit')r.colHint=1;
  r.definite=r.sign!==0;
}
function keywordSign(desc){
  const d=desc.toLowerCase();
  if(new RegExp('('+BETS+').*(withdraw|payout|winning)').test(d))return 1;
  if(/salary|\bsal\b|payroll|trf from|transfer from|\bfrm\b|\bfrom\b|inward|\bcr\b|credit|reversal|rvsl|refund|interest paid|deposit|lodg|received/.test(d))return 1;
  return -1;
}
function parseStatement(rows,kind){
  const sample=rows.slice(0,500).map(r=>r.map(c=>c.t).join(' ')).join('\n');
  let a12=false,b12=false;
  for(const m of sample.matchAll(/\b(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{2,4})\b/g)){if(+m[1]>12)a12=true;if(+m[2]>12)b12=true;}
  const ctx={dayFirst:!(b12&&!a12)};
  let hdr=null,hdrRow=-1;
  for(let i=0;i<Math.min(rows.length,80);i++){const h=detectHeader(rows[i].map(c=>c.t));if(h){hdr=h;hdrRow=i;break;}}
  let cols=null;
  if(hdr&&kind==='pdf'){
    const r=rows[hdrRow];const kOf={};for(const k in hdr)kOf[hdr[k]]=kOf[hdr[k]]||k;
    const sorted=r.map((c,i)=>({i,x0:c.x0,x1:c.x1})).filter(c=>c.x0!=null).sort((a,b)=>a.x0-b.x0);
    cols=sorted.map((c,j)=>({k:kOf[c.i]||'other',left:c.x0,right:j+1<sorted.length?sorted[j+1].x0:1e9,mid:(c.x0+c.x1)/2}));
  }
  const maxIdx=hdr?Math.max(...Object.values(hdr)):0;
  const recs=[];let lastDate=null,orphans=[];
  const lastRec=()=>{for(let k=recs.length-1;k>=0;k--)if(!recs[k].balOnly)return recs[k];return null;};
  for(let i=0;i<rows.length;i++){
    if(i===hdrRow)continue;
    const cells=rows[i];const joined=cells.map(c=>c.t).join(' ').replace(/\s+/g,' ').trim();if(!joined)continue;
    if(hdr&&detectHeader(cells.map(c=>c.t)))continue;
    const low=joined.toLowerCase();
    if(/opening balance|balance b\/?f|brought forward|previous balance|balance at (the )?(start|beginning)/.test(low)){
      const r=rowToRec(cells,ctx);const nz=r.amounts.filter(a=>!a.zero);
      if(nz.length){const b=nz[nz.length-1];recs.push({balOnly:true,balance:b.v*(b.sign<0?-1:1),date:r.date||lastDate});}
      continue;
    }
    if(/closing balance|total debit|total credit|total withdrawal|total lodgement|^total|available balance|ledger balance|cleared balance|uncleared|summary/.test(low))continue;
    let r;
    if(hdr&&kind!=='pdf'&&cells.length>maxIdx)r=mappedRec(cells,hdr,ctx);
    else{r=rowToRec(cells,ctx);finalizeAmounts(r,cols);}
    r.gy=cells.gy;
    const hasAmt=r.amt!=null&&r.amt>0;
    if(!r.date&&!hasAmt){
      if(!r.desc||r.desc.length>=90||NOISE.test(r.desc))continue;
      if((r.desc.match(/\b(date|trans|txn|posted|narration|description|debit|credit|balance|details|remarks|reference|value)\b/gi)||[]).length>=2)continue;
      if(r.gy!=null){orphans.push({t:r.desc,gy:r.gy});continue;}
      const prev=lastRec();if(prev&&prev.desc.length<170)prev.desc+=' '+r.desc;
      continue;
    }
    if(r.date)lastDate=r.date;else r.date=lastDate;
    if(!r.date||!hasAmt||(!r.desc&&!r.mapped&&r.amounts.length<2&&!rows[i].some(c=>findDates(c.t,ctx.dayFirst).length))){orphans=[];continue;}
    if(orphans.length){
      const prev=lastRec(),pre=[];
      for(const o of orphans){if(prev&&prev.gy!=null&&Math.abs(o.gy-prev.gy)<Math.abs(o.gy-r.gy))prev.desc+=' '+o.t;else pre.push(o.t);}
      if(pre.length)r.desc=(pre.join(' ')+' '+r.desc).trim();
      orphans=[];
    }
    recs.push(r);
  }
  if(orphans.length){const prev=lastRec();for(const o of orphans)if(prev&&prev.gy!=null&&Math.abs(o.gy-prev.gy)<20)prev.desc+=' '+o.t;}
  const dated=recs.filter(r=>!r.balOnly);
  if(!dated.length)return{txns:[],method:hdr?'columns':'pattern'};
  const asc=dated[0].date<=dated[dated.length-1].date;
  const hasNeg=dated.some(r=>r.sign===-1);
  for(let i=0;i<recs.length;i++){
    const r=recs[i];if(r.balOnly||r.definite)continue;
    let s=0;
    if(r.balance!=null){const n=recs[asc?i-1:i+1];if(n&&n.balance!=null){const delta=r.balance-n.balance;if(Math.abs(Math.abs(delta)-r.amt)<=Math.max(0.05,r.amt*0.002))s=delta>0?1:-1;}}
    if(!s&&r.colHint)s=r.colHint;
    if(!s&&hasNeg&&r.balance==null)s=1;
    if(!s)s=keywordSign(r.desc);
    r.sign=s;
  }
  const txns=dated.map(r=>({date:r.date,desc:(r.desc||'Transaction').replace(/^[\s\-|:\/]+|[\s\-|:\/]+$/g,'').slice(0,160)||'Transaction',amt:r.sign*r.amt}));
  return{txns,method:hdr?'columns':'pattern'};
}
function splitCSV(line,delim){const out=[];let cur='',q=false;for(let i=0;i<line.length;i++){const c=line[i];if(q){if(c==='"'){if(line[i+1]==='"'){cur+='"';i++;}else q=false;}else cur+=c;}else if(c==='"')q=true;else if(c===delim){out.push(cur);cur='';}else cur+=c;}out.push(cur);return out.map(s=>s.trim());}
function textToRows(text){
  const lines=text.replace(/\r/g,'').split('\n').filter(l=>l.trim());
  const head=lines.slice(0,40),n=head.length||1;
  const count=ch=>head.reduce((s,l)=>s+(l.split(ch).length-1),0);
  let delim=null;
  if(count('\t')>=n)delim='\t';else if(count(';')>=n&&count(';')>count(','))delim=';';else if(count('|')>=n)delim='|';
  else{const thousands=head.reduce((s,l)=>s+(l.replace(/"[^"]*"/g,'').match(/\d,\d{3}(?!\d)/g)||[]).length,0);if(count(',')-thousands>=n)delim=',';}
  return lines.map(l=>(delim?splitCSV(l,delim):l.split(/\s{2,}/)).map(t=>({t:t.trim(),x0:null,x1:null})));
}
const loaded={};
function loadScript(src){if(loaded[src])return loaded[src];return loaded[src]=new Promise((res,rej)=>{const s=document.createElement('script');s.src=src;s.onload=res;s.onerror=()=>{delete loaded[src];rej(new Error('load'));};document.head.appendChild(s);});}
const PDFJS=IN_VIEWER?'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/':'vendor/';
const XLSXJS='https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
async function pdfToRows(buf,password){
  await loadScript(PDFJS+'pdf.worker.min.js');await loadScript(PDFJS+'pdf.min.js');
  pdfjsLib.GlobalWorkerOptions.workerSrc=PDFJS+'pdf.worker.min.js';
  const pdf=await pdfjsLib.getDocument({data:new Uint8Array(buf.slice(0)),password,isEvalSupported:false,disableFontFace:true}).promise;
  const rows=[];
  for(let p=1;p<=pdf.numPages;p++){
    setU({busy:true,msg:`Reading page ${p} of ${pdf.numPages}…`});
    const page=await pdf.getPage(p);const tc=await page.getTextContent();
    const items=tc.items.filter(it=>it.str&&it.str.trim()).map(it=>({t:it.str,x:it.transform[4],y:it.transform[5],w:it.width||0,h:Math.abs(it.transform[3])||8}));
    items.sort((a,b)=>b.y-a.y||a.x-b.x);
    const lines=[];
    for(const it of items){let ln=null;for(let k=lines.length-1;k>=Math.max(0,lines.length-6);k--){if(Math.abs(lines[k].y-it.y)<=Math.max(2,it.h*0.35)){ln=lines[k];break;}}if(ln)ln.items.push(it);else lines.push({y:it.y,items:[it]});}
    const ph=(page.view&&page.view[3])||1000;
    for(const ln of lines){
      ln.items.sort((a,b)=>a.x-b.x);const cells=[];let cur=null;
      for(const it of ln.items){if(cur&&it.x-cur.x1<=Math.max(3,it.h*0.6)){cur.t+=(it.x-cur.x1>0.8?' ':'')+it.t;cur.x1=it.x+it.w;}else{cur={t:it.t,x0:it.x,x1:it.x+it.w};cells.push(cur);}}
      const row=cells.map(c=>({t:c.t.trim(),x0:c.x0,x1:c.x1}));row.gy=p*100000+(ph-ln.y);rows.push(row);
    }
    page.cleanup();
  }
  await pdf.destroy();return rows;
}
async function xlsxToRows(buf){
  await loadScript(XLSXJS);
  const wb=XLSX.read(new Uint8Array(buf),{type:'array',cellDates:true});let best=[];
  for(const n of wb.SheetNames){const r=XLSX.utils.sheet_to_json(wb.Sheets[n],{header:1,raw:false,dateNF:'yyyy-mm-dd',defval:''});if(r.length>best.length)best=r;}
  return best.map(r=>r.map(v=>({t:String(v??'').trim(),x0:null,x1:null})));
}

/* ================= analysis ================= */
let A_CACHE=null,A_KEY='';
function getA(){const T=getTxns();const k=(S.demo?'d':'u')+T.length+':'+dataVer;if(k!==A_KEY){A_CACHE=T.length?analyze(T):null;A_KEY=k;}return A_CACHE;}
function analyze(txns){
  const T=[...txns].sort((a,b)=>a.date<b.date?-1:a.date>b.date?1:0);
  const from=T[0].date,to=T[T.length-1].date,days=daysBetween(from,to)+1,months=Math.max(1,days/30.44);
  const cat={},type={need:0,want:0,debt:0,fee:0,saving:0,transfer:0,cash:0,giving:0};
  let income=0,refunds=0,betOut=0,betIn=0,betN=0,savIn=0,wkAll=0,wkEnd=0;const credits=[],merch={},tiny={n:0,sum:0},byMonth={},feeParts={sms:0,levy:0,transfer:0,maint:0,other:0};let biggest=null;
  for(const t of T){
    const mo=t.date.slice(0,7);byMonth[mo]=byMonth[mo]||{in:0,out:0,d:new Set()};byMonth[mo].d.add(t.date);
    if(t.amt<0){
      const a=-t.amt;cat[t.cat]=(cat[t.cat]||0)+a;type[t.type]=(type[t.type]||0)+a;
      if(t.cat==='Betting'){betOut+=a;betN++;}
      if(t.type!=='saving')byMonth[mo].out+=a;
      if(t.type==='want'){wkAll+=a;const w=dow(t.date);if(w===0||w===5||w===6)wkEnd+=a;}
      if(a<2000&&t.type!=='fee'){tiny.n++;tiny.sum+=a;}
      if(t.type==='fee'){const d=t.desc.toLowerCase();feeParts[/sms|alert/.test(d)?'sms':/levy|emtl|stamp/.test(d)?'levy':/nip|trf|transfer/.test(d)?'transfer':/maint/.test(d)?'maint':'other']+=a;}
      if(!['transfer','cash','fee','saving','giving'].includes(t.type)){const k=t.mk;merch[k]=merch[k]||{name:k,sum:0,n:0,cat:t.cat};merch[k].sum+=a;merch[k].n++;}
      if(t.type!=='saving'&&(!biggest||a>biggest.a))biggest={a,t};
    }else{
      const a=t.amt;credits.push(t);
      if(t.type==='income'){income+=a;byMonth[mo].in+=a;}
      else if(t.cat==='Betting')betIn+=a;
      else if(t.type==='saving')savIn+=a;
      else refunds+=a;
    }
  }
  const avgInc=income/months;
  let paydays=credits.filter(c=>c.cat==='Salary & income'&&c.amt>=0.3*avgInc);
  if(!paydays.length)paydays=credits.filter(c=>c.type==='income'&&c.amt>=0.4*avgInc);
  let incomeM=avgInc;
  if(paydays.length>=2){const pt=paydays.reduce((s,p)=>s+p.amt,0);incomeM=pt/paydays.length+(income-pt)/months;}
  const payDates=[...new Set(paydays.map(p=>p.date))].sort();
  let front=null,cycleBars=null,spent7=null;
  if(payDates.length){
    const bars=new Array(30).fill(0);let n=0,fr=0,tot=0,s7=0;
    payDates.forEach((pd,i)=>{
      const end=payDates[i+1]||addDays(to,1);if(daysBetween(pd,end)<20)return;n++;
      for(const t of T){if(t.amt>=0||t.date<pd||t.date>=end)continue;const d=daysBetween(pd,t.date),a=-t.amt;
        if(t.type==='want'){tot+=a;if(d<7)fr+=a;if(d<30)bars[d]+=a;}
        if(d<7&&t.type!=='saving')s7+=a;}
    });
    if(n&&tot>0){front=fr/tot;cycleBars=bars.map(b=>b/n);spent7=s7/n;}
  }
  const M=x=>x/months;
  const subsMap={};T.filter(t=>t.amt<0&&t.cat==='Subscriptions').forEach(t=>{subsMap[t.mk]=subsMap[t.mk]||{name:t.mk,sum:0,n:0};subsMap[t.mk].sum+=-t.amt;subsMap[t.mk].n++;});
  const subs=Object.values(subsMap).map(s=>({...s,m:M(s.sum)})).sort((a,b)=>b.m-a.m);
  const subsM=subs.reduce((s,x)=>s+x.m,0);
  const spendTotal=type.need+type.want+type.debt+type.fee+type.transfer+type.cash+type.giving;
  const spendM=M(spendTotal-refunds-betIn);
  const m={income:incomeM,spend:spendM,kept:incomeM-spendM,need:M(type.need),want:M(type.want),debt:M(type.debt),fees:M(type.fee),saving:M(type.saving-savIn),transfer:M(type.transfer),cash:M(type.cash),giving:M(type.giving),betOut:M(betOut),betIn:M(betIn),betNet:M(betOut-betIn),tiny:M(tiny.sum),tinyN:tiny.n/months,refunds:M(refunds)};
  const keptRate=incomeM>0?m.kept/incomeM:0;
  const lifestyle=Math.max(0,m.want-subsM-m.betOut-m.refunds);
  const leaks=m.fees+subsM+Math.max(0,m.betNet);
  const other=m.transfer+m.cash+m.giving+m.debt;
  const parts=[{k:'need',label:'Essentials',v:m.need},{k:'want',label:'Lifestyle',v:lifestyle},{k:'leak',label:'Leaks',v:leaks},{k:'other',label:'Transfers, cash & loans',v:other}];
  const per100=parts.map(p=>({...p,v:incomeM>0?p.v/incomeM*100:0}));
  const keptPer100=100-per100.reduce((s,p)=>s+p.v,0);
  const cats=Object.entries(cat).filter(([c])=>c!=='Savings & investing').map(([c,v])=>({cat:c,m:M(v),type:typeOf(c,false)})).sort((a,b)=>b.m-a.m);
  const merchants=Object.values(merch).map(x=>({...x,m:M(x.sum)})).sort((a,b)=>b.sum-a.sum).slice(0,6);
  const untagged=T.filter(t=>t.amt<0&&!t.tagged&&(t.cat==='Transfers to people'||t.cat==='Other spending')).length;
  const weekendShare=wkAll>0?wkEnd/wkAll:null;
  const A={from,to,days,months,count:T.length,m,keptRate,per100,keptPer100,cats,merchants,subs,subsM,front,cycleBars,spent7,weekendShare,tinyN:tiny.n,biggest,betN,feeParts,untagged,payDates,
    byMonth:Object.entries(byMonth).sort().map(([k,v])=>({k,in:v.in,out:v.out,partial:v.d.size<18||daysBetween(k+'-01',k===to.slice(0,7)?to:addDays(k+'-01',27))<25}))};
  A.traits=traitsOf(A);A.arch=archetypeOf(A);A.score=scoreOf(A);
  return A;
}
function traitsOf(A){
  const m=A.m,inc=Math.max(1,m.income),spend=Math.max(1,m.spend),T=[];
  if(A.front!=null&&A.front>=0.38)T.push({id:'sprinter',s:clamp((A.front-0.3)/0.4,0,1),ev:`${pct(A.front)} of your lifestyle spending happens in the first 7 days after payday. An even pace would be about 23%.`});
  if(A.weekendShare!=null&&A.weekendShare>=0.58)T.push({id:'weekend',s:clamp((A.weekendShare-0.5)/0.35,0,1),ev:`${pct(A.weekendShare)} of lifestyle spending lands on Friday to Sunday.`});
  if(A.tinyN/A.months>=20&&m.tiny>=0.04*inc)T.push({id:'drip',s:clamp(m.tiny/inc/0.1,0,1),ev:`About ${Math.round(A.tinyN/A.months)} small spends under ₦2,000 a month add up to ${naira(m.tiny)}.`});
  const tShare=(m.transfer+m.giving)/spend;if(tShare>=0.2)T.push({id:'pillar',s:clamp((tShare-0.15)/0.3,0,1),ev:`${pct(tShare)} of what you spend goes to other people through transfers and giving.`});
  if(m.cash/spend>=0.15)T.push({id:'cash',s:clamp(m.cash/spend/0.35,0,1),ev:`${naira(m.cash)} a month leaves as cash, which your coach can't follow.`});
  if(m.betOut>=0.03*inc||A.betN/A.months>=6)T.push({id:'risk',s:clamp(m.betOut/inc/0.08,0.3,1),ev:`You stake about ${naira(m.betOut)} a month on betting (${Math.round(A.betN/A.months)} bets), ${naira(Math.max(0,m.betNet))} net after wins.`});
  if(m.debt/inc>=0.15)T.push({id:'debt',s:clamp(m.debt/inc/0.35,0,1),ev:`${pct(m.debt/inc)} of your income goes to loan repayments.`});
  if(A.keptRate>=0.18)T.push({id:'builder',s:clamp(A.keptRate/0.35,0,1),ev:`You keep ${pct(A.keptRate)} of what you earn.`});
  return T.sort((a,b)=>b.s-a.s);
}
const ARCH={
  sprinter:{name:'The Payday Sprinter',line:'Most of your lifestyle money moves in the first week after pay lands. The rest of the month runs on what is left.',icon:'bolt',chip:'Payday rush'},
  weekend:{name:'The Weekend Splurger',line:'Your weekdays are careful. Friday to Sunday is where the money goes.',icon:'sun',chip:'Weekend heavy'},
  drip:{name:'The Drip Spender',line:'No single purchase looks big. Dozens of small ones add up to a real amount.',icon:'drop',chip:'Small spends'},
  pillar:{name:'The Family Pillar',line:'A big share of your money supports other people. That is generous, and it needs a plan so you are supported too.',icon:'pillar',chip:'Supports others'},
  cash:{name:'The Cash Ghost',line:'A lot of your money leaves as cash, so it disappears from view.',icon:'cash',chip:'Cash heavy'},
  risk:{name:'The Risk Chaser',line:'Betting is a regular line in your statement. The wins are memorable; the net is what counts.',icon:'dice',chip:'Betting'},
  debt:{name:'The Debt Juggler',line:'Loan repayments take a big bite before you can plan the rest.',icon:'juggle',chip:'Loan heavy'},
  builder:{name:'The Steady Builder',line:'You already keep a healthy slice of your income. Next is giving it a clear job.',icon:'bricks',chip:'Keeps money'},
  balanced:{name:'The Balanced Navigator',line:'No single habit dominates your spending. The next step is consistency.',icon:'scale',chip:'Balanced'}
};
function archetypeOf(A){const t=A.traits.find(x=>x.id!=='builder'||A.traits.length===1)||A.traits[0];return t?{id:t.id,...ARCH[t.id]}:{id:'balanced',...ARCH.balanced};}
function lin(x,good,bad){if(good<bad)return clamp((bad-x)/(bad-good),0,1);return clamp((x-bad)/(good-bad),0,1);}
function scoreOf(A){
  const m=A.m,inc=Math.max(1,m.income);
  const recent=[0,1,2,3,4,5,6].filter(i=>S.checkins[addDays(todayISO(),-i)]).length;
  const parts=[
    {k:'Money kept',max:35,p:35*lin(A.keptRate,0.2,0),tip:'Keep more of each pay'},
    {k:'Essentials',max:15,p:15*lin(m.need/inc,0.5,0.8),tip:'Essentials take a large share of income'},
    {k:'Leaks',max:15,p:15*lin((m.fees+A.subsM+Math.max(0,m.betNet))/inc,0.03,0.12),tip:'Cut fees, subscriptions and betting losses'},
    {k:'Payday pacing',max:15,p:A.front==null?10:15*lin(A.front,0.3,0.65),tip:'Spread lifestyle spending across the month'},
    {k:'Debt load',max:10,p:10*lin(m.debt/inc,0.1,0.35),tip:'Loan repayments take a big share'},
    {k:'Habits',max:10,p:Math.min(10,recent/7*6+(S.challenges.active.length||S.challenges.done.length?4:0)),tip:'Check in daily and run a challenge'}
  ];
  const total=Math.round(parts.reduce((s,x)=>s+x.p,0));
  const lever=[...parts].sort((a,b)=>(b.max-b.p)-(a.max-a.p))[0];
  return{total,parts,lever};
}

/* ================= coach feed ================= */
function nudges(A){
  const N=[],m=A.m;
  if(A.keptRate<0)N.push({tone:'bad',w:100,title:`You spent ${naira(-m.kept)} a month more than you earned`,body:'Money going out is bigger than money coming in. The gap is usually covered by savings, loans or family, and it grows quietly.',acts:[['Start: Pay yourself first','start','pay-first'],['Read: A simple split','lesson','split']]});
  if(A.front!=null&&A.front>=0.38)N.push({tone:'bad',w:90,title:`${pct(A.front)} of your lifestyle spending happens in the week after payday`,body:'An even pace would be about 23%. The first week sets the tone for the rest of the month.',acts:[['Start: Payday pause','start','payday-pause'],['Read: Why pay disappears','lesson','payday']]});
  if(m.betOut>0)N.push({tone:m.betNet>0.03*m.income?'bad':'tip',w:85,title:`Betting cost you ${naira(Math.max(0,m.betNet))} a month after wins`,body:`You staked ${naira(m.betOut)} a month across about ${Math.round(A.betN/A.months)} bets. Wins brought back ${naira(m.betIn)}.`,acts:[['Start: No-bet week','start','no-bet'],['Read: The house edge','lesson','betting']]});
  if(m.fees>=800)N.push({tone:'tip',w:60,title:`Bank fees and levies take ${naira(m.fees)} a month`,body:`That's ${naira(m.fees*12)} a year on alerts, transfer charges and levies. Part of it can be cut.`,acts:[['Start: Fee detox','start','fee-detox'],['Read: Small charges add up','lesson','fees']]});
  if(A.subs.length>=2)N.push({tone:'tip',w:55,title:`${A.subs.length} subscriptions cost ${naira(A.subsM)} a month`,body:A.subs.slice(0,4).map(s=>s.name).join(', ')+'. Keep the ones you use every week.',acts:[['Start: Subscription audit','start','sub-audit']]});
  if(A.untagged>=3)N.push({tone:'tip',w:50,title:`${A.untagged} transfers and payments need a tag`,body:'Tell your coach which transfers are family support, rent or loans to friends. Every insight gets sharper.',acts:[['Tag transactions','txns','untagged']]});
  if(m.cash>=0.08*m.income)N.push({tone:'tip',w:45,title:`${naira(m.cash)} a month leaves as cash`,body:'Cash is a blind spot. Your coach can see it leave but not where it goes.',acts:[['Start: Cash diary','start','cash-diary']]});
  const ess=m.need+m.debt;
  N.push({tone:'tip',w:30,title:`Your first emergency fund target: ${naira(ess*3)}`,body:`That's three months of essentials and loan repayments. Start with one week: ${naira(ess/4.35)}.`,acts:[['Start: Emergency fund starter','start','emergency'],['Read: Emergency fund 101','lesson','emergency']]});
  if(A.keptRate>=0.15)N.push({tone:'good',w:95,title:`You kept ${pct(A.keptRate)} of your income`,body:'Protect it by moving it out of your spending account on payday, before it gets spent.',acts:[['Read: Prices rise, cash shrinks','lesson','inflation']]});
  return N.sort((a,b)=>b.w-a.w);
}

/* ================= challenges, lessons, badges ================= */
const CHAL={
  'payday-pause':{title:'Payday pause',kind:'daily',days:7,need:5,xp:120,blurb:()=>'For 7 days after your next pay lands, wait 24 hours before any lifestyle purchase.',tips:['Write down what you want and when','Buy it tomorrow only if you still want it']},
  'no-bet':{title:'No-bet week',kind:'daily',days:7,need:5,xp:150,cap:{cat:'Betting',mult:0},blurb:()=>'Seven days without placing a bet. Check in each day you stayed clear.',tips:['Log out of betting apps for the week','Mute match alerts']},
  'cook-in':{title:'Cook-in week',kind:'daily',days:7,need:5,xp:100,cap:{cat:'Food & eating out',mult:0.5},blurb:A=>`Spend half your usual on food delivery and eating out this week: about ${naira(catWeekly(A,'Food & eating out')*0.5)}.`},
  'weekend-cap':{title:'Weekend cap',kind:'daily',days:7,need:3,xp:100,blurb:A=>`Keep Friday to Sunday lifestyle spending under ${naira(A?A.m.want*(A.weekendShare||0.5)/4.35*0.7:10000)} this weekend. Check in on each weekend day you stay under.`},
  'fee-detox':{title:'Fee detox',kind:'checklist',days:7,xp:80,blurb:()=>'Three quick checks that cut bank charges.',list:()=>['Check whether your bank lets you switch SMS alerts to app or email alerts','Group small transfers into fewer, larger ones where you can','Look up your card maintenance fees and whether you need every card']},
  'sub-audit':{title:'Subscription audit',kind:'checklist',days:5,xp:80,blurb:()=>'Decide on each subscription: keep it only if you use it every week.',list:A=>(A&&A.subs.length?A.subs:[{name:'Streaming',m:0}]).slice(0,6).map(s=>`Keep or cancel ${s.name}${s.m?` (${naira(s.m)} a month)`:''}`)},
  'cash-diary':{title:'Cash diary',kind:'daily',days:7,need:5,xp:90,blurb:()=>'Write down every cash spend for a week. Check in each day you logged them.'},
  'pay-first':{title:'Pay yourself first',kind:'weekly',days:28,need:4,xp:160,blurb:A=>`On payday, move ${naira(A?A.m.income*0.1:20000)} (10% of pay) into a separate savings account before you spend. Check in each week you left it alone.`},
  'emergency':{title:'Emergency fund starter',kind:'weekly',days:28,need:4,xp:200,blurb:A=>`Build one week of essentials: ${naira(A?(A.m.need+A.m.debt)/4.35:30000)}. Set aside a quarter of it each week.`},
  'tag-5':{title:'Tag 5 transactions',kind:'tag',days:7,need:5,xp:60,blurb:()=>'Tag five transfers or payments so your coach knows what they were for.'}
};
function catWeekly(A,c){if(!A)return 0;const x=A.cats.find(k=>k.cat===c);return x?x.m*7/30.44:0;}
function recommended(A){
  const ids=[];const m=A?A.m:null;
  if(A){
    if(A.traits.some(t=>t.id==='sprinter'))ids.push('payday-pause');
    if(m.betOut>0)ids.push('no-bet');
    if(m.fees>=800)ids.push('fee-detox');
    if(A.subs.length>=2)ids.push('sub-audit');
    if(A.untagged>=3)ids.push('tag-5');
    if(A.keptRate<0.1)ids.push('pay-first');
    if(catWeekly(A,'Food & eating out')>0.1*m.income/4.35)ids.push('cook-in');
    if(A.weekendShare>=0.55)ids.push('weekend-cap');
    if(m.cash>=0.08*m.income)ids.push('cash-diary');
  }
  ids.push('emergency','pay-first','cook-in','fee-detox');
  const busy=new Set([...S.challenges.active.map(c=>c.id)]);
  return [...new Set(ids)].filter(id=>!busy.has(id));
}
const LESSONS=[
  {id:'payday',title:'Why pay disappears in a week',min:2,body:['Right after payday your balance looks big, so every purchase feels small next to it. Bills, backlog from last month and requests from family all arrive in the same few days.','The fix is structure, not willpower. On the day pay lands, split it into three places: bills and essentials, spending money for the month, and savings. Then treat the spending pot as the whole budget.','A weekly allowance helps too. Move a quarter of your spending money each week into the account you actually spend from.'],q:{q:'What is the simplest guard against the payday rush?',o:['Split your pay into pots on the day it lands','Check your balance less often','Spend quickly before prices rise'],a:0,why:'Deciding where the money goes before you start spending removes the "big balance" feeling that drives the rush.'}},
  {id:'fees',title:'Small charges add up',min:2,body:['Bank charges are small one at a time: SMS alert charges, transfer fees plus VAT, card maintenance fees, and a ₦50 levy on many incoming transfers of ₦10,000 or more.','Together they can reach thousands of naira a month. Some can be reduced: many banks let you switch SMS alerts to free app or email notifications, and grouping small transfers means fewer transfer charges.','Levies set by law cannot be avoided, but knowing them helps you read your statement without surprises.'],q:{q:'Which charge can you often reduce yourself?',o:['SMS alert charges, by switching to app or email alerts where offered','The levy on incoming transfers','Income tax'],a:0,why:'Alert charges depend on how you choose to be notified. Levies set by law apply regardless.'}},
  {id:'emergency',title:'Your first emergency fund',min:2,body:['An emergency fund is money kept only for surprises: a medical bill, a lost job, a broken phone you need for work. It stops one bad week from becoming a loan.','A common target is three to six months of essentials. That can feel far away, so start with one week, then one month.','Keep it separate from your spending account, easy to reach in a day or two, and out of anything risky. Its job is to be there, not to grow fast.'],q:{q:'What should an emergency fund cover first?',o:['Essentials like rent, food, transport and power','Holidays and gadgets','Betting stakes'],a:0,why:'It exists to keep essentials paid when income stops or a shock hits.'}},
  {id:'inflation',title:'Prices rise, cash shrinks',min:2,body:['When prices rise 20% in a year, ₦100,000 buys only what about ₦83,000 bought the year before. Money sitting still loses buying power.','Interest helps only if it beats the rise in prices. Savings that earn 5% while prices rise 20% still lose ground.','Before putting money anywhere to grow it, learn how the option works, who regulates it and what you could lose. Ledger explains ideas; it does not recommend products.'],q:{q:'Prices rise 20% this year and your savings earn 5%. Your buying power…',o:['Falls','Rises','Stays the same'],a:0,why:'Your money grew 5% but what it buys fell by more, so you can buy less than before.'}},
  {id:'debt',title:'Loan apps: count the total cost',min:2,body:['Quick loans look cheap because the fee is shown for a short period. Borrow ₦20,000 and repay ₦26,000 after 30 days, and you have paid 30% for one month.','Borrow for real emergencies, not for lifestyle. If you have several loans, paying off the most expensive first saves the most money; paying off the smallest first gives quick wins. Both work if you stick with them.','If repayments take more than about a third of your income, talk to someone you trust or a qualified adviser before borrowing again.'],q:{q:'You borrow ₦20,000 and repay ₦26,000 after 30 days. The cost is…',o:['₦6,000, or 30% for one month','₦600','Nothing, it was only 30 days'],a:0,why:'The cost is the difference between what you repaid and what you borrowed.'}},
  {id:'split',title:'A simple split to start with',min:2,body:['One popular starting point: 50% of income on needs, 30% on wants and 20% on your future (savings and paying down debt).','Real life rarely fits exactly. With high rent, 60/25/15 might be honest. The point is that the future slice exists and gets paid first.','Look at your own "per ₦100" bar on Home and pick a split you can hit next month, then nudge it each month.'],q:{q:'What matters most about a spending split?',o:['That the future slice exists and is paid first','Hitting 50/30/20 exactly','Changing it every week'],a:0,why:'The exact numbers matter less than paying your future first, every month.'}},
  {id:'betting',title:'Betting and the house edge',min:2,body:['Betting odds are built so the bookmaker makes a profit over many bets. A win feels big, but your statement shows the full picture: total staked minus total won.','If you bet, set a monthly limit you can afford to lose and track the net, not the wins.','If stopping feels hard, or you chase losses, talk to someone you trust. That is a common experience, and support helps.'],q:{q:'Over many bets, who usually comes out ahead?',o:['The bookmaker','The bettor','It evens out'],a:0,why:'Odds include a margin for the bookmaker, so over time the house wins.'}}
];
const BADGES=[['books','Opened the books','Upload your first statement','₦'],['self','Self-aware','Finish the money personality quiz','?'],['s3','3-day streak','Check in 3 days in a row','3'],['s7','Week strong','Check in 7 days in a row','7'],['s30','Month of habits','Check in 30 days in a row','30'],['c1','First challenge','Complete a challenge','1'],['c5','Challenge regular','Complete 5 challenges','5'],['ver','Verified','Have a challenge confirmed by your statement','✓'],['tag','Tagger','Tag 10 transactions','#'],['learn','Scholar','Finish 3 lessons','L'],['clean','Clean week','Complete No-bet week','0'],['s70','70 club','Reach a habit score of 70','70'],['kept','Keeper','Keep 20% of your income','20'],['coach','Curious','Ask your coach a question','Q']];
const LEVELS=[{n:1,name:'Aware',xp:0},{n:2,name:'Tracker',xp:100},{n:3,name:'Steady',xp:260},{n:4,name:'Builder',xp:500},{n:5,name:'Guardian',xp:850},{n:6,name:'Master',xp:1300}];
const levelOf=xp=>LEVELS.reduce((L,l)=>xp>=l.xp?l:L,LEVELS[0]);
function streak(){let n=0,d=todayISO();if(!S.checkins[d])d=addDays(d,-1);while(S.checkins[d]){n++;d=addDays(d,-1);}return n;}
function addXP(n,why){const b=levelOf(S.xp);S.xp+=n;const a=levelOf(S.xp);toast(`+${n} XP · ${why}`);if(a.n>b.n)celebrate('Level up',`You reached level ${a.n}: ${a.name}.`,'star');}
function award(id){if(S.badges.includes(id))return;S.badges.push(id);const b=BADGES.find(x=>x[0]===id);if(b)toast(`Badge earned: ${b[1]}`);}

/* ================= quiz ================= */
const QUIZ=[
  {q:"When money hits your account, what's your first move?",o:[['Save or put some aside first',{saver:2}],['Pay what I owe',{saver:1,anxious:1}],['Enjoy some of it now',{spender:2}],["I don't really plan it",{spender:1,anxious:2}]]},
  {q:'How do you feel when you check your balance?',o:[['Calm, I roughly know what is there',{saver:1}],['A little anxious, but I look',{anxious:1}],['I avoid it when I can',{anxious:2}],['Curious, I like tracking it',{saver:1}]]},
  {q:'What is your biggest money goal right now?',o:[['Build an emergency fund',{goal:'safety'}],['Pay off debt',{goal:'debt'}],['Grow long-term wealth',{goal:'growth'}],['Stop overspending',{goal:'control'}]]},
  {q:'An unexpected ₦100,000 bill arrives tomorrow. What happens?',o:[['I can pay it from savings',{saver:2}],["I'd manage, but it would hurt",{saver:1}],["I'd borrow or ask family",{spender:1,anxious:1}],["I honestly don't know",{anxious:2}]]},
  {q:'How steady is your income?',o:[['Very steady',{stable:2}],['Mostly steady, some swings',{stable:1}],['Irregular',{stable:0}]]}
];
const GOALS={safety:'building an emergency fund',debt:'paying off debt',growth:'growing long-term wealth',control:'stopping overspending'};

/* ================= UI helpers ================= */
function toast(msg){const t=document.createElement('div');t.className='toast';t.textContent=msg;$('#toasts').appendChild(t);setTimeout(()=>t.remove(),2600);}
function openSheet(html,wide){$('#sheetRoot').innerHTML=`<div class="scrim" data-act="scrim"><div class="sheet${wide?' wide':''}" role="dialog" aria-modal="true">${html}</div></div>`;const f=$('#sheetRoot .sheet button, #sheetRoot .sheet input, #sheetRoot .sheet select');if(f)f.focus();}
function closeSheet(){$('#sheetRoot').innerHTML='';}
function celebrate(title,msg,icon){
  $('#sheetRoot').insertAdjacentHTML('beforeend',`<div class="celebrate" data-act="close-cel"><div class="box" role="alertdialog" aria-label="${esc(title)}"><div class="medal">${ic(icon||'star')}</div><h2>${esc(title)}</h2><p class="muted">${esc(msg)}</p><button class="btn" data-act="close-cel">Nice</button></div></div>`);
  if(reduceMotion())return;
  const c=$('#fx'),x=c.getContext('2d'),W=c.width=innerWidth,Hh=c.height=innerHeight,cs=getComputedStyle(document.documentElement);
  const cols=['--green','--gold','--blue','--coral'].map(v=>cs.getPropertyValue(v).trim());
  const P=Array.from({length:120},()=>({x:W/2,y:Hh/2.4,vx:(Math.random()-.5)*14,vy:-Math.random()*12-3,r:Math.random()*5+3,c:cols[Math.floor(Math.random()*4)],a:Math.random()*6}));
  let f=0;(function step(){x.clearRect(0,0,W,Hh);for(const p of P){p.vy+=0.35;p.x+=p.vx;p.y+=p.vy;p.a+=0.2;x.save();x.translate(p.x,p.y);x.rotate(p.a);x.fillStyle=p.c;x.fillRect(-p.r/2,-p.r/4,p.r,p.r/2);x.restore();}if(++f<90)requestAnimationFrame(step);else x.clearRect(0,0,W,Hh);})();
}
function setU(u){U=u;if(isWide()||tab==='statements'){const el=$('#uploadStatus');if(el){el.outerHTML=statusHTML();return;}}}
const mq=matchMedia('(min-width: 980px)');const isWide=()=>mq.matches;
function countUps(root){if(reduceMotion())return;root.querySelectorAll('[data-count]').forEach(el=>{const to=+el.dataset.count,fmt=el.dataset.fmt;const t0=performance.now();const f=v=>fmt==='n'?naira(v):Math.round(v);(function s(t){const k=Math.min(1,(t-t0)/900),e=1-Math.pow(1-k,3);el.textContent=f(to*e);if(k<1)requestAnimationFrame(s);})(t0);});}

/* ================= render ================= */
const TABS=[['home','Home','home'],['statements','Statements','doc',1],['grow','Grow','grow'],['coach','Coach','chat'],['me','Me','me']];
function render(){
  if(isWide()&&tab==='statements')tab='home';
  const lv=levelOf(S.xp),st=streak();
  $('#topbar').innerHTML=`<div class="brand"><span class="mark" aria-hidden="true">₦</span><b>Ledger</b></div>
   <div class="pills"><button class="pill streak" data-act="tab" data-arg="me" aria-label="${st} day streak">${ic('flame')}<span class="num">${st}</span><span class="lbl">day streak</span></button>
   <button class="pill" data-act="tab" data-arg="me" aria-label="Level ${lv.n}, ${S.xp} XP">${ic('star')}<span>Lv ${lv.n}</span><span class="lbl num">· ${S.xp} XP</span></button>
   ${installEvt?`<button class="pill" data-act="install" aria-label="Install Ledger on this device">${ic('upload')}<span>Install app</span></button>`:''}
   <button class="pill safe" data-act="privacy" aria-label="Privacy: your data stays on this device">${ic('lock')}<span class="lbl">On this device</span></button></div>`;
  $('#tabs').innerHTML=TABS.map(([id,l,icn,mob])=>`<button class="tab" data-act="tab" data-arg="${id}" ${mob?'data-mobile':''} ${tab===id?'aria-current="page"':''}>${ic(icn)}<span>${l}</span></button>`).join('');
  $('#side').innerHTML=isWide()?`<div class="card">${statementsPanel()}</div>`:'';
  const v=$('#view');
  v.innerHTML=tab==='home'?viewHome():tab==='statements'?`<div class="card">${statementsPanel()}</div>`:tab==='grow'?viewGrow():tab==='coach'?viewCoach():viewMe();
  if(revealNext&&tab==='home'){revealNext=false;const st=$('#story');if(st){st.classList.add('reveal');countUps(st);setTimeout(()=>st.classList.remove('reveal'),1600);}}
  const chatEl=$('#chat');if(chatEl)chatEl.scrollTop=chatEl.scrollHeight;
}

/* ---------- statements panel ---------- */
function statusHTML(){
  if(U.busy)return`<div id="uploadStatus" class="status busy" role="status"><span class="spin" aria-hidden="true"></span>${esc(U.msg||'Reading…')}</div>`;
  if(U.needPassword)return`<div id="uploadStatus" class="status busy"><form class="stack" data-form="pw" style="gap:10px"><p class="small"><b>This PDF is password-protected.</b> ${U.wrong?'That password did not work. ':''}Many banks use your account number, date of birth or a code from the email.</p><label class="f" for="pwIn">PDF password<input type="password" id="pwIn" autocomplete="off"></label><div class="row"><button class="btn sm" type="submit">Unlock and read</button><button class="btn q sm" type="button" data-act="pw-cancel">Cancel</button></div><p class="tiny">Used once to open the file. Never saved.</p></form></div>`;
  if(U.error)return`<div id="uploadStatus" class="status err" role="alert">${esc(U.error)}</div>`;
  if(U.ok)return`<div id="uploadStatus" class="status ok" role="status">${esc(U.ok)}</div>`;
  return'<div id="uploadStatus" hidden></div>';
}
function statementsPanel(){
  const A=getA();const T=getTxns();
  const list=S.demo?`<div class="stmt"><div><div class="nm">Sample statement (Tolu, fictional)</div><div class="tiny">${A?`${fmtD(A.from)} – ${fmtDY(A.to)} · ${T.length} transactions`:''}</div></div><button class="btn q sm" data-act="clear-demo">Remove</button></div>`
    :S.statements.map(s=>`<div class="stmt"><div><div class="nm">${esc(s.name)}</div><div class="tiny">${s.from?fmtD(s.from)+' – '+fmtDY(s.to)+' · ':''}${s.count} transactions</div></div><button class="btn q sm" data-act="rm-stmt" data-arg="${s.id}" aria-label="Remove ${esc(s.name)}">Remove</button></div>`).join('');
  return`<div class="panel">
   <div><h2>Statements</h2><p class="muted small" style="margin-top:4px">Upload the statement you already get from your bank. No bank login and no account linking.</p></div>
   <div class="drop" data-act="pick" role="button" tabindex="0" aria-label="Upload a bank statement">${ic('upload')}<strong>Drop a statement here</strong><span class="muted small">or tap to choose a file</span><span class="tiny">PDF, Excel or CSV from any Nigerian bank</span></div>
   ${statusHTML()}
   <div class="lockline">${ic('lock')}<span>Read on this device. The file is never uploaded or stored, only the transactions it contains.</span></div>
   <div class="row"><button class="btn q sm" data-act="paste">${pasteOpen?'Hide paste box':'Paste text instead'}</button><button class="btn q sm" data-act="manual">Enter numbers by hand</button></div>
   ${pasteOpen?`<div class="stack" style="gap:8px"><label class="f" for="pasteBox">Paste rows from your statement<textarea id="pasteBox" data-input="paste" placeholder="01/09/2026  POS PURCHASE SHOPRITE  18,500.00  142,300.00">${esc(pasteDraft)}</textarea></label><button class="btn sm" data-act="paste-go">Read pasted rows</button></div>`:''}
   ${list?`<div><h3 style="margin-bottom:4px">On this device</h3>${list}</div>`:''}
   ${T.length?`<button class="btn q" data-act="txns" data-arg="${A&&A.untagged?'untagged':'all'}">Review transactions${A&&A.untagged?` · ${A.untagged} need a tag`:''}</button>`:''}
   <details><summary>Where do I get my statement?</summary><p class="small muted">In most bank apps, look for "Account statement" under Accounts, Cards or Help. Choose the last 3 months as PDF or Excel. Many banks also email statements on request.</p></details>
  </div>`;
}

/* ---------- home ---------- */
function viewHome(){
  const A=getA();let h='';
  if(S.demo)h+=`<div class="banner"><p><b>You're looking at a sample.</b> Tolu is a fictional Lagos professional. Upload your own statement to see your real money story.</p><div class="row"><button class="btn sm" data-act="pick">${ic('upload')}Upload my statement</button></div></div>`;
  h+=checkinCard();
  if(!A)return h+emptyHero();
  h+=`<div id="story" class="stack">${storyHero(A)}${coachFeed(A)}<div class="grid2">${whereCard(A)}${cycleCard(A)}</div>${insightTiles(A)}<div class="grid2">${merchantsCard(A)}${trendCard(A)}</div></div>`;
  if(!S.quiz)h+=`<section class="card row" style="justify-content:space-between"><div><h3>Tell your coach about you</h3><p class="muted small">Five quick questions. Your coach compares what you say with what your statement shows.</p></div><button class="btn" data-act="quiz">Take the quiz · +50 XP</button></section>`;
  return`<div class="stack">${h}</div>`;
}
function emptyHero(){
  return`<section class="card hero"><div><h2 style="font-size:clamp(1.6rem,4vw,2.3rem);font-weight:800">See where your money really goes</h2><p class="muted" style="margin-top:8px;max-width:58ch">Upload a bank statement you already have. Ledger reads it on this device, finds your patterns and coaches you from there. No bank login needed.</p></div>
  <div class="row"><button class="btn" data-act="pick">${ic('upload')}Upload a statement</button><button class="btn q" data-act="load-demo">Try the sample</button><button class="btn q" data-act="manual">Enter numbers by hand</button></div>
  <div class="lockline">${ic('lock')}<span>PDF, Excel, CSV or pasted text. Password-protected PDFs work too.</span></div></section>`;
}
function checkinCard(){
  const t=todayISO(),c=S.checkins[t];
  if(c)return`<section class="card done-line"><span class="chip good">${ic('check')} Checked in</span><span class="muted small">Day ${streak()} of your streak. Money felt ${c.mood==='calm'?'calm':c.mood==='okay'?'okay':'tense'} today${c.spend==='lot'?'. Big unplanned spends happen; tomorrow, set a limit before you leave home.':'.'}</span></section>`;
  const b=(k,v,l)=>`<button type="button" data-act="ci" data-arg="${k}:${v}" aria-pressed="${ciDraft[k]===v}">${l}</button>`;
  return`<section class="card checkin" aria-label="Daily check-in"><div class="head" style="margin:0"><div><h3>Daily check-in</h3><p class="muted small">Ten seconds. Keeps your streak and your coach honest.</p></div><span class="chip warn">+10 XP</span></div>
   <div><p class="small" style="font-weight:600;margin-bottom:6px">How does money feel today?</p><div class="seg">${b('mood','calm','Calm')}${b('mood','okay','Okay')}${b('mood','tense','Tense')}</div></div>
   <div><p class="small" style="font-weight:600;margin-bottom:6px">Any unplanned spending today?</p><div class="seg">${b('spend','none','None')}${b('spend','little','A little')}${b('spend','lot','A lot')}</div></div></section>`;
}
function ringSVG(score){const r=52,c=2*Math.PI*r,col=score>=70?'var(--green)':score>=45?'var(--gold)':'var(--coral)';return`<svg viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="${r}" fill="none" stroke="var(--surface-2)" stroke-width="10"/><circle cx="60" cy="60" r="${r}" fill="none" stroke="${col}" stroke-width="10" stroke-linecap="round" stroke-dasharray="${c*score/100} ${c}"/></svg>`;}
const GCOL={need:'var(--blue)',want:'var(--gold)',leak:'var(--coral)',other:'var(--ink-3)',save:'var(--green)'};
function storyHero(A){
  const who=S.demo?"Tolu's money story (sample)":'Your money story';
  const kept=Math.max(0,A.keptPer100),over=A.keptPer100<0;
  const segs=A.per100.map(p=>({...p,c:GCOL[p.k]})).concat(over?[]:[{k:'save',label:'Kept',v:kept,c:GCOL.save}]);
  const scale=Math.max(100,A.per100.reduce((s,p)=>s+p.v,0));
  const quizGap=quizContrast(A);
  return`<section class="card hero" aria-label="${esc(who)}">
   <div class="head" style="margin:0"><div><p class="small" style="font-weight:700;color:var(--green)">${esc(who)}</p><p class="tiny">${fmtD(A.from)} – ${fmtDY(A.to)} · ${A.count} transactions</p></div><span class="chip">Habit score, not a credit score</span></div>
   <div class="hero-main">
    <div class="ring" role="img" aria-label="Habit score ${A.score.total} out of 100">${ringSVG(A.score.total)}<div class="val"><b data-count="${A.score.total}">${A.score.total}</b><span>of 100</span></div></div>
    <div><div class="arch"><span class="emblem">${ic(A.arch.icon)}</span><h2>${esc(A.arch.name)}</h2></div>
     <p style="margin-top:8px;max-width:62ch">${esc(A.arch.line)}</p>
     ${A.traits.length?`<ul class="evidence">${A.traits.slice(0,3).map(t=>`<li>${esc(t.ev)}</li>`).join('')}</ul>`:''}
     ${A.traits.length>1?`<div class="traits">${A.traits.slice(1,5).map(t=>`<span class="chip">${esc(ARCH[t.id].chip)}</span>`).join('')}</div>`:''}
    </div></div>
   <div class="stats3"><div class="stat"><b data-count="${Math.round(A.m.income)}" data-fmt="n">${naira(A.m.income)}</b><span>in per month</span></div><div class="stat"><b data-count="${Math.round(A.m.spend)}" data-fmt="n">${naira(A.m.spend)}</b><span>out per month</span></div><div class="stat"><b style="color:${A.keptRate<0?'var(--coral)':'var(--green)'}">${A.keptRate<0?'-':''}${pct(Math.abs(A.keptRate))}</b><span>${A.keptRate<0?'overspent':'kept'}</span></div></div>
   <div class="per100"><h3>Of every ₦100 ${S.demo?'Tolu earns':'you earn'}</h3>
    <div class="split" role="img" aria-label="${segs.map(s=>`${s.label} ₦${Math.round(s.v)}`).join(', ')}">${segs.map(s=>`<i style="width:${s.v/scale*100}%;background:${s.c}"></i>`).join('')}</div>
    <div class="legend">${segs.map(s=>`<span><i style="background:${s.c}"></i>${s.label} <b class="num">₦${Math.round(s.v)}</b></span>`).join('')}${over?`<span style="color:var(--coral)"><b>₦${Math.round(-A.keptPer100)} more than earned</b></span>`:''}</div></div>
   ${quizGap?`<p class="gap">${esc(quizGap)}</p>`:''}
  </section>`;
}
function quizContrast(A){
  if(!S.quiz)return'';const q=S.quiz;
  if(q.saver>=3&&A.keptRate<0.1)return`You told your coach you usually save first. This statement shows ${A.keptRate<0?'more going out than coming in':`you kept ${pct(A.keptRate)}`}. That gap is common, and it usually closes when savings move on payday, before spending starts.`;
  if(q.anxious>=3&&A.keptRate>=0.1)return`You said money makes you anxious, but your numbers are steadier than that feeling: you kept ${pct(A.keptRate)}. Checking in often tends to shrink the anxiety.`;
  if(q.spender>=3&&A.traits.some(t=>t.id==='sprinter'||t.id==='weekend'))return'You said you like to enjoy money when it arrives, and your statement agrees. The aim is not to stop, but to decide the amount before payday does.';
  if(q.goal)return`Your goal is ${GOALS[q.goal]}. Every nudge below is ranked with that in mind.`;
  return'';
}
function coachFeed(A){
  const N=nudges(A),show=N.slice(0,3);
  return`<section class="card" aria-label="Coach feed"><div class="head"><div><h2>Your coach says</h2><p class="muted small">Ranked by what would help most right now.</p></div><button class="btn q sm" data-act="tab" data-arg="coach">${ic('chat')}Ask a question</button></div>
   ${show.map(n=>`<div class="nudge ${n.tone}"><span class="stripe" aria-hidden="true"></span><div><h3>${esc(n.title)}</h3><p>${esc(n.body)}</p><div class="row">${n.acts.map(([l,a,g],i)=>`<button class="btn ${i?'q ':''}sm" data-act="${a}" data-arg="${g}">${esc(l)}</button>`).join('')}</div></div></div>`).join('')}
   ${N.length>3?`<details><summary>${N.length-3} more</summary>${N.slice(3).map(n=>`<div class="nudge ${n.tone}"><span class="stripe" aria-hidden="true"></span><div><h3>${esc(n.title)}</h3><p>${esc(n.body)}</p><div class="row">${n.acts.map(([l,a,g],i)=>`<button class="btn ${i?'q ':''}sm" data-act="${a}" data-arg="${g}">${esc(l)}</button>`).join('')}</div></div></div>`).join('')}</details>`:''}
  </section>`;
}
function groupOf(c){if(c.cat==='Betting'||c.cat==='Subscriptions'||c.type==='fee')return'leak';return{need:'need',want:'want'}[c.type]||'other';}
function whereCard(A){
  const top=A.cats.slice(0,9),max=Math.max(...top.map(c=>c.m),1);
  return`<section class="card"><div class="head"><div><h2>Where it goes</h2><p class="muted small">Average per month</p></div></div>
  <div class="bars">${top.map(c=>`<div class="bar-row"><span>${esc(c.cat)}<small>${pct(c.m/Math.max(1,A.m.income))} of income</small></span><b>${naira(c.m)}</b><div class="track"><i style="width:${c.m/max*100}%;background:${GCOL[groupOf(c)]}"></i></div></div>`).join('')}</div>
  <div class="legend" style="margin-top:14px">${[['need','Essentials'],['want','Lifestyle'],['leak','Leaks'],['other','Transfers, cash & loans']].map(([k,l])=>`<span><i style="background:${GCOL[k]}"></i>${l}</span>`).join('')}</div></section>`;
}
function cycleCard(A){
  if(!A.cycleBars)return`<section class="card"><h2>Your pay cycle</h2><p class="muted small" style="margin-top:6px">Upload a statement covering at least one full month after a payday to see when in the month you spend.</p></section>`;
  const max=Math.max(...A.cycleBars,1);
  return`<section class="card"><div class="head"><div><h2>Your pay cycle</h2><p class="muted small">Lifestyle spending by day after payday</p></div></div>
  <p><span class="big">${pct(A.front)}</span> <span class="muted">in the first 7 days</span></p>
  <div class="cyc" role="img" aria-label="${pct(A.front)} of lifestyle spending happens in the first 7 days after payday">${A.cycleBars.map((b,i)=>`<i class="${i<7?'f':''}" style="height:${Math.max(3,b/max*100)}%"></i>`).join('')}</div>
  <div class="axis"><span>Payday</span><span>Day 7</span><span>Day 30</span></div>
  <p class="small muted" style="margin-top:10px">All spending in those 7 days averages ${naira(A.spent7)}, including rent and transfers.</p></section>`;
}
function insightTiles(A){
  const m=A.m,T=[];
  if(A.weekendShare!=null)T.push(['Weekend share',pct(A.weekendShare),'of lifestyle spending on Friday to Sunday. Three days out of seven is 43%.',A.weekendShare>0.58?'warn':'good',A.weekendShare>0.58?'High':'Even']);
  T.push(['Small spends',naira(m.tiny),`a month across about ${Math.round(A.tinyN/A.months)} purchases under ₦2,000.`,m.tiny>0.05*m.income?'warn':'good',m.tiny>0.05*m.income?'Adds up':'Fine']);
  if(m.fees>0)T.push(['Bank fees & levies',naira(m.fees),`a month. Alerts ${naira(A.feeParts.sms/A.months)}, transfer charges ${naira(A.feeParts.transfer/A.months)}, levies ${naira(A.feeParts.levy/A.months)}.`,m.fees>1500?'bad':'warn','Leak']);
  if(m.betOut>0)T.push(['Betting, net',naira(Math.max(0,m.betNet)),`a month lost after wins. Staked ${naira(m.betOut)}, won back ${naira(m.betIn)}.`,'bad','Leak']);
  if(A.subs.length)T.push(['Subscriptions',naira(A.subsM),`a month: ${A.subs.slice(0,3).map(s=>s.name).join(', ')}.`,'warn','Review']);
  if(m.transfer+m.giving>0)T.push(['To other people',naira(m.transfer+m.giving),`a month in transfers and giving.${A.untagged?` ${A.untagged} still need a tag.`:''}`,'info','Tag']);
  if(m.cash>0)T.push(['Cash withdrawals',naira(m.cash),"a month. Your coach can't see where cash goes.",m.cash>0.1*m.income?'warn':'info','Blind spot']);
  if(m.saving>0)T.push(['Moved to savings',naira(m.saving),'a month, net of withdrawals.','good','Good']);
  if(A.biggest)T.push(['Biggest single spend',naira(A.biggest.a),`${A.biggest.t.cat} on ${fmtD(A.biggest.t.date)}.`,'info','Info']);
  return`<section aria-label="Behaviour insights"><h2 style="margin:4px 0 12px">Your patterns</h2><div class="tiles">${T.map(([l,v,p,tone,chip])=>`<div class="tile"><div class="top"><span class="lab">${l}</span><span class="chip ${tone}">${chip}</span></div><b>${v}</b><p>${esc(p)}</p></div>`).join('')}</div></section>`;
}
function merchantsCard(A){
  return`<section class="card"><div class="head"><div><h2>Where you spend most</h2><p class="muted small">Top places, per month</p></div></div><div class="list">${A.merchants.map(x=>`<div class="li"><div><div class="nm">${esc(x.name)}</div><div class="sub">${esc(x.cat)} · ${timesM(x.n/A.months)}</div></div><div class="v">${naira(x.m)}</div></div>`).join('')||'<p class="muted small">Nothing to show yet.</p>'}</div></section>`;
}
const timesM=v=>{const n=Math.max(1,Math.round(v));return n===1?'about once a month':n===2?'twice a month':n+' times a month';};
function trendCard(A){
  const M=A.byMonth;
  if(M.length<2)return`<section class="card"><h2>Month by month</h2><p class="muted small" style="margin-top:6px">Upload two or more months to see your trend.</p></section>`;
  const W=420,Hh=220,pl=52,pb=26,pt=12,max=Math.max(...M.flatMap(x=>[x.in,x.out]),1);
  const step=Math.pow(10,Math.floor(Math.log10(max/2)));const nice=[1,2,2.5,5,10].map(k=>k*step).find(v=>v*2>=max/1.05)||step*10;const top=nice*2;
  const y=v=>pt+(Hh-pt-pb)*(1-v/top);const gw=(W-pl-10)/M.length,bw=Math.min(34,gw/3);
  let g='';[0,nice,top].forEach(v=>{g+=`<line x1="${pl}" x2="${W-6}" y1="${y(v)}" y2="${y(v)}" stroke="var(--line)" stroke-width="1"/><text x="${pl-8}" y="${y(v)+4}" text-anchor="end" font-size="12" fill="var(--ink-3)">${nairaK(v)}</text>`;});
  M.forEach((mo,i)=>{const cx=pl+gw*i+gw/2;const lab=MON_SHORT[+mo.k.slice(5)-1]+(mo.partial?'*':'');
    g+=`<rect x="${cx-bw-2}" y="${y(mo.in)}" width="${bw}" height="${Hh-pb-y(mo.in)}" rx="4" fill="var(--green)"/><rect x="${cx+2}" y="${y(mo.out)}" width="${bw}" height="${Hh-pb-y(mo.out)}" rx="4" fill="var(--gold)"/><text x="${cx}" y="${Hh-8}" text-anchor="middle" font-size="12" fill="var(--ink-2)">${lab}</text>`;});
  return`<section class="card"><div class="head"><div><h2>Month by month</h2><p class="muted small">Money in and out</p></div><div class="legend" style="margin:0"><span><i style="background:var(--green)"></i>In</span><span><i style="background:var(--gold)"></i>Out</span></div></div>
  <div class="chartwrap"><svg viewBox="0 0 ${W} ${Hh}" role="img" aria-label="Money in and out by month">${g}</svg></div>${M.some(x=>x.partial)?'<p class="tiny">* Partial month in this statement</p>':''}</section>`;
}

/* ---------- grow ---------- */
function chalCard(c,A){
  const d=CHAL[c.id];if(!d)return'';
  const today=todayISO(),dayN=daysBetween(c.start,today);
  let body='';
  if(d.kind==='daily'){
    const dots=Array.from({length:d.days},(_,i)=>{const iso=addDays(c.start,i);return`<i class="${c.checks.includes(iso)?'on':''} ${iso===today?'now':''}" title="${fmtD(iso)}"></i>`;}).join('');
    const doneToday=c.checks.includes(today);
    body=`<div class="dots" aria-label="${c.checks.length} of ${d.need} check-ins">${dots}</div><div class="row"><button class="btn sm" data-act="ch-check" data-arg="${c.id}" ${doneToday||dayN>=d.days?'disabled':''}>${doneToday?'Checked in today':'I stuck to it today · +15 XP'}</button><span class="tiny">${c.checks.length} of ${d.need} days needed</span></div>`;
  }else if(d.kind==='weekly'){
    const wk=Math.floor(dayN/7);const done=c.checks.includes(wk);
    body=`<div class="dots">${Array.from({length:4},(_,i)=>`<i class="${c.checks.includes(i)?'on':''} ${i===wk?'now':''}"></i>`).join('')}</div><div class="row"><button class="btn sm" data-act="ch-check" data-arg="${c.id}" ${done||wk>=4?'disabled':''}>${done?'Done this week':'I did it this week · +15 XP'}</button><span class="tiny">${c.checks.length} of ${d.need} weeks</span></div>`;
  }else if(d.kind==='checklist'){
    body=`<ul class="checks">${c.list.map((t,i)=>`<li><label><input type="checkbox" data-change="ch-item" data-arg="${c.id}:${i}" ${c.done&&c.done[i]?'checked':''}>${esc(t)}</label></li>`).join('')}</ul>`;
  }else if(d.kind==='tag'){
    const n=Math.min(d.need,S.tags-c.tag0);
    body=`<div class="progress" aria-label="${n} of ${d.need} tagged"><i style="width:${n/d.need*100}%"></i></div><div class="row"><button class="btn sm" data-act="txns" data-arg="untagged">Tag transactions</button><span class="tiny">${n} of ${d.need} tagged</span></div>`;
  }
  const ver=c.result?`<p class="verify">Statement check: ${c.result.pass?'✓ ':''}you spent ${naira(c.result.spent)} on ${esc(d.cap.cat.toLowerCase())} during the challenge (target ${naira(c.result.target)}).</p>`:(d.cap?'<p class="tiny">Upload a statement covering these dates later and Ledger will verify it for +50 XP.</p>':'');
  return`<article class="card ch"><div class="row top"><div><h3>${esc(d.title)}</h3><p class="tiny">Started ${fmtD(c.start)} · ${d.xp} XP on completion</p></div><button class="btn link" data-act="ch-drop" data-arg="${c.id}">Drop</button></div><p class="small muted">${esc(d.blurb(A))}</p>${d.tips?`<p class="tiny">Tip: ${esc(d.tips.join('. '))}.</p>`:''}${body}${ver}</article>`;
}
function viewGrow(){
  const A=getA();const act=S.challenges.active;const rec=recommended(A).slice(0,4);
  const card=id=>{const d=CHAL[id];return`<article class="card ch"><div class="row top"><h3>${esc(d.title)}</h3><span class="chip warn">+${d.xp} XP</span></div><p class="small muted">${esc(d.blurb(A))}</p><div class="row"><button class="btn sm" data-act="start" data-arg="${id}">Start challenge</button><span class="tiny">${d.kind==='weekly'?'4 weeks':d.kind==='checklist'?'Checklist':d.kind==='tag'?'Quick task':d.days+' days'}</span></div></article>`;};
  const done=S.challenges.done.slice(-6).reverse();
  return`<div class="stack">
   <section><div class="head"><div><h2>Active challenges</h2><p class="muted small">Up to three at a time. Check in to earn XP and keep your streak.</p></div></div>
    ${act.length?`<div class="grid2">${act.map(c=>chalCard(c,A)).join('')}</div>`:'<p class="card muted small">No active challenge yet. Pick one below.</p>'}</section>
   <section><h2 style="margin-bottom:12px">Picked for you</h2><div class="grid2">${rec.map(card).join('')}</div></section>
   <section class="card"><div class="head"><div><h2>Two-minute lessons</h2><p class="muted small">Short reads with one question. +20 XP each.</p></div><span class="chip">${Object.keys(S.lessons).length} of ${LESSONS.length} done</span></div>
    ${LESSONS.map(l=>`<div class="lesson-row ${S.lessons[l.id]?'done':''}"><span class="ico">${ic(S.lessons[l.id]?'check':'book')}</span><div><b>${esc(l.title)}</b><div class="tiny">${l.min} min${S.lessons[l.id]?' · Done':''}</div></div><button class="btn ${S.lessons[l.id]?'q ':''}sm" data-act="lesson" data-arg="${l.id}">${S.lessons[l.id]?'Read again':'Read'}</button></div>`).join('')}</section>
   <details class="card"><summary>All challenges</summary><div class="grid2" style="margin-top:12px">${Object.keys(CHAL).filter(id=>!act.some(c=>c.id===id)).map(card).join('')}</div></details>
   ${done.length?`<section class="card"><h2 style="margin-bottom:8px">Completed</h2><div class="list">${done.map(c=>`<div class="li"><div><div class="nm">${esc(CHAL[c.id]?.title||c.id)}</div><div class="sub">Finished ${fmtD(c.end)}${c.verified?' · verified by statement':''}</div></div><span class="chip good">${ic('check')}Done</span></div>`).join('')}</div></section>`:''}
  </div>`;
}

/* ---------- coach ---------- */
const SUGGEST=['Where is my money leaking?','How do I stop the payday rush?','Make me a simple budget for next month','How long until I have an emergency fund?','Which habit should I fix first?'];
function viewCoach(){
  const A=getA();
  let h=`<section class="card stack"><div><h2>Ask your coach</h2><p class="muted small" style="margin-top:4px">Questions about your spending, habits and next steps. Answers are education based on your numbers, not licensed financial advice.</p></div>`;
  if(!A)return h+'<p class="notice">Upload a statement or load the sample first, so your coach has numbers to work with.</p></section>';
  if(!S.consent.ai)return h+`<div class="notice stack" style="gap:10px"><b>Turn on the AI coach</b><p class="small">Your coach uses Claude, an AI model by Anthropic, to answer. When you ask a question, Ledger sends a short summary of your numbers${IN_VIEWER?'':' through Ledger\'s coach service'}: monthly totals, categories and patterns. It never sends your transactions, the file or the names of people you pay, and Ledger does not keep your questions. You can turn this off in Me.</p><div class="row"><button class="btn" data-act="ai-on">Turn on AI coach</button></div></div></section>`;
  if(sampleState==='none')h+='<p class="notice">The AI coach isn\'t available in this view. Your coach feed on Home still updates from your statement.</p>';
  else if(sampleState==='pending')h+='<p class="tiny">Connecting to your coach…</p>';
  h+=`<div class="chat" id="chat" aria-live="polite">${chat.length?'':`<div class="msg a">Hi${S.demo?'':''}. I've looked at ${S.demo?"Tolu's sample statement":'your statement'}: ${naira(A.m.income)} in and ${naira(A.m.spend)} out a month. Ask me anything about it.</div>`}${chat.map(x=>`<div class="msg ${x.role==='user'?'u':'a'}${x.err?' err':''}">${esc(x.content)}</div>`).join('')}${chatBusy?`<div class="msg a" id="live">${liveText?esc(liveText):'Thinking…'}</div>`:''}</div>`;
  if(!chat.length&&sampleState!=='none')h+=`<div class="suggest">${SUGGEST.map(s=>`<button data-act="ask" data-arg="${esc(s)}">${esc(s)}</button>`).join('')}</div>`;
  if(sampleState!=='none')h+=`<form class="composer" data-form="chat"><label class="sr" for="chatIn">Message your coach</label><textarea id="chatIn" data-input="chat" placeholder="Ask about your money…" rows="1">${esc(chatDraft)}</textarea>${chatBusy?'<button class="btn q" type="button" data-act="stop">Stop</button>':'<button class="btn" type="submit">Send</button>'}</form>`;
  return h+'</section>';
}
function coachContext(A){
  const m=A.m,r=v=>Math.round(v/100)*100;
  return[
    `Data source: ${S.demo?'a SAMPLE statement for a fictional person named Tolu (make clear this is sample data if relevant)':"the user's own uploaded bank statement"}, ${fmtDY(A.from)} to ${fmtDY(A.to)}.`,
    `Monthly income ₦${r(m.income)}; monthly spending (net) ₦${r(m.spend)}; kept ₦${r(m.kept)} (${pct(A.keptRate)}).`,
    `Of every ₦100 earned: ${A.per100.map(p=>`${p.label} ₦${Math.round(p.v)}`).join(', ')}, kept ₦${Math.round(A.keptPer100)}.`,
    `Top categories per month: ${A.cats.slice(0,9).map(c=>`${c.cat} ₦${r(c.m)}`).join('; ')}.`,
    `Moved to savings per month: ₦${r(m.saving)}. Loan repayments per month: ₦${r(m.debt)}.`,
    A.front!=null?`Share of lifestyle spending in the first 7 days after payday: ${pct(A.front)}.`:'Payday timing unknown.',
    A.weekendShare!=null?`Weekend (Fri-Sun) share of lifestyle spending: ${pct(A.weekendShare)}.`:'',
    `Bank fees and levies per month: ₦${r(m.fees)}. Subscriptions per month: ₦${r(A.subsM)} (${A.subs.map(s=>s.name).join(', ')||'none'}).`,
    m.betOut>0?`Betting per month: staked ₦${r(m.betOut)}, won back ₦${r(m.betIn)}, net loss ₦${r(Math.max(0,m.betNet))}.`:'No betting.',
    `Cash withdrawals per month ₦${r(m.cash)}; transfers to people and giving ₦${r(m.transfer+m.giving)}.`,
    `Habit score ${A.score.total}/100 (Ledger's own habits measure, not a credit score). Archetype: ${A.arch.name}. Traits: ${A.traits.map(t=>ARCH[t.id].chip).join(', ')||'none'}.`,
    S.quiz?`User's stated goal: ${GOALS[S.quiz.goal]||'not given'}.`:'',
    S.challenges.active.length?`Active challenges: ${S.challenges.active.map(c=>CHAL[c.id]?.title).join(', ')}.`:''
  ].filter(Boolean).join('\n');
}
function coachRules(A){
  return`You are the coach inside Ledger, a money-habits app for people in Nigeria. You teach and encourage. You are not a licensed financial adviser.
Rules:
- Base every answer on the numbers below. Use ₦ and round to the nearest ₦100.
- Keep answers under 140 words. Warm, plain and direct. End with one concrete next step the user can do this week.
- Education only. Never recommend a specific bank, fintech app, loan app, fund, stock, crypto asset or investment product, and never tell the user to buy, sell or invest in any specific asset. You may explain general ideas (budgeting, emergency funds, inflation, interest, fees, debt payoff methods) and suggest they compare regulated options themselves.
- Never promise returns or outcomes.
- For tax or legal questions, debts they cannot repay, or gambling that feels out of control, say that a qualified professional or someone they trust can help, and still give one small safe step.
- Do not claim you can see individual transactions, connect to a bank or move money.
- Plain text only: no headings, no tables. Short dash lists are fine.

The user's numbers:
${coachContext(A)}`;
}
async function serverCoach(summary,messages,signal){
  let res;
  try{res=await fetch(COACH_API,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({summary,messages}),signal});}
  catch(e){if(e&&e.name==='AbortError')throw{code:'cancelled'};throw{code:navigator.onLine===false?'offline':'upstream_error'};}
  let data={};try{data=await res.json();}catch(e){}
  if(res.ok&&data.text)return data.text;
  throw{code:res.status===429?'rate_limited':res.status===503||res.status===404?'not_granted':res.status===400?'refused':'upstream_error'};
}
async function ask(q){
  const A=getA();if(!A||chatBusy||!q.trim())return;
  if(IN_VIEWER&&!sampleFn){toast("The AI coach isn't available here.");return;}
  chat.push({role:'user',content:q.trim()});chatDraft='';chatBusy=true;liveText='';render();
  const t=todayISO();if(!S.coachDays[t]){S.coachDays[t]=1;addXP(15,'Asked your coach');award('coach');save();}
  chatCtl=new AbortController();
  const turns=chat.filter(x=>!x.err).slice(-8).map(x=>({role:x.role,content:x.content}));
  try{
    const text=IN_VIEWER
      ?(await sampleFn([{role:'user',content:coachRules(A)},...turns],{cache:false,signal:chatCtl.signal,onText:({text})=>{liveText=text;const el=$('#live');if(el)el.textContent=text;}})).text
      :await serverCoach(coachContext(A),turns,chatCtl.signal);
    chat.push({role:'assistant',content:text});
  }catch(e){
    const code=e&&e.code;
    if(code==='cancelled'){if(e.text)chat.push({role:'assistant',content:e.text});}
    else if(['not_granted','sampling_disabled','not_declared','capability_disabled','capability_removed'].includes(code)){sampleState='none';chat.push({role:'assistant',content:"Your coach can't answer in this view. The coach feed on Home still works.",err:true});}
    else chat.push({role:'assistant',content:code==='rate_limited'?'You have asked a lot of questions in a short time. Try again in a little while.':code==='offline'?"You're offline. Your coach needs internet to answer; everything else in Ledger works offline.":code==='session_expired'?'Sign in to Claude again to keep chatting.':code==='refused'?"I can't help with that one. Try asking another way.":(e&&e.text?e.text+'\n\n(Interrupted. Try again.)':'Something went wrong on the way. Try again.'),err:true});
  }finally{chatBusy=false;liveText='';chatCtl=null;if(tab==='coach')render();}
}

/* ---------- me ---------- */
function viewMe(){
  const lv=levelOf(S.xp),nx=LEVELS.find(l=>l.xp>S.xp),st=streak(),t=todayISO();
  const cal=Array.from({length:28},(_,i)=>{const d=addDays(t,i-27),c=S.checkins[d];return`<i class="${c?c.mood:''} ${d===t?'today':''}" title="${fmtD(d)}${c?': '+c.mood:''}"></i>`;}).join('');
  const hist=Object.entries(S.scoreHist).sort().slice(-30);
  let spark='';
  if(hist.length>=2){const W=300,Hh=70,xs=i=>8+i*(W-16)/(hist.length-1),ys=v=>Hh-8-(Hh-16)*v/100;const pts=hist.map(([,v],i)=>`${xs(i)},${ys(v)}`).join(' ');spark=`<svg viewBox="0 0 ${W} ${Hh}" style="width:100%;max-width:360px;height:auto" role="img" aria-label="Habit score history"><line x1="8" x2="${W-8}" y1="${ys(50)}" y2="${ys(50)}" stroke="var(--line)"/><polyline points="${pts}" fill="none" stroke="var(--green)" stroke-width="2.5" stroke-linejoin="round"/><circle cx="${xs(hist.length-1)}" cy="${ys(hist[hist.length-1][1])}" r="4.5" fill="var(--green)"/></svg>`;}
  const moods=Object.values(S.checkins);const tense=moods.filter(c=>c.mood==='tense'),tenseLot=tense.filter(c=>c.spend==='lot').length;
  const c=S.consent;
  return`<div class="stack">
  <div class="grid2">
   <section class="card"><div class="head"><div><h2>Level ${lv.n}: ${lv.name}</h2><p class="muted small">${S.xp} XP${nx?` · ${nx.xp-S.xp} XP to ${nx.name}`:' · top level reached'}</p></div><span class="chip warn">${ic('star')}${S.xp} XP</span></div>
    <div class="xp" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${nx?Math.round((S.xp-lv.xp)/(nx.xp-lv.xp)*100):100}"><i style="width:${nx?(S.xp-lv.xp)/(nx.xp-lv.xp)*100:100}%"></i></div>
    <p class="tiny" style="margin-top:10px">Earn XP by checking in daily, finishing challenges and lessons, tagging transactions and uploading statements.</p></section>
   <section class="card"><div class="head"><div><h2>${st}-day streak</h2><p class="muted small">Last 4 weeks, coloured by how money felt</p></div></div><div class="cal">${cal}</div>
    <div class="legend"><span><i style="background:var(--green)"></i>Calm</span><span><i style="background:var(--blue)"></i>Okay</span><span><i style="background:var(--coral)"></i>Tense</span></div>
    ${tense.length>=3?`<p class="small muted" style="margin-top:8px">On ${tense.length} tense days you logged big unplanned spends ${tenseLot} times.</p>`:''}</section>
  </div>
  <section class="card"><div class="head"><div><h2>Badges</h2><p class="muted small">${S.badges.length} of ${BADGES.length} earned</p></div></div><div class="badges">${BADGES.map(([id,n,how,sym])=>`<div class="badge ${S.badges.includes(id)?'on':''}" title="${esc(how)}"><div class="hex">${sym}</div><b>${n}</b><div class="tiny">${S.badges.includes(id)?'Earned':esc(how)}</div></div>`).join('')}</div></section>
  <div class="grid2">
   <section class="card"><h2>Habit score over time</h2>${spark||'<p class="muted small" style="margin-top:6px">Your score is saved each day you have your own statement loaded. Come back tomorrow to start the line.</p>'}${getA()?`<p class="small muted" style="margin-top:8px">Biggest lever right now: ${esc(getA().score.lever.tip.toLowerCase())}.</p>`:''}</section>
   <section class="card"><h2>Your profile</h2>${S.quiz?`<p class="muted small" style="margin-top:6px">Goal: ${GOALS[S.quiz.goal]||'not set'}.</p>`:'<p class="muted small" style="margin-top:6px">Take the five-question quiz so your coach knows your goal and style.</p>'}<div class="row" style="margin-top:12px"><button class="btn q sm" data-act="quiz">${S.quiz?'Retake quiz':'Take the quiz'}</button></div></section>
  </div>
  <section class="card" id="privacy"><div class="head"><div><h2>Privacy & data</h2><p class="muted small">Ledger never connects to your bank. Statements are read on this device and the files are never uploaded.</p></div></div>
   <label class="toggle" for="tg-store"><div><b>Remember my data on this device</b><span>Keeps your transactions between visits. Off means everything clears when you close the page.</span></div><span class="switch"><input type="checkbox" id="tg-store" data-change="tg-store" ${c.store?'checked':''}><i></i></span></label>
   <label class="toggle" for="tg-ai"><div><b>AI coach</b><span>Sends a summary of your numbers to Claude when you ask a question. Never transactions, files or names.</span></div><span class="switch"><input type="checkbox" id="tg-ai" data-change="tg-ai" ${c.ai?'checked':''}><i></i></span></label>
   <div class="row" style="margin-top:14px"><button class="btn q sm" data-act="export">Download my data</button><button class="btn q sm" data-act="wipe-ask">Delete everything</button></div>
   <div id="wipeBox"></div>
   <p class="tiny" style="margin-top:12px">Ledger gives financial education based on your own data. It is not licensed investment, tax or legal advice.</p>
   ${!IN_VIEWER?`<p class="small" style="margin-top:10px"><a href="privacy.html">Privacy policy</a> · <a href="terms.html">Terms of use</a></p>`:''}
   ${CONTACT_EMAIL?`<p class="small muted" style="margin-top:6px">Questions or feedback: <span style="user-select:all">${esc(CONTACT_EMAIL)}</span></p>`:''}</section>
  ${!IN_VIEWER&&/iphone|ipad|ipod/i.test(navigator.userAgent)&&!navigator.standalone?'<section class="card"><h2>Put Ledger on your home screen</h2><p class="muted small" style="margin-top:6px">In Safari, tap the Share button, then "Add to Home Screen". Ledger then opens like an app and works offline.</p></section>':''}
  </div>`;
}

/* ================= actions ================= */
function onDataChanged(opts={}){
  dataVer++;const A=getA();
  if(A&&!S.demo){
    S.scoreHist[todayISO()]=A.score.total;
    if(A.score.total>=70)award('s70');if(A.keptRate>=0.2)award('kept');
    verifyChallenges(A);
  }
  if(opts.reveal)revealNext=true;
  save();render();
}
function verifyChallenges(A){
  const T=S.txns;if(!T.length)return;
  const maxD=T.reduce((m,t)=>t.date>m?t.date:m,T[0].date),minD=T.reduce((m,t)=>t.date<m?t.date:m,T[0].date);
  for(const c of [...S.challenges.active,...S.challenges.done]){
    const d=CHAL[c.id];if(!d||!d.cap||c.verified)continue;
    const end=addDays(c.start,d.days-1);if(maxD<end||minD>c.start)continue;
    const spent=T.filter(t=>t.amt<0&&t.cat===d.cap.cat&&t.date>=c.start&&t.date<=end).reduce((s,t)=>s-t.amt,0);
    const pre=T.filter(t=>t.amt<0&&t.cat===d.cap.cat&&t.date<c.start),preDays=Math.max(1,daysBetween(minD,c.start));
    const target=d.cap.mult*(pre.reduce((s,t)=>s-t.amt,0)/preDays*7);
    c.result={spent,target,pass:spent<=target+1};
    if(c.result.pass){c.verified=true;addXP(50,'Verified by your statement');award('ver');}
  }
}
function startChallenge(id){
  const d=CHAL[id];if(!d)return;
  if(S.challenges.active.some(c=>c.id===id)){tab='grow';render();return;}
  if(S.challenges.active.length>=3){toast('Finish or drop a challenge first. Three at a time.');tab='grow';render();return;}
  const A=getA();
  S.challenges.active.push({id,start:todayISO(),checks:[],list:d.list?d.list(A):null,done:{},tag0:S.tags});
  addXP(10,'Challenge started');tab='grow';save();render();
}
function checkChallengeDone(c){
  const d=CHAL[c.id];let ok=false;
  if(d.kind==='daily'||d.kind==='weekly')ok=c.checks.length>=d.need;
  else if(d.kind==='checklist')ok=c.list.every((_,i)=>c.done[i]);
  else if(d.kind==='tag')ok=S.tags-c.tag0>=d.need;
  if(!ok)return;
  S.challenges.active=S.challenges.active.filter(x=>x!==c);
  S.challenges.done.push({id:c.id,start:c.start,end:todayISO(),verified:!!c.verified,result:c.result||null});
  addXP(d.xp,d.title+' complete');award('c1');if(S.challenges.done.length>=5)award('c5');if(c.id==='no-bet')award('clean');
  celebrate('Challenge complete',`${d.title} is done. That's a habit taking shape.`,'check');
}
function expireChallenges(){
  const t=todayISO();
  S.challenges.active=S.challenges.active.filter(c=>{const d=CHAL[c.id];if(!d)return false;if(daysBetween(c.start,t)>=d.days+3&&(d.kind==='daily'||d.kind==='weekly')){S.challenges.ended.push({id:c.id,start:c.start});return false;}return true;});
}
function openConsent(then){
  openSheet(`<button class="btn q sm x" data-act="close" aria-label="Close">${ic('x')}</button><h2>Before Ledger reads your statement</h2>
   <p class="muted small">Ledger doesn't connect to your bank. You choose a statement you already have, and it is read here on this device.</p>
   <div><label class="toggle" for="cs-read"><div><b>Read my statement on this device</b><span>Needed to find your income, spending and patterns. The file itself is never uploaded or stored.</span></div><span class="switch"><input type="checkbox" id="cs-read" checked disabled><i></i></span></label>
   <label class="toggle" for="cs-store"><div><b>Remember my data on this device</b><span>Keeps your transactions for next time. Leave off to clear everything when you close the page.</span></div><span class="switch"><input type="checkbox" id="cs-store" checked><i></i></span></label></div>
   <p class="tiny">Ledger gives financial education based on your own data. It is not licensed investment, tax or legal advice. You can download or delete your data at any time in Me.</p>
   <button class="btn" data-act="consent-go">Agree and continue</button>`);
  consentThen=then;
}
let consentThen=null;
async function ingestFile(f,password){
  if(!isWide()&&tab!=='statements'){tab='statements';render();}
  setU({busy:true,msg:`Reading ${f.name}…`});
  const ext=(f.name.split('.').pop()||'').toLowerCase();
  try{
    const buf=await f.arrayBuffer();let rows,kind;
    if(ext==='pdf'||f.type==='application/pdf'){rows=await pdfToRows(buf,password);kind='pdf';}
    else if(ext==='xlsx'||ext==='xls'){rows=await xlsxToRows(buf);kind='xlsx';}
    else{rows=textToRows(new TextDecoder().decode(buf));kind='text';}
    finishIngest(rows,kind,f.name);
  }catch(err){
    if(err&&err.name==='PasswordException'){pendingFile=f;setU({needPassword:true,wrong:err.code===2});const p=$('#pwIn');if(p)p.focus();return;}
    if(err&&err.message==='load'){setU({error:"Couldn't load the statement reader. Check your internet connection and try again."});return;}
    setU({error:"Ledger couldn't read this file. Try the Excel or CSV export from your bank, or paste the rows as text."});
  }
}
function finishIngest(rows,kind,name){
  if(!isWide()&&tab!=='statements'){tab='statements';render();}
  const {txns}=parseStatement(rows,kind);
  if(txns.length<3){setU({error:kind==='pdf'&&rows.length<8?'This PDF has no readable text. It may be a scanned image. Download the digital statement from your bank app, or use the Excel or CSV export.':'Ledger found fewer than 3 transactions. Check that this is a bank statement with dates and amounts.'});return;}
  const first=S.demo||!S.statements.length;
  if(S.demo){S.demo=false;S.txns=[];S.statements=[];}
  const key=t=>t.date+'|'+t.amt.toFixed(2)+'|'+merchantKey(t.desc);
  const have={};S.txns.forEach(t=>{const k=key(t);have[k]=(have[k]||0)+1;});
  const sid='s'+Date.now().toString(36);let dups=0;const added=[];
  for(const t of txns){const k=key(t);if(have[k]){have[k]--;dups++;continue;}added.push(enrich(t,sid));}
  if(!added.length){setU({error:`All ${dups} transactions in this file are already on this device.`});return;}
  const ds=added.map(t=>t.date).sort();
  S.txns.push(...added);
  S.statements.push({id:sid,name,kind,count:added.length,from:ds[0],to:ds[ds.length-1],added:todayISO()});
  setU({ok:`Added ${added.length} transactions, ${fmtD(ds[0])} to ${fmtDY(ds[ds.length-1])}.${dups?` Skipped ${dups} already here.`:''}`});
  pasteOpen=false;pasteDraft='';
  addXP(first?100:40,first?'First statement':'Statement added');award('books');
  if(!isWide())tab='home';
  onDataChanged({reveal:true});
}
function openTxns(filter){
  const T=[...getTxns()].sort((a,b)=>a.date<b.date?1:-1);
  let rows=T;
  if(filter==='untagged')rows=T.filter(t=>t.amt<0&&!t.tagged&&(t.cat==='Transfers to people'||t.cat==='Other spending'));
  else if(filter&&filter!=='all')rows=T.filter(t=>t.cat===filter);
  const shown=rows.slice(0,txLimit);
  const opts=(t)=>(t.amt<0?CATS:CREDIT_CATS).map(c=>`<option ${c.c===t.cat?'selected':''}>${esc(c.c)}</option>`).join('');
  const cats=[...new Set(T.map(t=>t.cat))].sort();
  openSheet(`<div class="row" style="justify-content:space-between"><h2>Transactions</h2><button class="btn q sm" data-act="close" aria-label="Close">${ic('x')}</button></div>
   ${S.demo?'<p class="tiny">Sample data. Tags you set here reset when you upload your own statement.</p>':''}
   <div class="row"><label class="sr" for="txFilter">Filter</label><select id="txFilter" data-change="tx-filter" style="max-width:260px"><option value="all">All transactions (${T.length})</option><option value="untagged" ${filter==='untagged'?'selected':''}>Needs a tag</option>${cats.map(c=>`<option ${c===filter?'selected':''}>${esc(c)}</option>`).join('')}</select>
   <label class="row small" style="gap:6px"><input type="checkbox" id="txSimilar" checked style="width:18px;height:18px;accent-color:var(--green)"> Apply to similar</label></div>
   <div>${shown.map(t=>`<div class="tx"><div><div class="d">${fmtDY(t.date)}</div><div class="ds">${esc(t.desc)}</div></div><select aria-label="Category for ${esc(t.desc)}" data-change="retag" data-arg="${t.id}">${opts(t)}</select><div class="amt ${t.amt>0?'in':''}">${t.amt>0?'+':''}${naira(t.amt)}</div></div>`).join('')||'<p class="muted small">Nothing here. Everything is tagged.</p>'}</div>
   ${rows.length>shown.length?`<button class="btn q" data-act="tx-more" data-arg="${esc(filter||'all')}">Show more (${rows.length-shown.length} left)</button>`:''}`,true);
  txFilter=filter;
}
let txLimit=120,txFilter='all';
function retag(id,cat){
  const T=getTxns();const t=T.find(x=>x.id===id);if(!t)return;
  const credit=t.amt>0,sim=$('#txSimilar')?.checked;
  const targets=sim?T.filter(x=>x.mk===t.mk&&(x.amt>0)===credit):[t];
  targets.forEach(x=>{x.cat=cat;x.type=typeOf(cat,credit);x.tagged=true;});
  S.tags++;const d=todayISO();if(S.tagXP.d!==d)S.tagXP={d,n:0};
  if(S.tagXP.n<10){S.tagXP.n++;addXP(5,'Tagged');}
  if(S.tags>=10)award('tag');
  S.challenges.active.filter(c=>CHAL[c.id]?.kind==='tag').forEach(checkChallengeDone);
  if(targets.length>1)toast(`Tagged ${targets.length} similar as ${cat}`);
  dataVer++;save();render();
}
function openManual(){
  const f=(id,l)=>`<label class="f" for="mn-${id}">${l}<input type="number" inputmode="numeric" min="0" id="mn-${id}" placeholder="0"></label>`;
  openSheet(`<div class="row" style="justify-content:space-between"><h2>Enter numbers by hand</h2><button class="btn q sm" data-act="close" aria-label="Close">${ic('x')}</button></div>
   <p class="muted small">Rough monthly amounts in naira are fine. Timing insights need a real statement.</p>
   <form class="stack" data-form="manual" style="gap:10px"><div class="grid2" style="gap:10px">${f('inc','Monthly income')}${f('rent','Rent & housing')}${f('food','Food & eating out')}${f('groc','Groceries')}${f('trans','Transport')}${f('bills','Bills, airtime & data')}${f('fun','Shopping & fun')}${f('bet','Betting')}${f('fam','Family & friends')}${f('loan','Loan repayments')}${f('save','Savings')}</div><button class="btn" type="submit">Build my money story</button></form>`);
}
function submitManual(){
  const v=id=>Math.max(0,+($('#mn-'+id)?.value||0));
  const inc=v('inc');if(!inc){toast('Add your monthly income first.');return;}
  const d=todayISO().slice(0,8)+'01';
  const raw=[[inc,'Salary & income'],[-v('rent'),'Rent & housing'],[-v('food'),'Food & eating out'],[-v('groc'),'Groceries'],[-v('trans'),'Transport'],[-v('bills'),'Bills & power'],[-v('fun'),'Shopping'],[-v('bet'),'Betting'],[-v('fam'),'Family & friends'],[-v('loan'),'Loan repayments'],[-v('save'),'Savings & investing']].filter(([a])=>a);
  if(S.demo){S.demo=false;S.txns=[];S.statements=[];}
  S.txns=S.txns.filter(t=>t.src!=='manual');S.statements=S.statements.filter(s=>s.id!=='manual');
  raw.forEach(([amt,cat])=>{const t=enrich({date:d,desc:cat+' (entered by hand)',amt},'manual');t.cat=cat;t.type=typeOf(cat,amt>0);t.tagged=true;S.txns.push(t);});
  S.statements.push({id:'manual',name:'Entered by hand',kind:'manual',count:raw.length,from:d,to:d});
  closeSheet();addXP(40,'Numbers added');tab='home';onDataChanged({reveal:true});
}
function openQuiz(i=0,ans=[]){
  if(i>=QUIZ.length){
    const q={saver:0,spender:0,anxious:0,stable:0,goal:null};
    ans.forEach(a=>{for(const k in a){if(k==='goal')q.goal=a[k];else q[k]+=a[k];}});
    const firstTime=!S.quiz;S.quiz=q;closeSheet();
    if(firstTime){addXP(50,'Quiz finished');award('self');}
    save();render();return;
  }
  const Q=QUIZ[i];quizAns=ans;
  openSheet(`<div class="row" style="justify-content:space-between"><span class="tiny">Question ${i+1} of ${QUIZ.length}</span><button class="btn q sm" data-act="close" aria-label="Close">${ic('x')}</button></div>
   <div class="progress"><i style="width:${i/QUIZ.length*100}%"></i></div><h2>${esc(Q.q)}</h2>
   <div class="stack" style="gap:8px">${Q.o.map(([l],k)=>`<button class="opt" data-act="quiz-ans" data-arg="${i}:${k}">${esc(l)}</button>`).join('')}</div>`);
}
let quizAns=[];
function openLesson(id,answered){
  const L=LESSONS.find(l=>l.id===id);if(!L)return;
  const q=L.q;
  openSheet(`<div class="row" style="justify-content:space-between"><span class="chip info">${ic('book')}${L.min}-minute lesson</span><button class="btn q sm" data-act="close" aria-label="Close">${ic('x')}</button></div>
   <article class="lesson"><h2>${esc(L.title)}</h2>${L.body.map(p=>`<p>${esc(p)}</p>`).join('')}</article>
   <div class="stack" style="gap:8px"><h3>${esc(q.q)}</h3>${q.o.map((o,k)=>`<button class="opt ${answered!=null?(k===q.a?'right':k===answered?'wrong':''):''}" data-act="lesson-ans" data-arg="${id}:${k}" ${answered!=null?'disabled':''}>${esc(o)}</button>`).join('')}
   ${answered!=null?`<p class="small ${answered===q.a?'':'muted'}"><b>${answered===q.a?'Correct.':'Not quite.'}</b> ${esc(q.why)}</p>${answered===q.a?'<button class="btn" data-act="close">Done</button>':`<button class="btn q" data-act="lesson" data-arg="${id}">Try again</button>`}`:''}</div>`);
}
async function doExport(){
  const data={exportedAt:new Date().toISOString(),note:'Everything Ledger holds about you on this device.',consent:S.consent,quiz:S.quiz,statements:S.statements,transactions:S.demo?[]:S.txns.map(({id,src,mk,...t})=>t),xp:S.xp,badges:S.badges,checkins:S.checkins,challenges:S.challenges,lessons:S.lessons};
  const json=JSON.stringify(data,null,2);
  if(!IN_VIEWER){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([json],{type:'application/json'}));a.download='ledger-my-data.json';document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},1000);toast('Saved ledger-my-data.json');return;}
  try{const dl=await window.claude.use('downloads');if(!dl){toast('Downloads are not available in this view.');return;}await dl.save({filename:'ledger-my-data.json',data:json});toast('Saved ledger-my-data.json');}
  catch(e){if(e&&e.code==='declined')return;toast('Could not save the file here. Try again.');}
}

const ACT={
  tab:a=>{tab=a;S.tab=a==='statements'?'home':a;save();render();window.scrollTo({top:0});},
  privacy:()=>{tab='me';render();const p=$('#privacy');if(p)p.scrollIntoView({behavior:reduceMotion()?'auto':'smooth'});},
  pick:()=>{if(U.busy)return;if(!S.consent.read)openConsent(()=>$('#fileIn').click());else $('#fileIn').click();},
  'consent-go':()=>{S.consent.read=true;S.consent.store=!!$('#cs-store')?.checked;S.consent.at=new Date().toISOString();save();const t=consentThen;consentThen=null;closeSheet();if(t)t();},
  paste:()=>{pasteOpen=!pasteOpen;render();if(pasteOpen)$('#pasteBox')?.focus();},
  'paste-go':()=>{const run=()=>{if(!pasteDraft.trim()){setU({error:'Paste some statement rows first.'});return;}finishIngest(textToRows(pasteDraft),'text','Pasted text');};if(!S.consent.read)openConsent(run);else run();},
  manual:()=>{if(!S.consent.read)openConsent(openManual);else openManual();},
  'pw-cancel':()=>{pendingFile=null;setU({});},
  'clear-demo':()=>{S.demo=false;save();dataVer++;render();},
  'load-demo':()=>{if(S.txns.length){toast('Your own data is loaded. Remove it first to view the sample.');return;}S.demo=true;revealNext=true;save();dataVer++;render();},
  'rm-stmt':id=>{S.txns=S.txns.filter(t=>t.src!==id);S.statements=S.statements.filter(s=>s.id!==id);toast('Statement removed from this device');U={};onDataChanged();},
  txns:f=>{txLimit=120;openTxns(f||'all');},
  'tx-more':f=>{txLimit+=200;openTxns(f);},
  close:()=>closeSheet(),
  scrim:(a,el,e)=>{if(e.target===el)closeSheet();},
  'close-cel':(a,el,e)=>{if(e.target===el||el.tagName==='BUTTON'){const c=$('.celebrate');if(c)c.remove();}},
  ci:a=>{const [k,v]=a.split(':');ciDraft[k]=v;if(ciDraft.mood&&ciDraft.spend){const t=todayISO();S.checkins[t]={mood:ciDraft.mood,spend:ciDraft.spend};ciDraft={};dataVer++;const st=streak();addXP(10+(st>=7?10:st>=3?5:0),st>1?`Check-in, day ${st}`:'Daily check-in');if(st>=3)award('s3');if(st>=7)award('s7');if(st>=30)award('s30');save();}render();},
  start:id=>startChallenge(id),
  'ch-check':id=>{const c=S.challenges.active.find(x=>x.id===id);if(!c)return;const d=CHAL[id],t=todayISO();
    if(d.kind==='daily'){if(c.checks.includes(t))return;c.checks.push(t);}else{const w=Math.floor(daysBetween(c.start,t)/7);if(c.checks.includes(w))return;c.checks.push(w);}
    addXP(15,d.title);checkChallengeDone(c);save();render();},
  'ch-drop':id=>{S.challenges.active=S.challenges.active.filter(c=>c.id!==id);toast('Challenge dropped. You can restart it any time.');save();render();},
  lesson:id=>openLesson(id),
  'lesson-ans':a=>{const [id,k]=a.split(':');const L=LESSONS.find(l=>l.id===id);const ok=+k===L.q.a;if(ok&&!S.lessons[id]){S.lessons[id]=todayISO();addXP(20,'Lesson done');if(Object.keys(S.lessons).length>=3)award('learn');save();render();}openLesson(id,+k);},
  quiz:()=>openQuiz(0,[]),
  'quiz-ans':a=>{const [i,k]=a.split(':').map(Number);openQuiz(i+1,[...quizAns,QUIZ[i].o[k][1]]);},
  install:async()=>{if(!installEvt)return;installEvt.prompt();try{await installEvt.userChoice;}catch(e){}installEvt=null;render();},
  'ai-on':()=>{S.consent.ai=true;save();render();},
  ask:q=>ask(q),
  stop:()=>{if(chatCtl)chatCtl.abort();},
  export:()=>doExport(),
  'wipe-ask':()=>{$('#wipeBox').innerHTML=`<div class="status err" style="margin-top:12px"><p class="small"><b>Delete everything on this device?</b> Statements, transactions, XP, badges and check-ins will be removed. This can't be undone.</p><div class="row" style="margin-top:10px"><button class="btn danger sm" data-act="wipe">Delete everything</button><button class="btn q sm" data-act="wipe-no">Keep my data</button></div></div>`;},
  'wipe-no':()=>{$('#wipeBox').innerHTML='';},
  wipe:()=>{try{localStorage.removeItem(KEY);}catch(e){}S=freshState();chat=[];U={};tab='home';dataVer++;save();render();toast('Everything was deleted from this device');}
};
const CHANGE={
  'ch-item':(a,el)=>{const [id,i]=a.split(':');const c=S.challenges.active.find(x=>x.id===id);if(!c)return;c.done[i]=el.checked;if(el.checked)addXP(5,'Step done');checkChallengeDone(c);save();render();},
  retag:(id,el)=>retag(id,el.value),
  'tx-filter':(a,el)=>{txLimit=120;openTxns(el.value);},
  'tg-store':(a,el)=>{if(!el.checked&&!S.demo&&S.txns.length){el.checked=true;$('#wipeBox').innerHTML=`<div class="status err" style="margin-top:12px"><p class="small"><b>Stop remembering your data?</b> Your transactions stay until you close this page, then they're gone from this device.</p><div class="row" style="margin-top:10px"><button class="btn danger sm" data-act="forget">Stop remembering</button><button class="btn q sm" data-act="wipe-no">Cancel</button></div></div>`;return;}S.consent.store=el.checked;save();},
  'tg-ai':(a,el)=>{S.consent.ai=el.checked;if(!el.checked){chat=[];}save();}
};
ACT.forget=()=>{S.consent.store=false;save();$('#wipeBox').innerHTML='';render();toast('Ledger will forget your transactions when you close this page');};

document.addEventListener('click',e=>{const el=e.target.closest('[data-act]');if(!el)return;const f=ACT[el.dataset.act];if(f){if(el.tagName==='A')e.preventDefault();f(el.dataset.arg,el,e);}});
document.addEventListener('keydown',e=>{
  if(e.key==='Escape'){const c=$('.celebrate');if(c){c.remove();return;}if($('#sheetRoot .scrim'))closeSheet();}
  const d=e.target.closest&&e.target.closest('.drop');if(d&&(e.key==='Enter'||e.key===' ')){e.preventDefault();ACT.pick();}
  if(e.target.id==='chatIn'&&e.key==='Enter'&&!e.shiftKey){e.preventDefault();ask(chatDraft);}
});
document.addEventListener('change',e=>{const el=e.target.closest('[data-change]');if(el&&CHANGE[el.dataset.change])CHANGE[el.dataset.change](el.dataset.arg,el);});
document.addEventListener('input',e=>{const k=e.target.dataset&&e.target.dataset.input;if(k==='paste')pasteDraft=e.target.value;if(k==='chat')chatDraft=e.target.value;});
document.addEventListener('submit',e=>{e.preventDefault();const f=e.target.dataset.form;
  if(f==='pw'){const pw=$('#pwIn').value;if(pendingFile&&pw)ingestFile(pendingFile,pw);}
  if(f==='chat')ask(chatDraft);
  if(f==='manual')submitManual();});
$('#fileIn').addEventListener('change',e=>{const f=e.target.files[0];e.target.value='';if(f)ingestFile(f);});
document.addEventListener('dragover',e=>{if(e.dataTransfer&&[...e.dataTransfer.types].includes('Files')){e.preventDefault();const d=e.target.closest&&e.target.closest('.drop');document.querySelectorAll('.drop.over').forEach(x=>x!==d&&x.classList.remove('over'));if(d)d.classList.add('over');}});
document.addEventListener('dragleave',e=>{const d=e.target.closest&&e.target.closest('.drop');if(d&&!d.contains(e.relatedTarget))d.classList.remove('over');});
document.addEventListener('drop',e=>{if(!e.dataTransfer||!e.dataTransfer.files.length)return;e.preventDefault();document.querySelectorAll('.drop.over').forEach(x=>x.classList.remove('over'));const d=e.target.closest&&e.target.closest('.drop');if(!d)return;const f=e.dataTransfer.files[0];if(!S.consent.read)openConsent(()=>ingestFile(f));else ingestFile(f);});
mq.addEventListener('change',()=>render());

/* ================= boot ================= */
expireChallenges();
if(!S.demo&&!S.txns.length&&S.statements.length){S.statements=[];}
render();
if(IN_VIEWER){(async()=>{try{sampleFn=await window.claude.use('sample');}catch(e){sampleFn=null;}sampleState=sampleFn?'ready':'none';if(tab==='coach')render();})();}
else{
  sampleState='ready';
  if('serviceWorker' in navigator&&/^https?:$/.test(location.protocol))window.addEventListener('load',()=>navigator.serviceWorker.register('sw.js').catch(()=>{}));
  window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();installEvt=e;render();});
  window.addEventListener('appinstalled',()=>{installEvt=null;toast('Ledger is installed');render();});
}
