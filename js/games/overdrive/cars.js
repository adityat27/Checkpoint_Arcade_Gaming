/* GAME: Overdrive · the five race-car models (self-contained, needs THREE). */
/* =========================================================================
   OVERDRIVE CARS — five low-poly procedural race cars for Three.js (r128+)
   -------------------------------------------------------------------------
   createF1Car(opts)        red & orange open-wheel Formula car
   createSupercar(opts)     blue & neon-yellow wedge supercar
   createSpecterGT(opts)    white & neon-green GT racer
   createSentinelV12(opts)  dark armoured hypercar with electric-blue outlines
   createAeroBladeX(opts)   silver & gold tri-fin hypercar

   Every builder returns a THREE.Group that:
     • faces +Z (nose toward +Z), y-up, wheels resting on y = 0, ~5 m long
     • uses flat-shaded MeshStandardMaterials for a faceted low-poly look
     • merges static parts per material to keep draw calls low

   group.userData gives a game loop what it needs:
     body               THREE.Group — tilt this for pitch / roll
     wheels             [{steer, spin, radius, front}] — spin.rotation.x rolls,
                        steer.rotation.y turns the front wheels
     setBrake(on)       brightens the brake lights
     setBoost(on)       shows flickering exhaust flames (call every frame)
     model              'f1' | 'super' | 'specter' | 'sentinel' | 'aero'

   opts = { livery: name or object (see OverdriveCars.LIVERIES), envMap }
   Needs a global THREE (script tag) — no external models or textures.
   ========================================================================= */
(function(root){
'use strict';

/* ---------- colour schemes (first one in each list is the default) ---------- */
const LIVERIES={
  f1:{
    inferno:{body:'#e61919',nose1:'#ff6600',nose2:'#ff8800',black:'#18181b',cockpit:'#111111',helmet:'#ff2a00',halo:'#1a1a1a',tire:'#141414',glow:'#ff5500',flame:'#ff7a1a'},
    teal:   {body:'#0fb5a6',nose1:'#f4f4f5',nose2:'#bff7f1',black:'#18181b',cockpit:'#111111',helmet:'#ffe14d',halo:'#1a1a1a',tire:'#141414',glow:'#00e5ff',flame:'#38d6ff'}
  },
  super:{
    voltage:{body:'#0066ff',stripe:'#ccff00',glass:'#0d1326',head:'#88ffff',rim:'#1f1f1f',spoke:'#33363d',ring:'#ccff00',black:'#121317',tire:'#141414',flame:'#33b5ff'},
    viper:  {body:'#7a2bff',stripe:'#ff3e8a',glass:'#0d1326',head:'#ffd6f0',rim:'#1f1f1f',spoke:'#33363d',ring:'#ff3e8a',black:'#121317',tire:'#141414',flame:'#ff5fa8'}
  },
  specter:{
    specter:{body:'#e2e6ea',accent:'#39ff14',paint2:'#5fdc2a',glass:'#0f1712',dark:'#15181b',rim:'#1c1f22',spoke:'#30353a',tire:'#141414',flame:'#7dff3a'},
    blaze:  {body:'#e2e6ea',accent:'#ff8a1f',paint2:'#ff7a00',glass:'#14100c',dark:'#1f2326',rim:'#1c1f22',spoke:'#30353a',tire:'#141414',flame:'#ffa040'}
  },
  sentinel:{
    sentinel:{body:'#16203a',panel:'#0d1220',neon:'#1fb4ff',glass:'#0a1222',grey:'#9aa6b8',rim:'#141822',tire:'#121214',flame:'#3ff0ff'},
    crimson: {body:'#22141a',panel:'#120b0e',neon:'#ff3b4f',glass:'#140a0e',grey:'#a89aa0',rim:'#1a1416',tire:'#121214',flame:'#ff6a3a'}
  },
  aero:{
    aero:  {body:'#a7aeb8',panel:'#3a414c',trim:'#ffb42a',glass:'#141821',lamp:'#ffb000',rim:'#22262d',spoke:'#3a3f47',tire:'#131315',flame:'#ff8a1f'},
    frost: {body:'#e9eef3',panel:'#2a3340',trim:'#39d8ff',glass:'#101722',lamp:'#bff4ff',rim:'#22262d',spoke:'#3a3f47',tire:'#131315',flame:'#5fe6ff'}
  }
};

/* ---------- materials (cached so several cars share them) ---------- */
const MAT={};
function std(key,o){
  if(MAT[key])return MAT[key];
  return MAT[key]=new THREE.MeshStandardMaterial(Object.assign({flatShading:true,roughness:0.5,metalness:0.1,side:THREE.DoubleSide},o));
}
const paint=(c,env,o={})=>std('p'+c+(env?1:0)+JSON.stringify(o),Object.assign({color:c,roughness:0.38,metalness:0.25,envMap:env||null,envMapIntensity:0.6},o));
const matte=c=>std('m'+c,{color:c,roughness:0.85,metalness:0.05});
// metal needs something to reflect; without an env map it would render nearly black, so tone it down
const metal=(c,env)=>std('x'+c+(env?1:0),{color:c,roughness:env?0.28:0.4,metalness:env?0.85:0.35,envMap:env||null,envMapIntensity:1});
// Glowing parts. Without HDR targets an emissive colour × intensity is clipped to 1.0 per channel,
// which turns orange into yellow and lime into plain yellow. Dividing the colour by the intensity keeps
// the on-screen colour exactly `c` while still pushing it into bloom range.
const glow=(c,i)=>std('g'+c+i,{color:0x000000,emissive:new THREE.Color(c).multiplyScalar(1/i),emissiveIntensity:i,roughness:0.4,metalness:0});
const glassMat=(c,env)=>std('gl'+c+(env?1:0),{color:c,roughness:0.1,metalness:0.8,envMap:env||null,envMapIntensity:1});

/* ---------- geometry helpers ---------- */
const V=(x,y,z)=>new THREE.Vector3(x,y,z);
function M(x=0,y=0,z=0,rx=0,ry=0,rz=0,sx=1,sy=1,sz=1){
  return new THREE.Matrix4().compose(V(x,y,z),new THREE.Quaternion().setFromEuler(new THREE.Euler(rx,ry,rz)),V(sx,sy,sz));
}
// Collects parts and merges them into one mesh per material.
function Kit(){
  const L=new Map();
  return{
    add(geo,mat,m){
      const g=geo.index?geo.toNonIndexed():geo;if(g!==geo)geo.dispose();
      if(m)g.applyMatrix4(m);
      if(!L.has(mat))L.set(mat,[]);L.get(mat).push(g);
    },
    build(parent){
      L.forEach((list,mat)=>{
        let n=0;list.forEach(g=>n+=g.attributes.position.count);
        const P=new Float32Array(n*3);let o=0;
        list.forEach(g=>{P.set(g.attributes.position.array.subarray(0,g.attributes.position.count*3),o);o+=g.attributes.position.count*3;g.dispose()});
        const G=new THREE.BufferGeometry();G.setAttribute('position',new THREE.BufferAttribute(P,3));
        G.computeVertexNormals();G.computeBoundingSphere();
        parent.add(new THREE.Mesh(G,mat));
      });
    }
  };
}
// Loft: joins cross-sections (polygons in x/y at a given z) into a closed faceted solid.
function loft(sections,caps=true){
  const pos=[],n=sections[0].pts.length;
  const tri=(a,b,c)=>pos.push(...a,...b,...c);
  const P=(s,i)=>[s.pts[i][0],s.pts[i][1],s.z];
  for(let k=0;k<sections.length-1;k++){
    const a=sections[k],b=sections[k+1];
    for(let i=0;i<n;i++){const j=(i+1)%n;tri(P(a,i),P(a,j),P(b,j));tri(P(a,i),P(b,j),P(b,i))}
  }
  if(caps)[sections[0],sections[sections.length-1]].forEach((s,e)=>{
    let cx=0,cy=0;s.pts.forEach(p=>{cx+=p[0];cy+=p[1]});cx/=n;cy/=n;
    for(let i=0;i<n;i++){const j=(i+1)%n,c=[cx,cy,s.z];e?tri(c,P(s,i),P(s,j)):tri(c,P(s,j),P(s,i))}
  });
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
  return g;
}
// Chamfered 8-sided cross-section: half width hw, bottom yb, top yt, centred on cx.
function oct(hw,yb,yt,o={}){
  const cx=o.cx||0,h=yt-yb,bt=o.bt!=null?o.bt:0.8,tp=o.tp!=null?o.tp:0.7,lo=o.lo!=null?o.lo:0.3,hi=o.hi!=null?o.hi:0.75;
  return[[cx-hw*bt,yb],[cx+hw*bt,yb],[cx+hw,yb+h*lo],[cx+hw*0.94,yb+h*hi],[cx+hw*tp,yt],[cx-hw*tp,yt],[cx-hw*0.94,yb+h*hi],[cx-hw,yb+h*lo]];
}
// Flat plate from a side profile [[z,y],...], given thickness across x, centred at x = 0.
function plate(prof,thick){
  const sh=new THREE.Shape();prof.forEach(([z,y],i)=>i?sh.lineTo(z,y):sh.moveTo(z,y));
  const g=new THREE.ExtrudeGeometry(sh,{depth:thick,bevelEnabled:false,curveSegments:1});
  g.translate(0,0,-thick/2);g.rotateY(-Math.PI/2);return g;
}
// Flat plate from a rear/front profile [[x,y],...], thickness along z, centred at z = 0.
function facePlate(prof,thick){
  const sh=new THREE.Shape();prof.forEach(([x,y],i)=>i?sh.lineTo(x,y):sh.moveTo(x,y));
  const g=new THREE.ExtrudeGeometry(sh,{depth:thick,bevelEnabled:false,curveSegments:1});
  g.translate(0,0,-thick/2);return g;
}
// Box stretched between two points (struts, stripes, outlines).
function strut(a,b,w,h){
  const d=new THREE.Vector3().subVectors(b,a),len=Math.max(1e-3,d.length());
  const g=new THREE.BoxGeometry(w,h,len);
  const q=new THREE.Quaternion().setFromUnitVectors(V(0,0,1),d.normalize());
  g.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3().addVectors(a,b).multiplyScalar(0.5),q,V(1,1,1)));
  return g;
}
// A chain of struts through points (open or closed) — used for neon outlines.
function polyline(K,pts,mat,w=0.035,h=0.035,closed=false){
  for(let i=0;i<pts.length-(closed?0:1);i++)K.add(strut(pts[i],pts[(i+1)%pts.length],w,h),mat);
}
const box=(w,h,d)=>new THREE.BoxGeometry(w,h,d);
const sides=fn=>[-1,1].forEach(fn);
const lerp=(a,b,t)=>a+(b-a)*t;

