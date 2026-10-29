/* GAME: Overdrive — 3D racing. Tracks, driving model (tune it in OVT), bots, online snapshots,
   touch pads. Car models live in cars.js. */
mountScreens(`
<!-- GAME 3 MENU: OVERDRIVE -->
<section id="rmenu" class="card gmenu" hidden><div class="mhero"><div class="mart" data-art="race"></div><h2 class="mh">Overdrive</h2></div>
<div id="rgarage">
  <canvas id="rgarage-cv"></canvas>
  <span id="rgarage-tag">Loading showroom…</span>
</div>
<p class="lb">1. Choose your car</p>
<div class="cfg-grid" id="rcars"></div>
<p class="lb">2. Choose a circuit</p>
<div class="cfg-grid" id="rtracks"></div>
<div class="row rsets">
  <label>Laps
    <select id="rlaps">
      <option value="1">1 lap · Sprint</option>
      <option value="2">2 laps</option>
      <option value="3" selected>3 laps · Grand Prix</option>
      <option value="5">5 laps · Endurance</option>
      <option value="8">8 laps · Feature race</option>
    </select>
  </label>
  <label>Racing bots
    <select id="rbots">
      <option value="3" selected>On · 3 bots</option>
      <option value="5">On · 5 bots</option>
      <option value="0">Off · no bots</option>
    </select>
  </label>
  <label id="rauto-l">Touch driving
    <select id="rauto">
      <option value="1">Auto-accelerate</option>
      <option value="0">Gas + brake pedals</option>
    </select>
  </label>
  <label>Bot skill
    <select id="rdiff">
      <option value="0.86">Rookie (forgiving)</option>
      <option value="0.96" selected>Pro (realistic)</option>
      <option value="1.05">Legend (fast)</option>
    </select>
  </label>
</div>
<label>Online room code (2-player online race)<input id="cd3" maxlength="6" autocomplete="off"></label>
<div class="row">
  <button class="btn b" id="rsolo">Solo Race</button>
  <button class="btn o" id="rsplit">2P Split-Screen</button>
  <button class="btn" id="rgo">Online 2P Race!</button>
</div>
<p class="note" id="msg3"></p>
<ul class="rules">
  <li><b>Keyboard:</b> W/A/S/D or arrow keys · <b>Shift</b> = DRS boost · <b>R</b> = reset onto the track.</li><li><b>Touch:</b> ◀ ▶ on the left, BRAKE (and GAS) on the right, ⚡ boost, ↺ reset. With auto-accelerate on, you only steer and brake.</li><li><b>Corners:</b> arcade grip! The car sticks to the road, so you can take most bends flat out. Hold the steering hard through hairpins to power-slide, and tap the brake only for the tightest ones.</li>
  <li><b>Split-screen:</b> P1 uses W/A/S/D + Shift, P2 uses the arrow keys + <b>/</b> for boost.</li>
</ul>
<button class="btn m back" data-back>← All games</button></section>


<!-- GAME 3 STAGE: OVERDRIVE -->
<section id="rgame" hidden>
<div class="card rtop">
  <div class="rhud-grp">
    <span class="rpill">POS <b id="rpos">P1/4</b></span>
    <span class="rpill">LAP <b id="rlap-txt">1/3</b></span>
    <span class="rpill">TIME <b id="rtime">0:00.0</b></span>
    <span class="rpill">BEST <b id="rbest">--:--.-</b></span>
  </div>
  <div class="rhud-grp">
    <span class="rpill" id="rstatus-pill">DRS <b id="rdrs">100%</b></span>
    <button class="btn o sm" id="rcam-btn">🎥 Cam: Chase</button>
    <button class="btn b sm" id="rquit">Exit Race</button>
  </div>
</div>
<div id="rstage">
  <canvas id="rcv3"></canvas>
  <div id="rsplit-line" hidden></div>
  <canvas id="rmap" width="118" height="118"></canvas>
  <div id="rbrake-warn" hidden>⚠️ BRAKE FOR CORNER!</div>
  <div id="rspeed-box">
    <div><span id="rspeed">0</span> <small>km/h</small> <span id="rgear">G1</span></div>
    <div class="rpm-bar"><i id="rrpm"></i></div>
    <div id="rtire-txt" style="font-size:11px;color:#cbd5e1;margin-top:2px">TIRES: OPTIMAL GRIP</div>
  </div>
  <div id="rboostfx"></div>
  <div id="rcount"></div>
<div id="rpads" hidden></div>
<div id="rtip" hidden></div>
</div>
</section>
`);

/* =========================================================================
   GAME 3: OVERDRIVE — 3D RACING (fast low-poly renderer, batched scenery)
   ========================================================================= */
const CAR_GEO={
  f1:{body:[[2.62,0.14],[2.62,0.27],[1.4,0.5],[0.6,0.6],[0.25,0.6],[0.0,0.7],[-0.35,0.98],[-0.9,0.98],[-1.7,0.68],[-2.2,0.5],[-2.25,0.3],[-2.2,0.14]],cab:null,wh:[[1.55,0.35],[-1.55,0.4]],wing:[[-2.35,0.9,0.5,0.12],[2.2,0.1,0.5,0.08]]},
  gt3:{body:[[2.3,0.2],[2.4,0.42],[2.25,0.6],[1.7,0.7],[0.8,0.76],[-0.3,0.8],[-1.6,0.82],[-2.15,0.76],[-2.32,0.6],[-2.36,0.3],[-2.2,0.18]],cab:[[1.0,0.7],[0.15,1.2],[-0.7,1.22],[-1.9,0.84],[-1.9,0.7]],wh:[[1.42,0.37],[-1.38,0.38]],wing:[[-2.28,1.33,0.46,0.08]]},
  lmp:{body:[[2.5,0.16],[2.5,0.36],[2.05,0.7],[1.5,0.82],[0.95,0.68],[0.3,0.56],[-0.9,0.6],[-1.15,0.8],[-1.6,0.86],[-2.25,0.76],[-2.6,0.62],[-2.6,0.16]],cab:[[0.95,0.55],[0.35,0.98],[-0.6,1.0],[-1.2,0.62]],wh:[[1.5,0.36],[-1.45,0.37]],wing:[[-2.56,1.24,0.42,0.08]],fin:[[-0.8,0.98],[-2.4,1.32],[-2.4,0.66]]},
  wedge:{body:[[2.42,0.18],[2.46,0.36],[1.4,0.6],[0.7,0.72],[-0.6,0.76],[-2.0,0.8],[-2.38,0.76],[-2.42,0.3],[-2.25,0.16]],cab:[[0.85,0.7],[-0.15,1.06],[-0.95,1.06],[-2.0,0.79],[-2.0,0.7]],wh:[[1.45,0.37],[-1.42,0.4]],wing:[[-2.34,0.88,0.3,0.05]]},
  muscle:{body:[[2.42,0.28],[2.46,0.7],[2.3,0.77],[0.75,0.82],[0.6,0.84],[-1.55,0.86],[-2.4,0.84],[-2.46,0.7],[-2.44,0.3],[-2.2,0.24]],cab:[[0.65,0.8],[0.05,1.3],[-0.95,1.32],[-1.6,0.84],[-1.6,0.8]],wh:[[1.45,0.37],[-1.4,0.42]],wing:[[-2.42,0.9,0.26,0.05]]}
};
const CARS=[
  // the five cars from the art. maxV m/s · accel m/s² · brake m/s² · latG = cornering grip m/s² · eye = cockpit camera [height, forward]
  {id:'f1',model:'f1',liv:'inferno',n:'Inferno F1',sub:'Open-wheel formula racer',col:'#e61919',num:1,maxV:80,accel:14.5,brake:34,latG:30,eye:[1.0,0.1]},
  {id:'super',model:'super',liv:'voltage',n:'Voltage GT',sub:'Neon wedge supercar',col:'#0066ff',num:7,maxV:78,accel:16.5,brake:29,latG:25,eye:[1.18,-0.2]},
  {id:'specter',model:'specter',liv:'specter',n:'Specter GT',sub:'Track-day GT racer',col:'#39ff14',num:23,maxV:76,accel:15,brake:31,latG:27.5,eye:[1.22,-0.25]},
  {id:'sentinel',model:'sentinel',liv:'sentinel',n:'Sentinel V12',sub:'Armoured V12 hypercar',col:'#1fb4ff',num:12,maxV:84,accel:15.5,brake:27,latG:23,eye:[1.2,-0.2]},
  {id:'aero',model:'aero',liv:'aero',n:'Aero-Blade X',sub:'Tri-fin aero hypercar',col:'#ffb42a',num:88,maxV:82,accel:16,brake:28,latG:25.5,eye:[1.15,-0.2]},
  // extra colours for bots, so a full grid never shows two identical cars
  {id:'f1t',model:'f1',liv:'teal',n:'Inferno F1',col:'#0fb5a6',num:11,maxV:80,accel:14.5,brake:34,latG:30,eye:[1.0,0.1],bot:1},
  {id:'scv',model:'super',liv:'viper',n:'Voltage GT',col:'#7a2bff',num:22,maxV:78,accel:16.5,brake:29,latG:25,eye:[1.18,-0.2],bot:1},
  {id:'spb',model:'specter',liv:'blaze',n:'Specter GT',col:'#ff8a1f',num:33,maxV:76,accel:15,brake:31,latG:27.5,eye:[1.22,-0.25],bot:1},
  {id:'snc',model:'sentinel',liv:'crimson',n:'Sentinel V12',col:'#ff3b4f',num:44,maxV:84,accel:15.5,brake:27,latG:23,eye:[1.2,-0.2],bot:1},
  {id:'aef',model:'aero',liv:'frost',n:'Aero-Blade X',col:'#39d8ff',num:55,maxV:82,accel:16,brake:28,latG:25.5,eye:[1.15,-0.2],bot:1}
];
CARS.forEach(c=>{c.spd=Math.round(c.maxV*3.6);c.grip=Math.round(c.latG/30*100)});
const NCARS=CARS.filter(c=>!c.bot).length;
let rTouch=[{},{}],rAutoGas=TOUCH_UI;
try{if(localStorage.ovAuto!=null)rAutoGas=localStorage.ovAuto==='1'}catch(e){}
const TRACKS=[
  {id:'monaco',theme:'harbor',n:'Monaco Harbor',sub:'Street circuit · yachts & tunnel',sky:['#2a6fd1','#8fd3ff','#e6f7ff'],sun:'#fff6c2',fog:0xd2eefc,pts:[[0,0],[90,0],[165,35],[200,110],[155,185],[80,195],[25,145],[-35,175],[-115,165],[-165,95],[-135,20],[-65,-15]]},
  {id:'monza',theme:'park',n:'Monza Parkland',sub:'Fast straights · tree-lined park',sky:['#2f74d6','#a9e4ff','#f0fbff'],sun:'#fffbe0',fog:0xd8f1fc,pts:[[0,0],[140,0],[230,25],[245,95],[175,145],[45,140],[-45,175],[-175,165],[-225,95],[-170,15],[-80,-5]]},
  {id:'tokyo',theme:'night',n:'Neon Tokyo Bay',sub:'Night city · neon & street lights',sky:['#05020f','#1d0f45','#5a2380'],sun:'#ff3e8a',fog:0x2a1250,pts:[[0,0],[110,10],[185,-30],[220,45],[155,115],[195,185],[105,220],[15,155],[-65,200],[-155,145],[-145,45],[-75,-20]]},
  {id:'canyon',theme:'canyon',n:'Red Rock Canyon',sub:'Sunset mesas · desert sweepers',sky:['#3b1440','#e0603a','#ffc078'],sun:'#ffe9a8',fog:0xeaa06e,pts:[[0,0],[105,-20],[195,20],[215,115],[135,175],[55,135],[-25,195],[-125,175],[-195,100],[-155,15],[-70,-25]]}
];
const THEME={
  harbor:{asph:'#4b4e57',grass:'#4f9a45',kerb:['#e10600','#ffffff'],apron:'#aab0b8',wall:'street',fence:1,hemi:[0xe3f4ff,0x6b7a55,1.0],sunI:1.05,hills:[0x4f7f96,0x9cc3d6]},
  park:{asph:'#45474f',grass:'#47913d',kerb:['#e10600','#ffffff'],apron:'#a2a8ae',wall:'armco',hemi:[0xe8f6ff,0x5b7a45,1.0],sunI:1.1,hills:[0x3a7046,0x8db991]},
  night:{asph:'#2a2734',grass:'#1a1530',kerb:['#ff3e8a','#2fe3a0'],apron:'#2f2a4a',wall:'neon',fence:1,hemi:[0x9a8cff,0x1a0f30,0.95],sunI:0.55,hills:null},
  canyon:{asph:'#4f4643',grass:'#c27a48',kerb:['#ff8a1f','#fff3d1'],apron:'#caa27e',wall:'tyre',hemi:[0xffd8b8,0x7a3a1e,1.0],sunI:1.15,hills:[0x8e3a20,0xd77f50]}
};
const BOT_NAMES=['Blaze','Volt','Mochi','Gizmo','Turbo'];
let selCar=0,selTrack=0,selLaps=3,rMode='solo',rCamMode=0,rRaf=0,R3=null,G3=null,rKeys={},rCars=[],rTD=null,rStartAt=0,rState='idle',rSmoke=[],rLights=null,rDt=0.016,rBump=0,rFinished=false;
try{const b=localStorage.ovBots;if(b!=null)setTimeout(()=>{const s=$('#rbots');if(s)s.value=b},0)}catch(e){}

/* ---------- small 3D helpers ---------- */
const TX={};
function cvTex(key,w,h,draw,rep){
  if(TX[key])return TX[key];
  const cv=document.createElement('canvas');cv.width=w;cv.height=h;
  draw(cv.getContext('2d'),w,h);
  const t=new THREE.CanvasTexture(cv);
  if(rep)t.wrapS=t.wrapT=THREE.RepeatWrapping;
  t.anisotropy=8;
  return TX[key]=t;
}
function noisy(c,w,h,hex,amp){
  const [r,g,b]=rgb(hex),img=c.createImageData(w,h),d=img.data;
  for(let i=0;i<w*h;i++){const n=(Math.random()-.5)*amp;d[i*4]=r+n;d[i*4+1]=g+n;d[i*4+2]=b+n;d[i*4+3]=255}
  c.putImageData(img,0,0);
}
function mx(x,y,z,rx=0,ry=0,rz=0,sx=1,sy=1,sz=1){
  return new THREE.Matrix4().compose(new THREE.Vector3(x,y,z),new THREE.Quaternion().setFromEuler(new THREE.Euler(rx,ry,rz)),new THREE.Vector3(sx,sy,sz));
}
function mergeG(list){
  let n=0;list.forEach(g=>n+=g.attributes.position.count);
  const P=new Float32Array(n*3),Nn=new Float32Array(n*3),U=new Float32Array(n*2);let o=0;
  list.forEach(g=>{
    if(!g.attributes.normal)g.computeVertexNormals();
    const p=g.attributes.position,nr=g.attributes.normal,uv=g.attributes.uv;
    P.set(p.array.subarray(0,p.count*3),o*3);Nn.set(nr.array.subarray(0,p.count*3),o*3);
    if(uv)U.set(uv.array.subarray(0,p.count*2),o*2);
    o+=p.count;g.dispose();
  });
  const G=new THREE.BufferGeometry();
  G.setAttribute('position',new THREE.BufferAttribute(P,3));
  G.setAttribute('normal',new THREE.BufferAttribute(Nn,3));
  G.setAttribute('uv',new THREE.BufferAttribute(U,2));
  G.computeBoundingSphere();
  return G;
}
function mkBatch(){
  const L={};
  return{
    add(geo,key,m){const g=geo.index?geo.toNonIndexed():geo.clone();geo.dispose();if(m)g.applyMatrix4(m);(L[key]=L[key]||[]).push(g)},
    build(mats,parent){for(const k in L){if(!mats[k]||!L[k].length)continue;const m=new THREE.Mesh(mergeG(L[k]),mats[k]);m.matrixAutoUpdate=false;m.updateMatrix();parent.add(m)}}
  };
}
// Side-profile extrusion: profile in (z forward, y up), extruded across x
function ext(prof,width,o={}){
  const sh=new THREE.Shape();prof.forEach(([z,y],i)=>i?sh.lineTo(z,y):sh.moveTo(z,y));
  const b=o.b!=null?o.b:0.08;
  const g=new THREE.ExtrudeGeometry(sh,{depth:Math.max(0.01,width-2*b),bevelEnabled:b>0,bevelThickness:b,bevelSize:b,bevelOffset:-b,bevelSegments:o.bs||2,steps:1,curveSegments:4});
  g.translate(0,0,-(width-2*b)/2);
  g.rotateY(-Math.PI/2);
  if(o.tz||o.ty){const p=g.attributes.position;for(let i=0;i<p.count;i++){let s=1;if(o.tz)s*=o.tz(p.getZ(i));if(o.ty)s*=o.ty(p.getY(i));p.setX(i,p.getX(i)*s)}}
  g.computeVertexNormals();
  return g;
}
function archG(r,w){const g=new THREE.CylinderGeometry(r,r,w,12,1,false,0,Math.PI);g.rotateZ(Math.PI/2);return g}

