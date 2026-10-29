/* =========================================================================
   AIR HOCKEY — first to 7. Drag your mallet (mouse or finger) and smash the
   puck into the other goal. Modes: vs CPU, two players on one device, online.

   Online: each screen moves its own mallet with zero delay. The puck is run by
   whoever's half it is in (only that player's mallet can touch it there), and
   that screen streams it 60 times a second; the other screen predicts ahead by
   the network delay and blends in. So your own hits always feel instant.
   ========================================================================= */
(()=>{
const L=1.7,PR=0.036,MR=0.062,GH=0.17,WIN=7,STEP=1/240;
/* feel of the table (units: table widths, seconds) */
const PH={maxPuck:3.0,      // fastest the puck can travel
  glide:.32,                // air-table drag: the puck keeps sliding for a few seconds
  wallBounce:.86,           // how lively the rails are
  hitBounce:.78,            // restitution between mallet and puck
  malletTop:4.4,            // fastest a mallet can move
  malletAcc:46,             // how quickly a mallet speeds up / stops (no teleporting)
  squirt:.55,               // speed a puck pinched against a rail squirts out at (at least)
  slotPull:1.6,             // how hard a goal slot pulls in a puck that has drifted onto the goal line
  unstick:1.6};             // seconds a puck may rest against a rail before it drifts back into play
const T={cpuSpeed:3,mode:'cpu',me:0,run:false,raf:0,pk:null,ml:[null,null],tgt:[null,null],sc:[0,0],pause:0,serveTo:0,trail:[],fx:[],shake:0,lvl:1,
  names:['',''],ptr:new Map(),keys:{},rbuf:[],lastSend:0,gk:0,ended:false,lastWall:0,lastHit:0,flash:0,waiting:false,cd:0,hold:0,still:0,cpuT:0};

/* ---------- DOM ---------- */
const html=`
<section id="ahmenu" class="card gmenu" hidden>
<div class="mhero"><div class="mart" data-art="hockey"></div><h2 class="mh">Air Hockey</h2></div>
<div class="row rsets">
  <label>CPU level<select id="ahdiff"><option value="0">Easy · rookie</option><option value="1" selected>Normal · solid</option><option value="2">Hard · wall of steel</option></select></label>
  <label>Player 2 name (same device)<input id="ahp2name" maxlength="12" placeholder="Player 2" autocomplete="off"></label>
  <label>Online room code<input id="cd8" maxlength="6" autocomplete="off"></label>
</div>
<div class="row"><button class="btn b" id="ahsolo">Solo vs CPU</button><button class="btn o" id="ahlocal">2 Players · same device</button><button class="btn" id="ahgo">Online with a friend</button></div>
<p class="note" data-msg></p>
<ul class="rules">
 <li><b>Mouse or finger:</b> your mallet follows your pointer. Hit the puck hard by moving through it fast. First to <b>${WIN}</b> wins.</li>
 <li><b>Same device:</b> on a phone or tablet, each player drags in their own half. On a computer, Player 1 uses the mouse (or W A S D) and Player 2 uses the arrow keys.</li>
 <li>You can't cross the centre line. After a goal, the player who let it in serves.</li>
</ul>
<button class="btn m back" data-back>← All games</button></section>
<section id="ahgame" hidden>
<div id="ahstage"><canvas id="ahcv"></canvas><div id="ahmsg"></div>
 <div class="card htop" id="ahhud">
  <div class="hpl ahpl"><b><span class="ahdot" style="background:#ff3e8a"></span><span id="ahn0"></span></b><span>You</span></div>
  <div class="hmid"><span id="ahsc"><i>0</i> – <em>0</em></span><span class="hcat">FIRST TO ${WIN}</span></div>
  <div class="hpl r ahpl"><b><span id="ahn1"></span><span class="ahdot" style="background:#2d7bff"></span></b><span id="ahsub1">Rival</span></div>
 </div>
 <div id="ahbtns"><button class="ahb" id="ahquit" aria-label="Exit to hub">✕ Exit</button><button class="ahb" id="ahfs" aria-label="Toggle full screen">⛶ Full screen</button></div>
</div>
</section>`;
$('#app').insertAdjacentHTML('beforeend',html);
$('#ahmenu [data-back]').onclick=()=>{show('hub');SFX.back()};
const cv=$('#ahcv'),ctx2=cv.getContext('2d');
['contextmenu','selectstart','dragstart'].forEach(n=>$('#ahgame').addEventListener(n,e=>e.preventDefault()));

/* ---------- view: my goal is always at the bottom (portrait) or left (landscape) ---------- */
let V={w:0,h:0,s:1,ox:0,oy:0,horiz:false,dpr:1,u:1};
function layout(){
  const r=$('#ahstage').getBoundingClientRect(),dpr=Math.min(2,devicePixelRatio||1);
  if(!r.width)return;
  if(cv.width!==Math.round(r.width*dpr)||cv.height!==Math.round(r.height*dpr)){cv.width=Math.round(r.width*dpr);cv.height=Math.round(r.height*dpr)}
  // the table fills the whole screen, apart from a strip at the top for the score bar
  const hb=$('#ahhud').getBoundingClientRect(),top=Math.max(14,hb.bottom-r.top+8),pad=Math.max(12,Math.min(r.width,r.height)*.018);
  const aw=r.width-pad*2,ah=r.height-top-pad,horiz=aw>ah*1.05;
  const rimK=.05;   // leave room for the rail around the playing surface (10*u px each side ≈ 2.4% of s)
  const s=horiz?Math.min(aw/(L+rimK),ah/(1+rimK)):Math.min(aw/(1+rimK),ah/(L+rimK));
  V={w:r.width,h:r.height,s,horiz,dpr,u:Math.max(1,s/420),ox:(r.width-(horiz?L:1)*s)/2,oy:top+(ah-(horiz?1:L)*s)/2};
}
// table point -> my view; P1 (me=0) defends y=L
function toView(x,y){if(T.me===1){x=1-x;y=L-y}return V.horiz?[V.ox+(L-y)*V.s,V.oy+x*V.s]:[V.ox+x*V.s,V.oy+y*V.s]}
function fromView(px,py){let x,y;if(V.horiz){y=L-(px-V.ox)/V.s;x=(py-V.oy)/V.s}else{x=(px-V.ox)/V.s;y=(py-V.oy)/V.s}if(T.me===1){x=1-x;y=L-y}return[x,y]}

/* ---------- physics ---------- */
const clamp=(v,a,b)=>v<a?a:v>b?b:v;
function halfOf(y){return y>L/2?0:1}
function clampMallet(p,m){m.x=clamp(m.x,MR,1-MR);m.y=p===0?clamp(m.y,L/2+MR,L-MR):clamp(m.y,MR,L/2-MR)}
function resetPositions(serveTo){
  T.ml=[{x:.5,y:L-0.2,vx:0,vy:0},{x:.5,y:0.2,vx:0,vy:0}];
  T.tgt=[{x:.5,y:L-0.2},{x:.5,y:0.2}];
  T.pk={x:.5,y:serveTo===0?L/2+0.24:L/2-0.24,vx:0,vy:0};T.trail=[];
}
// does this screen run the puck right now?
function iRun(){
  if(T.mode!=='online')return true;
  return halfOf(T.pk.y)===T.me;
}
function stepPhysics(dt){
  const pk=T.pk;
  // mallets accelerate toward where you point (smooth, with a top speed) instead of teleporting
  for(let p=0;p<2;p++){
    const m=T.ml[p],t=T.tgt[p];if(!m||!t)continue;
    if(T.mode==='online'&&p!==T.me)continue;
    const top=p===1&&T.mode==='cpu'?T.cpuSpeed:PH.malletTop;
    const dx=t.x-m.x,dy=t.y-m.y,d=Math.hypot(dx,dy);
    // desired velocity: head for the target, easing in over the last few centimetres
    const want=Math.min(top,d*22),wx=d>1e-6?dx/d*want:0,wy=d>1e-6?dy/d*want:0;
    const ex=wx-m.vx,ey=wy-m.vy,el=Math.hypot(ex,ey),acc=PH.malletAcc*dt;
    if(el>acc){m.vx+=ex/el*acc;m.vy+=ey/el*acc}else{m.vx=wx;m.vy=wy}
    m.x+=m.vx*dt;m.y+=m.vy*dt;
    const ox=m.x,oy=m.y;clampMallet(p,m);if(m.x!==ox)m.vx=0;if(m.y!==oy)m.vy=0;
  }
  if(T.pause>0)return;
  const run=iRun();
  // a puck that drifts into a goal slot gets sucked in (like the slight dip on a real table)
  // instead of stopping dead half-way across the goal line
  if(Math.abs(pk.x-.5)<GH-PR*.3){if(pk.y<PR)pk.vy-=PH.slotPull*dt;else if(pk.y>L-PR)pk.vy+=PH.slotPull*dt}
  pk.x+=pk.vx*dt;pk.y+=pk.vy*dt;
  const f=1-PH.glide*dt;pk.vx*=f;pk.vy*=f;
  pk.spin=(pk.spin||0)*(1-dt)+0;
  // side rails
  if(pk.x<PR){pk.x=PR;pk.vx=Math.abs(pk.vx)*PH.wallBounce;wallHit()}
  if(pk.x>1-PR){pk.x=1-PR;pk.vx=-Math.abs(pk.vx)*PH.wallBounce;wallHit()}
  // end rails, goal posts and goals
  for(const end of[0,1]){
    const ey=end===0?0:L;
    for(const px of[.5-GH,.5+GH]){const dx=pk.x-px,dy=pk.y-ey,d=Math.hypot(dx,dy);   // rounded goal posts
      if(d<PR&&d>1e-6){const nx=dx/d,ny=dy/d;pk.x=px+nx*PR;pk.y=ey+ny*PR;const vn=pk.vx*nx+pk.vy*ny;if(vn<0){pk.vx-=(1+PH.wallBounce)*vn*nx;pk.vy-=(1+PH.wallBounce)*vn*ny;wallHit()}}}
    const inMouth=Math.abs(pk.x-.5)<GH;
    const atWall=end===0?pk.y<PR:pk.y>L-PR;if(!atWall)continue;
    if(inMouth){
      const conceder=end===0?1:0;          // the top goal belongs to player 1
      const past=end===0?pk.y<-PR:pk.y>L+PR;
      if(past){
        if(T.mode!=='online'||conceder===T.me){goal(1-conceder);return}
        pk.vx=pk.vy=0;pk.y=end===0?-PR:L+PR;  // their goal: they decide; hold the puck in the net meanwhile
      }
    }else{
      if(end===0){pk.y=PR;pk.vy=Math.abs(pk.vy)*PH.wallBounce}else{pk.y=L-PR;pk.vy=-Math.abs(pk.vy)*PH.wallBounce}
      wallHit();
    }
  }
  // mallet hits (only the mallet on this side of the table can reach the puck)
  for(let p=0;p<2;p++){
    const m=T.ml[p];if(!m)continue;
    if(T.mode==='online'&&!run)continue;
    const dx=pk.x-m.x,dy=pk.y-m.y,d=Math.hypot(dx,dy),R=PR+MR;
    if(d<R&&d>1e-6){
      const nx=dx/d,ny=dy/d;
      // bounce off the mallet first, then separate the two
      const rvx=pk.vx-m.vx,rvy=pk.vy-m.vy,vn=rvx*nx+rvy*ny;
      if(vn<0){pk.vx-=(1+PH.hitBounce)*vn*nx;pk.vy-=(1+PH.hitBounce)*vn*ny;pk.spin=(rvx*ny-rvy*nx)*8;hitFx(-vn)}
      pk.x=m.x+nx*R;pk.y=m.y+ny*R;
      // puck squeezed between the mallet and a rail (or a corner)
      const inMouth=Math.abs(pk.x-.5)<GH,cx=clamp(pk.x,PR,1-PR),cy=inMouth?pk.y:clamp(pk.y,PR,L-PR);
      if(cx!==pk.x||cy!==pk.y){
        const wx=Math.sign(cx-pk.x),wy=Math.sign(cy-pk.y);pk.x=cx;pk.y=cy;   // wx/wy: rail normal, pointing into the table
        // It used to stop dead here, which is how it got stuck on the edges and in corners.
        // Now, like a real table, a pinched puck squirts out along the rail.
        let tx=0,ty=0;
        if(wx&&wy){if(Math.abs(nx)>=Math.abs(ny))ty=wy;else tx=wx}                     // corner: out along the rail it's not pushed into
        else if(wx)ty=Math.abs(ny)>.12?Math.sign(ny):(Math.sign(L/2-pk.y)||1);           // side rail: slide along y
        else tx=Math.abs(nx)>.12?Math.sign(nx):(Math.sign(.5-pk.x)||1);                  // end rail: slide along x
        const push=Math.hypot(m.vx,m.vy),sq=clamp(PH.squirt+push*.85,PH.squirt,PH.maxPuck*.85);
        if(wx&&pk.vx*wx<0)pk.vx=-pk.vx*PH.wallBounce;if(wy&&pk.vy*wy<0)pk.vy=-pk.vy*PH.wallBounce;   // never into the rail
        if(tx)pk.vx=tx*Math.max(Math.abs(pk.vx),sq);if(ty)pk.vy=ty*Math.max(Math.abs(pk.vy),sq);
        // the mallet is pushed back so the two no longer overlap
        const ddx=m.x-pk.x,ddy=m.y-pk.y,dd=Math.hypot(ddx,ddy)||1;m.x=pk.x+ddx/dd*(R+.002);m.y=pk.y+ddy/dd*(R+.002);clampMallet(p,m);
        m.vx*=.3;m.vy*=.3;wallHit();
      }
    }
  }
  const sp=Math.hypot(pk.vx,pk.vy);if(sp>PH.maxPuck){pk.vx*=PH.maxPuck/sp;pk.vy*=PH.maxPuck/sp}
  pk.rot=(pk.rot||0)+(pk.spin||0)*dt;
  // safety net: a puck resting against a rail or in a corner for a while drifts back into play
  if(run&&pk.y>0&&pk.y<L){
    const e=PR+.03,edge=pk.x<e||pk.x>1-e||pk.y<e||pk.y>L-e;
    if(sp<.12&&edge)T.still+=dt;else T.still=0;
    if(T.still>PH.unstick){T.still=0;const hy=pk.y>L/2?L*.75:L*.25,ddx=.5-pk.x,ddy=hy-pk.y,dd=Math.hypot(ddx,ddy)||1;pk.vx=ddx/dd*.45;pk.vy=ddy/dd*.45}
  }
}
function wallHit(){const n=performance.now();if(n-T.lastWall>70){T.lastWall=n;const sp=Math.hypot(T.pk.vx,T.pk.vy);if(sp>.25)sfx(380+sp*90,.045,'triangle',Math.min(1,.4+sp*.25))}}
function hitFx(power){const n=performance.now();if(n-T.lastHit<90)return;T.lastHit=n;
  // a sharp plastic "clack", louder for harder hits
  sfx(620+power*120,.035,'square',Math.min(1,.35+power*.3));sfx(1500,.02,'triangle',.25);
  const k=Math.min(10,3+power*4);for(let i=0;i<k;i++)T.fx.push({x:T.pk.x,y:T.pk.y,vx:(Math.random()-.5)*1.6,vy:(Math.random()-.5)*1.6,t:0});
  if(power>1.8)T.shake=3}

/* ---------- goals, serve, match end ---------- */
function goal(scorer){
  T.sc[scorer]++;T.gk++;
  if(T.mode==='online')NET.ev({e:'ahg',g:myG,sc:T.sc,k:T.gk,by:scorer});
  afterGoal(scorer);
}
function afterGoal(scorer){
  T.pause=1.3;T.serveTo=1-scorer;T.flash=1;
  const mine=T.mode==='local'||scorer===T.me;
  showMsg('GOAL!',T.names[scorer]+' scores',true);
  try{mine?SFX.go():SFX.wrong()}catch(e){}
  T.shake=10;
  for(let k=0;k<30;k++)T.fx.push({x:T.pk.x,y:clamp(T.pk.y,0,L),vx:(Math.random()-.5)*4,vy:(Math.random()-.5)*4,t:0,c:scorer===0?'#ff3e8a':'#2d7bff'});
  hud();
  if(T.sc[scorer]>=WIN){T.ended=true;setTimeout(endMatch,1200);return}
  setTimeout(()=>{if(!T.run)return;const pk=T.pk;pk.x=.5;pk.y=T.serveTo===0?L/2+0.24:L/2-0.24;pk.vx=pk.vy=0;T.trail=[];showMsg('')},1100);
}
function endMatch(){
  if(!T.run)return;T.pause=99;
  const w=T.sc[0]>T.sc[1]?0:1,loc=T.mode==='local';
  jingle(w===T.me||loc);
  const t=loc?T.names[w].toUpperCase()+' WINS!':w===T.me?'YOU WIN!':'YOU LOSE!';
  setOver(t,`Final score ${T.sc[T.me]} – ${T.sc[1-T.me]}`,T.mode==='online'?null:'Play again!');
}
function showMsg(big,small,g){const m=$('#ahmsg');m.innerHTML=big?`<div><span class="${g?'g':''}">${esc(big)}</span>${small?`<small>${esc(small)}</small>`:''}</div>`:''}
function hud(){const a=T.sc[T.me],b=T.sc[1-T.me];$('#ahsc').innerHTML=`<i>${a}</i> – <em>${b}</em>`;
  $('#ahn0').textContent=T.names[T.me];$('#ahn1').textContent=T.names[1-T.me];
  $('#ahsub1').textContent=T.mode==='cpu'?'CPU':T.mode==='local'?'Player 2':'Online'}

/* ---------- CPU opponent (player 1, top) ---------- */
function cpuThink(dt){
  const pk=T.pk,m=T.ml[1],lvl=T.lvl,home={x:.5,y:0.16},R=PR+MR;
  T.cpuSpeed=[1.9,2.8,3.8][lvl];
  const inMine=pk.y<L/2,spd=Math.hypot(pk.vx,pk.vy);
  // how long the puck has been loitering on my side without being hit away
  if(inMine&&spd<1)T.cpuT+=dt;else T.cpuT=0;
  T.hold-=dt;if(T.hold>0)return;T.hold=[0.12,0.06,0.02][lvl];
  let tx,ty;
  const coming=pk.vy<-0.05&&spd>0.25;
  if(inMine&&(!coming||spd<1.1)){
    if(pk.y<MR+PR*.6){
      // puck hugging my back rail: I can't get behind it, so come from the middle side and
      // shove it out sideways (it squirts along the rail and back into play)
      const sd=Math.sign(.5-pk.x)||1;tx=pk.x+sd*(R-.03);ty=pk.y+.02;
    }else{
      // attack: get behind the puck and drive it toward the far goal
      if(!T.aim||T.aimT<=0){T.aim=.5+(Math.random()-.5)*GH*[1.6,1,0.6][lvl];T.aimT=1}
      T.aimT-=dt;const dx=T.aim-pk.x,dy=L-pk.y,d=Math.hypot(dx,dy),ux=dx/d,uy=dy/d;
      const bx=clamp(pk.x-ux*(R+.012),MR,1-MR),by=clamp(pk.y-uy*(R+.012),MR,L/2-MR);
      const front=m.y>pk.y-.005;   // my mallet is between the puck and the far goal: go round it
      if(front){let sd=Math.sign(m.x-pk.x)||(pk.x<.5?1:-1);const sx=pk.x+sd*(R+.045);if(sx>1-MR||sx<MR)sd=-sd;
        tx=pk.x+sd*(R+.045);ty=m.y>pk.y+.02?pk.y:pk.y-.07;}
      else if(Math.hypot(m.x-bx,m.y-by)>.035){tx=bx;ty=by}
      else{tx=pk.x+ux*.14;ty=pk.y+uy*.14}
      // loitering too long (odd angle, near a rail): just go straight through it
      if(T.cpuT>2.2){tx=pk.x+(pk.x-m.x)*.5;ty=pk.y+(pk.y-m.y)*.5;if(T.cpuT>3.2)T.cpuT=0}
    }
  }else if(coming){
    // defend: meet the puck on its path a little in front of the goal
    const yLine=[0.2,0.24,0.28][lvl],t=(pk.y-yLine)/Math.max(0.1,-pk.vy);
    let px=pk.x+pk.vx*t;for(let k=0;k<3;k++){if(px<PR)px=2*PR-px;if(px>1-PR)px=2*(1-PR)-px}
    tx=.5+(px-.5)*[0.6,0.8,0.95][lvl];ty=yLine;
  }else{tx=home.x+(pk.x-.5)*0.4;ty=home.y}
  const t={x:tx+(Math.random()-.5)*[0.06,0.03,0.01][lvl],y:ty};clampMallet(1,t);T.tgt[1]=t;
}

/* ---------- input ---------- */
function playerForPointer(e,x,y){
  if(T.mode!=='local')return T.me;
  // same device: whoever's half the finger is in
  return y>L/2?0:1;
}
cv.addEventListener('pointerdown',e=>{if(!T.run)return;e.preventDefault();try{cv.setPointerCapture(e.pointerId)}catch(x){}
  const r=cv.getBoundingClientRect(),[x,y]=fromView(e.clientX-r.left,e.clientY-r.top);
  T.ptr.set(e.pointerId,playerForPointer(e,x,y));move(e)});
cv.addEventListener('pointermove',e=>{if(!T.run)return;if(!T.ptr.has(e.pointerId)){if(e.pointerType!=='mouse')return;T.ptr.set(e.pointerId,T.mode==='local'?0:T.me)}move(e)});
const up=e=>{if(e.pointerType!=='mouse')T.ptr.delete(e.pointerId)};
['pointerup','pointercancel'].forEach(n=>cv.addEventListener(n,up));
function move(e){
  const p=T.ptr.get(e.pointerId);if(p==null)return;
  if(T.mode==='cpu'&&p===1)return;if(T.mode==='online'&&p!==T.me)return;
  const r=cv.getBoundingClientRect(),[x,y]=fromView(e.clientX-r.left,e.clientY-r.top);
  // touch: hold the mallet a little above the finger so you can see it
  // touch: keep the mallet a little ahead of the finger (toward the centre) so it stays visible
  const lift=e.pointerType==='touch'&&!V.horiz?0.07:0,t={x,y:y+(p===0?-lift:lift)};
  clampMallet(p,t);T.tgt[p]=t;
}
addEventListener('keydown',e=>{if($('#ahgame').hidden)return;T.keys[e.code]=true;if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code))e.preventDefault()});
addEventListener('keyup',e=>{T.keys[e.code]=false});
function keyDrive(dt){
  const k=T.keys,sp=1.9*dt;
  const drive=(p,u,d,l,r)=>{if(!(k[u]||k[d]||k[l]||k[r]))return;const t=T.tgt[p];let dx=(k[r]?1:0)-(k[l]?1:0),dy=(k[d]?1:0)-(k[u]?1:0);
    // keys are relative to the screen
    let tx,ty;if(V.horiz){ty=-dx;tx=dy}else{tx=dx;ty=dy}if(T.me===1){tx=-tx;ty=-ty}
    t.x+=tx*sp;t.y+=ty*sp;clampMallet(p,t)};
  if(T.mode==='local'){drive(0,'KeyW','KeyS','KeyA','KeyD');
    // player 2's arrow keys move their mallet the way the arrows point on screen
    const t=T.tgt[1];if(k.ArrowUp||k.ArrowDown||k.ArrowLeft||k.ArrowRight){let dx=(k.ArrowRight?1:0)-(k.ArrowLeft?1:0),dy=(k.ArrowDown?1:0)-(k.ArrowUp?1:0);
      let tx,ty;if(V.horiz){ty=-dx;tx=dy}else{tx=dx;ty=dy}t.x+=tx*sp;t.y+=ty*sp;clampMallet(1,t)}}
  else{drive(T.me,'KeyW','KeyS','KeyA','KeyD');drive(T.me,'ArrowUp','ArrowDown','ArrowLeft','ArrowRight')}
}

