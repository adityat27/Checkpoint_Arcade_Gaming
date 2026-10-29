/* =========================================================================
   DEADWEIGHT — a co-op climb for two, roped together.
   Needs games/deadweight-core.js (physics + course) loaded first.

   Structure (one file per arcade game, split into classes):
     DWNet     online sync: my climber streams 30x/s, the partner is predicted
               forward by the network delay; shared events (checkpoints,
               crumbling slabs, respawns, win) are decided by the room host.
     DWWorld   everything you see: low-poly mountain, climbers, rope, sky, effects.
     DWHud     timer, route bar, tips, touch controls.
     Deadweight  the game: init(mode) -> startLoop() -> destroy().
   Solo: you control both climbers and swap between them. The one you're not
   controlling braces when you're in the air, and follows you on solid ground.
   ========================================================================= */
(()=>{
const {CFG,COURSE,Physics}=window.DWCore;
const K='#14111f',COL=['#ff6b3d','#2ec4b6'],NAME_DEF=['Rook','Kestrel'];
const lerp=(a,b,t)=>a+(b-a)*t,clamp=(v,a,b)=>v<a?a:v>b?b:v,hash=(x,y,z)=>{const s=Math.sin(x*127.1+y*311.7+z*74.7)*43758.5453;return s-Math.floor(s)};
const col3=c=>new THREE.Color(c).convertSRGBToLinear();
const nowMs=()=>performance.now();

/* ======================= networking ======================= */
class DWNet{
  constructor(game){this.g=game;this.buf=null;this.lastSend=0;this.stepSent={};this.helloT=0}
  sendState(now,c){
    if(now-this.lastSend<33)return;this.lastSend=now;const q=v=>Math.round(v*1000)/1000;
    const fl=(c.grounded?1:0)|(c.brace?2:0)|(c.hang?4:0)|(c.mantle?8:0)|(c.climbing?16:0);
    NET.sendFast({f:1,g:this.g.gen,t:Math.round(now*10)/10,s:[q(c.x),q(c.y),q(c.z),q(c.vx),q(c.vy),q(c.vz),q(c.yaw),fl,q(c.reel)]});
  }
  onFast(d){
    if(!Array.isArray(d.s)||d.s.length<9)return;const t=+d.t;if(this.buf&&t<=this.buf.t)return;
    const s=d.s.map(Number);if(this.buf&&Math.hypot(s[0]-this.buf.x,s[1]-this.buf.y,s[2]-this.buf.z)>3)this.g.P.ropeGrace=.5;this.buf={t,x:s[0],y:s[1],z:s[2],vx:s[3],vy:s[4],vz:s[5],yaw:s[6],fl:s[7],reel:s[8],at:nowMs()};
  }
  // partner predicted to "now": last known position moved forward by its velocity over the delay
  partner(now){
    const b=this.buf;if(!b)return null;
    let age=NET.clk!=null?now-(b.t-NET.clk):(now-b.at)+NET.rtt/2;age=clamp(age/1000,0,.15);
    const fl=b.fl,g=fl&1?0:CFG.g;
    return{x:b.x+b.vx*age,y:Math.max(b.y-30,b.y+b.vy*age-.5*g*age*age),z:b.z+b.vz*age,vx:b.vx,vy:b.vy-g*age,vz:b.vz,yaw:b.yaw,grounded:!!(fl&1),brace:!!(fl&2),hang:!!(fl&4),mantle:!!(fl&8),climbing:!!(fl&16),reel:b.reel,stale:now-b.at>1500};
  }
  ev(o){o.g=this.g.gen;NET.ev(o)}
}

/* ======================= the world you see ======================= */
class DWWorld{
  constructor(canvas){
    const T=THREE;this.T=T;
    const r=this.r=new T.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});
    r.outputEncoding=T.sRGBEncoding;r.toneMapping=T.ACESFilmicToneMapping;r.toneMappingExposure=1;
    r.shadowMap.enabled=true;r.shadowMap.type=T.PCFSoftShadowMap;
    this.cam=new T.PerspectiveCamera(50,1,.1,700);
    this.sc=new T.Scene();this.parts=[];this.crumble={};this.cps=[];this.mc={};
    this.camYaw=0;this.camPitch=.33;this.camDist=13;this.camT=null;this.shake=0;
    this.build();
  }
  m(c,o){const k=c+JSON.stringify(o||{});return this.mc[k]||(this.mc[k]=new THREE.MeshStandardMaterial(Object.assign({color:col3(c),roughness:.85},o||{})))}
  mesh(geo,mat,sx,sy,sz,x,y,z,cast=true){const M=new THREE.Mesh(geo,typeof mat==='string'?this.m(mat):mat);M.scale.set(sx,sy,sz);M.position.set(x||0,y||0,z||0);M.castShadow=cast;M.receiveShadow=true;return M}
  build(){
    const T=this.T,sc=this.sc;
    this.G={box:new T.BoxGeometry(1,1,1),sph:new T.SphereGeometry(1,16,12),half:new T.SphereGeometry(1,16,8,0,Math.PI*2,0,Math.PI/2),cyl:new T.CylinderGeometry(1,1,1,12),cone:new T.ConeGeometry(1,1,7),ico:new T.IcosahedronGeometry(1,0)};
    // sky dome: deep blue overhead, violet, rose, a warm glow on the horizon
    const sky=new T.SphereGeometry(500,32,20),cols=[],cTop=col3('#141a52'),cMid=col3('#5d47a0'),cLow=col3('#e9879f'),cHor=col3('#ffc690');
    for(let i=0;i<sky.attributes.position.count;i++){const y=sky.attributes.position.getY(i)/500;
      const c=y>.32?cMid.clone().lerp(cTop,clamp((y-.32)/.6,0,1)):y>.06?cLow.clone().lerp(cMid,(y-.06)/.26):cHor.clone().lerp(cLow,clamp((y+.06)/.12,0,1));cols.push(c.r,c.g,c.b)}
    sky.setAttribute('color',new T.Float32BufferAttribute(cols,3));
    sc.add(new T.Mesh(sky,new T.MeshBasicMaterial({vertexColors:true,side:T.BackSide,fog:false,toneMapped:false,depthWrite:false})));
    sc.fog=new T.Fog(col3('#f0ad9c'),70,430);
    // stars, only high up where the sky is dark
    {const n=260,pos=[];for(let i=0;i<n;i++){const a=hash(i,1,7)*Math.PI*2,y=.42+hash(i,2,7)*.55,r=Math.sqrt(1-y*y);pos.push(Math.cos(a)*r*470,y*470,Math.sin(a)*r*470)}
     const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));
     sc.add(new T.Points(g,new T.PointsMaterial({color:0xffffff,size:2,sizeAttenuation:false,transparent:true,opacity:.75,fog:false,depthWrite:false})))}
    // warm key light + cool sky fill + a soft rim from behind
    sc.add(new T.HemisphereLight(col3('#c6cfff'),col3('#6b4a5a'),.7));
    const sun=this.sun=new T.DirectionalLight(col3('#ffd6a6'),1.35);sun.castShadow=true;
    Object.assign(sun.shadow.camera,{left:-22,right:22,top:22,bottom:-22,near:1,far:90});sun.shadow.mapSize.set(TOUCH_UI?1024:2048,TOUCH_UI?1024:2048);sun.shadow.bias=-.0008;sun.shadow.normalBias=.02;
    sc.add(sun,sun.target);
    const rim=new T.DirectionalLight(col3('#9fb4ff'),.35);rim.position.set(30,20,-40);sc.add(rim);
    // a big low sun with a soft glow on the horizon
    const disc=new T.Mesh(new T.CircleGeometry(26,40),new T.MeshBasicMaterial({color:col3('#fff0c4'),fog:false,toneMapped:false}));disc.position.set(140,38,-420);disc.lookAt(0,0,0);sc.add(disc);
    const glow=new T.Sprite(new T.SpriteMaterial({map:canvasTex(128,128,(c,w,h)=>{const g=c.createRadialGradient(64,64,0,64,64,64);g.addColorStop(0,'rgba(255,226,170,.9)');g.addColorStop(.35,'rgba(255,180,140,.35)');g.addColorStop(1,'rgba(255,150,140,0)');c.fillStyle=g;c.fillRect(0,0,w,h)}),fog:false,transparent:true,depthWrite:false,blending:T.AdditiveBlending,toneMapped:false}));
    glow.scale.set(190,190,1);glow.position.set(139,38,-418);sc.add(glow);
    this.buildMountain();this.buildBackdrop();this.buildDecor();this.buildProps();this.buildClimbers();this.buildRope();this.buildSnow();
  }
  /* the climbing route: every rock box becomes a jagged, low-poly pillar, all merged into one mesh */
  rockGeo(b,seed){
    const T=this.T,w=b[3]-b[0],h=b[4]-b[1],d=b[5]-b[2];
    const g=new T.BoxGeometry(w,h,d,Math.max(1,Math.round(w/1.4)),Math.max(1,Math.round(h/1.6)),Math.max(1,Math.round(d/1.4))).toNonIndexed();
    const P=g.attributes.position,cx=(b[0]+b[3])/2,cy=(b[1]+b[4])/2,cz=(b[2]+b[5])/2,top=b[4],cols=[];
    const alt=top,topCol=alt>11?'#eef3ff':alt>6.5?'#97c25c':'#77c652',sideA=alt>11?'#8790a8':'#97684c',sideB=alt>11?'#a2a9c0':'#b0805f',sideC=alt>11?'#6f7690':'#7d543c';
    for(let i=0;i<P.count;i++){
      let x=P.getX(i)+cx,y=P.getY(i)+cy,z=P.getZ(i)+cz;const onTop=y>top-.01;
      if(!onTop){const k=.18+.22*clamp((top-y)/6,0,1),hx=hash(Math.round(x*7),Math.round(y*7),Math.round(z*7));
        const atX=Math.abs(x-b[0])<.01||Math.abs(x-b[3])<.01,atZ=Math.abs(z-b[2])<.01||Math.abs(z-b[5])<.01;
        // jag the rock inward so climbers hanging on a wall are never hidden inside it
        if(atX)x+=(x<cx?-1:1)*(hx-.8)*k;if(atZ)z+=(z<cz?-1:1)*(hash(Math.round(z*7),Math.round(x*7),Math.round(y*7))-.8)*k;
        if(y<top-.4)y+=(hash(Math.round(y*7),Math.round(z*7),Math.round(x*7))-.5)*.25}
      P.setXYZ(i,x,y,z);
    }
    for(let f=0;f<P.count;f+=3){
      const ys=[P.getY(f),P.getY(f+1),P.getY(f+2)],flat=ys.every(y=>y>top-.01);
      let c;if(flat)c=col3(topCol).multiplyScalar(.9+hash(P.getX(f),P.getZ(f),seed)*.2);
      else{const my=(ys[0]+ys[1]+ys[2])/3,dark=clamp((top-my)/18,0,.7),band=Math.floor((my+40)/1.15)%3;   // horizontal rock strata
        c=col3(band===0?sideA:band===1?sideB:sideC).multiplyScalar((1-dark*.6)*(.92+hash(P.getX(f),my,P.getZ(f))*.16));
        if(top-my<.32)c=col3(topCol).multiplyScalar(alt>11?.88:.7)}
      for(let k=0;k<3;k++)cols.push(c.r,c.g,c.b)}
    g.setAttribute('color',new T.Float32BufferAttribute(cols,3));g.computeVertexNormals();return g;
  }
  buildMountain(){
    const T=this.T,geos=[];
    COURSE.boxes.forEach((b,i)=>{if(b.kind==='c')return;geos.push(this.rockGeo(b,i))});
    const merged=mergeGeos(geos);const M=new T.Mesh(merged,new T.MeshStandardMaterial({vertexColors:true,flatShading:true,roughness:.95}));M.castShadow=M.receiveShadow=true;this.sc.add(M);
    // crumbling slabs: their own meshes so they can shake and fall
    COURSE.boxes.forEach((b,i)=>{if(b.kind!=='c')return;const geo=this.rockGeo(b,i);const pos=geo.attributes.position,cx=(b[0]+b[3])/2,cy=(b[1]+b[4])/2,cz=(b[2]+b[5])/2;
      for(let k=0;k<pos.count;k++)pos.setXYZ(k,pos.getX(k)-cx,pos.getY(k)-cy,pos.getZ(k)-cz);
      const cl=geo.attributes.color;for(let k=0;k<cl.count;k++){cl.setXYZ(k,cl.getX(k)*.85+.12,cl.getY(k)*.75+.08,cl.getZ(k)*.7+.05)}
      const g=new T.Group();const M2=new T.Mesh(geo,new T.MeshStandardMaterial({vertexColors:true,flatShading:true,roughness:.95}));M2.castShadow=M2.receiveShadow=true;g.add(M2);
      // cracks on top
      for(let k=0;k<3;k++){const cr=this.mesh(this.G.box,'#3a2a22',(b[3]-b[0])*.5,.02,.05,(hash(i,k,1)-.5)*1.2,(b[4]-b[1])/2+.01,(hash(i,k,2)-.5)*1.6,false);cr.rotation.y=hash(i,k,3)*3;g.add(cr)}
      g.position.set(cx,cy,cz);this.sc.add(g);this.crumble[i]={g,base:{x:cx,y:cy,z:cz},st:'idle'}});
  }
  buildBackdrop(){
    const T=this.T,geos=[];
    // three ranges, lighter with distance, snow on the upper slopes
    const L=[{n:16,z:[-360,-290],h:[45,74],col:'#a593cf',sn:'#f4efff',snow:.55},{n:13,z:[-230,-180],h:[32,54],col:'#7c66ab',sn:'#efeaff',snow:.62},{n:11,z:[-140,-110],h:[18,34],col:'#5a4a85',sn:'#e8e4fa',snow:.7}];
    L.forEach((l,li)=>{for(let i=0;i<l.n;i++){
      const x=-160+(i+hash(i,li,2)*.8)/l.n*440,z=lerp(l.z[0],l.z[1],hash(i,li,3)),h=lerp(l.h[0],l.h[1],hash(i,li,4)),r=h*(.75+hash(i,li,5)*.35),base=-30;
      const g=new T.ConeGeometry(r,h,5+Math.floor(hash(i,li,6)*3),4).toNonIndexed();g.translate(x,base+h/2,z);
      const P=g.attributes.position,cols=[];
      for(let k=0;k<P.count;k++){const y=P.getY(k);if(y<base+h-.01){const j=(1-(y-base)/h)*r*.12;P.setX(k,P.getX(k)+(hash(Math.round(P.getX(k)),Math.round(y),li)-.5)*j);P.setZ(k,P.getZ(k)+(hash(Math.round(y),Math.round(P.getZ(k)),li)-.5)*j)}}
      for(let f=0;f<P.count;f+=3){const my=(P.getY(f)+P.getY(f+1)+P.getY(f+2))/3,sn=my>base+h*(l.snow+(hash(f,i,li)-.5)*.12);
        const c=col3(sn?l.sn:l.col).multiplyScalar(.82+hash(f,i,3)*.3);for(let k=0;k<3;k++)cols.push(c.r,c.g,c.b)}
      g.setAttribute('color',new T.Float32BufferAttribute(cols,3));g.deleteAttribute('uv');g.computeVertexNormals();geos.push(g)}});
    const M=new T.Mesh(mergeGeos(geos),new T.MeshStandardMaterial({vertexColors:true,flatShading:true,roughness:1}));this.sc.add(M);
    // sea of clouds below the route
    const cloudMat=new T.MeshStandardMaterial({color:col3('#ffe9ee'),roughness:1,transparent:true,opacity:.95,flatShading:true,emissive:col3('#ff9fb0'),emissiveIntensity:.12});
    const cgeos=[];for(let i=0;i<80;i++){const g=new T.IcosahedronGeometry(3+hash(i,9,9)*5,1).toNonIndexed();g.scale(1.6,.55,1.2);g.translate(-30+hash(i,1,9)*180,-11+hash(i,2,9)*3,-34+hash(i,3,9)*50);cgeos.push(g)}
    const cl=new T.Mesh(mergeGeos(cgeos.map(g=>{g.deleteAttribute('uv');return g})),cloudMat);this.sc.add(cl);this.clouds=cl;
    // puffy clouds drifting in the sky
    const sk=[];for(let i=0;i<9;i++){const cx=-120+i*45+hash(i,4,4)*30,cy=26+hash(i,5,5)*30,cz=-150-hash(i,6,6)*90;
      for(let k=0;k<5;k++){const r=5+hash(i,k,7)*6,g=new T.IcosahedronGeometry(r,1).toNonIndexed();g.scale(1.5,.8,1);g.translate(cx+(k-2)*r*1.1,cy+hash(k,i,8)*4,cz+hash(k,i,9)*6);g.deleteAttribute('uv');sk.push(g)}}
    this.skyClouds=new T.Mesh(mergeGeos(sk),new T.MeshStandardMaterial({color:col3('#fff4f2'),roughness:1,flatShading:true,emissive:col3('#ffb4a8'),emissiveIntensity:.35,fog:false}));this.sc.add(this.skyClouds);
    const floor=new T.Mesh(new T.PlaneGeometry(900,900),new T.MeshBasicMaterial({color:col3('#f0b4a6'),fog:true}));floor.rotation.x=-Math.PI/2;floor.position.y=-12;this.sc.add(floor);
  }
  /* scenery on the ledges: pines, boulders, grass, flowers, snow, base-camp tents. Visual only, merged into one mesh. */
  buildDecor(){
    const T=this.T,geos=[],add=(g,c,x,y,z,ry=0)=>{g=g.toNonIndexed();if(g.attributes.uv)g.deleteAttribute('uv');if(ry)g.rotateY(ry);g.translate(x,y,z);const col=col3(c),n=g.attributes.position.count,a=new Float32Array(n*3);
      for(let f=0;f<n;f+=3){const k=.88+hash(x+f,y,z)*.22;for(let q=0;q<3;q++){a[(f+q)*3]=col.r*k;a[(f+q)*3+1]=col.g*k;a[(f+q)*3+2]=col.b*k}}g.setAttribute('color',new T.BufferAttribute(a,3));geos.push(g)};
    const busy=(x,z)=>COURSE.cps.some(c=>Math.abs(x-c.x)<2.6&&z<-.6)||COURSE.signs.some(s=>Math.abs(x-s.x)<1.6)||Math.hypot(x-COURSE.summit.x,z-COURSE.summit.z)<2.2;
    const pine=(x,y,z,h,snowy)=>{add(new T.CylinderGeometry(.09,.13,h*.3,6),'#5a3a26',x,y+h*.15,z);
      [[.42,.5,.18],[.33,.42,.42],[.22,.32,.64]].forEach(([r,hh,o],k)=>add(new T.ConeGeometry(r*h,hh*h,7),snowy&&k===2?'#eef3ff':k%2?'#2f7d4f':'#3a9159',x,y+h*o+hh*h*.3,z,k))};
    COURSE.boxes.forEach((b,i)=>{if(b.kind==='c')return;const top=b[4],w=b[3]-b[0],d=b[5]-b[2],snowy=top>11;
      // pines along the back edge of wide ledges
      if(d>=5&&w>=3)for(let x=b[0]+1+hash(i,1,1)*1.5;x<b[3]-.9;x+=2.6+hash(i,x,2)*2.2){const z=b[2]+.45+hash(i,x,3)*.5;if(busy(x,z))continue;pine(x,top,z,1.7+hash(i,x,4)*1.3,snowy)}
      // boulders and grass tufts / snow lumps
      for(let k=0;k<Math.max(2,w*.9);k++){const x=b[0]+.3+hash(i,k,5)*(w-.6),z=b[2]+.25+hash(i,k,6)*Math.min(d-.5,1.2);if(busy(x,z))continue;
        if(k%3===0){const s_=.18+hash(i,k,7)*.28;const g=new T.IcosahedronGeometry(s_,0);g.scale(1.2,.7,1);add(g,snowy?'#a2a9c0':'#8f8794',x,top+s_*.3,z,k)}
        else if(snowy){const g=new T.SphereGeometry(.3+hash(i,k,8)*.3,7,4,0,Math.PI*2,0,Math.PI/2);g.scale(1.4,.45,1);add(g,'#ffffff',x,top-.02,z)}
        else for(let q=0;q<3;q++)add(new T.ConeGeometry(.05,.22+hash(i,k,q)*.12,4),top>6.5?'#7fae4a':'#5fb04a',x+(q-1)*.08,top+.1,z+(q%2)*.06)}
      // a few flowers on the lower, greener ledges
      if(!snowy&&top<7)for(let k=0;k<w*.6;k++){const x=b[0]+.3+hash(i,k,11)*(w-.6),z=b[2]+.3+hash(i,k,12)*(d-.6);if(busy(x,z)||(z>-1&&z<1))continue;
        add(new T.IcosahedronGeometry(.06,0),['#ffe14d','#ff7aa8','#ffffff','#b28cff'][k%4],x,top+.06,z)}
    });
    // base camp: two tents and a crate
    [[-6.2,-2.4,'#ff8a1f',.3],[-2.6,-2.9,'#2ec4b6',-.25]].forEach(([x,z,c,ry])=>{const g=new T.CylinderGeometry(.95,.95,2,3,1);g.rotateZ(Math.PI/2);g.rotateX(Math.PI/6);g.scale(1,1,1.1);add(g,c,x,.47,z,ry);
      const door=new T.PlaneGeometry(.5,.55);add(door,'#3a2a22',x+Math.sin(ry)*.01,.32,z+.03,ry)});
    add(new T.BoxGeometry(.6,.45,.6),'#b97a44',-4.4,.22,-3.2,.4);
    const M=new T.Mesh(mergeGeos(geos),new T.MeshStandardMaterial({vertexColors:true,flatShading:true,roughness:.9}));M.castShadow=true;M.receiveShadow=true;this.sc.add(M);
  }
  buildProps(){
    const T=this.T,sc=this.sc;
    COURSE.cps.forEach((cp,i)=>{
      const g=new T.Group();g.position.set(cp.x,cp.y,cp.z-2.2);
      g.add(this.mesh(this.G.cyl,'#5a3a26',.05,2.4,.05,0,1.2,0));
      const flag=this.mesh(new T.PlaneGeometry(1,.6,6,2),new T.MeshStandardMaterial({color:col3('#9aa0b5'),side:T.DoubleSide,roughness:.8}),1,1,1,.52,2.1,0);g.add(flag);
      // campfire: logs + flame
      const fire=new T.Group();fire.position.set(1.1,0,.4);
      [0,1,2].forEach(k=>{const l=this.mesh(this.G.cyl,'#6b4226',.07,.7,.07,0,.07,0);l.rotation.z=Math.PI/2;l.rotation.y=k*1.05;fire.add(l)});
      const fl=this.mesh(this.G.cone,new T.MeshBasicMaterial({color:col3('#ffb13d'),transparent:true,opacity:.95,toneMapped:false}),.2,.55,.2,0,.32,0,false);fire.add(fl);fl.visible=i===0;
      const light=new T.PointLight(col3('#ff9a3d'),i===0?1.2:0,6,2);light.position.y=.6;fire.add(light);
      g.add(fire);sc.add(g);this.cps.push({flag,fl,light,lit:i===0});
    });
    // summit: big flag + cairn
    const S=COURSE.summit,sg=new T.Group();sg.position.set(S.x,S.y,S.z);
    sg.add(this.mesh(this.G.cyl,'#e8e8f0',.07,4,.07,0,2,0));
    const tex=canvasTex(128,80,(c,w,h)=>{for(let y=0;y<4;y++)for(let x=0;x<6;x++){c.fillStyle=(x+y)%2?'#ffe14d':'#ff3e5a';c.fillRect(x*w/6,y*h/4,w/6,h/4)}});
    const big=this.mesh(new T.PlaneGeometry(1.8,1.1,8,3),new T.MeshStandardMaterial({map:tex,side:T.DoubleSide}),1,1,1,.92,3.4,0);sg.add(big);this.summitFlag=big;
    [[0,.2,.5],[.4,.35,.35],[-.3,.3,.4],[.1,.6,.3]].forEach(([x,y,s],k)=>sg.add(this.mesh(this.G.ico,'#8e95a8',s,s*.8,s,x+.6,y,k*.2+.4)));
    sc.add(sg);
    // signs
    COURSE.signs.forEach(s=>{const g=new T.Group();g.position.set(s.x,s.y,s.z);g.add(this.mesh(this.G.box,'#6b4226',.1,1.1,.1,0,.55,0));
      const tex=canvasTex(512,256,(c,w,h)=>{c.fillStyle='#d9a066';c.fillRect(0,0,w,h);c.strokeStyle='#6b4226';c.lineWidth=16;c.strokeRect(8,8,w-16,h-16);c.fillStyle='#2b1a10';c.textAlign='center';c.textBaseline='middle';
        const n=s.lines.length;s.lines.forEach((l,k)=>{c.font=(k===0&&n<3?'400 70px':'400 52px')+' Bangers,Impact,sans-serif';c.fillText(l,w/2,h/2+(k-(n-1)/2)*(n<3?78:66))})});
      const board=this.mesh(new T.BoxGeometry(2,1,.08),[this.m('#b97a44'),this.m('#b97a44'),this.m('#b97a44'),this.m('#b97a44'),new T.MeshStandardMaterial({map:tex}),this.m('#b97a44')],1,1,1,0,1.45,0);g.add(board);sc.add(g)});
  }
  climberRig(i){
    const T=this.T,root=new T.Group(),body=new T.Group(),c=COL[i];root.add(body);
    const jacket=this.m(c),dark=this.m(i?'#1d7f76':'#c4441f'),skin=this.m('#ffd2a6');
    const ink=this.inkMat||(this.inkMat=new T.MeshBasicMaterial({color:0x14111f,side:T.BackSide})),line=(m,k=1.1)=>{const o=new T.Mesh(m.geometry,ink);o.scale.setScalar(k);m.add(o);return m};
    const torso=line(this.mesh(this.G.sph,jacket,.3,.38,.26,0,1.02,0),1.09);body.add(torso);
    body.add(line(this.mesh(this.G.box,'#3a3f5c',.36,.42,.18,0,1.05,-.25),1.12));   // backpack
    body.add(this.mesh(new T.TorusGeometry(.12,.035,6,12),'#ffd23f',1,1,1,0,1.05,-.36));   // rope coil on the pack
    body.add(this.mesh(this.G.box,'#2b2147',.38,.08,.3,0,.8,0));        // harness belt
    const head=new T.Group();head.position.y=1.5;body.add(head);
    head.add(line(this.mesh(this.G.sph,skin,.21,.21,.21,0,0,0),1.1));
    head.add(this.mesh(this.G.half,dark,.225,.2,.225,0,.02,0));head.add(this.mesh(this.G.sph,'#ffffff',.08,.08,.08,0,.24,0));
    [-1,1].forEach(s=>head.add(this.mesh(this.G.sph,K,.03,.045,.02,s*.075,-.01,.19,false)));
    head.add(this.mesh(this.G.box,'#ffffff',.3,.05,.05,0,-.13,.15,false));  // scarf
    const limb=(x,y,len,mat)=>{const g=new T.Group();g.position.set(x,y,0);const m=line(this.mesh(this.G.cyl,mat,.075,len,.075,0,-len/2,0),1.25);g.add(m);
      g.add(mat===jacket?line(this.mesh(this.G.sph,dark,.1,.1,.1,0,-len,0),1.2):line(this.mesh(this.G.box,'#3a2a22',.17,.13,.24,0,-len+.02,.05),1.15));body.add(g);return g};   // gloves / boots
    const arms=[limb(-.33,1.28,.5,jacket),limb(.33,1.28,.5,jacket)],legs=[limb(-.13,.78,.68,this.m('#3a3f5c')),limb(.13,.78,.68,this.m('#3a3f5c'))];
    const tag=new T.Sprite(new T.SpriteMaterial({map:nameTex('',c),depthTest:false,transparent:true,toneMapped:false}));tag.scale.set(1.3,.36,1);tag.position.y=2.25;tag.renderOrder=9;root.add(tag);
    const ring=this.mesh(new T.TorusGeometry(.5,.05,6,24),new T.MeshBasicMaterial({color:col3('#ffe14d'),toneMapped:false,transparent:true,opacity:.9}),1,1,1,0,.04,0,false);ring.rotation.x=Math.PI/2;ring.visible=false;root.add(ring);
    this.sc.add(root);return{root,body,head,arms,legs,tag,ring,name:'',yaw:0,ph:0};
  }
  buildClimbers(){this.cl=[this.climberRig(0),this.climberRig(1)]}
  buildRope(){
    const T=this.T,n=18;this.ropeSeg=[];const a=new T.MeshStandardMaterial({color:col3('#ffd23f'),roughness:.6,emissive:col3('#ff3e5a'),emissiveIntensity:0}),b=new T.MeshStandardMaterial({color:col3('#ff3e5a'),roughness:.6,emissive:col3('#ff3e5a'),emissiveIntensity:0});
    this.ropeMats=[a,b];const g=new T.CylinderGeometry(1,1,1,6);
    for(let i=0;i<n-1;i++){const m=new T.Mesh(g,i%2?b:a);m.castShadow=true;this.sc.add(m);this.ropeSeg.push(m)}
  }
  buildSnow(){
    const T=this.T,n=TOUCH_UI?350:700,pos=new Float32Array(n*3);for(let i=0;i<n;i++){pos[i*3]=(Math.random()-.5)*60;pos[i*3+1]=Math.random()*30;pos[i*3+2]=(Math.random()-.5)*40}
    const g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(pos,3));
    this.snow=new T.Points(g,new T.PointsMaterial({color:0xffffff,size:.12,transparent:true,opacity:.8,depthWrite:false}));this.sc.add(this.snow);
  }
  puff(x,y,z,c,n=6,sp=1.5,life=.6,size=.12){for(let i=0;i<n;i++){const m=this.mesh(this.G.sph,new THREE.MeshBasicMaterial({color:col3(c),transparent:true,opacity:.75,depthWrite:false}),size,size,size,x,y,z,false);this.sc.add(m);
    this.parts.push({m,t:0,life:life*(.7+Math.random()*.6),vx:(Math.random()-.5)*sp,vy:Math.random()*sp*.6,vz:(Math.random()-.5)*sp,s:size})}}
  setTag(rig,name){if(rig.name===name)return;rig.name=name;rig.tag.material.map.dispose();rig.tag.material.map=nameTex(name,COL[this.cl.indexOf(rig)]);rig.tag.material.needsUpdate=true}
  resize(){const el=this.r.domElement.parentElement,w=el.clientWidth,h=el.clientHeight;if(!w||!h)return;this.r.setPixelRatio(Math.min(TOUCH_UI?1.6:2,devicePixelRatio||1));this.r.setSize(w,h,false);this.cam.aspect=w/h;this.cam.fov=w<h?62:50;this.cam.updateProjectionMatrix()}
  /* draw a frame. st = {cl:[climber states], rope, focus, active, names, dt, t, tension} */
  render(st){
    const T=this.T,dt=st.dt,t=st.t;
    // climbers
    st.cl.forEach((c,i)=>{const R=this.cl[i];if(!c)return;
      R.root.position.set(c.x,c.y,c.z);R.yaw+=angW(c.yaw-R.yaw)*Math.min(1,dt*12);R.root.rotation.y=R.yaw;
      const spd=Math.hypot(c.vx,c.vz),run=c.grounded&&!c.brace?clamp(spd/CFG.run,0,1):0;R.ph+=dt*(4+spd*2.6);
      const sw=Math.sin(R.ph)*.9*run,crouch=c.brace?1:0;R.cr=lerp(R.cr||0,crouch,Math.min(1,dt*12));
      R.body.position.y=-R.cr*.25+Math.abs(Math.sin(R.ph))*.05*run;R.body.rotation.x=R.cr*.25+run*.12;
      R.legs[0].rotation.x=sw;R.legs[1].rotation.x=-sw;R.legs[0].rotation.z=R.cr*.35;R.legs[1].rotation.z=-R.cr*.35;
      if(!c.grounded&&!c.hang){R.legs[0].rotation.x=-.5;R.legs[1].rotation.x=.3}
      if(c.hang||c.climbing){const k=c.climbing?Math.sin(t*10)*.4:0;R.arms[0].rotation.set(Math.PI*.95+k,0,.2);R.arms[1].rotation.set(Math.PI*.95-k,0,-.2);R.legs[0].rotation.x=.3+k*.5;R.legs[1].rotation.x=-.2-k*.5}
      else if(c.brace){R.arms[0].rotation.set(-.9,0,.5);R.arms[1].rotation.set(-.9,0,-.5)}
      else if(c.mantle){R.arms[0].rotation.set(Math.PI*.8,0,.1);R.arms[1].rotation.set(Math.PI*.8,0,-.1)}
      else{R.arms[0].rotation.set(-sw*.8,0,.12);R.arms[1].rotation.set(sw*.8,0,-.12)}
      R.ring.visible=!!c.brace;if(c.brace)R.ring.scale.setScalar(1+Math.sin(t*8)*.08);
      this.setTag(R,st.names[i]);R.tag.material.opacity=st.active===i||st.active==null?1:.55;
    });
    // rope
    const P=st.rope.p,seg=this.ropeSeg,v=new T.Vector3(),up=new T.Vector3(0,1,0);
    for(let i=0;i<seg.length;i++){const a=P[i],b=P[i+1];v.set(b.x-a.x,b.y-a.y,b.z-a.z);const L=v.length()||.001;seg[i].position.set((a.x+b.x)/2,(a.y+b.y)/2,(a.z+b.z)/2);seg[i].scale.set(.045,L+.02,.045);seg[i].quaternion.setFromUnitVectors(up,v.multiplyScalar(1/L))}
    const glow=clamp(st.tension*2,0,1);this.ropeMats.forEach(m=>m.emissiveIntensity=glow*.8);
    // camera: follows the climber you control, keeps your partner in view
    const f=st.focus,o=st.other,cam=this.cam;
    const mid={x:lerp(f.x,o.x,.35)+(cam.aspect<1?.7:2.2),   // look a little ahead up the route
      y:lerp(f.y,o.y,.3)+1.3,z:lerp(f.z,o.z,.35)};
    const sep=Math.hypot(f.x-o.x,f.y-o.y,f.z-o.z),dist=this.camDist+clamp(sep-4,0,8)*.55;
    if(!this.camT)this.camT={...mid};const k=Math.min(1,dt*4);this.camT.x=lerp(this.camT.x,mid.x,k);this.camT.y=lerp(this.camT.y,mid.y,k);this.camT.z=lerp(this.camT.z,mid.z,k);
    const cy=Math.cos(this.camYaw),sy=Math.sin(this.camYaw),cp=Math.cos(this.camPitch),sp=Math.sin(this.camPitch);
    let sx=0,sy2=0;if(this.shake>0){sx=(Math.random()-.5)*this.shake;sy2=(Math.random()-.5)*this.shake;this.shake=Math.max(0,this.shake-dt*2)}
    cam.position.set(this.camT.x+sy*cp*dist+sx,this.camT.y+sp*dist+sy2,this.camT.z+cy*cp*dist);cam.lookAt(this.camT.x,this.camT.y,this.camT.z);
    // sun + shadows follow the action
    this.sun.position.set(this.camT.x-18,this.camT.y+30,this.camT.z+16);this.sun.target.position.set(this.camT.x,this.camT.y-2,this.camT.z);
    // checkpoint fires, flags, summit flag
    this.cps.forEach((c,i)=>{c.fl.visible=c.lit;if(c.flag.material.userData.lit!==c.lit){c.flag.material.userData.lit=c.lit;c.flag.material.color.copy(col3(c.lit?'#ff8a1f':'#9aa0b5'))}if(c.lit){c.fl.scale.set(.2+Math.sin(t*17+i)*.03,.55+Math.sin(t*23+i)*.12,.2);c.light.intensity=1.1+Math.sin(t*19+i)*.25}
      const pa=c.flag.geometry.attributes.position;for(let k=0;k<pa.count;k++){const x=pa.getX(k)+.5;pa.setZ(k,Math.sin(t*5+x*4+i)*.08*x)}pa.needsUpdate=true});
    {const pa=this.summitFlag.geometry.attributes.position;for(let k=0;k<pa.count;k++){const x=pa.getX(k)+.9;pa.setZ(k,Math.sin(t*4+x*3)*.12*x)}pa.needsUpdate=true}
    // crumbling slabs
    for(const id in this.crumble){const cr=this.crumble[id],s=st.crumbles[id];if(!s)continue;const g=cr.g;
      if(s.st==='idle'){if(cr.st!=='idle'){g.visible=true;g.position.set(cr.base.x,cr.base.y,cr.base.z);g.rotation.set(0,0,0);g.scale.setScalar(.01)}g.scale.setScalar(Math.min(1,g.scale.x+dt*3))}
      else if(s.st==='shake'){g.visible=true;g.position.set(cr.base.x+(Math.random()-.5)*.08,cr.base.y+(Math.random()-.5)*.04,cr.base.z+(Math.random()-.5)*.08);g.scale.setScalar(1)}
      else if(s.st==='fall'){if(cr.st!=='fall'){cr.vy=0;this.puff(cr.base.x,cr.base.y,cr.base.z,'#b9a58e',14,3,.9,.18)}cr.vy-=22*dt;g.position.y+=cr.vy*dt;g.rotation.x+=dt*.8;g.rotation.z+=dt*.5;g.visible=g.position.y>cr.base.y-25}
      cr.st=s.st}
    // particles + snow + clouds drift
    this.parts=this.parts.filter(p=>{p.t+=dt;const k=p.t/p.life;if(k>=1){this.sc.remove(p.m);p.m.material.dispose();return false}
      p.vy-=3*dt;p.m.position.x+=p.vx*dt;p.m.position.y+=p.vy*dt;p.m.position.z+=p.vz*dt;p.m.scale.setScalar(p.s*(1+k));p.m.material.opacity=.75*(1-k);return true});
    const sp_=this.snow.geometry.attributes.position,ct=this.camT;for(let i=0;i<sp_.count;i++){let y=sp_.getY(i)-dt*(1+(i%5)*.3),x=sp_.getX(i)+Math.sin(t+i)*dt*.3;if(y<-5)y+=30;sp_.setY(i,y);sp_.setX(i,x)}sp_.needsUpdate=true;
    this.snow.position.set(Math.round(ct.x/60)*60,ct.y-8,ct.z);
    this.clouds.position.x=Math.sin(t*.05)*3;this.skyClouds.position.x=(t*.6)%60-30;
    this.r.render(this.sc,cam);
  }
  dispose(){this.sc.traverse(o=>{if(o.geometry)o.geometry.dispose();if(o.material){[].concat(o.material).forEach(m=>{if(m.map)m.map.dispose();m.dispose()})}});this.r.dispose()}
}
function mergeGeos(list){
  const T=THREE;let n=0;list.forEach(g=>n+=g.attributes.position.count);
  const pos=new Float32Array(n*3),nor=new Float32Array(n*3),col=new Float32Array(n*3);let o=0;
  list.forEach(g=>{const c=g.attributes.position.count;pos.set(g.attributes.position.array,o*3);if(!g.attributes.normal)g.computeVertexNormals();nor.set(g.attributes.normal.array,o*3);if(g.attributes.color)col.set(g.attributes.color.array,o*3);else col.fill(1,o*3,(o+c)*3);o+=c;g.dispose()});
  const out=new T.BufferGeometry();out.setAttribute('position',new T.BufferAttribute(pos,3));out.setAttribute('normal',new T.BufferAttribute(nor,3));out.setAttribute('color',new T.BufferAttribute(col,3));return out;
}
function canvasTex(w,h,draw){const c=document.createElement('canvas');c.width=w;c.height=h;draw(c.getContext('2d'),w,h);const t=new THREE.CanvasTexture(c);t.encoding=THREE.sRGBEncoding;t.anisotropy=4;return t}
function nameTex(name,colr){return canvasTex(256,72,(c,w,h)=>{if(!name)return;c.font='900 38px system-ui,sans-serif';const tw=Math.min(244,c.measureText(name).width+34);c.fillStyle=colr;c.strokeStyle=K;c.lineWidth=6;
  c.beginPath();c.roundRect?c.roundRect((w-tw)/2,8,tw,54,22):c.rect((w-tw)/2,8,tw,54);c.fill();c.stroke();c.fillStyle='#fff';c.textAlign='center';c.textBaseline='middle';c.fillText(name,w/2,36,tw-22)})}