let ENV_CUBE=null;
function envCube(){
  if(ENV_CUBE)return ENV_CUBE;
  const face=(top)=>{const cv=document.createElement('canvas');cv.width=cv.height=64;const c=cv.getContext('2d');
    if(top===1){c.fillStyle='#f4fbff';c.fillRect(0,0,64,64);c.fillStyle='#ffffff';c.fillRect(16,16,32,32)}
    else if(top===-1){c.fillStyle='#2a2638';c.fillRect(0,0,64,64)}
    else{const g=c.createLinearGradient(0,0,0,64);g.addColorStop(0,'#cfeaff');g.addColorStop(.45,'#ffffff');g.addColorStop(.52,'#6b6f86');g.addColorStop(1,'#25222f');c.fillStyle=g;c.fillRect(0,0,64,64);c.fillStyle='rgba(255,255,255,.9)';c.fillRect(6,14,52,6)}
    return cv};
  ENV_CUBE=new THREE.CubeTexture([face(0),face(0),face(1),face(-1),face(0),face(0)]);
  ENV_CUBE.needsUpdate=true;
  return ENV_CUBE;
}
function rimTex(col){return cvTex('rim'+col,128,128,(c)=>{
  c.fillStyle='#121216';c.fillRect(0,0,128,128);
  c.fillStyle='#1e1f26';c.beginPath();c.arc(64,64,63,0,7);c.fill();
  c.fillStyle='#303139';c.beginPath();c.arc(64,64,45,0,7);c.fill();
  c.fillStyle='#8b8f99';c.beginPath();c.arc(64,64,33,0,7);c.fill();
  c.fillStyle='#5a5e68';c.beginPath();c.arc(64,64,24,0,7);c.fill();
  c.strokeStyle=col;c.lineCap='round';c.lineWidth=10;
  for(let k=0;k<5;k++){const a=k*Math.PI*2/5;c.beginPath();c.moveTo(64,64);c.lineTo(64+Math.cos(a)*43,64+Math.sin(a)*43);c.stroke()}
  c.lineWidth=5;c.beginPath();c.arc(64,64,44,0,7);c.stroke();
  c.fillStyle=col;c.beginPath();c.arc(64,64,9,0,7);c.fill();
  c.fillStyle='rgba(255,255,255,.35)';c.beginPath();c.arc(58,58,3,0,7);c.fill();
})}
function numTex(n,col){return cvTex('num'+n+col,128,128,(c)=>{
  c.fillStyle='#ffffff';c.beginPath();c.arc(64,64,60,0,7);c.fill();
  c.lineWidth=7;c.strokeStyle=col;c.stroke();
  c.fillStyle='#14111f';c.font='bold 70px Impact,Arial Black,sans-serif';c.textAlign='center';c.textBaseline='middle';c.fillText(String(n),64,68);
})}
function blobTex(){return cvTex('blob',64,128,(c)=>{
  const g=c.createRadialGradient(32,64,4,32,64,32);g.addColorStop(0,'rgba(0,0,0,.75)');g.addColorStop(.6,'rgba(0,0,0,.4)');g.addColorStop(1,'rgba(0,0,0,0)');
  c.fillStyle=g;c.save();c.scale(1,2);c.fillRect(0,0,64,64);c.restore();
})}


/* ---------- distinct car models ---------- */
function carMats(s){
  const env=envCube();
  const ph=(col,o={})=>new THREE.MeshPhongMaterial(Object.assign({color:col,specular:0x777777,shininess:100,envMap:env,combine:THREE.MixOperation,reflectivity:0.16},o));
  return{
    body:ph(s.col),acc:ph(s.acc),
    trim:new THREE.MeshPhongMaterial({color:0x17181f,specular:0x333333,shininess:40}),
    glass:ph(0x0a1830,{specular:0xffffff,shininess:160,reflectivity:0.3}),
    chrome:ph(0xe5e7eb,{shininess:160,reflectivity:0.7}),
    light:new THREE.MeshBasicMaterial({color:0xfffbe8}),
    tail:new THREE.MeshBasicMaterial({color:0x660010}),
    num:new THREE.MeshLambertMaterial({map:numTex(s.num,s.col),transparent:true,alphaTest:0.4})
  };
}
function buildCar(idx){
  const s=CARS[(idx%CARS.length+CARS.length)%CARS.length];
  const root=OverdriveCars.build(s.model,{livery:s.liv,envMap:envCube()});
  root.rotation.order='YXZ';
  const u=root.userData;
  // soft blob shadow under the car
  const sh=new THREE.Mesh(new THREE.PlaneGeometry(2.6,5.6),new THREE.MeshBasicMaterial({map:blobTex(),transparent:true,depthWrite:false}));
  sh.rotation.x=-Math.PI/2;sh.position.y=0.06;sh.renderOrder=1;root.add(sh);
  return{root,body:u.body,wheels:u.wheels.map(w=>({st:w.steer,sp:w.spin,r:w.radius,front:w.front})),setBrake:u.setBrake,setBoost:u.setBoost};
}

/* ---------- showroom (menu) ---------- */
async function initGarage3D(){
  const tag=$('#rgarage-tag');
  if(!window.THREE){
    tag.textContent='Loading 3D showroom…';
    try{await need3D()}catch(e){tag.textContent='3D engine could not load — check your connection';return}
    if($('#rmenu').hidden)return;
  }
  const cv=$('#rgarage-cv');
  if(!G3){
    let r;
    try{r=new THREE.WebGLRenderer({canvas:cv,antialias:true,alpha:true,powerPreference:'high-performance'})}catch(e){tag.textContent='WebGL is not available on this device';return}
    r.setPixelRatio(Math.min(window.devicePixelRatio||1,2));
    const sc=new THREE.Scene();
    sc.add(new THREE.HemisphereLight(0xffffff,0x2a1d5c,1.0));
    const k=new THREE.DirectionalLight(0xffffff,1.0);k.position.set(5,8,6);sc.add(k);
    const rim=new THREE.DirectionalLight(0x7fd4ff,0.7);rim.position.set(-6,4,-5);sc.add(rim);
    const floorT=cvTex('gfloor',256,256,(c)=>{const g=c.createRadialGradient(128,128,10,128,128,128);g.addColorStop(0,'#3b2f86');g.addColorStop(.75,'#1b1440');g.addColorStop(1,'rgba(20,14,48,0)');c.fillStyle=g;c.fillRect(0,0,256,256);c.strokeStyle='rgba(127,212,255,.25)';c.lineWidth=2;for(let r=30;r<128;r+=22){c.beginPath();c.arc(128,128,r,0,7);c.stroke()}});
    const floor=new THREE.Mesh(new THREE.CircleGeometry(3.6,48),new THREE.MeshBasicMaterial({map:floorT,transparent:true}));floor.rotation.x=-Math.PI/2;sc.add(floor);
    const ring=new THREE.Mesh(new THREE.TorusGeometry(3.1,0.04,8,64),new THREE.MeshBasicMaterial({color:0x2fe3a0}));ring.rotation.x=Math.PI/2;ring.position.y=0.02;sc.add(ring);
    const cam=new THREE.PerspectiveCamera(32,2.5,0.1,60);cam.position.set(4.8,2.1,5.4);cam.lookAt(0,0.5,0);
    G3={r,sc,cam,car:null,w:0,h:0};
    const tickG=()=>{
      requestAnimationFrame(tickG);
      if($('#rmenu').hidden||!G3.car)return;
      const w=cv.clientWidth,h=cv.clientHeight;if(!w||!h)return;
      if(w!==G3.w||h!==G3.h){G3.w=w;G3.h=h;G3.r.setSize(w,h,false);G3.cam.aspect=w/h;G3.cam.updateProjectionMatrix()}
      G3.car.root.rotation.y+=0.012;
      G3.car.wheels.forEach(w=>w.sp.rotation.x+=0.05);
      G3.r.render(G3.sc,G3.cam);
    };
    tickG();
  }
  if(G3.car){G3.sc.remove(G3.car.root);disposeObj(G3.car.root)}
  G3.car=buildCar(selCar);G3.car.root.rotation.y=-0.6;
  G3.sc.add(G3.car.root);
  const c=CARS[selCar];
  tag.textContent=`#${c.num} ${c.n.toUpperCase()} · ${c.spd} KM/H`;
}
function disposeObj(o){o.traverse(x=>{if(x.geometry)x.geometry.dispose();if(x.material)[].concat(x.material).forEach(m=>m.dispose())})}

/* ---------- menu cards (pure SVG, no 3D needed) ---------- */
function carSvg(c){
  const L=OverdriveCars.LIVERIES[c.model][c.liv],K='stroke="#14111f" stroke-width="2.2" stroke-linejoin="round"';
  const wh=(x,y,r,ring)=>`<circle cx="${x}" cy="${y}" r="${r}" fill="#141414" ${K}/><circle cx="${x}" cy="${y}" r="${(r*0.62).toFixed(1)}" fill="#26262b" stroke="${ring}" stroke-width="2.2"/>`;
  const arches=`<path d="M27 42A15 15 0 0 1 57 42" fill="#121317"/><path d="M118 42A14 14 0 0 1 146 42" fill="#121317"/>`;
  let s='<svg viewBox="0 0 170 56" class="car-sil">';
  if(c.model==='f1'){
    s+=`<path d="M12 12H32V36H24L22 22H12Z" fill="${L.black}" ${K}/><path d="M30 14V34" stroke="#ff3a4a" stroke-width="2.4"/>`
     +`<path d="M24 42L30 34L60 30L66 20L76 18L80 27L98 29L120 33L122 43Z" fill="${L.body}" ${K}/>`
     +`<path d="M118 32L148 37L165 40V43L120 44Z" fill="${L.nose1}" ${K}/><path d="M140 36L165 40V43L140 43Z" fill="${L.nose2}"/>`
     +`<path d="M138 46H168V49H138Z" fill="${L.nose2}" ${K}/><path d="M160 38V50" stroke="#14111f" stroke-width="3"/>`
     +`<circle cx="86" cy="24" r="6.5" fill="${L.helmet}" ${K}/><path d="M86 22H93V26H87Z" fill="#111"/>`
     +`<path d="M78 21Q90 13 100 27" fill="none" stroke="${L.halo}" stroke-width="3" stroke-linecap="round"/>`
     +`<path d="M64 38H106" stroke="${L.nose2}" stroke-width="2.4"/>`+wh(40,40,12,L.glow)+wh(130,42,10,L.glow);
  }else if(c.model==='super'){
    s+=`<path d="M8 40L10 27L36 22L60 14L92 12L122 23L158 29L166 35L163 44H10Z" fill="${L.body}" ${K}/>`
     +`<path d="M66 16L90 14.5L112 24.5L66 25Z" fill="${L.glass}" ${K}/><path d="M60 15L92 13" stroke="${L.stripe}" stroke-width="2.4"/>`
     +`<path d="M126 26L160 31" stroke="${L.stripe}" stroke-width="2.4"/><path d="M146 30.5L160 32.5" stroke="${L.head}" stroke-width="3" stroke-linecap="round"/>`
     +`<path d="M60 31L118 35" stroke="${L.stripe}" stroke-width="2.4"/><path d="M54 30L72 27V38H58Z" fill="#121317"/>`
     +`<path d="M58 45H112" stroke="${L.stripe}" stroke-width="2.4"/><path d="M6 21H30V24H8Z" fill="${L.body}" ${K}/>`
     +arches+wh(42,42,11,L.ring)+wh(132,42,10.5,L.ring);
  }else if(c.model==='specter'){
    s+=`<path d="M8 41L9 26L32 22L58 13L92 12L120 22L156 28L165 34L162 44H10Z" fill="${L.body}" ${K}/>`
     +`<path d="M120 22L156 28L161 32L121 27Z" fill="${L.paint2}"/><path d="M64 15L90 14L112 23.5L64 24Z" fill="${L.glass}" ${K}/>`
     +`<path d="M4 9H40V13H4Z" fill="${L.body}" ${K}/><path d="M4 9H40" stroke="${L.paint2}" stroke-width="2.4"/><path d="M22 13L26 22M33 13L36 21" stroke="#14111f" stroke-width="2.6"/>`
     +`<path d="M68 30L74 38M76 30L82 38M84 30L90 38" stroke="${L.accent}" stroke-width="2.2"/><path d="M10 30H24V40H10Z" fill="${L.paint2}"/>`
     +`<path d="M146 31L160 33" stroke="${L.accent}" stroke-width="3" stroke-linecap="round"/><path d="M150 46H168" stroke="${L.accent}" stroke-width="2.2"/>`
     +arches+wh(42,42,11,L.accent)+wh(132,42,10.5,L.accent);
  }else if(c.model==='sentinel'){
    s+=`<path d="M8 40L9 27L34 21L60 13L94 12L124 22L160 29L166 36L163 44H10Z" fill="${L.body}" ${K}/>`
     +`<path d="M66 15L92 14L114 23.5L66 24Z" fill="${L.glass}" ${K}/><path d="M74 10H90V13H74Z" fill="${L.body}" ${K}/>`
     +`<path d="M10 27L34 21L60 13L94 12L124 22L160 29" fill="none" stroke="${L.neon}" stroke-width="2"/>`
     +`<path d="M60 30L72 28H112L118 33" fill="none" stroke="${L.neon}" stroke-width="2"/><path d="M60 46H112" stroke="${L.neon}" stroke-width="2"/>`
     +`<path d="M25 42A17 17 0 0 1 59 42M116 42A16 16 0 0 1 148 42" fill="none" stroke="${L.neon}" stroke-width="2.2"/>`
     +`<path d="M146 30.5L161 32.5" stroke="#dff6ff" stroke-width="3" stroke-linecap="round"/>`
     +arches+wh(42,42,11.5,L.neon)+wh(132,42,11,L.neon);
  }else{
    s+=`<path d="M22 27L31 6L37 7L35 27Z" fill="${L.body}" ${K}/><path d="M31 6L37 7" stroke="${L.trim}" stroke-width="2.4"/>`
     +`<path d="M8 40L10 30L36 24L60 14L90 13L118 24L158 30L166 37L162 44H10Z" fill="${L.body}" ${K}/>`
     +`<path d="M64 16L88 15L114 25L66 26Z" fill="${L.glass}" ${K}/><path d="M60 30L76 27H108L118 34L104 38H66Z" fill="${L.panel}"/>`
     +`<path d="M60 30L76 27H108L118 34" fill="none" stroke="${L.trim}" stroke-width="2"/><path d="M120 25L158 31" stroke="${L.trim}" stroke-width="2"/>`
     +`<circle cx="152" cy="33" r="2.2" fill="${L.lamp}"/><circle cx="158" cy="34" r="2.2" fill="${L.lamp}"/><path d="M140 46H164" stroke="${L.trim}" stroke-width="2.2"/>`
     +arches+wh(42,42,11,L.trim)+wh(132,42,10.5,L.trim);
  }
  return s+'</svg>';
}
function trackPath2D(pts,steps=8){
  const out=[],n=pts.length;
  for(let i=0;i<n;i++){
    const p0=pts[(i-1+n)%n],p1=pts[i],p2=pts[(i+1)%n],p3=pts[(i+2)%n];
    for(let k=0;k<steps;k++){const t=k/steps,t2=t*t,t3=t2*t;
      out.push([0,1].map(j=>0.5*((2*p1[j])+(-p0[j]+p2[j])*t+(2*p0[j]-5*p1[j]+4*p2[j]-p3[j])*t2+(-p0[j]+3*p1[j]-3*p2[j]+p3[j])*t3)))}
  }
  return out;
}
function trackSvg(t){
  const p=trackPath2D(t.pts);let a=1e9,b=1e9,A=-1e9,B=-1e9;p.forEach(([x,z])=>{a=Math.min(a,x);b=Math.min(b,z);A=Math.max(A,x);B=Math.max(B,z)});
  const s=Math.min(110/(A-a),50/(B-b)),ox=(130-(A-a)*s)/2,oy=(62-(B-b)*s)/2;
  const d='M'+p.map(([x,z])=>((x-a)*s+ox).toFixed(1)+' '+((z-b)*s+oy).toFixed(1)).join('L')+'Z';
  const bg={harbor:['#1c5fa8','#7fd8ff'],park:['#1f6b35','#7fd08a'],night:['#0b0620','#4a1d7a'],canyon:['#7a2d1a','#ffad6b']}[t.theme];
  const st=p[0],sx=((st[0]-a)*s+ox).toFixed(1),sy=((st[1]-b)*s+oy).toFixed(1);
  return `<svg viewBox="0 0 130 62" class="trk-sil"><defs><linearGradient id="tg${t.id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${bg[0]}"/><stop offset="1" stop-color="${bg[1]}"/></linearGradient></defs><rect width="130" height="62" rx="8" fill="url(#tg${t.id})"/><path d="${d}" fill="none" stroke="#14111f" stroke-width="7" stroke-linejoin="round"/><path d="${d}" fill="none" stroke="#fff" stroke-width="3.5" stroke-linejoin="round"/><path d="${d}" fill="none" stroke="${THEME[t.theme].kerb[0]}" stroke-width="1.2" stroke-dasharray="3 5"/><circle cx="${sx}" cy="${sy}" r="4" fill="#ffe14d" stroke="#14111f" stroke-width="2"/></svg>`;
}
function renderRaceMenu(){
  $('#rcars').innerHTML=CARS.filter(c=>!c.bot).map((c,i)=>`<button class="car-card ${i==selCar?'on':''}" data-ci="${i}">
    ${carSvg(c)}<b>${c.n}</b><span class="cc-sub">${c.sub}</span>
    <div class="car-stats">${[['SPEED',(c.maxV-70)/16],['ACCEL',(c.accel-13)/4],['GRIP',(c.latG-21)/10]].map(([k,f])=>`<span>${k}</span><div class="car-bar"><i style="width:${Math.round(20+80*Math.max(0,Math.min(1,f)))}%;background:${c.col}"></i></div>`).join('')}</div>
  </button>`).join('');
  $('#rtracks').innerHTML=TRACKS.map((t,i)=>`<button class="trk-card ${i==selTrack?'on':''}" data-ti="${i}">${trackSvg(t)}<b>${t.n}</b><span class="cc-sub">${t.sub}</span></button>`).join('');
  $('#rcars').onclick=e=>{const b=e.target.closest('.car-card');if(!b)return;selCar=+b.dataset.ci;renderRaceMenu();initGarage3D();SFX.sel()};
  $('#rtracks').onclick=e=>{const b=e.target.closest('.trk-card');if(!b)return;selTrack=+b.dataset.ti;renderRaceMenu();SFX.sel()};
}
renderRaceMenu();
$('#rauto').value=rAutoGas?'1':'0';$('#rauto-l').hidden=!TOUCH_UI;$('#rauto').onchange=()=>{rAutoGas=$('#rauto').value==='1';try{localStorage.ovAuto=rAutoGas?'1':'0'}catch(e){}};
$('#rbots').onchange=()=>{const v=$('#rbots').value;$('#rdiff').disabled=v==='0';try{localStorage.ovBots=v}catch(e){}};

