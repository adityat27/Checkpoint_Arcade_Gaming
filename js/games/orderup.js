/* =========================================================================
   ORDER UP! — online co-op cooking for two.
   Both chefs share one kitchen, one order board and one score. A counter runs
   down the middle: one side has the ingredients, the other has the stoves, so
   every dish has to be passed across. Neither chef can finish an order alone.

   Networking: the room host's browser is the kitchen's single source of truth.
   It runs the timer, orders, stoves and score, applies both chefs' actions in
   order and sends the full kitchen to the partner after every change. Each chef
   moves on their own screen with no delay; positions stream 30x a second.
   If the host drops out and comes back, the partner's browser takes over.

   Everything about kitchens, ingredients and recipes is plain data below.
   ========================================================================= */
(()=>{
/* ---------------- tuning ---------------- */
const DEF={chop:1.3,pot:9,potBurn:10,pan:6,panBurn:8,speed:3.8,dash:2.1,R:0.3,plates:3,plateBack:6,
  maxOrders:4,wrongPen:5,expirePen:10,tipMax:10};

/* ---------------- ingredients & recipes ---------------- */
const ING={
  tomato:{n:'Tomato',chop:1,soup:1,col:'#ff4d4d'},
  onion:{n:'Onion',chop:1,soup:1,col:'#c77dba'},
  mushroom:{n:'Mushroom',chop:1,soup:1,col:'#c98b5a'},
  carrot:{n:'Carrot',chop:1,soup:1,col:'#ff9a2e'},
  lettuce:{n:'Lettuce',chop:1},
  cheese:{n:'Cheese',chop:1},
  bun:{n:'Bun'},
  tortilla:{n:'Tortilla'},
  meat:{n:'Meat',chop:1,fry:1},
  fish:{n:'Fish',chop:1,fry:1},
  potato:{n:'Potato',chop:1,fry:1},
};
/* what a fried ingredient is called at each stage */
const FRYN={meat:{raw:'meat',chopped:'raw patty',cooked:'patty',burnt:'burnt patty'},
  fish:{raw:'fish',chopped:'fish fillet',cooked:'fried fish',burnt:'burnt fish'},
  potato:{raw:'potato',chopped:'cut potato',cooked:'fries',burnt:'burnt fries'}};
/* soups: 3 chopped ingredients in a pot. `mix` is the exact pot contents. */
const SOUPS={
  tomato:{n:'Tomato',mix:['tomato','tomato','tomato'],col:'#ff4d4d'},
  onion:{n:'Onion',mix:['onion','onion','onion'],col:'#c77dba'},
  mushroom:{n:'Mushroom',mix:['mushroom','mushroom','mushroom'],col:'#c98b5a'},
  carrot:{n:'Carrot',mix:['carrot','carrot','carrot'],col:'#ff9a2e'},
  veggie:{n:'Veggie',mix:['carrot','onion','tomato'],col:'#d9682c'},
};
const CRATE={T:'tomato',O:'onion',M:'mushroom',R:'carrot',L:'lettuce',Z:'cheese',B:'bun',Y:'tortilla',P:'meat',H:'fish',U:'potato'};
const RECIPES={
  tsoup:{n:'Tomato Soup',need:['soup:tomato'],pts:20,time:80,col:'#ff4d4d'},
  osoup:{n:'Onion Soup',need:['soup:onion'],pts:20,time:80,col:'#c77dba'},
  msoup:{n:'Mushroom Soup',need:['soup:mushroom'],pts:22,time:80,col:'#c98b5a'},
  csoup:{n:'Carrot Soup',need:['soup:carrot'],pts:20,time:80,col:'#ff9a2e'},
  vsoup:{n:'Veggie Stew',need:['soup:veggie'],pts:28,time:90,col:'#d9682c'},
  salad:{n:'Garden Salad',need:['lettuce:chopped','tomato:chopped'],pts:16,time:60,col:'#2fae4f'},
  csalad:{n:'Chef Salad',need:['lettuce:chopped','tomato:chopped','cheese:chopped'],pts:24,time:70,col:'#7fcf3a'},
  burger:{n:'Burger',need:['bun:raw','meat:cooked'],pts:22,time:75,col:'#e19a4a'},
  deluxe:{n:'Deluxe Burger',need:['bun:raw','lettuce:chopped','meat:cooked'],pts:30,time:85,col:'#8b4a2b'},
  cburger:{n:'Cheeseburger',need:['bun:raw','cheese:chopped','meat:cooked'],pts:30,time:85,col:'#ffc61a'},
  fries:{n:'Fries',need:['potato:cooked'],pts:14,time:55,col:'#ffcf3f'},
  fishchips:{n:'Fish & Chips',need:['fish:cooked','potato:cooked'],pts:30,time:85,col:'#5aa9e6'},
  taco:{n:'Beef Taco',need:['tortilla:raw','meat:cooked','lettuce:chopped'],pts:28,time:80,col:'#f0b33c'},
  fishtaco:{n:'Fish Taco',need:['tortilla:raw','fish:cooked','cheese:chopped'],pts:30,time:80,col:'#3fb6c9'},
};
/* Kitchen maps. One character per tile:
   .  floor            1 2  chef start (floor)     #  counter      |  pass counter (middle)
   W  wall             C  chopping board          K  stove + pot   F  stove + frying pan
   D  plate stack      X  bin                      S  serving window
   crates: T tomato  O onion  M mushroom  R carrot  L lettuce  Z cheese
           B bun     Y tortilla  P meat  H fish  U potato                          */
const LEVELS=[
  {n:'Soup Shack',desc:'Soups and salads. A gentle warm-up.',time:180,every:18,stars:[60,140,220],
   recipes:['tsoup','osoup','salad'],roles:['Prep · chop · serve','Cook · plate'],
   map:['#TO#LC|#K#K##',
        '#.....|.....#',
        'S.....|.....D',
        '#..1..|..2..#',
        'C.....|.....X',
        '#.....|.....#',
        '##X###|######']},
  {n:'Burger Bar',desc:'Chop the meat, fry the patties, build the burgers.',time:180,every:17,stars:[60,150,240],
   recipes:['burger','deluxe','salad'],roles:['Prep · chop · serve','Fry · plate'],
   map:['#BP#CT|#F#F##',
        '#.....|.....#',
        'S..1..|..2..D',
        'L.....|.....#',
        'C.....|.....X',
        '#.....|.....#',
        '###X##|######']},
  {n:'Garden Bistro',desc:'Carrot soup, veggie stew (carrot + onion + tomato) and a cheesy chef salad.',time:190,every:16,stars:[70,160,250],
   recipes:['csoup','vsoup','csalad','salad'],roles:['Prep · chop · serve','Cook · plates'],
   map:['#RTOL#Z|#K#K#K#',
        '#......|......#',
        'S......|......D',
        'C..1...|...2..#',
        '#......|......X',
        'C......|......#',
        '##X#C##|#######']},
  {n:'Taco Truck',desc:'Tortillas, fried fish, cheese. Build the tacos and serve them hot.',time:190,every:16,stars:[70,170,260],
   recipes:['taco','fishtaco','cburger'],roles:['Prep · chop','Fry · plate · serve'],
   map:['#YPHL#C|#F#F#F#',
        '#......|......#',
        'Z......|......S',
        '#..1...|...2..#',
        'B......|......D',
        'C......|......X',
        '##X#C##|#######']},
  {n:'Seaside Chippy',desc:'Fish & chips by the sea. Walls split the pass, so plan your hand-offs.',time:190,every:15,stars:[70,170,260],
   recipes:['fries','fishchips','csoup'],roles:['Prep · chop','Fry · cook · serve'],
   map:['#UHR#C|#F#F#K#',
        '#.....W......#',
        'C.....|......K',
        '#..1..W...2..#',
        'C.....|......S',
        '#.....W......D',
        '##X###|####X##']},
  {n:'Midnight Rush',desc:'Everything at once, and only two spots to pass food.',time:200,every:14,stars:[70,170,270],
   recipes:['tsoup','osoup','burger','deluxe'],roles:['Prep · chop · plates','Cook · fry · serve'],
   map:['#TOPB#C|#K#K#F#',
        '#......W......#',
        'L......|......S',
        '#..1...W...2..F',
        'C......|......#',
        '#......W......#',
        '##D#X##|##X####']},
  {n:'Grand Diner',desc:'The whole menu. Ten crates, five stoves, one very busy night.',time:240,every:13,stars:[90,210,330],
   recipes:['tsoup','vsoup','cburger','fishchips','taco'],roles:['Prep · chop · plates','Cook · fry · serve'],
   map:['#TORBP#C|#K#K#FF#',
        '#.......W.......#',
        'H.......|.......S',
        'U..1....W....2..F',
        'Y.......|.......#',
        'L.......W.......X',
        'Z.......|.......#',
        '#C#X#C#D|########']},
];
const key=it=>it.k==='soup'?'soup:'+it.of:it.k+':'+it.s;
const keyItem=k=>{const[a,b]=k.split(':');return a==='soup'?{k:'soup',of:b}:{k:a,s:b}};
function iname(it){
  if(!it)return'';if(it.k==='plate')return it.c.length?dishName(it):'plate';
  if(it.k==='soup')return(SOUPS[it.of]?SOUPS[it.of].n:'mystery').toLowerCase()+(it.of==='veggie'?' stew':' soup');
  if(FRYN[it.k])return FRYN[it.k][it.s]||it.k;
  const n=ING[it.k].n.toLowerCase();return it.s==='chopped'?'chopped '+n:n;
}
const sortJ=a=>a.slice().sort().join();
/* which soup a full pot makes (null if the mix isn't a soup) */
function soupOf(c){const k=sortJ(c);for(const id in SOUPS)if(sortJ(SOUPS[id].mix)===k)return id;return null}
/* soups this kitchen's menu asks for */
function levelSoups(){return LEVELS[W.lvl].recipes.flatMap(r=>RECIPES[r].need).filter(k=>k.startsWith('soup:')).map(k=>k.slice(5))}
/* can ingredient k go into a pot that already holds c? (it must still be able to become a soup on the menu) */
function potAccepts(c,k){if(c.length>=3)return false;const want=c.concat(k);
  return levelSoups().some(id=>{const m=SOUPS[id].mix.slice();return want.every(x=>{const j=m.indexOf(x);if(j<0)return false;m.splice(j,1);return true})})}
/* colour of what's in the pot: the soup's colour once full, otherwise a blend of what's in it */
function potCol(c){const id=c.length===3&&soupOf(c);if(id)return SOUPS[id].col;if(!c.length)return'#2b3040';
  let r=0,g=0,b=0;c.forEach(k=>{const h=parseInt(ING[k].col.slice(1),16);r+=h>>16;g+=h>>8&255;b+=h&255});const n=c.length;return'#'+[r,g,b].map(v=>Math.round(v/n).toString(16).padStart(2,'0')).join('')}
const soupCol=of=>SOUPS[of]?SOUPS[of].col:'#999';
function dishName(p){const ks=p.c.map(key).sort().join();for(const r in RECIPES)if(RECIPES[r].need.slice().sort().join()===ks)return RECIPES[r].n.toLowerCase();return'dish'}

/* ---------------- kitchen geometry ---------------- */
let LV=null;
function parseLevel(n){
  const m=LEVELS[n].map,H=m.length,Wd=m[0].length,ty=[],spawn=[];
  for(let y=0;y<H;y++)for(let x=0;x<Wd;x++){let ch=m[y][x];if(ch==='1'||ch==='2'){spawn[+ch-1]={x:x+.5,y:y+.5};ch='.'}ty.push(ch)}
  LV={n,Wd,H,ty,spawn};
}
const solid=(x,y)=>{if(x<0||y<0||x>=LV.Wd||y>=LV.H)return true;return LV.ty[y*LV.Wd+x]!=='.'};
const tc=i=>({x:i%LV.Wd+.5,y:((i/LV.Wd)|0)+.5});

/* ---------------- shared kitchen state (host is the authority) ---------------- */
let W=null;
const OU={ci:0,auth:false,sn:0,lastSn:0,fxSeen:-1,dirtyAt:0,lastSnap:0,me:null,rbuf:[],off:null,lastFast:0,keys:{},touch:{mx:0,my:0,chop:false},
  chopHeld:false,chopSent:0,chopSeen:[0,0],chopAt:[null,null],hiT:0,gotSnap:false,gone:false,raf:0,simT:0,lastT:0,floats:[],prompt:'',target:-1,prevPh:'',remPos:null,dash:0,dcd:0,walkT:0};
function makeWorld(lvl,hc){
  parseLevel(lvl);
  const w={lvl,ph:'lobby',hc:hc||0,rdy:[0,0],tl:LEVELS[lvl].time,score:0,served:0,failed:0,orders:[],oid:0,next:0,
    t:{},st:{},pc:{},ret:[],h:[null,null],chop:[-1,-1],fx:[],fid:W?W.fid:0,paused:false,rcd:0,cd:0,res:null};
  LV.ty.forEach((c,i)=>{if(c==='K'||c==='F')w.st[i]={c:[],p:0};if(c==='D')w.pc[i]=DEF.plates});
  return w;
}
const dirty=()=>{OU.dirtyAt=OU.dirtyAt||performance.now()};
function addFx(k,i,txt){W.fx.push({id:++W.fid,k,i,txt:txt||''});if(W.fx.length>14)W.fx.shift()}

/* ---------------- rules: what pressing GRAB does at a tile ---------------- */
const isPlate=x=>!!x&&x.k==='plate';
function canAdd(p,it){
  if(!isPlate(p)||!it||it.k==='plate'||p.c.length>=3)return false;
  const ks=p.c.map(key).concat(key(it));
  return LEVELS[W.lvl].recipes.some(r=>{const need=RECIPES[r].need.slice();return ks.every(k=>{const j=need.indexOf(k);if(j<0)return false;need.splice(j,1);return true})});
}
function grabRule(ci,i){
  const ty=LV.ty[i],h=W.h[ci],set=v=>{W.h[ci]=v};
  if(CRATE[ty]){const it={k:CRATE[ty],s:'raw'};
    if(!h)return{lbl:'Take '+iname(it),apply:()=>{set(it);addFx('pick',i)}};
    if(isPlate(h)&&canAdd(h,it))return{lbl:'Add '+iname(it)+' to plate',apply:()=>{h.c.push(it);addFx('pick',i)}};
    return null}
  if(ty==='#'||ty==='|'||ty==='C'){const c=W.t[i];
    if(!h&&c)return{lbl:'Pick up '+iname(c),apply:()=>{set(c);W.t[i]=null;stopChopAt(i);addFx('pick',i)}};
    if(h&&!c)return{lbl:(ty==='|'?'Pass ':'Put down ')+iname(h),apply:()=>{W.t[i]=h;set(null);addFx('drop',i)}};
    if(h&&c){
      if(isPlate(h)&&!isPlate(c)&&canAdd(h,c))return{lbl:'Plate the '+iname(c),apply:()=>{h.c.push(c);W.t[i]=null;stopChopAt(i);addFx('drop',i)}};
      if(isPlate(c)&&!isPlate(h)&&canAdd(c,h))return{lbl:'Put '+iname(h)+' on the plate',apply:()=>{c.c.push(h);set(null);addFx('drop',i)}};
    }
    return null}
  if(ty==='K'){const s=W.st[i],ready=s.c.length===3&&s.p>=1&&s.p<2,soup=ready&&{k:'soup',of:soupOf(s.c)};
    if(h&&!isPlate(h)&&h.s==='chopped'&&ING[h.k]&&ING[h.k].soup&&s.p===0&&potAccepts(s.c,h.k))
      return{lbl:`Add ${iname(h)} to pot (${s.c.length+1}/3)`,apply:()=>{s.c.push(h.k);set(null);addFx('plop',i)}};
    // scoop onto an empty plate, or onto a plate that this soup completes
    if(ready&&soup.of&&isPlate(h)&&(!h.c.length||canAdd(h,soup)))
      return{lbl:'Scoop the '+iname(soup),apply:()=>{h.c.push(soup);s.c=[];s.p=0;addFx('pick',i)}};
    if(!h&&s.p>=2)return{lbl:'Dump the burnt soup',apply:()=>{s.c=[];s.p=0;addFx('trash',i)}};
    return null}
  if(ty==='F'){const s=W.st[i],pat=s.c.length?{k:s.c[0],s:'cooked'}:null,cooked=s.c.length&&s.p>=1&&s.p<2;
    if(h&&!isPlate(h)&&ING[h.k]&&ING[h.k].fry&&h.s==='chopped'&&!s.c.length)return{lbl:'Fry the '+iname(h),apply:()=>{s.c=[h.k];s.p=0;set(null);addFx('sizzle',i)}};
    if(!h&&cooked)return{lbl:'Take the '+iname(pat),apply:()=>{set(pat);s.c=[];s.p=0;addFx('pick',i)}};
    if(isPlate(h)&&cooked&&canAdd(h,pat))return{lbl:'Plate the '+iname(pat),apply:()=>{h.c.push(pat);s.c=[];s.p=0;addFx('pick',i)}};
    if(!h&&s.c.length&&s.p>=2)return{lbl:'Dump the '+iname({k:s.c[0],s:'burnt'}),apply:()=>{s.c=[];s.p=0;addFx('trash',i)}};
    return null}
  if(ty==='D'){
    if(!h&&W.pc[i]>0)return{lbl:'Take a plate',apply:()=>{W.pc[i]--;set({k:'plate',c:[]});addFx('pick',i)}};
    if(isPlate(h)&&!h.c.length)return{lbl:'Stack the plate',apply:()=>{W.pc[i]++;set(null);addFx('drop',i)}};
    return null}
  if(ty==='X'){
    if(h&&!isPlate(h))return{lbl:'Bin the '+iname(h),apply:()=>{set(null);addFx('trash',i)}};
    if(isPlate(h)&&h.c.length)return{lbl:'Scrape the plate',apply:()=>{h.c=[];addFx('trash',i)}};
    return null}
  if(ty==='S'){if(isPlate(h)&&h.c.length)return{lbl:'Serve the '+dishName(h)+'!',apply:()=>serve(ci,i)};return null}
  return null;
}
/* a hint for the prompt when GRAB would do nothing here */
function hintAt(ci,i){
  const ty=LV.ty[i],h=W.h[ci];
  if(ty==='K'){const s=W.st[i],ready=s.c.length===3&&s.p>=1&&s.p<2;
    if(ready&&!h)return'Bring an empty plate to scoop the soup';
    if(ready&&isPlate(h))return'Your plate needs to be empty to scoop soup';
    if(ready&&h)return'Soup is ready! Grab a plate to scoop it';
    if(s.c.length===3&&s.p<1)return'Cooking… '+Math.round(s.p*100)+'%';
    if(h&&!isPlate(h)&&h.s==='raw'&&ING[h.k]&&ING[h.k].soup)return'Chop it first on a chopping board';
    if(h&&!isPlate(h)&&h.s==='chopped'&&ING[h.k]&&ING[h.k].soup)return'That doesn\'t go in this soup';
    if(h&&!isPlate(h)&&s.c.length===3)return'This pot is full';}
  if(ty==='F'){const s=W.st[i];
    if(h&&!isPlate(h)&&h.s==='raw'&&ING[h.k]&&ING[h.k].fry)return'Chop it first on a chopping board';
    if(s.c.length&&s.p<1)return'Frying… '+Math.round(s.p*100)+'%';
    if(s.c.length&&s.p<2&&isPlate(h))return'That doesn\'t fit on this plate';}
  if(ty==='S'&&h&&!isPlate(h))return'Put it on a plate before serving';
  if(ty==='S'&&isPlate(h)&&!h.c.length)return'The plate is empty';
  if(CRATE[ty]&&h&&!isPlate(h))return'Your hands are full';
  return'';
}
function canChop(ci,i){const it=W.t[i];return LV.ty[i]==='C'&&!W.h[ci]&&it&&!isPlate(it)&&ING[it.k]&&ING[it.k].chop&&it.s==='raw'}
function stopChopAt(i){for(let c=0;c<2;c++)if(W.chop[c]===i)W.chop[c]=-1}
function serve(ci,i){
  const h=W.h[ci],ks=h.c.map(key).sort().join();
  const o=W.orders.find(o=>RECIPES[o.r].need.slice().sort().join()===ks);
  W.h[ci]=null;W.ret.push(DEF.plateBack);
  if(o){const g=RECIPES[o.r].pts+Math.ceil(DEF.tipMax*o.t/o.T);W.score+=g;W.served++;W.orders.splice(W.orders.indexOf(o),1);addFx('serve',i,'+'+g)}
  else{W.score=Math.max(0,W.score-DEF.wrongPen);W.failed++;addFx('wrong',i,'−'+DEF.wrongPen+' wrong dish')}
}

/* ---------------- simulation ---------------- */
function spawnOrder(){
  const L=LEVELS[W.lvl],pool=L.recipes.filter(r=>W.orders.filter(o=>o.r===r).length<2);
  if(!pool.length)return;
  const r=pool[Math.random()*pool.length|0],T=RECIPES[r].time;
  W.orders.push({id:++W.oid,r,t:T,T});addFx('order',-1);
}
function startRound(){
  const hc=W.hc;W=makeWorld(W.lvl,hc);W.ph='count';W.cd=3.5;W.next=0.4;dirty();
}
function tick(dt,auth){
  if(!W||W.paused||(OU.gone&&!auth))return;
  if(W.rcd>0){W.rcd=Math.max(0,W.rcd-dt);return}
  if(W.ph==='count'){W.cd-=dt;if(W.cd<=0){W.cd=0;if(auth){W.ph='play';addFx('go',-1);dirty()}}return}
  if(W.ph!=='play')return;
  W.tl=Math.max(0,W.tl-dt);
  const now=performance.now();
  for(let c=0;c<2;c++){const i=W.chop[c];if(i<0)continue;
    const it=W.t[i];
    if(auth&&(!canChop(c,i)||!nearTile(c,i)||(c!==OU.ci&&now-OU.chopSeen[c]>800)||(c===OU.ci&&!OU.chopHeld))){W.chop[c]=-1;dirty();continue}
    if(!it||isPlate(it)||it.s!=='raw')continue;
    it.cp=(it.cp||0)+dt/DEF.chop;
    if(it.cp>=1){if(auth){it.s='chopped';delete it.cp;W.chop[c]=-1;addFx('chopped',i);dirty()}else it.cp=0.99}
  }
  for(const i in W.st){const s=W.st[i],pot=LV.ty[i]==='K';
    if(pot?s.c.length!==3:!s.c.length)continue;
    if(s.p>=2)continue;
    const was=s.p;s.p=Math.min(2,s.p+dt/(s.p<1?(pot?DEF.pot:DEF.pan):(pot?DEF.potBurn:DEF.panBurn)));
    if(auth){if(was<1&&s.p>=1){addFx('ready',+i);dirty()}if(was<2&&s.p>=2){addFx('burnt',+i);dirty()}if(was<1.6&&s.p>=1.6)addFx('warn',+i)}
  }
  if(!auth){W.orders.forEach(o=>o.t=Math.max(0,o.t-dt));return}
  for(const o of W.orders.slice()){o.t-=dt;if(o.t<=0){W.orders.splice(W.orders.indexOf(o),1);W.score=Math.max(0,W.score-DEF.expirePen);W.failed++;addFx('expire',-1,'−'+DEF.expirePen+' order missed');dirty()}}
  W.next-=dt;if(!W.orders.length)W.next=Math.min(W.next,1.5);
  if(W.next<=0&&W.orders.length<DEF.maxOrders){spawnOrder();W.next=W.oid<2?7:LEVELS[W.lvl].every;dirty()}
  if(W.ret.length){W.ret=W.ret.map(t=>t-dt);const back=W.ret.filter(t=>t<=0).length;if(back){W.ret=W.ret.filter(t=>t>0);const d=Object.keys(W.pc)[0];W.pc[d]+=back;dirty()}}
  if(W.tl<=0)endRound();
}
function endRound(){
  const L=LEVELS[W.lvl],stars=L.stars.filter(s=>W.score>=s).length;
  W.ph='end';W.res={stars};W.chop=[-1,-1];addFx('end',-1);dirty();
}
/* Is chef c close enough to tile i? For my own chef that's my live position. For the partner
   it's the position they sent with the action (or their newest streamed position), NOT the
   smoothed-on-screen one: that runs ~¼ second behind, which used to make the host reject
   grabs (like scooping soup) that the partner had made right after walking up. */
function remNow(){const b=OU.rbuf;return b.length?b[b.length-1]:OU.remPos}
function nearTile(c,i,at){
  const t=tc(i),ok=p=>!!p&&isFinite(p.x)&&isFinite(p.y)&&Math.hypot(p.x-t.x,p.y-t.y)<1.75;
  if(c===OU.ci)return ok(OU.me);
  if(ok(at))return true;
  const ch=OU.chopAt[c];if(ch&&performance.now()-ch.t<900&&ok(ch))return true;
  return ok(remNow())||ok(OU.remPos);
}

/* ---------------- actions (host applies; partner sends) ---------------- */
function act(ci,a,i,v,at){
  if(!W)return;
  if(a==='ready'){if(W.ph==='lobby'){W.rdy[ci===W.hc?0:1]=v?1:0;dirty();if(W.rdy[0]&&W.rdy[1]&&opp)startRound()}return}
  if(a==='lobby'){if(W.ph==='end'){const hc=W.hc,l=W.lvl;W=makeWorld(l,hc);dirty()}return}
  if(W.paused||W.rcd>0||W.ph!=='play')return;
  if(a==='grab'){if(LV.ty[i]==null||!nearTile(ci,i,at))return;const r=grabRule(ci,i);if(r){r.apply();W.chop[ci]=-1;dirty()}else dirty()}
  else if(a==='chop1'){OU.chopSeen[ci]=performance.now();if(at&&ci!==OU.ci)OU.chopAt[ci]={x:at.x,y:at.y,t:performance.now()};
    if(W.chop[ci]!==i&&canChop(ci,i)&&nearTile(ci,i,at)){stopChopAt(i);W.chop[ci]=i;dirty()}}
  else if(a==='chop0'){if(W.chop[ci]>=0){W.chop[ci]=-1;dirty()}}
}
const myPos=()=>OU.me?[Math.round(OU.me.x*1000)/1000,Math.round(OU.me.y*1000)/1000]:null;
function doAct(a,i,v){
  if(OU.auth)act(OU.ci,a,i,v);else NET.ev({e:'oa',a,i,v,p:myPos()});
}
function sendSnap(){
  OU.lastSnap=performance.now();OU.dirtyAt=0;
  NET.ev({e:'os',n:++OU.sn,W});
}

/* ---------------- DOM ---------------- */
const html=`
<section id="oumenu" class="card gmenu" hidden>
<div class="mhero"><div class="mart" data-art="order"></div><h2 class="mh">Order Up!</h2></div>
<div class="row rsets"><label>Kitchen room code<input id="cd9" maxlength="6" autocomplete="off"></label></div>
<div class="row"><button class="btn" id="ougo">Open the kitchen · online co-op</button></div>
<p class="note" data-msg></p>
<ul class="rules">
 <li><b>Two chefs, one kitchen, online only.</b> Send your friend the invite link. You share the orders, the clock and the score.</li>
 <li>A counter splits the kitchen. One side has the ingredients and chopping boards, the other has the stoves and plates. <b>Put food on the middle counter to pass it across.</b></li>
 <li><b>Move:</b> W A S D or arrows · <b>Grab / place / serve:</b> Space or E · <b>Chop:</b> hold F · <b>Dash:</b> Shift. On a phone: drag on the left to move, buttons on the right.</li>
 <li><b>Soups:</b> 3 chopped veg in a pot (3 the same, or carrot + onion + tomato for veggie stew). When it's done, <b>walk up holding an empty plate</b> and grab to scoop it.</li>
 <li><b>Pans:</b> chop meat, fish or potatoes, then fry them for patties, fried fish and fries. The order cards show every ingredient.</li>
 <li><b>14 dishes over 7 kitchens:</b> soups, stew, salads, burgers, cheeseburgers, fries, fish &amp; chips, beef and fish tacos.</li>
 <li>Serve fast for tips. Missed orders and wrong dishes cost points. Don't let the pots burn!</li>
</ul>
<button class="btn m back" data-back>← All games</button></section>
<section id="ougame" hidden>
<div id="oustage"><canvas id="oucv"></canvas><canvas id="ou3d"></canvas><div id="oufloat"></div>
 <div id="ouorders"></div>
 <div id="ouclock"><b id="outime">3:00</b><span id="oukitn">Kitchen</span><button id="ouquit">Leave</button></div>
 <div id="ouscorebox"><span class="coin">$</span><div><b id="ouscore">0</b><span id="oustar"></span></div></div>
 <p id="ouprompt" class="none"></p>
 <div id="oumsg"></div><div id="oulobby" hidden></div><div id="oupads" hidden></div></div>
</section>`;
$('#app').insertAdjacentHTML('beforeend',html);
$('#oumenu [data-back]').onclick=()=>{show('hub');SFX.back()};
['contextmenu','selectstart','dragstart'].forEach(n=>$('#ougame').addEventListener(n,e=>{if(!e.target.closest('input'))e.preventDefault()}));
const cv=$('#oucv'),g2=cv.getContext('2d');

/* ---------------- drawing: food ---------------- */
const K='#14111f';
function ink(c,r){c.strokeStyle=K;c.lineWidth=Math.max(1.2,r*0.13);c.lineJoin='round';c.lineCap='round'}
function blob(c,x,y,r,f){c.beginPath();c.arc(x,y,r,0,7);c.fillStyle=f;c.fill();c.stroke()}
function ell(c,x,y,rx,ry,f){c.beginPath();c.ellipse(x,y,rx,ry,0,0,7);c.fillStyle=f;c.fill();c.stroke()}
function drawFood(c,it,x,y,r){
  ink(c,r);const k=it.k,s=it.s;
  if(k==='tomato'){
    if(s==='raw'){blob(c,x,y+r*.08,r*.82,'#ff4d4d');c.fillStyle='#ffffff88';c.beginPath();c.ellipse(x-r*.3,y-r*.15,r*.18,r*.1,-.6,0,7);c.fill();
      c.fillStyle='#2fae4f';c.beginPath();for(let k=0;k<5;k++){const a=k/5*Math.PI*2-Math.PI/2,b=a+Math.PI/5;c.lineTo(x+Math.cos(a)*r*.38,y-r*.62+Math.sin(a)*r*.2);c.lineTo(x+Math.cos(b)*r*.12,y-r*.62+Math.sin(b)*r*.07)}c.closePath();c.fill();c.stroke()}
    else{[[-.38,.15],[.38,.15],[0,-.3]].forEach(([dx,dy])=>{blob(c,x+dx*r,y+dy*r,r*.42,'#ff4d4d');c.fillStyle='#ffb3b3';c.beginPath();c.arc(x+dx*r,y+dy*r,r*.25,0,7);c.fill();c.fillStyle='#fff3c4';[[-.08,0],[.08,.05],[0,-.09]].forEach(([a,b])=>{c.beginPath();c.arc(x+dx*r+a*r,y+dy*r+b*r,r*.04,0,7);c.fill()})})}
  }else if(k==='onion'){
    if(s==='raw'){c.beginPath();c.moveTo(x,y-r*.85);c.quadraticCurveTo(x+r*.95,y-r*.1,x+r*.6,y+r*.55);c.quadraticCurveTo(x,y+r*.95,x-r*.6,y+r*.55);c.quadraticCurveTo(x-r*.95,y-r*.1,x,y-r*.85);c.fillStyle='#d48fc6';c.fill();c.stroke();
      c.strokeStyle='#a45b98';c.lineWidth=r*.07;c.beginPath();c.moveTo(x,y-r*.6);c.quadraticCurveTo(x+r*.4,y,x+r*.1,y+r*.7);c.moveTo(x,y-r*.6);c.quadraticCurveTo(x-r*.4,y,x-r*.1,y+r*.7);c.stroke()}
    else{ink(c,r);[[-.35,.15],[.35,.15],[0,-.28]].forEach(([dx,dy])=>{c.beginPath();c.arc(x+dx*r,y+dy*r,r*.4,0,7);c.fillStyle='#f3d6ec';c.fill();c.stroke();c.strokeStyle='#b46aa8';c.lineWidth=r*.07;c.beginPath();c.arc(x+dx*r,y+dy*r,r*.24,0,7);c.stroke();ink(c,r)})}
  }else if(k==='mushroom'){
    if(s==='raw'){c.beginPath();c.rect(x-r*.22,y-r*.05,r*.44,r*.75);c.fillStyle='#fff3dd';c.fill();c.stroke();
      c.beginPath();c.moveTo(x-r*.85,y+r*.05);c.quadraticCurveTo(x-r*.8,y-r*.85,x,y-r*.85);c.quadraticCurveTo(x+r*.8,y-r*.85,x+r*.85,y+r*.05);c.closePath();c.fillStyle='#d9534f';c.fill();c.stroke();
      c.fillStyle='#fff';[[-.4,-.3],[.15,-.55],[.45,-.2]].forEach(([a,b])=>{c.beginPath();c.arc(x+a*r,y+b*r,r*.11,0,7);c.fill()})}
    else{[[-.38,.15],[.38,.15],[0,-.3]].forEach(([dx,dy])=>{const X=x+dx*r,Y=y+dy*r;c.beginPath();c.moveTo(X-r*.38,Y);c.quadraticCurveTo(X,Y-r*.5,X+r*.38,Y);c.lineTo(X+r*.12,Y);c.lineTo(X+r*.12,Y+r*.3);c.lineTo(X-r*.12,Y+r*.3);c.lineTo(X-r*.12,Y);c.closePath();c.fillStyle='#f0d2b0';c.fill();c.stroke()})}
  }else if(k==='lettuce'){
    if(s==='raw'){blob(c,x,y,r*.82,'#6fd36a');c.strokeStyle='#2f9a3a';c.lineWidth=r*.08;c.beginPath();c.moveTo(x,y+r*.6);c.lineTo(x,y-r*.5);c.moveTo(x,y+r*.1);c.lineTo(x-r*.4,y-r*.3);c.moveTo(x,y+r*.1);c.lineTo(x+r*.4,y-r*.3);c.stroke()}
    else{c.lineWidth=r*.3;c.strokeStyle=K;const P=[[-.6,.2,-.1,-.3],[-.2,.4,.5,0],[.1,-.5,.6,-.1],[-.5,-.3,.1,.1]];P.forEach(p=>{c.beginPath();c.moveTo(x+p[0]*r,y+p[1]*r);c.quadraticCurveTo(x,y,x+p[2]*r,y+p[3]*r);c.stroke()});
      c.lineWidth=r*.18;c.strokeStyle='#6fd36a';P.forEach(p=>{c.beginPath();c.moveTo(x+p[0]*r,y+p[1]*r);c.quadraticCurveTo(x,y,x+p[2]*r,y+p[3]*r);c.stroke()})}
  }else if(k==='bun'){
    c.beginPath();c.moveTo(x-r*.85,y+r*.2);c.quadraticCurveTo(x-r*.85,y-r*.75,x,y-r*.75);c.quadraticCurveTo(x+r*.85,y-r*.75,x+r*.85,y+r*.2);c.closePath();c.fillStyle='#e8a75a';c.fill();c.stroke();
    ell(c,x,y+r*.42,r*.85,r*.2,'#f2c17f');c.fillStyle='#fff7df';[[-.4,-.25],[0,-.5],[.35,-.25],[-.1,-.15]].forEach(([a,b])=>{c.beginPath();c.ellipse(x+a*r,y+b*r,r*.08,r*.05,.4,0,7);c.fill()});
  }else if(k==='meat'){
    if(s==='raw'){c.beginPath();c.moveTo(x-r*.8,y);c.bezierCurveTo(x-r*.9,y-r*.8,x+r*.5,y-r*.85,x+r*.8,y-r*.2);c.bezierCurveTo(x+r*.95,y+r*.6,x-r*.3,y+r*.8,x-r*.8,y);c.closePath();c.fillStyle='#ff8fa3';c.fill();c.stroke();
      c.strokeStyle='#fff';c.lineWidth=r*.13;c.beginPath();c.moveTo(x-r*.45,y-r*.05);c.quadraticCurveTo(x,y-r*.45,x+r*.45,y-r*.05);c.stroke()}
    else{const col={chopped:'#ff8fa3',cooked:'#8b4a2b',burnt:'#2b2320'}[s];ell(c,x,y+r*.12,r*.8,r*.5,col);ell(c,x,y,r*.8,r*.5,col);
      if(s==='cooked'){c.strokeStyle='#c27a4a';c.lineWidth=r*.08;for(let k=-1;k<=1;k++){c.beginPath();c.moveTo(x-r*.4+k*r*.25,y-r*.25);c.lineTo(x-r*.1+k*r*.25,y+r*.25);c.stroke()}}
      if(s==='chopped'){c.fillStyle='#ffd0da';[[-.3,-.1],[.2,.1],[.35,-.15],[-.05,.15]].forEach(([a,b])=>{c.beginPath();c.arc(x+a*r,y+b*r,r*.06,0,7);c.fill()})}
      if(s==='burnt'){c.fillStyle='#55555577';c.beginPath();c.arc(x+r*.2,y-r*.7,r*.25,0,7);c.arc(x-r*.1,y-r*.95,r*.18,0,7);c.fill()}}
  }else if(k==='carrot'){
    if(s==='raw'){c.save();c.translate(x,y);c.rotate(-.6);c.beginPath();c.moveTo(-r*.28,-r*.5);c.quadraticCurveTo(0,-r*.62,r*.28,-r*.5);c.lineTo(r*.05,r*.85);c.quadraticCurveTo(0,r*.92,-r*.05,r*.85);c.closePath();c.fillStyle='#ff9a2e';c.fill();c.stroke();
      c.strokeStyle='#d9701a';c.lineWidth=r*.06;for(let k=0;k<3;k++){c.beginPath();c.moveTo(-r*.18+k*.04*r,-r*.15+k*r*.28);c.lineTo(r*.02+k*.03*r,-r*.12+k*r*.28);c.stroke()}
      ink(c,r);c.fillStyle='#2fae4f';[[-.25,-1],[0,-1.08],[.25,-1]].forEach(([a,b])=>{c.beginPath();c.ellipse(a*r,-r*.55+b*r*.3,r*.09,r*.28,a*1.4,0,7);c.fill();c.stroke()});c.restore()}
    else[[-.36,.16],[.36,.16],[0,-.3]].forEach(([dx,dy])=>{blob(c,x+dx*r,y+dy*r,r*.38,'#ff9a2e');c.strokeStyle='#ffc27a';c.lineWidth=r*.07;c.beginPath();c.arc(x+dx*r,y+dy*r,r*.2,0,7);c.stroke();ink(c,r)});
  }else if(k==='cheese'){
    if(s==='raw'){c.beginPath();c.moveTo(x-r*.8,y+r*.45);c.lineTo(x+r*.8,y+r*.45);c.lineTo(x+r*.8,y-r*.1);c.lineTo(x-r*.8,y+r*.0);c.closePath();c.fillStyle='#ffd23f';c.fill();c.stroke();
      c.beginPath();c.moveTo(x-r*.8,y);c.lineTo(x+r*.8,y-r*.1);c.lineTo(x+r*.2,y-r*.6);c.closePath();c.fillStyle='#ffe57a';c.fill();c.stroke();
      c.fillStyle='#e0a800';[[-.4,.22],[.25,.25],[.5,.05]].forEach(([a,b])=>{c.beginPath();c.arc(x+a*r,y+b*r,r*.08,0,7);c.fill()})}
    else{[[-.32,.14],[.32,.14],[0,-.26]].forEach(([dx,dy])=>{c.beginPath();c.rect(x+dx*r-r*.24,y+dy*r-r*.2,r*.48,r*.4);c.fillStyle='#ffd23f';c.fill();c.stroke()})}
  }else if(k==='tortilla'){
    ell(c,x,y+r*.05,r*.85,r*.6,'#f5d78e');c.fillStyle='#c99a45';[[-.4,-.1],[.1,-.25],[.45,.1],[-.1,.25],[.25,.3]].forEach(([a,b])=>{c.beginPath();c.ellipse(x+a*r,y+b*r,r*.07,r*.05,a,0,7);c.fill()});
  }else if(k==='fish'){
    const col={raw:'#7fa8c9',chopped:'#ffc1b0',cooked:'#e0a03a',burnt:'#2b2320'}[s];
    if(s==='raw'){c.beginPath();c.moveTo(x-r*.7,y);c.quadraticCurveTo(x-r*.1,y-r*.6,x+r*.5,y);c.quadraticCurveTo(x-r*.1,y+r*.6,x-r*.7,y);c.closePath();c.fillStyle=col;c.fill();c.stroke();
      c.beginPath();c.moveTo(x+r*.42,y);c.lineTo(x+r*.9,y-r*.38);c.lineTo(x+r*.9,y+r*.38);c.closePath();c.fill();c.stroke();
      c.fillStyle='#fff';c.beginPath();c.arc(x-r*.42,y-r*.08,r*.1,0,7);c.fill();c.stroke();c.fillStyle=K;c.beginPath();c.arc(x-r*.42,y-r*.08,r*.04,0,7);c.fill();
      c.strokeStyle='#5a83a6';c.lineWidth=r*.06;c.beginPath();c.arc(x-r*.05,y,r*.22,-1,1);c.stroke()}
    else{c.beginPath();c.moveTo(x-r*.75,y-r*.1);c.quadraticCurveTo(x-r*.6,y-r*.5,x,y-r*.4);c.quadraticCurveTo(x+r*.7,y-r*.35,x+r*.75,y+r*.05);c.quadraticCurveTo(x+r*.6,y+r*.5,x,y+r*.4);c.quadraticCurveTo(x-r*.7,y+r*.35,x-r*.75,y-r*.1);c.closePath();c.fillStyle=col;c.fill();c.stroke();
      if(s==='cooked'){c.fillStyle='#ffd27a';[[-.4,-.1],[0,-.15],[.35,0],[-.15,.15],[.2,.2]].forEach(([a,b])=>{c.beginPath();c.arc(x+a*r,y+b*r,r*.07,0,7);c.fill()})}
      if(s==='chopped'){c.strokeStyle='#ff9d88';c.lineWidth=r*.07;for(let k=-1;k<=1;k++){c.beginPath();c.moveTo(x+k*r*.3-r*.08,y-r*.25);c.quadraticCurveTo(x+k*r*.3+r*.1,y,x+k*r*.3-r*.08,y+r*.25);c.stroke()}}}
  }else if(k==='potato'){
    if(s==='raw'){ell(c,x,y,r*.82,r*.6,'#c9975a');c.fillStyle='#8f6535';[[-.35,-.15],[.2,-.25],[.4,.15],[-.1,.2]].forEach(([a,b])=>{c.beginPath();c.arc(x+a*r,y+b*r,r*.06,0,7);c.fill()})}
    else{const col={chopped:'#fff0b8',cooked:'#ffc93c',burnt:'#3a2a1e'}[s];
      [[-.42,-.1,.25],[-.2,.05,-.1],[0,-.12,.15],[.22,.02,-.2],[.42,-.08,.1],[-.1,.25,.4],[.15,.28,-.35]].forEach(([a,b,ang])=>{c.save();c.translate(x+a*r,y+b*r);c.rotate(ang+Math.PI/2);c.beginPath();c.rect(-r*.48,-r*.08,r*.96,r*.16);c.fillStyle=col;c.fill();c.stroke();c.restore()})}
  }else if(k==='soup'){
    ell(c,x,y,r*.8,r*.6,soupCol(it.of));c.fillStyle='#ffffff55';c.beginPath();c.ellipse(x-r*.25,y-r*.15,r*.22,r*.1,-.3,0,7);c.fill();
  }
}
function drawItem(c,it,x,y,r){
  c.save();
  if(isPlate(it)){
    ink(c,r);ell(c,x,y+r*.2,r*1.05,r*.8,'#ffffff');c.strokeStyle='#d9d4e6';c.lineWidth=r*.08;c.beginPath();c.ellipse(x,y+r*.2,r*.72,r*.52,0,0,7);c.stroke();
    const L=it.c,hasBun=L.some(q=>q.k==='bun'),hasMeat=L.some(q=>q.k==='meat'),tort=L.some(q=>q.k==='tortilla');
    const fill=L.find(q=>(q.k==='meat'||q.k==='fish')&&q.s==='cooked');
    if(tort&&fill){
      // taco: a folded shell with the filling peeking out
      ink(c,r);c.beginPath();c.moveTo(x-r*.8,y+r*.25);c.quadraticCurveTo(x,y-r*1.05,x+r*.8,y+r*.25);c.closePath();c.fillStyle='#f5d78e';c.fill();c.stroke();
      c.fillStyle=fill.k==='meat'?'#8b4a2b':'#e0a03a';c.beginPath();c.moveTo(x-r*.62,y+r*.2);c.quadraticCurveTo(x,y-r*.62,x+r*.62,y+r*.2);c.closePath();c.fill();c.stroke();
      if(L.some(q=>q.k==='lettuce')){c.fillStyle='#6fd36a';for(let k=0;k<5;k++){c.beginPath();c.arc(x-r*.42+k*r*.21,y-r*.12-Math.sin(k/4*Math.PI)*r*.25,r*.12,0,7);c.fill();c.stroke()}}
      if(L.some(q=>q.k==='cheese')){c.fillStyle='#ffd23f';for(let k=0;k<4;k++){c.beginPath();c.rect(x-r*.38+k*r*.24,y-r*.18-Math.sin(k/3*Math.PI)*r*.22,r*.14,r*.12);c.fill();c.stroke()}}
      ink(c,r);c.beginPath();c.moveTo(x-r*.8,y+r*.25);c.quadraticCurveTo(x,y+r*.05,x+r*.8,y+r*.25);c.strokeStyle=K;c.stroke();
    }else if(hasBun&&hasMeat){
      ink(c,r);ell(c,x,y+r*.35,r*.65,r*.2,'#f2c17f');drawFood(c,{k:'meat',s:'cooked'},x,y+r*.12,r*.75);
      if(L.some(q=>q.k==='cheese')){c.fillStyle='#ffd23f';c.strokeStyle=K;c.lineWidth=r*.1;c.beginPath();c.moveTo(x-r*.62,y-r*.06);c.lineTo(x+r*.62,y-r*.06);c.lineTo(x+r*.4,y+r*.16);c.lineTo(x+r*.2,y+r*.02);c.lineTo(x-r*.1,y+r*.2);c.lineTo(x-r*.35,y+r*.02);c.closePath();c.fill();c.stroke()}
      if(L.some(q=>q.k==='lettuce')){c.fillStyle='#6fd36a';c.strokeStyle=K;c.lineWidth=r*.1;c.beginPath();for(let k=0;k<=8;k++)c.lineTo(x-r*.65+k*r*.1625,y-r*.12+(k%2?-1:1)*r*.07);c.lineTo(x+r*.5,y-r*.02);c.lineTo(x-r*.5,y-r*.02);c.closePath();c.fill();c.stroke()}
      ink(c,r);c.beginPath();c.moveTo(x-r*.68,y-r*.12);c.quadraticCurveTo(x-r*.68,y-r*.8,x,y-r*.8);c.quadraticCurveTo(x+r*.68,y-r*.8,x+r*.68,y-r*.12);c.closePath();c.fillStyle='#e8a75a';c.fill();c.stroke();
      c.fillStyle='#fff7df';[[-.3,-.45],[.05,-.6],[.3,-.4]].forEach(([a,b])=>{c.beginPath();c.ellipse(x+a*r,y+b*r,r*.07,r*.045,.4,0,7);c.fill()});
    }else if(L.length===1&&L[0].k==='soup'){ink(c,r);ell(c,x,y+r*.1,r*.62,r*.42,soupCol(L[0].of));c.strokeStyle='#ffffffaa';c.lineWidth=r*.07;for(let k=-1;k<=1;k++){c.beginPath();c.moveTo(x+k*r*.25,y-r*.35);c.quadraticCurveTo(x+k*r*.25+r*.1,y-r*.55,x+k*r*.25,y-r*.75);c.stroke()}}
    else{const O=[[-.32,.05],[.32,.05],[0,-.25]];L.forEach((q,j)=>drawFood(c,q,x+O[j][0]*r,y+O[j][1]*r,r*.55))}
  }else drawFood(c,it,x,y,r);
  c.restore();
}
const ICON={};
function icon(it,sz=64){const k=JSON.stringify(it);if(ICON[k])return ICON[k];const cc=document.createElement('canvas');cc.width=cc.height=sz;const c=cc.getContext('2d');drawItem(c,it,sz/2,sz/2,sz*.36);return ICON[k]=cc.toDataURL()}
const POT_ICON=(()=>{const cc=document.createElement('canvas');cc.width=cc.height=40;const c=cc.getContext('2d');ink(c,14);c.beginPath();c.rect(8,14,24,16);c.fillStyle='#9aa3b5';c.fill();c.stroke();c.beginPath();c.moveTo(4,15);c.lineTo(36,15);c.stroke();return cc.toDataURL()})();
const PAN_ICON=(()=>{const cc=document.createElement('canvas');cc.width=cc.height=40;const c=cc.getContext('2d');ink(c,14);c.beginPath();c.ellipse(16,22,12,8,0,0,7);c.fillStyle='#3a3a44';c.fill();c.stroke();c.beginPath();c.moveTo(27,20);c.lineTo(38,15);c.stroke();return cc.toDataURL()})();

/* ---------------- drawing: kitchen ---------------- */
let V={s:40,ox:0,oy:0,w:0,h:0,dpr:1};
function layout(){
  const r=$('#oustage').getBoundingClientRect(),dpr=Math.min(2,devicePixelRatio||1);if(!r.width||!LV)return;
  if(cv.width!==Math.round(r.width*dpr)||cv.height!==Math.round(r.height*dpr)){cv.width=Math.round(r.width*dpr);cv.height=Math.round(r.height*dpr)}
  const s=Math.floor(Math.min((r.width-16)/LV.Wd,(r.height-16)/(LV.H+.25)));
  V={s,dpr,w:r.width,h:r.height,ox:(r.width-s*LV.Wd)/2,oy:(r.height-s*(LV.H+.25))/2+s*.12};
}
const P=(x,y)=>[V.ox+x*V.s,V.oy+y*V.s];
function bar(c,x,y,w,p,col){const h=Math.max(5,V.s*.12);c.fillStyle=K;c.beginPath();c.roundRect?c.roundRect(x-w/2-2,y-2,w+4,h+4,4):c.rect(x-w/2-2,y-2,w+4,h+4);c.fill();c.fillStyle='#fff';c.fillRect(x-w/2,y,w,h);c.fillStyle=col;c.fillRect(x-w/2,y,w*Math.max(0,Math.min(1,p)),h)}
function drawTile(c,i,t){
  const ty=LV.ty[i],x=i%LV.Wd,y=(i/LV.Wd)|0,[px,py]=P(x,y),s=V.s,lip=s*.16;
  if(ty==='.')return;
  // counter body: top face + front lip (gives a little depth)
  const top={'|':'#7ec8f0','W':'#4a3d6b','S':'#ffd23f'}[ty]||'#d99a5b',front={'|':'#4f9cc8','W':'#30264a','S':'#e0a800'}[ty]||'#a8693a';
  c.fillStyle=front;c.fillRect(px,py+s-lip,s,lip);c.fillStyle=top;c.fillRect(px,py,s,s-lip);
  c.strokeStyle=K;c.lineWidth=2;c.strokeRect(px+1,py+1,s-2,s-2);c.beginPath();c.moveTo(px,py+s-lip);c.lineTo(px+s,py+s-lip);c.stroke();
  const cx=px+s/2,cy=py+(s-lip)/2;
  if(ty==='W'){c.strokeStyle='#5d4f82';c.lineWidth=2;for(let k=1;k<3;k++){c.beginPath();c.moveTo(px,py+k*(s-lip)/3);c.lineTo(px+s,py+k*(s-lip)/3);c.stroke()}return}
  if(ty==='|'){c.strokeStyle='#ffffff88';c.lineWidth=2;c.setLineDash([4,4]);c.strokeRect(px+s*.15,py+s*.12,s*.7,s*.58);c.setLineDash([])}
  if(CRATE[ty]){ink(c,s*.3);c.fillStyle='#b97a44';c.fillRect(px+s*.1,py+s*.08,s*.8,s*.66);c.strokeRect(px+s*.1,py+s*.08,s*.8,s*.66);c.strokeStyle='#8a5530';c.lineWidth=2;c.beginPath();c.moveTo(px+s*.12,py+s*.3);c.lineTo(px+s*.88,py+s*.3);c.stroke();
    drawItem(c,{k:CRATE[ty],s:'raw'},cx,cy+s*.06,s*.26);return}
  if(ty==='C'){ink(c,s*.3);c.fillStyle='#fff8ec';c.beginPath();c.roundRect?c.roundRect(px+s*.12,py+s*.1,s*.76,s*.6,6):c.rect(px+s*.12,py+s*.1,s*.76,s*.6);c.fill();c.stroke();
    if(!W.t[i]){c.fillStyle='#c9cfdb';c.beginPath();c.moveTo(px+s*.25,py+s*.55);c.lineTo(px+s*.68,py+s*.25);c.lineTo(px+s*.74,py+s*.32);c.lineTo(px+s*.32,py+s*.6);c.closePath();c.fill();c.stroke()}}
  if(ty==='K'||ty==='F'){ink(c,s*.3);c.fillStyle='#4b4f5c';c.fillRect(px+s*.06,py+s*.04,s*.88,s*.74);c.strokeRect(px+s*.06,py+s*.04,s*.88,s*.74);
    const st=W.st[i],on=ty==='K'?st.c.length===3:st.c.length>0;
    c.strokeStyle=on?(st.p>=2?'#555':'#ff7a00'):'#777';c.lineWidth=3;c.beginPath();c.arc(cx,cy,s*.3,0,7);c.stroke();
    ink(c,s*.3);
    if(ty==='K'){c.fillStyle='#b8c0d0';c.beginPath();c.arc(cx,cy-s*.02,s*.3,0,7);c.fill();c.stroke();
      const fill=st.p>=2?'#3a2f2a':potCol(st.c);c.fillStyle=fill;c.beginPath();c.arc(cx,cy-s*.02,s*.22,0,7);c.fill();
      if(st.c.length&&st.p<1)for(let k=0;k<st.c.length;k++)drawFood(c,{k:st.c[k],s:'chopped'},cx+(k-1)*s*.14,cy-s*.04,s*.1);
      if(st.p>=1&&st.p<2){c.strokeStyle='#ffffffaa';c.lineWidth=2;for(let k=-1;k<=1;k++){const o=Math.sin(t*3+k)*s*.03;c.beginPath();c.moveTo(cx+k*s*.12,cy-s*.3);c.quadraticCurveTo(cx+k*s*.12+s*.06+o,cy-s*.42,cx+k*s*.12,cy-s*.55);c.stroke()}}}
    else{c.fillStyle='#2a2a33';c.beginPath();c.arc(cx-s*.03,cy,s*.27,0,7);c.fill();c.stroke();c.beginPath();c.moveTo(cx+s*.22,cy-s*.05);c.lineTo(cx+s*.46,cy-s*.18);c.lineWidth=s*.07;c.stroke();
      if(st.c.length)drawFood(c,{k:st.c[0],s:st.p>=2?'burnt':st.p>=1?'cooked':'chopped'},cx-s*.03,cy,s*.2)}
    if(st.c.length&&(ty==='F'||st.c.length===3)){
      if(st.p<1)bar(c,cx,py-s*.08,s*.7,st.p,'#ff8a1f');
      else if(st.p<2){bar(c,cx,py-s*.08,s*.7,(st.p-1),st.p>1.6?'#ff3e5a':'#2fe3a0');
        if(st.p>1.6&&Math.sin(t*14)>0){c.fillStyle='#ff3e5a';c.font=`900 ${s*.4}px system-ui`;c.textAlign='center';c.fillText('!',cx+s*.42,py+s*.2)}}
      else{c.fillStyle='#555';c.globalAlpha=.6;for(let k=0;k<3;k++){const o=(t*0.8+k/3)%1;c.beginPath();c.arc(cx+Math.sin(k*2+t)*s*.15,cy-s*.2-o*s*.6,s*(.08+o*.12),0,7);c.fill()}c.globalAlpha=1}
    }
    if(ty==='K'&&st.c.length&&st.c.length<3&&st.p===0){c.fillStyle='#fff';c.strokeStyle=K;c.lineWidth=3;c.font=`900 ${s*.22}px system-ui`;c.textAlign='center';c.strokeText(st.c.length+'/3',cx,py+s*.95-lip);c.fillText(st.c.length+'/3',cx,py+s*.95-lip)}
    return}
  if(ty==='D'){const n=W.pc[i]||0;for(let k=0;k<Math.max(1,n);k++){ink(c,s*.3);c.globalAlpha=n?1:.25;ell(c,cx,cy+s*.12-k*s*.08,s*.32,s*.2,'#fff')}c.globalAlpha=1;
    c.fillStyle=K;c.font=`900 ${s*.2}px system-ui`;c.textAlign='center';c.fillText('×'+n,cx+s*.32,py+s*.25);return}
  if(ty==='X'){ink(c,s*.3);c.fillStyle='#8d94a6';c.beginPath();c.moveTo(cx-s*.26,cy-s*.2);c.lineTo(cx+s*.26,cy-s*.2);c.lineTo(cx+s*.2,cy+s*.28);c.lineTo(cx-s*.2,cy+s*.28);c.closePath();c.fill();c.stroke();
    ell(c,cx,cy-s*.22,s*.32,s*.08,'#b1b8c8');c.strokeStyle='#5d6475';c.lineWidth=2;for(let k=-1;k<=1;k++){c.beginPath();c.moveTo(cx+k*s*.1,cy-s*.1);c.lineTo(cx+k*s*.08,cy+s*.2);c.stroke()}return}
  if(ty==='S'){c.save();c.beginPath();c.rect(px,py,s,s-lip);c.clip();for(let k=-2;k<6;k++){c.fillStyle=k%2?'#ff3e5a':'#fff';c.beginPath();c.moveTo(px+k*s*.25,py);c.lineTo(px+(k+1)*s*.25,py);c.lineTo(px+(k+1)*s*.25-s*.25,py+s);c.lineTo(px+k*s*.25-s*.25,py+s);c.fill()}c.restore();
    c.strokeStyle=K;c.lineWidth=2;c.strokeRect(px+1,py+1,s-2,s-lip-1);
    c.fillStyle='#ffd23f';ink(c,s*.3);c.beginPath();c.arc(cx,cy+s*.08,s*.18,Math.PI,0);c.closePath();c.fill();c.stroke();c.beginPath();c.arc(cx,cy-s*.12,s*.04,0,7);c.fillStyle=K;c.fill();
    c.fillStyle='#fff';c.strokeStyle=K;c.lineWidth=3;c.font=`400 ${s*.24}px Bangers,Impact,sans-serif`;c.textAlign='center';c.strokeText('SERVE',cx,py+s*.3);c.fillText('SERVE',cx,py+s*.3);return}
}
function drawTileItem(c,i,t){
  const it=W.t[i];if(!it)return;const x=i%LV.Wd,y=(i/LV.Wd)|0,[px,py]=P(x,y),s=V.s,cx=px+s/2,cy=py+s*.4;
  let jx=0;const chopping=W.chop.includes(i);if(chopping)jx=Math.sin(t*40)*s*.02;
  drawItem(c,it,cx+jx,cy,s*.3);
  if(it.cp>0&&it.s==='raw')bar(c,cx,py-s*.08,s*.7,it.cp,'#38d6ff');
}
function drawChef(c,ch,ci,t){
  const s=V.s,[x,y]=P(ch.x,ch.y),col=ci===0?'#ff3e8a':'#2d7bff',r=s*.3,bob=ch.walk?Math.abs(Math.sin(t*12))*s*.05:0;
  const fx=ch.fx||0,fy=ch.fy||1,held=W.h[ci];
  c.fillStyle='#00000040';c.beginPath();c.ellipse(x,y+r*.85,r*.95,r*.35,0,0,7);c.fill();
  const hx=x+fx*r*.95,hy=y-bob+fy*r*.55-r*.1;
  if(held&&fy<-.3)drawItem(c,held,hx,hy-r*.2,s*.24);
  ink(c,r);blob(c,x,y-bob,r,col);
  c.fillStyle='#fff';c.beginPath();c.ellipse(x,y-bob+r*.38,r*.62,r*.48,0,0,Math.PI);c.fill();
  // face
  if(fy>-.5){const ex=fx*r*.35,ey=-r*.15+fy*r*.12;c.fillStyle=K;[-1,1].forEach(k=>{c.beginPath();c.ellipse(x+ex+k*r*.28,y-bob+ey,r*.09,r*.14,0,0,7);c.fill()});
    c.strokeStyle=K;c.lineWidth=r*.09;c.beginPath();c.arc(x+ex,y-bob+ey+r*.18,r*.15,.2,Math.PI-.2);c.stroke()}
  // hat
  ink(c,r);c.fillStyle='#fff';c.beginPath();c.rect(x-r*.45,y-bob-r*1.05,r*.9,r*.3);c.fill();c.stroke();
  c.beginPath();c.arc(x-r*.35,y-bob-r*1.2,r*.32,0,7);c.arc(x+r*.35,y-bob-r*1.2,r*.32,0,7);c.fill();c.beginPath();c.arc(x,y-bob-r*1.35,r*.4,0,7);c.fill();c.stroke();
  c.beginPath();c.arc(x-r*.35,y-bob-r*1.2,r*.32,Math.PI*.6,Math.PI*1.6);c.stroke();c.beginPath();c.arc(x+r*.35,y-bob-r*1.2,r*.32,-Math.PI*.6,Math.PI*.4);c.stroke();
  if(held&&fy>=-.3)drawItem(c,held,hx,hy,s*.24);
  if(ch.chop){const a=Math.sin(t*30)*.6;c.save();c.translate(x+fx*r*1.1,y-bob+fy*r*.7-r*.3);c.rotate(a);c.fillStyle='#d6dbe6';ink(c,r);c.beginPath();c.moveTo(0,0);c.lineTo(r*.6,-r*.15);c.lineTo(r*.6,r*.12);c.closePath();c.fill();c.stroke();c.restore()}
  // name tag
  const nm=ci===OU.ci?(me.n||'You'):(on||'Partner');c.font=`900 ${Math.max(10,s*.2)}px system-ui`;c.textAlign='center';
  const tw=c.measureText(nm).width+10,ty=y-bob-r*2.05;c.fillStyle=col;c.strokeStyle=K;c.lineWidth=2;c.beginPath();c.roundRect?c.roundRect(x-tw/2,ty-s*.17,tw,s*.24,6):c.rect(x-tw/2,ty-s*.17,tw,s*.24);c.fill();c.stroke();
  c.fillStyle='#fff';c.fillText(nm,x,ty+s*.02);
}
function remoteChef(now){
  const b=OU.rbuf,oc=1-OU.ci,sp=LV.spawn[oc];
  if(!b.length||OU.off==null)return{x:sp.x,y:sp.y,fx:0,fy:1};
  const rt=now-OU.off-(NET.fastOK()?70:240);let a=b[0],z=a,k=0;
  if(rt>=b[b.length-1].t)a=z=b[b.length-1];else if(rt>b[0].t){for(let i=0;i<b.length-1;i++)if(b[i+1].t>rt){a=b[i];z=b[i+1];break}k=(rt-a.t)/Math.max(1,z.t-a.t)}
  return{x:a.x+(z.x-a.x)*k,y:a.y+(z.y-a.y)*k,fx:z.fx,fy:z.fy,walk:z.w,chop:W&&W.chop[oc]>=0};
}
function draw(now){
  layout();if(!W||!LV)return;const c=g2,t=now/1000,s=V.s;
  c.setTransform(V.dpr,0,0,V.dpr,0,0);c.clearRect(0,0,V.w,V.h);
  // floor
  for(let y=0;y<LV.H;y++)for(let x=0;x<LV.Wd;x++){const[px,py]=P(x,y);c.fillStyle=(x+y)%2?'#ffe8c2':'#fff4dc';c.fillRect(px,py,s+.5,s+.5)}
  const chefs=[];const mine={...OU.me,chop:W.chop[OU.ci]>=0};chefs[OU.ci]=mine;chefs[1-OU.ci]=remoteChef(now);OU.remPos=chefs[1-OU.ci];
  if(OU.target>=0&&W.ph==='play'){const[px,py]=P(OU.target%LV.Wd,(OU.target/LV.Wd)|0);c.save();c.strokeStyle=OU.ci===0?'#ff3e8a':'#2d7bff';c.lineWidth=4;c.shadowColor='#fff';c.shadowBlur=8;c.strokeRect(px-1,py-1,s+2,s+2);c.restore()}
  for(let y=0;y<LV.H;y++){
    for(let x=0;x<LV.Wd;x++)drawTile(c,y*LV.Wd+x,t);
    if(OU.target>=0&&W.ph==='play'&&((OU.target/LV.Wd)|0)===y){const[px,py]=P(OU.target%LV.Wd,y);c.save();c.strokeStyle=OU.ci===0?'#ff3e8a':'#2d7bff';c.lineWidth=3.5;c.strokeRect(px+2,py+2,s-4,s-4);c.restore()}
    for(let x=0;x<LV.Wd;x++)drawTileItem(c,y*LV.Wd+x,t);
    [0,1].sort((a,b)=>chefs[a].y-chefs[b].y).forEach(ci=>{const ch=chefs[ci];if(Math.floor(ch.y)===y)drawChef(c,ch,ci,t)});
  }
  // floating score texts
  OU.floats=OU.floats.filter(f=>(f.a+=1/60)<1.4);
  OU.floats.forEach(f=>{const[px,py]=f.i>=0?P(f.i%LV.Wd+.5,((f.i/LV.Wd)|0)):[V.w/2,V.oy+s];c.globalAlpha=Math.min(1,(1.4-f.a)*2);c.font=`400 ${s*.5}px Bangers,Impact,sans-serif`;c.textAlign='center';c.lineWidth=5;c.strokeStyle=K;
    const yy=py-f.a*s*1.1;c.strokeText(f.txt,px,yy);c.fillStyle=f.col;c.fillText(f.txt,px,yy);c.globalAlpha=1});
}

/* ---------------- 3D kitchen (Three.js) ----------------
   Same game, drawn as a little diorama: counters, stoves and chefs are low-poly
   models with real lighting and shadows. The camera frames the whole kitchen on
   any screen and turns sideways on portrait phones. Falls back to the flat 2D
   drawing if 3D isn't available. */
const G3={ok:false,lvl:-1,yaw:0,slots:{},stoves:{},plates:{},parts:[],chefs:[],floats:[]};
const CT=0.94;   // counter-top height
function col3(c){return new THREE.Color(c).convertSRGBToLinear()}
function init3D(){
  if(G3.ok)return true;if(!window.THREE)return false;
  try{
    const T=THREE,r=new T.WebGLRenderer({canvas:$('#ou3d'),antialias:true,powerPreference:'high-performance'});
    r.outputEncoding=T.sRGBEncoding;r.toneMapping=T.ACESFilmicToneMapping;r.toneMappingExposure=1;
    r.shadowMap.enabled=true;r.shadowMap.type=T.PCFSoftShadowMap;
    G3.r=r;G3.cam=new T.PerspectiveCamera(34,1,.1,200);
    const M=(c,o)=>new T.MeshStandardMaterial(Object.assign({color:col3(c),roughness:.72,metalness:0},o||{}));
    G3.mat=M;G3.mc={};G3.m=c=>G3.mc[c]||(G3.mc[c]=M(c));
    G3.g={box:new T.BoxGeometry(1,1,1),cyl:new T.CylinderGeometry(1,1,1,28),sph:new T.SphereGeometry(1,22,16),
      half:new T.SphereGeometry(1,22,12,0,Math.PI*2,0,Math.PI/2),tube:new T.CylinderGeometry(1,1,1,28,1,true),ico:new T.IcosahedronGeometry(1,1),tor:new T.TorusGeometry(1,.22,10,26),
      cone:new T.ConeGeometry(1,1,12),plane:new T.PlaneGeometry(1,1)};
    G3.ok=true;
  }catch(e){G3.ok=false;console.warn('Order Up 3D unavailable',e)}
  return G3.ok;
}
function mesh(geo,mat,sx,sy,sz,x,y,z,cast=true){const m=new THREE.Mesh(G3.g[geo]||geo,typeof mat==='string'?G3.m(mat):mat);m.scale.set(sx,sy,sz);m.position.set(x||0,y||0,z||0);m.castShadow=cast;m.receiveShadow=true;return m}
function canvasTex(w,h,draw){const c=document.createElement('canvas');c.width=w;c.height=h;draw(c.getContext('2d'),w,h);const t=new THREE.CanvasTexture(c);t.encoding=THREE.sRGBEncoding;t.anisotropy=4;return t}

/* ---- food models ---- */
function food3(it){
  const g=new THREE.Group(),k=it.k,s=it.s,A=(m)=>{g.add(m);return m};
  if(k==='tomato'){
    if(s==='raw'){A(mesh('sph','#ff4040',.15,.13,.15,0,.13,0));A(mesh('cyl','#2fae4f',.06,.015,.06,0,.26,0));for(let i=0;i<5;i++){const a=i/5*Math.PI*2,l=mesh('box','#2fae4f',.035,.012,.1,Math.sin(a)*.05,.258,Math.cos(a)*.05);l.rotation.y=a;A(l)}}
    else [[-.08,.05],[.08,.04],[0,-.07]].forEach(([x,z],j)=>{A(mesh('cyl','#ff4040',.085,.03,.085,x,.03+j*.008,z));A(mesh('cyl','#ffb0a8',.065,.032,.065,x,.031+j*.008,z,false))});
  }else if(k==='onion'){
    if(s==='raw'){A(mesh('sph','#d48fc6',.14,.13,.14,0,.13,0));A(mesh('cone','#b06aa6',.05,.09,.05,0,.29,0))}
    else [[-.08,.04],[.08,.03],[0,-.07]].forEach(([x,z],j)=>{const r=mesh('tor','#f3d6ec',.075,.075,.075,x,.025+j*.01,z);r.rotation.x=Math.PI/2;A(r)});
  }else if(k==='mushroom'){
    if(s==='raw'){A(mesh('cyl','#fff0d8',.05,.12,.05,0,.06,0));A(mesh('half','#c8473f',.14,.1,.14,0,.11,0));[[.06,.03],[-.05,.06],[-.02,-.07]].forEach(([x,z])=>A(mesh('sph','#ffffff',.022,.015,.022,x,.19,z,false)))}
    else [[-.08,.04],[.08,.03],[0,-.07]].forEach(([x,z],j)=>{const m=mesh('cyl','#f0d2b0',.07,.025,.07,x,.02+j*.008,z);m.scale.z=.05;A(m)});
  }else if(k==='lettuce'){
    if(s==='raw'){const m=mesh('ico',new THREE.MeshStandardMaterial({color:col3('#6fd36a'),roughness:.8,flatShading:true}),.15,.14,.15,0,.14,0);A(m)}
    else for(let i=0;i<6;i++){const m=mesh('box','#6fd36a',.16,.015,.04,Math.sin(i*2.1)*.06,.02+i*.006,Math.cos(i*1.7)*.06);m.rotation.y=i*1.1;A(m)}
  }else if(k==='bun'){A(mesh('cyl','#f2c17f',.14,.035,.14,0,.02,0));A(mesh('half','#e19a4a',.14,.1,.14,0,.04,0));for(let i=0;i<6;i++)A(mesh('box','#fff7df',.018,.008,.01,Math.sin(i*1.9)*.07,.12+(i%2)*.01,Math.cos(i*1.3)*.06,false))}
  else if(k==='meat'){
    if(s==='raw'){A(mesh('box','#ff8fa3',.26,.08,.18,0,.05,0));A(mesh('box','#ffffff',.2,.082,.03,0,.05,.02,false))}
    else{const c={chopped:'#ff8fa3',cooked:'#8b4a2b',burnt:'#2b2320'}[s];A(mesh('cyl',c,.125,.045,.125,0,.03,0));
      if(s==='cooked')for(let i=-1;i<=1;i++)A(mesh('box','#5a2e18',.18,.01,.015,0,.055,i*.05,false))}
  }else if(k==='carrot'){
    if(s==='raw'){const b=mesh('cone','#ff9a2e',.07,.3,.07,0,.09,0);b.rotation.z=Math.PI/2;A(b);[-.3,0,.3].forEach(a=>{const l=mesh('cone','#2fae4f',.025,.12,.025,-.18,.1+Math.abs(a)*.05,a*.1);l.rotation.z=Math.PI/2+.4;A(l)})}
    else[[-.08,.05],[.08,.04],[0,-.07]].forEach(([x,z],j)=>{A(mesh('cyl','#ff9a2e',.06,.03,.06,x,.02+j*.008,z));A(mesh('cyl','#ffc27a',.03,.032,.03,x,.021+j*.008,z,false))});
  }else if(k==='cheese'){
    if(s==='raw'){const w=new THREE.Mesh(new THREE.CylinderGeometry(.17,.17,.12,3,1,false,0,Math.PI*2/3),new THREE.MeshStandardMaterial({color:col3('#ffd23f'),roughness:.5}));w.position.y=.06;w.castShadow=true;A(w)}
    else[[-.07,.05],[.07,.04],[0,-.06],[.02,.06]].forEach(([x,z],j)=>A(mesh('box','#ffd23f',.07,.05,.07,x,.025+(j%2)*.01,z)));
  }else if(k==='tortilla'){A(mesh('cyl','#f5d78e',.17,.012,.17,0,.01,0));A(mesh('cyl','#f0ca72',.17,.012,.17,.01,.022,.01));
  }else if(k==='fish'){
    const c={raw:'#7fa8c9',chopped:'#ffc1b0',cooked:'#e0a03a',burnt:'#2b2320'}[s];
    if(s==='raw'){A(mesh('sph',c,.18,.07,.08,0,.07,0));const t=mesh('cone',c,.07,.1,.03,.2,.07,0);t.rotation.z=Math.PI/2;A(t);A(mesh('sph','#ffffff',.018,.018,.018,-.13,.09,.05,false))}
    else A(mesh('box',c,.24,.05,.13,0,.03,0));
  }else if(k==='potato'){
    if(s==='raw'){A(mesh('sph','#c9975a',.15,.1,.11,0,.09,0))}
    else{const c={chopped:'#fff0b8',cooked:'#ffc93c',burnt:'#3a2a1e'}[s];for(let i=0;i<7;i++){const f=mesh('box',c,.03,.03,.18,Math.sin(i*2.3)*.06,.02+(i%3)*.025,Math.cos(i*1.9)*.04);f.rotation.y=i*.7;A(f)}}
  }
  return g;
}
function plate3(it){
  const g=new THREE.Group();g.add(mesh('cyl','#ffffff',.21,.03,.21,0,.015,0));const rim=mesh('tor','#f2f0f7',.2,.2,.08,0,.032,0);rim.rotation.x=Math.PI/2;g.add(rim);
  const L=it.c,has=k=>L.some(q=>q.k===k),fill=L.find(q=>(q.k==='meat'||q.k==='fish')&&q.s==='cooked');
  if(has('tortilla')&&fill){
    // taco: a half-cylinder shell standing on the plate, filling inside
    const sh=new THREE.Mesh(new THREE.CylinderGeometry(.13,.13,.2,20,1,true,0,Math.PI),new THREE.MeshStandardMaterial({color:col3('#f5d78e'),roughness:.7,side:THREE.DoubleSide}));
    sh.rotation.z=Math.PI/2;sh.rotation.y=Math.PI/2;sh.position.y=.16;sh.castShadow=true;g.add(sh);
    g.add(mesh('box',fill.k==='meat'?'#8b4a2b':'#e0a03a',.17,.06,.08,0,.11,0));
    if(has('lettuce'))for(let i=0;i<5;i++)g.add(mesh('sph','#6fd36a',.035,.03,.035,-.08+i*.04,.16+Math.sin(i)*.01,0));
    if(has('cheese'))for(let i=0;i<4;i++)g.add(mesh('box','#ffd23f',.03,.03,.03,-.06+i*.04,.165,(i%2-.5)*.03));
  }else if(has('bun')&&has('meat')){let y=.035;g.add(mesh('cyl','#f2c17f',.13,.035,.13,0,y+.017,0));y+=.035;
    g.add(mesh('cyl','#8b4a2b',.135,.045,.135,0,y+.022,0));y+=.045;
    if(has('cheese')){const ch=mesh('box','#ffd23f',.25,.012,.25,0,y+.006,0);ch.rotation.y=.785;g.add(ch);y+=.012}
    if(has('lettuce')){g.add(mesh('cyl','#6fd36a',.15,.015,.15,0,y+.007,0));y+=.015}
    g.add(mesh('half','#e19a4a',.135,.1,.135,0,y,0));}
  else if(L.length===1&&L[0].k==='soup'){g.add(mesh('cyl','#ffffff',.15,.08,.15,0,.07,0));const liq=mesh('cyl',soupCol(L[0].of),.13,.01,.13,0,.112,0,false);g.add(liq)}
  else{const O=[[-.07,.04],[.07,.04],[0,-.07]];L.forEach((q,j)=>{const f=food3(q);f.scale.setScalar(.7);f.position.set(O[j][0],.03,O[j][1]);g.add(f)})}
  return g;
}
const item3=it=>isPlate(it)?plate3(it):food3(it);
const sig=it=>it?(isPlate(it)?'p:'+it.c.map(key).join(','):key(it)):'';

/* ---- billboards: progress bars, warnings, name tags ---- */
function bar3(){
  const g=new THREE.Group();const bg=mesh('plane',new THREE.MeshBasicMaterial({color:0x14111f,toneMapped:false}),.78,.15,1,0,0,0,false);
  const fg=new THREE.Mesh(new THREE.PlaneGeometry(1,1).translate(.5,0,0),new THREE.MeshBasicMaterial({color:0x2fe3a0,toneMapped:false}));fg.position.set(-.36,0,.001);fg.scale.set(.72,.09,1);
  g.add(bg,fg);g.fg=fg;g.visible=false;g.renderOrder=5;bg.material.depthTest=fg.material.depthTest=false;return g;
}
function setBar(b,p,c){b.visible=true;b.fg.scale.x=.72*Math.max(.001,Math.min(1,p));if(b.c!==c){b.c=c;b.fg.material.color.copy(col3(c))}}
function sprite(tex,w,h){const s=new THREE.Sprite(new THREE.SpriteMaterial({map:tex,depthTest:false,transparent:true,toneMapped:false}));s.scale.set(w,h,1);s.renderOrder=6;return s}
function nameTex(name,colr){return canvasTex(256,72,(c,w,h)=>{c.font='900 40px system-ui,sans-serif';const tw=Math.min(240,c.measureText(name).width+36);c.fillStyle=colr;c.strokeStyle='#14111f';c.lineWidth=6;
  c.beginPath();c.roundRect?c.roundRect((w-tw)/2,8,tw,56,22):c.rect((w-tw)/2,8,tw,56);c.fill();c.stroke();c.fillStyle='#fff';c.textAlign='center';c.textBaseline='middle';c.fillText(name,w/2,37,tw-24)})}
const WARN_TEX=()=>G3.warn||(G3.warn=canvasTex(64,64,(c)=>{c.fillStyle='#ff3e5a';c.strokeStyle='#14111f';c.lineWidth=6;c.beginPath();c.arc(32,32,26,0,7);c.fill();c.stroke();c.fillStyle='#fff';c.font='900 40px system-ui';c.textAlign='center';c.textBaseline='middle';c.fillText('!',32,34)}));

/* ---- kitchen build ---- */
function build3D(){
  const T=THREE,sc=new T.Scene(),Wd=LV.Wd,H=LV.H,D=o=>{G3.dyn.add(o);return o};G3.dyn=new Set();G3.sc=sc;G3.lvl=LV.n;G3.slots={};G3.stoves={};G3.plates={};G3.parts=[];G3.bars={};
  sc.background=col3('#241b3d');
  sc.add(new T.HemisphereLight(col3('#fff6ea'),col3('#5a4370'),.42));
  const sun=new T.DirectionalLight(col3('#fff1dc'),.78);sun.position.set(Wd/2-6,12,H/2+8);sun.target.position.set(Wd/2,0,H/2);sc.add(sun,sun.target);
  sun.castShadow=true;const S=Math.max(Wd,H)*.75+2;Object.assign(sun.shadow.camera,{left:-S,right:S,top:S,bottom:-S,near:1,far:40});sun.shadow.mapSize.set(TOUCH_UI?1024:2048,TOUCH_UI?1024:2048);sun.shadow.bias=-.0006;sun.shadow.radius=3;
  const fill=new T.DirectionalLight(col3('#a8c8ff'),.35);fill.position.set(Wd/2+8,6,-4);sc.add(fill);
  // ground + raised kitchen base (diorama look)
  const gr=mesh('plane','#30264f',80,80,1,Wd/2,-.32,H/2,false);gr.rotation.x=-Math.PI/2;sc.add(gr);
  sc.add(mesh('box','#4a3a2a',Wd+.5,.3,H+.5,Wd/2,-.16,H/2));
  const fl=canvasTex(Wd*32,H*32,(c)=>{for(let y=0;y<H;y++)for(let x=0;x<Wd;x++){c.fillStyle=(x+y)%2?'#e4b98a':'#f2d9b0';c.fillRect(x*32,y*32,32,32);c.fillStyle='#00000010';c.fillRect(x*32,y*32+31,32,1);c.fillRect(x*32+31,y*32,1,32)}});
  fl.magFilter=T.NearestFilter;const floor=new T.Mesh(new T.PlaneGeometry(Wd,H),new T.MeshStandardMaterial({map:fl,roughness:.85}));floor.rotation.x=-Math.PI/2;floor.position.set(Wd/2,0,H/2);floor.receiveShadow=true;sc.add(floor);
  const BODY={'|':'#3d86b8','W':'#3f3364','S':'#e0a800'},TOP={'|':'#6cc0ec','W':'#5a4a86','S':'#ffd23f'};
  const awnTex=canvasTex(128,32,(c)=>{for(let i=0;i<8;i++){c.fillStyle=i%2?'#ffffff':'#ff3e5a';c.fillRect(i*16,0,16,32)}});
  LV.ty.forEach((ty,i)=>{
    if(ty==='.')return;const x=i%Wd+.5,z=((i/Wd)|0)+.5;
    if(ty==='W'){sc.add(mesh('box','#3f3364',1,1.35,1,x,.675,z));sc.add(mesh('box','#5a4a86',1.02,.08,1.02,x,1.39,z));return}
    sc.add(mesh('box',BODY[ty]||'#b5733c',.98,CT-.07,.98,x,(CT-.07)/2,z));
    sc.add(mesh('box',TOP[ty]||'#c9a170',1,.07,1,x,CT-.035,z));
    if(!BODY[ty])sc.add(mesh('box','#a8693a',.9,.04,.02,x,CT*.55,z+.495,false));   // drawer line
    const top=CT;
    if(CRATE[ty]){sc.add(mesh('box','#b97a44',.82,.3,.82,x,top+.15,z));sc.add(mesh('box','#8a5530',.84,.04,.06,x,top+.24,z-.25,false));sc.add(mesh('box','#8a5530',.84,.04,.06,x,top+.24,z+.25,false));
      [[-.16,-.12],[.16,-.1],[0,.14]].forEach(([dx,dz])=>{const f=food3({k:CRATE[ty],s:'raw'});f.position.set(x+dx,top+.28,z+dz);sc.add(f)})}
    if(ty==='C'){sc.add(mesh('box','#fff8ec',.78,.05,.62,x,top+.025,z));const kn=new T.Group();kn.add(mesh('box','#d6dbe6',.32,.012,.07,.05,0,0),mesh('box','#2b2320',.12,.03,.045,-.16,.005,0));kn.position.set(x+.05,top+.06,z+.18);kn.rotation.y=.5;sc.add(D(kn));G3.slots[i]={knife:kn}}
    if(ty==='K'||ty==='F'){sc.add(mesh('box','#3b3f4c',.94,.04,.94,x,top+.02,z));const ring=D(mesh('tor',new T.MeshStandardMaterial({color:col3('#555'),emissive:col3('#ff5a00'),emissiveIntensity:0}),.28,.28,.4,x,top+.05,z,false));ring.rotation.x=Math.PI/2;sc.add(ring);
      const st={ring,bar:bar3(),warn:sprite(WARN_TEX(),.38,.38)};st.warn.visible=false;st.bar.position.set(x,top+.95,z);st.warn.position.set(x+.32,top+.9,z);sc.add(D(st.bar),D(st.warn));
      if(ty==='K'){const pot=new T.Group();pot.add(mesh('tube',new T.MeshStandardMaterial({color:col3('#c6ccd8'),metalness:.6,roughness:.3,side:T.DoubleSide}),.3,.3,.3,0,.15,0));pot.add(mesh('cyl','#5b6273',.29,.02,.29,0,.01,0));const lip=mesh('tor',new T.MeshStandardMaterial({color:col3('#dfe4ee'),metalness:.6,roughness:.25}),.3,.3,.25,0,.3,0);lip.rotation.x=Math.PI/2;pot.add(lip);
        pot.add(mesh('box','#3b3f4c',.12,.04,.06,.34,.26,0),mesh('box','#3b3f4c',.12,.04,.06,-.34,.26,0));
        st.liq=mesh('cyl',new T.MeshStandardMaterial({color:col3('#2b3040'),roughness:.35}),.27,.01,.27,0,.29,0,false);pot.add(st.liq);
        st.chunks=new T.Group();st.chunks.position.y=.3;pot.add(st.chunks);pot.position.set(x,top+.04,z);sc.add(D(pot));st.pot=pot}
      else{const pan=new T.Group();pan.add(mesh('cyl','#2a2a33',.3,.06,.3,0,.03,0),mesh('box','#2a2a33',.34,.04,.06,.42,.06,0));pan.position.set(x,top+.05,z);pan.rotation.y=-.4;sc.add(D(pan));st.pan=pan;st.food=new T.Group();st.food.position.y=.06;pan.add(st.food)}
      st.sig='';G3.stoves[i]=st}
    if(ty==='D'){const g=D(new T.Group());g.position.set(x,top,z);sc.add(g);G3.plates[i]={g,n:-1}}
    if(ty==='X'){sc.add(mesh('cyl','#8d94a6',.28,.42,.28,x,top+.21,z));sc.add(mesh('cyl','#b1b8c8',.31,.05,.31,x,top+.44,z));sc.add(mesh('box','#5d6475',.14,.04,.05,x,top+.48,z))}
    if(ty==='S'){const aw=new T.Mesh(G3.g.box,[G3.m('#ff3e5a'),G3.m('#ff3e5a'),new T.MeshStandardMaterial({map:awnTex}),G3.m('#ff3e5a'),new T.MeshStandardMaterial({map:awnTex}),G3.m('#ff3e5a')]);
      aw.scale.set(1.05,.08,1.05);aw.position.set(x,top+.95,z);aw.castShadow=true;sc.add(aw);
      [[-.45,-.45],[.45,-.45],[-.45,.45],[.45,.45]].forEach(([dx,dz])=>sc.add(mesh('cyl','#ffffff',.035,.95,.035,x+dx,top+.47,z+dz)));
      sc.add(mesh('half',new T.MeshStandardMaterial({color:col3('#ffd23f'),metalness:.6,roughness:.3}),.14,.12,.14,x+.2,top,z+.2));sc.add(mesh('sph','#14111f',.025,.025,.025,x+.2,top+.13,z+.2));
      const sign=sprite(canvasTex(256,96,(c,w,h)=>{c.fillStyle='#ffe14d';c.strokeStyle='#14111f';c.lineWidth=8;c.beginPath();c.roundRect?c.roundRect(6,6,w-12,h-12,22):c.rect(6,6,w-12,h-12);c.fill();c.stroke();c.fillStyle='#14111f';c.font='400 64px Bangers,Impact,sans-serif';c.textAlign='center';c.textBaseline='middle';c.fillText('SERVE',w/2,h/2+3)}),.95,.36);
      sign.position.set(x,top+1.32,z);sc.add(sign)}
    if(ty==='C'||ty==='#'||ty==='|'){G3.slots[i]=Object.assign(G3.slots[i]||{},{sig:'',obj:null,bar:bar3()});const b=G3.slots[i].bar;b.position.set(x,top+.85,z);sc.add(D(b))}
  });
  // target highlight
  const hl=new T.Mesh(new T.BoxGeometry(1.04,.06,1.04),new T.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.45,depthWrite:false}));hl.visible=false;sc.add(hl);G3.hl=hl;
  const hle=new T.LineSegments(new T.EdgesGeometry(new T.BoxGeometry(1.04,.07,1.04)),new T.LineBasicMaterial({color:0xffffff}));hl.add(hle);G3.hle=hle;
  // chefs
  G3.chefs=[0,1].map(ci=>chef3(ci));G3.chefs.forEach(c=>sc.add(D(c.root)));D(hl);
  // merge everything that never moves into a few big meshes (one per material): far fewer draw calls
  const stat=sc.children.filter(o=>!G3.dyn.has(o)&&(o.isMesh||o.isGroup)&&!(o.isMesh&&Array.isArray(o.material)));
  const grp=new T.Group();stat.forEach(o=>{sc.remove(o);grp.add(o)});sc.add(mergeGroup(grp));
  fit3D();
}
function mergeGroup(g){
  const T=THREE;g.updateMatrixWorld(true);const by=new Map();
  g.traverse(o=>{if(!o.isMesh)return;let e=by.get(o.material.uuid);if(!e){e={mat:o.material,list:[],cast:false};by.set(o.material.uuid,e)}e.list.push(o);if(o.castShadow)e.cast=true});
  const out=new T.Group();
  by.forEach(({mat,list,cast})=>{let n=0;
    const parts=list.map(o=>{const geo=o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone();geo.applyMatrix4(o.matrixWorld);n+=geo.attributes.position.count;return geo});
    const pos=new Float32Array(n*3),nor=new Float32Array(n*3),uv=new Float32Array(n*2);let off=0;
    parts.forEach(geo=>{const c=geo.attributes.position.count;pos.set(geo.attributes.position.array,off*3);nor.set(geo.attributes.normal.array,off*3);if(geo.attributes.uv)uv.set(geo.attributes.uv.array,off*2);off+=c;geo.dispose()});
    const bg=new T.BufferGeometry();bg.setAttribute('position',new T.BufferAttribute(pos,3));bg.setAttribute('normal',new T.BufferAttribute(nor,3));bg.setAttribute('uv',new T.BufferAttribute(uv,2));
    const m=new T.Mesh(bg,mat);m.castShadow=cast;m.receiveShadow=true;out.add(m)});
  return out;
}
/* chefs: glossy round balls with a toon outline, big eyes, a chef hat and floating hands */
function chef3(ci){
  const T=THREE,root=new T.Group(),body=new T.Group(),colr=ci===0?'#ff3e8a':'#2d7bff';root.add(body);
  const gloss=new T.MeshPhysicalMaterial({color:col3(colr),roughness:.28,metalness:0,clearcoat:.8,clearcoatRoughness:.25});
  const outline=c=>new T.MeshBasicMaterial({color:0x14111f,side:T.BackSide});
  const ball=new T.Group();ball.position.y=.4;body.add(ball);
  ball.add(mesh('sph',gloss,.34,.34,.34,0,0,0));ball.add(mesh('sph',outline(),.365,.365,.365,0,0,0,false));
  // belly patch + little apron tie
  ball.add(mesh('sph',new T.MeshStandardMaterial({color:col3('#ffffff'),roughness:.6}),.25,.22,.12,0,-.1,.25,false));
  // face: white eyes with pupils and shines, rosy cheeks, a smile
  const face=new T.Group();face.position.set(0,.15,.3);face.rotation.x=-.5;ball.add(face);   // tilted up so the top-down camera sees it
  const eyes=[-1,1].map(s=>{const e=new T.Group();e.position.set(s*.105,.03,0);
    e.add(mesh('sph','#ffffff',.072,.088,.04,0,0,0,false),mesh('sph','#14111f',.044,.055,.03,0,-.01,.025,false),mesh('sph','#ffffff',.014,.014,.01,.012,.015,.05,false));face.add(e);return e});
  [-1,1].forEach(s=>face.add(mesh('sph','#ff8fb0',.045,.026,.012,s*.17,-.06,-.015,false)));
  const smile=mesh(new T.TorusGeometry(.045,.012,6,14,Math.PI),'#14111f',1,1,1,0,-.06,.02,false);smile.rotation.z=Math.PI;face.add(smile);
  // chef hat
  const hat=new T.Group();hat.position.set(0,.3,-.07);hat.rotation.x=-.32;hat.scale.setScalar(.9);ball.add(hat);
  const white=new T.MeshStandardMaterial({color:col3('#ffffff'),roughness:.55});
  hat.add(mesh('cyl',white,.19,.12,.19,0,.05,0));hat.add(mesh('cyl',outline(),.205,.125,.205,0,.05,0,false));
  [[-.11,0],[.11,0],[0,-.1],[0,.1],[0,0]].forEach(([x,z],k)=>hat.add(mesh('sph',white,k===4?.15:.11,k===4?.13:.1,k===4?.15:.11,x,.2+(k===4?.04:0),z)));
  // floating hands + little feet
  const hands=[-1,1].map(s=>{const h=new T.Group();h.position.set(s*.4,.36,.08);h.add(mesh('sph','#ffffff',.075,.075,.075,0,0,0));h.add(mesh('sph',outline(),.085,.085,.085,0,0,0,false));body.add(h);return h});
  const feet=[-1,1].map(s=>{const f=mesh('sph','#2b2147',.09,.055,.12,s*.13,.04,.02);root.add(f);return f});
  const held=new T.Group();held.position.set(0,.3,.46);body.add(held);
  const knife=new T.Group();knife.add(mesh('box','#d6dbe6',.04,.012,.24,0,0,.1),mesh('box','#2b2320',.04,.03,.09,0,0,-.05));knife.visible=false;hands[1].add(knife);knife.position.set(0,0,.04);
  const tag=sprite(nameTex('',colr),.9,.25);tag.position.y=1.42;root.add(tag);
  return{root,body,ball,eyes,hat,hands,feet,held,knife,tag,colr,heldSig:null,name:'',yaw:0,blink:2+Math.random()*3};
}
function setTag(c,name){if(c.name===name)return;c.name=name;c.tag.material.map&&c.tag.material.map.dispose();c.tag.material.map=nameTex(name,c.colr);c.tag.material.needsUpdate=true}

