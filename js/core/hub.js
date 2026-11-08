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

/* ---------- opening a game: the card's picture becomes the menu's banner ----------
   One continuous move. The hub fades back, then a copy of the card picture glides and
   reshapes into the menu's banner (crossfading from the tall card art to the wide shot)
   while the rest of the menu rises in behind it. Going back plays the same move in
   reverse, into the card you came from, at the scroll position you left. */
const decoded=src=>{const im=new Image();im.decoding='async';im.src=src;return (im.decode?im.decode():Promise.resolve()).catch(()=>{})};
const frames=n=>new Promise(r=>{const f=()=>--n<=0?r():requestAnimationFrame(f);requestAnimationFrame(f)});
const EASE=t=>t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2,OUT=t=>1-Math.pow(1-t,4);
const rectOf=el=>{const r=el.getBoundingClientRect();return{x:r.left,y:r.top,w:r.width,h:r.height}};
const onScreen=r=>r&&r.w>0&&r.y+r.h>0&&r.y<innerHeight;
let covered=false,hubScroll=0;
function launch(id,online){G=id;const m=MENU_MAP[id]||'menu';show(m);SFX.sel();if(online){const b=$(ONLINE[id]);if(b)b.click()}}
const heroOf=id=>{const m=$('#'+(MENU_MAP[id]||'menu'));return m&&(m.querySelector('.mhero')||m)};
// the moving picture: tall card art and wide banner art stacked, crossfaded by progress
function morphEl(id,r){const el=document.createElement('div');el.className='xfx';
  el.innerHTML=`<img class="t" src="img/cards/${id}.webp" alt=""><img class="w" src="img/cards/${id}-wide.webp" alt="">`;
  Object.assign(el.style,{left:r.x+'px',top:r.y+'px',width:r.w+'px',height:r.h+'px'});document.body.appendChild(el);return el}
function morph(el,a,b,ra,rb,fa,dur){
  const t=el.querySelector('.t'),w=el.querySelector('.w');
  return new Promise(res=>{const t0=performance.now();const step=now=>{const p=Math.min(1,(now-t0)/dur),e=EASE(p),L=(x,y)=>x+(y-x)*e;
    el.style.left=L(a.x,b.x)+'px';el.style.top=L(a.y,b.y)+'px';el.style.width=L(a.w,b.w)+'px';el.style.height=L(a.h,b.h)+'px';
    el.style.borderRadius=ra.map((v,i)=>L(v,rb[i]).toFixed(1)+'px').join(' ');
    const k=Math.min(1,Math.max(0,(fa?e:1-e)*1.6-.3));w.style.opacity=k;t.style.opacity=1-k;
    if(p<1)requestAnimationFrame(step);else res()};requestAnimationFrame(step)})}
// the menu's content rises in, a few rows at a time
function riseIn(menu,skipHero){const kids=[...menu.children].filter(k=>!(skipHero&&k.classList.contains('mhero'))&&!k.hidden).slice(0,9);
  kids.forEach((k,i)=>k.animate([{opacity:0,transform:'translate3d(0,14px,0)'},{opacity:1,transform:'none'}],{duration:420,delay:60+i*35,easing:'cubic-bezier(.2,.8,.2,1)',fill:'backwards'}))}