/* ---------- track textures ---------- */
function texAsphalt(TH,night){return cvTex('asph'+TH.asph,256,256,(c,w,h)=>{
  noisy(c,w,h,TH.asph,22);
  c.fillStyle='rgba(0,0,0,.13)';c.fillRect(w*0.2,0,w*0.16,h);c.fillRect(w*0.64,0,w*0.16,h);
  c.fillStyle='rgba(255,255,255,.05)';for(let k=0;k<5;k++)c.fillRect(Math.random()*w,Math.random()*h,20+Math.random()*50,10+Math.random()*40);
  c.fillStyle=night?'#e6e2ff':'#f2f2f2';c.fillRect(5,0,7,h);c.fillRect(w-12,0,7,h);
},true)}
function texKerb(a,b){return cvTex('kerb'+a+b,64,64,(c,w,h)=>{
  c.fillStyle=a;c.fillRect(0,0,w,h/2);c.fillStyle=b;c.fillRect(0,h/2,w,h/2);
  const g=c.createLinearGradient(0,0,w,0);g.addColorStop(0,'rgba(0,0,0,.25)');g.addColorStop(.3,'rgba(0,0,0,0)');g.addColorStop(1,'rgba(255,255,255,.12)');c.fillStyle=g;c.fillRect(0,0,w,h);
},true)}
function texGround(TH,theme){return cvTex('gnd'+theme,256,256,(c,w,h)=>{
  noisy(c,w,h,TH.grass,theme==='night'?10:26);
  if(theme==='night'){c.strokeStyle='rgba(120,90,255,.18)';c.lineWidth=2;c.strokeRect(1,1,w-2,h-2)}
  else if(theme==='canyon'){c.fillStyle='rgba(255,220,180,.10)';for(let k=0;k<14;k++)c.fillRect(0,Math.random()*h,w,2+Math.random()*4)}
  else{c.fillStyle='rgba(255,255,255,.07)';c.fillRect(0,0,w/2,h);c.fillStyle='rgba(0,40,0,.06)';c.fillRect(w/2,0,w/2,h)}
},true)}
function texGravel(theme){return cvTex('grav'+theme,128,128,(c,w,h)=>{noisy(c,w,h,theme==='canyon'?'#e3b07c':theme==='night'?'#3a3450':'#d9c49c',46)},true)}
function texSolid(hex,amp=14){return cvTex('sol'+hex,64,64,(c,w,h)=>noisy(c,w,h,hex,amp),true)}
function texWall(kind){return cvTex('wall'+kind,128,32,(c,w,h)=>{
  if(kind==='armco'){noisy(c,w,h,'#9aa4b0',18);c.fillStyle='#c9d1db';c.fillRect(0,4,w,8);c.fillRect(0,16,w,8);c.fillStyle='rgba(0,0,0,.35)';c.fillRect(0,12,w,2);c.fillRect(0,24,w,2);c.fillStyle='#55606e';c.fillRect(0,26,w,6);c.fillRect(60,0,6,h)}
  else if(kind==='street'){for(let k=0;k<4;k++){c.fillStyle=k%2?'#ffffff':'#e10600';c.fillRect(k*32,0,32,h)}c.fillStyle='rgba(0,0,0,.18)';c.fillRect(0,h-4,w,4)}
  else if(kind==='neon'){noisy(c,w,h,'#231d3c',14);c.fillStyle='#ff3e8a';c.fillRect(0,0,w,3);c.fillStyle='rgba(47,227,160,.7)';c.fillRect(0,h-3,w,3)}
  else{c.fillStyle='#111';c.fillRect(0,0,w,h);for(let y=0;y<2;y++)for(let x=0;x<8;x++){c.fillStyle='#24242a';c.beginPath();c.arc(8+x*16,8+y*16,7,0,7);c.fill();c.fillStyle='#0a0a0c';c.beginPath();c.arc(8+x*16,8+y*16,3,0,7);c.fill()}c.fillStyle='#e10600';c.fillRect(0,13,w,6);c.fillStyle='#fff';for(let x=0;x<w;x+=32)c.fillRect(x,13,16,6)}
},true)}
function texFence(){return cvTex('fence',64,64,(c,w,h)=>{c.clearRect(0,0,w,h);c.strokeStyle='rgba(200,206,214,.9)';c.lineWidth=2;for(let k=-64;k<128;k+=12){c.beginPath();c.moveTo(k,0);c.lineTo(k+64,64);c.stroke();c.beginPath();c.moveTo(k+64,0);c.lineTo(k,64);c.stroke()}c.fillStyle='#6b7280';c.fillRect(0,0,w,3);c.fillRect(30,0,4,h)},true)}
function texCrowd(){return cvTex('crowd',256,128,(c,w,h)=>{c.fillStyle='#2a2f3d';c.fillRect(0,0,w,h);const cols=['#ff3e8a','#ffe14d','#2fe3a0','#2d7bff','#ffffff','#ff8a1f','#e10600','#b45cff','#f1c27d'];for(let y=4;y<h;y+=8){c.fillStyle='#3d4456';c.fillRect(0,y+5,w,2);for(let x=2;x<w;x+=5){if(Math.random()<0.85){c.fillStyle=cols[Math.random()*cols.length|0];c.fillRect(x,y,3,4);c.fillStyle='#f1c27d';c.fillRect(x+0.5,y-2,2,2)}}}},true)}
const ADS=[['CHECKPOINT!!','#ff3e8a','#fff'],['OVERDRIVE','#14111f','#ffe14d'],['NITRO X','#2d7bff','#fff'],['APEX OIL','#ffe14d','#14111f'],['TURBO COLA','#e10600','#fff'],['PIXEL TYRES','#2fe3a0','#14111f'],['GRID FM 99.1','#8a5cff','#fff'],['HYPER FUEL','#ff8a1f','#14111f']];
function texAds(){return cvTex('ads',512,512,(c,w)=>{ADS.forEach(([t,bg,fg],i)=>{const y=i*64;c.fillStyle=bg;c.fillRect(0,y,w,64);c.fillStyle=fg;c.fillRect(0,y,w,4);c.fillRect(0,y+60,w,4);c.font='bold 40px Impact,Arial Black,sans-serif';c.textAlign='center';c.textBaseline='middle';c.fillText(t,w/2,y+34);c.globalAlpha=.25;c.fillText('★',30,y+34);c.fillText('★',w-30,y+34);c.globalAlpha=1})})}
function adUV(g,row,rep=1){const uv=g.attributes.uv;for(let i=0;i<uv.count;i++){uv.setX(i,uv.getX(i)*rep);uv.setY(i,1-(row+1)/8+uv.getY(i)/8*0.98+0.001)}return g}
function texChevron(){return cvTex('chev',128,64,(c,w,h)=>{c.fillStyle='#e10600';c.fillRect(0,0,w,h);c.fillStyle='#fff';for(let k=0;k<3;k++){const x=14+k*38;c.beginPath();c.moveTo(x,8);c.lineTo(x+22,32);c.lineTo(x,56);c.lineTo(x+12,56);c.lineTo(x+34,32);c.lineTo(x+12,8);c.fill()}c.strokeStyle='#14111f';c.lineWidth=4;c.strokeRect(2,2,w-4,h-4)})}
function texChecker(){return cvTex('checker',64,16,(c)=>{for(let x=0;x<8;x++)for(let y=0;y<2;y++){c.fillStyle=(x+y)%2?'#14111f':'#ffffff';c.fillRect(x*8,y*8,8,8)}},true)}
function texBuild(night){return cvTex('bld'+night,128,128,(c,w,h)=>{
  noisy(c,w,h,night?'#191428':'#d9d4c7',night?8:16);
  for(let y=0;y<4;y++)for(let x=0;x<4;x++){
    let col=night?(Math.random()<0.55?['#ffd27a','#7fe8ff','#ff8fd0','#fff4d6'][Math.random()*4|0]:'#2a2340'):(Math.random()<0.15?'#a7c6e6':'#3f5e86');
    c.fillStyle=col;c.fillRect(6+x*32,8+y*32,20,18);
    if(!night){c.fillStyle='rgba(255,255,255,.3)';c.fillRect(6+x*32,8+y*32,20,4)}
  }
  c.fillStyle=night?'#191428':'#d9d4c7';c.fillRect(0,0,4,4);
},true)}
function texGarage(){return cvTex('garage',256,64,(c,w,h)=>{c.fillStyle='#e8ebef';c.fillRect(0,0,w,h);for(let k=0;k<2;k++){c.fillStyle='#2a2f3d';c.fillRect(14+k*128,14,100,50);c.fillStyle='#3d4456';for(let y=18;y<64;y+=7)c.fillRect(14+k*128,y,100,2);c.fillStyle=k?'#ff3e8a':'#2d7bff';c.fillRect(14+k*128,6,100,6)}},true)}
function texWater(){return cvTex('water',128,128,(c,w,h)=>{noisy(c,w,h,'#1f6fae',14);c.strokeStyle='rgba(255,255,255,.18)';c.lineWidth=2;for(let k=0;k<22;k++){const x=Math.random()*w,y=Math.random()*h;c.beginPath();c.moveTo(x,y);c.quadraticCurveTo(x+6,y-3,x+14,y);c.stroke()}},true)}
function texPool(){return cvTex('pool',64,64,(c)=>{const g=c.createRadialGradient(32,32,2,32,32,32);g.addColorStop(0,'rgba(255,214,140,.55)');g.addColorStop(.5,'rgba(255,170,90,.2)');g.addColorStop(1,'rgba(0,0,0,0)');c.fillStyle=g;c.fillRect(0,0,64,64)})}
function texSky(T){return cvTex('sky'+T.id,1024,512,(c,w,h)=>{
  const[a,b,hz]=T.sky,g=c.createLinearGradient(0,0,0,h);g.addColorStop(0,a);g.addColorStop(0.4,b);g.addColorStop(0.5,hz);g.addColorStop(1,hz);c.fillStyle=g;c.fillRect(0,0,w,h);
  if(T.theme==='night'){
    const mg=c.createRadialGradient(w*.7,h*.22,6,w*.7,h*.22,70);mg.addColorStop(0,'rgba(240,235,255,.9)');mg.addColorStop(.3,'rgba(160,140,255,.25)');mg.addColorStop(1,'rgba(0,0,0,0)');c.fillStyle=mg;c.fillRect(0,0,w,h);
    c.fillStyle='#f4f0ff';c.beginPath();c.arc(w*.7,h*.22,13,0,7);c.fill();
    const hg=c.createLinearGradient(0,h*.38,0,h*.5);hg.addColorStop(0,'rgba(255,62,138,0)');hg.addColorStop(1,'rgba(255,62,138,.35)');c.fillStyle=hg;c.fillRect(0,h*.38,w,h*.12);
  }else{
    const sx=w*.28,sy=h*.36,sg=c.createRadialGradient(sx,sy,2,sx,sy,90);sg.addColorStop(0,'rgba(255,255,255,1)');sg.addColorStop(.12,T.sun);sg.addColorStop(1,'rgba(255,255,255,0)');c.fillStyle=sg;c.fillRect(0,0,w,h);
    const cc=T.theme==='canyon'?'255,214,180':'255,255,255';
    for(let k=0;k<34;k++){const x=Math.random()*w,y=h*(0.12+Math.random()*0.3),s=14+Math.random()*30;c.fillStyle=`rgba(${cc},${0.35+Math.random()*0.35})`;for(let j=0;j<5;j++){c.beginPath();c.ellipse(x+j*s*0.7,y+Math.sin(j*2)*3,s*(1.1-Math.abs(j-2)*0.18),s*0.45,0,0,7);c.fill()}}
  }
})}