/* ---- camera fit: whole kitchen inside the free part of the screen ---- */
function fit3D(){
  if(!G3.ok||!G3.sc)return;const T=THREE,el=$('#oustage'),w=el.clientWidth,h=el.clientHeight;if(!w||!h)return;
  G3.r.setPixelRatio(Math.min(TOUCH_UI?1.75:2,devicePixelRatio||1));G3.r.setSize(w,h,false);
  const cam=G3.cam,portrait=h>w*1.05;cam.aspect=w/h;cam.fov=portrait?42:34;G3.yaw=portrait?Math.PI/2:0;
  const short=h<520,top=portrait?Math.min(170,h*.2):short?78:112,bot=TOUCH_UI?(portrait?150:16):56,sideL=12,sideR=12;
  const pitch=portrait?1.12:.98,Wd=LV.Wd,H=LV.H,tgt=new T.Vector3(Wd/2,0,H/2);
  const dir=new T.Vector3(Math.sin(G3.yaw)*Math.cos(pitch),Math.sin(pitch),Math.cos(G3.yaw)*Math.cos(pitch));
  const cs=[];for(const x of[-.1,Wd+.1])for(const y of[0,1.3])for(const z of[-.1,H+.1])cs.push(new T.Vector3(x,y,z));
  const L=-1+2*sideL/w,R=1-2*sideR/w,B=-1+2*bot/h,Tp=1-2*top/h;
  let d=Math.max(Wd,H)*1.6;const off=new T.Vector3();
  const place=()=>{cam.position.copy(tgt).add(off).addScaledVector(dir,d);cam.lookAt(tgt.clone().add(off));cam.updateMatrixWorld();cam.updateProjectionMatrix()};
  const box=()=>{let a=1e9,b=-1e9,c=1e9,e=-1e9;cs.forEach(v=>{const p=v.clone().project(cam);a=Math.min(a,p.x);b=Math.max(b,p.x);c=Math.min(c,p.y);e=Math.max(e,p.y)});return[a,b,c,e]};
  for(let it=0;it<6;it++){
    place();let[a,b,c,e]=box();d*=Math.max((b-a)/(R-L),(e-c)/(Tp-B));place();[a,b,c,e]=box();
    const hh=d*Math.tan(cam.fov*Math.PI/360),hw=hh*cam.aspect,right=new T.Vector3(1,0,0).applyQuaternion(cam.quaternion),up=new T.Vector3(0,1,0).applyQuaternion(cam.quaternion);
    off.addScaledVector(right,((a+b)/2-(L+R)/2)*hw).addScaledVector(up,((c+e)/2-(B+Tp)/2)*hh);
  }
  place();
}