function openGame(id,online){
  if(opening||!BY[id])return;
  hubScroll=scrollY;
  if(reduce()){select(id,true);return launch(id,online)}
  opening=true;const card=cardOf(id),art=card&&!card.classList.contains('gone')&&card.querySelector('.gc-art');
  let r0=art?rectOf(art):null;if(!onScreen(r0)){const w=Math.min(220,innerWidth*.45);r0={x:innerWidth/2-w/2,y:innerHeight/2-w*.7,w,h:w*1.4}}
  if(card)freeze(card);untilt(tc);
  const done=()=>{opening=false;covered=false;lastOpened=id;if(card)card.style.visibility=''};
  Promise.all([decoded(`img/cards/${id}-wide.webp`),decoded(`img/cards/${id}.webp`)]).then(async()=>{
    const fx=morphEl(id,r0);if(card)card.style.visibility='hidden';
    fx.animate([{transform:'scale(1)',boxShadow:'0 0 0 rgba(0,0,0,0)'},{transform:'scale(1.03)',boxShadow:'0 30px 60px -20px rgba(0,0,0,.45)'}],{duration:200,easing:'ease-out',fill:'forwards'});
    await $('#hub').animate([{opacity:1,transform:'none'},{opacity:0,transform:'scale(.985)'}],{duration:200,easing:'cubic-bezier(.4,0,1,1)'}).finished;
    // swap screens while the picture is up: the menu is laid out, its banner hidden under the picture
    covered=true;select(id,true);launch(id,online);scrollTo(0,0);
    const menu=$('#'+(MENU_MAP[id]||'menu')),hero=heroOf(id);if(!menu||menu.hidden){fx.remove();return done()}
    hero.style.opacity='0';menu.animate([{opacity:0},{opacity:1}],{duration:300,easing:'ease-out'});riseIn(menu,true);
    const r1=rectOf(hero),rad=parseFloat(getComputedStyle(menu).borderTopLeftRadius)||0;
    fx.getAnimations().forEach(a=>a.cancel());
    await morph(fx,r0,r1,[18,18,18,18],[rad,rad,0,0],true,520);
    hero.style.opacity='';await frames(1);
    await fx.animate([{opacity:1},{opacity:0}],{duration:160,easing:'ease-out'}).finished;fx.remove();done();
  }).catch(e=>{console.error('openGame',e);document.querySelectorAll('.xfx').forEach(x=>x.remove());done()});
}
// back to the hub from a game's menu: the banner shrinks back into its card
function closeToCard(was){
  const id=lastOpened,menu=$('#'+was),hero=menu&&menu.querySelector('.mhero');
  const r1=hero&&rectOf(hero),card=id&&cardOf(id),art=card&&card.querySelector('.gc-art');
  scrollTo(0,hubScroll);
  if(!onScreen(r1)||!art||card.classList.contains('gone')){$('#hub').animate([{opacity:0},{opacity:1}],{duration:320,easing:'ease-out'});return}
  const r0=rectOf(art);if(!onScreen(r0)){$('#hub').animate([{opacity:0},{opacity:1}],{duration:320,easing:'ease-out'});return}
  opening=true;const rad=parseFloat(getComputedStyle(menu).borderTopLeftRadius)||0,fx=morphEl(id,r1);card.style.visibility='hidden';
  fx.querySelector('.t').style.opacity=0;
  $('#hub').animate([{opacity:0},{opacity:1}],{duration:380,delay:80,easing:'ease-out',fill:'backwards'});
  morph(fx,r1,r0,[rad,rad,0,0],[18,18,18,18],false,460).then(()=>{card.style.visibility='';fx.remove();opening=false});
}

/* ---------- every other screen change fades through ----------
   The new screen rises in (opacity + a few px, compositor only). Game stages only fade
   (no transform), so fixed overlays inside them stay put. */
const STAGES=new Set(['game','dgame','rgame','pgame','hgame','qgame']);
const _show=show;
show=function(id){const was=screen;
  if(was=='hub'&&id!='hub'&&!covered)hubScroll=scrollY;
  screen=id;_show(id);if(id!='hub')document.querySelectorAll('.tiltask').forEach(e=>e.remove());
  if(id==was||covered)return;
  if(id=='hub'){if(reduce())scrollTo(0,hubScroll);else if(Object.values(MENU_MAP).includes(was))closeToCard(was);else{scrollTo(0,hubScroll);$('#hub').animate([{opacity:0},{opacity:1}],{duration:320,easing:'ease-out'})}return}
  if(reduce())return;
  const el=$('#'+id);if(!el)return;
  const plug=Object.values(GAMES).find(g=>g.stage===id),stage=STAGES.has(id)||!!plug;
  el.classList.remove('scr-in','scr-fade');void el.offsetWidth;const c=stage?'scr-fade':'scr-in';el.classList.add(c);
  clearTimeout(el._scrT);el._scrT=setTimeout(()=>el.classList.remove(c),560)};

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