/* ---------- online ---------- */
function sendState(now){
  if(now-T.lastSend<16)return;T.lastSend=now;
  const m=T.ml[T.me],q=v=>Math.round(v*1000)/1000,run=iRun()&&T.pause<=0;
  const o={f:1,g:myG,t:Math.round(now*10)/10,m:[q(m.x),q(m.y),q(m.vx),q(m.vy)],k:T.gk};
  if(run)o.p=[q(T.pk.x),q(T.pk.y),q(T.pk.vx),q(T.pk.vy)];
  NET.sendFast(o);
}
function fast(d){
  if(T.mode!=='online'||!T.run||+d.g!==myG)return;
  const now=performance.now(),other=1-T.me;
  if(Array.isArray(d.m)){const b=T.rbuf,t=+d.t;if(!b.length||t>b[b.length-1].t){b.push({t,x:+d.m[0],y:+d.m[1],vx:+d.m[2],vy:+d.m[3]});if(b.length>30)b.shift()}
    const s=now-t;T.off=T.off==null||s<T.off?s:T.off+(s-T.off)*0.01}
  if(Array.isArray(d.p)&&T.pause<=0&&+d.k===T.gk){
    const pk=T.pk,mineDeep=halfOf(pk.y)===T.me&&(Math.abs(pk.y-L/2)>0.08||HOST);
    if(mineDeep)return;
    // predict where their puck is by now, then blend into it
    const age=clamp(NET.clk!=null?(now-((+d.t)-NET.clk))/1000:NET.rtt/2000,0,0.25);
    const g={x:+d.p[0],y:+d.p[1],vx:+d.p[2],vy:+d.p[3]};
    for(let a=0;a<age;a+=STEP){g.x+=g.vx*STEP;g.y+=g.vy*STEP;if(g.x<PR){g.x=PR;g.vx=Math.abs(g.vx)*PH.wallBounce}if(g.x>1-PR){g.x=1-PR;g.vx=-Math.abs(g.vx)*PH.wallBounce}}
    const err=Math.hypot(g.x-pk.x,g.y-pk.y),k=err>0.2?1:0.45;
    pk.x+=(g.x-pk.x)*k;pk.y+=(g.y-pk.y)*k;pk.vx=g.vx;pk.vy=g.vy;
  }
}
function remoteMallet(now){
  const b=T.rbuf,m=T.ml[1-T.me];if(!b.length||T.off==null)return;
  const rt=now-T.off-(NET.fastOK()?40:200);let a=b[0],z=a,k=0;
  if(rt>=b[b.length-1].t)a=z=b[b.length-1];else if(rt>b[0].t){for(let i=0;i<b.length-1;i++)if(b[i+1].t>rt){a=b[i];z=b[i+1];break}k=(rt-a.t)/Math.max(1,z.t-a.t)}
  m.x=a.x+(z.x-a.x)*k;m.y=a.y+(z.y-a.y)*k;m.vx=z.vx;m.vy=z.vy;
}
function event(d){
  if(T.mode!=='online'||!T.run)return;
  if(d.e==='ahg'&&+d.g===myG&&+d.k===T.gk+1){T.sc=[+d.sc[0]||0,+d.sc[1]||0];T.gk=+d.k;afterGoal(+d.by)}
}