/* ---- per-frame update ---- */
function puff(x,y,z,colr,life,vy,size){const m=mesh('sph',new THREE.MeshBasicMaterial({color:col3(colr),transparent:true,opacity:.7,depthWrite:false}),size,size,size,x,y,z,false);G3.sc.add(m);G3.parts.push({m,t:0,life,vy,vx:(Math.random()-.5)*.2,vz:(Math.random()-.5)*.2,s:size})}
function render3D(now,dt){
  if(!G3.sc||G3.lvl!==LV.n)build3D();
  const t=now/1000,sc=G3.sc,cam=G3.cam;
  // counter items + chopping
  for(const i in G3.slots){const sl=G3.slots[i];if(!('sig' in sl))continue;const it=W.t[i],sg=sig(it);
    if(sl.sig!==sg){sl.sig=sg;if(sl.obj)sc.remove(sl.obj);sl.obj=null;if(it){sl.obj=item3(it);const x=i%LV.Wd+.5,z=((i/LV.Wd)|0)+.5;sl.obj.position.set(x,CT+(LV.ty[i]==='C'?.05:0),z);sc.add(sl.obj);if(sl.knife)sl.knife.visible=false}else if(sl.knife)sl.knife.visible=true}
    if(sl.obj){const ch=W.chop.includes(+i);sl.obj.position.y=CT+(LV.ty[i]==='C'?.05:0)+(ch?Math.abs(Math.sin(t*22))*.03:0)}
    if(it&&it.cp>0&&it.s==='raw')setBar(sl.bar,it.cp,'#38d6ff');else sl.bar.visible=false;
    sl.bar.quaternion.copy(cam.quaternion)}
  // stoves
  for(const i in G3.stoves){const st=G3.stoves[i],s=W.st[i],pot=LV.ty[i]==='K',x=i%LV.Wd+.5,z=((i/LV.Wd)|0)+.5;
    const on=pot?s.c.length===3:s.c.length>0,burnt=s.p>=2,done=s.p>=1&&!burnt;
    st.ring.material.emissiveIntensity=on&&!burnt?.9+Math.sin(t*8)*.2:0;
    const sg=s.c.join()+'|'+(burnt?'b':done?'d':'r');
    if(st.sig!==sg){st.sig=sg;
      if(pot){st.chunks.clear();const c=potCol(s.c);st.liq.material.color.copy(col3(burnt?'#3a2f2a':c));st.liq.scale.set(.27,.01,.27);st.liq.position.y=s.c.length?.14+.04*s.c.length:.29;st.liq.visible=s.c.length>0;
        if(!done&&!burnt)s.c.forEach((k,j)=>{const f=food3({k,s:'chopped'});f.scale.setScalar(.6);f.position.set(Math.sin(j*2.1)*.1,st.liq.position.y-.3,Math.cos(j*2.1)*.1);st.chunks.add(f)})}
      else{st.food.clear();if(s.c.length)st.food.add(food3({k:s.c[0],s:burnt?'burnt':done?'cooked':'chopped'}))}}
    if(pot&&st.chunks.children.length)st.chunks.children.forEach((f,j)=>f.position.y=st.liq.position.y-.3+Math.sin(t*4+j)*.01);
    if(s.c.length&&(!pot||s.c.length===3)){
      if(s.p<1)setBar(st.bar,s.p,'#ff8a1f');else if(!burnt)setBar(st.bar,s.p-1,s.p>1.6?'#ff3e5a':'#2fe3a0');else st.bar.visible=false;
      st.warn.visible=s.p>1.6&&!burnt&&Math.sin(t*14)>-.3;if(st.warn.visible)st.warn.scale.setScalar(.38+Math.sin(t*14)*.05);
      if(done&&Math.random()<dt*8)puff(x+(Math.random()-.5)*.3,CT+.45,z+(Math.random()-.5)*.3,'#ffffff',1.2,.5,.06);
      if(burnt&&Math.random()<dt*10)puff(x+(Math.random()-.5)*.3,CT+.4,z+(Math.random()-.5)*.3,'#444',1.6,.6,.09);
      if(!pot&&!burnt&&Math.random()<dt*6)puff(x+(Math.random()-.5)*.3,CT+.2,z,'#ffe8c2',.5,.6,.03);
    }else{st.bar.visible=false;st.warn.visible=false}
    st.bar.quaternion.copy(cam.quaternion)}
  // plate stacks
  for(const i in G3.plates){const p=G3.plates[i],n=W.pc[i]||0;if(p.n!==n){p.n=n;p.g.clear();for(let k=0;k<n;k++){const m=mesh('cyl','#ffffff',.21,.03,.21,0,.02+k*.04,0);p.g.add(m)}}}
  // chefs
  const pos=[];pos[OU.ci]={...OU.me,chop:W.chop[OU.ci]>=0};pos[1-OU.ci]=remoteChef(now);OU.remPos=pos[1-OU.ci];
  G3.chefs.forEach((c,ci)=>{const p=pos[ci];if(!p)return;
    c.root.position.set(p.x,0,p.y);const want=Math.atan2(p.fx||0,p.fy==null?1:p.fy);c.yaw+=angW(want-c.yaw)*Math.min(1,dt*14);c.root.rotation.y=c.yaw;
    const walk=p.walk?1:0;c.wk=(c.wk||0)+(walk-(c.wk||0))*Math.min(1,dt*10);const ph=t*13;
    // waddle: hop, squash & stretch, lean into the run
    const hop=Math.abs(Math.sin(ph));c.body.position.y=hop*.07*c.wk;c.body.rotation.z=Math.sin(ph)*.08*c.wk;c.body.rotation.x=.12*c.wk;
    const sq=1+(hop-.5)*.12*c.wk+Math.sin(t*2.2+ci)*.012;c.ball.scale.set(1/Math.sqrt(sq),sq,1/Math.sqrt(sq));
    c.feet[0].position.z=.02+Math.sin(ph)*.11*c.wk;c.feet[1].position.z=.02-Math.sin(ph)*.11*c.wk;
    c.blink-=dt;const shut=c.blink<.12;if(c.blink<0)c.blink=2+Math.random()*3.5;c.eyes.forEach(e=>e.scale.y=shut?.12:1);
    c.hat.rotation.z=-Math.sin(ph)*.05*c.wk;
    const held=W.h[ci],hs=sig(held);if(c.heldSig!==hs){c.heldSig=hs;c.held.clear();if(held)c.held.add(item3(held))}
    const hold=!!held;c.hands.forEach((h,s)=>{const sx=s?1:-1;h.position.set(sx*(hold?.24:.42),hold?.3:.36+Math.sin(ph+s*3)*.04*c.wk+Math.sin(t*3+s)*.015,hold?.42:.06)});
    c.knife.visible=!!p.chop;if(p.chop){c.hands[1].position.set(.2,.6+Math.abs(Math.sin(t*24))*.12,.4);c.hands[0].position.set(-.2,.48,.38)}
    setTag(c,ci===OU.ci?(me.n||'You'):(on||'Partner'));c.tag.position.y=1.42+c.body.position.y;
  });
  // target highlight
  if(OU.target>=0&&W.ph==='play'){const i=OU.target,ty=LV.ty[i],hh=ty==='W'?1.42:CT;G3.hl.visible=true;G3.hl.position.set(i%LV.Wd+.5,hh+.01,((i/LV.Wd)|0)+.5);
    const cc=OU.ci===0?0xff3e8a:0x2d7bff;G3.hl.material.color.setHex(cc);G3.hle.material.color.setHex(cc);G3.hl.material.opacity=.25+Math.sin(t*6)*.12}else G3.hl.visible=false;
  // particles
  G3.parts=G3.parts.filter(q=>{q.t+=dt;const k=q.t/q.life;if(k>=1){sc.remove(q.m);q.m.material.dispose();return false}
    q.m.position.x+=q.vx*dt;q.m.position.z+=q.vz*dt;q.m.position.y+=q.vy*dt;q.m.scale.setScalar(q.s*(1+k*2));q.m.material.opacity=.7*(1-k);return true});
  G3.r.render(sc,cam);
}
function float3(i,txt,colr){
  if(!G3.ok||!G3.sc){OU.floats.push({i,txt,a:0,col:colr});return}
  const T=THREE,v=i>=0?new T.Vector3(i%LV.Wd+.5,CT+.9,((i/LV.Wd)|0)+.5):new T.Vector3(LV.Wd/2,1.5,LV.H/2);v.project(G3.cam);
  const el=$('#oustage'),x=(v.x+1)/2*el.clientWidth,y=(1-v.y)/2*el.clientHeight,d=document.createElement('span');
  d.className='oufl';d.textContent=txt;d.style.left=x+'px';d.style.top=y+'px';d.style.color=colr;$('#oufloat').append(d);setTimeout(()=>d.remove(),1500);
}
function puffServe(i){if(!G3.ok||!G3.sc)return;const x=i%LV.Wd+.5,z=((i/LV.Wd)|0)+.5;for(let k=0;k<14;k++)puff(x+(Math.random()-.5)*.6,CT+.3,z+(Math.random()-.5)*.6,['#ffe14d','#2fe3a0','#ff3e8a','#38d6ff'][k%4],.8,1.4,.04)}