/* ---------- track + environment builder ---------- */
function buildTrackScene(sc,T){
  const TH=THEME[T.theme],theme=T.theme,night=theme==='night';
  const SC=1.65,hw=10,KW=1.6,WD=hw+12;
  const curve=new THREE.CatmullRomCurve3(T.pts.map(([x,z])=>new THREE.Vector3(x*SC,0,z*SC)),true,'centripetal');
  const len=curve.getLength(),N=Math.round(len/3.2),sp=len/N,S=[];
  for(let i=0;i<N;i++){const u=i/N,p=curve.getPointAt(u),t=curve.getTangentAt(u).setY(0).normalize();S.push({p,tan:t,nrm:new THREE.Vector3(-t.z,0,t.x),d:i*sp,curv:0,turn:1,rad:1e4,kerb:0,grav:0})}
  const k=Math.max(2,Math.round(14/sp));
  for(let i=0;i<N;i++){const a=S[(i-k+N)%N].tan,b=S[(i+k)%N].tan,ang=a.angleTo(b);S[i].curv=ang;S[i].turn=b.dot(S[i].nrm)>=0?1:-1;S[i].rad=(2*k*sp)/Math.max(ang,1e-3)}
  for(let i=0;i<N;i++){
    for(let j=-3;j<=3;j++){const q=S[(i+j+N)%N];if(q.curv>0.17)S[i].kerb=1}
    for(let j=-5;j<=5;j++){const q=S[(i+j+N)%N];if(q.curv>0.28&&!S[i].grav)S[i].grav=-q.turn}
  }
  const off=(i,o)=>{const s=S[i];if(o!==0&&Math.sign(o)===s.turn&&s.curv>0.04)return Math.sign(o)*Math.min(Math.abs(o),Math.max(hw+KW+0.4,s.rad*0.82));return o};
  const wallAt=(i,sd)=>Math.abs(off(i,sd*WD));
  const pt=(s,o)=>[s.p.x+s.nrm.x*o,s.p.z+s.nrm.z*o];
  // generic ribbon (horizontal when y0==y1, vertical when o0==o1)
  function ribbon(o0,o1,y0,y1,mat,opt={}){
    const P=[],U=[],vs=opt.v||8,ur=opt.u||1,f=opt.f;
    for(let i=0;i<N;i++){
      if(f&&!f(i))continue;
      const j=(i+1)%N,a=S[i],b=S[j];
      const A0=pt(a,off(i,o0)),A1=pt(a,off(i,o1)),B0=pt(b,off(j,o0)),B1=pt(b,off(j,o1));
      const va=a.d/vs,vb=(j===0?len:b.d)/vs;
      let q=[[A0[0],y0,A0[1],0,va],[A1[0],y1,A1[1],ur,va],[B0[0],y0,B0[1],0,vb],[A1[0],y1,A1[1],ur,va],[B1[0],y1,B1[1],ur,vb],[B0[0],y0,B0[1],0,vb]];
      if(y0===y1){const ux=q[1][0]-q[0][0],uz=q[1][2]-q[0][2],wx=q[2][0]-q[0][0],wz=q[2][2]-q[0][2];if(uz*wx-ux*wz<0)q=[q[0],q[2],q[1],q[3],q[5],q[4]]}
      q.forEach(v=>{P.push(v[0],v[1],v[2]);U.push(v[3],v[4])});
    }
    if(!P.length)return null;
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(P,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(U,2));g.computeVertexNormals();
    const m=new THREE.Mesh(g,mat);m.matrixAutoUpdate=false;m.updateMatrix();if(opt.ro)m.renderOrder=opt.ro;sc.add(m);return m;
  }
  const lam=(o)=>new THREE.MeshLambertMaterial(o);
  const po=(m,f)=>{m.polygonOffset=true;m.polygonOffsetFactor=f;m.polygonOffsetUnits=f;return m};

  // sky, fog, light
  const skyCol=new THREE.Color(T.fog);
  sc.background=skyCol;
  sc.fog=new THREE.Fog(T.fog,night?160:220,night?1100:1500);
  const sky=new THREE.Mesh(new THREE.SphereGeometry(2000,32,16),new THREE.MeshBasicMaterial({map:texSky(T),side:THREE.BackSide,fog:false,depthWrite:false}));
  sky.renderOrder=-1;sky.position.set((T.pts.reduce((a,p)=>a+p[0],0)/T.pts.length)*1.65,0,(T.pts.reduce((a,p)=>a+p[1],0)/T.pts.length)*1.65);sc.add(sky);
  if(night){const sp2=[];for(let q=0;q<900;q++){const a=Math.random()*Math.PI*2,e=0.08+Math.random()*1.4;sp2.push(Math.cos(a)*Math.cos(e)*1900,Math.sin(e)*1900,Math.sin(a)*Math.cos(e)*1900)}
    const sg=new THREE.BufferGeometry();sg.setAttribute('position',new THREE.Float32BufferAttribute(sp2,3));
    const st=new THREE.Points(sg,new THREE.PointsMaterial({color:0xffffff,size:1.6,sizeAttenuation:false,fog:false,transparent:true,opacity:0.85,depthWrite:false}));st.renderOrder=-1;sc.add(st)}
  sc.add(new THREE.HemisphereLight(TH.hemi[0],TH.hemi[1],TH.hemi[2]));
  const dl=new THREE.DirectionalLight(night?0xa0b4ff:new THREE.Color(T.sun),TH.sunI);
  dl.position.set(night?60:50,night?120:110,night?-180:260);sc.add(dl);

  // bounds
  let mnx=1e9,mnz=1e9,mxx=-1e9,mxz=-1e9;S.forEach(s=>{mnx=Math.min(mnx,s.p.x);mnz=Math.min(mnz,s.p.z);mxx=Math.max(mxx,s.p.x);mxz=Math.max(mxz,s.p.z)});
  const cx=(mnx+mxx)/2,cz=(mnz+mxz)/2;
  const distTrack=(x,z)=>{let b=1e9;for(let i=0;i<N;i+=2){const dx=x-S[i].p.x,dz=z-S[i].p.z,d=dx*dx+dz*dz;if(d<b)b=d}return Math.sqrt(b)};
  const clear=(x,z,r)=>distTrack(x,z)>WD+3+r;
  const R=rng(T.id.length*7919+11);
  const rnd=(a,b)=>a+R()*(b-a);

  // ground (+ water for harbor)
  const gT=texGround(TH,theme);
  if(theme==='harbor'){
    const lw=(mxx-mnx)+240,ld=(mxz-mnz)+240;
    const gt=gT.clone();gt.needsUpdate=true;gt.repeat.set(lw/24,ld/24);
    const land=new THREE.Mesh(new THREE.PlaneGeometry(lw,ld),po(lam({map:gt}),2));land.rotation.x=-Math.PI/2;land.position.set(cx,0,cz);sc.add(land);
    const wt=texWater();wt.repeat.set(160,160);
    const water=new THREE.Mesh(new THREE.PlaneGeometry(5000,5000),new THREE.MeshPhongMaterial({map:wt,color:0x9fd6ff,shininess:90,specular:0x99ccff}));water.rotation.x=-Math.PI/2;water.position.set(cx,-0.9,cz);sc.add(water);
    const qB=mkBatch(),qm=texSolid('#b8b2a6');
    [[0,ld/2,lw,1],[0,-ld/2,lw,1],[lw/2,0,1,ld],[-lw/2,0,1,ld]].forEach(([x,z,w,d])=>qB.add(new THREE.BoxGeometry(w+1,1.4,d+1),'q',mx(cx+x,-0.5,cz+z)));
    qB.build({q:lam({map:qm})},sc);
    T._land={x0:cx-lw/2+20,x1:cx+lw/2-20,z0:cz-ld/2+20,z1:cz+ld/2-20};
  }else{
    const gt=gT.clone();gt.needsUpdate=true;gt.repeat.set(5000/24,5000/24);
    const g=new THREE.Mesh(new THREE.PlaneGeometry(5000,5000),po(lam({map:gt}),2));g.rotation.x=-Math.PI/2;g.position.set(cx,0,cz);sc.add(g);
  }

  // road surfaces
  const asph=texAsphalt(TH,night);
  ribbon(-hw,hw,0.02,0.02,lam({map:asph}),{v:16});
  const kerbT=texKerb(TH.kerb[0],TH.kerb[1]);
  ribbon(hw,hw+KW,0.045,0.045,lam({map:kerbT}),{v:6,f:i=>S[i].kerb});
  ribbon(-hw,-hw-KW,0.045,0.045,lam({map:kerbT}),{v:6,f:i=>S[i].kerb});
  const apron=lam({map:texSolid(TH.apron,18)});
  ribbon(hw,hw+1.4,0.035,0.035,apron,{v:6,f:i=>!S[i].kerb});
  ribbon(-hw,-hw-1.4,0.035,0.035,apron,{v:6,f:i=>!S[i].kerb});
  const gravM=lam({map:texGravel(theme)});
  ribbon(hw+KW,WD-0.6,0.03,0.03,gravM,{v:10,u:3,f:i=>S[i].grav===1});
  ribbon(-hw-KW,-(WD-0.6),0.03,0.03,gravM,{v:10,u:3,f:i=>S[i].grav===-1});
  // start line
  const chk=texChecker();chk.repeat.set(10,1);
  ribbon(-hw,hw,0.05,0.05,po(lam({map:chk}),-1),{v:sp,f:i=>i===0});

  // walls / barriers
  const wallM=lam({map:texWall(TH.wall),side:THREE.DoubleSide});
  ribbon(WD,WD,0,1.15,wallM,{v:8});ribbon(-WD,-WD,0,1.15,wallM,{v:8});
  if(TH.fence){const fm=lam({map:texFence(),transparent:true,alphaTest:0.4,side:THREE.DoubleSide});ribbon(WD+0.3,WD+0.3,1.15,4.4,fm,{v:3.2});ribbon(-WD-0.3,-WD-0.3,1.15,4.4,fm,{v:3.2})}
  if(night){
    ribbon(WD-0.06,WD-0.06,0.95,1.2,new THREE.MeshBasicMaterial({color:0xff3e8a,side:THREE.DoubleSide}));
    ribbon(-WD+0.06,-WD+0.06,0.95,1.2,new THREE.MeshBasicMaterial({color:0x2fe3a0,side:THREE.DoubleSide}));
  }

  // tunnel (harbor)
  let tun=null;
  if(theme==='harbor'){
    const t0=Math.round(N*0.5),tl=Math.round(95/sp);tun=[t0,t0+tl];
    const inT=i=>i>=t0&&i<t0+tl;
    const conc=lam({map:texSolid('#8f8a83',16),side:THREE.DoubleSide});
    ribbon(-WD-0.6,WD+0.6,8.6,8.6,conc,{f:inT});
    ribbon(WD,WD,1.15,8.6,conc,{f:inT});ribbon(-WD,-WD,1.15,8.6,conc,{f:inT});
    ribbon(-WD,WD,0.08,0.08,new THREE.MeshBasicMaterial({color:0x000000,transparent:true,opacity:0.42,depthWrite:false}),{f:inT,ro:2});
    const tb=mkBatch();
    for(let i=t0;i<t0+tl;i+=2){const s=S[i],ry=Math.atan2(s.tan.x,s.tan.z);tb.add(new THREE.BoxGeometry(5,0.15,1.2),'l',mx(s.p.x,8.45,s.p.z,0,ry))}
    [t0,t0+tl].forEach(i=>{const s=S[i%N],ry=Math.atan2(s.tan.x,s.tan.z);tb.add(new THREE.BoxGeometry(2*WD+8,4,2),'c',mx(s.p.x,10.5,s.p.z,0,ry));
      [-1,1].forEach(sd=>{const[x,z]=pt(s,sd*(WD+3));tb.add(new THREE.BoxGeometry(6,12,2),'c',mx(x,6,z,0,ry))})});
    tb.build({l:new THREE.MeshBasicMaterial({color:0xfff2c8}),c:lam({map:texSolid('#cfc8bb',14)})},sc);
  }
  const inTun=i=>tun&&i>=tun[0]-6&&i<tun[1]+6;

  // static scenery batch
  const SB=mkBatch();
  const adT=texAds();
  const place=(i,sd,dist)=>{const s=S[i],[x,z]=pt(s,sd*dist);const d=s.nrm.clone().multiplyScalar(-sd);return{x,z,ry:Math.atan2(d.x,d.z)}};
  const W4=(x,z,ry)=>mx(x,0,z,0,ry);
  const at=(Wm,geo,key,local)=>SB.add(geo,key,local?Wm.clone().multiply(local):Wm);
  // grid slots
  for(let g=0;g<7;g++){const i=(N-2-g*2+N)%N,s=S[i],sd=g%2?1:-1,[x,z]=pt(s,sd*3.6),ry=Math.atan2(s.tan.x,s.tan.z);
    SB.add(new THREE.PlaneGeometry(3,0.3),'white',new THREE.Matrix4().makeTranslation(x,0.05,z).multiply(new THREE.Matrix4().makeRotationY(ry)).multiply(new THREE.Matrix4().makeRotationX(-Math.PI/2)));
  }
  // grandstand builder
  const grand=(i,sd,dist,L)=>{const{x,z,ry}=place(i,sd,dist);if(!clear(x+Math.sin(ry)*-6,z+Math.cos(ry)*-6,2))return;const Wm=W4(x,z,ry);
    const cr=new THREE.PlaneGeometry(L,10);const uv=cr.attributes.uv;for(let q=0;q<uv.count;q++)uv.setX(q,uv.getX(q)*L/16);
    at(Wm,cr,'crowd',mx(0,5.6,-2.9,-0.62));
    at(Wm,new THREE.BoxGeometry(L,1.5,0.4),'struct',mx(0,0.75,0.1));
    at(Wm,new THREE.BoxGeometry(L,9.6,0.5),'struct',mx(0,4.8,-6.3));
    [-1,1].forEach(e=>{at(Wm,new THREE.BoxGeometry(0.5,9.6,6.6),'struct',mx(e*L/2,4.8,-3));at(Wm,new THREE.BoxGeometry(0.4,11,0.4),'struct',mx(e*(L/2-0.3),5.5,1.2))});
    at(Wm,new THREE.BoxGeometry(L+2,0.4,9),'roof',mx(0,11.2,-2.4,0.08));
    at(Wm,adUV(new THREE.PlaneGeometry(L,1.3),0,Math.max(1,Math.round(L/14))),'ads',mx(0,10.3,1.45));
  };
  // which side has more room for the pit complex
  let turnSum=0;S.forEach(s=>turnSum+=s.turn*s.curv);const outSd=turnSum>0?-1:1;
  // pit building
  {const{x,z,ry}=place(0,outSd,WD+16);
   if(clear(x+Math.sin(ry)*-8,z+Math.cos(ry)*-8,4)){const Wm=W4(x,z,ry),PL=90;
     at(Wm,new THREE.BoxGeometry(PL,7,12),'struct',mx(0,3.5,-6));
     const fa=new THREE.PlaneGeometry(PL,6);const uv=fa.attributes.uv;for(let q=0;q<uv.count;q++)uv.setX(q,uv.getX(q)*PL/24);
     at(Wm,fa,'garage',mx(0,3,0.02));
     at(Wm,new THREE.BoxGeometry(PL+1,0.7,13),'roof',mx(0,7.3,-6));
     at(Wm,adUV(new THREE.PlaneGeometry(PL,1.4),0,6),'ads',mx(0,6.4,0.04));
     ribbon(outSd*(WD+0.3),outSd*(WD+9.5),0.025,0.025,lam({map:asph}),{v:16,f:i=>i<Math.round(48/sp)||i>N-Math.round(48/sp)});
   }}
  grand(0,-outSd,WD+4,70);
  // corner grandstands at the two sharpest corners
  const peaks=[];for(let i=0;i<N;i++){const c=S[i].curv;if(c>0.35&&c>=S[(i-1+N)%N].curv&&c>=S[(i+1)%N].curv)peaks.push(i)}
  peaks.sort((a,b)=>S[b].curv-S[a].curv);
  const used=[];
  peaks.forEach(i=>{if(used.length>=3||used.some(u=>Math.min(Math.abs(u-i),N-Math.abs(u-i))<N*0.12)||Math.min(i,N-i)<N*0.08||inTun(i))return;used.push(i);grand(i,-S[i].turn,WD+4,40)});
  // chevron boards at corners
  const chev=texChevron();
  peaks.forEach(i=>{if(inTun(i))return;const sd=-S[i].turn;for(let j=-4;j<=4;j+=4){const q=(i+j+N)%N,{x,z,ry}=place(q,sd,wallAt(q,sd)+0.5);
    const g=new THREE.PlaneGeometry(3.2,1.6);if(sd===1){const uv=g.attributes.uv;for(let t=0;t<uv.count;t++)uv.setX(t,1-uv.getX(t))}
    SB.add(g,'chev',mx(x,1.9,z,0,ry));SB.add(new THREE.BoxGeometry(0.15,1.2,0.15),'struct',mx(x,0.6,z))}});
  // billboards along straights
  for(let i=6;i<N;i+=Math.round(42/sp)){
    if(S[i].curv>0.2||inTun(i)||i<Math.round(60/sp)||i>N-Math.round(60/sp))continue;
    const sd=(i/Math.round(42/sp)|0)%2?1:-1,{x,z,ry}=place(i,sd,wallAt(i,sd)+1.4);
    if(!clear(x,z,-2.5))continue;
    SB.add(adUV(new THREE.PlaneGeometry(12,2.2),R()*8|0),'ads',mx(x,2.4,z,0,ry));
    SB.add(new THREE.BoxGeometry(12.2,2.4,0.3),'struct',mx(x-Math.sin(ry)*0.2,2.4,z-Math.cos(ry)*0.2,0,ry));
    [-5,5].forEach(e=>SB.add(new THREE.BoxGeometry(0.25,1.4,0.25),'struct',mx(x+Math.cos(ry)*e,0.7,z-Math.sin(ry)*e)));
  }
  // overhead bridges (+ start gantry)
  const bridge=(i,row)=>{const s=S[i],ry=Math.atan2(s.tan.x,s.tan.z),wl=wallAt(i,-1),wr=wallAt(i,1),Wm=mx(s.p.x,0,s.p.z,0,ry);
    const span=wl+wr+4,cxo=(wl-wr)/2; // local x = -nrm
    [-(wr+1.5),wl+1.5].forEach(e=>at(Wm,new THREE.BoxGeometry(1.2,9.6,1.2),'struct',mx(e,4.8,0)));
    at(Wm,new THREE.BoxGeometry(span,1.8,1.2),'beam',mx(cxo,8.9,0));
    at(Wm,adUV(new THREE.PlaneGeometry(span-1,1.4),row,Math.max(1,Math.round(span/16))),'ads',mx(cxo,8.9,0.62));
    at(Wm,adUV(new THREE.PlaneGeometry(span-1,1.4),row,Math.max(1,Math.round(span/16))),'ads',mx(cxo,8.9,-0.62,0,Math.PI));
    return{Wm,ry,s};
  };
  const gan=bridge(0,1);
  [0.3,0.68].forEach((f,j)=>{let i=Math.round(N*f);for(let t=0;t<30&&(S[i].curv>0.12||inTun(i));t++)i=(i+2)%N;if(!inTun(i))bridge(i,j?4:2)});
  // start lights (5 pods facing the grid)
  rLights=[];
  {const lb=new THREE.Group();lb.applyMatrix4(gan.Wm);sc.add(lb);
    const hous=new THREE.MeshLambertMaterial({color:0x14111f});
    for(let q=0;q<5;q++){const h=new THREE.Mesh(new THREE.BoxGeometry(1.1,1.9,0.5),hous);h.position.set((q-2)*1.5,6.9,-0.9);lb.add(h);
      const m=new THREE.MeshBasicMaterial({color:0x2a0608});rLights.push(m);
      [7.35,6.5].forEach(y=>{const b=new THREE.Mesh(new THREE.SphereGeometry(0.34,10,8),m);b.position.set((q-2)*1.5,y,-1.18);lb.add(b)})}}

  // themed scenery
  const lx=T._land;
  const scatter=(n,minR,maxR,cl,fn)=>{let made=0,tries=0;while(made<n&&tries<n*6){tries++;const x=rnd(mnx-maxR,mxx+maxR),z=rnd(mnz-maxR,mxz+maxR);
      if(lx&&(x<lx.x0||x>lx.x1||z<lx.z0||z>lx.z1))continue;
      if(!clear(x,z,cl))continue;fn(x,z,made++)}};
  const dummy=new THREE.Object3D(),col=new THREE.Color();
  const inst=(geo,mat,list,colors)=>{if(!list.length)return;const m=new THREE.InstancedMesh(geo,mat,list.length);list.forEach((t,q)=>{dummy.position.set(t[0],t[1],t[2]);dummy.rotation.set(0,t[3]||0,0);dummy.scale.set(t[4]||1,t[5]||t[4]||1,t[6]||t[4]||1);dummy.updateMatrix();m.setMatrixAt(q,dummy.matrix);if(colors)m.setColorAt(q,col.set(colors[q]))});m.instanceMatrix.needsUpdate=true;if(m.instanceColor)m.instanceColor.needsUpdate=true;sc.add(m)};
  const buildings=(n,minR,maxR,hmin,hmax,cl)=>{const bt=texBuild(night),BB=mkBatch();
    scatter(n,minR,maxR,cl,(x,z)=>{const w=rnd(10,24),d=rnd(10,24),h=rnd(hmin,hmax)*(1+Math.hypot(x-cx,z-cz)/900);const g=new THREE.BoxGeometry(w,h,d).toNonIndexed();const uv=g.attributes.uv;
      for(let f=0;f<6;f++){const fw=f<2?d:w,fh=f===2||f===3?0:h;for(let q=0;q<6;q++){const id=f*6+q;if(fh===0){uv.setXY(id,0.01,0.01)}else uv.setXY(id,uv.getX(id)*fw/8,uv.getY(id)*fh/8)}}
      BB.add(g,'b',mx(x,h/2,z,0,R()*0.6))});
    BB.build({b:night?new THREE.MeshBasicMaterial({map:bt}):lam({map:bt})},sc)};
  if(theme==='park'||theme==='harbor'){
    const trunks=[],crowns=[],cones=[],cc=[],kc=[];
    const n=theme==='park'?420:160;
    scatter(n,0,theme==='park'?320:100,3,(x,z,q)=>{const s=rnd(0.8,1.5);
      if(theme==='harbor'){trunks.push([x,0,z,0,s,s*2.6,s]);crowns.push([x,9.2*s,z,R()*3,s*1.1,s*0.35,s*1.1]);cc.push(R()<.5?'#3fa34d':'#2f8f43')}
      else{trunks.push([x,0,z,0,s]);if(R()<0.45){cones.push([x,0,z,R()*3,s]);kc.push(R()<.5?'#2c6e3a':'#245c31')}else{crowns.push([x,0,z,R()*3,s]);cc.push(['#3f8f3a','#4fa244','#357a33','#6aa84f'][R()*4|0])}}});
    const tg=new THREE.CylinderGeometry(0.28,0.42,3.4,5);tg.translate(0,1.7,0);
    inst(tg,lam({color:0x6b4428}),trunks);
    if(theme==='harbor'){const pg=new THREE.OctahedronGeometry(3.2,0);inst(pg,lam({color:0xffffff}),crowns,cc)}
    else{const rg=new THREE.IcosahedronGeometry(2.8,0);rg.translate(0,5.4,0);inst(rg,lam({color:0xffffff}),crowns,cc);
      const cg=new THREE.ConeGeometry(2.6,8,7);cg.translate(0,6.5,0);inst(cg,lam({color:0xffffff}),cones,kc)}
    if(theme==='harbor'){buildings(70,0,100,10,34,10);
      // yachts
      const hulls=[],cabs=[];for(let q=0;q<26;q++){const side=q%4,t=R();let x,z;const m=60;
        if(side===0){x=lx.x0-20+t*(lx.x1-lx.x0+40);z=lx.z0-m+R()*30}else if(side===1){x=lx.x0-20+t*(lx.x1-lx.x0+40);z=lx.z1+m-R()*30}else if(side===2){x=lx.x0-m+R()*30;z=lx.z0+t*(lx.z1-lx.z0)}else{x=lx.x1+m-R()*30;z=lx.z0+t*(lx.z1-lx.z0)}
        const ry=R()*Math.PI*2,s=rnd(0.8,1.6);hulls.push([x,-0.6,z,ry,s]);cabs.push([x,-0.6,z,ry,s])}
      const hg=new THREE.BoxGeometry(4.5,1.6,14,1,1,2);const hp=hg.attributes.position;for(let q=0;q<hp.count;q++){if(hp.getZ(q)>3)hp.setX(q,hp.getX(q)*0.25);if(hp.getY(q)<0)hp.setX(q,hp.getX(q)*0.7)}hg.computeVertexNormals();hg.translate(0,0.8,0);
      inst(hg,lam({color:0xf8fafc}),hulls);
      const cgm=new THREE.BoxGeometry(3.2,1.5,5.5);cgm.translate(0,2.3,-1.5);inst(cgm,lam({color:0x1e3a5f}),cabs);
    }
  }
  if(theme==='night'){
    buildings(170,0,420,18,70,8);
    // street lamps + light pools
    const poles=[],bulbs=[],pools=[];
    for(let i=0;i<N;i+=6){const sd=(i/6|0)%2?1:-1,w=wallAt(i,sd),{x,z,ry}=place(i,sd,w+1.2);poles.push([x,0,z,ry]);
      const[bx,bz]=pt(S[i],sd*(w-9));bulbs.push([bx,8.8,bz,ry]);pools.push([bx,0.07,bz,0])}
    const pg=mergeG([(()=>{const g=new THREE.CylinderGeometry(0.16,0.22,9,5).toNonIndexed();g.translate(0,4.5,0);return g})(),(()=>{const g=new THREE.BoxGeometry(0.22,0.22,10.5).toNonIndexed();g.translate(0,8.95,5.1);return g})()]);
    inst(pg,lam({color:0x3a3550}),poles);
    inst(new THREE.BoxGeometry(1.4,0.3,0.7),new THREE.MeshBasicMaterial({color:0xffe2a8}),bulbs);
    const pm=new THREE.MeshBasicMaterial({map:texPool(),transparent:true,blending:THREE.AdditiveBlending,depthWrite:false});
    const plg=new THREE.PlaneGeometry(22,22);plg.rotateX(-Math.PI/2);
    const pmesh=new THREE.InstancedMesh(plg,pm,pools.length);pools.forEach((t,q)=>{dummy.position.set(t[0],t[1],t[2]);dummy.rotation.set(0,0,0);dummy.scale.set(1,1,1);dummy.updateMatrix();pmesh.setMatrixAt(q,dummy.matrix)});pmesh.renderOrder=3;sc.add(pmesh);
    // neon arches
    const nm=[new THREE.MeshBasicMaterial({color:0xff3e8a}),new THREE.MeshBasicMaterial({color:0x2fe3a0}),new THREE.MeshBasicMaterial({color:0x7fd4ff})];
    for(let q=1;q<6;q++){const i=Math.round(N*q/6);if(S[i].curv>0.25)continue;const s=S[i],ry=Math.atan2(s.tan.x,s.tan.z);const a=new THREE.Mesh(new THREE.TorusGeometry(WD+1,0.35,6,28,Math.PI),nm[q%3]);a.position.copy(s.p);a.rotation.set(0,ry+Math.PI/2,0);sc.add(a)}
  }
  if(theme==='canyon'){
    const mg=new THREE.CylinderGeometry(1,1.3,1,7,4);const mp=mg.attributes.position,mc=[];
    for(let q=0;q<mp.count;q++){const y=mp.getY(q)+0.5,b=Math.floor(y*4)%2;mc.push(b?0.86:0.72,b?0.4:0.3,b?0.24:0.18);if(y>0.99)mp.setX(q,mp.getX(q)*(0.9+Math.random()*0.15))}
    mg.setAttribute('color',new THREE.Float32BufferAttribute(mc,3));mg.translate(0,0.5,0);mg.computeVertexNormals();
    const mes=[];
    scatter(26,0,380,40,(x,z)=>mes.push([x,0,z,R()*3,rnd(22,48),rnd(26,70),rnd(22,48)]));
    for(let q=0;q<28;q++){const a=q/28*Math.PI*2,r=rnd(750,1100);mes.push([cx+Math.cos(a)*r,0,cz+Math.sin(a)*r,R()*3,rnd(60,130),rnd(70,170),rnd(60,130)])}
    inst(mg,lam({vertexColors:true}),mes);
    const cact=[],rocks=[],rc=[];
    scatter(160,0,220,2,(x,z)=>{if(R()<0.55)cact.push([x,0,z,R()*3,rnd(0.7,1.4)]);else{rocks.push([x,0,z,R()*3,rnd(0.6,2.2),rnd(0.5,1.4),rnd(0.6,2)]);rc.push(R()<.5?'#a8532c':'#c76b3c')}});
    const cg=mergeG([(()=>{const g=new THREE.CylinderGeometry(0.45,0.55,5,7).toNonIndexed();g.translate(0,2.5,0);return g})(),(()=>{const g=new THREE.CylinderGeometry(0.3,0.3,1.6,6).toNonIndexed();g.rotateZ(Math.PI/2);g.translate(0.9,2.2,0);return g})(),(()=>{const g=new THREE.CylinderGeometry(0.3,0.3,1.8,6).toNonIndexed();g.translate(1.5,3,0);return g})(),(()=>{const g=new THREE.CylinderGeometry(0.28,0.28,1.4,6).toNonIndexed();g.translate(-0.9,3.2,0);return g})()]);
    inst(cg,lam({color:0x3f8f4a}),cact);
    inst(new THREE.DodecahedronGeometry(1.6,0),lam({color:0xffffff}),rocks,rc);
  }
  // distant hills ring
  if(TH.hills){
    const M2=96,P=[],C=[],c0=new THREE.Color(TH.hills[0]),c1=new THREE.Color(TH.hills[1]),Rr=1350;
    const hgt=a=>60+40*Math.sin(a*3+1)+28*Math.sin(a*7+2)+14*Math.sin(a*17);
    for(let q=0;q<M2;q++){const a0=q/M2*Math.PI*2,a1=(q+1)/M2*Math.PI*2,h0=hgt(a0)*(theme==='canyon'?1.6:1),h1=hgt(a1)*(theme==='canyon'?1.6:1);
      const p=(a,r,y)=>[cx+Math.cos(a)*r,y,cz+Math.sin(a)*r];
      const v=[p(a0,Rr,-5),p(a0,Rr,h0),p(a1,Rr,-5),p(a0,Rr,h0),p(a1,Rr,h1),p(a1,Rr,-5)],cl=[c0,c1,c0,c1,c1,c0];
      v.forEach((x,j)=>{P.push(...x);C.push(cl[j].r,cl[j].g,cl[j].b)})}
    const hg=new THREE.BufferGeometry();hg.setAttribute('position',new THREE.Float32BufferAttribute(P,3));hg.setAttribute('color',new THREE.Float32BufferAttribute(C,3));hg.computeVertexNormals();
    sc.add(new THREE.Mesh(hg,new THREE.MeshBasicMaterial({vertexColors:true,side:THREE.DoubleSide})));
  }
  // build the merged scenery
  const roofCol={harbor:0xffffff,park:0xe10600,night:0x8a5cff,canyon:0xff8a1f}[theme];
  SB.build({
    white:po(new THREE.MeshBasicMaterial({color:0xffffff}),-1),
    crowd:lam({map:texCrowd()}),
    struct:lam({color:night?0x3a3550:0xd4d8de}),
    roof:lam({color:roofCol}),
    ads:night?new THREE.MeshBasicMaterial({map:adT}):lam({map:adT,emissive:0x222222}),
    beam:lam({color:night?0x221b3d:0x2a2f3d}),
    garage:lam({map:texGarage()}),
    chev:lam({map:chev})
  },sc);

  // minimap path
  let a=1e9,b=1e9,A=-1e9,B=-1e9;S.forEach(s=>{a=Math.min(a,s.p.x);b=Math.min(b,s.p.z);A=Math.max(A,s.p.x);B=Math.max(B,s.p.z)});
  const ms=Math.min(100/(A-a),100/(B-b)),mox=(118-(A-a)*ms)/2,moz=(118-(B-b)*ms)/2;
  const mapXY=(x,z)=>[(x-a)*ms+mox,(z-b)*ms+moz];
  return{T,S,N,len,sp,hw,KW,WD,wallAt,mapXY};
}

