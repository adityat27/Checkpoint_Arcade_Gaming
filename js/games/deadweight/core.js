/* =========================================================================
   DEADWEIGHT · core (physics + course data, no graphics)
   Two climbers joined by a rope. Everything here is plain math so it runs the
   same in the browser and in tests.

   - Climbers are capsules (three stacked spheres) colliding with box-shaped rocks.
   - Movement has momentum: you accelerate, slide a little, and keep speed in the air.
   - BRACE (hold Shift): plant your feet. You stop moving and become 8x heavier,
     so a falling partner hangs from you instead of dragging you off the edge.
   - The rope is a chain of points that wraps around rock edges. When it's
     stretched past its length, both climbers get pulled along the rope's
     direction at their end, shared by weight. That's what makes ledges act like
     pulleys and lets a hanging climber swing.
   - Hanging climbers can climb the rope (hold Jump) and swing (left/right).
   - Reach a ledge top that's within arm's reach and you mantle up onto it.
   ========================================================================= */
(function(root){
const CFG={g:22,jumpV:8.6,run:5.6,accG:46,accA:13,brakeG:30,ropeLen:9,ropeMin:1,reelUp:2.4,reelDown:6,braceMass:16,R:.35,H:1.6,
  step:1/120,mantleMin:.3,mantleMax:1.05,mantleT:.3,crShake:1.1,crFall:1.6,crBack:4.5,pump:14,kick:7.5,maxFall:30,waist:.95};

/* ---------------- the mountains ----------------
   A course is plain data: boxes [x0,y0,z0, x1,y1,z1] with a .kind
     'r' rock · 'c' crumbles after you stand on it · 'i' ice (slippery) · 'm' moves (.mv says how)
   plus checkpoints, signs, a summit, a theme and `sections` (what each stretch is, for the bot).
   The route always runs along +x. makeCourse(map, seed) builds one: "classic" is the original
   hand-made climb, every other map is stitched together from random obstacle modules, so each
   climb is new. Same map + seed = same course on every computer (that's how online stays in sync). */
const B=-26;   // rock pillars go way down into the cloudy abyss
function mulberry(a){return()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
const MAPS=[
  {id:'classic',n:'The Classic',d:'The original hand-built route. Same every time.',theme:'dusk',fixed:true},
  {id:'foothills',n:'Green Foothills',d:'Gentle, grassy and sunny. A fresh random route every climb.',theme:'dawn',count:[5,6],hard:0,
   pool:{steps:3,stones:3,boost:2,crumble:2,ledges:2,ridge:2,sliders:2,drop:1},must:['boost']},
  {id:'spires',n:'Granite Spires',d:'Sunset towers with swings, sweepers and moving rock. Random every climb.',theme:'dusk',count:[6,7],hard:1,
   pool:{steps:2,stones:2,boost:2,swing:2,crumble:2,ledges:2,ridge:2,sliders:2,sweeper:2,pillar:1,elevator:1},must:['boost','swing']},
  {id:'frozen',n:'Frozen Peak',d:'Ice, wind and aurora skies. Slippery stones and long swings. Random every climb.',theme:'snow',count:[7,8],hard:2,
   pool:{steps:1,stones:2,boost:2,swing:2,crumble:2,ledges:2,ridge:2,sliders:2,sweeper:2,pillar:2,elevator:2,drop:1},must:['boost','swing'],ice:.55},
  {id:'ember',n:'Ember Ridge',d:'A volcano at night. Everything moves, crumbles or burns. Random every climb.',theme:'ember',count:[8,9],hard:3,
   pool:{stones:2,boost:2,swing:2,crumble:3,ledges:2,ridge:2,sliders:3,sweeper:3,pillar:2,elevator:2},must:['boost','swing','sweeper'],ice:0},
];
const TIPS={
  steps:['Rock Steps','Jump up the steps together. You share a 9 m rope, so stay close!'],
  boost:['Boost Wall','Too high to jump. One climber stands still at the wall, the other jumps onto their head and climbs up. Then the top one BRACES (hold SHIFT) and the other holds JUMP to climb the rope.'],
  swing:['The Gap','Too wide to jump! One BRACES at the edge (hold SHIFT). The other jumps, hangs, climbs a little (hold JUMP) and swings (left/right) to grab the far ledge.'],
  crumble:['Crumble Bridge','The slabs collapse a second after you land. Cross one at a time while your partner braces.'],
  ledges:['Cliff Ledges','Hop up the ledges. If your partner slips, BRACE and let them climb back up.'],
  pillar:['Big Swing','Jump onto the pillar and off again before it crumbles. Then brace and swing your partner over.'],
  stones:['Stepping Stones','Small pillars over the abyss. Hop from stone to stone. The rope will catch a slip.'],
  ridge:['Knife Ridge','A narrow zig-zag ridge. Walk carefully, and brace if your partner wobbles off.'],
  sliders:['Drifting Rocks','The rocks slide back and forth. Jump when one lines up with you, ride it, then jump off.'],
  elevator:['Rock Lift','Stand on the rising rock to ride it up the wall. Too slow? Head-stand works too.'],
  sweeper:['Rolling Logs','Logs sweep across the ledge. Time your run, jump over them, or brace and get hauled back.'],
  drop:['The Descent','Drop down the ledges. Mind the landing!'],
  summit:['Summit Ridge','Last stretch. Reach the flag together!'],
};
const SECT_ALT={steps:['Switchbacks','Rock Steps','Boulder Stairs'],stones:['Stepping Stones','Hop Scotch','Pillar Field'],ridge:['Knife Ridge','Razorback','The Spine'],
  sliders:['Drifting Rocks','Sliding Slabs','Floating Isles'],sweeper:['Rolling Logs','Log Sweep','The Mangle'],ledges:['Cliff Ledges','Zig-Zag Ledges','The Chimney'],crumble:['Crumble Bridge','Shaky Slabs','Rotten Rock']};
/* the original route */
function classicCourse(){
  const boxes=[
    [-9,B,-4, 14,0,4],                                        // base camp
    [14,B,-3, 17,1,3],[17,B,-3, 20,2,3],[20,B,-3, 25.2,3,3],  // first steps
    [25.2,B,-3, 30,6.2,3],                                     // boost wall (3.2 m: needs a head-stand)
    [36.4,B,-3, 42,3.2,3],                                     // far side of the gap: too far to jump, reachable by swinging
    [42.6,3.4,-1.3, 45.4,4,1.3,'c'],[46.2,3.4,-1.3, 49,4,1.3,'c'],[49.8,3.4,-1.3, 52.6,4,1.3,'c'],   // crumble bridge
    [53.4,B,-3, 60,5,3],
    [60,B,-3, 62,6.2,-.8],[62.8,B,.6, 64.8,7.4,2.8],[65.6,B,-2.8, 67.6,8.6,-.6],[68.4,B,.6, 70.4,9.8,2.8],[71.2,B,-2.8, 73.2,11,-.6],  // cliff ledges
    [74,B,-3, 80,12.2,3],
    [84,B+8,-1.1, 85.6,10.7,1.1,'c'],                          // crumbling pillar
    [88,B,-3, 94,9.7,3],
    [94,B,-3, 98,10.7,3],[98,B,-3, 104,13.8,3],                // summit wall (3.1 m: head-stand again)
    [104,B,-3, 114,14.4,3],                                    // summit
  ].map(b=>{const o=b.slice(0,6);o.kind=b[6]||'r';return o});
  return{map:'classic',seed:0,theme:'dusk',name:'The Classic',boxes,
    cps:[
      {x:2,y:0,z:0,next:'First Steps',tip:TIPS.steps[1]},
      {x:22.6,y:3,z:0,next:'Boost Wall',tip:TIPS.boost[1]},
      {x:28.4,y:6.2,z:0,next:'The Gap',tip:TIPS.swing[1]},
      {x:39.4,y:3.2,z:0,next:'Crumble Bridge',tip:TIPS.crumble[1]},
      {x:56.8,y:5,z:0,next:'Cliff Ledges',tip:TIPS.ledges[1]},
      {x:77,y:12.2,z:0,next:'Big Swing',tip:TIPS.pillar[1]},
      {x:91,y:9.7,z:0,next:'Summit Ridge',tip:'One last high wall. Head-stand, climb, and reach the flag together!'},
    ],
    summit:{x:109.5,y:14.4,z:0},
    signs:[
      {x:5,y:0,z:-2.6,lines:['W A S D · move','SPACE · jump / climb','hold SHIFT · brace']},
      {x:23.4,y:3,z:-2.4,lines:['TOO HIGH?','Jump on your partner\'s head!']},
      {x:29,y:6.2,z:-2.4,lines:['TOO WIDE?','Brace and swing across!']},
    ],
    sections:[{type:'steps',x0:14,x1:25.2},{type:'boost',x0:25.2,x1:30,wallX:25.2},{type:'swing',x0:30,x1:42,edgeX:30,farX:36.4},{type:'crumble',x0:42,x1:60},
      {type:'ledges',x0:60,x1:80},{type:'pillar',x0:80,x1:94},{type:'boost',x0:94,x1:104,wallX:98},{type:'summit',x0:104,x1:114}]};
}
/* random routes, stitched together from obstacle modules.
   Sizes come from measured limits: a climber can step/mantle up 2.65 m, a head-stand reaches 4.2 m,
   a running jump clears 5.2 m on the level (6.4 m with a 3 m drop). Normal obstacles stay well under
   those; co-op obstacles (boost walls, gaps) are set just past what one climber can do alone. */
class Builder{
  constructor(map,seed){this.m=map;this.seed=seed;this.r=mulberry(seed*2654435761>>>0||1);this.h=map.hard||0;
    this.boxes=[];this.cps=[];this.signs=[];this.sections=[];this.x=14;this.y=0;this.signed={}}
  R(a,b){return Math.round((a+(b-a)*this.r())*20)/20}   // random sizes snap to 5 cm, so every sum lands exactly on box edges
  I(a,b){return a+Math.floor(this.r()*(b-a+1))}
  pick(a){return a[Math.floor(this.r()*a.length)]}
  box(x0,y0,z0,x1,y1,z1,kind,extra){const q=v=>Math.round(v*20)/20,b=[q(x0),q(y0),q(z0),q(x1),q(y1),q(z1)];this.x=q(this.x);this.y=q(this.y);b.kind=kind||'r';if(extra)Object.assign(b,extra);this.boxes.push(b);return b}
  /* a wide resting ledge (checkpoints live on these) */
  rest(len,dy=0,gap=0){const b=this.box(this.x+gap,B,-3,this.x+gap+len,this.y+dy,3);this.last={x0:b[0],x1:b[3],top:b[4]};this.x=b[3];this.y=b[4];return this.last}
  ice(kind){return this.m.ice&&this.r()<this.m.ice?'i':kind||'r'}
  sign(key,lines){if(this.signed[key])return;this.signed[key]=1;this.signs.push({x:this.x-1.4,y:this.y,z:-2.4,lines})}
  /* ---- modules: each starts at the end of the last rest ledge and ends with a new one ---- */
  steps(){const n=this.I(2,4),zz=this.r()<.4;for(let k=0;k<n;k++){const w=this.R(2.4,3.6),up=this.R(.7,1.15+this.h*.08),z0=zz?this.R(-3,-1.6):-3,z1=zz?this.R(1.6,3):3;
      this.box(this.x,B,z0,this.x+w,this.y+up,z1,this.ice());this.x+=w;this.y+=up}this.rest(this.R(5.4,6.4),this.R(.6,1.05))}
  boost(){this.sign('boost',['TOO HIGH?','Jump on your partner\'s head!']);const wx=this.x;this.rest(this.R(5.4,6.4),this.R(3.05,3.35+this.h*.08));return{wallX:wx}}
  swing(){this.sign('swing',['TOO WIDE?','Brace and swing across!']);const dy=-this.R(2.75,3.1),gap=Math.min(this.R(6.05,6.5),Math.floor(Math.sqrt(7.12*7.12-dy*dy)*20)/20),ex=this.x;
    this.rest(this.R(5.6,6.4),dy,gap);return{edgeX:ex,farX:ex+gap}}
  crumble(){const n=this.I(2,3+(this.h>1?1:0)),top=this.y+this.R(.5,.8);for(let k=0;k<n;k++){const len=this.R(2.4,2.9),x0=this.x+.7;this.box(x0,top-.6,-1.3,x0+len,top,1.3,'c');this.x=x0+len}
    this.y=top;this.rest(this.R(5.6,6.4),this.R(.6,1),.75)}
  ledges(){const n=this.I(4,5+(this.h>1?1:0));let side=this.r()<.5?1:-1;for(let k=0;k<n;k++){const x0=this.x+.8,up=this.R(1.05,1.22),z0=side>0?.6:-2.8,z1=side>0?2.8:-.6;
      this.box(x0,B,z0,x0+2,this.y+up,z1);this.x=x0+2;this.y+=up;side=-side}this.rest(this.R(5.6,6.4),this.R(1.05,1.2),.8)}
  pillar(){const g1=this.R(3.4,3.9),d1=this.R(1.2,1.6),w=this.R(1.5,1.8),x0=this.x+g1;this.box(x0,B+8+this.y,-1.1,x0+w,this.y-d1,1.1,'c');const ex=this.x;this.x=x0+w;this.y-=d1;
    this.rest(this.R(5.6,6.4),-this.R(.8,1.1),this.R(2.1,2.45));return{edgeX:ex,farX:this.last.x0}}
  stones(){const n=this.I(4,6+(this.h>1?1:0));let cz=0,y=this.y;for(let k=0;k<n;k++){const gap=this.R(1.2,1.8+this.h*.15),sz=this.R(1.45,1.9-this.h*.08);cz=Math.max(-1.7,Math.min(1.7,cz+this.R(-1.2,1.2)));y=Math.max(this.y-1.6,y+this.R(-.45,.55));
      const x0=this.x+gap;this.box(x0,B,cz-sz/2,x0+sz,y,cz+sz/2,this.ice());this.x=x0+sz}this.y=y;this.rest(this.R(5.4,6.2),this.R(0,.55),this.R(1.2,1.6))}
  ridge(){const n=this.I(3,4);let cz=this.R(-.8,.8),y=this.y;const wz=this.R(1.05,1.3)-this.h*.05;for(let k=0;k<n;k++){const len=this.R(3,4.4);const nz=Math.max(-1.8,Math.min(1.8,cz+this.R(-.75,.75)));
      y+=k?this.R(0,.45):0;this.box(this.x,B,nz-wz/2,this.x+len,y,nz+wz/2,this.ice());cz=nz;this.x+=len}this.y=y;this.rest(this.R(5.4,6.2),this.R(0,.45))}
  sliders(){const n=this.I(1,2+(this.h>1?1:0));for(let k=0;k<n;k++){const g=this.R(1.45,1.7),x0=this.x+g,amp=this.R(1.7,2.3),per=this.R(5.2,6.8)-this.h*.4;
      this.box(x0,this.y-.55,-1.1,x0+2.2,this.y,1.1,'m',{mv:{ax:'z',amp,per,ph:this.R(0,6.283)}});this.x=x0+2.2}this.rest(this.R(5.4,6.2),0,this.R(1.45,1.65))}
  elevator(){const h=this.R(3.6,4.1),x0=this.x+.25,per=this.R(6.5,8);this.box(x0,this.y-.45,-1.25,x0+2,this.y,1.25,'m',{mv:{ax:'y',amp:(h+.12)/2,per,ph:0}});
    const wx=x0+2.02;this.x=wx;this.rest(this.R(5.4,6.2),h);return{wallX:wx,liftX:x0}}
  sweeper(){const len=this.R(7.5,9.5)+this.h*.5,x0=this.x,top=this.y;this.box(x0,B,-1.25,x0+len,top,1.25);
    const n=Math.max(2,Math.min(4,Math.floor(len/3)+(this.h>2?1:0)));for(let k=0;k<n;k++){const lx=x0+1.6+(len-3.2)*(n>1?k/(n-1):.5),per=this.R(3.4,4.6)-this.h*.25;
      this.box(lx-.45,top,-.5,lx+.45,top+.9,.5,'m',{mv:{ax:'z',amp:3.4,per,ph:this.R(0,6.283)},hz:1})}
    this.x=x0+len;this.rest(this.R(5.4,6.2),0)}
  drop(){const n=this.I(1,2);for(let k=0;k<n;k++){const len=this.R(2.6,3.4),dn=this.R(1.5,2.4);this.box(this.x+.6,B,-2.6,this.x+.6+len,this.y-dn,2.6);this.x+=.6+len;this.y-=dn}this.rest(this.R(5.4,6.2),-this.R(0,.4),.6)}
  build(){
    const m=this.m,pool=[];for(const k in m.pool)for(let i=0;i<m.pool[k];i++)pool.push(k);
    const n=this.I(m.count[0],m.count[1]),seq=[];
    // pick modules: no repeats in a row, at most two of a kind, and every "must" co-op obstacle at least once
    for(const k of m.must)seq.push(k);
    for(let g=0;seq.length<n&&g<500;g++){const k=this.pick(pool);if(seq.filter(q=>q===k).length>=2)continue;seq.push(k)}
    for(let i=seq.length-1;i>0;i--){const j=Math.floor(this.r()*(i+1));[seq[i],seq[j]]=[seq[j],seq[i]]}
    for(let t=0;t<40;t++){let ok=true;for(let i=1;i<seq.length;i++)if(seq[i]===seq[i-1]){const j=Math.floor(this.r()*seq.length);[seq[i],seq[j]]=[seq[j],seq[i]];ok=false}if(ok)break}
    // a 'drop' never opens the climb and never follows a swing (both go down)
    if(seq[0]==='drop')seq.push(seq.shift());
    // base camp
    this.box(-9,B,-4,14,0,4);this.last={x0:-9,x1:14,top:0};
    this.signs.push({x:5,y:0,z:-2.6,lines:['W A S D · move','SPACE · jump / climb','hold SHIFT · brace']});
    seq.forEach((k,i)=>{const L=this.last,nm=SECT_ALT[k]?this.pick(SECT_ALT[k]):TIPS[k][0];
      this.cps.push({x:i===0?2:(L.x0+L.x1)/2,y:L.top,z:0,next:nm,tip:TIPS[k][1]});
      const x0=this.x;
      // obstacles that go downhill never take the route below base camp: climb some steps first
      if((k==='swing'||k==='drop'||k==='pillar')&&this.y<3.6){this.steps();if(this.y<3.6)this.steps()}
      const extra=this[k]()||{};this.sections.push(Object.assign({type:k,x0,x1:this.x},extra))});
    // summit: one last short climb to a big flat top
    const L=this.last;this.cps.push({x:(L.x0+L.x1)/2,y:L.top,z:0,next:TIPS.summit[0],tip:TIPS.summit[1]});
    // the summit is always the highest point: climb a staircase until we're above everything so far
    const sx=this.x,peak=Math.max(...this.boxes.map(b=>b[4]));let k=0;
    while(k<2||(this.y<peak+.2&&k<18)){const w=this.R(2.4,3.2),up=this.R(.85,1.15);this.box(this.x,B,-3,this.x+w,this.y+up,3);this.x+=w;this.y+=up;k++}
    this.rest(11,this.R(.6,1));this.sections.push({type:'summit',x0:sx,x1:this.x});
    const S=this.last;
    return{map:m.id,seed:this.seed,theme:m.theme,name:m.n,boxes:this.boxes,cps:this.cps,summit:{x:S.x0+5.5,y:S.top,z:0},signs:this.signs,sections:this.sections};
  }
}
function makeCourse(mapId,seed){
  const m=MAPS.find(q=>q.id===mapId)||MAPS[0];
  const c=m.fixed?classicCourse():new Builder(m,(seed>>>0)||1).build();
  c.boxes.forEach((b,i)=>{b.id=i});
  // the route the bot follows: every box you stand on, in order (moving hazards excluded)
  c.path=c.boxes.filter(b=>!b.hz).map(b=>b.id);
  // the lowest ledge top between each checkpoint and the next: falling well below it means you fell
  c.floor=c.cps.map((p,i)=>{const x1=i+1<c.cps.length?c.cps[i+1].x:c.summit.x;let f=p.y;for(const b of c.boxes)if(!b.hz&&b[3]>p.x-3&&b[0]<x1+3)f=Math.min(f,b[4]);return f});
  return c;
}
const COURSE=makeCourse('classic');
/* where a moving box is at time t (seconds since the climb started) */
function moverOffset(mv,t){const a=t/mv.per*Math.PI*2+mv.ph;return mv.ax==='y'?mv.amp*(1-Math.cos(a)):mv.amp*Math.sin(a)}
/* ---------------- collision helpers ---------------- */
const clamp=(v,a,b)=>v<a?a:v>b?b:v;
function sphereBox(px,py,pz,r,b){
  const cx=clamp(px,b[0],b[3]),cy=clamp(py,b[1],b[4]),cz=clamp(pz,b[2],b[5]);
  const dx=px-cx,dy=py-cy,dz=pz-cz,d2=dx*dx+dy*dy+dz*dz;
  if(d2>r*r)return null;
  if(d2>1e-10){const d=Math.sqrt(d2);return{nx:dx/d,ny:dy/d,nz:dz/d,pen:r-d}}
  const o=[[px-b[0],-1,0,0],[b[3]-px,1,0,0],[py-b[1],0,-1,0],[b[4]-py,0,1,0],[pz-b[2],0,0,-1],[b[5]-pz,0,0,1]];
  let m=o[0];for(const q of o)if(q[0]<m[0])m=q;return{nx:m[1],ny:m[2],nz:m[3],pen:m[0]+r};
}

function segHitsBox(a,b,bx,pad){
  let t0=0,t1=1;const d=[b.x-a.x,b.y-a.y,b.z-a.z],o=[a.x,a.y,a.z];
  for(let k=0;k<3;k++){const mn=bx[k]-pad,mx=bx[k+3]+pad;
    if(Math.abs(d[k])<1e-9){if(o[k]<mn||o[k]>mx)return false;continue}
    let u=(mn-o[k])/d[k],v=(mx-o[k])/d[k];if(u>v){const t=u;u=v;v=t}t0=Math.max(t0,u);t1=Math.min(t1,v);if(t0>t1)return false}
  return true;
}
/* ---------------- climber ---------------- */
class Climber{
  constructor(i){this.i=i;this.reset(0,0,0)}
  reset(x,y,z){Object.assign(this,{x,y,z,vx:0,vy:0,vz:0,yaw:Math.PI/2,ground:null,grounded:false,brace:false,hang:false,mantle:null,reel:0,airT:0,landed:0,jumped:0,onHead:false})}
  get im(){return this.brace&&this.grounded?1/CFG.braceMass:1}
}

/* ---------------- rope ----------------
   Two chains share the same ends:
   - the "band" is pulled tight like a rubber band and wraps around rock edges.
     Its length is the real rope path, so it decides the pull (tension) and the
     direction each climber is pulled (that's how ledges work as pulleys).
   - the "drape" hangs with gravity and is what you see. */
class Rope{
  constructor(n=18){this.n=n;const mk=()=>Array.from({length:n},()=>({x:0,y:0,z:0}));this.p=mk();this.o=mk();this.q=mk();
    this.len=0;this.t=0;this.dA={x:1,y:0,z:0};this.dB={x:-1,y:0,z:0}}
  reset(a,b){for(let i=0;i<this.n;i++){const t=i/(this.n-1),v={x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,z:a.z+(b.z-a.z)*t};Object.assign(this.p[i],v);Object.assign(this.o[i],v);Object.assign(this.q[i],v)}}
  push(p,boxes,r){for(const bx of boxes){if(bx.off)continue;if(p.x<bx[0]-r||p.x>bx[3]+r||p.y<bx[1]-r||p.y>bx[4]+r||p.z<bx[2]-r||p.z>bx[5]+r)continue;const h=sphereBox(p.x,p.y,p.z,r,bx);if(h){p.x+=h.nx*h.pen;p.y+=h.ny*h.pen;p.z+=h.nz*h.pen}}}
  step(dt,a,b,L,boxes){
    const n=this.n,Q=this.q;
    // 1) the tight band: each point slides toward the middle of its neighbours, then out of rock
    Object.assign(Q[0],a);Object.assign(Q[n-1],b);
    if(!boxes.some(bx=>!bx.off&&segHitsBox(a,b,bx,.02)))for(let i=1;i<n-1;i++){const t=i/(n-1);Q[i].x=a.x+(b.x-a.x)*t;Q[i].y=a.y+(b.y-a.y)*t;Q[i].z=a.z+(b.z-a.z)*t}
    for(let it=0;it<24;it++){
      for(let i=1;i<n-1;i++){const p=Q[i],l=Q[i-1],r=Q[i+1];p.x+=((l.x+r.x)/2-p.x)*.9;p.y+=((l.y+r.y)/2-p.y)*.9;p.z+=((l.z+r.z)/2-p.z)*.9}
      for(let i=1;i<n-1;i++)this.push(Q[i],boxes,.06);
    }
    let len=0;for(let i=0;i<n-1;i++)len+=Math.hypot(Q[i+1].x-Q[i].x,Q[i+1].y-Q[i].y,Q[i+1].z-Q[i].z);
    this.len=len;this.t=Math.max(0,len-L);
    const dir=(from,step,out)=>{let k=from+step;while(k>0&&k<n-1&&Math.hypot(Q[k].x-Q[from].x,Q[k].y-Q[from].y,Q[k].z-Q[from].z)<.3)k+=step;
      const dx=Q[k].x-Q[from].x,dy=Q[k].y-Q[from].y,dz=Q[k].z-Q[from].z,d=Math.hypot(dx,dy,dz);if(d>1e-6){out.x=dx/d;out.y=dy/d;out.z=dz/d}};
    dir(0,1,this.dA);dir(n-1,-1,this.dB);
    // 2) the visible drape: verlet with gravity, never longer than the rope
    const P=this.p,O=this.o,seg=Math.max(L,len)/(n-1),g=CFG.g*dt*dt;
    Object.assign(P[0],a);Object.assign(P[n-1],b);
    for(let i=1;i<n-1;i++){const p=P[i],o=O[i],vx=(p.x-o.x)*.97,vy=(p.y-o.y)*.97,vz=(p.z-o.z)*.97;o.x=p.x;o.y=p.y;o.z=p.z;p.x+=vx;p.y+=vy-g;p.z+=vz}
    for(let it=0;it<10;it++){
      for(let i=0;i<n-1;i++){const p=P[i],q=P[i+1],dx=q.x-p.x,dy=q.y-p.y,dz=q.z-p.z,d=Math.sqrt(dx*dx+dy*dy+dz*dz);if(d<=seg||d<1e-9)continue;
        const wa=i===0?0:1,wb=i+1===n-1?0:1;if(!wa&&!wb)continue;const k=(d-seg)/d/(wa+wb);
        p.x+=dx*k*wa;p.y+=dy*k*wa;p.z+=dz*k*wa;q.x-=dx*k*wb;q.y-=dy*k*wb;q.z-=dz*k*wb}
      if(it%3===0)for(let i=1;i<n-1;i++)this.push(P[i],boxes,.06);
    }
  }
}

/* ---------------- the physics world ---------------- */
class Physics{
  constructor(course){
    this.course=course||COURSE;this.t=0;
    this.boxes=this.course.boxes.map(b=>Object.assign(b.slice(),{id:b.id,kind:b.kind,off:false,st:'idle',t0:0,mv:b.mv||null,hz:!!b.hz,base:b.slice(0,6),dx:0,dy:0,dz:0}));
    this.movers=this.boxes.filter(b=>b.mv);this.setMovers(0);
    this.c=[new Climber(0),new Climber(1)];this.rope=new Rope();this.ropeLen=CFG.ropeLen;
    this.events=[];       // things the game should react to (sounds, crumbles, landings)
  }
  /* moving boxes follow a fixed timetable (seconds since the climb started), so both players see them in the same place */
  setMovers(t){this.t=t;for(const b of this.movers){const o=moverOffset(b.mv,t),k=b.mv.ax==='x'?0:b.mv.ax==='y'?1:2;
      const nb=[b.base[0],b.base[1],b.base[2],b.base[3],b.base[4],b.base[5]];nb[k]+=o;nb[k+3]+=o;
      b.dx=nb[0]-b[0];b.dy=nb[1]-b[1];b.dz=nb[2]-b[2];for(let i=0;i<6;i++)b[i]=nb[i]}}
  /* where box b will be at time t (for the bot planning a jump onto a moving rock) */
  boxAt(b,t){if(!b.mv)return b;const o=moverOffset(b.mv,t),k=b.mv.ax==='x'?0:b.mv.ax==='y'?1:2,nb=b.base.slice();nb[k]+=o;nb[k+3]+=o;return nb}
  spawnAt(cp,only){const C=this.course.cps[cp];this.ropeGrace=.6;[-1,1].forEach((k,i)=>{if(only==null||only===i)this.c[i].reset(C.x+k*.4,C.y+.02,C.z+k*.9)});this.rope.reset(this.waist(this.c[0]),this.waist(this.c[1]))}
  waist(c){return{x:c.x,y:c.y+CFG.waist,z:c.z}}
  /* one fixed step. inputs[i] = {mx,mz (world dir), jump, jumpHeld, brace, climb, local} ; remote = online partner state or null */
  step(dt,inputs,opts){
    const now=opts.now||0;this.bothLocal=!!(inputs[0]&&inputs[0].local&&inputs[1]&&inputs[1].local);
    if(this.movers.length){this.setMovers(opts.t!=null?opts.t:this.t+dt);
      // standing on a moving rock carries you with it
      for(let i=0;i<2;i++){const c=this.c[i],g=c.ground;if(inputs[i]&&inputs[i].local&&c.grounded&&g&&g.mv&&!c.mantle){c.x+=g.dx;c.y+=g.dy;c.z+=g.dz}}}
    for(let i=0;i<2;i++){const c=this.c[i],I=inputs[i];if(!I||!I.local)continue;this.move(c,I,dt)}
    for(let i=0;i<2;i++){const c=this.c[i];if(inputs[i]&&inputs[i].local&&!c.mantle)this.collide(c,i)}
    this.ropeStep(dt,inputs);
    for(let i=0;i<2;i++){const c=this.c[i];if(inputs[i]&&inputs[i].local&&!c.mantle)this.collide(c,i,true)}
    for(let i=0;i<2;i++){const c=this.c[i],I=inputs[i];if(!I||!I.local)continue;this.tryMantle(c,I);this.post(c,I,dt,this.c[1-i])}
    this.crumbles(now,opts.auth);
  }
  move(c,I,dt){
    if(c.mantle){const m=c.mantle;m.t+=dt/CFG.mantleT;const k=Math.min(1,m.t),e=k*k*(3-2*k);
      c.x=m.x0+(m.x1-m.x0)*e;c.z=m.z0+(m.z1-m.z0)*e;c.y=m.y0+(m.y1-m.y0)*Math.min(1,e*1.6);c.vx=c.vy=c.vz=0;
      if(k>=1){c.mantle=null;c.grounded=true;c.reel=0;this.events.push({k:'mantle',i:c.i})}return}
    const run=CFG.run,mag=Math.hypot(I.mx,I.mz),dx=mag>1?I.mx/mag:I.mx,dz=mag>1?I.mz/mag:I.mz;
    c.brace=!!I.brace&&c.grounded;
    const ice=c.grounded&&c.ground&&c.ground.kind==='i';
    if(c.brace){const k=Math.min(1,CFG.brakeG*(ice?.3:1)*dt);c.vx-=c.vx*k;c.vz-=c.vz*k}
    else if(c.hang){
      // hanging: steer pumps the swing; push away from a wall you're touching to kick off it
      c.vx+=dx*CFG.pump*dt;c.vz+=dz*CFG.pump*dt;
      c.kickCd=Math.max(0,(c.kickCd||0)-dt);
      if(c.wallN&&c.kickCd<=0&&mag>.3&&dx*c.wallN.x+dz*c.wallN.z>.4){c.vx+=c.wallN.x*CFG.kick+dx*2;c.vz+=c.wallN.z*CFG.kick+dz*2;c.vy+=2.5;c.kickCd=.7;this.events.push({k:'kick',i:c.i})}
    }else{
      const acc=c.grounded?(ice?CFG.accG*.16:CFG.accG):CFG.accA,tx=dx*run,tz=dz*run,ex=tx-c.vx,ez=tz-c.vz,el=Math.hypot(ex,ez),st=acc*dt;
      if(el>st){c.vx+=ex/el*st;c.vz+=ez/el*st}else{c.vx=tx;c.vz=tz}
    }
    if(I.jump&&c.grounded&&!c.brace){c.vy=CFG.jumpV;c.grounded=false;c.ground=null;c.jumped=1;this.events.push({k:'jump',i:c.i})}
    c.vy=Math.max(-CFG.maxFall,c.vy-CFG.g*dt);
    c.x+=c.vx*dt;c.y+=c.vy*dt;c.z+=c.vz*dt;
    if(Math.hypot(c.vx,c.vz)>.6&&!c.hang)c.yaw=Math.atan2(c.vx,c.vz);
  }
  collide(c,i,second){
    const R=CFG.R,hs=[R,CFG.H/2,CFG.H-R];let grounded=false,gb=null,onHead=false,wall=null;
    const other=this.c[1-i],heads=[[other.x-.42,other.y+CFG.H-.12,other.z-.42,other.x+.42,other.y+CFG.H,other.z+.42]];heads[0].head=true;
    for(let pass=0;pass<3;pass++)for(const h of hs){
      for(const b of this.boxes.concat(this.headOK(c,other)?heads:[])){
        if(b.off)continue;
        if(c.x+R<b[0]||c.x-R>b[3]||c.z+R<b[2]||c.z-R>b[5]||c.y+h+R<b[1]||c.y+h-R>b[4])continue;
        const r=sphereBox(c.x,c.y+h,c.z,R,b);if(!r)continue;
        // feet on ground: push straight up (no sliding off ledge corners); everything else: push out along the contact
        if(h===R&&r.ny>.6)c.y+=r.pen/r.ny;else{c.x+=r.nx*r.pen;c.y+=r.ny*r.pen;c.z+=r.nz*r.pen}
        const vn=c.vx*r.nx+c.vy*r.ny+c.vz*r.nz;if(vn<0){c.vx-=r.nx*vn;c.vy-=r.ny*vn;c.vz-=r.nz*vn}
        if(r.ny>.6&&h===R){grounded=true;if(b.head)onHead=true;else gb=b}
        if(Math.abs(r.ny)<.3)wall={x:r.nx,z:r.nz};
      }
    }
    // climbers bump each other sideways
    const dx=c.x-other.x,dz=c.z-other.z,d=Math.hypot(dx,dz);
    if(d<2*R&&d>1e-4&&Math.abs(c.y-other.y)<CFG.H-.15){const p=(2*R-d)*c.im/(c.im+other.im);c.x+=dx/d*p;c.z+=dz/d*p}
    if(second){c.grounded=c.grounded||grounded;if(gb)c.ground=gb;c.onHead=c.onHead||onHead;if(wall)c.wallN=wall;return}
    c.wallN=wall;
    const was=c.grounded;c.grounded=grounded;c.ground=gb;c.onHead=onHead;
    if(grounded&&!was&&c.airT>.25)this.events.push({k:'land',i:c.i,v:c.airT});
  }
  headOK(c,o){return c.y>o.y+CFG.H-.45&&Math.hypot(c.x-o.x,c.z-o.z)<.8}
  ropeStep(dt,inputs){
    const A=this.c[0],Bc=this.c[1],r=this.rope;
    const L=Math.max(CFG.ropeMin,CFG.ropeLen-A.reel-Bc.reel);this.ropeLen=L;
    // just after a respawn/teleport the rope lies loose for a moment (the partner's position may still be catching up)
    if(this.ropeGrace>0){this.ropeGrace-=dt;r.reset(this.waist(A),this.waist(Bc));this.tension=0;A.hang=Bc.hang=false;return}
    r.step(dt,this.waist(A),this.waist(Bc),L,this.boxes);
    const t=Math.min(r.t,1.2);this.tension=r.t;
    for(const c of[A,Bc])c.hang=false;
    // hanging = off the ground with the rope (nearly) taut and pulling you upward
    const near=r.len>=L-.06;
    if(near&&!A.grounded&&!A.mantle&&r.dA.y>.35){A.hang=true;if(Math.hypot(r.dA.x,r.dA.z)>.08)A.yaw=Math.atan2(r.dA.x,r.dA.z)}
    if(near&&!Bc.grounded&&!Bc.mantle&&r.dB.y>.35){Bc.hang=true;if(Math.hypot(r.dB.x,r.dB.z)>.08)Bc.yaw=Math.atan2(r.dB.x,r.dB.z)}
    if(t<=1e-4)return;
    const la=inputs[0]&&inputs[0].local,lb=inputs[1]&&inputs[1].local,imA=A.im,imB=Bc.im,sum=imA+imB;
    const wA=imA/sum,wB=imB/sum,dA=r.dA,dB=r.dB,k=.55;
    const dig=c=>c.brace&&c.grounded?.25:1,cap=v=>Math.min(v,.05);
    if(la){const f=cap(t*wA*k)*dig(A),fy=cap(t*wA*k);A.x+=dA.x*f;A.y+=dA.y*fy;A.z+=dA.z*f}
    if(lb){const f=cap(t*wB*k)*dig(Bc),fy=cap(t*wB*k);Bc.x+=dB.x*f;Bc.y+=dB.y*fy;Bc.z+=dB.z*f}
    const sep=-(A.vx*dA.x+A.vy*dA.y+A.vz*dA.z)-(Bc.vx*dB.x+Bc.vy*dB.y+Bc.vz*dB.z);
    if(sep>0){const j=sep/sum;
      if(la){A.vx+=dA.x*j*imA;A.vy+=dA.y*j*imA;A.vz+=dA.z*j*imA}
      if(lb){Bc.vx+=dB.x*j*imB;Bc.vy+=dB.y*j*imB;Bc.vz+=dB.z*j*imB}}
    if(t>.35)this.events.push({k:'taut',t});
  }
  tryMantle(c,I){
    if(c.mantle||c.brace)return;
    const want=Math.hypot(I.mx,I.mz)>.3||(c.hang&&I.climb);if(!want)return;
    const mv=Math.hypot(I.mx,I.mz)>.3,fx=mv?I.mx:Math.sin(c.yaw),fz=mv?I.mz:Math.cos(c.yaw),fl=Math.hypot(fx,fz)||1;
    const o=this.c[1-c.i];
    for(const b of this.boxes){if(b.off)continue;
      const top=b[4],rise=top-c.y;if(rise<CFG.mantleMin||rise>CFG.mantleMax+(c.hang||c.climbing?.25:0))continue;
      // close enough to the box's side, and facing it
      const cx=clamp(c.x,b[0],b[3]),cz=clamp(c.z,b[2],b[5]),dx=cx-c.x,dz=cz-c.z,d=Math.hypot(dx,dz);
      if(d>CFG.R+.22||d<1e-4)continue;
      if((dx*fx+dz*fz)/(d*fl)<.35)continue;
      // landing spot a little onto the top (beside your partner if they're standing right there), with room above it
      const ux=fx/fl,uz=fz/fl,spots=[[0,0],[-uz*.8,ux*.8],[uz*.8,-ux*.8],[-uz*1.4,ux*1.4],[uz*1.4,-ux*1.4]];let tx=null,tz=null;
      for(const[sx,sz] of spots){const x=clamp(c.x+ux*.55+sx,b[0]+.3,b[3]-.3),z=clamp(c.z+uz*.55+sz,b[2]+.3,b[5]-.3);
        if(this.boxes.some(q=>q!==b&&!q.off&&x>q[0]-.3&&x<q[3]+.3&&z>q[2]-.3&&z<q[5]+.3&&q[1]<top+CFG.H&&q[4]>top+.05))continue;
        if(Math.hypot(x-o.x,z-o.z)<.75&&Math.abs(o.y-top)<1.2)continue;tx=x;tz=z;break}
      if(tx==null)continue;
      c.mantle={t:0,x0:c.x,y0:c.y,z0:c.z,x1:tx,y1:top+.01,z1:tz};c.hang=false;this.events.push({k:'grab',i:c.i});return;
    }
  }
  post(c,I,dt,o){
    // climb the rope: hold JUMP while your partner is above you (hanging, or standing below their ledge)
    const above=o.y>c.y+.9;
    if(I.climb&&!c.brace&&!c.mantle&&(c.hang||above)){c.reel=Math.min(CFG.ropeLen-CFG.ropeMin,c.reel+CFG.reelUp*dt);c.climbing=true}else c.climbing=false;
    // standing on solid ground lets the rope pay back out to full length
    if(!c.climbing&&c.grounded)c.reel=Math.max(0,c.reel-CFG.reelDown*dt);
    c.airT=c.grounded?0:c.airT+dt;
  }
  crumbles(now,auth){
    for(const b of this.boxes){if(b.kind!=='c')continue;
      if(b.st==='shake'&&now-b.t0>=CFG.crShake){b.st='fall';b.off=true;this.events.push({k:'crfall',id:b.id})}
      else if(b.st==='fall'&&now-b.t0>=CFG.crShake+CFG.crBack){b.st='idle';b.off=false;this.events.push({k:'crback',id:b.id})}}
    for(const c of this.c){const g=c.ground;if(g&&g.kind==='c'&&g.st==='idle'&&c.grounded)this.events.push({k:'crstep',id:g.id,i:c.i})}
  }
  startCrumble(id,t0){const b=this.boxes[id];if(!b||b.kind!=='c')return;if(b.st!=='idle'&&!(b.st==='fall'&&t0>b.t0+CFG.crShake))return;b.st='shake';b.t0=t0;b.off=false}
}

/* ---------------- the solo partner bot ----------------
   Drives the climber you're not controlling. It walks the route (course.path, box by box) and
   reacts to what you are doing, one situation at a time:
     anchor  you're in the air, hanging, or the rope is pulling   → it braces
     boost   you're at a wall too tall to climb                     → it stands at the foot so you can jump on its head
     haul    you're on top of a wall it can't climb                 → once you brace, it holds JUMP and climbs the rope
     cross   you're across a gap too wide to jump                    → once you brace, it leaps and swings over
     ride    moving rocks and the rock lift                          → it waits until one lines up, then hops on / off
     follow  everything else: hop the gaps and steps behind you, never walking off an edge by accident
   bot.say holds a short line for the HUD when it needs something from you. */
const maxJump=dy=>dy>=0?5.2-.6*dy:5.2-.4*dy;
class Bot{
  constructor(P){this.P=P;this.pos={};P.course.path.forEach((id,i)=>this.pos[id]=i);this.reset()}
  reset(){this.st='follow';this.say='';this.myIdx=0;this.leadIdx=0;this.jdir=null;this.best=1e9;this.stuckT=0;this.lastGoal=null;this.hopT=0}
  box(i){const id=this.P.course.path[i];return id==null?null:this.P.boxes[id]}
  /* the highest solid top under (x,z) at or below height y */
  topBelow(x,z,y,pad=0){let best=null;for(const b of this.P.boxes){if(b.off||b.hz)continue;if(x<b[0]-pad||x>b[3]+pad||z<b[2]-pad||z>b[5]+pad)continue;if(b[4]>y+.12)continue;if(!best||b[4]>best[4])best=b}return best}
  idxOf(c,prev){
    let b=c.grounded&&c.ground&&!c.ground.hz?c.ground:null;
    if(!b){const q=this.topBelow(c.x,c.z,c.y+.05);if(q&&c.y-q[4]<3)b=q}
    if(b&&this.pos[b.id]!=null)return this.pos[b.id];return prev;
  }
  near(b,x,z,inset){const ix=Math.min(inset,(b[3]-b[0])/2-.01),iz=Math.min(inset,(b[5]-b[2])/2-.01);return{x:clamp(x,b[0]+ix,b[3]-ix),z:clamp(z,b[2]+iz,b[5]-iz)}}
  gapTo(b,x,z){const dx=Math.max(b[0]-x,0,x-b[3]),dz=Math.max(b[2]-z,0,z-b[5]);return Math.hypot(dx,dz)}
  steer(I,c,gx,gz,slow=1){const dx=gx-c.x,dz=gz-c.z,d=Math.hypot(dx,dz);if(d<.12)return 0;const k=Math.min(1,d/slow);I.mx=dx/d*k;I.mz=dz/d*k;return d}
  safeAhead(c,I,dist=.6){const m=Math.hypot(I.mx,I.mz);if(m<.05)return true;const x=c.x+I.mx/m*dist,z=c.z+I.mz/m*dist,g=this.topBelow(x,z,c.y+.3);return!!g&&g[4]>c.y-.7}
  think(c,a,dt){
    const P=this.P,I={mx:0,mz:0,jump:false,climb:false,brace:false,local:true};this.say='';
    this.myIdx=this.idxOf(c,this.myIdx);this.leadIdx=this.idxOf(a,this.leadIdx);
    if(c.mantle)return I;
    const lStable=(a.grounded||a.mantle)&&!a.hang,lAbove=a.y-c.y;
    // ---------- in the air or hanging ----------
    if(!c.grounded){
      // hanging, or pinned against a ledge by a short rope: reach for the ledge (that's what triggers the pull-up)
      if(c.hang||!this.jdir||(c.reel>1&&c.vy>-2)){const tb=(lStable&&this.box(this.leadIdx))||this.box(this.myIdx+1);   // the rope runs to you: climb to your rock
        let g=tb?this.near(tb,c.x,c.z,.4):{x:a.x,z:a.z};
        // you're standing where I'd climb up: go for the far side of the rock instead (and ask for room)
        if(tb&&Math.hypot(g.x-a.x,g.z-a.z)<1.1&&Math.abs(a.y-tb[4])<.3){const fx=a.x<(tb[0]+tb[3])/2?tb[3]:tb[0],fz=a.z<(tb[2]+tb[5])/2?tb[5]:tb[2];
          g=this.near(tb,fx,fz,.4);this.hangT=(this.hangT||0)+dt;if(this.hangT>1.5)this.say='Make room so I can climb up!'}else this.hangT=0;
        // stuck right under a floating slab: swing out past its nearest edge before climbing any further
        let under=false;if(tb&&c.x>tb[0]-.2&&c.x<tb[3]+.2&&c.z>tb[2]-.2&&c.z<tb[5]+.2&&c.y+CFG.H>tb[1]-.3&&c.y<tb[4]-.2){under=true;
          const e=[[tb[0]-.9,c.z,c.x-tb[0]],[tb[3]+.9,c.z,tb[3]-c.x],[c.x,tb[2]-.9,c.z-tb[2]],[c.x,tb[5]+.9,tb[5]-c.z]].sort((p,q)=>p[2]-q[2])[0];g={x:e[0],z:e[1]}}
        this.steer(I,c,g.x,g.z,.5);if(!under){I.mx*=.85;I.mz*=.85}
        I.climb=c.hang&&lStable&&lAbove>-.4&&!under;this.st='hang';}
      else if(this.jdir){I.mx=this.jdir.x;I.mz=this.jdir.z}
      return I}
    this.jdir=null;this.hopT=Math.max(0,this.hopT-dt);
    // ---------- what's next on the route ----------
    const ahead=this.leadIdx>this.myIdx,cur=this.box(this.myIdx),nxt=ahead?this.box(this.myIdx+1):null;
    const nb=nxt&&(nxt.mv?P.boxAt(nxt,P.t+.5):nxt),rise=nb?nb[4]-c.y:0,gap=nb?this.gapTo(nb,c.x,c.z):0;
    // haul: you're up a wall I can't climb → climb the rope once you brace (checked before "anchor":
    // my own climbing makes the rope taut, and that mustn't make me stop)
    if(nxt&&!nxt.mv&&rise>2.5&&gap<1.4&&lAbove>1.6&&lStable){
      this.st='haul';const g=this.near(cur,c.x+(nb[0]-c.x)*2,c.z,.25);this.steer(I,c,clamp(g.x,cur[0]+.3,cur[3]-.3),clamp(a.z,cur[2]+.4,cur[5]-.4),.4);
      if(!this.safeAhead(c,I,.45)){I.mx=I.mz=0}
      if(gap<.7||this.wallTouch(c,nb)){if(a.brace){I.climb=true;const d=this.steer(I,c,nb[0]+.6,clamp(c.z,nb[2]+.4,nb[5]-.4),.3)}else this.say='Hold BRACE up there and I\'ll climb the rope'}
      return I}
    // ---------- anchor ----------
    if(a.hang||P.tension>.08){I.brace=true;this.st='anchor';return I}
    if(!a.grounded&&!a.mantle){const g=this.topBelow(a.x,a.z,a.y);if(!g||a.y-g[4]>1.25||a.vy<-7){I.brace=true;this.st='anchor';return I}}
    if(a.onHead){this.st='boost';return I}   // you're standing on me: hold still
    // hazards sweeping across my ledge: hop over a log that's about to hit me
    if(this.hopT<=0)for(const h of P.movers){if(!h.hz)continue;const f=P.boxAt(h,P.t+.28);if(c.x>f[0]-.5&&c.x<f[3]+.5&&c.z>f[2]-.55&&c.z<f[5]+.55&&c.y<f[4]&&c.y>f[1]-.5){I.jump=true;this.hopT=.6;this.jdir={x:1,z:0};I.mx=.6;return I}}
    if(!nxt){
      // same box as you (or you're behind me): stay close, but leave you room
      this.st='follow';const dx=a.x-c.x,dz=a.z-c.z,d=Math.hypot(dx,dz);
      if(d>2.4&&this.leadIdx>=this.myIdx){this.steer(I,c,a.x-dx/d*1.6,a.z-dz/d*1.6,.8);if(!this.safeAhead(c,I))I.mx=I.mz=0}
      return I}
    // boost: you're at the foot of a wall that needs a head-stand → stand right at it
    if(!nxt.mv&&rise>2.5){
      const lw=this.gapTo(nb,a.x,a.z);
      if(this.leadIdx>this.myIdx+0&&lAbove>1.6){/* handled by haul once I reach the wall */const g=this.near(cur,nb[0]-.4,clamp(a.z,cur[2]+.4,cur[5]-.4),.3);this.steer(I,c,g.x,g.z,.5);if(!this.safeAhead(c,I,.4))I.mx=I.mz=0;this.st='haul';return I}
      this.st='boost';
      const z=clamp(a.z+(Math.abs(c.z-a.z)<.5?(a.z>0?-.95:.95):0),cur[2]+.45,cur[5]-.45),wx=nb[0]-.42;
      const d=this.steer(I,c,wx,lw<1.6?z:clamp(a.z,cur[2]+.45,cur[5]-.45),.35);
      if(d<.2){I.mx=I.mz=0;if(lw<2.6)this.say='Jump on my head, then up the wall!'}
      return I}
    // crumbling slabs: one at a time
    if(nxt.kind==='c'&&cur&&cur.kind!=='c'){const lOn=a.ground&&a.ground.kind==='c';
      if(nxt.off||nxt.st!=='idle'||lOn){this.st='wait';const g=this.near(cur,nb[0],c.z,.8);this.steer(I,c,g.x,g.z,.5);if(!this.safeAhead(c,I,.5))I.mx=I.mz=0;
        if(nxt.off&&this.leadIdx>this.myIdx+1)return this.cross(I,c,a,cur,nb);return I}}
    // the rock lift
    if(nxt.mv&&nxt.mv.ax==='y'){this.st='ride';const now=nxt;   // where it is right now
      if(c.ground===nxt){I.mx=I.mz=0;return I}
      const level=Math.abs(now[4]-c.y)<.22&&Math.abs(P.boxAt(nxt,P.t+.7)[4]-c.y)<.45;
      const g=this.near(now,c.x,c.z,.7);if(level){this.steer(I,c,g.x,g.z,.3)}else{const e=this.near(cur,now[0],c.z,.5);this.steer(I,c,e.x,e.z,.4);if(!this.safeAhead(c,I,.4))I.mx=I.mz=0}
      return I}
    if(cur&&cur.mv&&cur.mv.ax==='y'&&c.ground===cur){   // riding the lift: step off at the top
      if(cur[4]>=nb[4]-.06){this.steer(I,c,nb[0]+1.2,clamp(c.z,nb[2]+.5,nb[5]-.5),.4)}return I}
    // a gap to the next box
    if(gap>.42||rise<-1.6){
      const need=gap,can=need<=maxJump(rise)*.8&&rise<1.6;
      if(!can)return this.cross(I,c,a,cur,nb);
      this.st=nxt.mv?'ride':'follow';
      const land=this.near(nb,c.x,c.z,.6),edge=this.near(cur,land.x,land.z,.32);
      const toEdge=Math.hypot(edge.x-c.x,edge.z-c.z);
      if(toEdge>.35&&!this.atEdge(c,land)){this.steer(I,c,edge.x,edge.z,.45);if(!this.safeAhead(c,I,.35))I.mx=I.mz=0;return I}
      // at the edge: if it's a moving rock, wait until it will be under me when I land
      if(nxt.mv){const t=P.t+.55,f=P.boxAt(nxt,t),lp=this.near(f,c.x,c.z,.6),ok=lp.x>f[0]+.35&&lp.x<f[3]-.35&&lp.z>f[2]+.35&&lp.z<f[5]-.35&&Math.abs(lp.z-c.z)<1.6;
        if(!ok){this.face(I,c,lp);return I}
        const dx=lp.x-c.x,dz=lp.z-c.z,d=Math.hypot(dx,dz)||1;I.jump=true;I.mx=dx/d;I.mz=dz/d;this.jdir={x:I.mx,z:I.mz};return I}
      const dx=land.x-c.x,dz=land.z-c.z,d=Math.hypot(dx,dz)||1;I.jump=true;I.mx=dx/d;I.mz=dz/d;this.jdir={x:I.mx,z:I.mz};return I}
    // walking (and hopping up small steps) onto the next box
    this.st='follow';const g=this.near(nb,c.x,c.z,.6);const d=this.steer(I,c,g.x,g.z,.3);
    if(rise>.25&&(this.wallTouch(c,nb)||this.gapTo(nb,c.x,c.z)<.55)){I.jump=true;this.jdir={x:I.mx,z:I.mz}}
    else if(!this.safeAhead(c,I,.5)&&rise<.25&&gap>.05){I.jump=true;this.jdir={x:I.mx,z:I.mz}}
    // stuck? try a jump, then give up for a while
    if(d>this.best-.25){this.stuckT+=dt;if(this.stuckT>2.2){I.jump=true;this.jdir={x:I.mx,z:I.mz};this.stuckT=0;this.best=1e9}}else{this.best=d;this.stuckT=0}
    return I;
  }
  /* standing at a drop-off in the direction of p? (then I can take off from right here) */
  atEdge(c,p){const dx=p.x-c.x,dz=p.z-c.z,d=Math.hypot(dx,dz)||1,x=c.x+dx/d*.5,z=c.z+dz/d*.5,g=this.topBelow(x,z,c.y+.3);return!g||g[4]<c.y-.7}
  wallTouch(c,b){return c.wallN&&this.gapTo(b,c.x,c.z)<.6}
  face(I,c,p){const dx=p.x-c.x,dz=p.z-c.z,d=Math.hypot(dx,dz)||1;I.mx=dx/d*.02;I.mz=dz/d*.02}
  /* too far to jump: get to the edge, wait for you to brace, then leap and let the rope swing me over */
  cross(I,c,a,cur,nb){
    this.st='cross';const land=this.near(nb,c.x,c.z,.6),edge=cur?this.near(cur,land.x,land.z,.3):{x:c.x,z:c.z},toEdge=Math.hypot(edge.x-c.x,edge.z-c.z);
    const across=this.leadIdx>this.myIdx&&(a.grounded||a.mantle);
    if(toEdge>.35&&!this.atEdge(c,land)){this.steer(I,c,edge.x,edge.z,.45);if(!this.safeAhead(c,I,.35))I.mx=I.mz=0;return I}
    if(!across){I.brace=true;return I}
    if(!a.brace){this.say='Too far for me to jump: hold BRACE and I\'ll swing across';return I}
    const dx=land.x-c.x,dz=land.z-c.z,d=Math.hypot(dx,dz)||1;I.jump=true;I.mx=dx/d;I.mz=dz/d;this.jdir={x:I.mx,z:I.mz};return I;
  }
}
root.DWCore={CFG,COURSE,MAPS,makeCourse,moverOffset,Climber,Rope,Physics,sphereBox,Bot};
})(typeof window!=='undefined'?window:globalThis);