/* ======================= the game ======================= */
class Deadweight{
  constructor(){this.raf=0;this.on=false;this.gen=0;this.keys={};this.touch={mx:0,my:0,jump:false,brace:false};this.jumpQ=false}
  init(mode){
    this.mode=mode;this.online=mode==='online';this.me=this.online?(HOST?0:1):0;this.active=0;
    this.P=new Physics();this.cp=0;this.falls=0;this.startAt=0;this.state='count';this.cd=3.2;this.won=false;this.gen=this.online?myG:0;
    this.paused=false;this.menuOpen=false;$('#dwpm').hidden=true;
    this.P.spawnAt(0);this.net=this.online?new DWNet(this):null;this.crumbleSeen={};this.lastTipCp=-1;this.followT=0;
    if(!this.world){try{this.world=new DWWorld($('#dwcv'))}catch(e){console.error(e);err('3D is not available on this device.');return false}}
    this.world.cps.forEach((c,i)=>c.lit=i===0);this.world.camT=null;
    this.world.resize();this.acc=0;this.last=nowMs();
    hud.reset(this);banner(COURSE.cps[0].next,COURSE.cps[0].tip);
    if(this.online){if(HOST)this.hostStart();else this.hello()}
    return true;
  }
  startLoop(){this.on=true;if(!this.raf)this.raf=requestAnimationFrame(t=>this.frame(t))}
  destroy(){this.on=false;cancelAnimationFrame(this.raf);this.raf=0;clearInterval(this.helloI);this.keys={};}
  hostStart(){this.state='count';this.cd=3.2;const at=nowMs()+3200;this.goAt=at;this.net.ev({e:'dgo',at,cp:this.cp,hme:this.me})}
  hello(){clearInterval(this.helloI);this.net.ev({e:'dhi'});this.helloI=setInterval(()=>{if(this.synced)return clearInterval(this.helloI);this.net.ev({e:'dhi'})},1000)}
  /* ---- input ---- */
  input(){
    const k=this.keys,tc=this.touch;let ix=((k.KeyD||k.ArrowRight)?1:0)-((k.KeyA||k.ArrowLeft)?1:0),iy=((k.KeyW||k.ArrowUp)?1:0)-((k.KeyS||k.ArrowDown)?1:0);
    if(!ix&&!iy){ix=tc.mx;iy=-tc.my}
    const yaw=this.world.camYaw,c=Math.cos(yaw),s=Math.sin(yaw);
    const mx=c*ix-s*iy,mz=-s*ix-c*iy,jumpHeld=!!(k.Space||tc.jump);
    const I={mx,mz,jump:this.jumpQ,jumpHeld,climb:jumpHeld,brace:!!(k.ShiftLeft||k.ShiftRight||tc.brace),local:true};this.jumpQ=false;return I;
  }
  // solo: what the climber you're not controlling does.
  // Off the ground: climb toward you if hanging. You in the air or the rope pulling: brace.
  // Otherwise walk after you (mantling steps, hopping small gaps) and brace when it gets close or stuck.
  partnerAI(c,a){
    const I={mx:0,mz:0,jump:false,climb:false,brace:false,local:true},P=this.P,ai=this.ai||(this.ai={best:1e9,t:0,lastA:{x:a.x,y:a.y}});
    if(!c.grounded){I.climb=c.hang&&a.y>c.y+.4;if(c.hang){const dx=a.x-c.x,dz=a.z-c.z,d=Math.hypot(dx,dz)||1;I.mx=dx/d*.6;I.mz=dz/d*.6}return I}
    if(!a.grounded||a.hang||P.tension>.05){I.brace=true;return I}
    const dx=a.x-c.x,dz=a.z-c.z,d=Math.hypot(dx,dz),dy=a.y-c.y;
    // you moved somewhere new: try following again
    if(Math.hypot(a.x-ai.lastA.x,a.y-ai.lastA.y)>1.2){ai.lastA={x:a.x,y:a.y};ai.best=1e9;ai.t=0;ai.gaveUp=false}
    if(ai.gaveUp||d<2.6||dy<-2.5||dy>4.2)return I;   // just stand there (easy to push past or stand on)
    I.mx=dx/d;I.mz=dz/d;
    if(d<ai.best-.4){ai.best=d;ai.t=0}else{ai.t+=CFG.step;if(ai.t>2.5){ai.gaveUp=true;I.mx=I.mz=0;return I}}
    const ax=c.x+I.mx*.7,az=c.z+I.mz*.7,ground=P.boxes.some(b=>!b.off&&ax>b[0]&&ax<b[3]&&az>b[2]&&az<b[5]&&b[4]<=c.y+.05&&b[4]>c.y-.7);
    const wall=c.wallN&&(c.wallN.x*I.mx+c.wallN.z*I.mz)<-.5;
    if(!ground){
      // a gap: jump it if there's ground within reach on the other side, otherwise stay put
      const land=P.boxes.some(b=>{if(b.off)return false;for(let k=1.2;k<=3.6;k+=.4){const lx=c.x+I.mx*k,lz=c.z+I.mz*k;if(lx>b[0]&&lx<b[3]&&lz>b[2]&&lz<b[5]&&b[4]<=c.y+1.4&&b[4]>c.y-3)return true}return false});
      if(land)I.jump=true;else{I.mx=I.mz=0;I.brace=true}
    }else if(wall&&dy>.4)I.jump=true;
    return I;
  }
  /* ---- one physics tick ---- */
  tick(dt,now){
    const P=this.P,ins=[null,null],live=this.state==='play';
    if(this.online){
      const me=this.me,o=1-me,rp=this.net.partner(now);
      ins[me]=live?this.input():{mx:0,mz:0,local:true};
      if(rp){Object.assign(P.c[o],{x:rp.x,y:rp.y,z:rp.z,vx:rp.vx,vy:rp.vy,vz:rp.vz,yaw:rp.yaw,grounded:rp.grounded,brace:rp.brace,hang:rp.hang,climbing:rp.climbing,mantle:rp.mantle?{}:null,reel:rp.reel})}
      ins[o]={local:false};
    }else{
      const a=this.active,o=1-a;ins[a]=live?this.input():{mx:0,mz:0,local:true};ins[o]=live?this.partnerAI(P.c[o],P.c[a]):{mx:0,mz:0,local:true,brace:true};
    }
    P.step(dt,ins,{now:now/1000,auth:!this.online||HOST});
    for(const e of P.events)this.onPhysEvent(e,now);P.events.length=0;
    if(live)this.rules(now);
  }
  onPhysEvent(e,now){
    const mine=i=>!this.online||i===this.me,W=this.world,c=this.P.c[e.i];
    if(e.k==='jump'&&mine(e.i))SFX.pop();
    else if(e.k==='land'&&mine(e.i)){SFX.tick();if(e.v>.5){W.puff(c.x,c.y+.05,c.z,'#e8e2d8',6,2,.5,.1);if(e.v>.9)W.shake=.15}}
    else if(e.k==='grab'&&mine(e.i))SFX.grab();
    else if(e.k==='kick'&&mine(e.i)){SFX.dodge();W.puff(c.x,c.y+.8,c.z,'#e8e2d8',5,1.5,.4,.08)}
    else if(e.k==='taut'){if(now-(this.tautT||0)>900&&e.t>.5){this.tautT=now;SFX.creak();W.shake=.12}}
    else if(e.k==='crstep'){
      if(this.crumbleSeen[e.id]&&now-this.crumbleSeen[e.id]<700)return;this.crumbleSeen[e.id]=now;
      if(!this.online||HOST){this.P.startCrumble(e.id,now/1000);SFX.shake();if(this.online)this.net.ev({e:'dcr',bid:e.id,at:now})}
      else if(mine(e.i))this.net.ev({e:'dstep',bid:e.id});
    }
    else if(e.k==='crfall')SFX.splat();
  }
  /* checkpoints, falls and the summit (decided by solo player or the room host) */
  rules(now){
    const P=this.P,[A,B]=P.c,auth=!this.online||HOST,cpY=COURSE.cps[this.cp].y;
    // a fall: one climber far below anything the rope could hold them at, or both plummeting together
    const deep=i=>P.c[i].y<cpY-13||P.c[i].y<-17,low=i=>P.c[i].y<cpY-5&&!P.c[i].grounded;
    const fell=deep(0)||deep(1)||(low(0)&&low(1)&&P.c[0].vy<-6&&P.c[1].vy<-6);
    if(!this.online&&fell)return this.respawn(true);
    if(this.online&&fell){if(now-(this.lastRespawn||0)<1500)return;if(HOST)this.respawn(true);else if(now-(this.fallSent||0)>800){this.fallSent=now;this.net.ev({e:'dfall'})}return}
    if(!auth)return;
    for(let i=this.cp+1;i<COURSE.cps.length;i++){const c=COURSE.cps[i],near=q=>Math.hypot(q.x-c.x,q.z-c.z)<3.4&&q.y>c.y-.4&&q.y<c.y+2&&q.grounded;
      if(near(A)&&near(B)){this.reachCp(i);if(this.online)this.net.ev({e:'dcp',i});break}}
    const S=COURSE.summit,top=q=>Math.hypot(q.x-S.x,q.z-S.z)<3.2&&q.y>S.y-.3&&q.grounded;
    if(top(A)&&top(B)&&!this.won){const time=(now-this.startAt)/1000;this.win(time,this.falls);if(this.online)this.net.ev({e:'dwin',time,falls:this.falls})}
  }
  reachCp(i){if(i<=this.cp)return;this.cp=i;this.world.cps[i].lit=true;SFX.star();jingleS(true);const c=COURSE.cps[i];banner('Checkpoint! Next: '+c.next,c.tip);hud.cp(this)}
  respawn(bcast){
    this.falls++;this.lastRespawn=nowMs();const P=this.P;
    if(this.online){P.spawnAt(this.cp,this.me);P.rope.reset(P.waist(P.c[0]),P.waist(P.c[1]));if(bcast&&HOST)this.net.ev({e:'drs',cp:this.cp,n:this.falls})}
    else{P.spawnAt(this.cp)}
    SFX.whoosh();this.world.shake=.3;flash('Fell! Back to the checkpoint');hud.cp(this);
  }
  win(time,falls){if(this.won)return;this.won=true;this.state='done';
    const m=Math.floor(time/60),s=Math.floor(time%60);jingle(true);
    for(let k=0;k<5;k++)setTimeout(()=>this.world.puff(COURSE.summit.x,COURSE.summit.y+3,COURSE.summit.z,['#ffe14d','#ff3e5a','#2ec4b6','#ffffff'][k%4],18,6,1.4,.12),k*250);
    setTimeout(()=>{if(phase!=='dwplay')return;setOver('⛰ SUMMIT!',`You made it in <b>${m}:${String(s).padStart(2,'0')}</b> with <b>${falls}</b> fall${falls===1?'':'s'}.<br><small>Fewer falls next time?</small>`,this.online?null:'Climb again')},1600)}
  /* ---- network events ---- */
  onEvent(d){
    if(!this.online||(d.g!=null&&+d.g!==this.gen&&d.e!=='dhi'))return;
    const P=this.P,now=nowMs(),local=at=>NET.clk!=null?(+at)-NET.clk:now-NET.rtt/2;
    if((d.e==='dgo'||d.e==='dstate')&&!HOST&&d.hme!=null&&this.me!==1-(+d.hme)){this.me=1-(+d.hme);this.P.spawnAt(this.cp,this.me)}
    if(d.e==='dgo'){this.synced=true;clearInterval(this.helloI);this.goAt=local(d.at);this.state='count';this.cd=(this.goAt-now)/1000;if(+d.cp>this.cp)this.jumpTo(+d.cp)}
    else if(d.e==='dhi'&&HOST){this.net.ev({e:'dstate',hme:this.me,cp:this.cp,falls:this.falls,el:this.state==='play'?now-this.startAt:0,state:this.state,cr:P.boxes.filter(b=>b.kind==='c'&&b.st!=='idle').map(b=>[b.id,b.st,now-b.t0*1000])});
      if(this.state!=='play'&&this.state!=='done')this.hostStart()}
    else if(d.e==='dstate'&&!HOST){this.synced=true;clearInterval(this.helloI);this.falls=+d.falls||0;if(+d.cp!==this.cp)this.jumpTo(+d.cp);
      if(d.state==='play'){this.state='play';this.startAt=now-(+d.el||0)}
      (d.cr||[]).forEach(([id,st,ago])=>{const b=P.boxes[id];if(b){b.st=st;b.t0=(now-ago)/1000;b.off=st==='fall'}});hud.cp(this)}
    else if(d.e==='dcr'&&!HOST){P.startCrumble(+d.bid,local(d.at)/1000);SFX.shake()}
    else if(d.e==='dstep'&&HOST){this.onPhysEvent({k:'crstep',id:+d.bid,i:1-this.me},now)}
    else if(d.e==='dcp'){this.reachCp(+d.i)}
    else if(d.e==='dfall'&&HOST){if(now-(this.lastRespawn||0)>1500)this.respawn(true)}
    else if(d.e==='drs'&&!HOST){this.falls=(+d.n||this.falls+1)-1;if(+d.cp!==this.cp)this.jumpTo(+d.cp);this.respawn(false)}
    else if(d.e==='dwin'){this.win(+d.time,+d.falls)}
  }
  jumpTo(cp){this.cp=cp;this.world.cps.forEach((c,i)=>c.lit=i<=cp);if(this.online)this.P.spawnAt(cp,this.me);else this.P.spawnAt(cp);hud.cp(this)}
  /* ---- frame ---- */
  frame(ms){
    this.raf=requestAnimationFrame(t=>this.frame(t));if(!this.on||$('#dwgame').hidden)return;
    const now=nowMs(),dt=Math.min(.1,(now-this.last)/1000);this.last=now;
    if(this.paused){const P=this.P,f=this.active;this.world.render({cl:P.c,rope:P.rope,focus:P.c[f],other:P.c[1-f],active:this.active,names:NAME_DEF.map((n,i)=>i===this.active?n+' ★':n),dt:0,t:this.pauseAt/1000,tension:0,crumbles:{}});return}
    if(this.state==='count'){
      if(this.online&&this.goAt)this.cd=(this.goAt-now)/1000;else if(!this.online)this.cd-=dt;
      if(this.cd<=0&&(!this.online||this.goAt)){this.state='play';this.startAt=this.online?this.goAt:now;SFX.go();hud.msg('GO!',600)}
      else if(!this.online||this.goAt)hud.count(this.cd);
    }
    this.acc+=dt;let n=0;while(this.acc>=CFG.step&&n<12){this.acc-=CFG.step;this.tick(CFG.step,now);n++}if(n>=12)this.acc=0;
    if(this.online){this.net.sendState(now,this.P.c[this.me]);}
    const P=this.P,f=this.online?this.me:this.active,names=this.online?[HOST?me.n:(on||'Partner'),HOST?(on||'Partner'):me.n]:NAME_DEF.map((n,i)=>i===this.active?n+' ★':n);
    const crs={};P.boxes.forEach(b=>{if(b.kind==='c')crs[b.id]=b});
    this.world.render({cl:P.c,rope:P.rope,focus:P.c[f],other:P.c[1-f],active:this.online?null:this.active,names,dt,t:now/1000,tension:P.tension||0,crumbles:crs});
    hud.update(this,now);
  }
  // pause menu: solo freezes the climb; online it's just a menu (the climb keeps going for your partner)
  setPause(on){
    if(this.state==='done')on=false;$('#dwpm').hidden=!on;this.menuOpen=on;
    $('#dwpmt').textContent=this.online?'MENU':'PAUSED';$('#dwpms').textContent=this.online?'The climb keeps going while this is open.':'Take a breather, the mountain will wait.';
    this.keys={};this.touch={mx:0,my:0,jump:false,brace:false};
    if(this.online)return;
    if(on&&!this.paused){this.paused=true;this.pauseAt=nowMs()}
    else if(!on&&this.paused){this.paused=false;this.startAt+=nowMs()-this.pauseAt;this.last=nowMs()}
  }
  backToCp(){if(this.state!=='play')return;if(!this.online)this.respawn();else if(HOST)this.respawn(true);else this.net.ev({e:'dfall'})}
  swap(){if(this.online||this.state!=='play')return;this.active=1-this.active;SFX.sel();flash('Now controlling '+NAME_DEF[this.active])}
}