/* ---------- race renderer ---------- */
function initRace3D(){
  if(R3)return true;
  const cv=$('#rcv3');
  let r;
  try{r=new THREE.WebGLRenderer({canvas:cv,antialias:true,powerPreference:'high-performance'})}catch(e){err('WebGL is not available on this device.');return false}
  r.setPixelRatio(Math.min(window.devicePixelRatio||1,1.75));
  const cam1=new THREE.PerspectiveCamera(60,1.6,0.5,4200),cam2=new THREE.PerspectiveCamera(60,1.6,0.5,4200);
  R3={r,sc:null,cam1,cam2,w:0,h:0};
  return true;
}
function fitRace(){
  const cv=$('#rcv3'),w=cv.clientWidth,h=cv.clientHeight;
  if(w&&h&&(w!==R3.w||h!==R3.h)){R3.w=w;R3.h=h;R3.r.setSize(w,h,false)}
  return[R3.w||800,R3.h||420];
}
function locate(c){
  const S=rTD.S,N=rTD.N;let bi=c.ti,bd=1e9;
  for(let k=-14;k<=14;k++){const i=(c.ti+k+N)%N,p=S[i].p,dx=c.x-p.x,dz=c.z-p.z,d=dx*dx+dz*dz;if(d<bd){bd=d;bi=i}}
  if(bd>45*45)for(let i=0;i<N;i++){const p=S[i].p,dx=c.x-p.x,dz=c.z-p.z,d=dx*dx+dz*dz;if(d<bd){bd=d;bi=i}}
  let dI=bi-c.ti;if(dI>N/2)dI-=N;if(dI<-N/2)dI+=N;
  c.dist+=dI;c.ti=bi;
  const s=S[bi];c.lat=(c.x-s.p.x)*s.nrm.x+(c.z-s.p.z)*s.nrm.z;
  return s;
}