/* ---------- body shell shared by the four closed cars ----------
   rows: [z, half width, bottom, side crease, fender top, hood centre]
   W:    {zf, rf, af, zr, rr, ar}  (axle z, tyre radius, arch radius) */
function Shell(rows,W,shape={}){
  const inner=shape.inner||0.44,peak=shape.peak||0.8;
  const at=z=>{let i=0;while(i<rows.length-2&&rows[i+1][0]<z)i++;const a=rows[i],b=rows[i+1],t=Math.max(0,Math.min(1,(z-a[0])/(b[0]-a[0])));return a.map((v,k)=>lerp(v,b[k],t))};
  const archY=z=>{const f=Math.abs(z-W.zf),r=Math.abs(z-W.zr);
    if(f<W.af)return W.rf+Math.sqrt(W.af*W.af-f*f)*0.98;if(r<W.ar)return W.rr+Math.sqrt(W.ar*W.ar-r*r)*0.98;return 0};
  const pts=(hw,yb,ys,yf,yc,arch)=>{
    const ya=Math.max(yb,arch),core=Math.min(0.66,hw*0.9);ys=Math.max(ys,ya+0.06);yf=Math.max(yf,ys+0.04);
    const top=x=>x<=hw*inner?yc:x<=hw*peak?yc+(yf-yc)*(x-hw*inner)/(hw*(peak-inner)):yf;
    // inner edge of the arch ceiling stays under the hood so the section never folds over itself
    const yi=Math.max(yb,Math.min(ya,top(core)-0.05));
    return[[-core,yb],[core,yb],[core,yi],[hw*0.97,ya],[hw,ys],[hw*0.96,yf-0.03],[hw*peak,yf],[hw*inner,yc],
           [-hw*inner,yc],[-hw*peak,yf],[-hw*0.96,yf-0.03],[-hw,ys],[-hw*0.97,ya],[-core,yi]];
  };
  const zs=new Set(rows.map(r=>r[0]));
  [[W.zf,W.af],[W.zr,W.ar]].forEach(([zc,a])=>{for(let k=-6;k<=6;k++)zs.add(+(zc+a*k/6).toFixed(4))});
  const secs=[];
  [...zs].sort((a,b)=>a-b).forEach(z=>{
    const [,hw,yb,ys,yf,yc]=at(z);
    // arch edges get two sections at the same z (closed + open) so each arch has a crisp lip
    const e=[[W.zf-W.af,W.rf,1],[W.zf+W.af,W.rf,0],[W.zr-W.ar,W.rr,1],[W.zr+W.ar,W.rr,0]].find(([ez])=>Math.abs(ez-z)<1e-3);
    if(e){const open={z,pts:pts(hw,yb,ys,yf,yc,e[1])},closed={z,pts:pts(hw,yb,ys,yf,yc,0)};if(e[2])secs.push(closed,open);else secs.push(open,closed)}
    else secs.push({z,pts:pts(hw,yb,ys,yf,yc,archY(z))});
  });
  // top surface height at (x,z) — lays stripes, vents and lights onto the body
  const topY=(x,z)=>{const [,hw,,ys,yf,yc]=at(z),ax=Math.abs(x);
    if(ax<=hw*inner)return yc;if(ax<=hw*peak)return yc+(yf-yc)*(ax-hw*inner)/(hw*(peak-inner));
    return yf-(ax-hw*peak)/(hw*(1-peak))*(yf-ys)*0.3};
  return{geo:loft(secs),at,topY,side:z=>at(z)[1],
    // points tracing a wheel arch on the body side (for neon / gold trims)
    archPts(s,front,lift=0.015,n=9){const zc=front?W.zf:W.zr,a=(front?W.af:W.ar)+lift,r=front?W.rf:W.rr,out=[];
      for(let i=0;i<=n;i++){const t=Math.PI*i/n,z=zc+a*Math.cos(t),y=r+a*Math.sin(t)*0.98;out.push(V(s*(at(z)[1]*0.97+0.03),y,z))}return out}};
}
// Thin panel draped over a surface: zs list, xr(z)→[x0,x1], top(x,z).
function drape(zs,xr,top,n=4,lift=0.012,thick=0.03){
  return loft(zs.map(z=>{const [a,b]=xr(z),t=[],u=[];
    for(let i=0;i<=n;i++){const x=lerp(a,b,i/n);t.push([x,top(x,z)+lift])}
    for(let i=n;i>=0;i--){const x=lerp(a,b,i/n);u.push([x,top(x,z)+lift-thick])}
    return{z,pts:t.concat(u)}}));
}
// Cabin cross-section: base half width bw at yb, roof half width tw at yt.
const cab=(z,bw,yb,yt,tw)=>({z,pts:[[-bw,yb],[bw,yb],[bw*0.94,yb+(yt-yb)*0.4],[tw,yt],[-tw,yt],[-bw*0.94,yb+(yt-yb)*0.4]]});
// Roof height along a list of cabin rows (ordered front to back).
const cabTop=rows=>z=>{let i=0;while(i<rows.length-2&&rows[i+1].z>z)i++;const a=rows[i],b=rows[i+1],t=Math.max(0,Math.min(1,(z-a.z)/(b.z-a.z)));return lerp(a.pts[3][1],b.pts[3][1],t)};