/* ======================= HUD + controls ======================= */
const html=`
<section id="dwmenu" class="card gmenu" hidden>
<div class="mhero"><div class="mart" data-art="deadweight"></div><h2 class="mh">Deadweight</h2></div>
<div class="row rsets"><label>Online room code<input id="cd10" maxlength="6" autocomplete="off"></label></div>
<div class="row"><button class="btn b" id="dwsolo">Solo · control both climbers</button><button class="btn" id="dwgo">Online with a friend</button></div>
<p class="note" data-msg></p>
<ul class="rules">
 <li><b>Two climbers, one 9 m rope.</b> Reach the summit flag together. If one falls, the rope is all that saves them.</li>
 <li><b>Move:</b> W A S D · <b>Jump:</b> Space · <b>Brace:</b> hold Shift (plant your feet and become a heavy anchor) · <b>Camera:</b> drag the screen. On a phone: stick on the left, buttons on the right.</li>
 <li><b>Hanging from the rope?</b> Hold Jump to climb it. Steer to swing, and push away from a wall to kick off it. Reach a ledge edge to pull yourself up.</li>
 <li><b>Too high?</b> Stand on your partner's head. <b>Too wide?</b> Brace at the edge while your partner swings across.</li>
 <li><b>Solo:</b> you control both climbers. Press <b>Tab</b> (or the SWAP button) to switch. The one you leave behind braces when you jump, and follows you on solid ground.</li>
</ul>
<button class="btn m back" data-back>← All games</button></section>
<section id="dwgame" hidden>
<div id="dwstage"><canvas id="dwcv"></canvas>
 <div id="dwinfo" class="dwp"><b id="dwsec">Base Camp</b><div class="dwrow"><span id="dwtime">0:00</span><span id="dwfalls">0 falls</span></div></div>
 <div id="dwroute" class="dwp"><svg id="dwprof" viewBox="0 0 400 40" preserveAspectRatio="none" aria-hidden="true"></svg><div class="dwpins"></div><span class="flag">⛳</span></div>
 <button id="dwpause" class="dwp" aria-label="Menu"><i></i><i></i></button>
 <button id="dwswapb" hidden><i></i>SWAP <small>TAB</small></button>
 <div id="dwkeys" class="dwp"><span><kbd>W A S D</kbd> move</span><span><kbd>SPACE</kbd> jump · hold to climb</span><span><kbd>SHIFT</kbd> brace</span><span><kbd>TAB</kbd> swap</span><span><kbd>R</kbd> back to checkpoint</span><span><kbd>DRAG</kbd> look around</span></div>
 <div id="dwbanner"></div><div id="dwflash"></div><p id="dwtip"></p><div id="dwmsg"></div><div id="dwpads" hidden></div>
 <div id="dwpm" hidden><div class="dwpmc">
   <h3 id="dwpmt">PAUSED</h3><p id="dwpms"></p>
   <div class="dwpmb"><button class="btn m" id="dwres">Resume</button><button class="btn o" id="dwback">Back to checkpoint</button><button class="btn b" id="dwquit">Leave the climb</button></div>
   <ul class="dwpmk"><li><b>Move</b> W A S D / stick</li><li><b>Jump</b> Space · hold to climb the rope</li><li><b>Brace</b> hold Shift: become an anchor</li><li><b>Swap</b> Tab (solo)</li><li><b>Look</b> drag the screen · wheel to zoom</li></ul>
 </div></div>
</div></section>`;
$('#app').insertAdjacentHTML('beforeend',html);
$('#dwmenu [data-back]').onclick=()=>{show('hub');SFX.back()};
['contextmenu','selectstart','dragstart'].forEach(n=>$('#dwgame').addEventListener(n,e=>e.preventDefault()));