/* ---------- drawing ---------- */
function draw(now){
  layout();const c=ctx2,dpr=V.dpr,s=V.s;
  c.setTransform(dpr,0,0,dpr,0,0);c.clearRect(0,0,V.w,V.h);
  let sx=0,sy=0;if(T.shake>0){sx=(Math.random()-.5)*T.shake;sy=(Math.random()-.5)*T.shake;T.shake*=0.86;if(T.shake<.3)T.shake=0}
  c.save();c.translate(sx,sy);
  const P=(x,y)=>toView(x,y);
  // table
  const [x0,y0]=V.horiz?[V.ox,V.oy]:[V.ox,V.oy],tw=(V.horiz?L:1)*s,th=(V.horiz?1:L)*s;
  const rr=s*0.08,u=V.u,rim=10*u;
  // rim with a soft glow under the table
  c.save();c.shadowColor='#7a4dff';c.shadowBlur=30*u;c.fillStyle='#14111f';roundRect(c,x0-rim,y0-rim,tw+rim*2,th+rim*2,rr+rim);c.fill();c.restore();
  c.fillStyle='#e8ecf6';roundRect(c,x0-rim*.55,y0-rim*.55,tw+rim*1.1,th+rim*1.1,rr+rim*.55);c.fill();
  const grd=c.createLinearGradient(x0,y0,x0+tw,y0+th);grd.addColorStop(0,'#1d2a6b');grd.addColorStop(1,'#2a1458');
  c.fillStyle=grd;roundRect(c,x0,y0,tw,th,rr);c.fill();
  // air holes
  c.fillStyle='#ffffff14';const hs=s*0.07;
  for(let a=hs/2;a<tw;a+=hs)for(let b=hs/2;b<th;b+=hs){c.beginPath();c.arc(x0+a,y0+b,1.1*u,0,7);c.fill()}
  c.save();roundRect(c,x0,y0,tw,th,rr);c.clip();
  // centre line + circle
  c.strokeStyle='#ff3e8a';c.lineWidth=3*u;c.shadowColor='#ff3e8a';c.shadowBlur=10*u;
  const [a1,b1]=P(0,L/2),[a2,b2]=P(1,L/2);c.beginPath();c.moveTo(a1,b1);c.lineTo(a2,b2);c.stroke();
  const [cx,cy]=P(.5,L/2);c.beginPath();c.arc(cx,cy,s*0.15,0,7);c.stroke();
  c.strokeStyle='#38d6ff';c.shadowColor='#38d6ff';
  for(const end of[0,L]){const [gx,gy]=P(.5,end);c.beginPath();c.arc(gx,gy,s*0.24,0,7);c.stroke()}
  c.shadowBlur=0;
  c.restore();
  c.strokeStyle='#14111f';c.lineWidth=2.5*u;roundRect(c,x0,y0,tw,th,rr);c.stroke();
  // goals
  for(const end of[0,L]){const [g1x,g1y]=P(.5-GH,end),[g2x,g2y]=P(.5+GH,end);
    const own=(end===L)===(T.me===0),col=own?'#ff3e8a':'#2d7bff';c.lineCap='round';
    c.strokeStyle='#05030f';c.lineWidth=16*u;c.beginPath();c.moveTo(g1x,g1y);c.lineTo(g2x,g2y);c.stroke();
    c.strokeStyle=col;c.lineWidth=4*u;c.shadowColor=col;c.shadowBlur=12*u;c.stroke();c.shadowBlur=0}
  // puck trail
  const pk=T.pk;T.trail.push([pk.x,pk.y]);if(T.trail.length>10)T.trail.shift();
  T.trail.forEach(([x,y],i)=>{const [px,py]=P(x,y);c.fillStyle=`rgba(255,225,77,${i/40})`;c.beginPath();c.arc(px,py,PR*s*(0.4+i/18),0,7);c.fill()});
  // particles
  T.fx=T.fx.filter(f=>(f.t+=1/60)<0.5);T.fx.forEach(f=>{f.x+=f.vx/60;f.y+=f.vy/60;const [px,py]=P(f.x,f.y);c.fillStyle=f.c||'#ffe14d';c.globalAlpha=1-f.t*2;c.beginPath();c.arc(px,py,3*u,0,7);c.fill()});c.globalAlpha=1;
  // mallets
  [0,1].forEach(p=>{const m=T.ml[p];if(!m)return;const [mx,my]=P(m.x,m.y),r=MR*s,col=p===0?'#ff3e8a':'#2d7bff';
    c.fillStyle='#00000055';c.beginPath();c.arc(mx+3*u,my+4*u,r,0,7);c.fill();
    c.fillStyle=col;c.strokeStyle='#14111f';c.lineWidth=3.5*u;c.beginPath();c.arc(mx,my,r,0,7);c.fill();c.stroke();
    c.fillStyle='#ffffff55';c.beginPath();c.arc(mx,my,r*0.72,0,7);c.fill();
    c.fillStyle=col;c.beginPath();c.arc(mx,my,r*0.42,0,7);c.fill();c.stroke();
    c.fillStyle='#ffffffaa';c.beginPath();c.arc(mx-r*0.14,my-r*0.16,r*0.13,0,7);c.fill()});
  // puck
  {const [px,py]=P(pk.x,pk.y),r=PR*s;c.shadowColor='#ffe14d';c.shadowBlur=14*u;c.fillStyle='#14111f';c.beginPath();c.arc(px,py,r,0,7);c.fill();c.shadowBlur=0;
   c.strokeStyle='#ffe14d';c.lineWidth=3*u;c.beginPath();c.arc(px,py,r*0.68,0,7);c.stroke();
   const a=(pk.rot||0);c.strokeStyle='#ffe14daa';c.lineWidth=2*u;c.beginPath();c.moveTo(px+Math.cos(a)*r*.25,py+Math.sin(a)*r*.25);c.lineTo(px+Math.cos(a)*r*.6,py+Math.sin(a)*r*.6);c.stroke()}
  c.restore();
  if(T.flash>0){c.fillStyle=`rgba(255,255,255,${T.flash*0.35})`;c.fillRect(0,0,V.w,V.h);T.flash=Math.max(0,T.flash-0.06)}
}
function roundRect(c,x,y,w,h,r){c.beginPath();c.moveTo(x+r,y);c.arcTo(x+w,y,x+w,y+h,r);c.arcTo(x+w,y+h,x,y+h,r);c.arcTo(x,y+h,x,y,r);c.arcTo(x,y,x+w,y,r);c.closePath()}

