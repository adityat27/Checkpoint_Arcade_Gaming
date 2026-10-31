/* =========================================================================
   SLIPSTREAM · core (no drawing, so it also runs in node for testing)
   -------------------------------------------------------------------------
   Everything lives in "road space": d = metres driven along the road,
   x = metres from the centre line (+ = right of the direction of travel).
   We drive on the LEFT: lanes 0 and 1 are ours (0 = slow outer lane,
   1 = fast inner lane), lanes 2 and 3 carry oncoming traffic.

   Road      the endless road: its bends and hills come from a seed, and it is
             worked out as you go (from the distance), so it never runs out.
   Traffic   lane-holding traffic. Every lane has its own speed, so cars in one
             lane never bump into each other. Where each car is depends only on
             the seed and the race clock, so two online players see the same cars.
   Driver    your car: throttle, brake, steering, nitro, walls, score.
   Bot       a simple self-driving player, used by the tests.
   ========================================================================= */
(function(root){
'use strict';
const CFG={
  laneX:[-5.4,-1.8,1.8,5.4],   // lane centres (m)
  laneV:[15,21,-20,-15],        // traffic speed in each lane (m/s; minus = coming toward you)
  roadHalf:7.2,                 // asphalt half-width
  shoulder:1.8,                 // gravel strip beyond the asphalt, then the rail / wall
  brake:22,                   // m/s² with the brake on
  coast:1.2,                    // m/s² rolling resistance with no throttle (plus air drag)
  nitroV:14,nitroAcc:1.7,nitroDrain:.24,
  latMax:10.5,latResp:7,        // fastest sideways speed (m/s) and how quickly steering responds
  curveDrift:.16,               // how much a bend pushes you to the outside
  hitShrink:.84,                // hit boxes are a little smaller than the cars (fair to the player)
  nearGap:1.1,                  // pass closer than this (m) = NEAR MISS
  rampDist:9000                 // traffic reaches full density after about this many metres
};
// player cars: top speed (m/s), acceleration, steering, width
const STYLES={
  gt:   {n:'Vento GT',   sub:'Low fastback coupé',     top:66,acc:9.6, steer:1.0, w:1.9, l:4.55},
  hatch:{n:'Pocket R',   sub:'Hot hatch · nimble',     top:58,acc:11.2,steer:1.16,w:1.76,l:3.95},
  suv:  {n:'Ridgeline X',sub:'Big SUV · strong motor', top:61,acc:9.0, steer:.94, w:1.96,l:4.8}
};
// traffic: length / width (m), drawn in cars.js
const VT={sedan:{l:4.5,w:1.82},hatch:{l:3.9,w:1.72},suv:{l:4.8,w:1.95},van:{l:5.2,w:2.0},bus:{l:11.6,w:2.55},truck:{l:9.8,w:2.5}};
const VT_SMALL=[['sedan',38],['hatch',26],['suv',22],['van',14]];

/* ---------- seeded randomness ---------- */
function rng(a){return()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
function hash(a,b){let h=Math.imul(a^0x9e3779b9,0x85ebca6b)^Math.imul(b+0x632be5ab,0xc2b2ae35);h^=h>>>13;h=Math.imul(h,0x27d4eb2f);return(h^h>>>15)>>>0}
const clamp=(v,a,b)=>v<a?a:v>b?b:v,lerp=(a,b,t)=>a+(b-a)*t;
const sstep=(a,b,v)=>{const t=clamp((v-a)/(b-a),0,1);return t*t*(3-2*t)};

/* ---------- the road ---------- */
class Road{
  constructor(seed){
    const r=rng(hash(seed,77));
    this.seed=seed;
    // heading = sum of slow waves (bounded, so the road never loops back); hills the same way
    this.w=[[.34,250+r()*40],[.2,115+r()*25],[.48,1050+r()*300]].map(([a,l])=>[a*(.8+r()*.4),l,r()*6.283]);
    this.env=[2400+r()*800,r()*6.283];
    this.h=[[7,320+r()*60],[3.4,140+r()*30],[11,1400+r()*400]].map(([a,l])=>[a*(.75+r()*.5),l,r()*6.283]);
    this.X=[0];this.Z=[0];   // centre line, sampled every metre (worked out as needed)
  }
  theta(s){ // heading (radians; + turns right). Starts straight so the countdown view is calm.
    let a=0;for(const[k,l,p]of this.w)a+=k*Math.sin(s/l+p);
    return a*sstep(0,520,s)*(.62+.38*Math.sin(s/this.env[0]+this.env[1]));
  }
  kappa(s){return(this.theta(s+1)-this.theta(s-1))/2}   // curvature (1/m)
  y(s){let h=0;for(const[k,l,p]of this.h)h+=k*Math.sin(s/l+p);return h*sstep(0,320,s)} // height (m)
  slope(s){return(this.y(s+1)-this.y(s-1))/2}
  ensure(s){const n=Math.ceil(s)+2;for(let i=this.X.length;i<=n;i++){const t=this.theta(i-.5);this.X.push(this.X[i-1]+Math.sin(t));this.Z.push(this.Z[i-1]-Math.cos(t))}}
  // world position of the centre line at distance s (x right, z = -forward at the start)
  at(s){
    if(s<0){const t=this.theta(0);return{x:Math.sin(t)*s,z:-Math.cos(t)*s,th:t,y:this.y(0)}}
    this.ensure(s);const i=Math.floor(s),f=s-i;
    return{x:this.X[i]+(this.X[i+1]-this.X[i])*f,z:this.Z[i]+(this.Z[i+1]-this.Z[i])*f,th:this.theta(s),y:this.y(s)};
  }
}

/* ---------- traffic ---------- */
class Traffic{
  constructor(seed){
    this.seed=seed;
    this.lanes=CFG.laneX.map((x,i)=>{const r=rng(hash(seed,1000+i)),v=CFG.laneV[i];
      return{i,x,v,r,list:[],k:0,
        // first car: a clear run-up at the start in our lanes, oncoming traffic a bit further out
        next:i<2?75+r()*55+i*25:330+r()*160,
        // roughly where a player will meet this car, compared to where it started
        meet:v>0?1-v/40:1-v/40}});
  }
  diff(L,z0){return Math.pow(clamp(z0/L.meet/CFG.rampDist,0,1),.8)}
  grow(L,upto){
    while(L.next<upto){
      const u=L.r,df=this.diff(L,L.next),onc=L.v<0;
      let big=lerp(.05,.13,df);if(L.i===1)big*=.4;
      let type;
      if(u()<big)type=u()<.45?'bus':'truck';
      else{let p=u()*100;type='sedan';for(const[t,w]of VT_SMALL){if(p<w){type=t;break}p-=w}}
      const T=VT[type],z0=L.next+T.l/2;
      L.list.push({id:L.i*1e6+L.k++,lane:L.i,type,l:T.l,w:T.w,z0,col:Math.floor(u()*12)});
      // gap to the next car (bumper to bumper): shrinks as you get further down the road
      const min=onc?46:20,mean=onc?lerp(330,96,df):lerp(150,46,df);
      const g=min+Math.min(3*mean,-(mean-min)*Math.log(1-u()*.999));
      L.next=z0+T.l/2+g;
    }
  }
  // cars in lane L whose centre is between zmin and zmax at race time t
  query(t,zmin,zmax,out){
    out=out||[];
    for(const L of this.lanes){
      const sh=L.v*t;this.grow(L,zmax-sh+20);
      const lo=zmin-sh-14,hi=zmax-sh+14,a=L.list;
      let i0=0,i1=a.length;while(i0<i1){const m=(i0+i1)>>1;if(a[m].z0<lo)i0=m+1;else i1=m}
      for(let i=i0;i<a.length&&a[i].z0<=hi;i++){const c=a[i],z=c.z0+sh;if(z>=zmin&&z<=zmax)out.push({c,z,x:L.x,v:L.v})}
    }
    return out;
  }
  // forget cars that are far behind everyone
  trim(t,zmin){for(const L of this.lanes){const lo=zmin-L.v*t-60;let k=0;while(k<L.list.length&&L.list[k].z0<lo)k++;if(k>200)L.list.splice(0,k)}}
}

/* ---------- your car ---------- */
class Driver{
  constructor(style,x){this.style=style;this.S=STYLES[style]||STYLES.gt;this.reset(x)}
  reset(x){
    Object.assign(this,{d:0,x:x==null?CFG.laneX[1]:x,xv:0,v:0,alive:true,pushT:0,nitro:.35,boost:false,
      score:0,top:0,nears:0,combo:0,comboT:0,onc:0,wall:0,shoulder:false,crash:null,mult:1,near:new Map(),t:0});
  }
  hw(){return this.S.w/2}
  // in = {steer -1..1, gas 0..1, brake bool, nitro bool}; returns a list of events for effects/sound
  step(dt,inp,road,traffic,t){
    const ev=[];if(!this.alive)return ev;
    const S=this.S,hw=this.hw();
    // --- speed ---
    this.boost=!!(inp.nitro&&this.nitro>.02&&this.v>10);
    const top=S.top+(this.boost?CFG.nitroV:0),acc=S.acc*(this.boost?CFG.nitroAcc:1);
    let a=0;
    if(inp.brake)a=-CFG.brake;
    else if(inp.gas>0)a=acc*inp.gas*Math.max(0,1-Math.pow(this.v/top,2))-(this.v>top?(this.v-top)*1.5:0);
    else a=-CFG.coast-.00045*this.v*this.v;
    if(this.boost)this.nitro=Math.max(0,this.nitro-CFG.nitroDrain*dt);
    this.shoulder=Math.abs(this.x)>CFG.roadHalf;
    if(this.shoulder)a-=5+(this.v>34?(this.v-34)*.5:0);
    this.v=Math.max(0,this.v+a*dt);
    // --- steering (sideways speed eases toward what you ask for; bends push you outwards) ---
    const lat=CFG.latMax*S.steer*Math.min(1,.42+this.v/38);
    this.xv+=(clamp(inp.steer,-1,1)*lat-this.xv)*Math.min(1,CFG.latResp*dt);
    this.xv-=road.kappa(this.d)*this.v*this.v*CFG.curveDrift*dt;
    this.x+=this.xv*dt;
    const lim=CFG.roadHalf+CFG.shoulder-hw;
    if(Math.abs(this.x)>lim){this.x=Math.sign(this.x)*lim;this.xv=-this.xv*.25;this.v=Math.max(0,this.v-14*dt);this.wall+=dt;ev.push({k:'wall',side:Math.sign(this.x)})}
    // --- forward ---
    const ds=this.v*dt;this.d+=ds;this.t=t;
    this.top=Math.max(this.top,this.v);
    const onc=this.x>.6;   // more than half over the centre line
    if(onc&&this.v>16){this.onc+=ds;this.nitro=Math.min(1,this.nitro+.05*dt)}
    this.nitro=Math.min(1,this.nitro+.018*dt);
    this.mult=Math.max(1,.5+this.v/40)*(onc&&this.v>16?2:1);   // faster = more points per metre (never below ×1)
    this.score+=ds*this.mult;
    if(this.comboT>0){this.comboT-=dt;if(this.comboT<=0)this.combo=0}
    if(this.pushT>0)this.pushT-=dt;
    // --- traffic: hits and near misses ---
    const L=S.l,near=traffic.query(t,this.d-20,this.d+20);
    for(const o of near){
      const dz=o.z-this.d,dx=o.x-this.x,c=o.c,reach=(c.l+L)/2;
      const gap=Math.abs(dx)-(c.w+S.w)/2;
      if(Math.abs(dz)<reach*.96&&Math.abs(dx)<(S.w*CFG.hitShrink+c.w*.94)/2){
        // a car going your way that catches you from behind just nudges you along (and honks)
        if(o.v>0&&dz<-reach*.5&&o.v>=this.v-.5){
          this.v=Math.max(this.v,o.v);this.d=o.z+reach*.96+.02;
          if(!(this.pushT>0))ev.push({k:'push',o});this.pushT=.6;continue;
        }
        this.alive=false;this.crash={c,dz,dx,z:o.z,x:o.x,v:o.v,head:dz>0&&o.v<0};ev.push({k:'crash',o});return ev;
      }
      // alongside: remember the closest it got; when it is behind us, judge the pass
      let n=this.near.get(c.id);
      if(Math.abs(dz)<reach+1.5){if(!n){n={g:gap,onc:o.v<0};this.near.set(c.id,n)}else n.g=Math.min(n.g,gap)}
      else if(n&&dz<0){
        this.near.delete(c.id);
        if(n.g<CFG.nearGap&&this.v>18){
          this.nears++;this.combo=Math.min(this.combo+1,5);this.comboT=3.5;
          const pts=(n.onc?250:100)*this.combo*(n.g<.45?2:1);
          this.score+=pts;this.nitro=Math.min(1,this.nitro+(n.onc?.25:.15));
          ev.push({k:'near',pts,onc:n.onc,close:n.g<.45,combo:this.combo,type:c.type});
        }
      }
    }
    if(this.near.size>40)for(const[k]of this.near){this.near.delete(k);if(this.near.size<20)break}
    return ev;
  }
}

/* ---------- a simple self-driving player (used by the tests) ---------- */
class Bot{
  constructor(D,traffic,o={}){this.D=D;this.T=traffic;this.want=null;this.safe=!!o.safe}
  think(t){
    const D=this.D,v=D.v,L=D.S.l,hw=D.hw();
    const cars=this.T.query(t,D.d-30,D.d+420);
    // per lane: the nearest car ahead (gap, its speed) and whether something is right alongside
    const info=CFG.laneX.map((lx,i)=>({i,lx,v:CFG.laneV[i],gap:1e9,ov:CFG.laneV[i],side:false}));
    for(const o of cars){
      const I=info[o.c.lane],dz=o.z-D.d,reach=(o.c.l+L)/2,close=v-o.v;
      // "alongside" = it would be beside us during a lane change (~0.6 s)
      if(Math.abs(dz)<reach+2+Math.abs(close)*.6)I.side=true;
      const g=dz-reach;
      if(g>-.5&&g<I.gap){I.gap=g;I.ov=o.v}
    }
    // time until we'd hit the car ahead in a lane, at our speed
    const ttc=I=>{const c=v-I.ov;return c>.1?Math.max(0,I.gap)/c:99};
    const cur=info.reduce((b,I)=>Math.abs(I.lx-D.x)<Math.abs(b.lx-D.x)?I:b);
    let best=cur,bs=-1e9;
    for(const I of info){
      const step=I.i>cur.i?1:-1;let ok=true;
      for(let j=cur.i+step;I.i!==cur.i&&j!==I.i+step;j+=step)if(info[j].side)ok=false;
      if(!ok)continue;
      const T=ttc(I);
      let s=Math.min(T,10)+Math.min(I.gap,300)/150-Math.abs(I.i-cur.i)*.4+(I===cur?.6:0);
      if(I.v<0){if(this.safe||T<5)continue;s-=3.5}
      if(s>bs){bs=s;best=I}
    }
    this.want=best;
    // brake if the car ahead in our lanes needs more than ~55% of the brakes (braking never helps against oncoming cars: steer away instead)
    let need=0;
    let tight=false;
    for(const I of info)if(I.v>0&&Math.abs(I.lx-D.x)<(1.8+hw)*.95){const c=v-I.ov;if(c>0){need=Math.max(need,c*c/(2*Math.max(.05,I.gap-1.5)));if(I.gap<3+c*1.2)tight=true}}
    const brake=need>CFG.brake*.55||tight;
    const steer=clamp((best.lx-D.x)*.9-D.xv*.14,-1,1);
    return{steer,gas:brake||need>CFG.brake*.3?0:1,brake,nitro:!brake&&need<1&&ttc(cur)>7&&D.nitro>.4};
  }
}

root.SSCore={CFG,STYLES,VT,Road,Traffic,Driver,Bot,rng,hash,clamp,lerp};
if(typeof module!=='undefined'&&module.exports)module.exports=root.SSCore;
})(typeof window!=='undefined'?window:globalThis);
