/* The hub: the featured game, the holo trading cards, filters, the profile sheet, phone tilt,
   and the card-swivel animation that opens a game. Loaded last, after every game has registered.
   Card pictures live in img/cards/<id>.webp (tall card) and <id>-wide.webp (featured + menu banner). */
window.HUB=(()=>{
const INFO=[
  {id:'maze',name:'Maze Munch',genre:'Maze Chase',players:'1–4P',dims:'2D',rar:'holo',isNew:true,tags:['duel','coop'],acc:'#f2a516',
   desc:'Race through a brand-new maze every time. Eat the dots, grab the strawberries and watermelons, and stay ahead of the monsters.'},
  {id:'slip',name:'Slipstream',genre:'3D Highway',players:'1–2P',dims:'3D',rar:'holo',tags:['3d','race'],acc:'#e8394a',
   desc:'Weave through endless traffic on a road that is new every run. Near misses fill your nitro. One crash ends it.'},
  {id:'race',name:'Overdrive',genre:'3D Racing',players:'1–2P',dims:'3D',rar:'holo',tags:['3d','race'],acc:'#6c4bff',
   desc:'Lap races on four tracks with five cars. Race the bots, a friend on the same screen, or online.'},
  {id:'deadweight',name:'Deadweight',genre:'3D Co-op Climb',players:'1–2P',dims:'3D',rar:'holo',tags:['3d','coop'],acc:'#e8643c',
   desc:'Two climbers, one rope. Jump, brace and haul each other up a random mountain.'},
  {id:'order',name:'Order Up!',genre:'Co-op Cooking',players:'2P online',dims:'3D',rar:'foil',tags:['3d','coop'],acc:'#e0782a',
   desc:'Chop, cook, plate and serve together before the tickets pile up.'},
  {id:'donut',name:'Glaze Craze',genre:'3D Bakery',players:'1–2P',dims:'3D',rar:'foil',tags:['3d','duel'],acc:'#e84f8c',
   desc:'A 3D bake-off. Decorate the donut to match the order, then let the judge decide.'},
  {id:'board',name:'Board Room',genre:'Strategy',players:'1–2P',dims:'2D',rar:'foil',tags:['duel','brain'],acc:'#1e8a5e',
   desc:'Bid on deals, dodge scandals and bluff your rival out of the boardroom.'},
  {id:'hockey',name:'Air Hockey',genre:'Arcade',players:'1–2P',dims:'2D',rar:'foil',tags:['duel'],acc:'#2f5bea',
   desc:'Fast neon table hockey against the CPU, a friend on one screen, or online.'},
  {id:'brawl',name:'Bam! Brawl',genre:'Fighting',players:'1–2P',dims:'2D',rar:'std',tags:['duel'],acc:'#f04a3a',
   desc:'Both fighters lock in a move at once. Strike, grab, guard, kick, or save up for Mega.'},
  {id:'puzzle',name:'Cipher Sync',genre:'Puzzles',players:'1–2P',dims:'2D',rar:'std',tags:['brain','coop'],acc:'#0f9488',
   desc:'Seven kinds of puzzle lock. Crack the vault alone, or together on one shared board.'},
  {id:'hang',name:'Hang Tight',genre:'Words',players:'1–2P',dims:'2D',rar:'std',tags:['brain','duel'],acc:'#1d8fd8',
   desc:'Hangman with secret words, eight categories and a hint when you need one.'},
  {id:'rps',name:'Rock Paper Scissors',genre:'Quick Duel',players:'1–2P',dims:'2D',rar:'std',tags:['duel'],acc:'#8a4de8',
   desc:'Best of 3, 5 or 7 against a friend, or a CPU that learns your habits.'}
];
const BY={};INFO.forEach(g=>BY[g.id]=g);
const ONLINE={brawl:'#go',donut:'#go2',race:'#rgo',puzzle:'#pgo',hang:'#hgo',rps:'#qgo',board:'#bbgo',hockey:'#ahgo',order:'#ougo',deadweight:'#dwgo',slip:'#ssgo',maze:'#mzgo'};
const FILTERS=[['all','All'],['3d','3D'],['race','Racing'],['duel','Duels'],['coop','Co-op'],['brain','Words & puzzles']];
const SV=(d,w=2.2)=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const IC={users:SV('<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.8c1.9.7 3.1 2.4 3.5 5.2"/>'),
  cube:SV('<path d="M12 2l9 5v10l-9 5-9-5V7z"/><path d="M3 7l9 5 9-5M12 12v10"/>'),sq:SV('<rect x="4" y="4" width="16" height="16" rx="3"/>'),
  globe:SV('<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z"/>'),
  back:SV('<path d="M15 5l-7 7 7 7"/>',2.4)};
const reduce=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
const root=document.documentElement,grid=$('#games');
let sel='',filter='all',opening=false,lastOpened=null,screen='hub',pauseTil=0;

/* ---------- logo: the word writes itself in, letter by letter ---------- */
$('#wmt').innerHTML=[...'CHECKPOINT'].map((c,i)=>`<span style="--i:${i}">${c}</span>`).join('');

/* ---------- cards ---------- */
grid.innerHTML=INFO.map((g,i)=>`<button class="gc r-${g.rar}" type="button" data-g="${g.id}" style="--i:${i};--gacc:${g.acc}" aria-label="${g.name}. ${g.genre}, ${g.players}">
<span class="gc-in"><span class="gc-sh"></span><span class="gc-art"><img src="img/cards/${g.id}.webp" alt="" width="600" height="840" decoding="async"><i class="foil"></i><i class="glare"></i></span>
${g.isNew?'<span class="gc-tag nw">New</span>':''}
<span class="gc-plate"><span class="gc-genre">${g.genre}</span><span class="gc-name">${g.name}</span></span>
<span class="gc-stats"><span>${IC.users}${g.players}</span><span>${g.dims=='3D'?IC.cube:IC.sq}${g.dims}</span></span></span></button>`).join('');
const cardOf=id=>grid.querySelector(`.gc[data-g="${id}"]`);
const visible=()=>INFO.filter(g=>filter=='all'||g.tags.includes(filter));

/* ---------- filters ---------- */
$('#filters').innerHTML=FILTERS.map(([k,l])=>`<button type="button" data-f="${k}" aria-pressed="${k==filter}">${l}</button>`).join('');
$('#filters').onclick=e=>{const b=e.target.closest('button');if(!b)return;filter=b.dataset.f;
  $('#filters').querySelectorAll('button').forEach(x=>x.setAttribute('aria-pressed',x===b));
  let n=0;INFO.forEach(g=>{const c=cardOf(g.id),on=filter=='all'||g.tags.includes(filter);c.classList.toggle('gone',!on);if(on)c.style.setProperty('--i',n++)});
  $('#gcount').textContent=n;replay();dots();if(!visible().some(g=>g.id==sel))select(visible()[0].id);SFX.ui()};
$('#gcount').textContent=INFO.length;
function replay(){grid.classList.remove('enter');void grid.offsetWidth;grid.classList.add('enter');clearTimeout(replay.t);replay.t=setTimeout(()=>grid.classList.remove('enter'),1100)}

/* ---------- featured game ---------- */
function dots(){$('#ftdots').innerHTML=visible().map(g=>`<button type="button" data-g="${g.id}" aria-label="Show ${g.name}" class="${g.id==sel?'on':''}"></button>`).join('')}
$('#ftdots').onclick=e=>{const b=e.target.closest('button');if(b){pauseTil=performance.now()+15000;select(b.dataset.g)}};
function select(id,instant){
  if(!BY[id]||(id==sel&&!instant))return;sel=id;const g=BY[id];
  root.style.setProperty('--acc',g.acc);
  grid.querySelectorAll('.gc').forEach(c=>c.classList.toggle('sel',c.dataset.g==id));
  $('#ftdots').querySelectorAll('button').forEach(b=>b.classList.toggle('on',b.dataset.g==id));
  // backdrop: cross-fade to this game's wide shot once it has loaded
  const bg=$('#ftbg');let im=bg.querySelector(`img[data-g="${id}"]`);
  if(!im){im=new Image();im.alt='';im.decoding='async';im.dataset.g=id;im.src=`img/cards/${id}-wide.webp`;bg.appendChild(im)}
  const on=()=>{if(sel!=id)return;bg.querySelectorAll('img').forEach(x=>x.classList.toggle('on',x===im));
    clearTimeout(on.t);on.t=setTimeout(()=>bg.querySelectorAll('img:not(.on)').forEach(x=>x.remove()),1000)};
  if(im.complete&&im.naturalWidth)requestAnimationFrame(on);else im.onload=on;
  const body=$('#ftbody'),fill=()=>{
    $('#ftg').innerHTML=g.genre;$('#ftnew').hidden=!g.isNew;$('#ftn').textContent=g.name;$('#ftd').textContent=g.desc;
    $('#ftm').innerHTML=`<span class="pill">${IC.users}${g.players}</span><span class="pill">${g.dims=='3D'?IC.cube:IC.sq}${g.dims=='3D'?'3D':'2D'}</span><span class="pill">${IC.globe}Online</span>`;
    $('#ftonline').hidden=false;body.classList.remove('swap')};
  if(instant||reduce())fill();else{body.classList.add('swap');clearTimeout(select.t);select.t=setTimeout(fill,200)}
}
$('#ftplay').onclick=()=>openGame(sel);
$('#ftonline').onclick=()=>openGame(sel,true);
// the featured game changes by itself every few seconds while nobody is pointing at the cards
setInterval(()=>{if(screen!='hub'||document.hidden||opening||tc||!$('#profile').hidden||performance.now()<pauseTil)return;
  const v=visible(),i=v.findIndex(g=>g.id==sel);select(v[(i+1)%v.length].id)},7000);
$('#feat').addEventListener('pointerenter',()=>pauseTil=performance.now()+20000);

/* ---------- tilt: mouse hover, finger drag, or the phone itself ----------
   Each card follows the pointer on a spring. One rAF loop writes plain transforms
   (no CSS variables, no transitions), and it stops when every card has settled. */
const FOIL={holo:.95,foil:.75,std:.45};
const ST=new Map();
function st(card){let o=ST.get(card);if(!o){o={card,inn:card.querySelector('.gc-in'),img:card.querySelector('.gc-art img'),foil:card.querySelector('.foil'),glare:card.querySelector('.glare'),sh:card.querySelector('.gc-sh'),
  fo:FOIL[(BY[card.dataset.g]||{}).rar]||.5,x:0,y:0,h:0,tx:0,ty:0,th:0};ST.set(card,o)}return o}
let raf=0,lastT=0;
function kick(){if(!raf){lastT=performance.now();raf=requestAnimationFrame(step)}}
function step(t){raf=0;const dt=Math.min(48,t-lastT);lastT=t;
  const kp=1-Math.exp(-dt/60),kh=1-Math.exp(-dt/(90));let busy=false;
  ST.forEach(o=>{o.x+=(o.tx-o.x)*kp;o.y+=(o.ty-o.y)*kp;o.h+=(o.th-o.h)*kh;
    const settled=Math.abs(o.tx-o.x)<.0015&&Math.abs(o.ty-o.y)<.0015&&Math.abs(o.th-o.h)<.003;
    if(settled){o.x=o.tx;o.y=o.ty;o.h=o.th}
    if(settled&&!o.th&&!o.tx&&!o.ty){if(o.live){o.live=false;o.inn.style.transform=o.img.style.transform=o.foil.style.transform=o.glare.style.transform='';o.foil.style.opacity=o.glare.style.opacity=o.sh.style.opacity='';o.card.style.zIndex=''}return}
    o.live=true;if(!settled)busy=true;
    const x=o.x,y=o.y,h=o.h;
    o.inn.style.transform=`perspective(900px) translate3d(0,${(-8*h).toFixed(2)}px,0) rotateX(${(-y*18).toFixed(2)}deg) rotateY(${(x*22).toFixed(2)}deg) scale(${(1+.035*h).toFixed(4)})`;
    o.img.style.transform=`translate3d(${(-x*14).toFixed(2)}px,${(-y*14).toFixed(2)}px,0) scale(${(1+.04*h).toFixed(4)})`;
    o.foil.style.transform=`translate3d(${(-x*46).toFixed(2)}%,${(-y*30).toFixed(2)}%,0)`;
    o.glare.style.transform=`translate3d(${(x*66).toFixed(2)}%,${(y*66).toFixed(2)}%,0)`;
    o.foil.style.opacity=(o.fo*Math.min(1,h*1.15)).toFixed(3);o.glare.style.opacity=(.9*h).toFixed(3);o.sh.style.opacity=h.toFixed(3);
    o.card.style.zIndex=h>.02?2:''});
  if(busy)raf=requestAnimationFrame(step)}
function tilt(card,nx,ny,h=1){const o=st(card);o.tx=nx;o.ty=ny;o.th=h;kick()}
function untilt(card){if(!card)return;const o=st(card);o.tx=o.ty=o.th=0;kick()}
function freeze(card){const o=ST.get(card);if(!o)return;o.x=o.y=o.h=o.tx=o.ty=o.th=0;o.live=false;o.inn.style.transform=o.img.style.transform=o.foil.style.transform=o.glare.style.transform='';o.foil.style.opacity=o.glare.style.opacity=o.sh.style.opacity='';o.card.style.zIndex=''}
let tc=null,tr=null;
grid.addEventListener('pointermove',e=>{
  if(e.pointerType=='touch'&&!e.buttons&&!e.pressure)return;
  const c=e.target.closest('.gc');if(c!==tc){untilt(tc);tc=c;tr=c&&c.getBoundingClientRect()}if(!c||opening)return;
  if(e.pointerType!='touch')pauseTil=performance.now()+12000;
  tilt(c,Math.min(.5,Math.max(-.5,(e.clientX-tr.left)/tr.width-.5)),Math.min(.5,Math.max(-.5,(e.clientY-tr.top)/tr.height-.5)))},{passive:true});
const off=()=>{untilt(tc);tc=null};
addEventListener('scroll',()=>{if(tc)tr=tc.getBoundingClientRect()},{passive:true});
grid.addEventListener('pointerleave',off);grid.addEventListener('pointerup',e=>{if(e.pointerType=='touch')off()});grid.addEventListener('pointercancel',off);
grid.addEventListener('focusin',e=>{const c=e.target.closest('.gc');if(c&&e.target.matches(':focus-visible'))select(c.dataset.g)});
grid.addEventListener('click',e=>{const c=e.target.closest('.gc');if(c)openGame(c.dataset.g)});

// phones: tilt every card with the phone (iPhone asks once, Android just works)
let mot=false,b0=null;
function motion(e){if(e.beta==null||screen!='hub'||opening)return;if(b0==null)b0=e.beta;b0+=(e.beta-b0)*.006;
  const nx=Math.max(-.5,Math.min(.5,(e.gamma||0)/40)),ny=Math.max(-.5,Math.min(.5,(e.beta-b0)/40));
  grid.querySelectorAll('.gc:not(.gone)').forEach(c=>{if(c!==tc)tilt(c,nx*.8,ny*.8,.35)})}
function motionOn(){if(mot)return;mot=true;addEventListener('deviceorientation',motion)}
const store=(k,v)=>{try{if(v===undefined)return localStorage[k];localStorage[k]=v}catch(e){}};
if(typeof TOUCH_UI!='undefined'&&TOUCH_UI&&window.DeviceOrientationEvent&&!reduce()){
  const ask=DeviceOrientationEvent.requestPermission;
  if(typeof ask!='function')motionOn();
  else if(store('cpTilt')=='yes')addEventListener('touchend',()=>ask.call(DeviceOrientationEvent).then(r=>{if(r=='granted')motionOn()}).catch(()=>{}),{once:true});
  else if(store('cpTilt')!='no')setTimeout(()=>{if(screen!='hub')return;
    const p=document.createElement('div');p.className='tiltask';p.setAttribute('role','dialog');p.setAttribute('aria-label','Card tilt');
    p.innerHTML='<p>Make the cards shine when you tilt your phone?</p><button class="y" type="button">Turn on</button><button class="n" type="button">Not now</button>';document.body.appendChild(p);
    p.querySelector('.y').onclick=()=>{ask.call(DeviceOrientationEvent).then(r=>{if(r=='granted'){store('cpTilt','yes');motionOn()}}).catch(()=>{});p.remove()};
    p.querySelector('.n').onclick=()=>{store('cpTilt','no');p.remove()}},1800);
}

/* ---------- opening a game ----------
   The card lifts and swivels to its back, the back grows to fill the screen, the game's menu
   is swapped in underneath while the screen is covered, then the cover fades away.
   Everything moving is a compositor transform/opacity, and the heavy screen swap only
   happens while nothing is moving, so it never stutters. */
const MARK=$('#home-logo .mark').outerHTML;
const decoded=src=>{const im=new Image();im.decoding='async';im.src=src;return (im.decode?im.decode():Promise.resolve()).catch(()=>{})};
const frames=n=>new Promise(r=>{const f=()=>--n<=0?r():requestAnimationFrame(f);requestAnimationFrame(f)});
let covered=false;
function launch(id,online){G=id;const m=MENU_MAP[id]||'menu';show(m);SFX.sel();if(online){const b=$(ONLINE[id]);if(b)b.click()}}
function openGame(id,online){
  if(opening||!BY[id])return;
  if(reduce()){select(id,true);return launch(id,online)}
  opening=true;const card=cardOf(id),vw=innerWidth,vh=innerHeight;
  let r=card&&!card.classList.contains('gone')?card.getBoundingClientRect():null;
  if(!r||r.bottom<40||r.top>vh-40){const w=Math.min(230,vw*.5),h=w*(card?card.offsetHeight/card.offsetWidth:1.6);r={left:vw/2-w/2,top:vh/2-h/2,width:w,height:h}}
  const g=BY[id],wide=`img/cards/${id}-wide.webp`,ready=decoded(wide);
  const fx=document.createElement('div'),dim=document.createElement('div');
  fx.className='flipfx';dim.className='flipdim';
  Object.assign(fx.style,{left:r.left+'px',top:r.top+'px',width:r.width+'px',height:r.height+'px'});
  fx.innerHTML=`<div class="flipfx-in"><div class="face front"></div><div class="face back" style="--gacc:${g.acc}"><img src="${wide}" alt=""><div class="bk">${MARK}<b>${g.name}</b></div></div></div>`;
  if(card)freeze(card);
  const front=(card?card.querySelector('.gc-in'):grid.querySelector('.gc-in')).cloneNode(true);fx.querySelector('.front').appendChild(front);
  document.body.append(dim,fx);if(card)card.style.visibility='hidden';
  const inner=fx.firstChild,dx=vw/2-(r.left+r.width/2),dy=vh/2-(r.top+r.height/2),s1=Math.min(1.7,vh*.6/r.height,vw*.76/r.width),
    sC=Math.max(vw/r.width,vh/r.height)*1.25,T=(x,y,s,ry)=>`translate3d(${x}px,${y}px,0) scale(${s}) rotateY(${ry}deg)`;
  dim.animate([{opacity:0},{opacity:.6}],{duration:520,easing:'ease-out',fill:'forwards'});
  const a1=inner.animate([{transform:T(0,0,1,0)},{transform:T(dx*.5,dy*.5-24,(1+s1)/2*1.05,90),offset:.5},{transform:T(dx,dy,s1,180)}],
    {duration:680,easing:'cubic-bezier(.55,.05,.25,1)',fill:'forwards'});
  const done=()=>{covered=false;fx.remove();dim.remove();if(card)card.style.visibility='';opening=false;lastOpened=id};
  a1.finished.then(()=>{
    // grow the back of the card until it covers everything
    dim.animate([{opacity:.6},{opacity:1}],{duration:380,easing:'ease-in',fill:'forwards'});
    const bk=fx.querySelector('.bk');if(bk)bk.animate([{opacity:1},{opacity:0}],{duration:220,easing:'ease-in',fill:'forwards'});
    return inner.animate([{transform:T(dx,dy,s1,180)},{transform:T(dx,dy,sC,180)}],{duration:420,easing:'cubic-bezier(.6,0,.75,.35)',fill:'forwards'}).finished})
  .then(()=>ready).then(()=>{
    // screen is covered: swap in the menu now, let it lay out and paint, then reveal it
    covered=true;select(id,true);launch(id,online);covered=false;return frames(2)})
  .then(()=>{const m=$('#'+(MENU_MAP[id]||'menu'));if(m&&!m.hidden)m.animate([{opacity:0,transform:'scale(1.035)'},{opacity:1,transform:'none'}],{duration:520,easing:'cubic-bezier(.2,.9,.2,1)'});
    dim.animate([{opacity:1},{opacity:0}],{duration:460,easing:'ease-out',fill:'forwards'});
    return fx.animate([{opacity:1},{opacity:0}],{duration:360,easing:'ease-out',fill:'forwards'}).finished})
  .then(done,e=>{console.error('openGame',e);done()});
}

/* ---------- every other screen change fades through ----------
   The old screen goes at once, the new one rises in (opacity + a few px, compositor only).
   Game stages only fade (no transform), so fixed overlays inside them stay put. */
const STAGES=new Set(['game','dgame','rgame','pgame','hgame','qgame']);
const _show=show;
show=function(id){const was=screen;screen=id;_show(id);if(id!='hub')document.querySelectorAll('.tiltask').forEach(e=>e.remove());
  if(id==was||covered||reduce())return;
  const el=$('#'+id);if(!el)return;
  const plug=Object.values(GAMES).find(g=>g.stage===id),stage=STAGES.has(id)||!!plug;
  el.classList.remove('scr-in','scr-fade');void el.offsetWidth;const c=stage?'scr-fade':'scr-in';el.classList.add(c);
  clearTimeout(el._scrT);el._scrT=setTimeout(()=>el.classList.remove(c),520);
  if(id=='hub'&&was!='hub'){replay();const c2=lastOpened&&cardOf(lastOpened);if(c2){c2.classList.add('flipback');setTimeout(()=>c2.classList.remove('flipback'),850)}}};

/* ---------- menus: the game's 3D shot as the banner, and a quick way back ---------- */
document.querySelectorAll('.gmenu .mart[data-art]').forEach(el=>{const id=el.dataset.art;if(!BY[id])return;
  el.removeAttribute('data-art');el.className='mart';el.innerHTML=`<img src="img/cards/${id}-wide.webp" alt="" decoding="async">`;
  const hero=el.parentElement,menu=el.closest('.gmenu'),back=menu&&menu.querySelector('[data-back]');
  const pill=document.createElement('span');pill.className='pill mgenre';pill.textContent=BY[id].genre+' · '+BY[id].players;hero.appendChild(pill);
  if(back){const b=document.createElement('button');b.type='button';b.className='mback';b.innerHTML=IC.back+'All games';b.onclick=()=>back.click();hero.appendChild(b)}});

/* ---------- profile ---------- */
function syncChip(){$('#pchav').innerHTML=hero(me.ch,'idle','46 -6 108 118');$('#pchn').textContent=($('#nm').value.trim()||'Hero').slice(0,12)}
const prof=$('#profile');
function openProf(){prof.hidden=false;setTimeout(()=>$('#nm').focus(),60)}
function closeProf(){if(prof.hidden)return;$('#nm').blur();prof.hidden=true;syncChip();$('#pchip').focus()}
$('#pchip').onclick=()=>{openProf();SFX.ui()};$('#pclose').onclick=closeProf;$('#pdone').onclick=()=>{closeProf();SFX.sel()};
prof.addEventListener('click',e=>{if(e.target===prof)closeProf()});
addEventListener('keydown',e=>{if(e.key=='Escape')closeProf()});
$('#nm').addEventListener('keydown',e=>{if(e.key=='Enter')closeProf()});

syncChip();dots();select('maze',true);
return{syncChip,select,openGame,INFO};
})();