/* ---------------- HUD, orders, lobby ---------------- */
const fmt=s=>{s=Math.ceil(s);return Math.floor(s/60)+':'+String(s%60).padStart(2,'0')};
function orderCard(o){
  const R=RECIPES[o.r],plate={k:'plate',c:R.need.map(keyItem)};
  let ing='';R.need.forEach(k=>{const it=keyItem(k);
    if(it.k==='soup'){const m=SOUPS[it.of].mix;if(m.every(x=>x===m[0]))ing+=`<b>3×</b><img src="${icon({k:m[0],s:'chopped'},36)}">`;else m.forEach(x=>ing+=`<img src="${icon({k:x,s:'chopped'},36)}">`);ing+=`<img src="${POT_ICON}">`}
    else if(it.s==='cooked'&&ING[it.k]&&ING[it.k].fry)ing+=`<img src="${icon({k:it.k,s:'chopped'},36)}"><img src="${PAN_ICON}">`;
    else ing+=`<img src="${icon(it,36)}">`});
  const d=document.createElement('div');d.className='ouord';d.dataset.id=o.id;
  d.innerHTML=`<img class="d" src="${icon(plate,88)}" alt=""><small>${R.n}</small><div class="ing">${ing}</div><div class="bar"><i></i></div>`;return d;
}
function hud(){
  if(!W)return;const L=LEVELS[W.lvl];
  const kn=L.n+' · '+(OU.ci===0?'left':'right')+' side';if($('#oukitn').textContent!==kn)$('#oukitn').textContent=kn;
  const se_=$('#ouscore');if(se_.textContent!==String(W.score)){if(+se_.textContent<W.score){se_.classList.remove('bump');void se_.offsetWidth;se_.classList.add('bump')}se_.textContent=W.score}const tl=$('#outime');tl.textContent=fmt(W.tl);tl.classList.toggle('low',W.ph==='play'&&W.tl<=20);
  const st=L.stars.filter(s=>W.score>=s).length,nx=L.stars[st],sh=`<b style="color:#f5b800;-webkit-text-stroke:.5px #14111f">${'★'.repeat(st)}</b><b style="color:#14111f30">${'★'.repeat(3-st)}</b>${nx?' next at '+nx:' max!'}`;
  const se=$('#oustar');if(se.dataset.h!==sh){se.dataset.h=sh;se.innerHTML=sh}
  const box=$('#ouorders'),have=new Map([...box.children].map(e=>[+e.dataset.id,e]));
  W.orders.forEach(o=>{let e=have.get(o.id);if(!e){e=orderCard(o);e.style.setProperty('--tc',RECIPES[o.r].col||'#ff8a1f');box.append(e)}have.delete(o.id);
    const f=o.t/o.T,b=e.querySelector('.bar i');b.style.width=(f*100).toFixed(1)+'%';b.style.background=f>.5?'#2fe3a0':f>.25?'#ffb800':'#ff3e5a';e.classList.toggle('hot',f<.2)});
  have.forEach(e=>e.remove());
}
function lobbyUI(){
  const el=$('#oulobby'),show_=W&&W.ph==='lobby'&&OU.gotSnap;el.hidden=!show_;if(!show_)return;
  const L=LEVELS[W.lvl],host=OU.auth,myRole=host?0:1,nm=ci=>ci===OU.ci?esc(me.n):esc(on||'Partner');
  const rdy=ci=>W.rdy[ci===W.hc?0:1];
  const sig=JSON.stringify([W.lvl,W.hc,W.rdy,host,!!opp,on]);if(el.dataset.sig===sig)return;el.dataset.sig=sig;
  el.innerHTML=`<div class="card"><h3>Kitchen lobby</h3>
   <div class="oukit"><button id="oukp" ${host&&W.lvl>0?'':'disabled'} aria-label="Previous kitchen">◀</button><b>${L.n}</b><button id="ouknx" ${host&&W.lvl<LEVELS.length-1?'':'disabled'} aria-label="Next kitchen">▶</button></div>
   <p class="note" style="margin:0">${L.desc} ${fmt(L.time)} on the clock.${host?'':' Your partner picks the kitchen.'}</p>
   <div class="ousides">${[0,1].map(ci=>`<div class="ouside ${ci?'r':'l'}"><em>${ci?'Right side':'Left side'} · ${L.roles[ci]}</em><b>${nm(ci)}${ci===OU.ci?' (you)':''}</b><span class="${rdy(ci)?'ok':''}">${rdy(ci)?'✔ Ready!':(ci!==OU.ci&&!opp?'Not connected':'Not ready')}</span></div>`).join('')}</div>
   <div class="row">${host?'<button class="btn o sm" id="ouswap">⇄ Swap sides</button>':''}<button class="btn sm" id="ourdy">${W.rdy[myRole]?'Not ready':'Ready!'}</button></div>
   <p class="note" style="margin:6px 0 0">The round starts when both chefs are ready.</p></div>`;
  const b=id=>el.querySelector(id);
  if(b('#oukp'))b('#oukp').onclick=()=>{if(OU.auth&&W.lvl>0){W=makeWorld(W.lvl-1,W.hc);resetMe();dirty();SFX.sel()}};
  if(b('#ouknx'))b('#ouknx').onclick=()=>{if(OU.auth&&W.lvl<LEVELS.length-1){W=makeWorld(W.lvl+1,W.hc);resetMe();dirty();SFX.sel()}};
  if(b('#ouswap'))b('#ouswap').onclick=()=>{if(!OU.auth)return;W.hc=1-W.hc;W.rdy=[0,0];OU.ci=W.hc;resetMe();dirty();SFX.sel()};
  b('#ourdy').onclick=()=>{SFX.ui();doAct('ready',-1,W.rdy[myRole]?0:1)};
}
function msgUI(){
  const m=$('#oumsg');let h='';
  if(!OU.gotSnap)h=`<div class="pnl">Connecting to the kitchen…</div>`;
  else if(OU.gone)h=`<div class="pnl">⏸ ${esc(on||'Your partner')} disconnected.<br>The kitchen is paused until they're back.</div>`;
  else if(W.paused)h=`<div class="pnl">⏸ Waiting for your partner…</div>`;
  else if(W.rcd>0)h=`<div><span>${Math.ceil(W.rcd)}</span><small>Back to work!</small></div>`;
  else if(W.ph==='count'&&W.cd>0)h=`<div><span>${W.cd>3?'READY?':Math.ceil(W.cd)}</span><small>${LEVELS[W.lvl].n}</small></div>`;
  else if(W.ph==='play'&&performance.now()-OU.goAt<700)h=`<div><span>GO!</span></div>`;
  if(m.dataset.h!==h){m.dataset.h=h;m.innerHTML=h}
}