let bannerT=0;
function banner(title,tip){const b=$('#dwbanner');b.innerHTML=`<b>${esc(title)}</b>${tip?`<span>${esc(tip)}</span>`:''}`;b.style.opacity=1;clearTimeout(bannerT);bannerT=setTimeout(()=>b.style.opacity=0,6500)}
let flashT=0;function flash(t){const f=$('#dwflash');f.textContent=t;f.classList.add('on');clearTimeout(flashT);flashT=setTimeout(()=>f.classList.remove('on'),1600)}
const hud={
  reset(G){
    // the route bar is a side view of the mountain: climbers ride along it by distance and height
    const pins=$('#dwroute .dwpins');pins.innerHTML='';const x0=-3,x1=COURSE.summit.x+3,y0=-5,y1=17;
    this.px=x=>clamp((x-x0)/(x1-x0),0,1);this.py=y=>1-clamp((y-y0)/(y1-y0),0,1);
    const top=x=>{let t=-99;for(const b of COURSE.boxes)if(x>=b[0]&&x<=b[3])t=Math.max(t,b[4]);return t};
    let d='M0 40';for(let k=0;k<=200;k++){const x=x0+(x1-x0)*k/200,t=top(x);d+=`L${(k*2).toFixed(1)} ${(t<-50?40:this.py(t)*40).toFixed(1)}`}d+='L400 40Z';
    $('#dwprof').innerHTML=`<path d="${d}" fill="#c9bfe6"/><path d="${d}" fill="none" stroke="#14111f" stroke-width="1.6" vector-effect="non-scaling-stroke"/>`;
    COURSE.cps.forEach((c,i)=>{const e=document.createElement('i');e.className='ck'+(i===0?' on':'');e.style.left=this.px(c.x)*100+'%';e.style.top=this.py(c.y)*100+'%';pins.append(e)});
    this.dots=[0,1].map(i=>{const d=document.createElement('i');d.className='dot';d.style.background=COL[i];pins.append(d);return d});
    $('#dwswapb').hidden=G.online||TOUCH_UI;$('#dwswapb i').style.background=COL[G.active];this.cp(G);this.tipS='';
    const k=$('#dwkeys');k.hidden=TOUCH_UI;k.classList.remove('fade');clearTimeout(this.kt);this.kt=setTimeout(()=>k.classList.add('fade'),15000);
  },
  cp(G){$('#dwsec').textContent=G.cp===0?'Base Camp':COURSE.cps[G.cp].next;$('#dwfalls').textContent=G.falls+' fall'+(G.falls===1?'':'s');
    $('#dwroute').querySelectorAll('.ck').forEach((e,i)=>e.classList.toggle('on',i<=G.cp))},
  count(cd){const n=Math.ceil(cd);const m=$('#dwmsg');const h=cd>3?'<span>READY?</span>':`<span>${n}</span>`;if(m.dataset.h!==h){m.dataset.h=h;m.innerHTML=h;if(cd<=3)SFX.count()}},
  msg(t,ms){const m=$('#dwmsg');m.dataset.h='';m.innerHTML=`<span>${esc(t)}</span>`;clearTimeout(this.mt);this.mt=setTimeout(()=>{if(m.innerHTML.includes(esc(t)))m.innerHTML=''},ms)},
  update(G,now){
    const P=G.P;this.dots.forEach((d,i)=>{d.style.left=this.px(P.c[i].x)*100+'%';d.style.top=this.py(P.c[i].y)*100+'%'});
    if(G.state==='play'||G.state==='done'){const el=G.state==='done'?0:(now-G.startAt)/1000;if(G.state==='play'){const m=Math.floor(el/60),s=Math.floor(el%60);const ts=m+':'+String(s).padStart(2,'0');if(this.ts!==ts){this.ts=ts;$('#dwtime').textContent=ts}}}
    // partner gone (online)
    const pm=$('#dwmsg');if(G.online&&G.state==='play'){const rp=G.net.partner(now);const gone=!opp||!rp||rp.stale;const h=gone?`<div class="pnl">⏸ Waiting for ${esc(on||'your partner')}… their climber is holding on where they were.</div>`:'';if(pm.dataset.g!==h){pm.dataset.g=h;if(gone||pm.querySelector('.pnl'))pm.innerHTML=h}}
    else if(G.online&&G.state==='count'&&!G.goAt){const h=`<div class="pnl">Roping up with ${esc(on||'your partner')}…</div>`;if(pm.dataset.h!==h){pm.dataset.h=h;pm.innerHTML=h}}
    // contextual tip
    const me_=P.c[G.online?G.me:G.active],o=P.c[G.online?1-G.me:1-G.active],kb=!TOUCH_UI;let tip='';
    const K_=(k,t)=>kb?`<kbd>${k}</kbd>`:`<kbd>${t}</kbd>`;
    if(G.state==='play'){
      if(me_.hang)tip=`Hanging! Hold ${K_('SPACE','JUMP')} to climb · steer to swing · push away from a wall to kick off`;
      else if(o.hang&&!me_.brace)tip=`Your partner is hanging on you! Hold ${K_('SHIFT','BRACE')} to anchor them`;
      else if(me_.brace&&o.hang)tip=`Holding them! Keep bracing while they climb`;
      else if(me_.onHead)tip=`You're on their head, now jump!`;
      else if(!G.online&&G.state==='play'&&me_.grounded&&Math.hypot(me_.x-o.x,me_.z-o.z)>6)tip=`${K_('TAB','SWAP')} switches climbers`;
    }
    if(this.tipS!==tip){this.tipS=tip;$('#dwtip').innerHTML=tip}
    const sb=$('#dwswapb i');if(sb&&!G.online)sb.style.background=COL[G.active];
  }
};
function buildPads(G){
  const box=$('#dwpads');box.hidden=!TOUCH_UI;if(!TOUCH_UI)return;
  box.innerHTML=`<div class="joy"><div class="joyhint"><i></i><span>drag to move</span></div><div class="knob"><i></i></div></div><div class="btns">${G.online?'':'<button class="ob s" data-k="swap"><b>⇄</b>SWAP</button>'}<button class="ob b" data-k="brace"><b>⚓</b>BRACE</button><button class="ob j" data-k="jump"><b>▲</b>JUMP</button></div>`;
  const joy=box.querySelector('.joy'),kn=box.querySelector('.knob'),ki=kn.querySelector('i');let jid=null,bx=0,by=0;
  joy.addEventListener('pointerdown',e=>{e.preventDefault();jid=e.pointerId;joy.classList.add('used');try{joy.setPointerCapture(jid)}catch(x){}const r=joy.getBoundingClientRect();bx=e.clientX-r.left;by=e.clientY-r.top;kn.style.left=bx+'px';kn.style.top=by+'px';kn.style.display='block';ki.style.transform=''});
  joy.addEventListener('pointermove',e=>{if(e.pointerId!==jid)return;const r=joy.getBoundingClientRect();let dx=e.clientX-r.left-bx,dy=e.clientY-r.top-by;const d=Math.hypot(dx,dy),R=44;if(d>R){dx*=R/d;dy*=R/d}ki.style.transform=`translate(${dx}px,${dy}px)`;G.touch.mx=dx/R;G.touch.my=dy/R});
  const jup=e=>{if(e.pointerId!==jid)return;jid=null;kn.style.display='none';G.touch.mx=G.touch.my=0};['pointerup','pointercancel'].forEach(n=>joy.addEventListener(n,jup));
  box.querySelectorAll('.ob').forEach(b=>{b.addEventListener('pointerdown',e=>{e.preventDefault();try{b.setPointerCapture(e.pointerId)}catch(x){}b.classList.add('act');const k=b.dataset.k;
      if(k==='jump'){G.touch.jump=true;G.jumpQ=true}else if(k==='brace')G.touch.brace=true;else if(k==='swap')G.swap()});
    const up=()=>{b.classList.remove('act');const k=b.dataset.k;if(k==='jump')G.touch.jump=false;else if(k==='brace')G.touch.brace=false};
    ['pointerup','pointercancel','lostpointercapture'].forEach(n=>b.addEventListener(n,up))});
}
// camera: drag anywhere on the view (mouse) or the upper-right area (touch)
(()=>{let id=null,lx=0,ly=0;const cv=$('#dwcv');
  cv.addEventListener('pointerdown',e=>{id=e.pointerId;lx=e.clientX;ly=e.clientY;try{cv.setPointerCapture(id)}catch(x){}cv.style.cursor='grabbing'});
  cv.addEventListener('pointermove',e=>{if(e.pointerId!==id||!game.world)return;const W=game.world;W.camYaw=clamp(W.camYaw-(e.clientX-lx)*.006,-1.3,1.3);W.camPitch=clamp(W.camPitch+(e.clientY-ly)*.004,.08,1.0);lx=e.clientX;ly=e.clientY});
  const up=e=>{if(e.pointerId===id){id=null;cv.style.cursor='grab'}};['pointerup','pointercancel'].forEach(n=>cv.addEventListener(n,up));
  cv.addEventListener('wheel',e=>{if(!game.world)return;e.preventDefault();game.world.camDist=clamp(game.world.camDist+e.deltaY*.01,7,22)},{passive:false});
})();
const typing=e=>e.target&&/INPUT|SELECT|TEXTAREA/.test(e.target.tagName);
addEventListener('keydown',e=>{if($('#dwgame').hidden||typing(e))return;
  if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space','Tab'].includes(e.code))e.preventDefault();
  if(!e.repeat&&e.code==='Space')game.jumpQ=true;
  if(!e.repeat&&(e.code==='Tab'||e.code==='KeyQ'))game.swap();
  if(!e.repeat&&(e.code==='Escape'||e.code==='KeyP'))return game.setPause(!game.menuOpen);
  if(game.menuOpen)return;
  if(!e.repeat&&e.code==='KeyR')game.backToCp();
  game.keys[e.code]=true});