/* ---------- wheels ---------- */
// One wheel: steer group at the hub, spin group inside it. Axle runs along X.
function wheel(car,x,z,r,w,mats,style){
  const steer=new THREE.Group(),spin=new THREE.Group();
  steer.position.set(x,r,z);steer.add(spin);car.add(steer);
  const K=Kit();
  const tire=new THREE.CylinderGeometry(r,r,w,14,1);tire.rotateZ(Math.PI/2);K.add(tire,mats.tire);
  sides(s=>{
    const sh=new THREE.CylinderGeometry(r*0.93,r,0.04,14,1,true);sh.rotateZ(-s*Math.PI/2);sh.translate(s*(w/2+0.02),0,0);K.add(sh,mats.tire);
    const disc=r*(style==='f1'?0.62:0.7);
    const face=new THREE.CircleGeometry(disc,14);face.rotateY(s*Math.PI/2);face.translate(s*(w/2+0.041),0,0);K.add(face,mats.rim);
    const ring=new THREE.RingGeometry(disc,disc+r*(style==='f1'?0.1:0.06),16);ring.rotateY(s*Math.PI/2);ring.translate(s*(w/2+0.045),0,0);K.add(ring,mats.ring);
    const X=s*(w/2+0.05);
    if(style==='spoke5'||style==='gt'||style==='aero'){
      const n=style==='gt'?6:5,sw=style==='gt'?0.045:0.075;
      for(let k=0;k<n;k++){const a=k*Math.PI*2/n,sp=box(0.02,r*0.6,sw);sp.translate(0,r*0.32,0);sp.rotateX(a);sp.translate(X,0,0);K.add(sp,mats.spoke)}
      const hub=new THREE.CylinderGeometry(r*0.14,r*0.14,0.03,6);hub.rotateZ(Math.PI/2);hub.translate(s*(w/2+0.055),0,0);K.add(hub,mats.ring);
    }else if(style==='turbine'){
      const r2=new THREE.RingGeometry(r*0.34,r*0.4,12);r2.rotateY(s*Math.PI/2);r2.translate(s*(w/2+0.046),0,0);K.add(r2,mats.ring);
      for(let k=0;k<8;k++){const a=k*Math.PI/4,sp=box(0.015,r*0.24,0.05);sp.translate(0,r*0.52,0);sp.rotateX(a+0.3);sp.translate(X,0,0);K.add(sp,mats.spoke||mats.rim)}
    }else{
      const hub=new THREE.CylinderGeometry(r*0.18,r*0.22,0.05,8);hub.rotateZ(Math.PI/2);hub.translate(s*(w/2+0.06),0,0);K.add(hub,mats.ring);
    }
  });
  K.build(spin);
  return{steer,spin,radius:r,front:z>0};
}
function fourWheels(car,W,mats,style){
  return[wheel(car,-W.tf,W.zf,W.rf,W.wf,mats,style),wheel(car,W.tf,W.zf,W.rf,W.wf,mats,style),
         wheel(car,-W.tr,W.zr,W.rr,W.wr,mats,style),wheel(car,W.tr,W.zr,W.rr,W.wr,mats,style)];
}

/* ---------- brake lights + boost flames ---------- */
const tailMat=()=>new THREE.MeshBasicMaterial({color:0xc8102a});
let FLAME_G=null,CORE_G=null;
function flameGeos(){
  if(FLAME_G)return;
  FLAME_G=new THREE.ConeGeometry(1,1,8);FLAME_G.rotateX(-Math.PI/2);FLAME_G.translate(0,0,-0.5);
  CORE_G=new THREE.ConeGeometry(0.5,0.6,8);CORE_G.rotateX(-Math.PI/2);CORE_G.translate(0,0,-0.3);
}
function finish(car,body,K,wheels,tails,exhausts,flameCol,model){
  K.build(body);
  flameGeos();
  const outer=new THREE.MeshBasicMaterial({color:flameCol,transparent:true,opacity:0.8,blending:THREE.AdditiveBlending,depthWrite:false});
  const core=new THREE.MeshBasicMaterial({color:0xfff6e0,transparent:true,opacity:0.9,blending:THREE.AdditiveBlending,depthWrite:false});
  const flames=exhausts.map(([x,y,z,r])=>{const g=new THREE.Group();g.position.set(x,y,z);
    const o=new THREE.Mesh(FLAME_G,outer);o.scale.set(r,r,r*6.5);const c=new THREE.Mesh(CORE_G,core);c.scale.set(r,r,r*6.5);
    g.add(o,c);g.visible=false;body.add(g);return g});
  car.userData={
    body,wheels,model,
    setBrake(on){tails.forEach(m=>m.color.setHex(on?0xff3a4a:0xc8102a))},
    setBoost(on){flames.forEach(f=>{f.visible=!!on;if(on)f.scale.set(1,1,0.8+Math.random()*0.5)})}
  };
  return car;
}
function pickLivery(kind,l){
  const set=LIVERIES[kind],first=set[Object.keys(set)[0]];
  if(l&&typeof l==='object')return Object.assign({},first,l);
  return set[l]||first;
}

/* =========================================================================
   CAR 1 — Formula car (red & orange)
   ========================================================================= */