const SMOKE_POOL=[];
function spawnSmoke(x,z,col){
  if(!R3||!R3.sc)return;
  let p=SMOKE_POOL.find(q=>!q.on);
  if(!p){if(SMOKE_POOL.length>=40)return;const m=new THREE.Mesh(R3.smokeG||(R3.smokeG=new THREE.IcosahedronGeometry(0.45,0)),new THREE.MeshBasicMaterial({color:col,transparent:true,opacity:0.5,depthWrite:false}));p={m,on:false,age:0};SMOKE_POOL.push(p)}
  if(p.m.parent!==R3.sc)R3.sc.add(p.m);
  p.on=true;p.age=0;p.m.visible=true;p.m.material.color.setHex(col);p.m.position.set(x+(Math.random()-.5),0.35,z+(Math.random()-.5));p.m.scale.setScalar(1);
}

/* ---------- driving model (arcade, Need-for-Speed style) ----------
   Fixed 120 Hz physics step so the car behaves the same at 30 or 144 fps.
   The car turns at a set rate that only eases off a little at top speed, so it
   always goes where you point it. Steering never costs speed; only brakes,
   walls and grass slow you down. Holding the brake while turning tightens the
   line. With no steering input the car gently lines itself up with the road.
   Tweak OVT to change the feel. */
const OVT={
  turnLow:2.7,      // rad/s turn rate at low speed
  turnTop:1.3,      // rad/s turn rate at top speed (scaled per car by its grip)
  brakeTurn:1.35,   // turn-rate multiplier while braking
  steerIn:6,        // how fast steering reaches full lock (per second)
  steerOut:10,      // how fast it centres again
  accel:1.3,        // acceleration multiplier
  boostTop:1.22,    // top-speed multiplier while boosting
  boostAcc:2.0,     // acceleration multiplier while boosting
  grassTop:0.78,gravelTop:0.6,
  assist:3          // how strongly the car lines up with the road when you let go
};
const RPH=1/120,clampN=(v,a,b)=>v<a?a:v>b?b:v;
function trackState(c,s){
  const T=rTD,a=Math.abs(c.lat),sd=c.lat>=0?1:-1;
  const onKerb=a>T.hw&&a<=T.hw+T.KW&&!!s.kerb,off=a>T.hw+(s.kerb?T.KW:1.4),gravel=off&&s.grav===sd;
  return{onKerb,off,gravel};
}
// turn rate available at speed v (rad/s)
function turnMax(sp,v){const top=OVT.turnTop*Math.pow(sp.latG/25.5,0.8);const t=clampN(Math.abs(v)/sp.maxV,0,1.25);return OVT.turnLow+(top-OVT.turnLow)*Math.min(1,t)}
// fastest speed that can still follow a corner of radius R
function cornerV(sp,R){let v=sp.maxV;for(let i=0;i<4;i++)v=Math.min(sp.maxV*1.3,turnMax(sp,v)*R);return v}
function stepCar(c,dt,thr,brk,steerIn,boost){
  const sp=c.spec,T=rTD,s=locate(c),{onKerb,off,gravel}=trackState(c,s);
  const boosting=!!(boost&&c.drs>3&&thr>0);
  const top=sp.maxV*(boosting?OVT.boostTop:1)*(off?(gravel?OVT.gravelTop:OVT.grassTop):1);
  c.drs=boosting?Math.max(0,c.drs-26*dt):Math.min(100,c.drs+(brk>0?14:8)*dt);
  // longitudinal: punchy acceleration that fades near top speed, strong brakes
  if(thr>0&&c.v<top){const r=Math.max(0,c.v)/top;c.v+=sp.accel*OVT.accel*thr*(1-r*r*r)*(boosting?OVT.boostAcc:1)*dt}
  if(brk>0){if(c.v>0.5)c.v=Math.max(0,c.v-sp.brake*brk*dt);else c.v=Math.max(-14,c.v-10*brk*dt)}
  else if(thr<=0){const d=(1.5+0.04*Math.abs(c.v))*dt;c.v-=Math.sign(c.v)*Math.min(Math.abs(c.v),d)}
  if(off)c.v-=c.v*(gravel?0.5:0.2)*dt;
  if(c.v>top)c.v=Math.max(top,c.v-(off?14:6)*dt);
  // steering: quick to lock, quicker to centre
  const growing=Math.abs(steerIn)>Math.abs(c.steer)&&steerIn*c.steer>=0;
  c.steer+=clampN(steerIn-c.steer,-(growing?OVT.steerIn:OVT.steerOut)*dt,(growing?OVT.steerIn:OVT.steerOut)*dt);
  const av=Math.abs(c.v);
  let rate=turnMax(sp,av)*(brk>0&&c.v>8?OVT.brakeTurn:1)*(off?(gravel?0.75:0.9):1);
  rate*=Math.min(1,av/3);
  c.yaw+=c.steer*rate*(c.v>=0?1:-1)*dt;
  c.turnUse=Math.abs(c.steer)*Math.min(1,av/(sp.maxV*0.55));
  const scrub=c.turnUse>0.8&&av>30&&!off;
  // stability assist: with no steering input, line up with the track
  if(!off&&Math.abs(steerIn)<0.05&&av>5){let ty=Math.atan2(s.tan.x,s.tan.z);const d=angW(ty-c.yaw);if(Math.abs(d)<0.5)c.yaw+=clampN(d*OVT.assist,-0.6,0.6)*dt}
  c.x+=Math.sin(c.yaw)*c.v*dt;c.z+=Math.cos(c.yaw)*c.v*dt;
  // barriers: glance off and keep most of your speed
  const lat=(c.x-s.p.x)*s.nrm.x+(c.z-s.p.z)*s.nrm.z,lsd=lat>=0?1:-1,wl=T.wallAt(c.ti,lsd)-1.15;
  let hit=false;
  if(Math.abs(lat)>wl){
    const push=lsd*wl-lat;c.x+=s.nrm.x*push;c.z+=s.nrm.z*push;
    let ty=Math.atan2(s.tan.x,s.tan.z);if(Math.abs(angW(ty-c.yaw))>Math.PI/2)ty+=Math.PI;
    const d=angW(ty-c.yaw);c.yaw+=d*Math.min(1,10*dt);
    c.v*=1-Math.min(0.25,Math.abs(Math.sin(d))*0.3)*Math.min(1,dt*12)-0.12*dt;
    hit=true;
  }
  // lap counting
  const N=T.N;
  if(c.dist>=(c.ld+1)*N&&!c.done){
    const now=performance.now(),lt=(now-c.lapStart)/1000;
    if(!c.bestLap||lt<c.bestLap)c.bestLap=lt;
    c.lapStart=now;c.ld++;
    if(c.isP1){SFX.ding();if(c.ld<selLaps)flashMsg(`LAP ${c.ld+1}/${selLaps}${c.ld===selLaps-1?' · FINAL LAP!':''}`)}
    if(c.ld>=selLaps){c.done=true;c.finishTime=(now-rStartAt)/1000;if(c.isP1||c.isP2)finishRace(c)}
  }
  c.progress=c.dist/N;
  const f=c.fx||(c.fx={});
  f.onKerb=onKerb;f.off=off;f.gravel=gravel;f.boosting=boosting;f.scrub=scrub;f.brk=brk;f.thr=thr;f.hit=f.hit||hit;
}
// Highest speed that still makes the corners ahead, allowing for braking distance.
function safeSpeed(c,use,brakeUse,widen=1.25){
  const T=rTD,N=T.N,sp=c.spec;let v=sp.maxV*1.3;
  const ahead=Math.round((30+c.v*c.v/(2*sp.brake*brakeUse))/T.sp);
  for(let k=2;k<ahead;k+=2){const q=T.S[(c.ti+k)%N];if(q.rad>600)continue;const vc=cornerV(sp,q.rad*widen)*use;const va=Math.sqrt(vc*vc+2*sp.brake*brakeUse*k*T.sp);if(va<v)v=va}
  return v;
}
// Once per rendered frame: move meshes, effects, HUD text.
function carVisual(c,dt){
  const m=c.mesh,t=performance.now(),f=c.fx||{},sr=Math.min(1.3,Math.abs(c.v)/c.spec.maxV);
  m.root.position.set(c.x,f.onKerb?0.04*Math.sin(t*0.07):0,c.z);
  m.root.rotation.y=c.yaw;
  c.pitch+=((f.brk>0&&c.v>5?0.022:f.thr>0?-0.012:0)*Math.min(1,sr*1.5)-c.pitch)*Math.min(1,6*dt);
  c.slide=(c.slide||0)+((f.off?0:c.steer*Math.min(1,sr*1.4)*(f.brk>0?0.2:0.13))-(c.slide||0))*Math.min(1,5*dt);
  m.body.rotation.set(c.pitch,c.slide,-c.steer*sr*0.07);
  m.setBrake(f.brk>0);
  m.setBoost(f.boosting);
  m.wheels.forEach(w=>{w.sp.rotation.x+=c.v*dt/w.r;if(w.front)w.st.rotation.y=c.steer*0.42});
  if((f.scrub||(f.brk>0&&c.v>38)||(f.off&&c.v>14))&&Math.random()<0.35)spawnSmoke(c.x-Math.sin(c.yaw)*1.8,c.z-Math.cos(c.yaw)*1.8,f.off?(f.gravel?0xd9b98a:0x8fae6a):0xe2e8f0);
  if(c.isP2)padDrs(1,c.drs);
  if(c.isP1){
    if(f.hit&&t-rBump>350){rBump=t;sfx(120,.12,'sawtooth',.5)}
    const s=rTD.S[c.ti],wrong=c.v>6&&(Math.sin(c.yaw)*s.tan.x+Math.cos(c.yaw)*s.tan.z)<-0.3;
    const bw=$('#rbrake-warn');
    if(wrong){bw.hidden=false;bw.textContent='⛔ WRONG WAY!'}
    else if(c.v>safeSpeed(c,1.05,0.85,1.1)+5){bw.hidden=false;bw.textContent='⚠️ BRAKE FOR CORNER!'}
    else bw.hidden=true;
    $('#rtire-txt').textContent=f.off?(f.gravel?'⚠️ GRAVEL TRAP — LOW GRIP':'⚠️ OFF TRACK — GRASS'):f.boosting?'🚀 DRS BOOST ENGAGED!':f.scrub?'💨 POWER SLIDE!':f.onKerb?'⚡ KERB RUMBLE':'TIRES: OPTIMAL GRIP';
    engineSet(Math.abs(c.v)/c.spec.maxV,f.thr,f.boosting);
    if(rMode!=='split')$('#rboostfx').classList.toggle('on',!!f.boosting);
    padDrs(0,c.drs);
  }
  f.hit=false;
}
function stepAI(c,dt){
  const T=rTD,N=T.N;
  locate(c);
  const look=Math.round((9+Math.abs(c.v)*0.38)/T.sp),s=T.S[(c.ti+look)%N];
  let maxC=0,turn=0;const ahead=Math.round((22+c.v*1.4)/T.sp);
  for(let k=3;k<ahead;k+=2){const q=T.S[(c.ti+k)%N];if(q.curv>maxC){maxC=q.curv;turn=q.turn}}
  const lane=maxC>0.2?turn*T.hw*0.45:c.lane;
  c.curLane+=(lane-c.curLane)*Math.min(1,dt*1.2);
  const tx=s.p.x+s.nrm.x*c.curLane,tz=s.p.z+s.nrm.z*c.curLane;
  const d=angW(Math.atan2(tx-c.x,tz-c.z)-c.yaw);
  const vT=Math.min(c.spec.maxV*Math.pow(c.pace,1.2),safeSpeed(c,Math.min(1,0.9*Math.pow(c.pace,2)),0.75));
  const thr=c.v<vT-0.5?1:0,brk=c.v>vT+2?Math.min(1,(c.v-vT)/6):0;
  stepCar(c,dt,thr,brk,clampN(d*3,-1,1),maxC<0.07&&c.drs>40&&c.v>c.spec.maxV*0.45&&c.pace>0.9);
}
function collideCars(){
  const L=rCars.length;
  for(let i=0;i<L;i++)for(let j=i+1;j<L;j++){
    const A=rCars[i],B=rCars[j];if((A.isOnline&&B.isOnline)||A.done||B.done)continue;
    if(Math.abs(A.x-B.x)>6||Math.abs(A.z-B.z)>6)continue;
    // a car driven on the other screen can't be moved from here, so the local car takes the whole push
    const wa=A.isOnline?0:B.isOnline?2:1,wb=B.isOnline?0:A.isOnline?2:1;
    for(const sa of[-1.2,1.2])for(const sb of[-1.2,1.2]){
      const ax=A.x+Math.sin(A.yaw)*sa,az=A.z+Math.cos(A.yaw)*sa,bx=B.x+Math.sin(B.yaw)*sb,bz=B.z+Math.cos(B.yaw)*sb;
      const dx=bx-ax,dz=bz-az,d2=dx*dx+dz*dz;
      if(d2<4.4&&d2>1e-4){const d=Math.sqrt(d2),pen=(2.1-d)/2,nx=dx/d,nz=dz/d;A.x-=nx*pen*wa;A.z-=nz*pen*wa;B.x+=nx*pen*wb;B.z+=nz*pen*wb;
        if(Math.abs(A.v-B.v)>2){const m=(A.v+B.v)/2;A.v+=(m-A.v)*0.35*wa;B.v+=(m-B.v)*0.35*wb}
        if((A.isP1||B.isP1)&&performance.now()-rBump>300){rBump=performance.now();sfx(160,.1,'square',.6)}}
    }
  }
}
function updateCam(cam,car,snap){
  const m=rCamMode,dist=[7.6,13,0][m],h=[2.9,5.6,0][m];
  car.camYaw=snap?car.yaw:car.camYaw+angW(car.yaw-car.camYaw)*Math.min(1,rDt*(m===2?20:6));
  car.fovK=(car.fovK||0)+(((car.fx&&car.fx.boosting)?9:0)-(car.fovK||0))*Math.min(1,rDt*4);
  let fov=(m===2?66:58)+Math.min(16,(Math.abs(car.v)/car.spec.maxV)*14)+car.fovK;if(cam.aspect<1.25)fov=Math.max(fov,Math.min(92,2*Math.atan(Math.tan(0.55)/cam.aspect)*180/Math.PI));
  if(Math.abs(cam.fov-fov)>0.1){cam.fov+=(fov-cam.fov)*(snap?1:0.15);cam.updateProjectionMatrix()}
  const sy=Math.sin(car.camYaw),cy=Math.cos(car.camYaw);
  if(m===2){
    const eh=car.spec.eye[0],fz=car.spec.eye[1];
    cam.position.set(car.x+sy*fz,eh,car.z+cy*fz);
    cam.lookAt(car.x+Math.sin(car.yaw)*20,eh-0.25,car.z+Math.cos(car.yaw)*20);
    return;
  }
  const tx=car.x-sy*dist,tz=car.z-cy*dist;
  if(snap)cam.position.set(tx,h,tz);
  else{const k=Math.min(1,rDt*14);cam.position.x+=(tx-cam.position.x)*k;cam.position.z+=(tz-cam.position.z)*k;cam.position.y+=(h-cam.position.y)*k}
  cam.lookAt(car.x+sy*6,1.1,car.z+cy*6);
}
function flashMsg(t){const e=$('#rcount');e.innerHTML=`<span class="rflash">${esc(t)}</span>`;clearTimeout(flashMsg.t);flashMsg.t=setTimeout(()=>{if(rState==='race')e.innerHTML=''},1400)}
function setLights(n){if(!rLights)return;rLights.forEach((m,i)=>m.color.setHex(i<n?0xff1a2a:0x2a0608));
  const e=$('#rcount');e.innerHTML=`<div class="rlights">${[0,1,2,3,4].map(i=>`<i class="${i<n?'on':''}"></i>`).join('')}</div>`}

/* engine sound */
let ENG=null;
function engineStart(){try{if(ENG||!ctx())return;const o=AC.createOscillator(),o2=AC.createOscillator(),f=AC.createBiquadFilter(),g=AC.createGain();o.type='sawtooth';o2.type='square';f.type='lowpass';f.frequency.value=700;g.gain.value=0;o.connect(f);o2.connect(f);f.connect(g).connect(SG);o.start();o2.start();ENG={o,o2,f,g}}catch(e){}}
function engineSet(r,thr,boost){if(!ENG||!AC)return;const t=AC.currentTime,gears=7,x=Math.min(1.15,r)*gears,frac=x-Math.floor(x),rpm=Math.min(1,0.3+0.7*frac*(r<0.02?0:1)),fr=48+rpm*150+(boost?25:0);
  ENG.o.frequency.setTargetAtTime(fr,t,0.04);ENG.o2.frequency.setTargetAtTime(fr*0.5,t,0.04);ENG.f.frequency.setTargetAtTime(420+rpm*1500,t,0.06);ENG.g.gain.setTargetAtTime(sOn?0.03+thr*0.035:0,t,0.08);
  const kmh=Math.round(r*rCars[0].spec.maxV*3.6);$('#rgear').textContent=kmh<3?'N':'G'+Math.min(gears,1+Math.floor(x));$('#rrpm').style.width=Math.round(rpm*100)+'%'}