/* ---------------- fx: sounds + floating text for shared events ---------------- */
function processFx(){
  if(!W)return;
  for(const f of W.fx){if(f.id<=OU.fxSeen)continue;OU.fxSeen=f.id;
    const k=f.k;
    if(k==='serve'){SFX.bell();float3(f.i,f.txt,'#2fe3a0');puffServe(f.i)}
    else if(k==='wrong'){SFX.wrong();float3(f.i,f.txt,'#ff3e5a')}
    else if(k==='expire'){SFX.hurt();float3(-1,f.txt,'#ff3e5a')}
    else if(k==='chopped')SFX.coin();
    else if(k==='ready')SFX.ding();
    else if(k==='burnt'){SFX.splat();float3(f.i,'BURNT!','#ff3e5a')}
    else if(k==='warn')SFX.creak();
    else if(k==='order')SFX.sel();
    else if(k==='trash')SFX.trash();
    else if(k==='plop'){SFX.squirt()}
    else if(k==='sizzle')SFX.drizzle();
    else if(k==='go'){SFX.go();OU.goAt=performance.now()}
    else if(k==='end')showResults();
  }
}
function showResults(){
  const L=LEVELS[W.lvl],st=(W.res&&W.res.stars)||0;
  jingle(st>0);
  setOver(st===3?'⭐ MASTER CHEFS! ⭐':st?'ORDER UP! '+'★'.repeat(st)+'☆'.repeat(3-st):'KITCHEN CLOSED!',
    `${esc(L.n)} · team score <b>${W.score}</b><br>${W.served} dish${W.served===1?'':'es'} served · ${W.failed} missed<br><small>Stars at ${L.stars.join(' / ')} points</small>`,'Next round');
}