/* ---------- loop ---------- */
let last=0,acc=0;
function loop(now){
  T.raf=requestAnimationFrame(loop);if(!T.run||$('#ahgame').hidden)return;
  const dt=Math.min(0.05,(now-last)/1000||0);last=now;
  if(T.cd>0){T.cd-=dt;const n=Math.ceil(T.cd);if(n!==T.cdn){T.cdn=n;if(n>0){showMsg(String(n));try{SFX.count()}catch(e){}}else{showMsg('GO!','',true);try{SFX.go()}catch(e){}setTimeout(()=>{if(T.cd<=0&&T.pause<=0)showMsg('')},600)}}}
  if(T.mode==='cpu'&&T.cd<=0)cpuThink(dt);
  keyDrive(dt);
  if(T.mode==='online'){remoteMallet(now)}
  if(T.cd<=0){acc+=dt;while(acc>=STEP){acc-=STEP;stepPhysics(STEP)}}
  if(T.pause>0&&!T.ended){T.pause-=dt}
  if(T.mode==='online'&&T.cd<=0)sendState(now);
  draw(now);
}

/* ---------- start / stop ---------- */
function newMatch(){
  T.sc=[0,0];T.gk=0;T.ended=false;T.pause=0;T.still=0;T.cpuT=0;T.rbuf=[];T.off=null;T.fx=[];T.cd=3.2;T.cdn=null;T.waiting=false;
  resetPositions(Math.random()<.5?0:1);
  // online: serve alternates each match (host first)
  if(T.mode==='online')T.pk.y=myG%2===0?L/2+0.24:L/2-0.24;
  T.run=true;hud();$('#over').hidden=true;showMsg('');
  if(!T.raf){last=performance.now();T.raf=requestAnimationFrame(loop)}
}
/* full screen: the game always covers the whole window; the browser's real full-screen mode
   (no address bar) turns on when you start from a button, and the ⛶ button toggles it */