function stopEngine(){if(!ENG)return;const E=ENG;ENG=null;try{E.g.gain.setTargetAtTime(0,AC.currentTime,0.05);setTimeout(()=>{try{E.o.stop();E.o2.stop()}catch(e){}},300)}catch(e){}}

async function startRace(mode){
  me.n=($('#nm').value.trim()||'Racer').slice(0,12);
  if(!window.THREE){
    err('Loading 3D engine…');
    try{await need3D()}catch(e){return err('The 3D engine could not load. Check your internet connection and try again.')}
    err('');
  }
  rMode=mode;
  selLaps=+($('#rlaps').value||3);
  let bots=+($('#rbots').value||0);
  if(mode=='online'&&!HOST&&opp&&opp.rlaps){selTrack=opp.rtrk||0;selLaps=opp.rlaps||3;bots=opp.rbt||0}
  if(mode!='online'){leave();G='race';cpu=true;$('#net').hidden=true}
  phase='rplay';rFinished=false;
  show('rgame');
  $('#rbrake-warn').hidden=true;
  if(!initRace3D()){leave();return}
  // wait one frame so the stage has its real size (prevents the black first frame)
  await new Promise(r=>requestAnimationFrame(()=>r()));
  if(phase!=='rplay')return;
  if(R3.sc){disposeObj(R3.sc);SMOKE_POOL.length=0}
  const sc=new THREE.Scene();R3.sc=sc;
  try{rTD=buildTrackScene(sc,TRACKS[selTrack])}catch(e){console.error(e);leave();return err('Could not build the track: '+e.message)}
  const N=rTD.N,S=rTD.S;
  $('#rsplit-line').hidden=mode!=='split';
  const diffMul=+($('#rdiff').value||0.96);
  let grid=[{name:me.n,carIdx:selCar,isP1:true,slot:0}];
  if(mode==='split')grid.push({name:'Player 2',carIdx:(selCar+1)%NCARS,isP2:true,slot:1});
  if(mode==='online'){
    // both screens build the same grid: slot 0 = room host, slot 1 = guest, slots 2+ = bots (driven by the host)
    const mine=HOST?0:1,hc=HOST?selCar:(opp?opp.rcar:0),gc0=HOST?(opp?opp.rcar:1):selCar,gc=gc0===hc?gc0+NCARS:gc0;
    grid=[{slot:0,name:HOST?me.n:(on||'Rival'),carIdx:hc},{slot:1,name:HOST?(on||'Rival'):me.n,carIdx:gc}];
    grid.forEach(g=>{if(g.slot===mine)g.isP1=true;else g.isOnline=true});
  }
  const paces=[1.0,0.97,0.94,0.99,0.95];
  const taken=new Set(grid.map(g=>g.carIdx%NCARS)),pool=[...Array(CARS.length).keys()].filter(i=>!taken.has(i%NCARS)).concat([...Array(CARS.length).keys()].filter(i=>taken.has(i%NCARS)&&!grid.some(g=>g.carIdx===i)));
  for(let b=0;b<bots;b++)grid.push({name:BOT_NAMES[b]+' (Bot)',carIdx:pool[b%pool.length],slot:grid.length,pace:diffMul*paces[b],
    isAI:mode!=='online'||HOST,isOnline:mode==='online'&&!HOST});
  grid.sort((a,b)=>(b.isP1?1:0)-(a.isP1?1:0));
  rCars=[];RNET={off:null,lastSend:0,readyPeer:-1,resend:0,announced:{}};
  grid.forEach(gs=>{const idx=gs.slot;
    const spec=CARS[gs.carIdx%CARS.length],mesh=buildCar(gs.carIdx);
    const ti=(N-2-idx*2+N)%N,s=S[ti],lat=(idx%2===0?-1:1)*3.6;
    const x=s.p.x+s.nrm.x*lat,z=s.p.z+s.nrm.z*lat,yaw=Math.atan2(s.tan.x,s.tan.z);
    mesh.root.position.set(x,0,z);mesh.root.rotation.y=yaw;sc.add(mesh.root);
    rCars.push(Object.assign({},gs,{spec,mesh,x,z,yaw,camYaw:yaw,v:0,steer:0,pitch:0,drs:100,ti,dist:ti-N,ld:0,lat,progress:0,bestLap:0,lapStart:0,done:false,finishTime:0,lane:(idx%2===0?-1:1)*2.5,curLane:lat}));
  });
  const[w,h]=fitRace();
  R3.cam1.aspect=w/h;
  updateCam(R3.cam1,rCars[0],true);if(rCars[1])updateCam(R3.cam2,rCars[1],true);
  try{R3.r.compile(sc,R3.cam1)}catch(e){}
  lastRFrame=performance.now();
  RSx={rcar:selCar,rtrk:selTrack,rlaps:selLaps,rbt:bots,rp:0,rlap:1,rdone:0,rtm:0};
  pub();
  $('#rgear').textContent='N';$('#rrpm').style.width='0%';$('#rpos').textContent=`P1/${rCars.length}`;$('#rlap-txt').textContent=`1/${selLaps}`;$('#rtime').textContent='0.0s';$('#rbest').textContent='--';$('#rspeed').textContent='0';
  rAcc=0;buildPads();raceTip();
  if(!rRaf)raceLoop();
  engineStart();
  if(mode==='online'){
    rState='waiting';setLights(0);$('#rcount').innerHTML='<span class="rflash">Waiting for '+esc(on||'your rival')+'…</span>';
    raceReady();
  }else beginCountdown(performance.now()+300+2800+250+Math.random()*500);
}
/* ---------- countdown: five red lights, then GO. Driven by the frame loop so both
   online players can share one start time. ---------- */
let rGoAt=0,rLightsAt=0,rLit=-1,RNET={off:null,lastSend:0,readyPeer:-1,resend:0,announced:{}};
function beginCountdown(goAt,hold){
  if(hold==null)hold=goAt-performance.now()-300-2800;
  rGoAt=goAt;rLightsAt=goAt-2800-Math.max(0,hold);rLit=-1;rState='countdown';$('#rcount').innerHTML='';
}
function countdownTick(now){
  if(now>=rGoAt){
    setLights(0);$('#rcount').innerHTML='<span class="rflash go">GO!</span>';SFX.go();
    rStartAt=rGoAt;rCars.forEach(c=>c.lapStart=rStartAt);rState='race';
    setTimeout(()=>{if(phase=='rplay'&&rState==='race')$('#rcount').innerHTML=''},700);return;
  }
  const n=now<rLightsAt?0:Math.min(5,Math.floor((now-rLightsAt)/560)+1);
  if(n!==rLit){rLit=n;setLights(n);if(n>0)SFX.count()}
}
// online start handshake: each side says "track built"; the host then picks one start time
function raceReady(){
  if(rState!=='waiting'||phase!=='rplay')return;
  NET.ev({e:'rready',gen:myG});
  if(HOST)raceTryGo();
  clearTimeout(RNET.resend);RNET.resend=setTimeout(raceReady,1000);
}
function raceTryGo(){
  if(!HOST||rState!=='waiting'||RNET.readyPeer!==myG)return;
  // give the direct link (and its clock sync) up to 4 s to come up, so both screens start on the same beat
  if(!NET.direct()||NET.clk==null){if(!RNET.waitLink)RNET.waitLink=performance.now();if(NET.pc&&performance.now()-RNET.waitLink<4000){clearTimeout(RNET.tg);RNET.tg=setTimeout(raceTryGo,150);return}}
  const hold=250+Math.random()*500,inMs=400+2800+hold;
  const goAt=performance.now()+inMs;
  NET.ev({e:'rgo',gen:myG,in:Math.round(inMs),at:goAt,hold:Math.round(hold)});
  beginCountdown(goAt,hold);
}
function raceEvent(d){
  if(phase!=='rplay'||rMode!=='online')return;
  if(d.e==='rready'){
    RNET.readyPeer=+d.gen;
    if(HOST){
      if(rState==='waiting')raceTryGo();
      // guest missed the start signal: send the time that is left
      else if(+d.gen===myG&&(rState==='countdown'||rState==='race'))NET.ev({e:'rgo',gen:myG,in:Math.round(rGoAt-performance.now()),at:rGoAt,hold:Math.round(rGoAt-rLightsAt-2800)});
    }
  }else if(d.e==='rgo'&&!HOST&&+d.gen===myG&&rState==='waiting'){
    // with a synced clock, convert the host's start time to ours; otherwise assume half a round trip in flight
    const at=NET.clk!=null&&NET.direct()?(+d.at)-NET.clk:performance.now()+(+d.in||0)-Math.min(150,NET.rtt/2);
    beginCountdown(at,+d.hold||0);
  }
}
/* ---------- online snapshots: each player sends its own car (the host also sends the bots)
   30 times a second. The other screen draws them ~70 ms in the past, smoothly blending
   between snapshots, so jitter never shows. ---------- */
const r2=v=>Math.round(v*100)/100;
function raceNetSend(now){
  if(now-RNET.lastSend<33)return;RNET.lastSend=now;
  const c=[];
  rCars.forEach(k=>{if(k.isOnline)return;if(!k.isP1&&!(HOST&&k.isAI))return;
    const f=k.fx||{};c.push([k.slot,r2(k.x),r2(k.z),Math.round(k.yaw*1000)/1000,r2(k.v),r2(k.steer),r2(k.dist),k.ld,(f.brk>0?1:0)|(f.boosting?2:0)|(k.done?4:0),r2(k.finishTime||0),r2(k.bestLap||0)])});
  NET.sendFast({f:1,g:myG,t:Math.round(now*10)/10,c});
}
function raceNetRecv(d){
  if(phase!=='rplay'||rMode!=='online'||+d.g!==myG||!Array.isArray(d.c))return;
  const now=performance.now(),s=now-(+d.t||0);
  RNET.off=RNET.off==null||s<RNET.off?s:RNET.off+(s-RNET.off)*0.01;
  d.c.forEach(e=>{if(!Array.isArray(e)||e.length<11)return;
    const car=rCars.find(k=>k.isOnline&&k.slot===+e[0]);if(!car)return;
    const b=car.buf||(car.buf=[]),t=+d.t;if(b.length&&t<=b[b.length-1].t)return;
    b.push({t,x:+e[1],z:+e[2],yaw:+e[3],v:+e[4],st:+e[5],dist:+e[6],ld:+e[7],fl:+e[8],ft:+e[9],bl:+e[10]});if(b.length>40)b.shift()});
}
function remoteStep(c,now,dt){
  const b=c.buf;if(!b||!b.length||RNET.off==null)return;
  const delay=NET.fastOK()?70:260,rt=now-RNET.off-delay;
  let a=b[0],z=a,k=0;
  if(rt<=b[0].t){a=z=b[0]}
  else if(rt>=b[b.length-1].t){a=z=b[b.length-1]}
  else{for(let i=0;i<b.length-1;i++)if(b[i+1].t>rt){a=b[i];z=b[i+1];break}k=(rt-a.t)/Math.max(1,z.t-a.t)}
  let x=a.x+(z.x-a.x)*k,zz=a.z+(z.z-a.z)*k,yaw=a.yaw+angW(z.yaw-a.yaw)*k,v=a.v+(z.v-a.v)*k;
  if(a===z&&rt>z.t){const ex=Math.min(0.25,(rt-z.t)/1000);x+=Math.sin(z.yaw)*z.v*ex;zz+=Math.cos(z.yaw)*z.v*ex}
  c.x=x;c.z=zz;c.yaw=yaw;c.v=v;c.steer=a.st+(z.st-a.st)*k;c.dist=a.dist+(z.dist-a.dist)*k;c.ld=z.ld;c.progress=c.dist/rTD.N;c.bestLap=z.bl||c.bestLap;
  const fl=z.fl;
  if((fl&4)&&!c.done){c.done=true;c.finishTime=z.ft;
    if(c.slot<2&&!rCars[0].done&&rState==='race')flashMsg('🏁 '+c.name+' finished!');
    if(rFinished)renderRaceResults()}
  const m=c.mesh,sr=Math.min(1.3,Math.abs(v)/c.spec.maxV);
  m.root.position.set(x,0,zz);m.root.rotation.y=yaw;
  c.slide=(c.slide||0)+(c.steer*Math.min(1,sr*1.4)*0.13-(c.slide||0))*Math.min(1,5*dt);
  m.body.rotation.set(0,c.slide,-c.steer*sr*0.07);
  m.setBrake(!!(fl&1));m.setBoost(!!(fl&2));
  m.wheels.forEach(w=>{w.sp.rotation.x+=v*dt/w.r;if(w.front)w.st.rotation.y=c.steer*0.42});
}

function drawMinimap(){
  const cv=$('#rmap'),c=cv.getContext('2d');c.clearRect(0,0,118,118);
  if(!rTD)return;
  if(!rTD.mapPath){const p=new Path2D();rTD.S.forEach((s,i)=>{const[x,y]=rTD.mapXY(s.p.x,s.p.z);i?p.lineTo(x,y):p.moveTo(x,y)});p.closePath();rTD.mapPath=p}
  c.lineJoin='round';c.strokeStyle='#14111f';c.lineWidth=7;c.stroke(rTD.mapPath);c.strokeStyle='#e8e6f2';c.lineWidth=4;c.stroke(rTD.mapPath);
  const[sx,sy]=rTD.mapXY(rTD.S[0].p.x,rTD.S[0].p.z);c.fillStyle='#ffe14d';c.fillRect(sx-3,sy-3,6,6);
  [...rCars].reverse().forEach(car=>{const[x,y]=rTD.mapXY(car.x,car.z);c.fillStyle=car.isP1?'#2fe3a0':car.isP2?'#ff8a1f':car.isOnline?'#ff3e8a':car.spec.col;c.beginPath();c.arc(x,y,car.isP1||car.isP2?5:3.6,0,7);c.fill();c.strokeStyle='#14111f';c.lineWidth=1.6;c.stroke()});
}