/* ---------------- my chef: movement + targeting ---------------- */
function resetMe(){const sp=LV.spawn[OU.ci];OU.me={x:sp.x,y:sp.y,fx:0,fy:1,walk:0};}
function moveMe(dt){
  const k=OU.keys,tch=OU.touch;let mx=((k.KeyD||k.ArrowRight)?1:0)-((k.KeyA||k.ArrowLeft)?1:0),my=((k.KeyS||k.ArrowDown)?1:0)-((k.KeyW||k.ArrowUp)?1:0);
  if(!mx&&!my){mx=tch.mx;my=tch.my}
  if(G3.yaw){const cy=Math.cos(G3.yaw),sy=Math.sin(G3.yaw),wx=mx*cy+my*sy,wy=-mx*sy+my*cy;mx=wx;my=wy}
  const m=Math.hypot(mx,my),me_=OU.me;if(!me_)return;
  if(m>1){mx/=m;my/=m}
  const can=!W.paused&&!OU.gone&&W.rcd<=0&&W.ph!=='count'&&W.ph!=='end';
  if(m>0.15&&can){
    me_.fx=mx/Math.max(.001,Math.hypot(mx,my));me_.fy=my/Math.max(.001,Math.hypot(mx,my));
    OU.dcd=Math.max(0,OU.dcd-dt);OU.dash=Math.max(0,OU.dash-dt);
    const sp=DEF.speed*(OU.dash>0?DEF.dash:1)*Math.min(1,m);
    slide(me_,mx*sp*dt,my*sp*dt);me_.walk=1;
    if(OU.chopHeld&&W.chop[OU.ci]>=0)stopChop();
  }else{me_.walk=0;OU.dcd=Math.max(0,OU.dcd-dt);OU.dash=Math.max(0,OU.dash-dt)}
}
function slide(p,dx,dy){const R=DEF.R;p.x+=dx;collide(p,R);p.y+=dy;collide(p,R)}
function collide(p,R){
  for(let k=0;k<2;k++)for(let ty=Math.floor(p.y)-1;ty<=Math.floor(p.y)+1;ty++)for(let tx=Math.floor(p.x)-1;tx<=Math.floor(p.x)+1;tx++){
    if(!solid(tx,ty))continue;const nx=Math.max(tx,Math.min(p.x,tx+1)),ny=Math.max(ty,Math.min(p.y,ty+1)),dx=p.x-nx,dy=p.y-ny,d=Math.hypot(dx,dy);
    if(d<R){if(d>1e-6){p.x+=dx/d*(R-d);p.y+=dy/d*(R-d)}else{p.y+=R}}}
}
function findTarget(){
  const p=OU.me;if(!p)return-1;const cx=Math.floor(p.x),cy=Math.floor(p.y);let best=-1,bs=-9;
  for(let ty=cy-1;ty<=cy+1;ty++)for(let tx=cx-1;tx<=cx+1;tx++){
    if(tx<0||ty<0||tx>=LV.Wd||ty>=LV.H)continue;const i=ty*LV.Wd+tx,c=LV.ty[i];if(c==='.'||c==='W')continue;
    const dx=tx+.5-p.x,dy=ty+.5-p.y,d=Math.hypot(dx,dy);if(d>1.3)continue;
    const dot=(dx*p.fx+dy*p.fy)/d;if(dot<.3)continue;const sc=dot-d*.35;if(sc>bs){bs=sc;best=i}}
  return best;
}
function grab(){
  if(!W||W.ph!=='play'||W.paused||OU.gone||W.rcd>0)return;const i=OU.target;if(i<0)return;
  const r=grabRule(OU.ci,i);if(!r){SFX.tick();return}
  if(!OU.auth)SFX.pop();doAct('grab',i);
}
function startChop(){OU.chopHeld=true;}
function stopChop(){if(OU.chopHeld){OU.chopHeld=false;if(!OU.auth)NET.ev({e:'oa',a:'chop0'});else act(OU.ci,'chop0')}}
function chopTick(now){
  if(!OU.chopHeld||!W||W.ph!=='play')return;const i=OU.target;
  if(i<0||!canChop(OU.ci,i)){return}
  if(OU.auth)act(OU.ci,'chop1',i);
  else if(now-OU.chopSent>220){OU.chopSent=now;NET.ev({e:'oa',a:'chop1',i,p:myPos()})}
  if(now-(OU.chopSnd||0)>130){OU.chopSnd=now;sfx(260+Math.random()*80,.035,'square',.5)}
}
function promptUI(){
  let txt='';
  if(W&&W.ph==='play'&&!W.paused&&OU.target>=0){const r=grabRule(OU.ci,OU.target),ch=canChop(OU.ci,OU.target);
    const kb=!TOUCH_UI;
    if(r)txt+=(kb?'<kbd>Space</kbd>':'<kbd>GRAB</kbd>')+esc(r.lbl);
    if(ch)txt+=(txt?' &nbsp; ':'')+(kb?'<kbd>Hold F</kbd>':'<kbd>Hold CHOP</kbd>')+'Chop it';
    if(!txt){const hn=hintAt(OU.ci,OU.target);if(hn)txt=esc(hn);else if(W.h[OU.ci])txt='Holding '+esc(iname(W.h[OU.ci]))}
  }else if(W&&W.ph==='play'&&W.h[OU.ci])txt='Holding '+esc(iname(W.h[OU.ci]));
  else if(W&&W.ph==='lobby')txt=TOUCH_UI&&innerHeight>innerWidth?'Tip: turn your phone sideways for a bigger kitchen':'Walk around while you wait. Ready up when you are set!';
  if(OU.prompt!==txt){OU.prompt=txt;const pe=$('#ouprompt');pe.innerHTML=txt;pe.classList.toggle('none',!txt)}
  if(TOUCH_UI){const g=$('#oupads .ob.g'),c=$('#oupads .ob.c');if(g){const r=W&&W.ph==='play'&&OU.target>=0&&grabRule(OU.ci,OU.target);g.classList.toggle('dim',!r);
    const lb=!r?'GRAB':/^Serve/.test(r.lbl)?'SERVE':/^(Put|Pass|Stack)/.test(r.lbl)?'PLACE':'GRAB';if(g.textContent!==lb)g.textContent=lb;
    c.classList.toggle('dim',!(W&&OU.target>=0&&canChop(OU.ci,OU.target)))}}
}