const fsEl=()=>document.fullscreenElement||document.webkitFullscreenElement;
const fsOK=()=>!!(document.fullscreenEnabled||document.webkitFullscreenEnabled);
function enterFS(){if(!fsOK()||fsEl())return;const d=document.documentElement,f=d.requestFullscreen||d.webkitRequestFullscreen;
  try{const r=f.call(d,{navigationUI:'hide'});T.fsMine=true;if(r&&r.catch)r.catch(()=>{T.fsMine=false})}catch(e){T.fsMine=false}}
function exitFS(){if(!fsEl())return;const f=document.exitFullscreen||document.webkitExitFullscreen;try{const r=f.call(document);if(r&&r.catch)r.catch(()=>{})}catch(e){}}
function fsLabel(){const b=$('#ahfs');b.hidden=!fsOK();b.textContent=fsEl()?'⤡ Exit full screen':'⛶ Full screen'}
['fullscreenchange','webkitfullscreenchange'].forEach(n=>document.addEventListener(n,()=>{fsLabel();if(T.run)setTimeout(layout,60)}));
$('#ahfs').onclick=()=>{fsEl()?exitFS():enterFS();SFX.ui()};
function start(mode){
  me.n=($('#nm').value.trim()||'Hero').slice(0,12);
  if(mode!=='online'){leave();G='hockey';cpu=true}
  document.documentElement.classList.add('ahon');if(mode!=='online')enterFS();fsLabel();
  T.mode=mode;T.lvl=+$('#ahdiff').value;T.me=mode==='online'&&!HOST?1:0;
  const other=mode==='cpu'?['Rookie Bot','Pro Bot','Steel Bot'][T.lvl]:mode==='local'?($('#ahp2name').value.trim()||'Player 2').slice(0,12):(on||'Rival');
  T.names=T.me===0?[me.n,other]:[other,me.n];
  phase='ahplay';show('ahgame');$('#net').hidden=mode!=='online';
  requestAnimationFrame(()=>{layout();newMatch()});
}
function sync(){
  if(T.mode!=='online'||phase!=='ahplay')return;
  if(!opp){showMsg('PAUSED','Rival disconnected — waiting…');return}
  T.names[1-T.me]=on;hud();
  if(T.waiting&&opp.g===myG){newMatch();return}
  if(!$('#over').hidden)rmLabel();
  // safety net for a missed goal message: the heartbeat carries the score
  const x=opp.x;if(x&&+x.g===myG&&+x.k>T.gk&&Array.isArray(x.sc)){T.sc=[+x.sc[0]||0,+x.sc[1]||0];T.gk=+x.k;hud();if(Math.max(...T.sc)>=WIN&&!T.ended){T.ended=true;endMatch()}}
}
function rematch(){
  if(T.mode!=='online'){newMatch();return}
  if(!opp)return;
  myG=opp.g>myG?opp.g:myG+1;pub();
  if(opp.g===myG)newMatch();else{T.waiting=true;T.run=true;T.pause=99;showMsg('REMATCH?','Waiting for '+on+' to accept…')}
}
function stop(){T.run=false;T.ptr.clear();cancelAnimationFrame(T.raf);T.raf=0;document.documentElement.classList.remove('ahon');if(T.fsMine){T.fsMine=false;exitFS()}}