function createF1Car(opts={}){
  const C=pickLivery('f1',opts.livery),env=opts.envMap||null;
  const car=new THREE.Group(),body=new THREE.Group();car.add(body);
  const K=Kit();
  const red=paint(C.body,env),or1=paint(C.nose1,env),or2=paint(C.nose2,env),blk=matte(C.black),
        pit=matte(C.cockpit),halo=matte(C.halo),helm=paint(C.helmet,env,{roughness:0.3}),tail=tailMat();
  // floor / plank
  K.add(box(1.5,0.04,3.4),blk,M(0,0.1,-0.25));
  K.add(box(1.75,0.03,1.6),blk,M(0,0.09,-0.55));
  // monocoque tub
  K.add(loft([{z:-0.75,pts:oct(0.32,0.12,0.6)},{z:-0.1,pts:oct(0.34,0.12,0.63)},{z:0.75,pts:oct(0.3,0.14,0.6)},{z:1.15,pts:oct(0.24,0.16,0.55)}]),red);
  // nose cone: deep orange into bright orange tip
  K.add(loft([{z:1.15,pts:oct(0.24,0.16,0.55)},{z:1.85,pts:oct(0.17,0.16,0.4)}]),or1);
  K.add(loft([{z:1.85,pts:oct(0.17,0.16,0.4)},{z:2.4,pts:oct(0.1,0.15,0.26)},{z:2.6,pts:oct(0.05,0.16,0.21,{tp:0.5})}]),or2);
  // sidepods (coke-bottle taper toward the rear)
  sides(s=>{
    K.add(loft([
      {z:0.8,pts:oct(0.22,0.12,0.5,{cx:s*0.56})},{z:0.45,pts:oct(0.26,0.12,0.56,{cx:s*0.58})},
      {z:-0.3,pts:oct(0.26,0.12,0.52,{cx:s*0.54})},{z:-1.0,pts:oct(0.18,0.12,0.4,{cx:s*0.42})},
      {z:-1.45,pts:oct(0.1,0.12,0.3,{cx:s*0.3})}]),red);
    K.add(box(0.36,0.27,0.04),blk,M(s*0.56,0.34,0.81));               // radiator intake
    K.add(box(0.04,0.03,0.9),or2,M(s*0.8,0.44,0.1));                  // orange flick on the pod shoulder
    K.add(box(0.05,0.05,0.22),blk,M(s*0.38,0.7,0.62));                // mirror stalk
    K.add(box(0.16,0.07,0.06),red,M(s*0.44,0.74,0.62));               // mirror
    K.add(box(0.22,0.025,0.4),blk,M(s*0.62,0.56,0.98,0.2));           // bargeboard
  });
  // engine cover + airbox behind the driver's head
  K.add(loft([{z:0.04,pts:oct(0.15,0.55,1.02,{tp:0.55})},{z:-0.35,pts:oct(0.2,0.5,0.98,{tp:0.6})},{z:-1.1,pts:oct(0.16,0.35,0.72)},{z:-1.85,pts:oct(0.08,0.28,0.45)}]),red);
  K.add(box(0.17,0.2,0.04),blk,M(0,0.88,0.05));                        // airbox mouth
  K.add(box(0.1,0.05,0.16),blk,M(0,1.06,-0.08));                       // T-camera
  K.add(plate([[-0.3,0.98],[-1.95,0.86],[-1.95,0.62],[-1.2,0.72]],0.03),red); // shark fin
  K.add(box(0.3,0.2,0.45),blk,M(0,0.34,-1.85));                         // gearbox
  // rear: LED rain light, centre exhaust
  K.add(box(0.16,0.12,0.03),tail,M(0,0.42,-2.09));
  for(let i=0;i<3;i++)K.add(box(0.16,0.012,0.032),blk,M(0,0.38+i*0.04,-2.1));
  const ex=new THREE.CylinderGeometry(0.1,0.12,0.3,10);ex.rotateX(Math.PI/2);K.add(ex,metal('#8a8f99',env),M(0,0.6,-1.98));
  const exIn=new THREE.CircleGeometry(0.075,10);exIn.rotateY(Math.PI);K.add(exIn,matte('#0a0a0c'),M(0,0.6,-2.135));
  // cockpit, driver and halo
  K.add(box(0.46,0.05,0.8),pit,M(0,0.615,0.32));
  sides(s=>K.add(box(0.06,0.09,0.86),red,M(s*0.26,0.64,0.3)));
  K.add(box(0.36,0.12,0.05),pit,M(0,0.63,-0.08));
  K.add(new THREE.IcosahedronGeometry(0.16,1),helm,M(0,0.75,0.15,0,0,0,1,0.95,1.08));
  K.add(box(0.24,0.075,0.08),pit,M(0,0.765,0.27,-0.15));               // visor
  K.add(box(0.025,0.16,0.2),blk,M(0,0.86,0.12));                       // helmet fin
  const hoop=new THREE.TorusGeometry(0.29,0.032,4,10,Math.PI);hoop.rotateX(Math.PI/2);K.add(hoop,halo,M(0,0.9,0.12));
  K.add(strut(V(0,0.9,0.41),V(0,0.6,0.66),0.06,0.05),halo);
  sides(s=>K.add(strut(V(s*0.29,0.9,0.12),V(s*0.27,0.62,-0.12),0.06,0.05),halo));
  // front wing: three orange elements + black endplates
  K.add(box(1.96,0.03,0.4),or2,M(0,0.1,2.42));
  K.add(box(1.9,0.03,0.2),or1,M(0,0.16,2.3,0.35));
  K.add(box(1.72,0.03,0.15),or2,M(0,0.22,2.2,0.6));
  sides(s=>{
    K.add(plate([[2.66,0.07],[2.66,0.2],[2.4,0.32],[2.08,0.32],[2.08,0.07]],0.035),blk,M(s*0.99,0,0));
    K.add(box(0.035,0.11,0.3),blk,M(s*0.12,0.12,2.32));                // nose pylons
  });
  // rear wing: tall and blocky, LED strips down the endplate trailing edges
  sides(s=>{
    K.add(plate([[-1.72,0.6],[-1.72,1.15],[-1.95,1.24],[-2.38,1.24],[-2.38,0.6]],0.045),blk,M(s*0.63,0,0));
    K.add(box(0.05,0.56,0.035),tail,M(s*0.63,0.94,-2.4));
  });
  K.add(box(1.24,0.06,0.38),blk,M(0,0.98,-2.02,0.15));
  K.add(box(1.24,0.045,0.2),blk,M(0,1.13,-2.2,0.5));
  K.add(box(1.24,0.012,0.04),red,M(0,1.18,-2.29,0.5));                // red lip on the flap
  K.add(box(1.0,0.04,0.2),blk,M(0,0.5,-2.0,0.2));                       // beam wing
  K.add(box(0.07,0.5,0.16),blk,M(0,0.74,-2.0));                         // pylon
  // suspension struts (wishbones + pushrods)
  const FZ=1.62,RZ=-1.5;
  sides(s=>{
    const fh=s*0.76,rh=s*0.65;
    [[V(s*0.2,0.48,FZ+0.16),V(fh,0.42,FZ)],[V(s*0.2,0.48,FZ-0.18),V(fh,0.42,FZ)],
     [V(s*0.22,0.22,FZ+0.18),V(fh,0.24,FZ)],[V(s*0.22,0.22,FZ-0.2),V(fh,0.24,FZ)],
     [V(fh,0.25,FZ),V(s*0.2,0.55,FZ-0.12)],
     [V(s*0.32,0.46,RZ+0.18),V(rh,0.46,RZ)],[V(s*0.28,0.46,RZ-0.2),V(rh,0.46,RZ)],
     [V(s*0.3,0.2,RZ+0.2),V(rh,0.26,RZ)],[V(s*0.26,0.2,RZ-0.2),V(rh,0.26,RZ)]
    ].forEach(([a,b])=>K.add(strut(a,b,0.035,0.022),blk));
  });
  const wm={tire:matte(C.tire),rim:matte('#232326'),ring:glow(C.glow,2.0)};
  const wheels=[
    wheel(car,-0.93,FZ,0.33,0.34,wm,'f1'),wheel(car,0.93,FZ,0.33,0.34,wm,'f1'),
    wheel(car,-0.88,RZ,0.37,0.46,wm,'f1'),wheel(car,0.88,RZ,0.37,0.46,wm,'f1')
  ];
  return finish(car,body,K,wheels,[tail],[[0,0.6,-2.14,0.085]],C.flame,'f1');
}

/* =========================================================================
   CAR 2 — Supercar (blue & neon yellow)
   ========================================================================= */
const SW={zf:1.45,rf:0.36,af:0.42,zr:-1.42,rr:0.38,ar:0.44,tf:0.86,tr:0.86,wf:0.32,wr:0.38};
const SUPER_ROWS=[
  [-2.4,0.9,0.26,0.5,0.84,0.82],[-2.2,0.98,0.22,0.6,0.88,0.86],[-1.95,1.0,0.2,0.66,0.92,0.88],
  [-1.42,1.03,0.2,0.74,0.95,0.88],[-0.9,1.0,0.2,0.66,0.9,0.88],[-0.4,0.98,0.2,0.6,0.86,0.86],
  [0.4,0.98,0.2,0.56,0.84,0.82],[1.0,1.0,0.2,0.6,0.84,0.66],[1.45,0.99,0.2,0.62,0.86,0.6],
  [1.9,0.97,0.19,0.5,0.76,0.55],[2.1,0.93,0.18,0.42,0.66,0.52],[2.3,0.74,0.17,0.36,0.52,0.47],[2.48,0.32,0.17,0.3,0.38,0.38]];