/* ---------------- input ---------------- */
const typing=e=>e.target&&(e.target.tagName==='INPUT'||e.target.tagName==='SELECT'||e.target.tagName==='TEXTAREA');
addEventListener('keydown',e=>{
  if($('#ougame').hidden||typing(e))return;
  if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code))e.preventDefault();
  if(e.repeat){OU.keys[e.code]=true;return}
  OU.keys[e.code]=true;
  if(e.code==='Space'||e.code==='KeyE'||e.code==='Enter')grab();
  if(e.code==='KeyF'||e.code==='KeyJ'||e.code==='ControlLeft')startChop();
  if((e.code==='ShiftLeft'||e.code==='ShiftRight'||e.code==='KeyK')&&OU.dcd<=0){OU.dash=.22;OU.dcd=.7;SFX.dodge()}
});
addEventListener('keyup',e=>{OU.keys[e.code]=false;if(e.code==='KeyF'||e.code==='KeyJ'||e.code==='ControlLeft')stopChop()});
addEventListener('blur',()=>{OU.keys={};stopChop();OU.touch.mx=OU.touch.my=0});
function buildPads(){
  const box=$('#oupads');box.hidden=!TOUCH_UI;if(!TOUCH_UI)return;
  box.innerHTML='<div class="joy"><div class="knob"><i></i></div></div><div class="btns"><button class="ob d" data-k="dash">DASH</button><button class="ob c" data-k="chop">CHOP</button><button class="ob g" data-k="grab">GRAB</button></div>';
  const joy=box.querySelector('.joy'),kn=box.querySelector('.knob'),ki=kn.querySelector('i');let jid=null,bx=0,by=0;
  joy.addEventListener('pointerdown',e=>{e.preventDefault();jid=e.pointerId;try{joy.setPointerCapture(jid)}catch(x){}const r=joy.getBoundingClientRect();bx=e.clientX-r.left;by=e.clientY-r.top;kn.style.left=bx+'px';kn.style.top=by+'px';kn.style.display='block';ki.style.transform='';OU.touch.mx=OU.touch.my=0});
  joy.addEventListener('pointermove',e=>{if(e.pointerId!==jid)return;const r=joy.getBoundingClientRect();let dx=e.clientX-r.left-bx,dy=e.clientY-r.top-by;const d=Math.hypot(dx,dy),R=44;if(d>R){dx*=R/d;dy*=R/d}
    ki.style.transform=`translate(${dx}px,${dy}px)`;OU.touch.mx=dx/R;OU.touch.my=dy/R});
  const jup=e=>{if(e.pointerId!==jid)return;jid=null;kn.style.display='none';OU.touch.mx=OU.touch.my=0};
  ['pointerup','pointercancel'].forEach(n=>joy.addEventListener(n,jup));
  box.querySelectorAll('.ob').forEach(b=>{
    b.addEventListener('pointerdown',e=>{e.preventDefault();try{b.setPointerCapture(e.pointerId)}catch(x){}b.classList.add('act');const k=b.dataset.k;
      if(k==='grab')grab();else if(k==='chop')startChop();else if(k==='dash'&&OU.dcd<=0){OU.dash=.22;OU.dcd=.7;SFX.dodge()}});
    const up=()=>{b.classList.remove('act');if(b.dataset.k==='chop')stopChop()};
    ['pointerup','pointercancel','lostpointercapture'].forEach(n=>b.addEventListener(n,up));
  });
}