let lastRFrame=performance.now(),rAcc=0;
function raceLoop(){
  rRaf=requestAnimationFrame(raceLoop);
  if(!R3||!R3.sc||$('#rgame').hidden)return;
  const now=performance.now(),dt=Math.min(0.1,(now-lastRFrame)/1000);lastRFrame=now;rDt=dt;
  for(const p of SMOKE_POOL){if(!p.on)continue;p.age+=dt;p.m.position.y+=dt*1.5;p.m.scale.setScalar(1+p.age*3.2);p.m.material.opacity=Math.max(0,0.45*(1-p.age*1.7));if(p.age>0.6){p.on=false;p.m.visible=false}}
  if(rState==='countdown')countdownTick(now);
  if(rState==='race'||rState==='over'){
    rAcc+=dt;let n=0;
    while(rAcc>=RPH&&n<14){rAcc-=RPH;n++;physTick(RPH)}
    if(n>=14)rAcc=0;
    rCars.forEach(c=>{if(!c.isOnline)carVisual(c,dt)});
  }
  if(rMode==='online'){rCars.forEach(c=>{if(c.isOnline)remoteStep(c,now,dt)});if(rState!=='waiting')raceNetSend(now)}
  if(rState==='race'){
    const p1=rCars[0];
    const sorted=[...rCars].sort((a,b)=>(b.done&&a.done)?a.finishTime-b.finishTime:b.progress-a.progress);
    $('#rpos').textContent=`P${sorted.indexOf(p1)+1}/${rCars.length}`;
    $('#rlap-txt').textContent=`${Math.min(selLaps,p1.ld+1)}/${selLaps}`;
    $('#rtime').textContent=((now-rStartAt)/1000).toFixed(1)+'s';
    if(p1.bestLap)$('#rbest').textContent=p1.bestLap.toFixed(2)+'s';
    $('#rspeed').textContent=Math.round(Math.abs(p1.v)*3.6);
    $('#rdrs').textContent=Math.round(p1.drs)+'%';
    RSx.rp=+p1.progress.toFixed(3);RSx.rlap=p1.ld+1;
  }
  drawMinimap();
  const[w,h]=fitRace(),r=R3.r;
  if(rMode==='split'&&rCars[1]){
    r.setScissorTest(true);
    [[R3.cam1,rCars[0],0],[R3.cam2,rCars[1],w/2]].forEach(([cam,car,x0])=>{
      if(Math.abs(cam.aspect-(w/2)/h)>0.001){cam.aspect=(w/2)/h;cam.updateProjectionMatrix()}
      updateCam(cam,car,rState==='countdown');r.setViewport(x0,0,w/2,h);r.setScissor(x0,0,w/2,h);r.render(R3.sc,cam)});
    r.setScissorTest(false);
  }else{
    if(Math.abs(R3.cam1.aspect-w/h)>0.001){R3.cam1.aspect=w/h;R3.cam1.updateProjectionMatrix()}
    updateCam(R3.cam1,rCars[0],rState==='countdown');
    r.setViewport(0,0,w,h);r.render(R3.sc,R3.cam1);
  }
}
function physTick(h){
  rCars.forEach(c=>{
    if(c.isOnline)return;
    if(c.done){c.pace=0.62;stepAI(c,h);return}
    if(c.isP1||c.isP2){
      const I=rInput(c.isP1?0:1);
      if(I.reset){const s=rTD.S[c.ti];c.x=s.p.x;c.z=s.p.z;c.yaw=Math.atan2(s.tan.x,s.tan.z);c.v=0;c.steer=0}
      stepCar(c,h,I.thr,I.brk,I.st,I.boost);
    }else stepAI(c,h);
  });
  collideCars();
}
/* ---------- input: keyboard + touch pads, merged per player ---------- */
function rInput(p){
  const k=rKeys,t=rTouch[p],solo=rMode!=='split';
  let thr,brk,st,boost,reset=false;
  if(p===0){
    thr=k.KeyW||(solo&&k.ArrowUp);brk=k.KeyS||k.Space||(solo&&k.ArrowDown);
    st=((k.KeyA||(solo&&k.ArrowLeft))?1:0)-((k.KeyD||(solo&&k.ArrowRight))?1:0);
    boost=k.ShiftLeft||k.ShiftRight;
    if(k.KeyR){k.KeyR=false;reset=true}
  }else{
    thr=k.ArrowUp;brk=k.ArrowDown;st=(k.ArrowLeft?1:0)-(k.ArrowRight?1:0);boost=k.Slash||k.ShiftRight;
  }
  if(t.reset){t.reset=false;reset=true}
  thr=thr||t.thr;brk=brk||t.brk;boost=boost||t.boost;
  if(!st)st=(t.l?1:0)-(t.r?1:0);
  if(TOUCH_UI&&rAutoGas&&!brk)thr=true;
  return{thr:thr?1:0,brk:brk?1:0,st,boost:!!boost,reset};
}
// On-screen pads drawn over the race view. Several fingers at once are fine,
// and a thumb can slide from ◀ to ▶ without lifting.
const PAD_ICO={
  l:'<svg viewBox="0 0 40 40"><path d="M25 7L11 20l14 13" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  r:'<svg viewBox="0 0 40 40"><path d="M15 7l14 13-14 13" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  brk:'<svg viewBox="0 0 40 30"><rect x="3" y="3" width="34" height="24" rx="6" fill="none" stroke="#fff" stroke-width="3.5"/><path d="M10 11h20M10 19h20" stroke="#fff" stroke-width="3.5" stroke-linecap="round"/></svg>',
  thr:'<svg viewBox="0 0 40 30"><rect x="7" y="2" width="26" height="26" rx="6" fill="none" stroke="#fff" stroke-width="3.5"/><path d="M14 9v12M20 9v12M26 9v12" stroke="#fff" stroke-width="3.5" stroke-linecap="round"/></svg>',
  boost:'<svg viewBox="0 0 40 40"><path d="M23 3L9 23h10l-3 14 15-21H21z" fill="#ffe14d" stroke="#14111f" stroke-width="2" stroke-linejoin="round"/></svg>',
  reset:'<svg viewBox="0 0 40 40"><path d="M30 13A12 12 0 1 0 32 23" fill="none" stroke="#fff" stroke-width="4.5" stroke-linecap="round"/><path d="M31 4v10H21" fill="none" stroke="#fff" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/></svg>'
};
function buildPads(){
  const box=$('#rpads');rTouch=[{},{}];
  box.hidden=!TOUCH_UI;if(!TOUCH_UI){box.innerHTML='';return}
  const split=rMode==='split';
  const b=(p,k,cls,lbl='')=>`<button class="rpb ${cls}" data-p="${p}" data-k="${k}" aria-label="${{l:'Steer left',r:'Steer right',brk:'Brake',thr:'Gas',boost:'Boost',reset:'Reset car'}[k]}" tabindex="-1">${PAD_ICO[k]}${lbl?`<span class="rpl">${lbl}</span>`:''}</button>`;
  const grp=p=>`<div class="rpg steer p${p}">${b(p,'l','st')}${b(p,'r','st')}</div>
    <div class="rpg ped p${p}"><div class="rpcol">${b(p,'reset','rs')}${b(p,'boost','bo')}</div>${b(p,'brk','ped br','BRAKE')}${rAutoGas?'':b(p,'thr','ped gs','GAS')}</div>`;
  box.className='rpads'+(split?' split':'')+(rAutoGas?' auto':'');
  box.innerHTML=grp(0)+(split?grp(1):'');
}
function padDrs(p,v){const e=document.querySelector(`#rpads .rpb.bo[data-p="${p}"]`);if(!e)return;const r=Math.round(v);if(e._d!==r){e._d=r;e.style.setProperty('--drs',r);e.classList.toggle('low',r<4)}}
(function(){
  const box=$('#rpads'),own=new Map();
  const sync=()=>{
    const st=[{},{}];
    own.forEach(btn=>{if(btn)st[+btn.dataset.p][btn.dataset.k]=true});
    [0,1].forEach(p=>{const t=rTouch[p];['l','r','thr','brk','boost'].forEach(k=>t[k]=!!st[p][k])});
    box.querySelectorAll('.rpb').forEach(e=>e.classList.toggle('act',[...own.values()].includes(e)));
  };
  const at=e=>{const el=document.elementFromPoint(e.clientX,e.clientY);return el&&el.closest?el.closest('#rpads .rpb'):null};
  box.addEventListener('pointerdown',e=>{
    const btn=at(e);if(!btn)return;e.preventDefault();
    if(btn.dataset.k==='reset'){rTouch[+btn.dataset.p].reset=true;btn.classList.add('act');setTimeout(()=>btn.classList.remove('act'),150);return}
    own.set(e.pointerId,btn);sync();
  });
  box.addEventListener('pointermove',e=>{if(!own.has(e.pointerId))return;const btn=at(e);if(btn&&btn.dataset.k==='reset')return;if(own.get(e.pointerId)!==btn){own.set(e.pointerId,btn);sync()}});
  const up=e=>{if(own.delete(e.pointerId))sync()};
  ['pointerup','pointercancel','lostpointercapture'].forEach(n=>box.addEventListener(n,up));
  box.addEventListener('contextmenu',e=>e.preventDefault());
  const rg=$('#rgame');['contextmenu','selectstart','dragstart'].forEach(n=>rg.addEventListener(n,e=>e.preventDefault()));
  rg.addEventListener('touchstart',e=>{if(e.target.closest('#rstage'))e.preventDefault()},{passive:false});
  addEventListener('blur',()=>{own.clear();sync()});
})();
function raceTip(){
  const t=$('#rtip');if(!t)return;
  if(TOUCH_UI&&innerHeight>innerWidth&&innerWidth<700){t.textContent='Tip: turn your phone sideways for a wider view';t.hidden=false;clearTimeout(raceTip.h);raceTip.h=setTimeout(()=>t.hidden=true,4000)}
  else t.hidden=true;
}

function finishRace(who){
  if(rFinished)return;rFinished=true;
  rState='over';stopEngine();$('#rbrake-warn').hidden=true;
  const now=performance.now();
  rCars.forEach(c=>{if(!c.done){c.est=c.progress}});
  const sorted=[...rCars].sort((a,b)=>(a.done&&b.done)?a.finishTime-b.finishTime:a.done?-1:b.done?1:b.progress-a.progress);
  const pos=sorted.indexOf(rCars[0])+1,winner=sorted[0];
  RSx.rdone=1;RSx.rtm=rCars[0].finishTime||((now-rStartAt)/1000);pub();
  jingle(rCars.length===1||pos===1);
  renderRaceResults();
  $('#rm').hidden=false;raceRmLabel();
  setTimeout(()=>{if(phase==='rplay')$('#over').hidden=false},900);
}
function renderRaceResults(){
  const sorted=[...rCars].sort((a,b)=>(a.done&&b.done)?a.finishTime-b.finishTime:a.done?-1:b.done?1:b.progress-a.progress);
  const pos=sorted.indexOf(rCars[0])+1,winner=sorted[0],solo=rCars.length===1;
  $('#ot').textContent=solo?'🏁 TIME TRIAL DONE!':rMode==='split'?`🏁 ${winner.name.toUpperCase()} WINS!`:(pos===1?'🏁 VICTORY!':'🏁 FINISHED P'+pos+'!');
  const rows=sorted.map((c,i)=>`<tr class="${c.isP1||c.isP2?'me':''}"><td>P${i+1}</td><td>${esc(c.name)}</td><td>${c.done?c.finishTime.toFixed(2)+'s':'racing…'}</td><td>${c.bestLap?c.bestLap.toFixed(2)+'s':'—'}</td></tr>`).join('');
  $('#os').innerHTML=`${esc(TRACKS[selTrack].n)} · ${selLaps} lap${selLaps>1?'s':''}<table class="rres"><tr><th>Pos</th><th>Driver</th><th>Time</th><th>Best lap</th></tr>${rows}</table>`;
}
function raceRmLabel(){$('#rm').textContent=rMode==='online'&&opp&&opp.g>myG?'Accept rematch!':'Race Again!'}
function raceSync(){
  if(rMode!=='online'||phase!=='rplay')return;
  if(!opp){if(rState==='race'&&!RNET.announced.gone){RNET.announced.gone=1;flashMsg('Rival disconnected')}return}
  RNET.announced.gone=0;
  if(!$('#over').hidden)raceRmLabel();
}

const RACE_KEYS=['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'];
addEventListener('keydown',e=>{rKeys[e.code]=true;if(!$('#rgame').hidden&&RACE_KEYS.includes(e.code))e.preventDefault()});
addEventListener('keyup',e=>{rKeys[e.code]=false});
addEventListener('blur',()=>{rKeys={}});
$('#rcam-btn').onclick=()=>{rCamMode=(rCamMode+1)%3;$('#rcam-btn').textContent='🎥 Cam: '+['Chase','High','Cockpit'][rCamMode]};
$('#rquit').onclick=leave;
$('#rsolo').onclick=()=>startRace('solo');
$('#rsplit').onclick=()=>startRace('split');
$('#rgo').onclick=()=>{Object.assign(RSx,{rcar:selCar,rtrk:selTrack,rlaps:+($('#rlaps').value||3),rbt:+($('#rbots').value||0)});join('race')};



ART_GEN.race=(()=>{const {K,ink,rays,dots}=ART;
function race(W,n){
  const cx=W/2,u='_r'+n;let city='',x=-10,R=rng(7);
  while(x<W+10){const w=14+R()*26,h=10+R()*30;city+=`<rect x="${x.toFixed(1)}" y="${(86-h).toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}"/>`;x+=w+2}
  let dash='';for(let i=-1;i<W/40+1;i++)dash+=`<rect x="${i*40}" y="108" width="22" height="4" rx="2"/>`;
  let streak='';const S=[[-148,64,70],[-170,78,96],[-138,92,52],[-186,56,40],[-160,100,64]];
  const ks=Math.min(1,(W-24)/236);
  S.forEach(([dx,y,l],i)=>streak+=`<rect x="${cx+dx*ks-l}" y="${y}" width="${l}" height="${i%2?3:5}" rx="2.5" fill="#fff" opacity="${i%2?.55:.85}"/>`);
  const wheel=x=>`<g transform="translate(${x} -14)"><circle r="15.5" fill="${K}"/><circle r="9" fill="#ffd23f" ${ink(2.5)}/><g class="wspin"><path d="M0-9A9 9 0 0 1 9 0M0 9A9 9 0 0 1-9 0" fill="none" stroke="${K}" stroke-width="3"/></g><circle r="3" fill="${K}"/></g>`;
  return `<svg viewBox="0 0 ${W} 130" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><defs>
  <linearGradient id="sk${u}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2b1d66"/><stop offset=".45" stop-color="#8a2f9c"/><stop offset=".72" stop-color="#ff3e8a"/><stop offset="1" stop-color="#ffb347"/></linearGradient>
  <linearGradient id="sn${u}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe14d"/><stop offset="1" stop-color="#ff8a1f"/></linearGradient>
  <linearGradient id="cb${u}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff5963"/><stop offset=".6" stop-color="#e11d33"/><stop offset="1" stop-color="#a40f26"/></linearGradient>
  ${dots('dt'+u,'#fff',.18)}</defs>
  <rect width="${W}" height="130" fill="url(#sk${u})"/><rect width="${W}" height="90" fill="url(#dt${u})"/>
  <g fill="#fff"><circle cx="${cx-150}" cy="14" r="1.4"/><circle cx="${cx+130}" cy="20" r="1.2"/><circle cx="${cx-60}" cy="10" r="1"/><circle cx="${cx+60}" cy="8" r="1.4"/><circle cx="${cx+190}" cy="12" r="1"/><circle cx="${cx-220}" cy="24" r="1.2"/></g>
  <circle cx="${cx+18}" cy="80" r="44" fill="url(#sn${u})"/>
  <g fill="#ff3e8a" opacity=".9"><rect x="${cx-30}" y="58" width="96" height="3"/><rect x="${cx-30}" y="66" width="96" height="4"/><rect x="${cx-30}" y="74" width="96" height="5"/></g>
  <g fill="#3a1f6e">${city}</g>
  <rect y="86" width="${W}" height="44" fill="#2a2340"/><rect y="86" width="${W}" height="4" fill="#ff3e8a"/>
  <g fill="#ffe14d" opacity=".9">${dash}</g>
  <rect y="124" width="${W}" height="6" fill="#e10600"/><g fill="#fff">${Array.from({length:Math.ceil(W/24)+1},(_,i)=>`<rect x="${i*24}" y="124" width="12" height="6"/>`).join('')}</g>
  <g class="ospd">${streak}</g>
  <g transform="translate(${cx+6*ks} 118) rotate(-2) scale(${ks})"><g class="ocar">
   <ellipse cx="0" cy="-1" rx="104" ry="6" fill="#000" opacity=".35"/>
   <path d="M-112 -14 Q-128 -16 -140 -10 Q-128 -6 -112 -8Z" fill="#ffe14d" ${ink(2)} class="oflm"/>
   <path d="M-102 -38L-84 -38 -82 -50 -106 -52Z" fill="${K}"/><path d="M-94 -38V-30" ${ink(4)}/>
   <path d="M-104 -10L-102 -28Q-100 -33 -90 -34L-60 -36 -36 -50Q-30 -54 -20 -54L18 -54Q30 -54 40 -46L60 -33 92 -29Q106 -27 108 -18L108 -10Q108 -5 101 -5L-98 -5Q-104 -5 -104 -10Z" fill="url(#cb${u})" ${ink(3.5)}/>
   <path d="M-32 -38L-18 -49 14 -49Q24 -49 32 -43L44 -35Z" fill="#7fe8ff" ${ink(3)}/><path d="M4 -49V-36" ${ink(3)}/><path d="M-14 -46L-6 -46 -18 -38 -24 -38Z" fill="#fff" opacity=".8"/>
   <path d="M-100 -22L104 -18" stroke="#ffe14d" stroke-width="5"/><path d="M-100 -22L104 -18" stroke="${K}" stroke-width="1" opacity=".3"/>
   <circle cx="-8" cy="-24" r="9" fill="#fff" ${ink(2.5)}/><text x="-8" y="-19.5" text-anchor="middle" font-family="Bangers,Impact,sans-serif" font-size="13" fill="${K}">1</text>
   <path d="M96 -27L107 -25 107 -20 98 -21Z" fill="#fff6c2" ${ink(2)}/><path d="M-103 -27L-98 -28 -98 -22 -103 -22Z" fill="#ff3b4d" ${ink(1.5)}/>
   <path d="M-40 -44L-60 -36" stroke="#fff" stroke-width="2.5" opacity=".7" stroke-linecap="round"/>
   ${wheel(-64)}${wheel(66)}
  </g></g>
  <g fill="#ffe14d" ${ink(2)} class="gspark"><path d="M${cx+104*ks} 40l3 7 7 3-7 3-3 7-3-7-7-3 7-3z"/></g>
  </svg>`}

return race})();