function createSupercar(opts={}){
  const C=pickLivery('super',opts.livery),env=opts.envMap||null;
  const car=new THREE.Group(),body=new THREE.Group();car.add(body);
  const K=Kit(),S=Shell(SUPER_ROWS,SW),topY=S.topY;
  const blue=paint(C.body,env,{metalness:0.45,roughness:0.3}),neon=glow(C.stripe,0.9),blk=matte(C.black),
        glass=glassMat(C.glass,env),head=glow(C.head,3.0),tail=tailMat();
  K.add(S.geo,blue);
  // cabin: raked windshield, side glass, roof, engine cover
  const cabRows=[cab(1.12,0.74,0.6,0.62,0.7),cab(0.22,0.74,0.6,1.15,0.5),cab(-0.6,0.74,0.62,1.16,0.5),cab(-1.0,0.72,0.64,1.1,0.5)];
  const deckRows=[cab(-1.0,0.72,0.64,1.1,0.5),cab(-1.6,0.7,0.66,0.98,0.52),cab(-2.25,0.6,0.7,0.9,0.5)];
  const deckY=cabTop(deckRows);
  K.add(loft(cabRows),glass);K.add(loft(deckRows),blue);
  K.add(loft([{z:0.26,pts:[[-0.53,1.11],[0.53,1.11],[0.5,1.18],[-0.5,1.18]]},{z:-0.62,pts:[[-0.53,1.12],[0.53,1.12],[0.5,1.19],[-0.5,1.19]]}]),blue);
  sides(s=>{
    K.add(strut(V(s*0.73,0.66,1.1),V(s*0.51,1.16,0.24),0.07,0.06),blue);   // A-pillar
    K.add(strut(V(s*0.73,0.86,-0.62),V(s*0.51,1.16,-0.62),0.06,0.06),blue);// B-pillar
    K.add(strut(V(s*0.745,0.88,0.75),V(s*0.745,0.88,-0.9),0.02,0.035),blk);
  });
  // engine cover: black louvres in a neon frame
  K.add(drape([-1.08,-1.4,-1.75,-2.05],()=>[-0.44,0.44],(x,z)=>deckY(z),3,0.008,0.02),blk);
  for(let k=0;k<6;k++){const z=-1.14-k*0.16;K.add(box(0.84,0.03,0.05),matte('#2b2f38'),M(0,deckY(z)+0.03,z,-0.35))}
  sides(s=>polyline(K,[V(s*0.47,deckY(-1.06)+0.02,-1.06),V(s*0.47,deckY(-2.08)+0.02,-2.08)],neon,0.03,0.03));
  polyline(K,[V(-0.47,deckY(-1.06)+0.02,-1.06),V(0.47,deckY(-1.06)+0.02,-1.06)],neon,0.03,0.03);
  // neon stripes: V on the hood, twin stripes over the roof
  sides(s=>{
    const pts=[[0.07,2.4],[0.16,2.1],[0.27,1.7],[0.36,1.15]];
    for(let i=0;i<pts.length-1;i++){const [x1,z1]=pts[i],[x2,z2]=pts[i+1];K.add(strut(V(s*x1,topY(x1,z1)+0.012,z1),V(s*x2,topY(x2,z2)+0.012,z2),0.06,0.012),neon)}
    K.add(strut(V(s*0.17,1.188,0.24),V(s*0.17,1.198,-0.62),0.07,0.012),neon);
    K.add(strut(V(s*0.51,1.16,0.24),V(s*0.51,1.17,-0.62),0.025,0.03),neon);  // roofline
    K.add(strut(V(s*0.74,0.66,1.1),V(s*0.52,1.16,0.25),0.025,0.03),neon);
  });
  // front: pointed splitter, intakes and slit LED headlights
  sides(s=>{
    K.add(strut(V(0,0.13,2.6),V(s*1.0,0.13,2.0),0.26,0.04),blk);
    K.add(strut(V(0,0.155,2.66),V(s*1.02,0.155,2.08),0.035,0.03),neon);
    K.add(strut(V(s*0.2,0.3,2.47),V(s*0.86,0.3,2.08),0.14,0.17),blk);
    K.add(plate([[2.12,0.24],[1.95,0.5],[1.92,0.24]],0.02),blk,M(s*0.985,0,0));
    K.add(strut(V(s*0.48,topY(0.48,2.22)+0.012,2.22),V(s*0.9,topY(0.9,1.98)+0.01,1.98),0.055,0.03),head);
    K.add(strut(V(s*0.62,topY(0.62,2.17)-0.03,2.2),V(s*0.86,topY(0.86,2.04)-0.04,2.07),0.03,0.02),head);
    K.add(box(0.05,0.05,0.2),blk,M(s*0.84,0.94,0.8));
    K.add(box(0.14,0.08,0.12),blue,M(s*0.92,0.96,0.78));
  });
  // sides: skirts, angular intakes, neon sweep
  sides(s=>{
    K.add(box(0.06,0.14,1.9),blk,M(s*0.99,0.22,0.03));
    K.add(strut(V(s*1.02,0.17,0.98),V(s*1.02,0.17,-0.94),0.025,0.03),neon);
    K.add(plate([[-0.25,0.64],[-0.95,0.84],[-0.95,0.34],[-0.6,0.34]],0.03),blk,M(s*1.0,0,0));
    K.add(strut(V(s*1.0,0.46,0.98),V(s*1.0,0.64,-0.25),0.025,0.035),neon);
  });
  // rear: thin spoiler on posts, arrow tail lights, mesh panel, neon diffuser, twin hex exhausts
  K.add(box(1.7,0.035,0.2),blue,M(0,1.0,-2.18,-0.06));
  K.add(box(1.7,0.02,0.03),neon,M(0,1.02,-2.28,-0.06));
  sides(s=>K.add(box(0.05,0.12,0.12),blk,M(s*0.55,0.94,-2.15)));
  sides(s=>{
    polyline(K,[[0.22,0.69],[0.34,0.74],[0.78,0.74],[0.92,0.67],[0.78,0.61],[0.34,0.61]].map(([x,y])=>V(s*x,y,-2.42)),tail,0.045,0.045,true);
    K.add(strut(V(s*0.34,0.675,-2.425),V(s*0.8,0.675,-2.425),0.035,0.035),tail);
  });
  K.add(box(0.36,0.09,0.03),matte('#0b0c10'),M(0,0.68,-2.415));
  K.add(box(1.6,0.24,0.1),blk,M(0,0.32,-2.38));
  polyline(K,[V(-0.98,0.52,-2.43),V(-0.62,0.44,-2.43),V(0.62,0.44,-2.43),V(0.98,0.52,-2.43)],neon,0.035,0.035);
  sides(s=>polyline(K,[V(s*0.98,0.52,-2.43),V(s*0.98,0.2,-2.43),V(s*0.62,0.2,-2.43)],neon,0.035,0.035));
  [-0.75,-0.45,0.45,0.75].forEach(x=>K.add(box(0.03,0.18,0.03),neon,M(x,0.13,-2.42)));
  sides(s=>{
    const h=new THREE.CylinderGeometry(0.11,0.11,0.16,6);h.rotateX(Math.PI/2);K.add(h,metal('#c6ccd6',env),M(s*0.14,0.32,-2.42));
    const i=new THREE.CircleGeometry(0.08,6);i.rotateY(Math.PI);K.add(i,matte('#08090c'),M(s*0.14,0.32,-2.505));
  });
  const wm={tire:matte(C.tire),rim:matte(C.rim),spoke:matte(C.spoke),ring:glow(C.ring,1.5)};
  return finish(car,body,K,fourWheels(car,SW,wm,'spoke5'),[tail],[[-0.14,0.32,-2.51,0.075],[0.14,0.32,-2.51,0.075]],C.flame,'super');
}

/* =========================================================================
   CAR 3 — Specter GT (white & neon green GT racer)
   ========================================================================= */
const GW={zf:1.42,rf:0.36,af:0.42,zr:-1.45,rr:0.38,ar:0.45,tf:0.88,tr:0.89,wf:0.33,wr:0.39};
const SPECTER_ROWS=[
  [-2.36,0.96,0.24,0.56,0.86,0.84],[-2.2,1.0,0.2,0.62,0.9,0.88],[-1.9,1.03,0.2,0.66,0.93,0.9],
  [-1.45,1.05,0.2,0.7,0.95,0.9],[-0.95,1.02,0.2,0.62,0.9,0.88],[-0.4,1.0,0.2,0.58,0.86,0.86],
  [0.4,1.0,0.2,0.56,0.84,0.82],[0.95,1.02,0.2,0.6,0.84,0.7],[1.42,1.03,0.2,0.62,0.84,0.64],
  [1.9,1.0,0.19,0.5,0.74,0.58],[2.15,0.96,0.18,0.42,0.62,0.54],[2.33,0.82,0.17,0.36,0.5,0.48],[2.45,0.5,0.17,0.3,0.4,0.4]];
