/* =========================================================================
   MAZE MUNCH: run a random maze, eat every dot, grab the fruit, dodge the monsters.
   Modes: Solo · Co-op · Versus · Hunter (one of you is the monster) · Free-for-all (4 runners).
   Every board is a brand-new symmetric maze built from a seed.

   Online: the host runs the monsters, dots, fruit and scores. Each screen moves its
   own character itself (so the controls are instant) and streams where it is; the
   host decides what that character ate or bumped into. Bots fill empty seats.
   ========================================================================= */
(()=>{
const W=21,H=23,N=W*H;
const DX=[0,0,1,0,-1],DY=[0,-1,0,1,0],OPP=[0,3,4,1,2];
const store=(k,v)=>{try{if(v===undefined)return localStorage[k];localStorage[k]=v}catch(e){}};
const clamp=(v,a,b)=>v<a?a:v>b?b:v;
const MODES={
  solo:{n:'Solo',p:'1P',d:'You against the monsters. Clear maze after maze for a high score.',ic:'<circle cx="12" cy="12" r="6.5"/><circle cx="14" cy="10.5" r="1.2" fill="currentColor"/>'},
  coop:{n:'Co-op',p:'2P',d:'Clear the maze together. A caught friend is trapped in a bubble: touch them to free them.',ic:'<circle cx="8.5" cy="12" r="5"/><circle cx="15.5" cy="12" r="5"/>'},
  versus:{n:'Versus',p:'2P',d:'Two runners, one maze, three minutes. Most points when the clock hits zero.',ic:'<path d="M5 6l14 12M19 6L5 18"/>'},
  hunter:{n:'Hunter',p:'2P',d:'One of you runs, the other is the monster. Then swap. The best runner wins.',ic:'<path d="M5 20v-9a7 7 0 0 1 14 0v9l-2.3-2-2.4 2-2.3-2-2.3 2-2.4-2z"/><circle cx="9.5" cy="11" r="1.2" fill="currentColor"/><circle cx="14.5" cy="11" r="1.2" fill="currentColor"/>'},
  ffa:{n:'Free-for-all',p:'1–4P',d:'Four runners on one maze. The monsters always hunt whoever is winning.',ic:'<circle cx="7" cy="7" r="3"/><circle cx="17" cy="7" r="3"/><circle cx="7" cy="17" r="3"/><circle cx="17" cy="17" r="3"/>'}};
const DIFF=[{n:'Chill',ms:.84,fr:8,bot:.28,sense:3},{n:'Normal',ms:1,fr:6,bot:.14,sense:4},{n:'Frantic',ms:1.12,fr:4.4,bot:.05,sense:5}];
const RC=['#ffcf3a','#45c6ff','#7be36a','#ff8a4c'];          // runner colours
const MC=['#ff4d5e','#ff7ad9','#2fd9c4','#ffae2e'];          // monster colours
const PAL=[['#4f7cff','#7fa2ff'],['#a35bff','#c69bff'],['#18c9b0','#6ff0dc'],['#ff5c8a','#ff9ab6'],['#ffb02e','#ffd27a']];
const BOTN=['Nibble','Zippy','Mango','Bolt','Pickle','Dash'];
const PTS={dot:10,pel:50,fr:[300,800],mon:[200,400,800,1600],steal:300,caught:250,clear:1000};
const CYC=[6,20,5,20,4,1e9];               // scatter / chase timings
const CORNER=[[W-2,-3],[1,-3],[W-1,H+1],[0,H+1]];
const DOOR=[10,7],PEN=[[10,11],[9,11],[11,11],[10,10]];
const STARTS={one:[[10,17]],two:[[9,17],[11,17]],four:[[1,1],[W-2,1],[1,H-2],[W-2,H-2]]};
const MCODE=['pen','leave','run','eyes','enter'],SCODE=['alive','dead','bubble','stun'],STCODE=['count','play','dying','clear','round','over','wait'];

const T={mode:'solo',local2:false,net:false,run:false,raf:0,last:0,acc:0,paused:false,diff:1,
  g:null,dots:null,dotsLeft:0,pellets:[],tunnel:11,seed:1,lv:1,round:0,bid:0,
  pl:[],rs:[],ms:[],fruits:[],fx:[],pops:[],lives:0,time:0,tLimit:0,clock:0,boardT:0,
  state:'wait',stT:0,cyc:0,cycT:0,fright:0,fnext:8,fid:0,
  snaps:[],eatQ:[],eatT:0,dotT:0,sendT:0,me:null,ending:null,waitRe:false,hudKey:''};

/* ---------- screens ---------- */
const SV=d=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
mountScreens(`
<section id="mzmenu" class="card gmenu" hidden>
<div class="mhero"><div class="mart" data-art="maze"></div><h2 class="mh">Maze Munch</h2></div>
<p class="lb">Pick a mode</p>
<div class="mzmodes" id="mzmodes" role="radiogroup" aria-label="Mode"></div>
<div class="row rsets">
  <label>Monsters<select id="mzdiff"><option value="0">Chill</option><option value="1" selected>Normal</option><option value="2">Frantic</option></select></label>
  <label id="mzp2l">Player 2 name (same device)<input id="mzp2" maxlength="12" placeholder="Player 2" autocomplete="off"></label>
  <label>Online room code<input id="cd12" maxlength="6" autocomplete="off"></label>
</div>
<div class="row" id="mzbtns"><button class="btn b" id="mzplay">Play</button><button class="btn o" id="mzlocal">2 players · same device</button><button class="btn" id="mzgo">Online with a friend</button></div>
<p class="note" data-msg></p>
<ul class="rules">
 <li><b>Eat every dot</b> to clear the maze and get a brand-new random one. In Versus and Free-for-all the clock decides: most points when it hits zero.</li>
 <li><b>Fruit pops up</b> now and then: a strawberry is worth <b>${PTS.fr[0]}</b>, a watermelon <b>${PTS.fr[1]}</b>. Grab them before they vanish.</li>
 <li><b>Glowing orbs</b> turn the monsters blue for a few seconds: eat them for 200, 400, 800, 1600. In Versus and Free-for-all you can also bump a rival to steal ${PTS.steal} points.</li>
 <li><b>Keys:</b> arrows or W A S D. Two players on one keyboard: Player 1 W A S D, Player 2 arrows. <b>Phone:</b> swipe (two players: each swipes on their own half).</li>
</ul>
<button class="btn m back" data-back>← All games</button></section>
<section id="mzgame" hidden><div id="mzstage">
 <canvas id="mzcv"></canvas>
 <div id="mzhud"></div>
 <div id="mzbtns2"><button class="mzb" id="mzquit" aria-label="Leave the game">${SV('<path d="M15 5l-7 7 7 7"/>')}<span>Exit</span></button><button class="mzb" id="mzpause" aria-label="Pause">${SV('<path d="M9 5v14M15 5v14"/>')}</button><button class="mzb" id="mzfs" aria-label="Full screen">${SV('<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>')}</button></div>
 <div id="mzmsg"></div>
 <div id="mzpm" hidden><div class="mzpanel"><h3>Paused</h3><div class="row"><button class="btn m" id="mzres">Resume</button><button class="btn b" id="mzleave">Leave</button></div></div></div>
</div></section>`);
$('#mzmenu [data-back]').onclick=()=>{show('hub');SFX.back()};
['contextmenu','selectstart','dragstart'].forEach(n=>$('#mzgame').addEventListener(n,e=>e.preventDefault()));

/* ---------- menu ---------- */
let mode=store('mzMode');if(!MODES[mode])mode='solo';
{const d=+store('mzDiff');if(d>=0&&d<=2)$('#mzdiff').value=d}
$('#mzdiff').onchange=()=>store('mzDiff',$('#mzdiff').value);
function renderMenu(){
  $('#mzmodes').innerHTML=Object.entries(MODES).map(([k,m])=>`<button class="mzmode${k===mode?' on':''}" role="radio" aria-checked="${k===mode}" data-m="${k}">
    <span class="ic">${SV(m.ic)}</span><b>${m.n}</b><small>${m.d}</small><em>${m.p}</em></button>`).join('');
  const two=mode!=='solo';
  $('#mzplay').hidden=mode!=='solo'&&mode!=='ffa';
  $('#mzplay').textContent=mode==='ffa'?'Play · you + 3 bots':'Play';
  $('#mzlocal').hidden=!two;
  $('#mzlocal').textContent=mode==='ffa'?'2 players + 2 bots · same device':'2 players · same device';
  $('#mzgo').textContent=mode==='solo'?'Online · versus a friend':mode==='ffa'?'Online · you, a friend + 2 bots':'Online with a friend';
  $('#mzp2l').hidden=!two;
}
$('#mzmodes').onclick=e=>{const b=e.target.closest('.mzmode');if(!b)return;mode=b.dataset.m;store('mzMode',mode);renderMenu();SFX.sel()};
renderMenu();

/* ---------- the maze: symmetric, braided (no dead ends), with a monster pen in the middle ---------- */
// tile: 0 path · 1 wall · 2 pen · 3 pen door
function buildMaze(seed){
  const R=rng(seed*7919+101),g=new Uint8Array(N).fill(1),I=(x,y)=>y*W+x;
  const set=(x,y,v)=>{g[I(x,y)]=v;g[I(W-1-x,y)]=v};
  const core=(x,y)=>x>=6&&x<=14&&y>=8&&y<=14;          // the pen block: never carved
  const border=(x,y)=>x<=0||x>=W-1||y<=0||y>=H-1;
  // 1. a random spanning tree over the left half, mirrored
  const seen=new Set(['1,1']),st=[[1,1]];set(1,1,0);
  while(st.length){const[x,y]=st[st.length-1];
    const nb=[[2,0],[-2,0],[0,2],[0,-2]].map(([a,b])=>[x+a,y+b]).filter(([a,b])=>a>=1&&a<=9&&b>=1&&b<=H-2&&!seen.has(a+','+b));
    if(!nb.length){st.pop();continue}
    const[nx,ny]=nb[R()*nb.length|0];seen.add(nx+','+ny);set((x+nx)/2,(y+ny)/2,0);set(nx,ny,0);st.push([nx,ny])}
  // 2. extra loops, and a few doors across the middle
  for(let y=1;y<H-1;y++)for(let x=1;x<=9;x++){if(g[I(x,y)]!==1)continue;
    const hz=x%2===0&&y%2===1,vt=x%2===1&&y%2===0;if((hz||vt)&&R()<.13)set(x,y,0)}
  [1,3,5,17,19,21].filter(()=>R()<.55).concat([17,R()<.5?3:19]).forEach(y=>{g[I(10,y)]=0});
  // 3. the pen and the ring road around it
  for(let y=7;y<=15;y++)for(let x=5;x<=15;x++)g[I(x,y)]=(y===7||y===15||x===5||x===15)?0:1;
  for(let y=10;y<=12;y++)for(let x=8;x<=12;x++)g[I(x,y)]=2;
  g[I(10,8)]=g[I(10,9)]=3;g[I(10,17)]=0;g[I(10,16)]=R()<.5?0:1;
  // 4. a wrap-around tunnel
  const ty=[9,11,13][R()*3|0];set(0,ty,0);set(1,ty,0);set(2,ty,0);set(3,ty,0);set(4,ty,0);
  const open=(x,y)=>{if(y<0||y>=H)return false;if(x<0||x>=W){if(y!==ty)return false;x=(x+W)%W}return g[I(x,y)]===0};
  const carveOK=(x,y)=>!border(x,y)&&!core(x,y);
  // 5. no dead ends (classic chase mazes loop everywhere), and everything reachable
  for(let pass=0;pass<60;pass++){
    let changed=false;
    for(let y=1;y<H-1;y++)for(let x=0;x<=10;x++){if(g[I(x,y)]!==0)continue;
      const exits=[1,2,3,4].filter(d=>open(x+DX[d],y+DY[d]));if(exits.length>=2)continue;
      const cand=[1,2,3,4].filter(d=>{const wx=x+DX[d],wy=y+DY[d],bx=x+2*DX[d],by=y+2*DY[d];
        return wx>=0&&wx<W&&wy>=0&&wy<H&&g[I(wx,wy)]===1&&carveOK(wx,wy)&&open(bx,by)});
      if(cand.length){const d=cand[R()*cand.length|0];set(x+DX[d],y+DY[d],0)}else set(x,y,1);
      changed=true}
    // reachability from the start tile
    const seen2=new Uint8Array(N),q=[I(10,17)];seen2[q[0]]=1;
    while(q.length){const t=q.pop(),x=t%W,y=t/W|0;for(let d=1;d<=4;d++){let nx=x+DX[d],ny=y+DY[d];if(!open(nx,ny))continue;nx=(nx+W)%W;const k=I(nx,ny);if(!seen2[k]){seen2[k]=1;q.push(k)}}}
    for(let y=1;y<H-1;y++)for(let x=0;x<=10;x++){const k=I(x,y);if(g[k]!==0||seen2[k])continue;
      // try to punch a door to the reachable part, else fill it in
      const cand=[1,2,3,4].filter(d=>{const wx=x+DX[d],wy=y+DY[d],bx=x+2*DX[d],by=y+2*DY[d];return wx>0&&wx<W-1&&wy>0&&wy<H-1&&g[I(wx,wy)]===1&&carveOK(wx,wy)&&by>=0&&by<H&&bx>=0&&bx<W&&seen2[I(bx,by)]&&g[I(bx,by)]===0});
      if(cand.length)set(x+DX[cand[0]],y+DY[cand[0]],0);else set(x,y,1);changed=true}
    if(!changed)break}
  return{g,ty,open}
}

/* ---------- board setup ---------- */
function startsFor(){return T.mode==='ffa'?STARTS.four:T.mode==='solo'||T.mode==='hunter'?STARTS.one:STARTS.two}
function newBoard(seed,keepScores){
  T.seed=seed;T.bid++;const M=buildMaze(seed);T.g=M.g;T.ty=M.ty;
  T.dots=new Uint8Array(N);T.dotsLeft=0;
  const starts=startsFor().map(([x,y])=>y*W+x);
  for(let y=1;y<H-1;y++)for(let x=1;x<W-1;x++){const k=y*W+x;if(T.g[k]!==0||starts.includes(k))continue;if(y===T.ty&&(x<5||x>W-6))continue;if(x===10&&y===7)continue;T.dots[k]=1;T.dotsLeft++}
  // power orbs: the dot nearest each corner
  T.pellets=[];[[1,3],[W-2,3],[1,H-4],[W-2,H-4]].forEach(([cx,cy])=>{let best=-1,bd=1e9;for(let k=0;k<N;k++){if(T.dots[k]!==1)continue;const x=k%W,y=k/W|0,d=(x-cx)**2+(y-cy)**2;if(d<bd){bd=d;best=k}}if(best>=0){T.dots[best]=2;T.pellets.push(best)}});
  T.fruits=[];T.fx=[];T.pops=[];T.fright=0;T.cyc=0;T.cycT=0;T.boardT=0;T.fnext=7+Math.random()*5;
  T.pal=(T.lv-1+(T.round||0))%PAL.length;
  spawnActors();
  prerender();
}
function mkRunner(pi,x,y){return{kind:'r',pi,x,y,sx:x,sy:y,dir:0,want:0,st:'alive',t:0,inv:0,pow:0,chain:0,lid:1,mouth:0,ctrl:'bot',rx:x,ry:y,bt:0}}
function mkMon(k,human){return{kind:'m',k,x:PEN[k%4][0],y:PEN[k%4][1],dir:0,want:0,mode:'pen',fr:false,rel:0,rev:0,ctrl:human?'?':'ai',human:!!human,lid:1,rx:0,ry:0,bob:k}}
function spawnActors(){
  const S=startsFor();T.rs=[];T.ms=[];
  if(T.mode==='hunter'){
    const runPi=T.round%2,huntPi=1-runPi;
    const r=mkRunner(runPi,S[0][0],S[0][1]);T.rs.push(r);
    const h=mkMon(0,true);h.pi=huntPi;h.mode='run';h.x=DOOR[0];h.y=DOOR[1];T.ms.push(h);
    const a=mkMon(1);a.rel=5;T.ms.push(a);
  }else{
    const n=T.mode==='solo'?1:T.mode==='ffa'?4:2;
    for(let i=0;i<n;i++)T.rs.push(mkRunner(i,S[i][0],S[i][1]));
    const nm=T.mode==='ffa'?3:4;for(let k=0;k<nm;k++){const m=mkMon(k);m.rel=[0,2.5,6,10][k]/(1+(T.lv-1)*.15);T.ms.push(m)}
  }
  assignControls();
}
// who drives what on this screen
function assignControls(){
  const ents=[...T.rs,...T.ms.filter(m=>m.human)];
  ents.forEach(e=>{const p=T.pl[e.pi];
    if(!p){e.ctrl=e.kind==='m'?'ai':'bot';return}
    if(p.bot){e.ctrl='bot';return}
    if(T.net){e.ctrl=p.host===HOST?'k':(HOST?'net':'remote');return}
    e.ctrl=T.local2?(e.pi===0?'k1':'k2'):'k'});
  T.ms.forEach(m=>{if(!m.human)m.ctrl=T.net&&!HOST?'remote':'ai'});
  T.rs.forEach(r=>{if(T.net&&!HOST&&r.ctrl==='bot')r.ctrl='remote'});
  T.me=ents.find(e=>e.ctrl==='k'||e.ctrl==='k1')||null;
}
function resetPositions(){
  // after a life is lost in solo/co-op/hunter: everyone back to their spot, monsters back in the pen
  T.rs.forEach(r=>{if(r.st!=='alive'&&r.st!=='dead'&&r.st!=='bubble')return;r.x=r.sx;r.y=r.sy;r.dir=r.want=0;r.st='alive';r.inv=1.6;r.pow=0;r.lid++;r.rx=r.x;r.ry=r.y});
  T.ms.forEach(m=>{m.fr=false;m.dir=0;m.lid++;
    if(m.human){m.mode='run';m.x=DOOR[0];m.y=DOOR[1];m.want=0}
    else{m.mode='pen';m.x=PEN[m.k%4][0];m.y=PEN[m.k%4][1];m.rel=T.boardT+[0,2,4,6][m.k%4]}});
  T.fright=0;T.cyc=0;T.cycT=0;
}

/* ---------- movement on the grid ---------- */
const tile=(x,y)=>{if(y<0||y>=H)return 1;if(x<0||x>=W){if(y!==T.ty)return 1;x=(x+W)%W}return T.g[y*W+x]};
const walk=(x,y)=>tile(x,y)===0;
function move(e,dist,decide){
  for(let guard=0;dist>1e-7&&guard<10;guard++){
    if(e.dir&&e.want===OPP[e.dir]&&!decide)e.dir=e.want;
    const fx=Math.round(e.x),fy=Math.round(e.y);
    if(Math.abs(e.x-fx)<1e-5&&Math.abs(e.y-fy)<1e-5){
      e.x=fx;e.y=fy;
      if(decide)e.dir=decide(e,(fx+W)%W,fy);
      else{if(e.want&&walk(fx+DX[e.want],fy+DY[e.want]))e.dir=e.want;if(e.dir&&!walk(fx+DX[e.dir],fy+DY[e.dir]))e.dir=0}
      if(!e.dir)return;
    }
    if(!e.dir)return;
    const hz=DX[e.dir]!==0,p=hz?e.x:e.y,d=hz?DX[e.dir]:DY[e.dir];
    let to=d>0?Math.floor(p)+1-p:p-(Math.ceil(p)-1);if(to<1e-6)to=1;
    const s=Math.min(dist,to);if(hz)e.x+=d*s;else e.y+=d*s;dist-=s;
    if(Math.abs(e.x-Math.round(e.x))<1e-5)e.x=Math.round(e.x);if(Math.abs(e.y-Math.round(e.y))<1e-5)e.y=Math.round(e.y);
    if(e.x<-.5)e.x+=W;else if(e.x>W-.5)e.x-=W;
  }
}
const lvK=()=>Math.min(1,(T.lv-1)*.12+(T.mode==='solo'||T.mode==='coop'?0:.15));
const runSpeed=r=>(7.3+1.1*lvK())*(r.pow>0?1.06:1);
function monSpeed(m){const base=(6.7+1.2*lvK())*DIFF[T.diff].ms;
  if(m.mode==='eyes')return 15;
  if(m.human)return m.fr?4.6:runSpeed({})*1.03;
  if(m.fr)return 4.2;
  if(Math.round(m.y)===T.ty&&(m.x<5||m.x>W-6))return base*.55;
  return base}

/* ---------- monster brains ---------- */
function prey(m){
  const live=T.rs.filter(r=>r.st==='alive');if(!live.length)return null;
  if(T.mode==='ffa'){const top=Math.max(...live.map(r=>T.pl[r.pi].sc));const lead=live.filter(r=>T.pl[r.pi].sc===top);
    if(lead.length<live.length)return lead.reduce((a,b)=>dist2(m,a)<dist2(m,b)?a:b)}
  return live.reduce((a,b)=>dist2(m,a)<dist2(m,b)?a:b)}
const dist2=(a,b)=>{let dx=Math.abs(a.x-b.x);dx=Math.min(dx,W-dx);return dx*dx+(a.y-b.y)**2};
function target(m){
  if(m.mode==='eyes')return DOOR;
  const scatter=CYC.length&&T.cyc%2===0&&T.cyc<CYC.length-1;
  const r=prey(m);if(!r||scatter&&T.mode!=='hunter')return CORNER[m.k%4];
  const rx=Math.round(r.x),ry=Math.round(r.y),rd=r.dir;
  switch(m.k%4){
    case 0:return[rx,ry];
    case 1:return[rx+DX[rd]*4,ry+DY[rd]*4];
    case 2:{const a=T.ms.find(o=>o.k===0)||m;const px=rx+DX[rd]*2,py=ry+DY[rd]*2;return[2*px-Math.round(a.x),2*py-Math.round(a.y)]}
    default:return dist2(m,r)>64?[rx,ry]:CORNER[3]}
}
function decideMon(m,x,y){
  if(m.rev&&m.dir){m.rev=0;const o=OPP[m.dir];if(walk(x+DX[o],y+DY[o]))return o}
  m.rev=0;
  const opts=[1,4,3,2].filter(d=>d!==OPP[m.dir]&&walk(x+DX[d],y+DY[d]));
  if(!opts.length)return OPP[m.dir]||0;
  if(m.fr&&m.mode==='run')return opts[Math.random()*opts.length|0];
  const[tx,ty]=target(m);let best=opts[0],bd=1e9;
  opts.forEach(d=>{const nx=x+DX[d],ny=y+DY[d],dd=(nx-tx)**2+(ny-ty)**2;if(dd<bd){bd=dd;best=d}});
  return best}

/* ---------- runner bots: path to the best thing nearby, keep away from monsters ---------- */
const BQ=new Int32Array(N),BD=new Int16Array(N),BF=new Int8Array(N);
function botDecide(r,x,y){
  const D=DIFF[T.diff],danger=new Uint8Array(N);
  T.ms.forEach(m=>{if(m.mode!=='run'||m.fr)return;const mx=Math.round(m.x),my=Math.round(m.y),R=D.sense;
    for(let yy=my-R;yy<=my+R;yy++)for(let xx=mx-R;xx<=mx+R;xx++){if(Math.abs(xx-mx)+Math.abs(yy-my)>R||yy<0||yy>=H)continue;danger[yy*W+(xx+W)%W]=1}});
  // breadth-first search from here
  BD.fill(-1);let h=0,t=0;const s=y*W+x;BD[s]=0;BF[s]=0;BQ[t++]=s;let goal=-1,gScore=-1e9;
  const pw=r.pow>2;
  while(h<t){const k=BQ[h++],kx=k%W,ky=k/W|0,dd=BD[k];if(dd>34)break;
    if(k!==s){let v=0;const dt=T.dots[k];if(dt===1)v=10;else if(dt===2)v=14;
      T.fruits.forEach(f=>{if(f.x===kx&&f.y===ky)v=f.k?60:40});
      if(pw)T.ms.forEach(m=>{if(m.fr&&m.mode==='run'&&Math.round(m.x)===kx&&Math.round(m.y)===ky)v=50});
      if(v){const sc=v-dd*1.6;if(sc>gScore){gScore=sc;goal=k}}}
    for(let d=1;d<=4;d++){let nx=kx+DX[d],ny=ky+DY[d];if(!walk(nx,ny))continue;nx=(nx+W)%W;const nk=ny*W+nx;if(BD[nk]>=0)continue;
      if(danger[nk]&&!pw)continue;BD[nk]=dd+1;BF[nk]=k===s?d:BF[k];BQ[t++]=nk}}
  let dir=goal>=0?BF[goal]:0;
  if(!dir||Math.random()<D.bot*.5){
    // flee: the open direction that ends furthest from the closest monster
    const opts=[1,2,3,4].filter(d=>walk(x+DX[d],y+DY[d]));let best=opts[0]||0,bv=-1;
    opts.forEach(d=>{const nx=x+DX[d],ny=y+DY[d];let v=99;T.ms.forEach(m=>{if(m.mode==='run'&&!m.fr)v=Math.min(v,Math.abs(m.x-nx)+Math.abs(m.y-ny))});v+=Math.random()*.6;if(v>bv){bv=v;best=d}});
    if(!dir||danger[s])dir=best}
  return dir}

/* ---------- the authoritative step (local games, or the online host) ---------- */
function power(r){
  const f=Math.max(2,DIFF[T.diff].fr-(T.lv-1)*.4);T.fright=f;r.pow=f;r.chain=0;
  T.ms.forEach(m=>{if(m.mode==='eyes')return;m.fr=true;if(m.mode==='run'&&!m.human)m.rev=1});
  fxx('power',r)}
function addScore(pi,n){const p=T.pl[pi];if(p)p.sc=Math.max(0,p.sc+n)}
function eatTile(r,k){
  const v=T.dots[k];if(!v)return;T.dots[k]=0;T.dotsLeft--;T.lastEater=r;clearDot(k);
  if(v===2){addScore(r.pi,PTS.pel);power(r)}else{addScore(r.pi,PTS.dot);if(isMine(r))waka()}
  if(T.net&&HOST)T.eatQ.push(k)}
function eatAt(r){const x=(Math.round(r.x)+W)%W,y=Math.round(r.y);if(y<0||y>=H)return;eatTile(r,y*W+x);
  T.fruits=T.fruits.filter(f=>{if(Math.abs(f.x-r.x)<.6&&Math.abs(f.y-r.y)<.6){addScore(r.pi,PTS.fr[f.k]);fxx('fruit',r,{k:f.k,x:f.x,y:f.y});return false}return true})}
// online host: the guest's runner jumped from a to b; eat everything along the way
function eatPath(r,ax,ay,bx,by){
  const steps=Math.ceil(Math.abs(bx-ax)+Math.abs(by-ay));if(steps>6||!steps){eatAt(r);return}
  for(let i=1;i<=steps;i++){const t=i/steps;eatAt({pi:r.pi,x:ax+(bx-ax)*t,y:ay+(by-ay)*t})}
  eatAt({pi:r.pi,x:Math.round(ax),y:Math.round(by)})}

function step(dt){
  T.clock+=dt;
  if(T.state==='count'){T.stT-=dt;if(T.stT<=0){T.state='play';fxx('go')}return}
  if(T.state==='dying'){T.stT-=dt;T.rs.forEach(r=>{if(r.st==='dead')r.t-=dt});if(T.stT<=0)afterDeath();return}
  if(T.state==='clear'){T.stT-=dt;if(T.stT<=0)afterClear();return}
  if(T.state==='round'){T.stT-=dt;if(T.stT<=0){T.round++;T.lives=3;T.time=T.tLimit;newBoard(T.seed+1);T.state='count';T.stT=3.2;sendBoard()}return}
  if(T.state!=='play')return;
  T.boardT+=dt;
  if(T.tLimit){T.time-=dt;if(T.time<=0){T.time=0;return endBoard('time')}}
  if(T.fright>0){T.fright-=dt;if(T.fright<=0){T.fright=0;T.ms.forEach(m=>m.fr=false)}}
  else{T.cycT+=dt;if(T.cycT>=CYC[T.cyc]){T.cycT=0;T.cyc=Math.min(T.cyc+1,CYC.length-1);T.ms.forEach(m=>{if(m.mode==='run'&&!m.human)m.rev=1})}}
  // runners
  T.rs.forEach(r=>{
    if(r.inv>0)r.inv-=dt;if(r.pow>0)r.pow-=dt;
    if(r.st==='dead'){r.t-=dt;if(r.t<=0&&(T.mode==='versus'||T.mode==='ffa'||T.mode==='coop'))respawn(r);return}
    if(r.st==='stun'){r.t-=dt;if(r.t<=0){r.st='alive';r.inv=1.4}return}
    if(r.st==='bubble'){r.t-=dt;if(r.t<=0)popBubble(r);return}
    if(r.ctrl==='net')return;
    move(r,runSpeed(r)*dt,r.ctrl==='bot'?botDecide:null);r.mouth+=dt;eatAt(r)});
  // monsters
  T.ms.forEach(m=>{
    if(m.mode==='pen'){if(T.boardT>=m.rel)m.mode='leave';return}
    if(m.mode==='leave'){const sp=3.2*dt;if(Math.abs(m.x-10)>.02)m.x+=clamp(10-m.x,-sp,sp);else{m.x=10;m.y-=sp;if(m.y<=DOOR[1]){m.y=DOOR[1];m.mode='run';m.dir=Math.random()<.5?2:4;if(m.human)m.dir=0}}return}
    if(m.mode==='enter'){const sp=6*dt;m.y+=sp;if(m.y>=11){m.y=11;m.mode='pen';m.fr=false;m.rel=T.boardT+(m.human?1.5:.8)}return}
    if(m.human&&m.mode==='run'){if(m.ctrl==='net')return;move(m,monSpeed(m)*dt,null);return}
    move(m,monSpeed(m)*dt,decideMon);
    if(m.mode==='eyes'&&Math.abs(m.x-DOOR[0])<.05&&Math.abs(m.y-DOOR[1])<.05){m.x=10;m.y=7;m.mode='enter'}});
  // fruit
  T.fnext-=dt;
  if(T.fnext<=0){T.fnext=11+Math.random()*8;if(T.fruits.length<2)spawnFruit()}
  T.fruits.forEach(f=>f.t-=dt);T.fruits=T.fruits.filter(f=>f.t>0);
  collide();
  if(T.dotsLeft<=0&&T.state==='play')endBoard('clear');
}
function spawnFruit(){
  for(let tries=0;tries<60;tries++){const x=1+Math.random()*(W-2)|0,y=1+Math.random()*(H-2)|0;
    if(tile(x,y)!==0||y===T.ty&&(x<4||x>W-5))continue;
    if(T.rs.some(r=>Math.abs(r.x-x)+Math.abs(r.y-y)<5))continue;if(T.fruits.some(f=>f.x===x&&f.y===y))continue;
    const k=Math.random()<.32?1:0;T.fruits.push({x,y,k,t:12,id:++T.fid});fxx('fspawn',null,{x,y,k});return}}
function collide(){
  T.rs.forEach(r=>{if(r.st!=='alive')return;
    T.ms.forEach(m=>{if(m.mode!=='run'||dist2(r,m)>.42)return;
      if(m.fr){m.fr=false;m.mode='eyes';const p=PTS.mon[Math.min(3,r.chain++)]*(m.human?2:1);addScore(r.pi,p);fxx('mon',r,{p,x:m.x,y:m.y});
        if(m.human){m.want=0}}
      else if(r.inv<=0)caught(r)})});
  if(T.mode==='coop')T.rs.forEach(a=>{if(a.st!=='alive')return;T.rs.forEach(b=>{if(b.st==='bubble'&&dist2(a,b)<.7){b.st='alive';b.inv=2;fxx('free',b)}})});
  if(T.mode==='versus'||T.mode==='ffa')T.rs.forEach(a=>{if(a.st!=='alive'||a.pow<=0)return;T.rs.forEach(b=>{
    if(b===a||b.st!=='alive'||b.pow>0||b.inv>0||dist2(a,b)>.5)return;
    const s=Math.min(PTS.steal,T.pl[b.pi].sc);addScore(b.pi,-s);addScore(a.pi,s);b.st='stun';b.t=1.8;fxx('steal',b,{p:s,by:a.pi})})});
}
function caught(r){
  fxx('caught',r);
  if(T.mode==='coop'){r.st='bubble';r.t=7;r.dir=0;
    if(!T.rs.some(o=>o.st==='alive')){T.rs.forEach(o=>{o.st='dead';o.t=1.4});T.lives--;T.state='dying';T.stT=1.8}
    return}
  r.st='dead';r.t=1.4;r.dir=0;r.pow=0;
  if(T.mode==='versus'||T.mode==='ffa'){r.t=2.2;addScore(r.pi,-PTS.caught);return}
  T.lives--;T.state='dying';T.stT=1.8;
}
function popBubble(r){r.st='dead';r.t=1.4;T.lives--;fxx('pop',r);if(T.lives<=0){T.state='dying';T.stT=1.6}}
function respawn(r){
  if(T.mode==='coop'&&T.lives<=0)return;
  // pick the start spot furthest from any monster
  const S=T.mode==='ffa'?STARTS.four:startsFor();let best=[r.sx,r.sy],bv=-1;
  S.forEach(([x,y])=>{const v=Math.min(...T.ms.map(m=>m.mode==='run'&&!m.fr?Math.abs(m.x-x)+Math.abs(m.y-y):99));if(v>bv){bv=v;best=[x,y]}});
  r.x=r.rx=best[0];r.y=r.ry=best[1];r.dir=r.want=0;r.st='alive';r.inv=2.2;r.pow=0;r.lid++}
function afterDeath(){
  if(T.lives<=0){
    if(T.mode==='hunter')return roundEnd();
    return finish()}
  resetPositions();T.state='count';T.stT=2.2}
function endBoard(why){
  if(T.mode==='versus'||T.mode==='ffa'){if(why==='time')return finish(why);
    const last=T.lastEater;if(last)addScore(last.pi,PTS.clear/2);fxx('cleared');T.state='clear';T.stT=2;return}
  if(T.mode==='hunter'){if(why==='clear'){const r=T.rs[0];addScore(r.pi,2000+Math.round(T.time)*10);fxx('cleared',r)}return roundEnd(why)}
  // solo / co-op: next maze
  T.rs.forEach(r=>{if(r.st==='alive')addScore(r.pi,PTS.clear)});fxx('cleared');T.state='clear';T.stT=2.4}
function afterClear(){T.lv++;if(T.lv%2===1&&T.lives)T.lives=Math.min(T.lives+1,6);newBoard(T.seed+1);T.state='count';T.stT=2.6;sendBoard()}
function roundEnd(){
  if(T.round===0){T.state='round';T.stT=3;fxx('swap');return}
  finish()}
function finish(){
  T.state='over';const P=T.pl;let title,sub;
  const rows=P.map((p,i)=>({p,i})).sort((a,b)=>b.p.sc-a.p.sc);
  const tab=resTable(rows);
  if(T.mode==='solo'){const b=+(store('mzBest')||0),best=Math.max(b,P[0].sc);store('mzBest',best);
    title='GAME OVER';sub=`Score <b>${P[0].sc.toLocaleString()}</b> · reached maze ${T.lv}<br>${P[0].sc>b&&b?'New best!':'Best: '+best.toLocaleString()}`}
  else if(T.mode==='coop'){const tot=P.reduce((a,p)=>a+p.sc,0);title='GAME OVER';sub=`Team score <b>${tot.toLocaleString()}</b> · reached maze ${T.lv}${tab}`}
  else{const top=rows[0].p,tie=rows[1]&&rows[1].p.sc===top.sc;
    const mine=T.net?P.find(p=>p.host===HOST):!T.local2?P[0]:null;
    title=tie?'DRAW!':mine?(top===mine?'YOU WIN!':'YOU LOSE!'):`${top.name.toUpperCase()} WINS!`;
    sub=(T.mode==='hunter'?'Best runner wins.':'')+tab}
  T.ending={title,sub};
  if(T.net&&HOST)NET.ev({e:'mzend',g:myG,t:title,sc:P.map(p=>p.sc)});
  setTimeout(()=>{if(T.state==='over')showEnd()},900);
}
function resTable(rows){return`<div class="mzres">${rows.map(({p,i},n)=>`<div class="${(T.net?p.host===HOST:!T.local2&&i===0)?'me':''}"><span>${n+1}</span><i style="background:${p.col}"></i><b>${esc(p.name)}</b><em>${p.sc.toLocaleString()}</em></div>`).join('')}</div>`}
function showEnd(){const e=T.ending;if(!e||T.endShown)return;T.endShown=true;let t=e.title;
  if(T.net&&!HOST){const mine=T.pl.find(p=>p.host===HOST),top=[...T.pl].sort((a,b)=>b.sc-a.sc)[0];if(T.mode!=='coop')t=t==='DRAW!'?t:top===mine?'YOU WIN!':'YOU LOSE!'}
  setOver(t,e.sub,T.net?null:'Play again!');(t==='YOU LOSE!'||t==='GAME OVER'?jingle(0):jingle(1))}

/* ---------- little effects (and the matching sounds) ---------- */
let wk=0;function waka(){wk^=1;try{if(!ctx()||!sOn)return;tone(wk?79:72,AC.currentTime+.005,.05,'triangle',.05,SG,{to:wk?74:79})}catch(e){}}
const isMine=e=>e&&(e.ctrl==='k'||e.ctrl==='k1'||e.ctrl==='k2');
function pop(x,y,txt,col){T.pops.push({x,y,txt,col,t:0})}
function burst(x,y,col,n=12,sp=4){for(let i=0;i<n;i++){const a=Math.random()*Math.PI*2,v=sp*(.4+Math.random()*.8);T.fx.push({x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,t:0,life:.5+Math.random()*.35,col,r:.06+Math.random()*.06})}}
function fxx(k,r,o={}){
  if(T.net&&HOST&&k!=='go')NET.ev({e:'mzx',g:myG,k,i:r?T.rs.indexOf(r):-1,o});
  playFx(k,r,o)}
function playFx(k,r,o){
  const c=r?T.pl[r.pi]&&T.pl[r.pi].col:'#fff';
  switch(k){
    case'go':SFX.go();break;
    case'power':SFX.chime();if(r)burst(r.x,r.y,'#fff3c4',16,5);break;
    case'fruit':SFX.coin();pop(o.x,o.y,'+'+PTS.fr[o.k],o.k?'#7be36a':'#ff5a6e');burst(o.x,o.y,o.k?'#ff4d5e':'#ff5a6e',18,5);burst(o.x,o.y,'#7be36a',8,3);break;
    case'fspawn':SFX.pop();burst(o.x,o.y,'#ffffff',10,3);break;
    case'mon':SFX.star();pop(o.x,o.y,'+'+o.p,'#9ad7ff');burst(o.x,o.y,'#9ad7ff',14,5);break;
    case'caught':SFX.ko();if(r)burst(r.x,r.y,c,22,6);T.shake=.35;break;
    case'pop':SFX.wrong();break;
    case'free':SFX.correct();if(r){burst(r.x,r.y,'#bfe9ff',14,4);pop(r.x,r.y,'FREE!','#bfe9ff')}break;
    case'steal':SFX.punch();if(r){burst(r.x,r.y,'#ffe14d',12,5);pop(r.x,r.y,'−'+o.p,'#ff6b6b')}break;
    case'cleared':SFX.bell();break;
    case'swap':SFX.whoosh();break;
  }}

/* ---------- drawing ---------- */
const cv=$('#mzcv'),cx=cv.getContext('2d');
let V={w:0,h:0,ts:20,ox:0,oy:0,dpr:1};
const wallCv=document.createElement('canvas'),dotCv=document.createElement('canvas'),SPR={};
function layout(){
  const st=$('#mzstage').getBoundingClientRect();if(!st.width)return;
  const dpr=Math.min(2,devicePixelRatio||1);
  if(cv.width!==Math.round(st.width*dpr)||cv.height!==Math.round(st.height*dpr)){cv.width=Math.round(st.width*dpr);cv.height=Math.round(st.height*dpr)}
  const hud=$('#mzhud').getBoundingClientRect(),land=st.width>st.height*1.15;
  const top=land?12:Math.max(12,hud.bottom-st.top+10),pad=st.width<500?5:10,sideL=land?Math.min(250,hud.width+24):pad,sideR=land?pad:pad;
  const aw=st.width-sideL-sideR,ah=st.height-top-pad-(land?0:8);
  const ts=Math.max(8,Math.min(aw/W,ah/H));
  const ow=V.ts!==ts||V.dpr!==dpr;
  V={w:st.width,h:st.height,ts,dpr,ox:sideL+(aw-W*ts)/2,oy:top+(ah-H*ts)/2,land};
  if(ow&&T.g)prerender();
}
function prerender(){
  if(!T.g)return;const ts=V.ts,dpr=V.dpr,w=Math.ceil(W*ts*dpr)+2,h=Math.ceil(H*ts*dpr)+2;
  wallCv.width=dotCv.width=w;wallCv.height=dotCv.height=h;
  const c=wallCv.getContext('2d');c.setTransform(dpr,0,0,dpr,0,0);c.clearRect(0,0,W*ts,H*ts);
  drawWalls(c,ts,T.g,PAL[T.pal||0]);
  // the pen door
  c.fillStyle='#ff9ab6';c.fillRect(9.55*ts,8.42*ts,.9*ts,.16*ts);
  redrawDots();
  // sprites at this size
  SPR.fr=[0,1].map(k=>sprite(ts*1.05,(g,s)=>k?drawMelon(g,s):drawBerry(g,s)));
}
// rounded neon walls (also used for the cover art)
function drawWalls(c,ts,g,pal){
  const [a,b]=pal,wl=(x,y)=>x>=0&&x<W&&y>=0&&y<H&&g[y*W+x]===1;
  const blob=(ins,rad)=>{c.beginPath();const i=ins*ts,r=rad*ts;
    for(let y=0;y<H;y++)for(let x=0;x<W;x++){if(!wl(x,y))continue;const X=x*ts,Y=y*ts;
      const L=wl(x-1,y),Rr=wl(x+1,y),U=wl(x,y-1),D=wl(x,y+1);
      // a square in the middle of each wall tile (only its open corners rounded) + bridges to wall neighbours
      const rad4=[!L&&!U?r:0,!Rr&&!U?r:0,!Rr&&!D?r:0,!L&&!D?r:0];
      if(c.roundRect)c.roundRect(X+i,Y+i,ts-2*i,ts-2*i,rad4);else c.rect(X+i,Y+i,ts-2*i,ts-2*i);
      if(Rr)c.rect(X+ts-i-.5,Y+i,2*i+1,ts-2*i);
      if(D)c.rect(X+i,Y+ts-i-.5,ts-2*i,2*i+1);
      if(Rr&&D&&wl(x+1,y+1))c.rect(X+ts-i-.5,Y+ts-i-.5,2*i+1,2*i+1)}
    c.fill()};
  // soft glow, bright rim, dark core, then a thin highlight line: rounded neon walls
  c.save();c.shadowColor=a;c.shadowBlur=ts*.7;c.fillStyle=a;c.globalAlpha=.55;blob(.14,.36);c.restore();
  c.fillStyle=a;blob(.14,.36);
  c.fillStyle='#0c0e1c';blob(.25,.25);
  c.globalAlpha=.22;c.fillStyle=b;blob(.33,.18);c.globalAlpha=1;c.fillStyle='#0c0e1c';blob(.37,.14);
}
function redrawDots(){const c=dotCv.getContext('2d'),ts=V.ts;c.setTransform(V.dpr,0,0,V.dpr,0,0);c.clearRect(0,0,W*ts+2,H*ts+2);
  c.fillStyle='#ffe9c4';c.beginPath();for(let k=0;k<N;k++)if(T.dots[k]===1){const x=k%W,y=k/W|0;c.moveTo((x+.5)*ts+ts*.1,(y+.5)*ts);c.arc((x+.5)*ts,(y+.5)*ts,ts*.1,0,7)}c.fill()}
function clearDot(k){const c=dotCv.getContext('2d'),ts=V.ts,x=k%W,y=k/W|0;c.clearRect(x*ts,y*ts,ts,ts)}
function sprite(size,draw){const s=Math.ceil(size*V.dpr),c=document.createElement('canvas');c.width=c.height=s;draw(c.getContext('2d'),s);return c}
// a ripe strawberry: red heart-shaped berry, golden seeds, a green leafy cap
function drawBerry(g,s){const k=s/100;g.save();g.scale(k,k);
  g.fillStyle='rgba(0,0,0,.28)';g.beginPath();g.ellipse(52,92,26,6,0,0,7);g.fill();
  const gr=g.createRadialGradient(38,40,4,50,55,52);gr.addColorStop(0,'#ff8a8f');gr.addColorStop(.45,'#f2263c');gr.addColorStop(1,'#a50d22');
  g.fillStyle=gr;g.beginPath();g.moveTo(50,94);g.bezierCurveTo(26,84,9,62,13,42);g.bezierCurveTo(16,27,32,23,50,29);g.bezierCurveTo(68,23,84,27,87,42);g.bezierCurveTo(91,62,74,84,50,94);g.fill();
  g.strokeStyle='rgba(90,0,12,.55)';g.lineWidth=2;g.stroke();
  g.fillStyle='#ffe07a';[[30,44],[44,40],[58,40],[71,45],[24,58],[38,55],[52,54],[66,56],[78,58],[32,70],[46,68],[60,69],[72,70],[42,81],[56,81]].forEach(([x,y])=>{g.beginPath();g.ellipse(x,y,1.8,3,0,0,7);g.fill()});
  g.fillStyle='rgba(255,255,255,.45)';g.beginPath();g.ellipse(32,42,6,10,-.5,0,7);g.fill();
  g.fillStyle='#2fae4a';g.strokeStyle='#17702c';g.lineWidth=1.6;
  for(let i=0;i<5;i++){g.save();g.translate(50,28);g.rotate(-1.25+i*.62);g.beginPath();g.moveTo(0,0);g.quadraticCurveTo(7,-3,17,0);g.quadraticCurveTo(7,4,0,0);g.fill();g.stroke();g.restore()}
  g.fillStyle='#3cc35a';g.beginPath();g.ellipse(50,27,9,5,0,0,7);g.fill();
  g.strokeStyle='#2a8a3a';g.lineWidth=4;g.lineCap='round';g.beginPath();g.moveTo(50,26);g.quadraticCurveTo(52,14,58,9);g.stroke();g.restore()}
// a juicy watermelon slice: striped green rind, pale band, red flesh with black seeds
function drawMelon(g,s){const k=s/100;g.save();g.scale(k,k);
  g.fillStyle='rgba(0,0,0,.28)';g.beginPath();g.ellipse(50,90,32,6,0,0,7);g.fill();
  g.translate(50,34);g.rotate(-.12);
  g.fillStyle='#1f7a34';g.beginPath();g.arc(0,0,46,0,Math.PI);g.closePath();g.fill();
  g.strokeStyle='#145a26';g.lineWidth=4;for(let i=1;i<6;i++){const a=i/6*Math.PI;g.beginPath();g.moveTo(Math.cos(a)*40,Math.sin(a)*40);g.lineTo(Math.cos(a)*46,Math.sin(a)*46);g.stroke()}
  g.fillStyle='#d9f7a3';g.beginPath();g.arc(0,0,39,0,Math.PI);g.closePath();g.fill();
  const gr=g.createRadialGradient(0,-4,4,0,0,36);gr.addColorStop(0,'#ff7b84');gr.addColorStop(1,'#e8233a');
  g.fillStyle=gr;g.beginPath();g.arc(0,0,35,0,Math.PI);g.closePath();g.fill();
  g.fillStyle='rgba(255,255,255,.35)';g.fillRect(-35,-1.5,70,3);
  g.fillStyle='#1b1215';[[-20,9,-.4],[-6,13,-.1],[8,12,.15],[21,8,.45],[-12,22,-.25],[3,25,0],[16,20,.3]].forEach(([x,y,a])=>{g.save();g.translate(x,y);g.rotate(a);g.beginPath();g.ellipse(0,0,2.2,3.8,0,0,7);g.fill();g.fillStyle='rgba(255,255,255,.4)';g.beginPath();g.ellipse(-.6,-1.2,.7,1.2,0,0,7);g.fill();g.fillStyle='#1b1215';g.restore()});
  g.restore()}

function wrapLerp(a,b,t){let d=b-a;if(d>W/2)d-=W;else if(d<-W/2)d+=W;let v=a+d*t;if(v<-.5)v+=W;else if(v>W-.5)v-=W;return v}
function render(now){
  const c=cx,ts=V.ts,dpr=V.dpr;c.setTransform(1,0,0,1,0,0);c.clearRect(0,0,cv.width,cv.height);
  if(!T.g)return;
  let sx=0,sy=0;if(T.shake>0){sx=(Math.random()-.5)*ts*.5*T.shake;sy=(Math.random()-.5)*ts*.5*T.shake}
  c.setTransform(dpr,0,0,dpr,(V.ox+sx)*dpr,(V.oy+sy)*dpr);
  c.drawImage(wallCv,0,0,wallCv.width/dpr,wallCv.height/dpr);
  c.drawImage(dotCv,0,0,dotCv.width/dpr,dotCv.height/dpr);
  const P=(v)=>(v+.5)*ts,t=T.clock;
  // power orbs
  T.pellets.forEach(k=>{if(T.dots[k]!==2)return;const x=P(k%W),y=P(k/W|0),p=.85+Math.sin(t*6)*.15;
    c.fillStyle='rgba(255,235,190,.18)';c.beginPath();c.arc(x,y,ts*.48*p,0,7);c.fill();c.fillStyle='#fff1cf';c.beginPath();c.arc(x,y,ts*.27*p,0,7);c.fill()});
  // fruit (blinks before it goes)
  T.fruits.forEach(f=>{if(f.t<3&&Math.sin(t*14)<0)return;const s=SPR.fr&&SPR.fr[f.k];if(!s)return;const b=Math.sin(t*3+f.id)*ts*.06,z=ts*1.05;c.drawImage(s,P(f.x)-z/2,P(f.y)-z/2+b,z,z)});
  // monsters, then runners on top
  T.ms.forEach(m=>drawMon(c,m,P(m.rx),P(m.ry),ts,t));
  T.rs.forEach(r=>drawRunner(c,r,P(r.rx),P(r.ry),ts,t));
  // sparks and points
  T.fx.forEach(p=>{const a=1-p.t/p.life;c.globalAlpha=a;c.fillStyle=p.col;c.beginPath();c.arc(P(p.x),P(p.y),ts*p.r*(.5+a*.5),0,7);c.fill()});c.globalAlpha=1;
  c.textAlign='center';c.font=`700 ${Math.round(ts*.62)}px 'Space Grotesk',Inter,sans-serif`;
  T.pops.forEach(p=>{const a=1-p.t/1.1;c.globalAlpha=Math.max(0,a);c.lineWidth=ts*.14;c.strokeStyle='rgba(8,9,20,.8)';const y=P(p.y)-p.t*ts*1.1;c.strokeText(p.txt,P(p.x),y);c.fillStyle=p.col;c.fillText(p.txt,P(p.x),y)});c.globalAlpha=1;
}
function drawRunner(c,r,x,y,ts,t){
  const p=T.pl[r.pi]||{col:'#fff'},R=ts*.43;
  if(r.st==='dead'){const k=clamp(1-(r.t-.4),0,1);if(k>=1)return;c.save();c.translate(x,y);c.rotate(k*6);c.scale(1-k,1-k);c.fillStyle=p.col;c.beginPath();c.arc(0,0,R,0,7);c.fill();c.restore();return}
  if(r.inv>0&&r.st==='alive'&&Math.sin(t*22)<-.2)c.globalAlpha=.35;
  c.save();c.translate(x,y);
  if(r.pow>0){c.fillStyle='rgba(255,214,120,.28)';c.beginPath();c.arc(0,0,R*1.45+Math.sin(t*10)*R*.1,0,7);c.fill()}
  // body
  const gr=c.createRadialGradient(-R*.35,-R*.4,R*.1,0,0,R*1.1);gr.addColorStop(0,'#fff');gr.addColorStop(.25,p.col);gr.addColorStop(1,shade(p.col,-.35));
  c.fillStyle=gr;c.beginPath();c.arc(0,0,R,0,7);c.fill();
  // leafy tuft on top
  c.fillStyle=shade(p.col,-.25);c.beginPath();c.ellipse(-R*.18,-R*.98,R*.18,R*.32,-.5,0,7);c.ellipse(R*.16,-R*1.02,R*.15,R*.28,.45,0,7);c.fill();
  // face looks where it is going
  const d=r.dir||r.face||3;r.face=d;const fx=DX[d]*R*.32,fy=DY[d]*R*.3;
  const ch=(Math.sin(r.mouth*20)+1)/2,moving=r.dir&&r.st==='alive';
  c.fillStyle='#fff';c.beginPath();c.ellipse(fx-R*.3,fy-R*.22,R*.2,R*.24,0,0,7);c.ellipse(fx+R*.3,fy-R*.22,R*.2,R*.24,0,0,7);c.fill();
  c.fillStyle='#15161a';c.beginPath();c.arc(fx-R*.3+DX[d]*R*.07,fy-R*.2+DY[d]*R*.07,R*.11,0,7);c.arc(fx+R*.3+DX[d]*R*.07,fy-R*.2+DY[d]*R*.07,R*.11,0,7);c.fill();
  c.fillStyle='#3a0c18';c.beginPath();c.ellipse(fx,fy+R*.3,R*(.24+.06*ch),R*(moving?.06+.2*ch:.08),0,0,7);c.fill();
  if(r.st==='stun'){c.fillStyle='#ffe14d';for(let i=0;i<3;i++){const a=t*6+i*2.1;c.beginPath();c.arc(Math.cos(a)*R*.9,-R*1.1+Math.sin(a)*R*.25,R*.13,0,7);c.fill()}}
  c.restore();c.globalAlpha=1;
  if(r.st==='bubble'){const w=1+Math.sin(t*5)*.05;c.strokeStyle='rgba(190,233,255,.95)';c.lineWidth=ts*.07;c.fillStyle='rgba(150,210,255,.22)';c.beginPath();c.ellipse(x,y,R*1.45*w,R*1.45/w,0,0,7);c.fill();c.stroke();
    c.fillStyle='rgba(255,255,255,.7)';c.beginPath();c.ellipse(x-R*.6,y-R*.7,R*.22,R*.12,-.7,0,7);c.fill();
    c.fillStyle='#fff';c.font=`700 ${Math.round(ts*.45)}px Inter,sans-serif`;c.textAlign='center';c.fillText(Math.ceil(r.t),x,y-R*1.65)}
  if(T.rs.length>1||T.mode==='hunter'){c.font=`600 ${Math.max(10,Math.round(ts*.42))}px Inter,sans-serif`;c.textAlign='center';c.fillStyle='rgba(255,255,255,.85)';c.fillText(p.name,x,y+R+ts*.48)}
}
function drawMon(c,m,x,y,ts,t){
  const R=ts*.45;
  if(m.mode==='pen'||m.mode==='enter')y+=Math.sin(t*4+m.bob)*ts*.12;
  const d=m.dir||3;
  if(m.mode!=='eyes'){
    const flash=m.fr&&T.fright<2&&Math.sin(t*16)>0;
    const col=m.fr?(flash?'#f1f3ff':'#3d4dff'):MC[m.k%4];
    c.save();c.translate(x,y);
    // horns
    if(!m.fr){c.fillStyle=shade(col,-.3);c.beginPath();c.moveTo(-R*.62,-R*.55);c.lineTo(-R*.82,-R*1.15);c.lineTo(-R*.3,-R*.82);c.moveTo(R*.62,-R*.55);c.lineTo(R*.82,-R*1.15);c.lineTo(R*.3,-R*.82);c.fill()}
    // a jelly dome with wobbly drips
    const gr=c.createLinearGradient(0,-R,0,R);gr.addColorStop(0,shade(col,.25));gr.addColorStop(1,shade(col,-.2));c.fillStyle=gr;
    c.beginPath();c.moveTo(-R,R*.1);c.arc(0,-R*.05,R,Math.PI,0);c.lineTo(R,R*.62);
    const ph=t*9+m.bob;for(let i=0;i<=6;i++){const xx=R-(i/6)*2*R,yy=R*.62+Math.sin(ph+i*1.6)*R*.16+(i%2?R*.22:0);c.lineTo(xx,yy)}
    c.closePath();c.fill();
    if(m.human){c.strokeStyle=(T.pl[m.pi]||{col:'#fff'}).col;c.lineWidth=ts*.08;c.stroke()}
    c.fillStyle='rgba(255,255,255,.28)';c.beginPath();c.ellipse(-R*.42,-R*.45,R*.18,R*.28,-.4,0,7);c.fill();
    if(m.fr){c.fillStyle=flash?'#ff4d5e':'#fff';c.beginPath();c.arc(-R*.3,-R*.18,R*.12,0,7);c.arc(R*.3,-R*.18,R*.12,0,7);c.fill();
      c.strokeStyle=flash?'#ff4d5e':'#fff';c.lineWidth=ts*.06;c.beginPath();for(let i=0;i<=6;i++){const xx=-R*.5+i*R/6,yy=R*.28+(i%2?-1:1)*R*.08;i?c.lineTo(xx,yy):c.moveTo(xx,yy)}c.stroke();c.restore();
      if(m.human)crown(c,x,y-R*1.35,ts);return}
    c.restore()}
  // eyes (all that's left after being eaten)
  const ex=DX[d]*R*.18,ey=DY[d]*R*.16;
  c.fillStyle='#fff';c.beginPath();c.ellipse(x-R*.34+ex,y-R*.2+ey,R*.26,R*.31,0,0,7);c.ellipse(x+R*.34+ex,y-R*.2+ey,R*.26,R*.31,0,0,7);c.fill();
  c.fillStyle='#1d2bff';c.beginPath();c.arc(x-R*.34+ex+DX[d]*R*.12,y-R*.2+ey+DY[d]*R*.13,R*.13,0,7);c.arc(x+R*.34+ex+DX[d]*R*.12,y-R*.2+ey+DY[d]*R*.13,R*.13,0,7);c.fill();
  if(m.human&&m.mode!=='eyes')crown(c,x,y-R*1.35,ts);
}
function crown(c,x,y,ts){const s=ts*.32;c.fillStyle='#ffd23f';c.beginPath();c.moveTo(x-s,y+s*.5);c.lineTo(x-s,y-s*.3);c.lineTo(x-s*.5,y+s*.1);c.lineTo(x,y-s*.6);c.lineTo(x+s*.5,y+s*.1);c.lineTo(x+s,y-s*.3);c.lineTo(x+s,y+s*.5);c.closePath();c.fill()}
function shade(hex,k){const n=parseInt(hex.slice(1),16);let r=n>>16,g=n>>8&255,b=n&255;const f=k<0?0:255,a=Math.abs(k);r=Math.round(r+(f-r)*a);g=Math.round(g+(f-g)*a);b=Math.round(b+(f-b)*a);return'#'+((1<<24)|(r<<16)|(g<<8)|b).toString(16).slice(1)}

/* ---------- HUD ---------- */
function hud(){
  const P=T.pl,tm=T.tLimit?fmt(Math.ceil(T.time)):'',lv=T.mode==='hunter'?`Round ${T.round+1} of 2`:T.tLimit?'':`Maze ${T.lv}`;
  const lives=T.mode==='solo'||T.mode==='coop'||T.mode==='hunter'?Math.max(0,T.lives):-1;
  const run=T.mode==='hunter'&&T.rs[0]?T.rs[0].pi:-1;
  const key=P.map(p=>p.sc+p.name).join()+tm+lv+lives+run;if(key===T.hudKey)return;T.hudKey=key;
  const heart='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-7.5-4.6-9.6-9.3C.9 8.2 3.2 4.5 6.9 4.5c2.1 0 3.6 1.2 5.1 3 1.5-1.8 3-3 5.1-3 3.7 0 6 3.7 4.5 7.2C19.5 16.4 12 21 12 21z" fill="currentColor"/></svg>';
  $('#mzhud').innerHTML=`<div class="mzh-c">${lv?`<span class="lv">${lv}</span>`:''}${tm?`<span class="tm">${tm}</span>`:''}${lives>=0?`<span class="lives" aria-label="${lives} lives">${heart.repeat(Math.min(lives,6))}</span>`:''}</div>
   <div class="mzh-p">${P.map((p,i)=>`<div class="mzp${T.mode==='hunter'?(i===run?' run':' hunt'):''}"><i style="background:${p.col}"></i><b>${esc(p.name)}</b><em>${p.sc.toLocaleString()}</em>${T.mode==='hunter'?`<small>${i===run?'Runner':'Monster'}</small>`:''}</div>`).join('')}</div>`}
let msgK='';
function msg(){
  let h='';
  if(T.state==='count'){const n=Math.ceil(T.stT/.75);h=`<b class="big n">${Math.min(3,n)}</b>`;
    if(n!==T.cdn){T.cdn=n;if(n<=3&&n>0)SFX.count()}
    if(T.stT>2.25)h=`<b class="big">${T.mode==='hunter'?(T.me&&T.me.kind==='m'?'Hunt!':'Run!'):T.lv>1&&T.mode!=='versus'&&T.mode!=='ffa'?'Maze '+T.lv:'Ready?'}</b>`+(T.mode==='hunter'&&T.me?`<small>${T.me.kind==='m'?'You are the monster this round. Catch the runner!':'You are the runner. Eat dots, dodge the monster.'}</small>`:'')}
  else if(T.state==='clear')h='<b class="big go">Maze clear!</b><small>'+(T.tLimit?'A fresh maze is coming. The clock keeps running.':'+'+PTS.clear+' bonus')+'</small>';
  else if(T.state==='round')h='<b class="big">Swap!</b><small>The runner becomes the monster.</small>';
  else if(T.state==='wait')h=`<b class="mid">${T.waitMsg||'Waiting…'}</b>`;
  if(T.state==='play'&&T.boardT<.7&&T.boardT>0)h='<b class="big go">GO!</b>';
  if(h!==msgK){msgK=h;$('#mzmsg').innerHTML=h?`<div>${h}</div>`:''}}

/* ---------- controls ---------- */
const KEYS={KeyW:['k1',1],KeyD:['k1',2],KeyS:['k1',3],KeyA:['k1',4],ArrowUp:['k2',1],ArrowRight:['k2',2],ArrowDown:['k2',3],ArrowLeft:['k2',4]};
const mine=()=>[...T.rs,...T.ms].filter(isMine);
addEventListener('keydown',e=>{if(!T.run||$('#mzgame').hidden)return;
  if((e.code==='KeyP'||e.code==='Escape')&&!T.net){setPause(!T.paused);e.preventDefault();return}
  const k=KEYS[e.code];if(!k)return;e.preventDefault();
  mine().forEach(m=>{if(m.ctrl==='k'||m.ctrl===k[0])m.want=k[1]})});
const sw=new Map();
$('#mzstage').addEventListener('pointerdown',e=>{if(e.target.closest('button'))return;sw.set(e.pointerId,{x:e.clientX,y:e.clientY})});
$('#mzstage').addEventListener('pointermove',e=>{const s=sw.get(e.pointerId);if(!s)return;const dx=e.clientX-s.x,dy=e.clientY-s.y;if(Math.hypot(dx,dy)<16)return;
  const d=Math.abs(dx)>Math.abs(dy)?(dx>0?2:4):(dy>0?3:1);s.x=e.clientX;s.y=e.clientY;
  const ms=mine();const tgt=ms.length>1?ms.find(m=>m.ctrl===(e.clientX<V.w/2?'k1':'k2')):ms[0];if(tgt)tgt.want=d});
['pointerup','pointercancel'].forEach(n=>$('#mzstage').addEventListener(n,e=>sw.delete(e.pointerId)));

/* ---------- main loop ---------- */
function frame(now){
  T.raf=requestAnimationFrame(frame);
  const dt=Math.min(.05,(now-(T.last||now))/1000);T.last=now;
  if(!T.paused){
    if(!T.net||HOST){T.acc+=dt;while(T.acc>=1/120){step(1/120);T.acc-=1/120}}
    else guestStep(dt,now);
    // effects
    T.fx.forEach(p=>{p.t+=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vx*=.92;p.vy*=.92});T.fx=T.fx.filter(p=>p.t<p.life);
    T.pops.forEach(p=>p.t+=dt);T.pops=T.pops.filter(p=>p.t<1.1);if(T.shake>0)T.shake-=dt;
  }
  // smooth drawing positions (other people's characters arrive in packets)
  [...T.rs,...T.ms].forEach(e=>{if(e.ctrl==='net'&&(e.kind==='m'?e.mode==='run':e.st==='alive')){const k=1-Math.exp(-dt/.045);e.rx=wrapLerp(e.rx,e.x,k);e.ry+=(e.y-e.ry)*k}else if(!e._ip){e.rx=e.x;e.ry=e.y}});
  if(T.net&&HOST)hostNet(now);
  render(now);hud();msg();
}
function setPause(p){if(T.net||T.state==='over')return;T.paused=p;$('#mzpm').hidden=!p;SFX.ui()}

/* ---------- online ---------- */
const q2=v=>Math.round(v*100)/100;
function hostNet(now){
  if(now-T.sendT>=50){T.sendT=now;
    NET.sendFast({f:1,g:myG,b:T.bid,s:STCODE.indexOf(T.state),st:q2(T.stT),tm:q2(T.time),fr:q2(T.fright),lv:T.lv,li:T.lives,rd:T.round,
      sc:T.pl.map(p=>p.sc),
      r:T.rs.map(r=>[q2(r.x),q2(r.y),r.dir,SCODE.indexOf(r.st),q2(r.t),r.inv>0?1:0,r.pow>0?1:0,r.lid,r.pi]),
      m:T.ms.map(m=>[q2(m.x),q2(m.y),m.dir,MCODE.indexOf(m.mode),m.fr?1:0,m.lid]),
      fu:T.fruits.map(f=>[f.x,f.y,f.k,q2(f.t),f.id])})}
  if(T.eatQ.length&&now-T.eatT>90){T.eatT=now;NET.ev({e:'mzd',g:myG,b:T.bid,k:T.eatQ.splice(0)})}
  if(now-T.dotT>2500){T.dotT=now;NET.ev({e:'mzD',g:myG,b:T.bid,s:dotStr()})}
}
const dotStr=()=>Array.from(T.dots,v=>v).join('');
function sendBoard(){if(!T.net||!HOST)return;NET.ev(boardMsg());pub()}
const boardMsg=()=>({e:'mzb',g:myG,b:T.bid,seed:T.seed,lv:T.lv,rd:T.round,mode:T.mode,df:T.diff,pl:T.pl.map(p=>[p.name,p.col,p.bot?1:0,p.host?1:0,p.sc])});
function applyBoard(d){
  T.mode=MODES[d.mode]?d.mode:'versus';T.diff=clamp(+d.df|0,0,2);T.lv=+d.lv||1;T.round=+d.rd||0;
  T.pl=(d.pl||[]).map(([name,col,bot,host,sc])=>({name:String(name).slice(0,12),col:String(col),bot:!!bot,host:!!host,sc:+sc||0}));
  T.bid=(+d.b||1)-1;newBoard(+d.seed||1);T.bid=+d.b;T.state='count';T.stT=3;T.snaps=[];T.ending=null;T.endShown=false;$('#over').hidden=true;T.waitRe=false}
// guest: move my own character, show everyone else from the host's snapshots
function guestStep(dt,now){
  T.clock+=dt;
  const s=T.snaps[T.snaps.length-1];if(!s||!T.g)return;
  const e=T.me;
  if(e&&T.state==='play'){
    const ok=e.kind==='r'?e.st==='alive':e.mode==='run';
    if(ok){const sp=e.kind==='r'?runSpeed(e):monSpeed(e);const ox=e.x,oy=e.y;move(e,sp*dt,null);e.mouth+=dt;
      if(e.kind==='r'){const k=((Math.round(e.y))*W+(Math.round(e.x)+W)%W);if(T.dots[k]){if(T.dots[k]===1)waka();T.dots[k]=0;clearDot(k)}}
      if(now-T.sendT>=33||e.dir!==T.lastDir){T.sendT=now;T.lastDir=e.dir;NET.sendFast({f:1,g:myG,b:T.bid,l:e.lid,x:q2(e.x),y:q2(e.y),d:e.dir})}}}
  // interpolate the rest ~100 ms in the past
  const delay=NET.fastOK()?100:260,rt=now-delay;let a=null,b=null;
  for(let i=T.snaps.length-1;i>=0;i--){if(T.snaps[i].at<=rt){a=T.snaps[i];b=T.snaps[i+1]||a;break}}if(!a){a=b=T.snaps[0]}
  const k=b===a?0:clamp((rt-a.at)/(b.at-a.at),0,1);
  const lerpE=(ent,pa,pb)=>{if(!pa||!pb)return;let x=pa[0],y=pa[1];if(Math.abs(pb[0]-pa[0])<W/2){x+=(pb[0]-pa[0])*k}else x=k<.5?pa[0]:pb[0];y+=(pb[1]-pa[1])*k;ent.x=ent.rx=x;ent.y=ent.ry=y;ent._ip=1};
  T.rs.forEach((r,i)=>{if(r===e&&r.st==='alive')return;lerpE(r,a.r[i],b.r[i])});
  T.ms.forEach((m,i)=>{if(m===e&&m.mode==='run')return;lerpE(m,a.m[i],b.m[i])});
  T.fx.length>200&&T.fx.splice(0,50);
}
function fast(d){
  if(!T.net||phase!=='mzplay'||+d.g!==myG)return;
  if(HOST){
    // the guest's own character: trust where it says it is (if it's the current life on this board)
    const e=[...T.rs,...T.ms].find(x=>x.ctrl==='net');if(!e||+d.b!==T.bid||+d.l!==e.lid)return;
    if(e.kind==='r'&&e.st!=='alive'||e.kind==='m'&&e.mode!=='run'||T.state!=='play')return;
    const nx=+d.x,ny=+d.y;if(!isFinite(nx)||!isFinite(ny))return;
    if(e.kind==='r'&&Math.abs(nx-e.x)<W/2)eatPath(e,e.x,e.y,nx,ny);
    e.x=nx;e.y=ny;e.dir=+d.d|0;return}
  if(+d.b!==T.bid)return;
  d.at=performance.now();T.snaps.push(d);if(T.snaps.length>12)T.snaps.shift();
  const was=T.state;T.state=STCODE[+d.s]||'play';T.stT=+d.st||0;T.time=+d.tm||0;T.fright=+d.fr||0;T.lv=+d.lv||1;T.lives=+d.li;T.round=+d.rd||0;
  if(was==='count'&&T.state==='play')SFX.go();
  if(was!=='over'&&T.state==='over')setTimeout(()=>{if(T.state==='over'&&T.ending)showEnd()},900);
  (d.sc||[]).forEach((v,i)=>{if(T.pl[i])T.pl[i].sc=+v||0});
  (d.r||[]).forEach((a,i)=>{const r=T.rs[i];if(!r)return;const st=SCODE[a[3]]||'alive',lid=a[7];
    if(r===T.me){
      if(lid!==r.lid||(r.st!=='alive'&&st==='alive')){r.x=r.rx=a[0];r.y=r.ry=a[1];r.dir=0;r.want=0}  // respawned / reset by the host
      r.lid=lid}
    else{r.dir=a[2];r.lid=lid}
    r.st=st;r.t=a[4];r.inv=a[5]?1:0;r.pow=a[6]?1:0;if(r.st==='alive'&&r!==T.me)r.mouth+=.05});
  (d.m||[]).forEach((a,i)=>{const m=T.ms[i];if(!m)return;const mode=MCODE[a[3]]||'run';
    if(m===T.me&&(a[5]!==m.lid||m.mode!=='run'&&mode==='run')){m.x=m.rx=a[0];m.y=m.ry=a[1];m.want=0;m.dir=0}
    m.lid=a[5];m.mode=mode;m.fr=!!a[4];if(m!==T.me||mode!=='run')m.dir=a[2]});
  T.fruits=(d.fu||[]).map(([x,y,k,t,id])=>({x,y,k,t,id}));
}
function event(d){
  if(!T.net||+d.g!==myG)return;
  if(d.e==='mzb'&&!HOST){applyBoard(d);return}
  if(d.e==='mzend'&&!HOST){T.ending={title:String(d.t||''),sub:''};(d.sc||[]).forEach((v,i)=>{if(T.pl[i])T.pl[i].sc=+v||0});
    T.ending.sub=(T.mode==='coop'?`Team score <b>${T.pl.reduce((a,p)=>a+p.sc,0).toLocaleString()}</b> · reached maze ${T.lv}`:'')+resTable(T.pl.map((p,i)=>({p,i})).sort((a,b)=>b.p.sc-a.p.sc));
    T.state='over';setTimeout(showEnd,700);return}
  if(HOST||+d.b!==T.bid)return;
  if(d.e==='mzd'){(d.k||[]).forEach(k=>{if(T.dots[k]){T.dots[k]=0;clearDot(k)}});return}
  if(d.e==='mzD'){const s=String(d.s||'');if(s.length!==N)return;for(let k=0;k<N;k++)T.dots[k]=+s[k]||0;redrawDots();return}
  if(d.e==='mzx'){const r=T.rs[+d.i]||null;playFx(String(d.k),r,d.o||{});
    if(d.k==='fruit'||d.k==='caught'||d.k==='mon'){/* positions already come with snapshots */}}
}
function hb(){if(!T.net||!HOST||!T.g)return{g:myG};return{g:myG,b:boardMsg()}}
function sync(){
  if(!T.net||phase!=='mzplay')return;
  if(!opp){T.state=T.state==='over'?'over':'wait';T.waitMsg='Your friend left. Waiting…';return}
  if(HOST){
    // replace a missing guest with... nothing: we wait for them. Start once they're here.
    const g=T.pl.find(p=>!p.bot&&!p.host);if(g)g.name=on||g.name;
    if(T.state==='wait'&&!T.waitRe)beginHost();
    else if(T.waitRe&&opp.g===myG){T.waitRe=false;beginHost()}
  }else{
    const x=opp.x&&opp.x.b;if(x&&+x.g===myG&&(+x.b!==T.bid||T.state==='wait'))applyBoard(x)}
  if(!$('#over').hidden)rmLabel();
}

/* ---------- start / stop ---------- */
function setupPlayers(m,local2,online){
  const p2=($('#mzp2').value.trim()||'Player 2').slice(0,12),n=me.n;
  const P=[{name:n,col:RC[0],host:true}];
  if(m!=='solo')P.push(online?{name:on||'Rival',col:RC[1],host:false}:local2?{name:p2,col:RC[1]}:{name:BOTN[0],col:RC[1],bot:true});
  if(m==='ffa'){const bn=[...BOTN].sort(()=>Math.random()-.5).filter(b=>b!==P[1].name);P.push({name:bn[0],col:RC[2],bot:true},{name:bn[1],col:RC[3],bot:true})}
  P.forEach(p=>p.sc=0);return P}
function begin(m){
  T.mode=m;T.diff=+$('#mzdiff').value;T.lv=1;T.round=0;T.ending=null;T.endShown=false;T.paused=false;$('#mzpm').hidden=true;
  T.lives=m==='solo'?3:m==='coop'?4:m==='hunter'?3:0;T.tLimit=m==='versus'?180:m==='ffa'?150:m==='hunter'?120:0;T.time=T.tLimit;
  newBoard(Math.random()*1e9|0);T.state='count';T.stT=3.4;T.hudKey='';$('#over').hidden=true;
}
function beginHost(){T.pl=setupPlayers(T.netMode,false,true);begin(T.netMode);sendBoard()}
function start(m){
  me.n=($('#nm').value.trim()||'Hero').slice(0,12);
  const online=m==='online';
  if(!online){leave();G='maze';cpu=true}
  T.net=online;phase='mzplay';show('mzgame');$('#net').hidden=!online;
  document.documentElement.classList.add('mzon');
  if(!online){T.local2=m==='local';const md=T.local2&&mode==='solo'?'versus':mode;T.pl=setupPlayers(md,T.local2,false);begin(md);if(!T.local2&&md!=='solo')enterFS()}
  else{T.local2=false;T.netMode=mode==='solo'?'versus':mode;T.g=null;T.rs=[];T.ms=[];T.pl=[];T.state='wait';T.waitMsg=HOST?'Starting…':'Waiting for the host…';T.waitRe=false;
    if(HOST&&opp)beginHost();else if(!HOST)sync()}
  $('#mzpause').hidden=online;$('#mzfs').hidden=!fsOK();
  T.run=true;T.last=0;requestAnimationFrame(()=>{layout();prerender()});
  if(!T.raf)T.raf=requestAnimationFrame(frame);
}
function rematch(){
  $('#over').hidden=true;
  if(!T.net){begin(T.mode);return}
  if(!opp)return;myG=opp.g>myG?opp.g:myG+1;pub();T.state='wait';T.waitMsg=`Waiting for ${esc(on||'your friend')}…`;
  if(HOST){if(opp.g===myG)beginHost();else T.waitRe=true}
}
function stop(){T.run=false;cancelAnimationFrame(T.raf);T.raf=0;T.paused=false;document.documentElement.classList.remove('mzon');if(T.fsMine){T.fsMine=false;exitFS()}T.snaps=[]}
const fsEl=()=>document.fullscreenElement||document.webkitFullscreenElement;
const fsOK=()=>!!(document.fullscreenEnabled||document.webkitFullscreenEnabled);
function enterFS(){if(!TOUCH_UI||!fsOK()||fsEl())return;const d=document.documentElement,f=d.requestFullscreen||d.webkitRequestFullscreen;try{const r=f.call(d,{navigationUI:'hide'});T.fsMine=true;if(r&&r.catch)r.catch(()=>{T.fsMine=false})}catch(e){T.fsMine=false}}
function exitFS(){if(!fsEl())return;const f=document.exitFullscreen||document.webkitExitFullscreen;try{const r=f.call(document);if(r&&r.catch)r.catch(()=>{})}catch(e){}}
$('#mzfs').onclick=()=>{fsEl()?exitFS():(()=>{const d=document.documentElement,f=d.requestFullscreen||d.webkitRequestFullscreen;try{f.call(d)}catch(e){}})();SFX.ui()};
['fullscreenchange','webkitfullscreenchange'].forEach(n=>document.addEventListener(n,()=>{if(T.run)setTimeout(layout,60)}));
$('#mzplay').onclick=()=>start('cpu');
$('#mzlocal').onclick=()=>start('local');
$('#mzgo').onclick=()=>join('maze');
$('#mzquit').onclick=leave;$('#mzleave').onclick=leave;
$('#mzpause').onclick=()=>setPause(!T.paused);$('#mzres').onclick=()=>setPause(false);
addEventListener('resize',()=>{if(T.run)layout()});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&T.run&&!T.net&&T.state==='play')setPause(true)});

