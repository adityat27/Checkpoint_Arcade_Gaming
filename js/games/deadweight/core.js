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

/* ---------------- the mountain ----------------
   Boxes are [x0,y0,z0, x1,y1,z1, kind]; kind 'c' = crumbles after you stand on it.
   The route runs along +x and climbs. Checkpoints sit at the start of each challenge. */
const B=-26;   // rock pillars go way down into the cloudy abyss
const COURSE={
  boxes:[
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
  ],
  cps:[
    {x:2,y:0,z:0,next:'First Steps',tip:'Jump up the steps together. You share a 9 m rope, so stay close!'},
    {x:22.6,y:3,z:0,next:'Boost Wall',tip:'Too high to jump. One climber stands still, the other jumps onto their head and climbs up. Then hold JUMP to climb the rope.'},
    {x:28.4,y:6.2,z:0,next:'The Gap',tip:'Too wide to jump! One BRACES at the edge (hold SHIFT). The other jumps, hangs, climbs a little (hold JUMP) and swings (left/right) to grab the far ledge.'},
    {x:39.4,y:3.2,z:0,next:'Crumble Bridge',tip:'The slabs collapse a second after you land. Cross one at a time while your partner braces.'},
    {x:56.8,y:5,z:0,next:'Cliff Ledges',tip:'Hop up the ledges. If your partner slips, BRACE and let them climb back up.'},
    {x:77,y:12.2,z:0,next:'Big Swing',tip:'Jump onto the pillar and off again before it crumbles. Then swing your partner over.'},
    {x:91,y:9.7,z:0,next:'Summit Ridge',tip:'One last high wall. Head-stand, climb, and reach the flag together!'},
  ],
  summit:{x:109.5,y:14.4,z:0},
  signs:[
    {x:5,y:0,z:-2.6,lines:['W A S D · move','SPACE · jump / climb','hold SHIFT · brace']},
    {x:23.4,y:3,z:-2.4,lines:['TOO HIGH?','Jump on your partner\'s head!']},
    {x:29,y:6.2,z:-2.4,lines:['TOO WIDE?','Brace and swing across!']},
  ],
};
COURSE.boxes.forEach((b,i)=>{b.id=i;b.kind=b[6]||'r'});

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
  constructor(){
    this.boxes=COURSE.boxes.map(b=>Object.assign(b.slice(),{id:b.id,kind:b.kind,off:false,st:'idle',t0:0}));
    this.c=[new Climber(0),new Climber(1)];this.rope=new Rope();this.ropeLen=CFG.ropeLen;
    this.events=[];       // things the game should react to (sounds, crumbles, landings)
  }
  spawnAt(cp,only){const C=COURSE.cps[cp];this.ropeGrace=.6;[-1,1].forEach((k,i)=>{if(only==null||only===i)this.c[i].reset(C.x+k*.4,C.y+.02,C.z+k*.9)});this.rope.reset(this.waist(this.c[0]),this.waist(this.c[1]))}
  waist(c){return{x:c.x,y:c.y+CFG.waist,z:c.z}}
  /* one fixed step. inputs[i] = {mx,mz (world dir), jump, jumpHeld, brace, climb, local} ; remote = online partner state or null */
  step(dt,inputs,opts){
    const now=opts.now||0;this.bothLocal=!!(inputs[0]&&inputs[0].local&&inputs[1]&&inputs[1].local);
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
    if(c.brace){const k=Math.min(1,CFG.brakeG*dt);c.vx-=c.vx*k;c.vz-=c.vz*k}
    else if(c.hang){
      // hanging: steer pumps the swing; push away from a wall you're touching to kick off it
      c.vx+=dx*CFG.pump*dt;c.vz+=dz*CFG.pump*dt;
      c.kickCd=Math.max(0,(c.kickCd||0)-dt);
      if(c.wallN&&c.kickCd<=0&&mag>.3&&dx*c.wallN.x+dz*c.wallN.z>.4){c.vx+=c.wallN.x*CFG.kick+dx*2;c.vz+=c.wallN.z*CFG.kick+dz*2;c.vy+=2.5;c.kickCd=.7;this.events.push({k:'kick',i:c.i})}
    }else{
      const acc=c.grounded?CFG.accG:CFG.accA,tx=dx*run,tz=dz*run,ex=tx-c.vx,ez=tz-c.vz,el=Math.hypot(ex,ez),st=acc*dt;
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
root.DWCore={CFG,COURSE,Climber,Rope,Physics,sphereBox};
})(typeof window!=='undefined'?window:globalThis);