function createSpecterGT(opts={}){
  const C=pickLivery('specter',opts.livery),env=opts.envMap||null;
  const car=new THREE.Group(),body=new THREE.Group();car.add(body);
  const K=Kit(),S=Shell(SPECTER_ROWS,GW,{inner:0.5,peak:0.82}),topY=S.topY;
  const white=paint(C.body,env,{metalness:0.2,roughness:0.35}),green=paint(C.paint2,env,{metalness:0.2,roughness:0.35}),
        neon=glow(C.accent,1.0),dark=matte(C.dark),glass=glassMat(C.glass,env),tail=tailMat();
  K.add(S.geo,white);
  // cabin + rear deck
  const cabRows=[cab(1.0,0.76,0.62,0.64,0.72),cab(0.15,0.76,0.62,1.2,0.52),cab(-0.7,0.76,0.64,1.22,0.52),cab(-1.25,0.74,0.66,1.08,0.52)];
  const deckRows=[cab(-1.25,0.74,0.66,1.08,0.52),cab(-1.75,0.72,0.7,0.98,0.6),cab(-2.3,0.66,0.74,0.92,0.6)];
  const deckY=cabTop(deckRows);
  K.add(loft(cabRows),glass);K.add(loft(deckRows),white);
  K.add(loft([{z:0.2,pts:[[-0.55,1.15],[0.55,1.15],[0.52,1.225],[-0.52,1.225]]},{z:-0.74,pts:[[-0.55,1.16],[0.55,1.16],[0.52,1.235],[-0.52,1.235]]}]),white);
  sides(s=>{
    K.add(strut(V(s*0.75,0.66,0.98),V(s*0.53,1.2,0.2),0.08,0.07),white);
    K.add(strut(V(s*0.75,0.88,-0.74),V(s*0.53,1.21,-0.74),0.08,0.07),white);
    K.add(strut(V(s*0.765,0.88,0.7),V(s*0.765,0.88,-1.1),0.02,0.035),dark);
  });
  // green hood with two black vents, green stripe over the roof and down the deck
  K.add(drape([2.36,2.15,1.9,1.6,1.3,1.0],z=>{const hw=S.side(z);return[-hw*0.6,hw*0.6]},topY,6,0.01,0.025),green);
  sides(s=>{
    K.add(box(0.36,0.03,0.13),dark,M(s*0.3,topY(0.3,1.55)+0.03,1.55,0,-s*0.35));
    K.add(box(0.3,0.03,0.11),dark,M(s*0.28,topY(0.28,1.25)+0.03,1.25,0,-s*0.35));
  });
  K.add(drape([0.2,-0.2,-0.74],()=>[-0.17,0.17],()=>1.24,2,0.0,0.02),green);
  K.add(drape([-1.25,-1.75,-2.3],()=>[-0.17,0.17],(x,z)=>deckY(z),2,0.012,0.025),green);
  // green haunches behind the rear wheels and a side graphic on the doors
  sides(s=>{
    K.add(plate([[-1.92,0.3],[-1.92,0.88],[-2.36,0.82],[-2.36,0.3]],0.02),green,M(s*1.035,0,0));
    K.add(plate([[-0.25,0.36],[-0.95,0.36],[-0.95,0.74],[-0.55,0.7]],0.02),green,M(s*1.03,0,0));
    [0,1,2].forEach(i=>K.add(strut(V(s*1.04,0.36,0.6-i*0.22),V(s*1.04,0.66,0.4-i*0.22),0.02,0.03),neon));
  });
  // front: angular green headlights, big black splitter with neon edge, intakes
  sides(s=>{
    K.add(strut(V(s*0.46,topY(0.46,2.2)+0.015,2.2),V(s*0.88,topY(0.88,1.96)+0.012,1.96),0.06,0.035),neon);
    K.add(strut(V(s*0.6,topY(0.6,2.17)-0.03,2.2),V(s*0.86,topY(0.86,2.03)-0.05,2.06),0.035,0.025),neon);
    K.add(strut(V(s*0.15,0.13,2.62),V(s*1.02,0.13,2.12),0.3,0.04),dark);
    K.add(strut(V(s*0.15,0.155,2.68),V(s*1.04,0.155,2.18),0.035,0.03),neon);
    K.add(strut(V(s*0.55,0.3,2.36),V(s*0.95,0.3,2.12),0.1,0.18),dark);
    polyline(K,[V(s*0.5,0.4,2.39),V(s*0.95,0.4,2.15),V(s*0.95,0.2,2.15)],neon,0.03,0.03);
    K.add(box(0.05,0.05,0.18),dark,M(s*0.86,0.97,0.78));
    K.add(box(0.15,0.09,0.12),green,M(s*0.95,0.99,0.76));
  });
  K.add(box(0.9,0.04,0.3),dark,M(0,0.13,2.5));
  K.add(box(0.7,0.15,0.06),dark,M(0,0.28,2.45));
  polyline(K,[V(-0.36,0.37,2.47),V(0.36,0.37,2.47)],neon,0.03,0.03);
  // big GT wing on swan necks
  K.add(box(2.08,0.05,0.36),white,M(0,1.36,-2.12,-0.08));
  K.add(box(2.08,0.04,0.18),green,M(0,1.44,-2.3,-0.42));
  sides(s=>{
    K.add(plate([[-1.78,0.9],[-1.94,1.38],[-2.04,1.38],[-1.92,0.9]],0.05),dark,M(s*0.55,0,0));
    K.add(plate([[-1.92,1.22],[-1.92,1.54],[-2.42,1.56],[-2.42,1.22]],0.035),white,M(s*1.06,0,0));
    polyline(K,[V(s*1.08,1.54,-1.92),V(s*1.08,1.56,-2.42),V(s*1.08,1.22,-2.42)],neon,0.025,0.025);
  });
  // rear: full-width light bar with corner drops, black recess, green stepped diffuser, quad exhausts
  K.add(strut(V(-0.94,0.78,-2.375),V(0.94,0.78,-2.375),0.06,0.05),tail);
  sides(s=>K.add(strut(V(s*0.94,0.78,-2.375),V(s*0.94,0.56,-2.375),0.05,0.05),tail));
  K.add(box(1.6,0.06,0.02),matte('#d5dade'),M(0,0.84,-2.37));
  K.add(box(1.7,0.3,0.08),dark,M(0,0.36,-2.34));
  polyline(K,[V(-0.98,0.52,-2.4),V(-0.98,0.16,-2.4),V(-0.62,0.16,-2.4),V(-0.62,0.06,-2.4),V(-0.3,0.06,-2.4),V(-0.3,0.16,-2.4),
              V(0.3,0.16,-2.4),V(0.3,0.06,-2.4),V(0.62,0.06,-2.4),V(0.62,0.16,-2.4),V(0.98,0.16,-2.4),V(0.98,0.52,-2.4)],neon,0.03,0.03);
  const exP=[-0.72,-0.54,0.54,0.72];
  exP.forEach(x=>{const p=new THREE.CylinderGeometry(0.075,0.075,0.2,10);p.rotateX(Math.PI/2);K.add(p,metal('#b9c0c8',env),M(x,0.3,-2.42));
    const i=new THREE.CircleGeometry(0.055,10);i.rotateY(Math.PI);K.add(i,matte('#08090a'),M(x,0.3,-2.521))});
  const wm={tire:matte(C.tire),rim:matte(C.rim),spoke:matte(C.spoke),ring:glow(C.accent,1.4)};
  return finish(car,body,K,fourWheels(car,GW,wm,'gt'),[tail],exP.map(x=>[x,0.3,-2.53,0.06]),C.flame,'specter');
}

/* =========================================================================
   CAR 4 — Sentinel V12 (dark armour, electric-blue outlines)
   ========================================================================= */
const NW={zf:1.45,rf:0.37,af:0.44,zr:-1.42,rr:0.4,ar:0.47,tf:0.92,tr:0.93,wf:0.36,wr:0.44};
const SENTINEL_ROWS=[
  [-2.42,0.98,0.26,0.6,0.9,0.86],[-2.22,1.04,0.22,0.66,0.94,0.9],[-1.9,1.07,0.2,0.7,0.98,0.92],
  [-1.42,1.09,0.2,0.74,1.0,0.92],[-0.95,1.06,0.2,0.66,0.93,0.9],[-0.4,1.04,0.2,0.62,0.88,0.88],
  [0.4,1.04,0.2,0.6,0.87,0.84],[0.95,1.06,0.2,0.64,0.9,0.76],[1.45,1.07,0.2,0.66,0.92,0.72],
  [1.9,1.05,0.2,0.6,0.86,0.68],[2.2,1.0,0.19,0.54,0.78,0.64],[2.42,0.88,0.18,0.48,0.68,0.6],[2.54,0.72,0.18,0.42,0.6,0.56]];