/* ---------- music ---------- */
THEMES.maze={bpm:128,vol:.85,key:72,maj:1,prog:prog('C3:maj A2:min F2:maj G2:maj'),
  bass:seq('0 . 12 . 7 . 12 . 0 . 12 . 7 . 10 .'),bassT:'square',bassV:.09,bassLp:800,bassD:.8,
  arp:seq('0 1 2 1 0 1 2 3 0 1 2 1 2 1 0 1'),arpO:24,arpT:'triangle',arpV:.035,arpDl:.12,
  lead:[seq('E5 . G5 . C6 . . . B5 . G5 . E5 . . .'),seq('C5 . E5 . A5 . . . G5 . E5 . C5 . . .'),seq('A4 . C5 . F5 . . . E5 . D5 . C5 . . .'),seq('B4 . D5 . G5 . . . F5 . D5 . B4 . G4 .')],leadT:'square',leadV:.04,leadD:1.6,leadLp:2600,
  k:'x...x...x...x...',s:'....x.......x...',h:'..x...x...x...x.',hV:.05};

regGame('maze',{name:'Maze Munch',menu:'mzmenu',stage:'mzgame',cd:'#cd12',theme:'maze',start,sync,event,fast,rematch,stop,hb});
window.MazeMunch={T,buildMaze,step,newBoard,begin,botDecide,W,H,PAL,drawBerry,drawMelon,drawWalls,drawRunner,drawMon,render,layout};
})();