addEventListener('keyup',e=>{game.keys[e.code]=false});
addEventListener('blur',()=>{game.keys={};game.touch={mx:0,my:0,jump:false,brace:false}});
addEventListener('resize',()=>{if(game.world&&!$('#dwgame').hidden)setTimeout(()=>game.world.resize(),50)});
$('#dwswapb').onclick=()=>game.swap();

/* ======================= arcade plug-in ======================= */
const game=new Deadweight();
function start(mode){
  me.n=($('#nm').value.trim()||'Climber').slice(0,12);
  if(mode!=='online'){leave();G='deadweight';cpu=true}
  phase='dwplay';show('dwgame');$('#net').hidden=mode!=='online';
  document.documentElement.classList.add('dwon');document.documentElement.classList.toggle('dwtouch',TOUCH_UI);
  game.destroy();
  if(!window.THREE){err('The 3D engine did not load. Check your internet and try again.');return}
  if(!game.init(mode==='online'?'online':'solo'))return;
  buildPads(game);game.startLoop();
}
function stop(){game.destroy();document.documentElement.classList.remove('dwon','dwtouch')}
function sync(){if(phase!=='dwplay'||!game.online)return;
  // promoted to host (the old host left): keep the climb going
  if(HOST&&game.me!==0&&!game.hostFlag){game.hostFlag=true}
  if(opp&&game.wasGone&&!HOST)game.hello();game.wasGone=!opp;
  if(game.waitRe&&opp&&opp.g===myG){game.waitRe=false;$('#over').hidden=true;$('#dwmsg').innerHTML='';game.init('online');game.startLoop()}
  if(!$('#over').hidden)rmLabel()}