function createSentinelV12(opts={}){
  const C=pickLivery('sentinel',opts.livery),env=opts.envMap||null;
  const car=new THREE.Group(),body=new THREE.Group();car.add(body);
  const K=Kit(),S=Shell(SENTINEL_ROWS,NW,{inner:0.42,peak:0.78}),topY=S.topY;
  const navy=paint(C.body,env,{metalness:0.5,roughness:0.35}),panel=matte(C.panel),neon=glow(C.neon,1.4),
        glass=glassMat(C.glass,env),grey=metal(C.grey,env),head=glow('#dff6ff',3.0),tail=tailMat();
  K.add(S.geo,navy);
  const cabRows=[cab(1.05,0.78,0.66,0.7,0.74),cab(0.2,0.78,0.66,1.18,0.5),cab(-0.6,0.78,0.68,1.18,0.5),cab(-1.05,0.76,0.7,1.1,0.5)];
  const deckRows=[cab(-1.05,0.76,0.7,1.1,0.5),cab(-1.7,0.74,0.72,1.02,0.58),cab(-2.35,0.66,0.76,0.92,0.56)];
  const deckY=cabTop(deckRows);
  K.add(loft(cabRows),glass);K.add(loft(deckRows),navy);
  K.add(loft([{z:0.24,pts:[[-0.53,1.14],[0.53,1.14],[0.5,1.21],[-0.5,1.21]]},{z:-0.64,pts:[[-0.53,1.14],[0.53,1.14],[0.5,1.21],[-0.5,1.21]]}]),navy);
  // roof scoop
  K.add(loft([{z:0.05,pts:oct(0.22,1.2,1.3,{tp:0.8})},{z:-0.45,pts:oct(0.26,1.2,1.34,{tp:0.8})}]),navy);
  K.add(box(0.36,0.08,0.03),panel,M(0,1.27,0.06));
  polyline(K,[V(-0.25,1.33,0.04),V(0.25,1.33,0.04)],neon,0.025,0.025);
  sides(s=>{
    K.add(strut(V(s*0.77,0.7,1.04),V(s*0.51,1.19,0.24),0.08,0.07),navy);
    K.add(strut(V(s*0.77,0.9,-0.64),V(s*0.51,1.19,-0.64),0.08,0.07),navy);
    // roofline + A-pillar outline, deck edge lines down to the tail
    polyline(K,[V(s*0.79,0.7,1.05),V(s*0.53,1.21,0.25),V(s*0.53,1.21,-0.64),V(s*0.6,deckY(-1.4)+0.02,-1.4),V(s*0.74,deckY(-2.3)+0.03,-2.3)],neon,0.03,0.03);
  });
  // hood scoop with outline + fender character lines + arch outlines
  K.add(loft([{z:1.25,pts:oct(0.4,topY(0,1.25)-0.02,topY(0,1.25)+0.09,{tp:0.85})},{z:1.85,pts:oct(0.34,topY(0,1.85)-0.02,topY(0,1.85)+0.05,{tp:0.85})}]),panel);
  polyline(K,[V(-0.42,topY(0,1.24)+0.09,1.24),V(0.42,topY(0,1.24)+0.09,1.24),V(0.36,topY(0,1.86)+0.06,1.86),V(-0.36,topY(0,1.86)+0.06,1.86)],neon,0.025,0.025,true);
  sides(s=>{
    polyline(K,[2.38,2.1,1.7,1.2,0.8].map(z=>V(s*S.side(z)*0.8,topY(S.side(z)*0.8,z)+0.015,z)),neon,0.03,0.03);
    polyline(K,S.archPts(s,true),neon,0.035,0.035);polyline(K,S.archPts(s,false),neon,0.035,0.035);
    // side armour panel + skirt outline
    K.add(plate([[0.95,0.3],[0.6,0.62],[-0.55,0.66],[-0.95,0.42],[-0.95,0.3]],0.02),panel,M(s*1.06,0,0));
    polyline(K,[V(s*1.075,0.3,0.95),V(s*1.075,0.62,0.6),V(s*1.075,0.66,-0.55),V(s*1.075,0.42,-0.95)],neon,0.03,0.03);
    polyline(K,[V(s*1.08,0.18,0.98),V(s*1.08,0.18,-0.92)],neon,0.03,0.03);
    K.add(box(0.05,0.05,0.2),panel,M(s*0.86,0.98,0.82));
    K.add(box(0.15,0.09,0.13),navy,M(s*0.95,1.0,0.8));
  });
  // front: big hexagonal mesh grille, side hex intakes, slim LED headlights
  const hex=(cx,cy,rx,ry,z)=>[0,1,2,3,4,5].map(i=>{const a=i*Math.PI/3;return V(cx+Math.cos(a)*rx,cy+Math.sin(a)*ry,z)});
  K.add(facePlate(hex(0,0.36,0.46,0.2,0).map(p=>[p.x,p.y]),0.05),panel,M(0,0,2.54));
  for(let i=-3;i<=3;i++)K.add(box(0.012,0.3,0.015),matte('#252c3c'),M(i*0.1,0.36,2.57));
  for(let j=-2;j<=2;j++)K.add(box(0.7,0.012,0.015),matte('#252c3c'),M(0,0.36+j*0.06,2.57));
  polyline(K,hex(0,0.36,0.5,0.23,2.575),neon,0.035,0.035,true);
  sides(s=>{
    K.add(facePlate(hex(s*0.74,0.32,0.18,0.12,0).map(p=>[p.x,p.y]),0.05),panel,M(0,0,2.42));
    polyline(K,hex(s*0.74,0.32,0.2,0.14,2.45),neon,0.03,0.03,true);
    K.add(strut(V(s*0.32,topY(0.32,2.44)+0.012,2.44),V(s*0.82,topY(0.82,2.2)+0.012,2.2),0.05,0.03),head);
    K.add(strut(V(s*0.55,topY(0.55,2.36)-0.03,2.38),V(s*0.86,topY(0.86,2.22)-0.04,2.24),0.025,0.02),head);
    K.add(strut(V(s*0.1,0.13,2.66),V(s*1.04,0.13,2.22),0.26,0.04),panel);
  });
  // rear: louvred vents on the deck, neon fascia frame, chevron tail lights, big twin exhausts, fins
  sides(s=>{
    K.add(drape([-1.25,-1.55,-1.85],()=>s>0?[0.08,0.48]:[-0.48,-0.08],(x,z)=>deckY(z),2,0.01,0.02),matte('#5a6578'));
    for(let k=0;k<5;k++){const z=-1.28-k*0.13;K.add(box(0.36,0.025,0.05),matte('#0b0e16'),M(s*0.28,deckY(z)+0.03,z,-0.4))}
  });
  polyline(K,[V(-1.0,0.6,-2.44),V(-0.86,0.8,-2.44),V(0.86,0.8,-2.44),V(1.0,0.6,-2.44),V(0.86,0.5,-2.44),V(-0.86,0.5,-2.44)],neon,0.035,0.035,true);
  K.add(box(1.7,0.26,0.03),matte('#0a0d14'),M(0,0.65,-2.43));
  sides(s=>{for(let k=0;k<3;k++){const x0=s*(0.42+k*0.14);
    K.add(strut(V(x0,0.72,-2.455),V(x0-s*0.07,0.65,-2.455),0.035,0.03),tail);
    K.add(strut(V(x0-s*0.07,0.65,-2.455),V(x0,0.58,-2.455),0.035,0.03),tail)}});
  K.add(facePlate([[-0.48,0.22],[-0.42,0.46],[0.42,0.46],[0.48,0.22],[0.42,0.14],[-0.42,0.14]],0.08),grey,M(0,0,-2.44));
  sides(s=>{const c=new THREE.CylinderGeometry(0.13,0.13,0.06,8);c.rotateX(Math.PI/2);K.add(c,matte('#06080c'),M(s*0.2,0.3,-2.47))});
  polyline(K,[V(-1.0,0.5,-2.45),V(-0.95,0.22,-2.45),V(-0.55,0.12,-2.45)],neon,0.03,0.03);
  polyline(K,[V(1.0,0.5,-2.45),V(0.95,0.22,-2.45),V(0.55,0.12,-2.45)],neon,0.03,0.03);
  [-0.66,-0.44,0.44,0.66].forEach(x=>K.add(box(0.03,0.2,0.3),panel,M(x,0.16,-2.32)));
  const wm={tire:matte(C.tire),rim:matte(C.rim),spoke:matte('#262d3c'),ring:glow(C.neon,1.6)};
  return finish(car,body,K,fourWheels(car,NW,wm,'turbine'),[tail],[[-0.2,0.3,-2.5,0.1],[0.2,0.3,-2.5,0.1]],C.flame,'sentinel');
}

/* =========================================================================
   CAR 5 — Aero-Blade X (silver & gold, tri-fin tail)
   ========================================================================= */
const AW={zf:1.42,rf:0.35,af:0.41,zr:-1.42,rr:0.38,ar:0.45,tf:0.86,tr:0.88,wf:0.32,wr:0.4};
const AERO_ROWS=[
  [-2.42,0.86,0.28,0.56,0.84,0.86],[-2.25,0.98,0.24,0.62,0.9,0.9],[-1.95,1.03,0.2,0.68,0.95,0.9],
  [-1.42,1.05,0.2,0.72,0.97,0.88],[-0.95,1.0,0.2,0.62,0.9,0.86],[-0.4,0.97,0.2,0.56,0.84,0.84],
  [0.4,0.97,0.2,0.55,0.82,0.8],[0.95,1.0,0.2,0.6,0.88,0.62],[1.42,1.01,0.2,0.62,0.92,0.56],
  [1.9,0.97,0.19,0.52,0.82,0.5],[2.15,0.9,0.18,0.44,0.68,0.46],[2.35,0.7,0.17,0.36,0.52,0.4],[2.52,0.36,0.17,0.3,0.38,0.36]];
