/* =========================================================================
   BOARD ROOM — the bluffing auction.
   Each round a lot hits the boardroom table: a juicy DEAL (+$) or a SCANDAL (−$).
   Both bosses secretly bid one budget card (1–15, each card used once).
   Deal: highest bid wins it. Scandal: lowest bid gets stuck with it.
   Same bid: nobody takes it, the lot rolls into the pot for the next round.
   Most money after the last lot runs the company.
   Modes: vs CPU (3 levels), two players on one device (pass-and-play), online.
   ========================================================================= */
(()=>{
/* ---------- the lots ---------- */
const LOTS={1:['Office plant survives','🪴'],2:['Free bagel Friday','🥯'],3:['Meme ad goes viral','📈'],4:['Shiny new logo','✨'],5:['Celebrity endorsement','🕶️'],
  6:['Patent approved','📜'],7:['Hostile takeover','🦈'],8:['Robot workforce','🤖'],9:['Moon-base merger','🚀'],10:['Monopoly achieved','👑'],
  '-1':['Reply-all disaster','📧'],'-2':['Printer on fire','🔥'],'-3':['Group chat leaked','💬'],'-4':['Company yacht sank','🛥️'],'-5':['Surprise tax audit','🧾']};
const SIZES={15:{deals:10,scan:5},10:{deals:7,scan:3}};
const lotsFor=len=>{const c=SIZES[len],d=[];for(let v=1;v<=c.deals;v++)d.push(v);for(let v=1;v<=c.scan;v++)d.push(-v);return d};
function deckFor(len,seed){const d=lotsFor(len),r=rng(seed);for(let i=d.length-1;i>0;i--){const j=r()*(i+1)|0;[d[i],d[j]]=[d[j],d[i]]}return d}
const hash=s=>{let h=2166136261;for(const ch of String(s)){h^=ch.charCodeAt(0);h=Math.imul(h,16777619)}return h|0};
const handOf=(len,used)=>{const u=new Set(used),h=[];for(let i=1;i<=len;i++)if(!u.has(i))h.push(i);return h};
const sum=a=>a.reduce((x,y)=>x+y,0);

/* ---------- rules: the whole game is a pure function of the deck and both bid lists ---------- */
function sim(deck,A,B){
  const n=Math.min(A.length,B.length,deck.length),sc=[0,0],log=[];let pot=[];
  for(let r=0;r<n;r++){
    const lot=deck[r];pot.push(lot);const a=A[r],b=B[r],total=sum(pot);
    let w=-1;if(a!==b)w=lot>0?(a>b?0:1):(a<b?0:1);
    log.push({r,lot,a,b,w,pot:pot.slice(),total});
    if(w>=0){sc[w]+=total;pot=[]}
  }
  return{sc,log,pot,r:n,done:n===deck.length};
}

/* ---------- CPU ---------- */
// a quick "gut feeling" bid: how much is this pot worth to me, and can I win it for sure?
function heur(H,O,total,sign,maxV,noise,R){
  const n=H.length;if(n===1)return H[0];
  const wantHigh=(sign>0&&total>0)||(sign<0&&total<0);
  if(!wantHigh)return H[R()<noise*.5&&n>1?1:0];          // happy to lose it: dump the cheapest card
  const imp=Math.min(1,Math.abs(total)/maxV),oMax=O.length?O[O.length-1]:0,oMin=O.length?O[0]:0;
  let q=Math.max(0,Math.min(1,imp*.9+(R()-.5)*noise));
  let c=H[Math.round(q*(n-1))];
  const sure=H.find(x=>x>oMax);if(sure!==undefined&&(c>=sure||imp>.55))c=sure;   // cheapest card that can't lose
  if(sign>0&&c<oMin&&imp<.5)c=H[0];                       // can't win a small deal cheaply: save the money
  return c;
}
function cpuBid(st,lvl,R=Math.random){
  // st: {len, seen (lots revealed so far incl. current), pot (carried lots), lot, H (cpu hand), O (rival hand), sc:[cpu,rival]}
  const {H,O,lot,pot}=st,total=sum(pot)+lot,sign=Math.sign(lot),maxV=SIZES[st.len].deals;
  if(lvl===0){if(R()<.35)return H[R()*H.length|0];return heur(H,O,total,sign,maxV,.9,R)}
  if(lvl===1)return heur(H,O,total,sign,maxV,.35,R);
  // CEO: play the rest of the game out many times for every card, keep the best on average.
  // It never peeks: the order of the lots still to come is shuffled for each try.
  const left=lotsFor(st.len);for(const v of st.seen){const k=left.indexOf(v);if(k>=0)left.splice(k,1)}
  const N=Math.max(60,Math.round(2400/H.length)),score=new Map();
  for(const first of H){let tot=0;
    for(let it=0;it<N;it++){
      const fut=left.slice();for(let i=fut.length-1;i>0;i--){const j=R()*(i+1)|0;[fut[i],fut[j]]=[fut[j],fut[i]]}
      let h=H.slice(),o=O.slice(),p=pot.slice(),s0=st.sc[0],s1=st.sc[1],l=lot,k=-1;
      while(true){
        p.push(l);const t=sum(p),sg=Math.sign(l);
        const a=k<0?first:heur(h,o,t,sg,maxV,.4,R),b=heur(o,h,t,sg,maxV,.55,R);
        h.splice(h.indexOf(a),1);o.splice(o.indexOf(b),1);
        if(a!==b){const w=l>0?(a>b?0:1):(a<b?0:1);if(w===0)s0+=t;else s1+=t;p=[]}
        if(++k>=fut.length||!h.length)break;l=fut[k];
      }
      const d=s0-s1;tot+=(d>0?1:d<0?-1:0)+d*.03;
    }
    score.set(first,tot/N);
  }
  const best=Math.max(...score.values()),pool=H.filter(c=>score.get(c)>=best-.04);
  return pool[R()*pool.length|0];
}

/* ---------- state ---------- */
const BB={mode:'cpu',len:15,lvl:1,names:['',''],deck:[],mine:[],theirs:[],shown:0,sel:null,tok:0,anim:false,dead:true,
  wins:[0,0],game:0,ended:false,waiting:false,turn:0,cpuT:0,cpuPending:null,mood:['',''],seed:0};
const ME_COL='#ff3e8a',OP_COL='#2d7bff';
const state=()=>sim(BB.deck,BB.mine,BB.theirs);
const bidsOf=s=>s===0?BB.mine:BB.theirs;

/* ---------- pictures ---------- */
function avatar(col,mood){
  const m=mood==='happy'?'<path d="M30 52q10 10 20 0" fill="#14111f"/><path d="M33 53q7 4 14 0" fill="#ff7a9a"/>'
    :mood==='sad'?'<path d="M31 57q9-8 18 0" fill="none" stroke="#14111f" stroke-width="3.5" stroke-linecap="round"/><path d="M58 30q4 6 0 9q-4-3 0-9z" fill="#7fd4ff" stroke="#14111f" stroke-width="1.5"/>'
    :mood==='think'?'<path d="M32 54h15" stroke="#14111f" stroke-width="3.5" stroke-linecap="round"/>'
    :'<path d="M31 51q9 7 18 0" fill="none" stroke="#14111f" stroke-width="3.5" stroke-linecap="round"/>';
  const brow=mood==='sad'?'<path d="M24 30l9 3M56 30l-9 3" stroke="#14111f" stroke-width="3" stroke-linecap="round"/>':mood==='think'?'<path d="M24 31l9-2M47 28l9 3" stroke="#14111f" stroke-width="3" stroke-linecap="round"/>':'';
  return `<svg viewBox="0 0 80 92" aria-hidden="true">
   <path d="M6 92q2-24 34-26q32 2 34 26z" fill="#2b2147" stroke="#14111f" stroke-width="3"/>
   <path d="M30 66l10 12l10-12z" fill="#fff" stroke="#14111f" stroke-width="2.5" stroke-linejoin="round"/>
   <path d="M37 72h6l3 18h-12z" fill="#ffe14d" stroke="#14111f" stroke-width="2.5" stroke-linejoin="round"/>
   <circle cx="40" cy="38" r="28" fill="${col}" stroke="#14111f" stroke-width="3.5"/>
   <ellipse cx="30" cy="24" rx="9" ry="5" fill="#fff" opacity=".55" transform="rotate(-25 30 24)"/>
   <ellipse cx="31" cy="38" rx="5" ry="6.5" fill="#fff" stroke="#14111f" stroke-width="2"/><ellipse cx="49" cy="38" rx="5" ry="6.5" fill="#fff" stroke="#14111f" stroke-width="2"/>
   <circle cx="32" cy="39" r="3" fill="#14111f"/><circle cx="50" cy="39" r="3" fill="#14111f"/>
   <circle cx="22" cy="48" r="4" fill="#fff" opacity=".35"/><circle cx="58" cy="48" r="4" fill="#fff" opacity=".35"/>${brow}${m}</svg>`;
}
const money=v=>(v<0?'−':'')+'$'+Math.abs(v)+'M';
/* trading-card faces. Rarity follows the size of the deal or scandal: ● common, ◆ uncommon, ★ rare (holo foil + light burst). */
const rarity=v=>{const a=Math.abs(v);return v>0?(a>=8?3:a>=5?2:1):(a>=4?3:a>=2?2:1)};
const RSYM=['','●','◆','★'];
const FLAVOR={1:'It lived. Against all odds.',2:'Morale up 300%.',3:'Nobody knows why it worked.',4:'Now 40% more swoosh.',5:'Sunglasses indoors, always.',6:'Legally unique. Finally.',7:'Eat or be eaten.',8:'They never take coffee breaks.',9:'One small step for profit.',10:'All your market are belong to us.',
  '-1':'"Please remove me from this list."','-2':'It was already on fire when I got here.','-3':'Who added the intern?','-4':'Technically still floating. Upside down.','-5':'Every receipt. Every single one.'};
const foil='<div class="holo"></div><div class="glare"></div>';
function lotFace(v){const [name,ico]=LOTS[v],deal=v>0,r=rarity(v),n=SIZES[BB.len]||SIZES[15];
  return `<div class="bbf bbfront lotc ${deal?'deal':'scan'} r${r}"><div class="lc-in">
   <div class="lc-head"><span class="lc-name">${name}</span><span class="lc-hp">${deal?'+':'−'}$${Math.abs(v)}M</span></div>
   <div class="lc-art"><i class="lc-rays"></i><span class="lc-ico">${ico}</span></div>
   <div class="lc-type"><b>${deal?'DEAL':'SCANDAL'}</b>${deal?'Highest bid wins':'Lowest bid takes it'}</div>
   <div class="lc-flav">${FLAVOR[v]||''}</div>
   <div class="lc-foot"><span>${RSYM[r]} ${['','Common','Uncommon','Rare'][r]}</span><span>${deal?v+'/'+n.deals:'S'+(-v)+'/'+n.scan}</span></div>
  </div>${foil}</div>`}
const backFace=(cls='',extra='')=>`<div class="bbf bbback ${cls}" ${extra}><div class="cb-in"><i class="cb-ring"></i><span>${cls==='bid'?'$':'BR'}</span></div></div>`;
const lotBack=backFace();
const bidCard=(c,col)=>`<div class="bbf bbfront bid${c>=13?' rare':''}" style="--pc:${col}"><div class="bc-in"><span class="bc-c tl">${c}</span><b>${c}</b><span class="bc-coin">$</span><span class="bc-c br">${c}</span></div>${foil}</div>`;
const bidBack=col=>backFace('bid',`style="--pc:${col}"`);

/* ---------- screens ---------- */
mountScreens(`
<section id="bbmenu" class="card gmenu" hidden>
<div class="mhero"><div class="mart" data-art="board"></div><h2 class="mh">Board Room</h2></div>
<div class="row rsets">
  <label>CPU boss<select id="bbdiff"><option value="0">Intern · plays by gut</option><option value="1" selected>Manager · sharp</option><option value="2">The CEO · ruthless</option></select></label>
  <label>Meeting length<select id="bblen"><option value="10">Quick · 10 lots</option><option value="15" selected>Full · 15 lots</option></select></label>
  <label>Player 2 name (same device)<input id="bbp2" maxlength="12" placeholder="Player 2" autocomplete="off"></label>
  <label>Online room code<input id="cd7" maxlength="6" autocomplete="off"></label>
</div>
<div class="row"><button class="btn b" id="bbsolo">Solo vs CPU</button><button class="btn o" id="bblocal">2 Players · pass the phone</button><button class="btn" id="bbgo">Online with a friend</button></div>
<p class="note" data-msg></p>
<ul class="rules">
 <li>Every round a lot hits the table: a juicy <b class="bbg">DEAL</b> worth money, or a <b class="bbr">SCANDAL</b> that costs you.</li>
 <li>You both <b>secretly bid</b> one budget card. Every card can be spent only once, so plan your money!</li>
 <li><b>Deal:</b> the highest bid wins it. <b>Scandal:</b> the lowest bid gets stuck with it.</li>
 <li><b>Same bid?</b> Nobody gets it. The lot stays in the pot, and whoever wins the next round takes the whole pot.</li>
 <li>Most money after the last lot runs the company. Tip: watch your rival's cards. A card higher than all of theirs can't lose.</li>
 <li>Online uses the host's meeting length.</li>
</ul>
<button class="btn m back" data-back>← All games</button></section>
<section id="bbgame" hidden>
<div id="bbroom">
  <div class="bbsky"><svg viewBox="0 0 400 120" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
   <g fill="#2b1f5c"><rect x="0" y="62" width="34" height="58"/><rect x="38" y="40" width="26" height="80"/><rect x="68" y="70" width="40" height="50"/><rect x="112" y="28" width="22" height="92"/><rect x="138" y="55" width="36" height="65"/>
   <rect x="226" y="48" width="30" height="72"/><rect x="260" y="20" width="24" height="100"/><rect x="288" y="66" width="38" height="54"/><rect x="330" y="38" width="28" height="82"/><rect x="362" y="58" width="38" height="62"/><path d="M178 120V44l22-16 22 16v76z"/></g>
   <g fill="#ffe14d" class="bbwin"><rect x="44" y="50" width="4" height="5"/><rect x="54" y="62" width="4" height="5"/><rect x="117" y="40" width="4" height="5"/><rect x="124" y="58" width="4" height="5"/><rect x="266" y="32" width="4" height="5"/><rect x="274" y="50" width="4" height="5"/><rect x="336" y="50" width="4" height="5"/><rect x="346" y="66" width="4" height="5"/><rect x="196" y="50" width="8" height="8" rx="4"/><rect x="144" y="66" width="4" height="5"/><rect x="232" y="60" width="4" height="5"/><rect x="296" y="76" width="4" height="5"/><rect x="12" y="74" width="4" height="5"/><rect x="372" y="70" width="4" height="5"/></g></svg>
   <div class="bbframe"></div></div>
  <div class="bbtable"></div>
  <div class="bbtop">
    <div class="bbwho"><div class="bbseat" id="bbav1"></div><div class="bbp" id="bbp1"><b id="bbn1"></b><span class="bbcash" id="bbs1">$0M</span></div></div>
    <div class="bbofan" id="bbofan" aria-hidden="true"></div>
    <div class="bbinfo"><span id="bbrnd">LOT 1/15</span><span id="bbrec">0 – 0</span></div>
  </div>
  <div class="bbmat" id="bbmat">
    <div class="bbdeck" id="bbdeck" aria-hidden="true"><i></i><i></i><i></i><b id="bbleft">15</b></div>
    <div class="bbrowx" id="bbrowx">
      <div class="bbslot" id="bbslot0"><div class="bbflip"></div><span class="bbtag" id="bbtag0"></span></div>
      <div class="bblotw" id="bblotw"><div class="bbburst" id="bbburst"></div><div class="bbpot" id="bbpot"></div><div class="bblot bbflip" id="bblot"></div></div>
      <div class="bbslot" id="bbslot1"><div class="bbflip"></div><span class="bbtag" id="bbtag1"></span></div>
    </div>
    <div class="bbgavel" id="bbgavel"><svg viewBox="0 0 80 80" aria-hidden="true"><g transform="rotate(-35 40 40)"><rect x="37" y="30" width="7" height="46" rx="3" fill="#8a4b22" stroke="#14111f" stroke-width="3"/>
      <rect x="18" y="12" width="44" height="22" rx="7" fill="#b8682e" stroke="#14111f" stroke-width="3.5"/><rect x="16" y="14" width="7" height="18" rx="3" fill="#ffe14d" stroke="#14111f" stroke-width="2.5"/><rect x="57" y="14" width="7" height="18" rx="3" fill="#ffe14d" stroke="#14111f" stroke-width="2.5"/></g></svg></div>
    <div class="bbstamp" id="bbstamp"></div>
  </div>
  <div class="bbme">
    <div class="bbwho l"><div class="bbseat" id="bbav0"></div><div class="bbp" id="bbp0"><b id="bbn0"></b><span class="bbcash" id="bbs0">$0M</span></div></div>
    <div class="bbdesk">
      <div class="bbstrip"><span id="bbol">Rival's cards</span><div id="bbochips"></div></div>
      <p id="bbcap"></p>
      <div id="bbhand"></div>
      <div class="bbact"><button class="btn" id="bblock" disabled>Pick a card</button></div>
    </div>
  </div>
  <button class="bbx" id="bbquit" aria-label="Exit to hub">✕ Exit</button>
  <div class="bbpass" id="bbpass" hidden><b id="bbpt"></b><span id="bbps"></span><button class="btn o" id="bbpgo">Show my cards</button></div>
  <div id="bbfx" aria-hidden="true"></div>
</div>
</section>`);
$('#bbmenu [data-back]').onclick=()=>{show('hub');SFX.back()};
$('#bbroom').addEventListener('scroll',e=>{e.currentTarget.scrollTop=0;e.currentTarget.scrollLeft=0});   // the table never scrolls (focus or a fanned card poking out could nudge it)

/* ---------- sounds ---------- */
SFX.gavel=t=>{kick(t,1,SG,130);nz(t,.07,1700,.55,SG,'bandpass',3);tone(52,t,.1,'square',.05,SG,{lp:700})};
SFX.flip=t=>{nz(t,.07,2600,.28,SG,'bandpass',2,6000)};
SFX.cash=t=>{[83,88,91,96].forEach((m,i)=>tone(m,t+i*.055,.14,'square',.045,SG,{lp:5000}));nz(t+.2,.15,6000,.12,SG)};
SFX.boo=t=>{tone(55,t,.45,'sawtooth',.07,SG,{to:44,lp:900});tone(51,t+.05,.45,'sawtooth',.05,SG,{to:40,lp:900})};
SFX.lockin=t=>{tone(67,t,.05,'square',.07,SG,{lp:2200});nz(t,.03,4000,.25,SG,'bandpass',5);tone(79,t+.05,.08,'triangle',.08,SG)};

/* ---------- card-game effects: flying cards, coins, sparks, confetti, 3D tilt + foil ---------- */
const canAnim=()=>!!Element.prototype.animate&&!(window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches);
const roomBox=()=>$('#bbroom').getBoundingClientRect();
function rel(el){const r=el.getBoundingClientRect(),b=roomBox();return{x:r.left-b.left,y:r.top-b.top,w:r.width,h:r.height,cx:r.left-b.left+r.width/2,cy:r.top-b.top+r.height/2}}
/* a card that flies across the table (from → to), flipping on the way if y0 ≠ y1 */
function flyCard(inner,from,to,o={}){
  if(!canAnim()||!from.w||!to.w)return Promise.resolve();
  const d=document.createElement('div');d.className='bbflyer';d.innerHTML=inner;Object.assign(d.style,{left:to.x+'px',top:to.y+'px',width:to.w+'px',height:to.h+'px'});$('#bbfx').append(d);
  const sx=from.w/to.w,dx=from.cx-to.cx,dy=from.cy-to.cy,y0=o.y0||0,y1=o.y1||0,r0=o.r0||0,P='perspective(900px) ';
  const a=d.animate([{transform:P+`translate(${dx}px,${dy}px) scale(${sx}) rotate(${r0}deg) rotateY(${y0}deg)`},
    {transform:P+`translate(${dx*.45}px,${dy*.45+(o.lift??-70)}px) scale(${(sx+1)/2*1.15}) rotate(${r0/2+(o.spin||-8)}deg) rotateY(${(y0+y1)/2}deg)`,offset:.5},
    {transform:P+`translate(0,0) scale(1) rotate(0deg) rotateY(${y1}deg)`}],{duration:o.ms||560,easing:'cubic-bezier(.3,.7,.3,1)'});
  return a.finished.catch(()=>{}).then(()=>d.remove());
}
function coins(from,to,n,good){if(!canAnim())return;for(let i=0;i<n;i++){const c=document.createElement('i');c.className='bbcoin'+(good?'':' bad');c.textContent=good?'$':'−';
  Object.assign(c.style,{left:to.cx-13+'px',top:to.cy-13+'px'});$('#bbfx').append(c);
  const dx=from.cx-to.cx+(Math.random()-.5)*50,dy=from.cy-to.cy+(Math.random()-.5)*36,mx=dx*.5+(Math.random()-.5)*170,my=dy*.5-60-Math.random()*90;
  c.animate([{transform:`translate(${dx}px,${dy}px) scale(.3)`,opacity:0},{transform:`translate(${mx}px,${my}px) scale(1.15) rotate(${Math.random()*360|0}deg)`,opacity:1,offset:.45},{transform:'translate(0,0) scale(.55) rotate(720deg)',opacity:1}],
    {duration:680+Math.random()*260,delay:i*42,easing:'cubic-bezier(.5,0,.6,1)',fill:'backwards'}).finished.catch(()=>{}).then(()=>c.remove())}}
function sparks(p,cols,n=16,spread=95){if(!canAnim())return;for(let i=0;i<n;i++){const e=document.createElement('i');e.className='bbspark';Object.assign(e.style,{left:p.cx-5+'px',top:p.cy-5+'px',background:cols[i%cols.length]});$('#bbfx').append(e);
  const a=Math.random()*Math.PI*2,d=spread*(.45+Math.random()*.75);
  e.animate([{transform:'scale(1.3) rotate(45deg)',opacity:1},{transform:`translate(${Math.cos(a)*d|0}px,${Math.sin(a)*d|0}px) scale(0) rotate(${45+Math.random()*200|0}deg)`,opacity:.2}],{duration:480+Math.random()*320,easing:'cubic-bezier(.2,.8,.4,1)'}).finished.catch(()=>{}).then(()=>e.remove())}}
function confetti(){if(!canAnim())return;const b=roomBox(),cols=['#ff3e8a','#2d7bff','#ffe14d','#2fe3a0','#ff8a1f','#b28cff'];
  // its own layer above the results card, so it rains over it
  let L=$('#bbconfl');if(!L){L=document.createElement('div');L.id='bbconfl';document.body.append(L)}
  for(let i=0;i<90;i++){const e=document.createElement('i');e.className='bbconf';Object.assign(e.style,{left:Math.random()*b.width+'px',top:'-20px',background:cols[i%cols.length],width:(6+Math.random()*6|0)+'px',height:(10+Math.random()*8|0)+'px'});L.append(e);
    e.animate([{transform:'translate(0,0) rotate(0)'},{transform:`translate(${(Math.random()-.5)*160|0}px,${b.height+60|0}px) rotate(${(Math.random()-.5)*1440|0}deg) rotateY(${Math.random()*720|0}deg)`}],{duration:1800+Math.random()*1600,delay:Math.random()*700,easing:'cubic-bezier(.25,.6,.5,1)',fill:'backwards'}).finished.catch(()=>{}).then(()=>e.remove())}}
/* tilt a card toward the pointer; the foil and glare follow it, like a holo card in your hand */
function tiltOn(el,e){const r=el.getBoundingClientRect();if(!r.width)return;const x=Math.max(0,Math.min(1,(e.clientX-r.left)/r.width)),y=Math.max(0,Math.min(1,(e.clientY-r.top)/r.height));
  el.style.setProperty('--rx',((.5-y)*24).toFixed(1)+'deg');el.style.setProperty('--ry',((x-.5)*28).toFixed(1)+'deg');el.style.setProperty('--mx',(x*100|0)+'%');el.style.setProperty('--my',(y*100|0)+'%');el.classList.add('tilting')}
function tiltOff(el){el.style.setProperty('--rx','0deg');el.style.setProperty('--ry','0deg');el.style.removeProperty('--mx');el.style.removeProperty('--my');el.classList.remove('tilting')}
{const H=$('#bbhand');let cur=null;
  H.addEventListener('pointermove',e=>{if(e.pointerType==='touch')return;const c=e.target.closest('.bbc');if(cur&&cur!==c)tiltOff(cur);cur=c;if(c&&!c.disabled)tiltOn(c,e)});
  H.addEventListener('pointerleave',()=>{if(cur)tiltOff(cur);cur=null});
  const L=$('#bblotw');L.addEventListener('pointermove',e=>{if(e.pointerType!=='touch')tiltOn(L,e)});L.addEventListener('pointerleave',()=>tiltOff(L));
  L.addEventListener('pointerdown',e=>{if(e.pointerType==='touch')tiltOn(L,e)});L.addEventListener('pointerup',()=>tiltOff(L))}
/* the rival's hand: face-down cards fanned along the top */
function rivalFan(n,col){const F=$('#bbofan'),key=n+':'+col;if(F.dataset.k===key)return;
  const had=F.children.length,same=F.dataset.col===col;F.dataset.k=key;F.dataset.col=col;
  if(same&&n<had&&had){   // they played a card: drop one from the middle of the fan, the rest slide together
    for(let i=had;i>n;i--)F.children[Math.floor(F.children.length/2)].remove();
    [...F.children].forEach((c,i)=>{c.style.animation='none';c.style.setProperty('--k',(i-(n-1)/2).toFixed(2))});return}
  F.innerHTML=Array.from({length:n},(_,i)=>{const k=i-(n-1)/2;return`<div class="bbo" style="--k:${k.toFixed(2)};--pc:${col};animation-delay:${i*30}ms">${backFace('bid',`style="--pc:${col}"`)}</div>`}).join('')}

/* ---------- rendering ---------- */
const activeSeat=()=>BB.mode==='local'?BB.turn:0;   // whose hand is on screen
function setMood(s,m){if(BB.mood[s]===m)return;BB.mood[s]=m;$('#bbav'+s).innerHTML=avatar(s?OP_COL:ME_COL,m)}
function slot(s,mode,c){ // mode: '' empty, 'down' face-down, 'up' face-up
  const el=$('#bbslot'+s),f=el.querySelector('.bbflip'),col=s?OP_COL:ME_COL,key=mode+':'+c;
  if(el.dataset.k===key)return;el.dataset.k=key;
  el.classList.toggle('has',!!mode);
  if(!mode){f.innerHTML='';f.classList.remove('up');return}
  if(!f.firstChild||f.dataset.c!==String(c)){f.innerHTML=bidBack(col)+(c?bidCard(c,col):'');f.dataset.c=c||''}
  f.classList.toggle('up',mode==='up');
}
function lotCard(v){const el=$('#bblot');if(el.dataset.v!==String(v)){el.innerHTML=lotBack+(v?lotFace(v):'');el.dataset.v=v}}
function render(){
  if(!BB.deck.length)return;
  const r=BB.shown,st=sim(BB.deck,BB.mine.slice(0,r),BB.theirs.slice(0,r)),live=r<BB.deck.length&&!BB.ended,N=BB.names,seat=activeSeat();
  // header
  [0,1].forEach(s=>{$('#bbn'+s).textContent=N[s];if(!BB.anim){const e=$('#bbs'+s);e.textContent=money(st.sc[s]);e.classList.toggle('neg',st.sc[s]<0)}
    $('#bbp'+s).classList.toggle('turn',live&&!BB.anim&&bidsOf(s).length<=r&&(BB.mode!=='local'||BB.turn===s))});
  $('#bbrnd').textContent='LOT '+Math.min(r+1,BB.deck.length)+'/'+BB.deck.length;$('#bbrec').textContent=BB.wins[0]+' – '+BB.wins[1];
  if(!BB.anim){
    // the pot (lots carried over from tied rounds)
    const pot=st.pot;$('#bbpot').innerHTML=pot.map((v,i)=>`<span class="bbpc ${v>0?'deal':'scan'}" style="--i:${i}">${v>0?'+':'−'}${Math.abs(v)}</span>`).join('')+(pot.length?`<em>POT ${money(sum(pot))}</em>`:'');
    if(live)lotCard(BB.deck[r]);
    // bid slots: face-down once that player has locked in
    [0,1].forEach(s=>{const b=bidsOf(s);slot(s,b.length>r?'down':'',0);   // the number only goes in at the reveal
      $('#bbtag'+s).textContent=b.length>r?(s===0&&BB.mode!=='local'?'LOCKED · '+b[r]:'LOCKED'):BB.mode!=='local'&&s===1&&live?'thinking…':'';$('#bbtag'+s).classList.toggle('ok',b.length>r)});
  }
  // the rival's (or other player's) remaining cards, public info
  const other=1-seat,oh=handOf(BB.len,bidsOf(other).slice(0,r));
  rivalFan(handOf(BB.len,bidsOf(other)).length,other?OP_COL:ME_COL);
  $('#bbleft').textContent=Math.max(0,BB.deck.length-r-1);$('#bbdeck').classList.toggle('empty',BB.deck.length-r-1<=0);
  $('#bbol').textContent=(N[other]||'Rival')+"'s cards";
  $('#bbochips').innerHTML=Array.from({length:BB.len},(_,i)=>`<i class="${oh.includes(i+1)?'':'gone'}" style="--pc:${other?OP_COL:ME_COL}">${i+1}</i>`).join('');
  // my hand (or the active player's in pass-and-play)
  const myb=bidsOf(seat),locked=myb.length>r,hand=handOf(BB.len,myb.slice(0,r)),canPick=live&&!locked&&!BB.anim&&!BB.waiting&&$('#bbpass').hidden&&(BB.mode!=='online'||!!opp);
  const col=seat?OP_COL:ME_COL,H=$('#bbhand');
  if(H.dataset.n!==String(BB.len)||H.dataset.col!==col){H.dataset.n=BB.len;H.dataset.col=col;
    H.innerHTML=Array.from({length:BB.len},(_,i)=>`<button class="bbc${i+1>=13?' rare':''}" data-c="${i+1}" style="--pc:${col}" aria-label="Bid ${i+1}"><span class="bc-c tl">${i+1}</span><b>${i+1}</b><span class="bc-coin">$</span><span class="bc-c br">${i+1}</span>${foil}</button>`).join('')}
  // fan the cards you still hold (spent ones leave the fan; the rest slide together)
  const vis=[];H.querySelectorAll('.bbc').forEach(b=>{const c=+b.dataset.c,has=hand.includes(c)&&!(locked&&myb[r]===c);
    b.classList.toggle('gone',!has);b.classList.toggle('sel',BB.sel===c);b.disabled=!canPick||!has;if(has)vis.push(b)});
  const nv=vis.length,spread=Math.min(5.5,64/Math.max(1,nv));vis.forEach((b,i)=>{const k=i-(nv-1)/2;b.style.setProperty('--rot',(k*spread).toFixed(2)+'deg');b.style.setProperty('--dy',(k*k*spread*.16).toFixed(1)+'px');b.style.setProperty('--di',i)});
  H.classList.toggle('wait',!canPick);
  const L=$('#bblock');L.disabled=!canPick||BB.sel==null;L.textContent=locked?'Bid locked ✓':BB.sel!=null?'Lock bid: '+BB.sel:'Pick a card';
  // caption
  const cap=$('#bbcap'),lot=BB.deck[r];
  if(BB.waiting)cap.textContent='Waiting for '+N[1]+' to accept the rematch…';
  else if(BB.mode==='online'&&!opp)cap.textContent='Rival disconnected. Waiting for them to come back…';
  else if(!live||BB.anim)cap.innerHTML=cap.dataset.anim||'';
  else if(!locked)cap.innerHTML=(BB.mode==='local'?`<b>${esc(N[seat])}</b>, your bid. `:'')+(lot>0?'<span class="bbg">Deal:</span> highest bid wins it'+(st.pot.length?' (and the pot)':''):'<span class="bbr">Scandal:</span> lowest bid gets stuck with it'+(st.pot.length?' (and the pot)':''));
  else cap.innerHTML=`Bid locked. Waiting for ${esc(N[1])} <span class="bthink"><i></i><i></i><i></i></span>`;
}

/* ---------- a round ---------- */
function beginRound(){
  const r=BB.shown;BB.sel=null;if(r>=BB.deck.length)return;
  setMood(0,'');setMood(1,'');
  if(BB.mode==='local')BB.turn=r%2;   // whoever bid second last round still holds the phone, so they go first now
  const el=$('#bblot'),w=$('#bblotw'),burst=$('#bbburst');el.classList.add('nofx');el.classList.remove('up','fly0','fly1','pot');el.dataset.v='';lotCard(BB.deck[r]);void el.offsetWidth;el.classList.remove('nofx');
  w.getAnimations&&w.getAnimations().forEach(a=>a.cancel());$('#bbpot').getAnimations&&$('#bbpot').getAnimations().forEach(a=>a.cancel());
  burst.className='bbburst';[0,1].forEach(s=>$('#bbslot'+s).classList.remove('win','lose','tie'));
  render();
  const v=BB.deck[r],rare=rarity(v)===3;
  if(canAnim()){const d=rel($('#bbdeck')),t=rel(w);w.animate([{transform:`translate(${d.cx-t.cx}px,${d.cy-t.cy}px) rotate(-14deg) scale(${d.w/t.w})`},{transform:`translate(${(d.cx-t.cx)*.35}px,${(d.cy-t.cy)*.35-40}px) rotate(6deg) scale(1.08)`,offset:.6},{transform:'none'}],{duration:520,easing:'cubic-bezier(.3,.8,.3,1.1)'})}
  setTimeout(()=>{if(BB.shown!==r)return;SFX.flip();el.classList.add('up');
    if(rare){burst.className='bbburst on '+(v>0?'deal':'scan');setTimeout(()=>{if(BB.shown===r){sparks(rel(w),v>0?['#ffe14d','#2fe3a0','#ffffff','#38d6ff']:['#ff3e5a','#b28cff','#ffffff','#ff8a1f'],22,130);try{SFX.star()}catch(e){}}},260)}},canAnim()?420:60);
  if(BB.mode==='cpu')cpuThink(r);
  tick();
}
function cpuThink(r){
  clearTimeout(BB.cpuT);if(BB.theirs.length>r)return;
  const st=sim(BB.deck,BB.mine.slice(0,r),BB.theirs.slice(0,r)),s={len:BB.len,seen:BB.deck.slice(0,r+1),pot:st.pot,lot:BB.deck[r],H:handOf(BB.len,BB.theirs),O:handOf(BB.len,BB.mine.slice(0,r)),sc:[st.sc[1],st.sc[0]]};
  const c=cpuBid(s,BB.lvl);setMood(1,'think');
  const tok=BB.tok;BB.cpuT=setTimeout(()=>{if(tok!==BB.tok||BB.theirs.length!==r)return;BB.theirs.push(c);SFX.lockin();setMood(1,'');render();tick()},500+Math.random()*1300);
}
function lockBid(){
  const r=BB.shown,seat=activeSeat(),b=bidsOf(seat),c=BB.sel;
  if(c==null||b.length!==r||BB.anim||!handOf(BB.len,b).includes(c))return;
  const src=$('#bbhand').querySelector(`.bbc[data-c="${c}"]`),from=src&&rel(src),slotEl=$('#bbslot'+seat),to=rel(slotEl),col=seat?OP_COL:ME_COL;
  b.push(c);BB.sel=null;SFX.lockin();
  if(from&&canAnim()){slotEl.classList.add('incoming');BB.flying=c;
    BB.flightP=flyCard(`<div class="bbflip">${bidBack(col)}${bidCard(c,col)}</div>`,from,to,{y0:180,y1:0,r0:parseFloat(src.style.getPropertyValue('--rot'))||0}).then(()=>{slotEl.classList.remove('incoming');BB.flying=null;
      sparks({cx:to.cx,cy:to.y+to.h},['#ffe14d','#ffffff',col],10,60);render()})}
  if(BB.mode==='online'){NET.ev({e:'bbid',g:myG,r,c});pub()}
  if(BB.mode==='local'&&bidsOf(1-seat).length===r){BB.turn=1-seat;passTo(BB.turn)}
  render();tick();
}
function passTo(s){
  const N=BB.names;$('#bbpt').textContent='Pass to '+N[s];
  $('#bbps').textContent=`${N[1-s]} has locked a bid. No peeking, ${N[1-s]}!`;
  $('#bbpgo').textContent=`I'm ${N[s]}, show my cards`;$('#bbpass').hidden=false;$('#bbpass').style.setProperty('--pc',s?OP_COL:ME_COL);
}
$('#bbpgo').onclick=()=>{$('#bbpass').hidden=true;SFX.ui();render()};
function tick(){
  if(BB.anim||BB.dead||BB.waiting||BB.ended)return;
  const r=BB.shown,n=Math.min(BB.mine.length,BB.theirs.length,BB.deck.length);
  if(n<=r)return render();
  if(n-r>1){BB.shown=n-1;render()}    // catching up after a reconnect: skip straight to the newest round
  reveal(BB.shown);
}
async function reveal(r){
  BB.anim=true;const tok=BB.tok,ok=()=>tok===BB.tok&&!BB.dead;
  if(BB.flightP){await BB.flightP;BB.flightP=null;if(!ok())return}
  $('#bbpass').hidden=true;
  const before=sim(BB.deck,BB.mine.slice(0,r),BB.theirs.slice(0,r)).sc,e=state().log[r],N=BB.names,cap=$('#bbcap');
  cap.dataset.anim='Revealing bids…';render();
  [0,1].forEach(s=>{slot(s,'down',bidsOf(s)[r]);$('#bbtag'+s).textContent=''});
  await wait(420);if(!ok())return;
  [0,1].forEach(s=>slot(s,'up',bidsOf(s)[r]));SFX.flip();
  const rx=$('#bbrowx');rx.classList.remove('clash');void rx.offsetWidth;rx.classList.add('clash');
  setTimeout(()=>{if(ok())sparks(rel($('#bblotw')),['#ffe14d','#ffffff','#ff8a1f'],14,80)},300);
  await wait(620);if(!ok())return;
  const g=$('#bbgavel');g.classList.remove('bang');void g.offsetWidth;g.classList.add('bang');
  await wait(170);if(!ok())return;SFX.gavel();$('#bbroom').classList.remove('thud');void $('#bbroom').offsetWidth;$('#bbroom').classList.add('thud');
  const stamp=$('#bbstamp');let txt,cls;
  if(e.w<0){txt=r===BB.deck.length-1?'TIE · SHREDDED!':'TIE · ROLLOVER!';cls='tie';setMood(0,'think');setMood(1,'think');
    cap.dataset.anim=r===BB.deck.length-1?'Same bid on the last lot. Nobody gets it!':`Both bid ${e.a}. The lot rolls into the pot!`}
  else{const good=e.total>0,w=e.w;txt=good?(e.lot>0?'SOLD!':'LUCKY!'):(e.lot>0?'OUCH!':'BUSTED!');cls=good?'good':'bad';
    setMood(w,good?'happy':'sad');setMood(1-w,good?'sad':'happy');
    const who=esc(N[w]);cap.dataset.anim=good?`<b>${who}</b> ${e.lot>0?'wins':'takes'} ${e.pot.length>1?'the pot':'it'}: <span class="bbg">+${money(e.total).replace('−','')}</span>`
      :`<b>${who}</b> gets stuck with ${e.pot.length>1?'the pot':'it'}: <span class="bbr">${money(e.total)}</span>`;
    (good?SFX.cash:SFX.boo)()}
  stamp.className='bbstamp '+cls+(e.w>=0?' w'+e.w:'');stamp.textContent=txt;void stamp.offsetWidth;stamp.classList.add('show');
  if(e.w<0)[0,1].forEach(s=>$('#bbslot'+s).classList.add('tie'));
  else{const t=e.w,good=e.total>0;$('#bbslot'+t).classList.add(good?'win':'lose');$('#bbslot'+(1-t)).classList.add(good?'lose':'win')}
  render();
  await wait(900);if(!ok())return;
  // the lot (and the pot) slides to whoever took it; numbers tick up
  const L=$('#bblot');
  if(e.w>=0){const W=$('#bblotw'),dst=rel($('#bbp'+e.w)),src=rel(W);
    if(canAnim()){W.animate([{transform:'none',opacity:1},{transform:`translate(${(dst.cx-src.cx)*.4}px,${(dst.cy-src.cy)*.4-50}px) rotate(${e.w?14:-14}deg) scale(.8)`,opacity:1,offset:.4},{transform:`translate(${dst.cx-src.cx}px,${dst.cy-src.cy}px) rotate(${e.w?28:-28}deg) scale(.22)`,opacity:0}],{duration:650,easing:'cubic-bezier(.5,0,.6,1)',fill:'forwards'});
      $('#bbpot').animate([{opacity:1},{transform:`translate(${dst.cx-src.cx}px,${dst.cy-src.cy}px) scale(.3)`,opacity:0}],{duration:600,easing:'ease-in',fill:'forwards'});
      coins(src,dst,Math.min(18,4+Math.abs(e.total)),e.total>0)}
    else{L.classList.add('fly'+e.w);$('#bbpot').classList.add('fly'+e.w)}
    const s=e.w,el=$('#bbs'+s),from=before[s],to=before[s]+e.total,t0=performance.now();
    $('#bbp'+s).classList.add(e.total>0?'gain':'loss');
    const step=()=>{if(!ok())return;const k=Math.min(1,(performance.now()-t0)/600),v=Math.round(from+(to-from)*k);el.textContent=money(v);el.classList.toggle('neg',v<0);if(k<1)requestAnimationFrame(step)};step();}
  else L.classList.add('pot');
  await wait(750);if(!ok())return;
  stamp.classList.remove('show');[0,1].forEach(s=>{$('#bbp'+s).classList.remove('gain','loss');$('#bbslot'+s).classList.remove('win','lose','tie')});$('#bbpot').classList.remove('fly0','fly1');$('#bbburst').className='bbburst';$('#bbrowx').classList.remove('clash');
  [0,1].forEach(s=>slot(s,'',0));
  BB.anim=false;BB.shown=r+1;cap.dataset.anim='';
  if(BB.shown>=BB.deck.length){BB.ended=true;render();setTimeout(()=>{if(ok())endGame()},350);return}
  beginRound();
}
function endGame(){
  const st=state(),N=BB.names,loc=BB.mode==='local',[a,b]=st.sc,w=a>b?0:b>a?1:-1;
  if(w>=0)BB.wins[w]++;render();setMood(0,w===0?'happy':w===1?'sad':'think');setMood(1,w===1?'happy':w===0?'sad':'think');
  jingle(w===0||(loc&&w>=0));if(w===0||(loc&&w>=0))confetti();
  const t=w<0?'SPLIT THE COMPANY!':loc?N[w].toUpperCase()+' RUNS THE COMPANY!':w===0?"YOU'RE THE NEW CEO!":"YOU'RE FIRED!";
  setOver(t,`${esc(N[0])} ${money(a)} · ${esc(N[1])} ${money(b)}<br>Session: ${BB.wins[0]} – ${BB.wins[1]}`,BB.mode==='online'?null:'Next meeting!');
}

/* ---------- input ---------- */
$('#bbhand').addEventListener('click',e=>{const c=e.target.closest('.bbc');if(!c||c.disabled)return;
  const v=+c.dataset.c;if(BB.sel===v&&!TOUCH_UI)return lockBid();   // double-click locks on desktop
  BB.sel=v;SFX.sel();render()});
$('#bblock').onclick=lockBid;
addEventListener('keydown',e=>{if($('#bbgame').hidden||e.repeat)return;
  if(e.key==='Enter'&&BB.sel!=null){e.preventDefault();lockBid()}});

/* ---------- starting games ---------- */
function newGame(){
  BB.tok++;clearTimeout(BB.cpuT);
  BB.seed=BB.mode==='online'?hash(code+'|'+myG+'|'+BB.len):(Math.random()*2**31)|0;
  BB.deck=deckFor(BB.len,BB.seed);BB.mine=[];BB.theirs=[];BB.shown=0;BB.sel=null;BB.anim=false;BB.ended=false;BB.waiting=false;BB.dead=false;BB.turn=0;BB.mood=['x','x'];
  $('#bbpass').hidden=true;$('#bbstamp').className='bbstamp';$('#bbhand').dataset.n='';$('#over').hidden=true;
  [0,1].forEach(s=>{slot(s,'',0);setMood(s,'')});$('#bbofan').dataset.k='';BB.flying=null;
  beginRound();
  const H=$('#bbhand');H.classList.remove('dealin');void H.offsetWidth;H.classList.add('dealin');clearTimeout(BB.dealT);BB.dealT=setTimeout(()=>H.classList.remove('dealin'),1500);
}
function start(mode){
  me.n=($('#nm').value.trim()||'Hero').slice(0,12);
  if(mode!=='online'){leave();G='board';cpu=true}
  BB.mode=mode;BB.lvl=+$('#bbdiff').value;BB.wins=[0,0];BB.game=0;
  BB.len=+$('#bblen').value===10?10:15;
  if(mode==='online'&&!HOST&&opp&&opp.x&&SIZES[+opp.x.len])BB.len=+opp.x.len;   // the host's meeting length wins
  if(mode==='online'&&opp&&opp.x&&+opp.x.g>myG)myG=+opp.x.g;                      // re-joining a meeting already in progress
  BB.names=[me.n,mode==='cpu'?['Intern','Manager','The CEO'][BB.lvl]:mode==='local'?($('#bbp2').value.trim()||'Player 2').slice(0,12):(on||'Rival')];
  phase='bplay';show('bbgame');$('#net').hidden=mode!=='online';document.documentElement.classList.add('bbon');
  newGame();if(mode==='online')sync();
}
const validBids=(arr,len)=>Array.isArray(arr)&&arr.length<=len&&arr.every((c,i)=>Number.isInteger(c)&&c>=1&&c<=len&&arr.indexOf(c)===i);
function sync(){
  if(BB.mode!=='online'||phase!=='bplay')return;
  if(!opp){render();return}
  BB.names[1]=on;const x=opp.x;
  if(BB.waiting&&opp.g===myG){BB.waiting=false;newGame();return}
  if(!$('#over').hidden)rmLabel();
  if(x&&+x.g===myG){
    // the host decides the meeting length: restart if we guessed differently and nobody has bid yet
    if(!HOST&&SIZES[+x.len]&&+x.len!==BB.len&&!BB.mine.length){BB.len=+x.len;newGame();return}
    const b=(x.b||[]).map(Number),ob=(x.ob||[]).map(Number);
    if(validBids(b,BB.len)&&b.length>BB.theirs.length&&BB.theirs.every((v,k)=>v===b[k])){BB.theirs=b.slice();if(!BB.anim&&b.length>BB.shown)SFX.lockin()}
    // after a reload we get our own earlier bids back from the rival
    if(validBids(ob,BB.len)&&ob.length>BB.mine.length&&BB.mine.every((v,k)=>v===ob[k]))BB.mine=ob.slice();
  }
  render();tick();
}
function event(d){
  if(BB.mode!=='online'||d.e!=='bbid'||+d.g!==myG||BB.waiting)return;
  const r=+d.r,c=+d.c;
  if(r!==BB.theirs.length||!handOf(BB.len,BB.theirs).includes(c))return;
  BB.theirs.push(c);if(!BB.anim)SFX.lockin();render();tick();
}
function rematch(){
  if(BB.mode!=='online'){BB.game++;newGame();return}
  if(!opp)return;
  myG=opp.g>myG?opp.g:myG+1;pub();
  if(opp.g===myG)newGame();else{BB.tok++;BB.waiting=true;render()}
}
function stop(){BB.dead=true;BB.tok++;clearTimeout(BB.cpuT);BB.waiting=false;BB.mine=[];BB.theirs=[];BB.anim=false;BB.flying=null;document.documentElement.classList.remove('bbon');const fx=$('#bbfx');if(fx)fx.innerHTML='';const cl=$('#bbconfl');if(cl)cl.innerHTML=''}

$('#bbsolo').onclick=()=>start('cpu');
$('#bblocal').onclick=()=>start('local');
$('#bbgo').onclick=()=>join('board');
$('#bbquit').onclick=leave;

/* ---------- music + card art ---------- */
THEMES.board={bpm:104,sw:.14,vol:1,key:69,maj:0,prog:prog('A2:m7 D3:m7 G2:dom7 C3:maj7'),
  bass:seq('0 . . 7 . . 12 . 0 . . 7 . 10 . .'),bassT:'triangle',bassV:.3,bassD:1.8,
  stab:seq('. . x . . . x . . . x . . . x .'),stabO:12,stabT:'sine',stabV:.045,stabD:2,stabDl:.15,
  lead:[seq('E5 . . . C5 . . . D5 . E5 . . . . .'),seq('F5 . . . E5 . D5 . C5 . . . . . . .'),seq('D5 . . . B4 . . . G4 . A4 . B4 . . .'),seq('E5 . . . G5 . . . E5 . . . . . . .')],leadT:'triangle',leadV:.08,leadD:2.2,leadDl:.2,
  k:'x.......x.......',r:'....x.......x...',h:'..x...x...x...x.',hV:.03};
ART_GEN.board=(W,n)=>{
  // a deal card under the gavel, two bids face up, cash in the air (kept clear of the top-right badge)
  const cx=W/2,K='#14111f',u='_bb'+n,k=Math.min(1,(W-10)/240);
  const card=(x,y,w,h,rot,inner,fill='#fff')=>`<g transform="translate(${x} ${y}) rotate(${rot})"><rect x="${-w/2+3}" y="${-h/2+4}" width="${w}" height="${h}" rx="8" fill="${K}"/><rect x="${-w/2}" y="${-h/2}" width="${w}" height="${h}" rx="8" fill="${fill}" stroke="${K}" stroke-width="3"/>${inner}</g>`;
  const bid=(x,y,rot,num,col,cls)=>`<g class="${cls}">${card(x,y,40,56,rot,`<rect x="-17" y="-25" width="34" height="11" rx="4" fill="${col}"/><text y="16" text-anchor="middle" font-family="Bangers,Impact,sans-serif" font-size="30" fill="${col}" stroke="${K}" stroke-width="1.5" paint-order="stroke">${num}</text>`)}</g>`;
  const bill=(x,y,r,c)=>`<g transform="translate(${x} ${y}) rotate(${r})"><rect x="-11" y="-6" width="22" height="12" rx="2" fill="${c}" stroke="${K}" stroke-width="2"/><circle r="3.2" fill="none" stroke="${K}" stroke-width="1.5"/></g>`;
  const gx=cx-40,gy=40,hx=gx-34,hy=gy-34;   // gavel head next to the card, handle up and to the left
  return `<svg viewBox="0 0 ${W} 130" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><defs>${ART.dots('bd'+u,'#fff',.22)}
   <linearGradient id="tb${u}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c0773a"/><stop offset="1" stop-color="#7a3d17"/></linearGradient></defs>
  <rect width="${W}" height="130" fill="#ff8a1f"/>${ART.rays(cx,70,28,W,'#ffb347','#ff8a1f')}<rect width="${W}" height="130" fill="url(#bd${u})"/>
  <path d="M-10 108Q${cx} 94 ${W+10} 108V140H-10z" fill="url(#tb${u})" stroke="${K}" stroke-width="3.5"/>
  <g transform="translate(${cx} 72) scale(${k}) translate(${-cx} -72)">
   <g class="bbqm">${bill(cx-108,52,-20,'#9cf2c4')}${bill(cx+104,58,18,'#9cf2c4')}${bill(cx-86,96,8,'#9cf2c4')}</g>
   ${bid(cx-66,88,-10,'12','#ff3e8a','bbq1')}${bid(cx+66,88,10,'9','#2d7bff','bbq2')}
   <g class="bbqd">${card(cx,74,62,84,-2,`<rect x="-27" y="-38" width="54" height="15" rx="5" fill="#2fe3a0" stroke="${K}" stroke-width="2"/><text y="-26.5" text-anchor="middle" font-family="Bangers,Impact,sans-serif" font-size="12" fill="${K}">DEAL</text>
     <text y="7" text-anchor="middle" font-size="25">🚀</text><text y="31" text-anchor="middle" font-family="Bangers,Impact,sans-serif" font-size="20" fill="#2fe3a0" stroke="${K}" stroke-width="1.3" paint-order="stroke">+$9M</text>`)}</g>
   <g class="bbqg" style="transform-origin:${hx}px ${hy}px"><g transform="translate(${gx} ${gy}) rotate(135)">
     <rect x="-3.5" y="8" width="7" height="44" rx="3" fill="#8a4b22" stroke="${K}" stroke-width="2.5"/>
     <rect x="-19" y="-10" width="38" height="20" rx="6" fill="#b8682e" stroke="${K}" stroke-width="3"/><rect x="-21" y="-8" width="6" height="16" rx="2.5" fill="#ffe14d" stroke="${K}" stroke-width="2"/><rect x="15" y="-8" width="6" height="16" rx="2.5" fill="#ffe14d" stroke="${K}" stroke-width="2"/></g>
     <path d="M${gx+6} ${gy+22}l7 5M${gx+14} ${gy+14}l8 1" stroke="${K}" stroke-width="2.5" stroke-linecap="round"/></g>
   <g fill="#fff" stroke="${K}" stroke-width="2"><path d="M${cx+38} 38l3 6 6 3-6 3-3 6-3-6-6-3 6-3z"/><path d="M${cx+40} 104l2 4 4 2-4 2-2 4-2-4-4-2 4-2z"/></g>
  </g></svg>`;
};

regGame('board',{name:'Board Room',menu:'bbmenu',stage:'bbgame',cd:'#cd7',theme:'board',
  start,sync,event,rematch,stop,
  hb:()=>({g:myG,len:phase==='bplay'?BB.len:(+$('#bblen').value===10?10:15),b:BB.mode==='online'?BB.mine:[],ob:BB.mode==='online'?BB.theirs:[]})});
window.BoardRoom={sim,deckFor,cpuBid,heur,handOf,BB,LOTS};
})();