function event(d){if(phase==='dwplay')game.onEvent(d)}
function fast(d){if(phase==='dwplay'&&game.net&&(+d.g===game.gen))game.net.onFast(d)}
function rematch(){
  if(!game.online){start('solo');return}
  if(!opp)return;myG=opp.g>myG?opp.g:myG+1;pub();
  if(opp.g===myG){$('#over').hidden=true;game.init('online');game.startLoop()}else{$('#dwmsg').innerHTML=`<div class="pnl">Waiting for ${esc(on||'your partner')} to climb again…</div>`;game.waitRe=true}
}
$('#dwsolo').onclick=()=>{need3D().then(()=>start('solo')).catch(()=>err('The 3D engine did not load. Check your internet and try again.'))};
$('#dwgo').onclick=()=>join('deadweight');
$('#dwquit').onclick=leave;
$('#dwpause').onclick=()=>{SFX.ui();game.setPause(!game.menuOpen)};
$('#dwres').onclick=()=>{SFX.ui();game.setPause(false)};
$('#dwback').onclick=()=>{game.setPause(false);game.backToCp()};

/* ---- music + card art ---- */
THEMES.deadweight={bpm:92,sw:.08,vol:.9,key:62,maj:0,prog:prog('D2:m7 Bb1:maj7 F2:maj C2:sus'),
  bass:seq('0 . . . 7 . . . 0 . . 12 . . 7 .'),bassT:'triangle',bassV:.3,bassD:2.2,
  stab:seq('x . . . . . x . . . x . . . . .'),stabO:12,stabT:'sine',stabV:.05,stabD:3,stabDl:.25,
  lead:[seq('A4 . . . D5 . . . F5 . E5 . D5 . . .'),seq('C5 . . . F5 . . . A5 . . . G5 . . .'),seq('A5 . . . G5 . F5 . E5 . . . C5 . . .'),seq('D5 . . . . . . . E5 . . . . . . .')],leadT:'triangle',leadV:.08,leadD:2.6,leadDl:.3,leadVib:6,
  k:'x.......x.....x.',r:'....x.......x...',h:'..x...x...x...x.',hV:.025};