function createAeroBladeX(opts={}){
  const C=pickLivery('aero',opts.livery),env=opts.envMap||null;
  const car=new THREE.Group(),body=new THREE.Group();car.add(body);
  const K=Kit(),S=Shell(AERO_ROWS,AW,{inner:0.4,peak:0.74}),topY=S.topY;
  const silver=paint(C.body,env,{metalness:0.55,roughness:0.3}),panel=paint(C.panel,env,{metalness:0.4,roughness:0.45}),
        gold=glow(C.trim,1.0),goldM=metal(C.trim,env),glass=glassMat(C.glass,env),lamp=glow(C.lamp,2.4),tail=tailMat();
  K.add(S.geo,silver);
  // teardrop canopy that flows into the engine cover
  const cabRows=[cab(1.15,0.74,0.58,0.6,0.7),cab(0.25,0.74,0.6,1.13,0.5),cab(-0.5,0.72,0.62,1.14,0.48),cab(-1.1,0.68,0.66,1.02,0.42),cab(-1.6,0.6,0.7,0.94,0.34)];
  const deckRows=[cab(-1.6,0.6,0.7,0.94,0.34),cab(-2.3,0.52,0.76,0.9,0.36)];
  const deckY=cabTop(deckRows);
  K.add(loft(cabRows),glass);K.add(loft(deckRows),panel);
  K.add(loft([{z:0.3,pts:[[-0.52,1.08],[0.52,1.08],[0.49,1.155],[-0.49,1.155]]},{z:-0.6,pts:[[-0.5,1.09],[0.5,1.09],[0.47,1.16],[-0.47,1.16]]}]),panel);
  K.add(loft([{z:0.0,pts:oct(0.1,1.15,1.24,{tp:0.8})},{z:-0.45,pts:oct(0.12,1.15,1.27,{tp:0.8})}]),goldM);   // roof snorkel
  sides(s=>{
    K.add(strut(V(s*0.73,0.62,1.12),V(s*0.5,1.14,0.3),0.07,0.06),silver);
    polyline(K,[V(s*0.75,0.62,1.14),V(s*0.51,1.16,0.3),V(s*0.5,1.17,-0.6),V(s*0.42,1.04,-1.1),V(s*0.36,0.96,-1.6)],gold,0.025,0.025);
  });
  // dark centre hood panel with gold edges, quad round lamps, mirrors on stalks
  K.add(drape([2.42,2.2,1.9,1.5,1.12],z=>{const hw=S.side(z);return[-hw*0.42,hw*0.42]},topY,4,0.01,0.025),panel);
  sides(s=>{
    polyline(K,[2.42,2.2,1.9,1.5,1.12].map(z=>V(s*S.side(z)*0.42,topY(S.side(z)*0.42,z)+0.02,z)),gold,0.025,0.025);
    [[0.6,2.14,0.06],[0.73,2.06,0.06],[0.84,1.98,0.045],[0.66,2.03,0.045]].forEach(([x,z,r])=>{
      const g=new THREE.CylinderGeometry(r,r,0.03,10);g.rotateX(Math.PI/2-0.6);K.add(g,lamp,M(s*x,topY(x,z)+0.01,z+0.01))});
    K.add(strut(V(s*0.82,0.98,0.86),V(s*0.95,1.08,0.7),0.03,0.03),goldM);
    K.add(box(0.13,0.08,0.11),silver,M(s*0.98,1.1,0.66));
  });
  // V-shaped lower intake outlined in gold + splitter
  sides(s=>{
    K.add(strut(V(0,0.24,2.56),V(s*0.95,0.3,2.12),0.16,0.18),panel);
    K.add(strut(V(s*0.1,0.12,2.62),V(s*1.02,0.12,2.15),0.3,0.035),panel);
  });
  polyline(K,[V(-1.0,0.36,2.14),V(-0.6,0.22,2.42),V(-0.25,0.3,2.56),V(0.25,0.3,2.56),V(0.6,0.22,2.42),V(1.0,0.36,2.14)],gold,0.035,0.035);
  polyline(K,[V(-1.04,0.13,2.16),V(-0.12,0.13,2.66),V(0.12,0.13,2.66),V(1.04,0.13,2.16)],gold,0.03,0.03);
  // sides: dark scallop with gold outline, arch trims
  sides(s=>{
    K.add(plate([[0.9,0.32],[0.55,0.72],[-0.2,0.74],[-0.95,0.5],[-0.95,0.32]],0.02),panel,M(s*1.02,0,0));
    polyline(K,[V(s*1.035,0.32,0.92),V(s*1.035,0.72,0.55),V(s*1.035,0.74,-0.2),V(s*1.035,0.5,-0.95)],gold,0.028,0.028);
    polyline(K,S.archPts(s,true).slice(2),gold,0.028,0.028);
  });
  // tail: two big slanted fins with gold edges, gold chevron on the deck
  sides(s=>{
    K.add(plate([[-1.25,0],[-2.2,0],[-2.45,0.7],[-1.9,0.62]],0.06),silver,M(s*0.42,0.92,0,0,0,-s*0.62));
    const sx=Math.sin(0.62),cy=Math.cos(0.62);
    polyline(K,[V(s*0.42,0.94,-1.25),V(s*(0.42+sx*0.62),0.92+cy*0.62,-1.9),V(s*(0.42+sx*0.7),0.92+cy*0.7,-2.45)],gold,0.035,0.035);
    polyline(K,[V(0,deckY(-1.7)+0.03,-1.7),V(s*0.32,deckY(-2.15)+0.03,-2.15)],gold,0.05,0.025);
  });
  // diamond exhaust cluster, vertical LED blades, gold zig-zag diffuser
  K.add(facePlate([[0,0.82],[0.3,0.55],[0,0.28],[-0.3,0.55]],0.14),panel,M(0,0,-2.4));
  polyline(K,[V(0,0.84,-2.475),V(0.32,0.55,-2.475),V(0,0.26,-2.475),V(-0.32,0.55,-2.475)],gold,0.03,0.03,true);
  const exP=[[0,0.66],[-0.12,0.55],[0.12,0.55],[0,0.44]];
  exP.forEach(([x,y])=>{const p=new THREE.CylinderGeometry(0.06,0.06,0.12,10);p.rotateX(Math.PI/2);K.add(p,goldM,M(x,y,-2.5));
    const i=new THREE.CircleGeometry(0.045,10);i.rotateY(Math.PI);K.add(i,matte('#0b0b0d'),M(x,y,-2.561))});
  sides(s=>polyline(K,[V(s*0.9,0.36,-2.36),V(s*0.96,0.6,-2.3),V(s*0.92,0.84,-2.2)],tail,0.045,0.04));
  polyline(K,[V(-1.02,0.42,-2.42),V(-0.8,0.2,-2.44),V(-0.5,0.2,-2.44),V(-0.3,0.34,-2.46),V(0.3,0.34,-2.46),V(0.5,0.2,-2.44),V(0.8,0.2,-2.44),V(1.02,0.42,-2.42)],gold,0.035,0.035);
  K.add(box(1.6,0.12,0.2),panel,M(0,0.2,-2.3));
  const wm={tire:matte(C.tire),rim:matte(C.rim),spoke:matte(C.spoke),ring:glow(C.trim,1.2)};
  return finish(car,body,K,fourWheels(car,AW,wm,'aero'),[tail],exP.map(([x,y])=>[x,y,-2.57,0.05]),C.flame,'aero');
}

const BUILDERS={f1:createF1Car,super:createSupercar,specter:createSpecterGT,sentinel:createSentinelV12,aero:createAeroBladeX};
root.createF1Car=createF1Car;root.createSupercar=createSupercar;root.createSpecterGT=createSpecterGT;
root.createSentinelV12=createSentinelV12;root.createAeroBladeX=createAeroBladeX;
root.OverdriveCars={createF1Car,createSupercar,createSpecterGT,createSentinelV12,createAeroBladeX,build:(m,o)=>BUILDERS[m](o),LIVERIES};
if(typeof module!=='undefined'&&module.exports)module.exports=root.OverdriveCars;
})(typeof window!=='undefined'?window:globalThis);