$('#ahsolo').onclick=()=>start('cpu');
$('#ahlocal').onclick=()=>start('local');
$('#ahgo').onclick=()=>join('hockey');
$('#ahquit').onclick=leave;
addEventListener('resize',()=>{if(T.run)layout()});

/* ---------- music + card art ---------- */
THEMES.hockey={bpm:138,vol:.9,key:66,maj:0,prog:prog('F#2:min D2:maj A2:maj E2:maj'),
  bass:seq('0 . 0 12 . 0 . 12 0 . 0 12 . 0 12 .'),bassT:'sawtooth',bassV:.13,bassLp:600,bassD:.9,
  arp:seq('0 1 2 1 0 1 2 3 0 1 2 1 0 2 1 0'),arpO:24,arpT:'square',arpV:.022,arpDl:.15,
  k:'x...x...x...x...',s:'....x.......x...',h:'..x...x...x...x.',c:'...............x'};
ART_GEN.hockey=(W,n)=>{
  // a real table in perspective: a mallet smashes the puck toward the far goal, LED score above
  const cx=W/2,K='#14111f',u='_a'+n,k=Math.min(1,(W-16)/250),lerp=(a,b,t)=>a+(b-a)*t;
  const P=(x,y)=>{const t=y/100,w=lerp(150,70,t);return[cx+(x-50)/50*w,lerp(126,38,t)]};    // table coords 0..100 -> screen
  const pt=(x,y)=>P(x,y).map(v=>v.toFixed(1)).join(' ');
  const quad=(a,b,c,d)=>`M${pt(...a)}L${pt(...b)}L${pt(...c)}L${pt(...d)}Z`;
  let holes='';for(let y=8;y<96;y+=7)for(let x=6;x<96;x+=7){const[hx,hy]=P(x,y);holes+=`<circle cx="${hx.toFixed(1)}" cy="${hy.toFixed(1)}" r="${(.5+.6*(1-y/100)).toFixed(2)}"/>`}
  const ell=(x,y,r,fill,extra='')=>{const[ex,ey]=P(x,y),s=lerp(1,.5,y/100);return`<ellipse cx="${ex.toFixed(1)}" cy="${ey.toFixed(1)}" rx="${(r*s).toFixed(1)}" ry="${(r*s*.45).toFixed(1)}" fill="${fill}" ${extra}/>`};
  const[pkx,pky]=P(56,58),[mlx,mly]=P(40,24),[fmx,fmy]=P(50,88);
  return `<svg viewBox="0 0 ${W} 130" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><defs>
   <radialGradient id="ag${u}" cx="50%" cy="20%" r="80%"><stop offset="0" stop-color="#3a2a8a"/><stop offset="1" stop-color="#0d0a22"/></radialGradient>
   <linearGradient id="at${u}" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#2d7bff"/><stop offset="1" stop-color="#7fd4ff"/></linearGradient>
   <filter id="ab${u}" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3"/></filter></defs>
  <rect width="${W}" height="130" fill="url(#ag${u})"/>
  <g fill="#ff3e8a">${Array.from({length:Math.ceil(W/40)},(_,i)=>`<rect x="${i*40+6}" y="0" width="3" height="130" opacity="${(.1+(i%3)*.07).toFixed(2)}"/>`).join('')}</g>
  <g transform="translate(${cx} 0) scale(${k}) translate(${-cx} 0)">
   <rect x="${cx-34}" y="6" width="68" height="22" rx="5" fill="#05030f" stroke="#ff3e8a" stroke-width="2.5"/>
   <text x="${cx}" y="23" text-anchor="middle" font-family="Bangers,Impact,sans-serif" font-size="18" fill="#ff5c8a" letter-spacing="2">6 : 5</text>
   <path d="${quad([-6,-4],[106,-4],[106,104],[-6,104])}" fill="#14111f"/>
   <path d="${quad([-3,-2],[103,-2],[103,102],[-3,102])}" fill="#e8ecf6" stroke="${K}" stroke-width="3"/>
   <path d="${quad([0,0],[100,0],[100,100],[0,100])}" fill="url(#at${u})" stroke="${K}" stroke-width="2"/>
   <g fill="#ffffff" opacity=".45">${holes}</g>
   <path d="M${pt(0,50)}L${pt(100,50)}" stroke="#ff3e5a" stroke-width="2.5"/>${ell(50,50,26,'none','stroke="#ff3e5a" stroke-width="2.5"')}
   <path d="M${pt(34,0)}L${pt(66,0)}" stroke="#05030f" stroke-width="7" stroke-linecap="round"/><path d="M${pt(36,100)}L${pt(64,100)}" stroke="#05030f" stroke-width="5" stroke-linecap="round"/>
   <g><ellipse cx="${fmx}" cy="${fmy}" rx="8" ry="3.6" fill="#000" opacity=".3"/><ellipse cx="${fmx}" cy="${fmy-2}" rx="8" ry="3.6" fill="#2d7bff" stroke="${K}" stroke-width="2"/>
    <rect x="${fmx-3}" y="${fmy-9}" width="6" height="7" rx="2" fill="#2d7bff" stroke="${K}" stroke-width="1.5"/></g>
   <g class="apk">
    <path d="M${pkx-4} ${pky+2}L${pkx-30} ${pky+34}" stroke="#ffe14d" stroke-width="13" stroke-linecap="round" opacity=".2"/>
    <path d="M${pkx-3} ${pky+2}L${pkx-22} ${pky+26}" stroke="#ffffff" stroke-width="4" stroke-linecap="round" opacity=".55"/>
    <ellipse cx="${pkx}" cy="${pky+2}" rx="12" ry="6" fill="#000" opacity=".3"/>
    <ellipse cx="${pkx}" cy="${pky}" rx="11" ry="5.5" fill="#ffe14d" filter="url(#ab${u})" opacity=".8"/>
    <ellipse cx="${pkx}" cy="${pky+2}" rx="10" ry="5" fill="${K}"/><ellipse cx="${pkx}" cy="${pky}" rx="10" ry="5" fill="#2b2147" stroke="#ffe14d" stroke-width="2"/></g>
   <g class="am1"><ellipse cx="${mlx+3}" cy="${mly+6}" rx="26" ry="11" fill="#000" opacity=".35"/>
    <ellipse cx="${mlx}" cy="${mly+3}" rx="25" ry="11" fill="#b8164f" stroke="${K}" stroke-width="3"/>
    <ellipse cx="${mlx}" cy="${mly-2}" rx="25" ry="11" fill="#ff3e8a" stroke="${K}" stroke-width="3"/>
    <ellipse cx="${mlx}" cy="${mly-3}" rx="15" ry="6" fill="#ff7aa8"/>
    <rect x="${mlx-8}" y="${mly-24}" width="16" height="20" rx="6" fill="#ff3e8a" stroke="${K}" stroke-width="3"/>
    <ellipse cx="${mlx}" cy="${mly-24}" rx="9" ry="5" fill="#ff7aa8" stroke="${K}" stroke-width="3"/></g>
   <g fill="#ffe14d" stroke="${K}" stroke-width="2"><path d="M${pkx+16} ${pky-12}l3 6 6 2-6 3-3 6-3-6-6-3 6-2z"/></g>
  </g></svg>`;
};

regGame('hockey',{name:'Air Hockey',menu:'ahmenu',stage:'ahgame',cd:'#cd8',theme:'hockey',
  start,sync,event,fast,rematch,stop,hb:()=>({g:myG,sc:T.sc,k:T.gk})});
window.AirHockey={T,stepPhysics,cpuThink,L,PR,MR,PH};
})();