ART_GEN.deadweight=(W_,n)=>{
  // dusk over the ranges: one climber braces on the cliff edge, the other dangles on the rope
  const cx=W_/2,u='_d'+n,ks=Math.min(1,(W_-12)/250);
  const range=(base,amp,step,col,snow,seed)=>{let d=`M-20 130L-20 ${base}`,caps='';for(let x=-20,k=0;x<W_+40;x+=step,k++){const h=amp*(.55+((k*seed*37)%10)/22),px=x+step/2,py=base-h;d+=`L${px} ${py}L${x+step} ${base-amp*.25}`;
      if(snow)caps+=`<path d="M${px-step*.16} ${py+h*.22}L${px} ${py}L${px+step*.16} ${py+h*.22}L${px+step*.06} ${py+h*.16}L${px} ${py+h*.26}L${px-step*.07} ${py+h*.17}Z" fill="${snow}"/>`}
    return `<path d="${d}L${W_+40} 130Z" fill="${col}"/>${caps}`};
  const climber=(x,y,col,rot,pose)=>`<g transform="translate(${x} ${y}) rotate(${rot})">
    ${pose==='brace'?`<path d="M-6 0L-13 13M6 0L12 14" stroke="${K}" stroke-width="8" stroke-linecap="round"/><path d="M-6 0L-13 13M6 0L12 14" stroke="#3a3f5c" stroke-width="4.5" stroke-linecap="round"/>`
      :`<path d="M-4 0L-6 15M4 0L7 14" stroke="${K}" stroke-width="8" stroke-linecap="round"/><path d="M-4 0L-6 15M4 0L7 14" stroke="#3a3f5c" stroke-width="4.5" stroke-linecap="round"/>`}
    <rect x="-13" y="-20" width="9" height="15" rx="3" fill="#3a3f5c" stroke="${K}" stroke-width="2.5"/>
    <ellipse cx="0" cy="-8" rx="10" ry="12" fill="${col}" stroke="${K}" stroke-width="3"/>
    ${pose==='hang'?`<path d="M-5 -15L-3 -33M5 -15L3 -33" stroke="${K}" stroke-width="8" stroke-linecap="round"/><path d="M-5 -15L-3 -33M5 -15L3 -33" stroke="${col}" stroke-width="4.5" stroke-linecap="round"/>`
      :`<path d="M-8 -11L-19 -5M8 -11L17 -16" stroke="${K}" stroke-width="8" stroke-linecap="round"/><path d="M-8 -11L-19 -5M8 -11L17 -16" stroke="${col}" stroke-width="4.5" stroke-linecap="round"/>`}
    <circle cx="0" cy="-26" r="8" fill="#ffd2a6" stroke="${K}" stroke-width="2.5"/><path d="M-8.5 -27A8.5 8.5 0 0 1 8.5 -27Z" fill="${col}" stroke="${K}" stroke-width="2"/><circle cx="0" cy="-36" r="3.2" fill="#fff" stroke="${K}" stroke-width="1.5"/>
    <path d="M-6 -21h12" stroke="#fff" stroke-width="3" stroke-linecap="round"/><circle cx="-3" cy="-25" r="1.3" fill="${K}"/><circle cx="3" cy="-25" r="1.3" fill="${K}"/></g>`;
  const pine=(x,y,s)=>`<g transform="translate(${x} ${y}) scale(${s})"><rect x="-2" y="-6" width="4" height="7" fill="#5a3a26" stroke="${K}" stroke-width="1.5"/><path d="M-12 -4L0 -16L12 -4ZM-10 -12L0 -24L10 -12ZM-7 -20L0 -31L7 -20Z" fill="#2f7d4f" stroke="${K}" stroke-width="2" stroke-linejoin="round"/></g>`;
  const rope=`M${cx-24} 52Q${cx+2} 56 ${cx+7} 62Q${cx+26} 84 ${cx+43} 86`;
  let stars='';for(let i=0;i<14;i++)stars+=`<circle cx="${((i*97)%100)/100*W_}" cy="${6+((i*53)%30)}" r="${i%3?1:1.5}" fill="#fff" opacity="${.5+(i%3)*.2}"/>`;
  return `<svg viewBox="0 0 ${W_} 130" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><defs>
  <linearGradient id="ds${u}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#141a52"/><stop offset=".45" stop-color="#5d47a0"/><stop offset=".72" stop-color="#e9879f"/><stop offset="1" stop-color="#ffc690"/></linearGradient>
  <radialGradient id="dg${u}"><stop offset="0" stop-color="#ffe2aa" stop-opacity=".9"/><stop offset="1" stop-color="#ff9a8a" stop-opacity="0"/></radialGradient></defs>
  <rect width="${W_}" height="130" fill="url(#ds${u})"/>${stars}
  <circle cx="${cx+92}" cy="80" r="48" fill="url(#dg${u})"/><circle cx="${cx+92}" cy="80" r="18" fill="#fff0c4"/>
  ${range(98,34,46,'#a593cf','#f4efff',3)}${range(108,22,34,'#7c66ab','#efeaff',7)}
  <g fill="#ffe9ee"><rect y="114" width="${W_}" height="16"/>${Array.from({length:Math.ceil(W_/26)+1},(_,i)=>`<circle cx="${i*26}" cy="116" r="${9+(i%3)*3}"/>`).join('')}</g>
  <g transform="translate(${cx} 130) scale(${ks}) translate(${-cx} -130)"><g transform="translate(0 12)">
   <path d="M${cx-140} 130L${cx-140} 52Q${cx-70} 46 ${cx+4} 50L${cx+12} 130Z" fill="#97684c" stroke="${K}" stroke-width="3"/>
   <path d="M${cx-140} 72Q${cx-60} 66 ${cx+6} 70L${cx+7} 82Q${cx-60} 78 ${cx-140} 84Z" fill="#b0805f"/><path d="M${cx-140} 98Q${cx-60} 92 ${cx+9} 96L${cx+10} 108Q${cx-60} 104 ${cx-140} 110Z" fill="#7d543c"/>
   <path d="M${cx-140} 130L${cx-140} 52Q${cx-70} 46 ${cx+4} 50L${cx+12} 130" fill="none" stroke="${K}" stroke-width="3"/>
   <path d="M${cx-142} 52Q${cx-70} 45 ${cx+6} 49L${cx+6} 56Q${cx-70} 52 ${cx-142} 59Z" fill="#77c652" stroke="${K}" stroke-width="2.5" stroke-linejoin="round"/>
   ${pine(cx-112,50,1)}${pine(cx-92,49,.75)}
  </g>
   <path d="${rope}" fill="none" stroke="${K}" stroke-width="5.5" stroke-linecap="round"/><path d="${rope}" fill="none" stroke="#ffd23f" stroke-width="3" stroke-linecap="round"/><path d="${rope}" fill="none" stroke="#ff3e5a" stroke-width="3" stroke-dasharray="4 4"/>
   <g class="dwb"><g transform="translate(${cx-32} 60) scale(.82)">${climber(0,0,'#ff6b3d',-12,'brace')}</g></g>
   <g class="dwh"><g transform="translate(${cx+46} 114) scale(.82)">${climber(0,0,'#2ec4b6',16,'hang')}</g></g>
  </g></svg>`;
};

regGame('deadweight',{name:'Deadweight',menu:'dwmenu',stage:'dwgame',cd:'#cd10',theme:'deadweight',prep:()=>need3D(),start,sync,event,fast,rematch,stop,hb:()=>null});
window.Deadweight={game,DWWorld,DWNet};
})();
