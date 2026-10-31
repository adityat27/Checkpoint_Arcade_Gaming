/* =========================================================================
   SLIPSTREAM · cars (needs THREE)
   -------------------------------------------------------------------------
   Every vehicle is built from code — no model files. The body is "lofted":
   a list of key cross-sections from the nose to the tail (width, sill,
   shoulder line, roof) is smoothly interpolated into ~40 rings and skinned.
   Wheel arches are cut out of the bottom edge, the windscreen, side windows
   and rear glass are picked out by which part of the ring they fall on, and
   lights, grille, mirrors, plates, spoilers, roof rails etc. are added on top.

   SSCars.player(style, colour, plate)  -> detailed car for you / your rival
   SSCars.traffic(type)                  -> per-material geometries for instancing
   SSCars.STYLES                          style keyframes (edit to reshape a car)
   ========================================================================= */
(function(root){
'use strict';
const T=()=>root.THREE;
const lerp=(a,b,t)=>a+(b-a)*t;

/* ---------- body shapes ----------
   Each key section: z (m, + = front), w (half width at the shoulder), ws (half
   width at the sill), yb (bottom), yh (shoulder line), yr (roof / top), wr (roof
   half width), s = what the body is from this section to the next one:
   'h' hood, 'w' windscreen, 'c' cabin (side windows), 'p' pillar, 'r' rear glass, 't' tail.
   Wheels: r radius, f/b axle positions, tw tyre width. */
const SHAPES={
  gt:{len:4.55,wheel:{r:.345,f:1.42,b:-1.44,tw:.27,rim:'sport'},k:[
    [2.275,.78,.72,.36,.60,.64,.50,'h'],[2.13,.92,.86,.30,.69,.73,.62,'h'],[1.62,.96,.90,.28,.75,.79,.67,'h'],
    [.72,.965,.90,.27,.81,.86,.68,'w'],[-.02,.965,.90,.27,.85,1.25,.60,'c'],[-.52,.97,.91,.27,.87,1.24,.62,'p'],[-.62,.97,.91,.27,.87,1.235,.62,'c'],
    [-1.06,.97,.91,.27,.89,1.13,.61,'r'],[-1.86,.95,.89,.30,.90,.95,.63,'t'],[-2.15,.90,.83,.34,.87,.90,.58,'t'],[-2.275,.80,.74,.40,.80,.83,.50,'t']],
    spoiler:1,exhaust:[[-.42,.36],[.42,.36]],head:'slim',tail:'bar'},
  hatch:{len:3.95,wheel:{r:.325,f:1.24,b:-1.27,tw:.24,rim:'sport'},k:[
    [1.975,.74,.70,.38,.64,.68,.50,'h'],[1.82,.85,.81,.33,.74,.78,.60,'h'],[1.32,.88,.84,.31,.82,.86,.64,'h'],
    [1.12,.88,.84,.31,.84,.89,.65,'w'],[.46,.885,.84,.31,.89,1.39,.665,'c'],[-.06,.885,.84,.31,.91,1.40,.67,'p'],[-.17,.885,.84,.31,.91,1.40,.67,'c'],
    [-1.42,.885,.84,.31,.93,1.37,.65,'r'],[-1.72,.87,.82,.33,.94,1.16,.61,'t'],[-1.975,.80,.75,.38,.91,.98,.54,'t']],
    spoiler:2,exhaust:[[0,.34]],head:'round',tail:'split'},
  suv:{len:4.8,wheel:{r:.40,f:1.53,b:-1.50,tw:.29,rim:'six'},k:[
    [2.4,.86,.82,.48,.88,.92,.60,'h'],[2.22,.96,.92,.44,.98,1.02,.72,'h'],[1.62,.98,.94,.42,1.05,1.10,.76,'h'],
    [1.48,.98,.94,.42,1.06,1.12,.77,'w'],[.86,.985,.94,.42,1.10,1.80,.80,'c'],[.06,.985,.94,.42,1.11,1.81,.81,'p'],[-.06,.985,.94,.42,1.11,1.81,.81,'c'],
    [-1.92,.985,.94,.42,1.12,1.80,.81,'r'],[-2.18,.975,.93,.44,1.12,1.64,.78,'t'],[-2.4,.90,.86,.50,1.06,1.32,.70,'t']],
    rails:1,exhaust:[[-.5,.42]],head:'wide',tail:'split',guard:1},
  // ---- traffic ----
  sedan:{len:4.5,wheel:{r:.33,f:1.38,b:-1.40,tw:.24,rim:'cap'},k:[
    [2.25,.80,.76,.36,.64,.68,.52,'h'],[2.08,.88,.84,.32,.72,.76,.62,'h'],[1.40,.91,.86,.31,.80,.84,.66,'h'],
    [1.0,.91,.86,.31,.82,.87,.67,'w'],[.32,.91,.86,.31,.87,1.42,.66,'c'],[-.20,.91,.86,.31,.88,1.43,.67,'p'],[-.30,.91,.86,.31,.88,1.43,.67,'c'],
    [-1.02,.91,.86,.31,.89,1.38,.65,'r'],[-1.62,.90,.85,.33,.90,.95,.66,'t'],[-2.25,.82,.78,.38,.88,.92,.56,'t']],
    head:'slim',tail:'split'},
  hatchT:{len:3.9,wheel:{r:.31,f:1.22,b:-1.26,tw:.22,rim:'cap'},k:[
    [1.95,.74,.70,.38,.64,.68,.50,'h'],[1.78,.84,.80,.34,.74,.78,.60,'h'],[1.30,.86,.82,.33,.82,.86,.63,'h'],
    [1.08,.86,.82,.33,.84,.89,.64,'w'],[.40,.86,.82,.33,.89,1.46,.66,'c'],[-1.42,.86,.82,.33,.92,1.44,.65,'r'],[-1.70,.85,.81,.34,.93,1.20,.60,'t'],[-1.95,.79,.74,.40,.90,1.02,.53,'t']],
    head:'round',tail:'split'},
  suvT:{len:4.8,wheel:{r:.38,f:1.52,b:-1.50,tw:.27,rim:'cap'},k:[
    [2.4,.86,.82,.48,.88,.92,.60,'h'],[2.2,.96,.92,.44,.98,1.02,.72,'h'],[1.55,.975,.93,.42,1.05,1.10,.76,'h'],
    [1.40,.975,.93,.42,1.06,1.12,.77,'w'],[.80,.975,.93,.42,1.10,1.78,.80,'c'],[-1.95,.975,.93,.42,1.12,1.77,.80,'r'],[-2.2,.97,.92,.44,1.12,1.60,.78,'t'],[-2.4,.90,.86,.50,1.06,1.30,.70,'t']],
    rails:1,head:'wide',tail:'split'},
  van:{len:5.2,wheel:{r:.36,f:1.80,b:-1.62,tw:.25,rim:'cap'},k:[
    [2.6,.88,.86,.42,.92,.96,.66,'h'],[2.42,.98,.95,.38,1.00,1.06,.80,'h'],[2.12,1.0,.97,.38,1.04,1.12,.84,'w'],
    [1.50,1.0,.97,.38,1.08,2.02,.92,'p'],[1.30,1.0,.97,.38,1.08,2.05,.94,'c'],[.60,1.0,.97,.38,1.08,2.06,.95,'p'],[-2.45,1.0,.97,.38,1.08,2.06,.95,'t'],[-2.6,.97,.95,.42,1.06,2.0,.92,'t']],
    head:'wide',tail:'tall'},
  bus:{len:11.6,wheel:{r:.52,f:3.6,b:-3.0,tw:.32,rim:'bus',dual:1},k:[
    [5.8,1.22,1.2,.52,.92,1.0,1.0,'w'],[5.55,1.27,1.25,.46,1.0,2.95,1.17,'w'],[5.0,1.275,1.25,.46,1.45,3.1,1.19,'c'],
    ...Array.from({length:8},(_,i)=>[[4.35-i*1.15,1.275,1.25,.46,1.45,3.1,1.19,'p'],[4.2-i*1.15,1.275,1.25,.46,1.45,3.1,1.19,'c']]).flat(),
    [-4.9,1.275,1.25,.46,1.45,3.1,1.19,'r'],[-5.6,1.27,1.25,.48,1.5,3.05,1.17,'t'],[-5.8,1.22,1.2,.54,1.5,2.9,1.1,'t']],
    head:'bus',tail:'tall',stripe:1},
  truckCab:{len:2.4,wheel:null,tail:'none',k:[
    [1.2,1.15,1.12,.62,1.25,1.3,1.0,'h'],[1.05,1.22,1.2,.58,1.32,1.4,1.1,'w'],[.7,1.24,1.22,.58,1.4,2.75,1.12,'p'],[.55,1.24,1.22,.58,1.4,2.8,1.15,'c'],[-.4,1.24,1.22,.58,1.4,2.85,1.16,'p'],[-1.2,1.22,1.2,.62,1.4,2.8,1.12,'t']],
    head:'truck'},
};
// truck = cab + cargo box + wheels, built in traffic()

/* ---------- smooth interpolation of the key sections (monotone cubic: no wobbles) ---------- */
function interp(K,j,z){
  const n=K.length;
  if(z>=K[0][0])return K[0][j];if(z<=K[n-1][0])return K[n-1][j];
  let i=0;while(i<n-2&&z<K[i+1][0])i++;
  const h=[],d=[];for(let k=0;k<n-1;k++){h[k]=K[k][0]-K[k+1][0];d[k]=(K[k+1][j]-K[k][j])/h[k]}
  // PCHIP tangents (weighted harmonic mean): the curve never overshoots the key values
  const m=k=>{if(k===0)return d[0];if(k===n-1)return d[n-2];if(d[k-1]*d[k]<=0)return 0;const a=h[k-1],b=h[k];return 3*(a+b)/((2*b+a)/d[k-1]+(b+2*a)/d[k])};
  const t=(K[i][0]-z)/h[i],t2=t*t,t3=t2*t;
  return(2*t3-3*t2+1)*K[i][j]+(t3-2*t2+t)*h[i]*m(i)+(-2*t3+3*t2)*K[i+1][j]+(t3-t2)*h[i]*m(i+1);
}
function segAt(K,z){for(let i=0;i<K.length-1;i++)if(z<=K[i][0]&&z>=K[i+1][0])return K[i][7];return K[K.length-1][7]}

// half cross-section (centre bottom -> centre top), 10 points
function ring(w,ws,yb,yh,yr,wr){
  const hh=Math.max(.02,yh-yb),gh=Math.max(.02,yr-yh);
  return[[0,yb],[ws*.86,yb],[ws,yb+Math.min(.07,hh*.22)],[w*.985,yb+hh*.5],[w,yb+hh*.86],[w*.965,yh],
    [lerp(w*.94,wr,.16),yh+gh*.13],[wr+(w-wr)*.05,yr-gh*.13],[wr*.8,yr],[0,yr+Math.min(.03,gh*.08)]];
}
// material per strip (strip j joins half-ring points j and j+1): 0 paint, 1 glass, 2 dark trim
function stripMat(j,seg,arch){
  if(j===0)return 2;
  if(arch&&j<=2)return 2;
  if(j<=5)return 0;
  if(seg==='c')return j===6?1:0;
  if(seg==='w'||seg==='r')return j===6?0:1;   // windscreen / rear glass between the pillars
  return 0;
}

/* ---------- the lofted body: geometry with groups [paint, glass, trim] ---------- */
function body(S,o={}){
  const THREE=T(),K=S.k,L=S.len,W=S.wheel,ds=o.ds||.1;
  const zs=[];for(let z=K[0][0];z>K[K.length-1][0]+1e-6;z-=ds)zs.push(z);zs.push(K[K.length-1][0]);
  const axles=W?[W.f,W.b]:[],R=W?W.r+.075:0;
  const arch=z=>{let y=-1;for(const a of axles){const dz=z-a;if(Math.abs(dz)<R)y=Math.max(y,W.r+Math.sqrt(R*R-dz*dz))}return y};
  const P=[],rings=[];
  for(const z of zs){
    const g=j=>interp(K,j,z);let yb=g(3);const yh=g(4),a=arch(z);   // columns: [z,w,ws,yb,yh,yr,wr,s]
    const inArch=a>yb;if(inArch)yb=Math.min(a,yh-.05);
    const half=ring(g(1),g(2),yb,yh,g(5),g(6));
    // full loop: centre bottom, right side up, centre top, left side down
    const loop=[half[0],...half.slice(1,9),half[9],...half.slice(1,9).reverse().map(([x,y])=>[-x,y])];
    rings.push({z,seg:segAt(K,z),arch:inArch,base:P.length/3});
    for(const[x,y]of loop)P.push(x,y,z);
  }
  const NL=18,idx=[[],[],[]];
  for(let r=0;r<rings.length-1;r++){
    const A=rings[r],B=rings[r+1],seg=A.seg;
    for(let k=0;k<NL;k++){
      const j=k<9?k:17-k;   // mirrored strip index
      const m=stripMat(j,seg,A.arch||B.arch);
      const a=A.base+k,b=A.base+(k+1)%NL,c=B.base+(k+1)%NL,d=B.base+k;
      idx[m].push(a,c,b,a,d,c);
    }
  }
  // end caps (flat, own vertices so they shade crisply)
  const capM=o.capMat!=null?o.capMat:0;
  [[0,1],[rings.length-1,-1]].forEach(([ri,dir])=>{
    const R_=rings[ri],st=P.length/3;let cy=0;
    for(let k=0;k<NL;k++){const q=(R_.base+k)*3;P.push(P[q],P[q+1],P[q+2]);cy+=P[q+1]}
    P.push(0,cy/NL,R_.z);const c=st+NL;
    for(let k=0;k<NL;k++){const a=st+k,b=st+(k+1)%NL;if(dir>0)idx[capM].push(c,a,b);else idx[capM].push(c,b,a)}
  });
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute(P,3));
  const all=[];let off=0;idx.forEach((l,m)=>{g.addGroup(off,l.length,m);off+=l.length;all.push(...l)});
  g.setIndex(all);g.computeVertexNormals();
  g.userData={rings,zf:K[0][0],zb:K[K.length-1][0],K};
  return g;
}
// body height / half width at z (for placing parts)
function sectAt(S,z){const g=j=>interp(S.k,j,z);return{w:g(1),ws:g(2),yb:g(3),yh:g(4),yr:g(5),wr:g(6)}}

/* ---------- small geometry helpers ---------- */
function box(w,h,d,x,y,z,rx=0,ry=0,rz=0){const g=new(T().BoxGeometry)(w,h,d);if(rx||ry||rz)g.applyMatrix4(new(T().Matrix4)().makeRotationFromEuler(new(T().Euler)(rx,ry,rz)));g.translate(x,y,z);return g}
function cyl(r1,r2,h,seg,x,y,z,axis='y'){const g=new(T().CylinderGeometry)(r1,r2,h,seg);if(axis==='x')g.rotateZ(Math.PI/2);if(axis==='z')g.rotateX(Math.PI/2);g.translate(x,y,z);return g}
function plain(g){const n=g.index?g.toNonIndexed():g;if(n!==g)g.dispose();n.deleteAttribute&&n.attributes.uv&&!n.userData.keepUV&&n.deleteAttribute('uv');if(!n.attributes.normal)n.computeVertexNormals();return n}
function merge(list){
  const THREE=T();list=list.filter(Boolean).map(plain);if(!list.length)return null;
  let n=0;list.forEach(g=>n+=g.attributes.position.count);
  const P=new Float32Array(n*3),N=new Float32Array(n*3);let o=0;
  list.forEach(g=>{P.set(g.attributes.position.array,o*3);N.set(g.attributes.normal.array,o*3);o+=g.attributes.position.count;g.dispose()});
  const G=new THREE.BufferGeometry();G.setAttribute('position',new THREE.BufferAttribute(P,3));G.setAttribute('normal',new THREE.BufferAttribute(N,3));G.computeBoundingSphere();return G;
}
// pull one material group out of a grouped geometry
function groupGeo(g,m){
  const THREE=T(),gr=g.groups.find(q=>q.materialIndex===m);if(!gr||!gr.count)return null;
  const I=g.index.array,P=g.attributes.position.array,N=g.attributes.normal.array,p=new Float32Array(gr.count*3),n=new Float32Array(gr.count*3);
  for(let i=0;i<gr.count;i++){const v=I[gr.start+i];p.set(P.subarray(v*3,v*3+3),i*3);n.set(N.subarray(v*3,v*3+3),i*3)}
  const G=new THREE.BufferGeometry();G.setAttribute('position',new THREE.BufferAttribute(p,3));G.setAttribute('normal',new THREE.BufferAttribute(n,3));return G;
}

/* ---------- wheels ---------- */
function tyreGeo(r,w){
  const THREE=T(),ri=r*.62,b=Math.min(.05,w*.2);
  const pts=[[ri,-w/2],[r-b,-w/2],[r-b*.25,-w/2+b*.4],[r,-w/2+b],[r,w/2-b],[r-b*.25,w/2-b*.4],[r-b,w/2],[ri,w/2]].map(([x,y])=>new THREE.Vector2(x,y));
  const g=new THREE.LatheGeometry(pts,22);g.rotateZ(Math.PI/2);return g;   // axis along x
}
// rim parts on a wheel whose axis is x, outer face at +x
function rimParts(r,w,style){
  const THREE=T(),rr=r*.66,face=w/2-.02,out={metal:[],dark:[],accent:[]};
  out.dark.push(cyl(rr,rr,w*.8,20,0,0,0,'x'));                     // barrel
  out.metal.push(cyl(rr,rr*.98,.03,22,face,0,0,'x'));                // lip
  const spokes=style==='six'?6:style==='bus'?8:style==='cap'?0:5;
  if(style==='cap'){out.metal.push(cyl(rr*.9,rr*.82,.04,18,face-.01,0,0,'x'));out.dark.push(cyl(rr*.25,rr*.25,.05,10,face+.005,0,0,'x'));for(let k=0;k<8;k++){const a=k/8*Math.PI*2;out.dark.push(box(.012,rr*.5,.035,face+.012,Math.cos(a)*rr*.55,Math.sin(a)*rr*.55,a))}}
  else{
    out.dark.push(cyl(rr*.92,rr*.92,.02,20,face-.03,0,0,'x'));      // dark back plate shows between spokes
    for(let k=0;k<spokes;k++){const a=k/spokes*Math.PI*2,sw=style==='bus'?.05:style==='six'?.07:.06;
      const g=box(.045,rr*.84,sw,face,0,0);g.translate(0,rr*.44,0);g.rotateX(a);out.metal.push(g)}
    out.metal.push(cyl(rr*.22,rr*.24,.06,12,face+.01,0,0,'x'));
    if(style==='sport')out.accent.push(box(.08,.12,.18,face-.09,rr*.42,-rr*.25));   // brake caliper
  }
  return out;
}

/* ---------- lights, grille, plates, extras ---------- */
function frontParts(S,zf){
  const s=sectAt(S,zf-.04),x=s.w,P={lightF:[],dark:[],metal:[]},yb=s.yb,yh=s.yh,ly=yb+(yh-yb)*.62;
  const k=S.head||'slim';
  if(k==='slim'){[-1,1].forEach(sd=>{P.lightF.push(box(x*.42,.07,.05,sd*x*.52,ly+.03,zf+.005,0,0,-sd*.12));P.dark.push(box(x*.48,.12,.04,sd*x*.52,ly,zf-.002))});P.dark.push(box(x*.7,.11,.04,0,ly-.05,zf));P.dark.push(box(x*1.1,.12,.04,0,yb+.1,zf-.01))}
  else if(k==='round'){[-1,1].forEach(sd=>{P.dark.push(box(x*.4,.16,.04,sd*x*.58,ly,zf-.002));P.lightF.push(cyl(.06,.06,.05,14,sd*x*.66,ly,zf+.01,'z'));P.lightF.push(box(x*.16,.04,.05,sd*x*.44,ly+.05,zf+.006))});P.dark.push(box(x*.6,.14,.04,0,ly-.04,zf));P.dark.push(box(x*1.2,.14,.04,0,yb+.11,zf-.01))}
  else if(k==='wide'){[-1,1].forEach(sd=>{P.dark.push(box(x*.42,.2,.04,sd*x*.6,ly,zf-.002));P.lightF.push(box(x*.34,.06,.05,sd*x*.6,ly+.05,zf+.005));P.lightF.push(box(x*.12,.1,.05,sd*x*.72,ly-.03,zf+.005))});
    P.dark.push(box(x*.76,.26,.04,0,ly-.02,zf));for(let i=0;i<3;i++)P.metal.push(box(x*.7,.022,.05,0,ly-.1+i*.08,zf+.01));P.dark.push(box(x*1.3,.16,.05,0,yb+.12,zf-.01))}
  else if(k==='bus'){[-1,1].forEach(sd=>{P.lightF.push(box(.3,.12,.05,sd*x*.74,yb+.38,zf+.01));P.lightF.push(box(.14,.1,.05,sd*x*.5,yb+.38,zf+.01))});P.dark.push(box(x*1.6,.26,.05,0,yb+.38,zf));P.metal.push(box(x*1.7,.1,.06,0,yb+.12,zf))}
  else if(k==='truck'){[-1,1].forEach(sd=>P.lightF.push(box(.26,.16,.05,sd*x*.74,yb+.32,zf+.01)));P.dark.push(box(x*1.2,.5,.05,0,yb+.45,zf));for(let i=0;i<5;i++)P.metal.push(box(x*1.1,.03,.06,0,yb+.27+i*.1,zf+.01));P.metal.push(box(x*1.9,.16,.08,0,yb+.07,zf+.02))}
  return P;
}
function rearParts(S,zb){
  const s=sectAt(S,zb+.04),x=s.w,P={lightR:[],dark:[],metal:[]},yb=s.yb,yh=s.yh,ly=yb+(yh-yb)*.7;
  const k=S.tail||'split';
  if(k==='none')return P;
  if(k==='bar'){P.lightR.push(box(x*1.7,.05,.05,0,ly+.02,zb-.005));[-1,1].forEach(sd=>P.lightR.push(box(x*.36,.12,.05,sd*x*.66,ly,zb-.006)));P.dark.push(box(x*1.5,.14,.04,0,yb+.1,zb+.01))}
  else if(k==='split'){[-1,1].forEach(sd=>{P.lightR.push(box(x*.44,.1,.05,sd*x*.6,ly,zb-.005));P.dark.push(box(x*.48,.14,.04,sd*x*.6,ly,zb+.002))});P.dark.push(box(x*1.4,.14,.04,0,yb+.1,zb+.01))}
  else if(k==='tall'){[-1,1].forEach(sd=>{P.lightR.push(box(.14,.36,.05,sd*x*.86,yb+.5,zb-.005));P.lightR.push(box(.14,.1,.05,sd*x*.86,yb+.9,zb-.005))});P.dark.push(box(x*1.9,.16,.06,0,yb+.08,zb))}
  return P;
}
function plateTex(text){
  const THREE=T(),cv=document.createElement('canvas');cv.width=256;cv.height=64;const c=cv.getContext('2d');
  c.fillStyle='#f4f4ee';c.fillRect(0,0,256,64);c.strokeStyle='#14111f';c.lineWidth=6;c.strokeRect(3,3,250,58);
  c.fillStyle='#14111f';c.font='bold 40px "Arial Black",Impact,sans-serif';c.textAlign='center';c.textBaseline='middle';c.fillText(String(text).toUpperCase().slice(0,9),128,35);
  const t=new THREE.CanvasTexture(cv);t.anisotropy=4;if(THREE.sRGBEncoding)t.encoding=THREE.sRGBEncoding;return t;
}

/* ---------- player / rival car (full detail, separate moving parts) ---------- */
const MATS={};
function mats(paint){
  const THREE=T();
  const pc=new THREE.Color(paint).convertSRGBToLinear();
  // three r128 has no automatic colour management: convert sRGB colours to linear once
  const L=m=>{if(m.color&&!m.map&&!m.userData.lin){if(m!==undefined&&m.color!==pc)m.color.convertSRGBToLinear();if(m.emissive)m.emissive.convertSRGBToLinear();m.userData.lin=1}return m};
  return{
    paint:new THREE.MeshPhysicalMaterial({color:pc,metalness:.45,roughness:.3,clearcoat:1,clearcoatRoughness:.05,envMapIntensity:1.1}),
    glass:MATS.glass||(MATS.glass=L(new THREE.MeshPhysicalMaterial({color:0x0a1016,metalness:.3,roughness:.04,clearcoat:1,clearcoatRoughness:.02,envMapIntensity:1.4}))),
    dark:MATS.dark||(MATS.dark=L(new THREE.MeshStandardMaterial({color:0x101114,roughness:.6,metalness:.2}))),
    rubber:MATS.rubber||(MATS.rubber=L(new THREE.MeshStandardMaterial({color:0x161616,roughness:.92}))),
    metal:MATS.metal||(MATS.metal=L(new THREE.MeshStandardMaterial({color:0xd4d8de,metalness:1,roughness:.22}))),
    accent:MATS.accent||(MATS.accent=L(new THREE.MeshStandardMaterial({color:0xff2d3a,roughness:.4}))),
    lightF:L(new THREE.MeshStandardMaterial({color:0xffffff,emissive:0xfff3dc,emissiveIntensity:1.4,roughness:.2})),
    lightR:L(new THREE.MeshStandardMaterial({color:0x7a0010,emissive:0xff1428,emissiveIntensity:1.1,roughness:.3})),
    flame:L(new THREE.MeshBasicMaterial({color:0x66d9ff,transparent:true,opacity:.85,blending:THREE.AdditiveBlending,depthWrite:false}))
  };
}
function player(style,paint,plate){
  const THREE=T(),S=SHAPES[style]||SHAPES.gt,M=mats(paint),W=S.wheel;
  const root=new THREE.Group(),bodyG=new THREE.Group();root.add(bodyG);
  const bg=body(S,{ds:.08});
  const shell=new THREE.Mesh(bg,[M.paint,M.glass,M.dark]);bodyG.add(shell);
  const zf=bg.userData.zf,zb=bg.userData.zb;
  const parts={paint:[],dark:[],metal:[],lightF:[],lightR:[]};
  const add=P=>{for(const k in P)if(P[k].length)(parts[k]=parts[k]||[]).push(...P[k])};
  add(frontParts(S,zf));add(rearParts(S,zb));
  // mirrors
  const mz=W.f-.6,ms=sectAt(S,mz);[-1,1].forEach(sd=>{const x=sd*(ms.w*.96+.07);parts.paint.push(box(.09,.09,.19,x,ms.yh+.07,mz));parts.dark.push(box(.08,.035,.05,sd*(ms.w*.96),ms.yh+.03,mz+.04))});
  // door handles + side skirt line
  const hz=[(W.f+W.b)/2+.35,(W.f+W.b)/2-.55];hz.forEach(z=>{const s=sectAt(S,z);[-1,1].forEach(sd=>parts.metal.push(box(.02,.035,.16,sd*(s.w+.005),s.yh-.08,z)))});
  // exhausts
  (S.exhaust||[]).forEach(([x,y])=>parts.metal.push(cyl(.045,.05,.16,12,x,y,zb+.02,'z')));
  // spoiler / roof rails / bull bar
  if(S.spoiler===1){const s=sectAt(S,zb+.25);parts.dark.push(box(s.w*1.56,.035,.26,0,s.yr+.13,zb+.2,.06));[-1,1].forEach(sd=>{parts.dark.push(box(.04,.13,.1,sd*s.w*.55,s.yr+.06,zb+.22));parts.dark.push(box(.02,.12,.28,sd*s.w*.78,s.yr+.13,zb+.2))})}
  if(S.spoiler===2){const s=sectAt(S,zb+.32);parts.paint.push(box(s.wr*2,.04,.3,0,s.yr+.01,zb+.36,-.12))}
  if(S.rails){const a=sectAt(S,.6),b=sectAt(S,-1.6);[-1,1].forEach(sd=>{parts.dark.push(box(.04,.05,2.4,sd*a.wr*.78,a.yr+.07,-.5));[.55,-1.55].forEach(z=>parts.dark.push(box(.05,.07,.06,sd*a.wr*.78,a.yr+.03,z)))})}
  if(S.guard){const s=sectAt(S,zf);parts.metal.push(box(s.w*1.2,.06,.08,0,s.yb+.05,zf+.06))}
  // plates
  const pt=plateTex(plate||'SLIP 01'),pm=new THREE.MeshStandardMaterial({map:pt,roughness:.5});
  const sb=sectAt(S,zb+.02),sf=sectAt(S,zf-.02);
  const rp=new THREE.Mesh(new THREE.PlaneGeometry(.52,.13),pm);rp.position.set(0,sb.yb+(sb.yh-sb.yb)*.38,zb-.03);rp.rotation.y=Math.PI;bodyG.add(rp);
  const fp=new THREE.Mesh(new THREE.PlaneGeometry(.52,.13),pm);fp.position.set(0,sf.yb+.17,zf+.035);bodyG.add(fp);
  // merged static parts
  const lightF=new THREE.Mesh(merge(parts.lightF),M.lightF),lightR=new THREE.Mesh(merge(parts.lightR),M.lightR);
  bodyG.add(new THREE.Mesh(merge(parts.paint),M.paint),new THREE.Mesh(merge(parts.dark),M.dark),new THREE.Mesh(merge(parts.metal),M.metal),lightF,lightR);
  // wheel wells (dark inner walls so you can't see through the arches)
  const wells=[];[W.f,W.b].forEach(z=>[-1,1].forEach(sd=>{const s=sectAt(S,z);wells.push(box(.04,W.r*1.3,W.r*2.3,sd*(s.ws-W.tw-.02),W.r+.18,z))}));
  bodyG.add(new THREE.Mesh(merge(wells),M.dark));
  // wheels: steer group > spin group
  const tyre=tyreGeo(W.r,W.tw),wheels=[];
  [[W.f,1],[W.b,0]].forEach(([z,front])=>[-1,1].forEach(sd=>{
    const s=sectAt(S,z),steer=new THREE.Group(),spin=new THREE.Group();steer.position.set(sd*(s.ws-W.tw/2+.03),W.r,z);steer.add(spin);
    const rp_=rimParts(W.r,W.tw,W.rim);const flip=g=>{if(sd<0)g.rotateY(Math.PI);return g};
    spin.add(new THREE.Mesh(tyre,M.rubber));
    if(rp_.metal.length)spin.add(new THREE.Mesh(flip(merge(rp_.metal)),M.metal));
    if(rp_.dark.length)spin.add(new THREE.Mesh(flip(merge(rp_.dark)),M.dark));
    if(rp_.accent.length)steer.add(new THREE.Mesh(flip(merge(rp_.accent)),M.accent));
    root.add(steer);wheels.push({steer,spin,front,r:W.r});
  }));
  // nitro flames
  const flames=new THREE.Group();(S.exhaust||[[0,.36]]).forEach(([x,y])=>{const f=new THREE.Mesh(new THREE.ConeGeometry(.07,.55,10,1,true),M.flame);f.rotation.x=-Math.PI/2;f.position.set(x,y,zb-.3);flames.add(f)});
  flames.visible=false;bodyG.add(flames);
  root.traverse(o=>{if(o.isMesh){o.castShadow=false;o.receiveShadow=false}});
  return{root,body:bodyG,wheels,len:S.len,
    setBrake(b){M.lightR.emissiveIntensity=b?3.6:1.1},
    setNight(n){M.lightF.emissiveIntensity=n?3:1.4},
    setBoost(on,t){flames.visible=on;if(on)flames.children.forEach((f,i)=>{const s=.75+.45*Math.sin(t*47+i*2)+Math.random()*.25;f.scale.set(1,s,1);f.position.z=zb-.12-.27*s})},
    paint:M.paint,dispose(){root.traverse(o=>{if(o.geometry)o.geometry.dispose()});pt.dispose();Object.values(M).forEach(m=>{if(!Object.values(MATS).includes(m))m.dispose()})}};
}

/* ---------- traffic: one set of geometries per type, split by material (for instancing) ---------- */
const TRAFFIC={};
function traffic(type){
  if(TRAFFIC[type])return TRAFFIC[type];
  const out={paint:[],glass:[],dark:[],rubber:[],metal:[],lightF:[],lightR:[],white:[]};
  const addBody=(S,dz=0,o={})=>{
    const g=body(S,{ds:o.ds||.16,capMat:o.capMat});if(dz)g.translate(0,0,dz);
    ['paint','glass','dark'].forEach((k,m)=>{const q=groupGeo(g,m);if(q)out[k].push(q)});
    const P1=frontParts(S,g.userData.zf),P2=rearParts(S,g.userData.zb);
    [P1,P2].forEach(P=>{for(const k in P)P[k].forEach(q=>{if(dz)q.translate(0,0,dz);out[k].push(q)})});
    g.dispose();
  };
  const wheelsAt=(r,tw,axles,ws,rim,dual)=>{
    const ty=tyreGeo(r,tw);
    axles.forEach(z=>[-1,1].forEach(sd=>{
      const offs=dual?[0,-tw*1.05]:[0];
      offs.forEach((o,i)=>{const x=sd*(ws-tw/2+.03+o*1);const g=ty.clone();g.translate(x,r,z);out.rubber.push(g);
        if(i===0){const R_=rimParts(r,tw,rim);['metal','dark'].forEach(k=>R_[k].forEach(q=>{if(sd<0)q.rotateY(Math.PI);q.translate(x,r,z);out[k].push(q)}))}});
      out.dark.push(box(.04,r*1.3,r*2.3,sd*(ws-tw-(dual?tw:0)-.03),r+.2,z));
    }));ty.dispose();
  };
  let len;
  if(type==='truck'){
    // cab up front, a tall painted cargo box behind (Indian-highway style: bright paint, a bumper and mud flaps)
    const C=SHAPES.truckCab;len=9.8;
    addBody(C,len/2-1.2,{ds:.12});
    const cz=len/2-2.4-3.5;   // cargo box centre
    out.paint.push(box(2.5,2.7,7.0,0,2.25,cz));
    out.white.push(box(2.52,.12,7.02,0,3.55,cz));out.white.push(box(2.52,.12,7.02,0,1.0,cz));
    out.dark.push(box(2.3,.35,8.6,0,.75,len/2-4.6));             // chassis
    out.metal.push(box(2.4,.18,.12,0,.7,-len/2+.05));             // rear bumper
    [-1,1].forEach(sd=>{out.lightR.push(box(.2,.12,.05,sd*1.0,.95,-len/2-.01));out.dark.push(box(.5,.45,.02,sd*.85,.55,-len/2+.4))});
    wheelsAt(.52,.32,[len/2-1.25],1.22,'bus',0);wheelsAt(.52,.32,[-len/2+2.6,-len/2+1.5],1.22,'bus',1);
  }else{
    const S=SHAPES[{sedan:'sedan',hatch:'hatchT',suv:'suvT',van:'van',bus:'bus'}[type]];
    len=S.len;
    addBody(S,0,{ds:type==='bus'?.2:.16});
    if(S.rails){const a=sectAt(S,.5);[-1,1].forEach(sd=>out.dark.push(box(.04,.05,2.3,sd*a.wr*.78,a.yr+.06,-.5)))}
    if(S.stripe){out.white.push(box(2.56,.16,10.6,0,1.32,-.1));out.dark.push(box(2.0,.3,.6,0,3.2,-2))}  // stripe + roof AC unit
    const ms=sectAt(S,S.wheel.f-.5);[-1,1].forEach(sd=>out.dark.push(box(.08,.12,.18,sd*(ms.w+.06),ms.yh+.1,S.wheel.f-.65)));
    const W=S.wheel,ws=interp(S.k,2,W.f);
    wheelsAt(W.r,W.tw,[W.f,W.b],ws,W.rim,W.dual);
  }
  const res={len,geo:{}};
  for(const k in out){const m=merge(out[k]);if(m)res.geo[k]=m}
  return TRAFFIC[type]=res;
}

// silhouette for the menu cards (SVG, no 3D needed): a side view traced from the same key sections,
// with the wheel arches cut out and the windows split by their pillars
function svg(style,col){
  const S=SHAPES[style],K=S.k,W=S.wheel,z0=K[0][0],z1=K[K.length-1][0],sc=150/S.len,base=56;
  const X=z=>(10+(z0-z)*sc).toFixed(1),H=y=>(base-y*sc*.95).toFixed(1),g=(j,z)=>interp(K,j,z),R=W.r+.075;
  const arch=z=>{let y=-1;for(const a of[W.f,W.b]){const d=z-a;if(Math.abs(d)<R)y=Math.max(y,W.r+Math.sqrt(R*R-d*d))}return y};
  const zs=[];for(let i=0;i<=80;i++)zs.push(z0+(z1-z0)*i/80);
  const top=zs.map(z=>X(z)+' '+H(g(5,z))),bot=[...zs].reverse().map(z=>X(z)+' '+H(Math.min(Math.max(g(3,z),arch(z)),g(4,z)-.05)));
  let win='',run=[];const flush=()=>{if(run.length>2){const a=run.map(z=>X(z)+' '+H(g(5,z)-(g(5,z)-g(4,z))*.14)),b=[...run].reverse().map(z=>X(z)+' '+H(g(4,z)+(g(5,z)-g(4,z))*.16));win+=`<path d="M${a.join('L')}L${b.join('L')}Z" fill="#1d2735" stroke="#14111f" stroke-width="1.4" stroke-linejoin="round"/>`}run=[]};
  zs.forEach(z=>{const sg=segAt(K,z);if(['w','c','r'].includes(sg)&&g(5,z)-g(4,z)>.18)run.push(z);else flush()});flush();
  const wh=z=>`<circle cx="${X(z)}" cy="${H(W.r)}" r="${(W.r*sc*.95).toFixed(1)}" fill="#18171c" stroke="#14111f" stroke-width="2.2"/><circle cx="${X(z)}" cy="${H(W.r)}" r="${(W.r*sc*.55).toFixed(1)}" fill="#c9ced6" stroke="#14111f" stroke-width="1.5"/><circle cx="${X(z)}" cy="${H(W.r)}" r="${(W.r*sc*.16).toFixed(1)}" fill="#14111f"/>`;
  return `<svg viewBox="0 0 170 62" class="ss-sil" aria-hidden="true"><ellipse cx="85" cy="57" rx="76" ry="3.5" fill="#000" opacity=".18"/>${[W.f,W.b].map(z=>`<circle cx="${X(z)}" cy="${H(W.r)}" r="${(R*sc*.95).toFixed(1)}" fill="#14111f"/>`).join('')}<path d="M${top.join('L')}L${bot.join('L')}Z" fill="${col}" stroke="#14111f" stroke-width="2.4" stroke-linejoin="round"/>${win}${wh(W.f)}${wh(W.b)}</svg>`;
}

root.SSCars={SHAPES,player,traffic,svg,body,sectAt};
})(typeof window!=='undefined'?window:globalThis);