/* ---------------- loops ---------------- */
function frame(now){
  OU.raf=requestAnimationFrame(frame);
  if($('#ougame').hidden||!W)return;
  const dt=Math.min(.05,(now-OU.lastT)/1000||0);OU.lastT=now;
  moveMe(dt);OU.target=findTarget();chopTick(now);
  if(!OU.auth)tick(dt,false);
  processFx();
  // stream my chef to my partner
  if(now-OU.lastFast>=33&&OU.me){OU.lastFast=now;const m=OU.me,q=v=>Math.round(v*1000)/1000;NET.sendFast({f:1,t:Math.round(now*10)/10,ci:OU.ci,p:[q(m.x),q(m.y),q(m.fx),q(m.fy),m.walk?1:0]})}
  if(G3.ok){render3D(now,dt)}else draw(now);
  hud();lobbyUI();msgUI();promptUI();
  if(W.ph!==OU.prevPh){
    if(W.ph==='count'||(W.ph==='lobby'&&OU.prevPh==='end')){resetMe();$('#over').hidden=true;OU.floats=[]}
    if(W.ph==='lobby')$('#over').hidden=true;
    OU.prevPh=W.ph;
  }
}
// The host's kitchen runs on a timer (not animation frames) so it keeps going in a background tab.
function simLoop(){
  const now=performance.now(),dt=Math.min(1,(now-OU.simT)/1000);OU.simT=now;
  if(!OU.auth||!W)return;
  tick(dt,true);
  const direct=NET.direct(),minGap=direct?30:180,maxGap=direct?250:700;
  if((OU.dirtyAt&&now-OU.lastSnap>=minGap)||now-OU.lastSnap>=maxGap)sendSnap();
}

/* ---------------- networking hooks ---------------- */
function event(d){
  if(phase!=='ouplay')return;
  if(d.e==='os'&&!OU.auth){
    if(+d.n<=OU.lastSn||!d.W)return;OU.lastSn=+d.n;
    const first=!OU.gotSnap;W=d.W;OU.gotSnap=true;
    if(!LV||LV.n!==W.lvl)parseLevel(W.lvl);
    const ci=1-W.hc;if(ci!==OU.ci||first||!OU.me){OU.ci=ci;resetMe()}
    if(first){OU.fxSeen=W.fid;OU.prevPh=W.ph;if(W.ph==='end'){$('#over').hidden=true}}
    clearInterval(OU.hiT);
    return;
  }
  if(!OU.auth)return;
  const gci=1-W.hc;
  if(d.e==='ohi'){if(W.paused){W.paused=false;if(W.ph==='play'||W.ph==='count')W.rcd=3}OU.rbuf=[];OU.off=null;dirty();sendSnap();return}
  if(d.e==='oa'){const at=Array.isArray(d.p)&&d.p.length===2?{x:+d.p[0],y:+d.p[1]}:null;act(gci,d.a,+d.i,+d.v,at)}
}
function fast(d){
  if(phase!=='ouplay'||!Array.isArray(d.p)||+d.ci===OU.ci)return;
  const now=performance.now(),t=+d.t,b=OU.rbuf;
  if(b.length&&t<=b[b.length-1].t)return;
  b.push({t,x:+d.p[0],y:+d.p[1],fx:+d.p[2],fy:+d.p[3],w:+d.p[4]});if(b.length>30)b.shift();
  const s=now-t;OU.off=OU.off==null||s<OU.off?s:OU.off+(s-OU.off)*0.01;
}
function sync(){
  if(phase!=='ouplay')return;
  // promoted to host (the old host left and rejoined): carry on from the last kitchen we saw
  if(HOST&&!OU.auth){OU.auth=true;if(!W)W=makeWorld(0,0);W.hc=OU.ci;W.rdy=[0,0];OU.gotSnap=true;clearInterval(OU.hiT);if(W.ph==='play'||W.ph==='count')W.paused=!opp;dirty()}
  if(!opp){if(!OU.gone){OU.gone=true;stopChop();if(OU.auth){if(W.ph==='play'||W.ph==='count')W.paused=true;W.rdy=[W.rdy[0],0];dirty()}}return}
  if(OU.gone){OU.gone=false;OU.rbuf=[];OU.off=null;if(!OU.auth)hello()}
  if(OU.auth&&W&&W.paused){W.paused=false;if(W.ph==='play'||W.ph==='count')W.rcd=3;dirty()}
  if(!$('#over').hidden&&W&&W.ph==='end')$('#rm').textContent='Next round';
}
function hello(){clearInterval(OU.hiT);NET.ev({e:'ohi'});OU.hiT=setInterval(()=>{if(OU.gotSnap&&!OU.gone){clearInterval(OU.hiT);return}NET.ev({e:'ohi'})},1000)}
function start(mode){
  if(mode!=='online'){err('Order Up! is online co-op only. Share a room code with a friend.');return}
  me.n=($('#nm').value.trim()||'Chef').slice(0,12);
  phase='ouplay';show('ougame');$('#net').hidden=false;
  document.documentElement.classList.add('ouon');document.documentElement.classList.toggle('outouch',TOUCH_UI);
  if(!(window.OU_FLAT||/[?&]flat\b/.test(location.search)))init3D();$('#oucv').hidden=G3.ok;$('#ou3d').hidden=!G3.ok;G3.lvl=-1;
  Object.assign(OU,{auth:HOST,sn:0,lastSn:0,fxSeen:-1,gotSnap:HOST,gone:false,rbuf:[],off:null,floats:[],prevPh:'',chopHeld:false,chopAt:[null,null],dash:0,dcd:0,goAt:0});
  OU.keys={};OU.touch={mx:0,my:0};
  $('#ouorders').innerHTML='';$('#oulobby').dataset.sig='';
  if(HOST){W=makeWorld(0,0);OU.ci=0;OU.fxSeen=0;dirty()}else{W=makeWorld(0,0);OU.ci=1;hello()}
  resetMe();buildPads();
  OU.lastT=OU.simT=performance.now();
  clearInterval(OU.simI);OU.simI=setInterval(simLoop,1000/60);
  if(!OU.raf)OU.raf=requestAnimationFrame(frame);
}
function rematch(){$('#over').hidden=true;doAct('lobby',-1)}
function stop(){document.documentElement.classList.remove('ouon','outouch');cancelAnimationFrame(OU.raf);OU.raf=0;clearInterval(OU.simI);clearInterval(OU.hiT);OU.keys={};OU.chopHeld=false}
$('#ougo').onclick=()=>join('order');
$('#ouquit').onclick=leave;
addEventListener('resize',()=>{if(!$('#ougame').hidden){layout();if(G3.ok)setTimeout(fit3D,50)}});

/* ---------------- music + card art ---------------- */
THEMES.order={bpm:132,sw:.1,vol:.9,key:67,maj:1,prog:prog('C3:maj A2:m7 F2:maj7 G2:dom7'),
  bass:seq('0 . 7 . 12 . 7 . 0 . 7 . 12 . 10 .'),bassT:'triangle',bassV:.32,bassD:1.2,
  stab:seq('. x . x . x . x . x . x . x . x'),stabO:12,stabT:'square',stabV:.025,stabD:.6,stabDl:.08,
  lead:[seq('E5 . G5 . A5 . G5 . E5 . C5 . D5 . . .'),seq('C5 . E5 . G5 . E5 . A5 . G5 . . . . .'),seq('A5 . G5 . F5 . E5 . D5 . C5 . D5 . . .'),seq('G5 . . . B5 . . . D6 . . . . . . .')],leadT:'square',leadV:.05,leadD:1.4,leadDl:.12,
  k:'x...x...x...x...',r:'....x.......x...',h:'x.x.x.x.x.x.x.x.',hV:.03};
ART_GEN.order=(W_,n)=>{
  const cx=W_/2,u='_o'+n,ks=Math.min(1,(W_-16)/250);
  const rays=(x,y,cnt,R,a,b)=>{let o='';for(let i=0;i<cnt;i++){const t0=i/cnt*Math.PI*2,t1=(i+.5)/cnt*Math.PI*2;o+=`<path d="M${x} ${y}L${(x+Math.cos(t0)*R).toFixed(1)} ${(y+Math.sin(t0)*R).toFixed(1)}L${(x+Math.cos(t1)*R).toFixed(1)} ${(y+Math.sin(t1)*R).toFixed(1)}Z" fill="${i%2?b:a}"/>`}return o};
  const chef=(x,y,col,flip,cls)=>`<g transform="translate(${x} ${y}) scale(${flip?-1:1} 1)" class="${cls}">
    <ellipse cx="0" cy="22" rx="22" ry="6" fill="#000" opacity=".25"/>
    <circle r="22" fill="${col}" stroke="${K}" stroke-width="3.5"/><path d="M-14 8A14 11 0 0 0 14 8Z" fill="#fff"/>
    <ellipse cx="2" cy="-5" rx="2.6" ry="4" fill="${K}"/><ellipse cx="12" cy="-5" rx="2.6" ry="4" fill="${K}"/><path d="M3 4Q8 9 13 4" fill="none" stroke="${K}" stroke-width="2.5" stroke-linecap="round"/>
    <rect x="-11" y="-30" width="22" height="9" fill="#fff" stroke="${K}" stroke-width="3"/>
    <g fill="#fff" stroke="${K}" stroke-width="3"><circle cx="-8" cy="-34" r="8"/><circle cx="8" cy="-34" r="8"/><circle cx="0" cy="-39" r="10"/></g>
    <path d="M-16 -31h32" stroke="#fff" stroke-width="5"/></g>`;
  const tom=(x,y,s)=>`<g transform="translate(${x} ${y}) scale(${s})"><circle r="11" fill="#ff4d4d" stroke="${K}" stroke-width="2.5"/><path d="M0 -11l3 -4 1 4 4 -1 -3 3 3 3 -4 -1 -1 4 -2 -4 -4 1 3 -3 -3 -3 4 1z" fill="#2fae4f" stroke="${K}" stroke-width="1.5" transform="translate(0 -2) scale(.7)"/><ellipse cx="-4" cy="-3" rx="3" ry="1.6" fill="#fff" opacity=".6"/></g>`;
  const let_=(x,y,s)=>`<g transform="translate(${x} ${y}) scale(${s})"><circle r="11" fill="#6fd36a" stroke="${K}" stroke-width="2.5"/><path d="M0 8V-7M0 1L-5 -4M0 1L5 -4" stroke="#2f9a3a" stroke-width="2" fill="none"/></g>`;
  return `<svg viewBox="0 0 ${W_} 130" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><defs><pattern id="od${u}" width="9" height="9" patternUnits="userSpaceOnUse"><circle cx="4.5" cy="4.5" r="1.5" fill="#fff" opacity=".22"/></pattern></defs>
  <rect width="${W_}" height="130" fill="#ff5a3d"/>${rays(cx,70,26,W_,'#ff7a4d','#ff5a3d')}<rect width="${W_}" height="130" fill="url(#od${u})"/>
  <rect y="100" width="${W_}" height="30" fill="#d99a5b"/><rect y="100" width="${W_}" height="4" fill="${K}"/><rect y="122" width="${W_}" height="8" fill="#a8693a"/>
  ${Array.from({length:Math.ceil(W_/40)+1},(_,i)=>`<rect x="${i*40}" y="104" width="2" height="18" fill="#a8693a"/>`).join('')}
  <g transform="translate(${cx} 0) scale(${ks}) translate(${-cx} 0)">
   <g class="osteam" fill="none" stroke="#fff" stroke-width="3.5" stroke-linecap="round" opacity=".85"><path d="M${cx-12} 54q6 -8 0 -16q-6 -8 0 -16"/><path d="M${cx+4} 52q6 -8 0 -16q-6 -8 0 -16"/><path d="M${cx+20} 54q6 -8 0 -16q-6 -8 0 -16"/></g>
   <rect x="${cx-40}" y="90" width="80" height="12" rx="3" fill="#4b4f5c" stroke="${K}" stroke-width="3"/>
   <path d="M${cx-34} 58H${cx+34}V86Q${cx+34} 94 ${cx+26} 94H${cx-26}Q${cx-34} 94 ${cx-34} 86Z" fill="#b8c0d0" stroke="${K}" stroke-width="3.5"/>
   <ellipse cx="${cx}" cy="60" rx="34" ry="8" fill="#ff4d4d" stroke="${K}" stroke-width="3.5"/><ellipse cx="${cx-8}" cy="58" rx="9" ry="2.5" fill="#fff" opacity=".5"/>
   <path d="M${cx-34} 62H${cx-46}M${cx+34} 62H${cx+46}" stroke="${K}" stroke-width="5" stroke-linecap="round"/>
   <path d="M${cx-74} 60Q${cx-56} 6 ${cx-14} 34" fill="none" stroke="#fff" stroke-width="2.5" stroke-dasharray="5 5" opacity=".9"/>
   <g class="otoss">${tom(cx-30,38,1.3)}</g>
   ${chef(cx-92,78,'#ff3e8a',false,'och1')}${chef(cx+92,78,'#2d7bff',true,'och2')}
   <g class="olet">${let_(cx+62,34,1.05)}</g>
   <g transform="translate(${cx+112} 30) rotate(8)"><rect x="-14" y="-16" width="28" height="34" rx="3" fill="#fff" stroke="${K}" stroke-width="2.5"/><path d="M-8 -8h16M-8 -1h12M-8 6h16" stroke="${K}" stroke-width="2.5" stroke-linecap="round"/><path d="M-14 14l4 4 4-4 4 4 4-4 4 4 4-4 4 4" fill="#fff" stroke="${K}" stroke-width="2"/></g>
  </g></svg>`;
};

regGame('order',{name:'Order Up!',menu:'oumenu',stage:'ougame',cd:'#cd9',theme:'order',prep:()=>need3D().catch(()=>{}),start,sync,event,fast,rematch,stop,hb:()=>null});
window.OrderUp={OU,G3,LEVELS,RECIPES,get W(){return W},grabRule,act,canChop};
})();
