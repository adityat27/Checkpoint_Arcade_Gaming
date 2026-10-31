/* =========================================================================
   SLIPSTREAM — endless highway driving. Weave through traffic on a winding
   two-way road; overtake on the wrong side for double points; near misses
   fill your nitro. One crash and the run is over.
   Modes: solo, or online with a friend (same road, same traffic, last one
   driving wins — or beat a crashed rival's score).

   Road, traffic, physics, scoring: core.js · car models: cars.js
   This file: the 3D world, camera, HUD, controls, engine sound, online play.
   ========================================================================= */
(()=>{
const C=SSCore,{CFG,STYLES}=C,STEP=1/120,CH=90;
const ROUTES=[
  {id:'coast',n:'Coast Highway',d:'Sea cliffs on your left, green hills on your right. Bright midday sun.',L:'sea',R:'hill',sky:'day',icon:'🌊',a:'#2d8fd6',b:'#7fd36a'},
  {id:'ridge',n:'Sunset Ridge',d:'A golden-hour mountain pass above a deep valley.',L:'valley',R:'mesa',sky:'dusk',icon:'🌄',a:'#7a2e5e',b:'#ffb35a'},
  {id:'night',n:'Night Run',d:'Street lamps, headlights and a city glowing far below.',L:'valley',R:'hill',sky:'night',icon:'🌃',a:'#0d1238',b:'#5a3aa0'}
];
const LOOK={
  coast:{fog:0xcfe4f4,fogD:.0019,exp:1.0,hemi:[0xd8ecff,0x6a7a4a,.85],sun:[0xfff3dd,1.65],sunAt:[.16,.22],env:['#3f86d8','#e8f4ff','#5c6a48'],
    asph:'#4a4d53',grav:'#a99d84',grass:['#5d9a3a','#4a8a33','#77aa47','#6a9e3e'],rock:'#8d8576',sand:'#e3d3a0',deep:'#5f7f86',wall:'#b9ad98',
    mtn:[0x6f93a8,0xa9c6d6],trees:'round',sea:0x1d6f9e,ranges:1},
  ridge:{fog:0xf0b88e,fogD:.0021,exp:1.05,hemi:[0xffd8b6,0x6a4430,.8],sun:[0xffbf7a,1.6],sunAt:[.10,.40],env:['#5a4b8f','#ffd1a1','#6a4a36'],
    asph:'#4b4547',grav:'#b08c68',grass:['#b9904c','#a57d40','#c9a25a','#9c7a3e'],rock:'#a05c3c',sand:'#d9b07a',deep:'#6b4b3a',wall:'#a8876a',
    mtn:[0x8a4a5a,0xe0907a],trees:'pine',ranges:1},
  night:{fog:0x0c1230,fogD:.0026,exp:1.15,hemi:[0x4a5ea8,0x14121c,.42],sun:[0x9fb4ff,.38],sunAt:[.62,.25],env:['#05081a','#2a2a5a','#0a0a12'],
    asph:'#2f3137',grav:'#4a4a52',grass:['#21402b','#1b3624','#2a4a32','#1e3a28'],rock:'#3c3c46',sand:'#4a4a4a',deep:'#1a2030',wall:'#55555e',
    mtn:[0x161a3a,0x2a2f5a],trees:'round',lamps:1,city:1,ranges:1}
};
const PAINTS=['#e8203a','#ff8a1f','#ffd23f','#2fe3a0','#2d7bff','#8a5cff','#f2f2f2','#2a2d34'];
const CARCOL=[0xf1f1ef,0xc9ccd1,0x8d939b,0x23262c,0xb3141c,0x1f4fa8,0x3a6b3a,0xdcd4c0,0x7a1d2a,0x2e8fb8,0xe6e0d0,0x5a5f66];
const BUSCOL=[0xf2c230,0xd63a2a,0x2d6fd0,0x2f9a5a];
const TRUCKCOL=[0xe2462e,0x2a8f6a,0xf09a1e,0x3a5fc8,0xc8365a];
const clamp=C.clamp,lerp=C.lerp;
// three r128 has no automatic colour management: colours given as sRGB hex must be converted to linear
const lin=h=>new THREE.Color(h).convertSRGBToLinear();
function linMat(m){if(m.color&&!m.map)m.color.convertSRGBToLinear();if(m.emissive)m.emissive.convertSRGBToLinear();return m}
const store=(k,v)=>{try{if(v===undefined)return localStorage[k];localStorage[k]=v}catch(e){}};

/* =================== screens =================== */
const html=`
<section id="ssmenu" class="card gmenu" hidden>
<div class="mhero"><div class="mart" data-art="slip"></div><h2 class="mh">Slipstream</h2></div>
<p class="lb">1. Your car</p><div class="sscars" id="sscars" role="radiogroup" aria-label="Car"></div>
<div class="sspaint" id="sspaint" role="radiogroup" aria-label="Paint"></div>
<p class="lb">2. Your road</p><div class="ssroutes" id="ssroutes" role="radiogroup" aria-label="Road"></div>
<div class="row rsets">
 <label>Driving<select id="ssauto"><option value="1">Auto-accelerate (steer + brake)</option><option value="0">Hold the gas yourself</option></select></label>
 <label>Online room code<input id="cd11" maxlength="6" autocomplete="off"></label>
</div>
<div class="row"><button class="btn b" id="sssolo">Solo drive</button><button class="btn" id="ssgo">Online · race a friend</button></div>
<p class="note" data-msg></p>
<ul class="rules">
 <li><b>Endless road, one life.</b> Weave through cars, vans, buses and trucks. Every run is a brand-new road. Traffic gets heavier the further you go.</li>
 <li><b>We drive on the left.</b> The two right-hand lanes are oncoming traffic: overtake there for <b>double points</b>, if you dare.</li>
 <li><b>Near misses</b> (squeezing past close) score big, chain into combos and fill your <b>nitro</b>. Faster = more points per metre.</li>
 <li><b>Keys:</b> ← → or A D steer · ↑ / W gas · ↓ / S brake · Shift or Space nitro · C camera · P pause. <b>Phone:</b> ◀ ▶ on the left, BRAKE and ⚡ on the right.</li>
 <li><b>Online:</b> same road, same traffic for both of you. Last one driving wins, or beat your crashed rival's score.</li>
</ul>
<button class="btn m back" data-back>← All games</button></section>
<section id="ssgame" hidden><div id="ssstage">
 <canvas id="sscv"></canvas><div id="ssvig"></div><div id="ssspeed"></div><div id="ssflash"></div>
 <div id="ssscore" class="ssp"><small>SCORE</small><b id="sssc">0</b><div class="ssrow"><span id="ssdist">0.00 km</span><span id="ssmult">×1.0</span></div><em id="ssbest"></em></div>
 <div id="ssriv" class="ssp" hidden><b id="ssrn">Rival</b><span id="ssrs">0</span><i id="ssrg"></i></div>
 <div id="ssbtns"><button class="ssb" id="sscam" aria-label="Change camera">🎥</button><button class="ssb" id="ssfs" aria-label="Full screen">⛶</button><button class="ssb" id="sspause" aria-label="Pause">❚❚</button><button class="ssb" id="ssquit" aria-label="Leave">✕</button></div>
 <div id="sspop"></div><div id="ssmsg"></div><div id="sstip"></div>
 <div id="ssgauge"><svg viewBox="0 0 200 172" aria-hidden="true">
   <path class="trk" d="M43 149A80 80 0 1 1 157 149"/><path id="ssrpm" class="rpm" d="M43 149A80 80 0 1 1 157 149"/><path class="red" d="M146 41A80 80 0 0 1 157 149"/>
   <text id="ssgear" x="100" y="104" text-anchor="middle">N</text><text id="sskmh" x="100" y="138" text-anchor="middle">0</text><text x="100" y="156" text-anchor="middle" class="u">km/h</text></svg>
   <div id="ssnitro"><i></i><span>⚡ NITRO</span></div></div>
 <div id="sskeys" class="ssp"><span><kbd>← →</kbd> steer</span><span><kbd>↑</kbd> gas</span><span><kbd>↓</kbd> brake</span><span><kbd>SHIFT</kbd> nitro</span><span><kbd>C</kbd> camera</span></div>
 <div id="sspads" hidden></div>
 <div id="sspm" hidden><div class="sspmc"><h3>PAUSED</h3><div class="sspmb"><button class="btn m" id="ssres">Resume</button><button class="btn o" id="ssre">New road</button><button class="btn b" id="ssleave">Leave</button></div></div></div>
</div></section>`;
$('#app').insertAdjacentHTML('beforeend',html);
$('#ssmenu [data-back]').onclick=()=>{show('hub');SFX.back()};
['contextmenu','selectstart','dragstart'].forEach(n=>$('#ssgame').addEventListener(n,e=>e.preventDefault()));

/* =================== menu =================== */
const sel={style:store('ssStyle')||'gt',paint:+(store('ssPaint')||0),route:store('ssRoute')||'coast'};
if(!STYLES[sel.style])sel.style='gt';if(!ROUTES.find(r=>r.id===sel.route))sel.route='coast';
let autoGas=TOUCH_UI;{const a=store('ssAuto');if(a!=null)autoGas=a==='1'}
const best=r=>+(store('ssBest_'+r)||0);
function renderMenu(){
  const bar=(f,col)=>`<div class="ssbar"><i style="width:${Math.round(18+82*clamp(f,0,1))}%;background:${col}"></i></div>`;
  $('#sscars').innerHTML=Object.entries(STYLES).map(([k,s])=>`<button class="sscar${k===sel.style?' on':''}" role="radio" aria-checked="${k===sel.style}" data-s="${k}">
    ${SSCars.svg(k,PAINTS[sel.paint])}<b>${esc(s.n)}</b><small>${esc(s.sub)}</small>
    <div class="ssstat"><span>SPEED</span>${bar((s.top-55)/12,'#ff3e8a')}<span>ACCEL</span>${bar((s.acc-8.5)/3,'#2d7bff')}<span>STEER</span>${bar((s.steer-.9)/.3,'#2fe3a0')}</div></button>`).join('');
  $('#sspaint').innerHTML=PAINTS.map((c,i)=>`<button class="sw${i===sel.paint?' on':''}" role="radio" aria-checked="${i===sel.paint}" aria-label="Paint ${i+1}" data-p="${i}" style="--c:${c}"></button>`).join('');
  $('#ssroutes').innerHTML=ROUTES.map(r=>{const b=best(r.id);return`<button class="ssroute${r.id===sel.route?' on':''}" role="radio" aria-checked="${r.id===sel.route}" data-r="${r.id}" style="--a:${r.a};--b:${r.b}"><span class="ic">${r.icon}</span><b>${esc(r.n)}</b><small>${esc(r.d)}</small>${b?`<em>Best ${b.toLocaleString()}</em>`:''}</button>`}).join('');
}
$('#sscars').onclick=e=>{const b=e.target.closest('.sscar');if(!b)return;sel.style=b.dataset.s;store('ssStyle',sel.style);renderMenu();SFX.sel()};
$('#sspaint').onclick=e=>{const b=e.target.closest('.sw');if(!b)return;sel.paint=+b.dataset.p;store('ssPaint',sel.paint);renderMenu();SFX.sel()};
$('#ssroutes').onclick=e=>{const b=e.target.closest('.ssroute');if(!b)return;sel.route=b.dataset.r;store('ssRoute',sel.route);renderMenu();SFX.sel()};
$('#ssauto').value=autoGas?'1':'0';$('#ssauto').onchange=()=>{autoGas=$('#ssauto').value==='1';store('ssAuto',autoGas?'1':'0')};
renderMenu();

/* =================== textures =================== */
const TX={};
function tex(key,w,h,draw,o={}){
  if(TX[key])return TX[key];
  const cv=document.createElement('canvas');cv.width=w;cv.height=h;draw(cv.getContext('2d'),w,h);
  const t=new THREE.CanvasTexture(cv);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=o.aniso||8;
  if(!o.lin)t.encoding=THREE.sRGBEncoding;
  return TX[key]=t;
}
function rgbOf(hex){const n=parseInt(hex.slice(1),16);return[n>>16&255,n>>8&255,n&255]}
function noiseFill(c,w,h,hex,amp,r){const[R,G,B]=rgbOf(hex),img=c.createImageData(w,h),d=img.data;for(let i=0;i<w*h;i++){const n=(r()-.5)*amp;d[i*4]=R+n;d[i*4+1]=G+n;d[i*4+2]=B+n;d[i*4+3]=255}c.putImageData(img,0,0)}
function texRoad(L,id){return tex('road'+id,512,1024,(c,w,h)=>{
  const r=C.rng(11);noiseFill(c,w,h,L.asph,20,r);
  const px=lat=>(lat+CFG.roadHalf)/(2*CFG.roadHalf)*w,m=h/16;   // texture = 14.4 m across, 16 m along
  // wheel tracks, patches and cracks
  CFG.laneX.forEach(lx=>[-.8,.8].forEach(o=>{const g=c.createLinearGradient(px(lx+o)-14,0,px(lx+o)+14,0);g.addColorStop(0,'rgba(0,0,0,0)');g.addColorStop(.5,'rgba(0,0,0,.13)');g.addColorStop(1,'rgba(0,0,0,0)');c.fillStyle=g;c.fillRect(px(lx+o)-14,0,28,h)}));
  for(let k=0;k<3;k++){c.fillStyle=`rgba(0,0,0,${.035+r()*.03})`;c.fillRect(r()*w,r()*h,40+r()*80,30+r()*120)}
  c.strokeStyle='rgba(0,0,0,.25)';c.lineWidth=1.2;for(let k=0;k<6;k++){let x=r()*w,y=r()*h;c.beginPath();c.moveTo(x,y);for(let j=0;j<6;j++){x+=(r()-.5)*30;y+=10+r()*20;c.lineTo(x,y)}c.stroke()}
  const paint=(lat,wd,y0,len,col)=>{c.fillStyle=col;c.fillRect(px(lat)-wd*w/14.4/2,y0*m,wd*w/14.4,len*m)};
  const W='rgba(245,245,240,.92)';
  paint(-7.0,.16,0,16,W);paint(7.0,.16,0,16,W);                 // edge lines
  paint(-3.6,.13,0,4.5,W);paint(3.6,.13,0,4.5,W);              // lane lines (dashed)
  paint(-.11,.12,0,9,'rgba(245,205,60,.95)');paint(.11,.12,0,9,'rgba(245,205,60,.95)');   // centre: double yellow dashes
  // a bit of wear on the paint
  for(let k=0;k<400;k++){c.fillStyle=`rgba(60,60,60,${r()*.35})`;c.fillRect(r()*w,r()*h,2,2)}
},{aniso:16})}
function texGravel(L,id){return tex('grav'+id,256,256,(c,w,h)=>{const r=C.rng(5);noiseFill(c,w,h,L.grav,60,r);for(let k=0;k<500;k++){c.fillStyle=`rgba(${r()<.5?0:255},${r()<.5?0:255},${r()<.5?0:255},.12)`;c.fillRect(r()*w,r()*h,3,3)}})}
function texDetail(){return tex('detail',256,256,(c,w,h)=>{const r=C.rng(9);const img=c.createImageData(w,h),d=img.data;for(let i=0;i<w*h;i++){const v=215+r()*40;d[i*4]=d[i*4+1]=d[i*4+2]=v;d[i*4+3]=255}c.putImageData(img,0,0);
  for(let k=0;k<900;k++){c.fillStyle=`rgba(0,0,0,${.05+r()*.1})`;c.fillRect(r()*w,r()*h,1+r()*3,3+r()*6)}},{lin:1})}
function texStone(L,id){return tex('stone'+id,256,64,(c,w,h)=>{const r=C.rng(3);c.fillStyle='#3a362f';c.fillRect(0,0,w,h);
  for(let y=0;y<h;y+=16)for(let x=-(y/16%2)*16;x<w;x+=32){const[R,G,B]=rgbOf(L.wall),k=(r()-.5)*40;c.fillStyle=`rgb(${R+k},${G+k},${B+k})`;c.fillRect(x+1.5,y+1.5,29,13)}})}
function texChev(){return tex('chev',128,64,(c,w,h)=>{c.fillStyle='#ffd21f';c.fillRect(0,0,w,h);c.fillStyle='#14111f';for(let k=0;k<3;k++){const x=16+k*36;c.beginPath();c.moveTo(x,10);c.lineTo(x+20,32);c.lineTo(x,54);c.lineTo(x+11,54);c.lineTo(x+31,32);c.lineTo(x+11,10);c.fill()}c.lineWidth=5;c.strokeRect(2,2,w-4,h-4)})}
function texBlob(){return tex('blob',64,64,(c)=>{const g=c.createRadialGradient(32,32,2,32,32,32);g.addColorStop(0,'rgba(0,0,0,.62)');g.addColorStop(.55,'rgba(0,0,0,.38)');g.addColorStop(1,'rgba(0,0,0,0)');c.fillStyle=g;c.fillRect(0,0,64,64)},{lin:1})}
function texPool(){return tex('pool',64,64,(c)=>{const g=c.createRadialGradient(32,32,1,32,32,32);g.addColorStop(0,'rgba(255,214,150,.75)');g.addColorStop(.45,'rgba(255,190,110,.28)');g.addColorStop(1,'rgba(0,0,0,0)');c.fillStyle=g;c.fillRect(0,0,64,64)},{lin:1})}
function texBeam(){return tex('beam',64,128,(c,w,h)=>{const g=c.createLinearGradient(0,0,0,h);g.addColorStop(0,'rgba(255,245,215,.55)');g.addColorStop(1,'rgba(255,245,215,0)');c.fillStyle=g;c.beginPath();c.moveTo(w*.3,0);c.lineTo(0,h);c.lineTo(w,h);c.lineTo(w*.7,0);c.fill()},{lin:1})}
function texSea(){return tex('seaN',256,256,(c,w,h)=>{const img=c.createImageData(w,h),d=img.data;
  const H=(x,y)=>Math.sin(x*.098+y*.031)*.5+Math.sin(x*.041-y*.083)*.35+Math.sin((x+y)*.161)*.2+Math.sin(x*.25-y*.19)*.1;
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){const dx=H(x+1,y)-H(x-1,y),dy=H(x,y+1)-H(x,y-1),i=(y*w+x)*4;d[i]=128+dx*90;d[i+1]=128+dy*90;d[i+2]=255;d[i+3]=255}c.putImageData(img,0,0)},{lin:1})}
// sky panorama (equirectangular): gradient, sun or moon, clouds or stars
function texSky(id){const L=LOOK[id];return tex('sky'+id,1024,512,(c,w,h)=>{
  const r=C.rng(id.length*31),g=c.createLinearGradient(0,0,0,h*.5);
  const st={coast:['#2a6bc4','#5f9fe0','#cfe4f4'],ridge:['#2c2350','#b0507a','#ffc08a'],night:['#020414','#0a1238','#2a1f55']}[id];
  g.addColorStop(0,st[0]);g.addColorStop(.6,st[1]);g.addColorStop(1,st[2]);c.fillStyle=g;c.fillRect(0,0,w,h*.5);
  c.fillStyle='#'+L.fog.toString(16).padStart(6,'0');c.fillRect(0,h*.5,w,h*.5);
  const sx=L.sunAt[0]*w,sy=L.sunAt[1]*h;
  if(id==='night'){
    for(let k=0;k<700;k++){const y=r()*h*.47,a=.25+r()*.75*(1-y/(h*.5));c.fillStyle=`rgba(255,255,255,${a})`;const s=r()<.08?2:1;c.fillRect(r()*w,y,s,s)}
    const mg=c.createRadialGradient(sx,sy,4,sx,sy,90);mg.addColorStop(0,'rgba(220,230,255,.6)');mg.addColorStop(1,'rgba(0,0,0,0)');c.fillStyle=mg;c.fillRect(sx-90,sy-90,180,180);
    c.fillStyle='#f2f0ff';c.beginPath();c.arc(sx,sy,11,0,7);c.fill();c.fillStyle='rgba(10,18,56,.85)';c.beginPath();c.arc(sx+5,sy-3,10,0,7);c.fill();
    const hg=c.createLinearGradient(0,h*.38,0,h*.5);hg.addColorStop(0,'rgba(255,150,90,0)');hg.addColorStop(1,'rgba(255,150,90,.28)');c.fillStyle=hg;c.fillRect(0,h*.38,w,h*.12);
  }else{
    const big=id==='ridge'?150:110,sg=c.createRadialGradient(sx,sy,2,sx,sy,big);sg.addColorStop(0,'rgba(255,255,245,1)');sg.addColorStop(.1,id==='ridge'?'rgba(255,220,150,.95)':'rgba(255,250,230,.9)');sg.addColorStop(.35,id==='ridge'?'rgba(255,170,110,.35)':'rgba(255,255,240,.2)');sg.addColorStop(1,'rgba(255,255,255,0)');
    c.fillStyle=sg;c.fillRect(sx-big,sy-big,big*2,big*2);
    const cc=id==='ridge'?['255,190,160','255,140,140']:['255,255,255','235,242,252'];
    for(let k=0;k<46;k++){const y=h*(.24+r()*.23),x=r()*w,s=10+r()*26*(y/h*2.2);for(let j=0;j<6;j++){c.fillStyle=`rgba(${cc[j%2]},${.18+r()*.3})`;c.beginPath();c.ellipse(x+j*s*.6-s*1.5,y+Math.sin(j*1.7)*s*.18,s*(1.05-Math.abs(j-2.5)*.14),s*.36,0,0,7);c.fill()}}
  }
})}
function envCube(L){
  const[top,hor,gnd]=L.env,f=k=>{const cv=document.createElement('canvas');cv.width=cv.height=64;const x=cv.getContext('2d');
    if(k==='t'){x.fillStyle=top;x.fillRect(0,0,64,64)}else if(k==='b'){x.fillStyle=gnd;x.fillRect(0,0,64,64)}
    else{const g=x.createLinearGradient(0,0,0,64);g.addColorStop(0,top);g.addColorStop(.46,hor);g.addColorStop(.54,gnd);g.addColorStop(1,gnd);x.fillStyle=g;x.fillRect(0,0,64,64);
      if(k==='s'){x.fillStyle='rgba(255,248,230,.95)';x.beginPath();x.arc(36,20,6,0,7);x.fill()}}return cv};
  const t=new THREE.CubeTexture([f('s'),f(),f('t'),f('b'),f(),f()]);t.encoding=THREE.sRGBEncoding;t.needsUpdate=true;return t;
}

/* =================== scenery pieces (vertex-coloured, flat-shaded, instanced) =================== */
function colGeo(g,hex,jit=0,r){g=g.index?g.toNonIndexed():g;g.computeVertexNormals();const n=g.attributes.position.count,a=new Float32Array(n*3),c=lin(hex);
  for(let i=0;i<n;i+=3){const k=jit?1+(r()-.5)*jit*2.5:1;for(let j=0;j<3;j++){a[(i+j)*3]=c.r*k;a[(i+j)*3+1]=c.g*k;a[(i+j)*3+2]=c.b*k}}g.setAttribute('color',new THREE.BufferAttribute(a,3));return g}
function mergeCol(list){let n=0;list.forEach(g=>n+=g.attributes.position.count);const P=new Float32Array(n*3),N=new Float32Array(n*3),Cc=new Float32Array(n*3);let o=0;
  list.forEach(g=>{P.set(g.attributes.position.array,o*3);N.set(g.attributes.normal.array,o*3);Cc.set(g.attributes.color.array,o*3);o+=g.attributes.position.count;g.dispose()});
  const G=new THREE.BufferGeometry();G.setAttribute('position',new THREE.BufferAttribute(P,3));G.setAttribute('normal',new THREE.BufferAttribute(N,3));G.setAttribute('color',new THREE.BufferAttribute(Cc,3));G.computeBoundingSphere();return G}
const PROPS={};
function props(){
  if(PROPS.round)return PROPS;const r=C.rng(42),T=THREE;
  const ico=(rad,x,y,z,sy=1,col='#4f8f3a')=>{const g=new T.IcosahedronGeometry(rad,0);g.scale(1,sy,1);g.translate(x,y,z);return colGeo(g,col,.07,r)};
  const trunk=(r1,r2,h,col='#6b4a2e')=>{const g=new T.CylinderGeometry(r1,r2,h,6);g.translate(0,h/2,0);return colGeo(g,col,.03,r)};
  PROPS.round=mergeCol([trunk(.18,.28,2.6),ico(1.9,0,3.7,0,.85,'#4f8f3a'),ico(1.3,.95,3.1,.35,.9,'#5b9a40'),ico(1.35,-.85,3.25,-.4,.9,'#467f34'),ico(1.1,.1,4.8,.2,.9,'#62a347')]);
  PROPS.bush=mergeCol([ico(1.0,0,.55,0,.65,'#4a8836'),ico(.75,.7,.45,.2,.7,'#579a3e'),ico(.7,-.6,.4,-.2,.7,'#437c31')]);
  const cone=(rad,h,y,col)=>{const g=new T.ConeGeometry(rad,h,7);g.translate(0,y+h/2,0);return colGeo(g,col,.05,r)};
  PROPS.pine=mergeCol([trunk(.16,.24,2),cone(1.7,2.8,1.5,'#3d6b3a'),cone(1.35,2.4,2.9,'#447541'),cone(.95,2.1,4.2,'#4c7e47')]);
  PROPS.cypress=mergeCol([trunk(.12,.18,1),cone(.85,6.5,.6,'#4f6e34')]);
  const pal=[trunk(.14,.2,1,'#8a6a44')];
  // palm: curved trunk + drooping leaves
  for(let k=0;k<6;k++){const g=new T.CylinderGeometry(.13-k*.008,.15-k*.008,1.3,6);g.translate(k*.07,1+k*1.2,0);pal.push(colGeo(g,'#8a6a44',.04,r))}
  for(let k=0;k<9;k++){const a=k/9*Math.PI*2,droop=.45+(k%3)*.18;[[0,1.2,.15],[1.15,1.5,droop]].forEach(([x0,len,tilt],j)=>{const g=new T.ConeGeometry(.36-j*.08,len,4);g.rotateZ(-Math.PI/2);g.scale(1,.22,1);g.translate(len/2,0,0);g.rotateZ(-tilt);g.translate(j?1.1:0,j?-.2:0,0);g.rotateY(a);g.translate(.42,7.9,0);pal.push(colGeo(g,k%2?'#4f9a3a':'#3f8a32',.05,r))})}
  PROPS.palm=mergeCol(pal);
  PROPS.rock=mergeCol([(()=>{const g=new T.DodecahedronGeometry(1,0);g.scale(1.3,.75,1);g.translate(0,.35,0);return colGeo(g,'#8a8478',.08,r)})()]);
  // lamp post: pole + arm over the road (+x side); head drawn separately so it can glow
  const pole=new T.CylinderGeometry(.09,.13,8.4,6);pole.translate(0,4.2,0);const arm=new T.BoxGeometry(2.6,.12,.12);arm.translate(-1.25,8.3,0);
  PROPS.lamp=mergeCol([colGeo(pole,'#4a4d58',0,r),colGeo(arm,'#4a4d58',0,r)]);
  // guard-rail post and wall-cap
  PROPS.post=mergeCol([(()=>{const g=new T.BoxGeometry(.14,.85,.14);g.translate(0,.42,0);return colGeo(g,'#8c9198',0,r)})()]);
  return PROPS;
}
// smooth value noise
function vnoise(seed){
  const H=(i,j)=>{let h=Math.imul(i,374761393)+Math.imul(j,668265263)+Math.imul(seed,1442695041);h=Math.imul(h^h>>>13,1274126177);return((h^h>>>16)>>>0)/4294967296*2-1};
  return(x,y)=>{const xi=Math.floor(x),yi=Math.floor(y),xf=x-xi,yf=y-yi,u=xf*xf*(3-2*xf),v=yf*yf*(3-2*yf);const a=H(xi,yi),b=H(xi+1,yi),c=H(xi,yi+1),d=H(xi+1,yi+1);return a+(b-a)*u+(c-a)*v+(a-b-c+d)*u*v};
}

/* =================== the 3D world =================== */
const SEA=-42;   // sea level (the road wanders between about -27 m and +27 m)
const OFFS=[9.05,10.4,13,17.5,24,33,45,62,86,118,158,200];
class World{
  constructor(cv){
    const r=this.r=new THREE.WebGLRenderer({canvas:cv,antialias:true,powerPreference:'high-performance'});
    r.setPixelRatio(Math.min(devicePixelRatio||1,TOUCH_UI?1.5:1.75));   // phones: a little softer, a lot fasterr.outputEncoding=THREE.sRGBEncoding;r.toneMapping=THREE.ACESFilmicToneMapping;
    this.cam=new THREE.PerspectiveCamera(62,1.6,.3,3600);this.sc=new THREE.Scene();this.w=this.h=0;
    this.ox=0;this.oz=0;this.chunks=new Map();this.camP=null;this.shake=0;this.fov=62;
  }
  resize(){const cv=this.r.domElement,w=cv.clientWidth,h=cv.clientHeight;if(w&&h&&(w!==this.w||h!==this.h)){this.w=w;this.h=h;this.r.setSize(w,h,false);this.cam.aspect=w/h;this.cam.updateProjectionMatrix()}}
  /* ---- build a run ---- */
  load(route,road,traffic){
    this.clear();
    const R=this.R=ROUTES.find(q=>q.id===route)||ROUTES[0],L=this.L=LOOK[R.id],sc=this.sc=new THREE.Scene(),T=THREE;
    this.road=road;this.traffic=traffic;this.N=vnoise(road.seed);this.ox=this.oz=0;this.camP=null;
    this.r.toneMappingExposure=L.exp;
    sc.background=new T.Color(L.fog);sc.fog=new T.FogExp2(lin(L.fog),L.fogD);
    sc.environment=this.env=envCube(L);
    sc.add(new T.HemisphereLight(lin(L.hemi[0]),lin(L.hemi[1]),L.hemi[2]));
    const sun=new T.DirectionalLight(lin(L.sun[0]),L.sun[1]);
    const ph=L.sunAt[0]*Math.PI*2,th=L.sunAt[1]*Math.PI;sun.position.set(-Math.cos(ph)*Math.sin(th),Math.cos(th),Math.sin(ph)*Math.sin(th));sc.add(sun);this.sun=sun;
    // sky dome follows the camera
    this.sky=new T.Mesh(new T.SphereGeometry(3000,40,20),new T.MeshBasicMaterial({map:texSky(R.id),side:T.BackSide,fog:false,depthWrite:false,toneMapped:false}));this.sky.renderOrder=-2;sc.add(this.sky);
    // far mountain ring (lower on the sea side)
    if(L.ranges){const ring=new T.Group();[[2200,1,L.mtn[0],.9],[1700,2,L.mtn[1],.55]].forEach(([rad,k,col,hm])=>{
      const M=96,P=[],Cc=[],c0=lin(col),c1=lin(L.fog),nz=vnoise(k*7+road.seed%97);
      for(let q=0;q<=M;q++){const a=q/M*Math.PI*2,x=Math.cos(a)*rad,z=Math.sin(a)*rad;let h=(120+90*nz(a*3,k)+60*nz(a*9,k+5))*hm*(rad/1700);
        if(R.L==='sea')h*=clamp((Math.cos(a)+.25)/.6,0,1);P.push(x,-260,z,x,h,z);const top=c0.clone().lerp(c1,k===1?.35:.5),bot=c0.clone().lerp(c1,.85);Cc.push(bot.r,bot.g,bot.b,top.r,top.g,top.b)}
      const I=[];for(let q=0;q<M;q++){const a=q*2;I.push(a,a+1,a+2,a+1,a+3,a+2)}
      const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(P,3));g.setAttribute('color',new T.Float32BufferAttribute(Cc,3));g.setIndex(I);
      const m=new T.Mesh(g,new T.MeshBasicMaterial({vertexColors:true,fog:false,side:T.DoubleSide,depthWrite:false,toneMapped:false}));m.renderOrder=-1;ring.add(m)});sc.add(ring);this.ring=ring}
    // sea
    if(R.L==='sea'){const nt=texSea();nt.repeat.set(60,60);
      this.sea=new T.Mesh(new T.PlaneGeometry(6000,6000),linMat(new T.MeshStandardMaterial({color:L.sea,roughness:.2,metalness:.15,normalMap:nt,normalScale:new T.Vector2(.55,.55)})));
      this.sea.rotation.x=-Math.PI/2;this.sea.position.y=SEA;sc.add(this.sea)}
    // shared materials
    const M=this.M={
      road:new T.MeshStandardMaterial({map:texRoad(L,R.id),roughness:R.id==='night'?.6:.85,metalness:0}),
      grav:new T.MeshLambertMaterial({map:texGravel(L,R.id)}),
      ground:new T.MeshLambertMaterial({vertexColors:true,map:texDetail()}),
      prop:new T.MeshLambertMaterial({vertexColors:true}),
      post:new T.MeshLambertMaterial({vertexColors:true}),   // own material: three r128 keeps one shader per material, and only some prop meshes carry per-instance colours
      rail:linMat(new T.MeshStandardMaterial({color:0xc4c9d0,metalness:.75,roughness:.35,side:T.DoubleSide})),
      wall:new T.MeshLambertMaterial({map:texStone(L,R.id),side:T.DoubleSide}),
      chev:new T.MeshLambertMaterial({map:texChev(),side:T.DoubleSide}),
      lampHead:linMat(new T.MeshBasicMaterial({color:0xffe2a8})),
      pool:new T.MeshBasicMaterial({map:texPool(),transparent:true,blending:T.AdditiveBlending,depthWrite:false,fog:false}),
      stud:linMat(new T.MeshBasicMaterial({color:0xffc84a})),
      city:new T.PointsMaterial({size:2.6,vertexColors:true,transparent:true,opacity:.95,depthWrite:false,blending:T.AdditiveBlending})
    };
    this.buildTraffic();
    this.blobs=this.inst(new T.PlaneGeometry(1,1).rotateX(-Math.PI/2),new T.MeshBasicMaterial({map:texBlob(),transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2}),90);this.blobs.renderOrder=1;
    this.fx=new FX(sc);
    this.cars=new T.Group();sc.add(this.cars);
  }
  inst(geo,mat,n){const m=new THREE.InstancedMesh(geo,mat,n);m.count=0;m.frustumCulled=false;m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);this.sc.add(m);return m}
  clear(){
    for(const[,c]of this.chunks)this.dropChunk(c);this.chunks.clear();
    if(this.sc)this.sc.traverse(o=>{if(o.geometry&&!o.geometry.userData.keep&&!Object.values(PROPS).includes(o.geometry))o.geometry.dispose()});
    [this.M,this.TMAT].forEach(S=>{if(S)for(const k in S)S[k].dispose()});this.M=this.TMAT=null;
    if(this.TM)for(const t in this.TM)this.TM[t].meshes.forEach(m=>m.dispose&&m.dispose());
    this.TM=null;this.player=null;this.rival=null;
  }
  /* ---- traffic: instanced, one set of meshes per vehicle type ---- */
  buildTraffic(){
    const T=THREE,night=this.R.id==='night';
    const TMAT=this.TMAT={
      paint:linMat(new T.MeshPhysicalMaterial({color:0xffffff,metalness:.4,roughness:.36,clearcoat:.9,clearcoatRoughness:.08})),
      glass:linMat(new T.MeshPhysicalMaterial({color:0x0b1118,metalness:.3,roughness:.06,clearcoat:1})),
      dark:linMat(new T.MeshStandardMaterial({color:0x111214,roughness:.6})),rubber:linMat(new T.MeshStandardMaterial({color:0x161616,roughness:.92})),
      metal:linMat(new T.MeshStandardMaterial({color:0xcfd3d9,metalness:1,roughness:.25})),white:linMat(new T.MeshStandardMaterial({color:0xf0f0ec,roughness:.5})),
      lightF:linMat(new T.MeshStandardMaterial({color:0xffffff,emissive:0xfff3dc,emissiveIntensity:night?3.2:1.1})),
      lightR:linMat(new T.MeshStandardMaterial({color:0x7a0010,emissive:0xff1428,emissiveIntensity:night?2.6:1.1}))};
    this.TM={};
    for(const t of['sedan','hatch','suv','van','bus','truck']){
      const V=SSCars.traffic(t),cap=t==='bus'||t==='truck'?16:40,meshes=[];
      for(const k in V.geo){const m=this.inst(V.geo[k],TMAT[k],cap);m.geometry.userData.keep=1;meshes.push(m);if(k==='paint'){m.setColorAt(0,new T.Color(1,1,1));this.TM[t]={paint:m}}}   // every paint mesh gets its colour buffer up front (r128 shares one shader per material)
      Object.assign(this.TM[t],{meshes,cap});
    }
    if(night){this.beams=this.inst(new T.PlaneGeometry(3.4,16).rotateX(-Math.PI/2).translate(0,0,8),new T.MeshBasicMaterial({map:texBeam(),transparent:true,depthWrite:false,blending:T.AdditiveBlending,fog:true,polygonOffset:true,polygonOffsetFactor:-3}),70);this.beams.renderOrder=2}
  }
  /* ---- road frame: world point at distance s, lateral lat, height h (relative to the floating origin) ---- */
  P(s,lat,h,out){const p=this.road.at(s),c=Math.cos(p.th),sn=Math.sin(p.th);out=out||{};out.x=p.x+c*lat-this.ox;out.y=p.y+(h||0);out.z=p.z+sn*lat-this.oz;out.th=p.th;out.ry=p.y;return out}
  /* ---- terrain cross-section: absolute height at offset o (m from the centre) on one side ---- */
  hAt(kind,o,s,ry){
    const N=this.N,n=.65*N(s/55,o/38)+.35*N(s/19+40,o/13),k=clamp((o-12)/40,0,1);
    const tab=(B)=>{let i=0;while(i<OFFS.length-2&&o>OFFS[i+1])i++;const t=clamp((o-OFFS[i])/(OFFS[i+1]-OFFS[i]),0,1);return B[i]+(B[i+1]-B[i])*t};
    if(kind==='hill')return ry+tab([-.05,.3,1.6,4.2,8.4,14.5,23,35,50,66,82,95])+n*(1+k*12);
    if(kind==='mesa')return ry+tab([-.05,.35,2.6,7.5,15,25,36,47,57,64,70,74])+n*(.8+k*9);
    if(kind==='valley')return ry+tab([-.05,-.35,-1.8,-4.6,-9.5,-16,-25,-37,-50,-58,-55,-30])+n*(.6+k*8);
    // sea: grassy verge, a cliff down to a beach, then under the water
    const b=SEA+1.3;
    if(o<=10.4)return ry+tab([-.05,-.25]);
    if(o<=33){const t=clamp((o-10.4)/(33-10.4),0,1),e=t*t*(3-2*t);return lerp(ry-.6,b+1.4,e)+n*(1.2+3*Math.sin(t*Math.PI))}
    return lerp(b+1.4,SEA-16,clamp((o-33)/167,0,1)**.7)+n*.6;
  }
  colAt(kind,o,h,ry,s){
    const L=this.L,N=this.N,n=N(s/31+9,o/17),g=L.grass,gi=Math.floor((n*.5+.5)*3.99);
    let c=new THREE.Color(g[clamp(gi,0,3)]);   // mixed in sRGB, converted to linear at the end
    if(o<10.5)c.lerp(new THREE.Color(L.grav),.35);
    if(kind==='sea'){if(o>12&&o<=33){const t=clamp((o-12)/8,0,1);c.lerp(new THREE.Color(L.rock),t*(.75+.25*n))}if(h<SEA+3.2&&o>20)c.set(L.sand);if(h<SEA)c.set(L.deep)}
    else if(kind==='mesa'){if(o>13){const band=Math.sin(h*.55)*.5+.5;c=new THREE.Color(L.rock).lerp(new THREE.Color(L.sand),band*.45+n*.1)}}
    else if(N(s/70,o/30)>.42&&o>14)c.lerp(new THREE.Color(L.rock),.6);
    const dark=1-Math.min(.22,(o-9)/900);c.multiplyScalar(dark*(.93+n*.07));return c.convertSRGBToLinear();
  }
  /* ---- chunks: 90 m of road, verges, terrain and scenery ---- */
  buildChunk(k){
    const T=THREE,s0=k*CH,R=this.R,L=this.L,rows=[],step=3,n=CH/step;
    const base=this.road.at(s0);
    for(let i=0;i<=n;i++){const s=s0+i*step,p=this.road.at(s);rows.push({s,x:p.x-base.x,z:p.z-base.z,y:p.y,c:Math.cos(p.th),sn:Math.sin(p.th),th:p.th})}
    const G={pos:[],uv:[],idx:[]},grav={pos:[],uv:[],idx:[]},ter={pos:[],col:[],uv:[],idx:[]};
    const v=(B,x,y,z,u,w)=>{B.pos.push(x,y,z);B.uv.push(u,w);return B.pos.length/3-1};
    const strip=(B,cols,fn)=>{const W=cols.length;B.st=B.pos.length/3;for(let i=0;i<=n;i++)cols.forEach((c,j)=>fn(rows[i],c,j,i));for(let i=0;i<n;i++)for(let j=0;j<W-1;j++){const a=B.st+i*W+j,b=a+1,c=a+W,d=c+1;B.idx.push(a,b,c,b,d,c)}};
    const rh=CFG.roadHalf,sh=rh+CFG.shoulder;
    strip(G,[-rh,rh],(r,lat)=>v(G,r.x+r.c*lat,r.y,r.z+r.sn*lat,(lat+rh)/(2*rh),r.s/16));
    // gravel verges (both sides in one mesh)
    [[-sh,-rh],[rh,sh]].forEach(cols=>{const st=grav.pos.length/3;const W=2;for(let i=0;i<=n;i++)cols.forEach(lat=>{const r=rows[i];grav.pos.push(r.x+r.c*lat,r.y-.03,r.z+r.sn*lat);grav.uv.push(lat/2,r.s/4)});
      for(let i=0;i<n;i++){const a=st+i*W,b=a+1,c=a+W,d=c+1;grav.idx.push(a,b,c,b,d,c)}});
    // terrain: left side (offsets negative) and right side, with vertex colours
    const sides=[[R.L,-1],[R.R,1]];
    sides.forEach(([kind,sd])=>{const st=ter.pos.length/3,W=OFFS.length;
      for(let i=0;i<=n;i++){const r=rows[i];OFFS.forEach(o=>{const h=this.hAt(kind,o,r.s,r.y),lat=sd*o,cl=this.colAt(kind,o,h,r.y,r.s);
        ter.pos.push(r.x+r.c*lat,h-.04,r.z+r.sn*lat);ter.col.push(cl.r,cl.g,cl.b);ter.uv.push(lat/6,r.s/6)})}
      for(let i=0;i<n;i++)for(let j=0;j<W-1;j++){const a=st+i*W+j,b=a+1,c=a+W,d=c+1;if(sd<0)ter.idx.push(a,c,b,b,c,d);else ter.idx.push(a,b,c,b,d,c)}});
    const mk=(B,mat,col)=>{const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(B.pos,3));if(B.uv)g.setAttribute('uv',new T.Float32BufferAttribute(B.uv,2));if(col)g.setAttribute('color',new T.Float32BufferAttribute(B.col,3));g.setIndex(B.idx);g.computeVertexNormals();return new T.Mesh(g,mat)};
    const grp=new T.Group();grp.position.set(base.x-this.ox,0,base.z-this.oz);
    grp.add(mk(G,this.M.road),mk(grav,this.M.grav),mk(ter,this.M.ground,true));
    // barriers: guard rail on a drop, stone wall on a hillside
    const barrier=(lat,type)=>{
      if(type==='rail'){const B={pos:[],uv:[],idx:[]};strip(B,[.42,.78],(r,hh)=>v(B,r.x+r.c*lat,r.y+hh,r.z+r.sn*lat,0,0));grp.add(mk(B,this.M.rail));
        const posts=new T.InstancedMesh(props().post,this.M.post,n/2+1);const d=new T.Object3D();let q=0;for(let i=0;i<=n;i+=2){const r=rows[i];d.position.set(r.x+r.c*(lat+Math.sign(lat)*.1),r.y,r.z+r.sn*(lat+Math.sign(lat)*.1));d.rotation.set(0,-r.th,0);d.updateMatrix();posts.setMatrixAt(q++,d.matrix)}posts.count=q;grp.add(posts)}
      else{const o=Math.sign(lat),F={pos:[],uv:[],idx:[]},Tp={pos:[],uv:[],idx:[]};
        strip(F,[0,1],(r,j)=>v(F,r.x+r.c*lat,r.y-.1+j*1.05,r.z+r.sn*lat,r.s/4,j));
        strip(Tp,[0,1],(r,j)=>{const l=lat+o*j*.5;return v(Tp,r.x+r.c*l,r.y+.95,r.z+r.sn*l,r.s/4,j*.45)});
        grp.add(mk(F,this.M.wall),mk(Tp,this.M.wall))}
    };
    const bL=R.L==='sea'||R.L==='valley'?'rail':'wall',bR=R.R==='hill'||R.R==='mesa'?'wall':'rail';
    barrier(-9.25,bL);barrier(9.3,bR);
    // scenery: trees, bushes, rocks, lamps, curve signs
    const rng=C.rng(k*7919+this.road.seed),P=props(),put={},add=(key,x,y,z,ry,s,sy,col)=>{(put[key]=put[key]||[]).push([x,y,z,ry,s,sy||s,col])};
    const place=(kind,sd,o,i)=>{const r=rows[i],h=this.hAt(kind,o,r.s,r.y),lat=sd*o;return[r.x+r.c*lat,h-.15,r.z+r.sn*lat]};
    sides.forEach(([kind,sd])=>{
      const dense=kind==='hill'?28:kind==='mesa'?10:kind==='valley'?16:5;
      for(let q=0;q<dense;q++){const i=Math.floor(rng()*n),o=kind==='sea'?11.5+rng()*4.5:12+Math.pow(rng(),1.5)*170;const[x,y,z]=place(kind,sd,o,i);
        if(y<SEA+2)continue;
        let t=L.trees;if(kind==='mesa')t=rng()<.5?'cypress':'rock';else if(R.id==='coast'&&(kind==='sea'||rng()<.12))t='palm';else if(rng()<.3)t='bush';
        if(t==='rock'){const sz=1.2+rng()*2.2;add('rock',x,y-sz*.45,z,rng()*6,sz,sz*(.7+rng()*.5),0xb07a5e)}
        else add(t,x,y,z,rng()*6,.8+rng()*.6,0,null);}
      if(kind!=='sea')for(let q=0;q<6;q++){const i=Math.floor(rng()*n),o=10.8+rng()*3;const[x,y,z]=place(kind,sd,o,i);add('bush',x,y,z,rng()*6,.5+rng()*.4)}
    });
    if(L.lamps){const lamps=[],pools=[];for(let i=(((k%2)+2)%2)*6;i<=n;i+=12){const r=rows[i],sd=(Math.floor(r.s/36)%2)?1:-1,lat=sd*9.9;
        add('lamp',r.x+r.c*lat,r.y,r.z+r.sn*lat,-r.th+(sd>0?0:Math.PI),1,1);const hl=sd*7.4;lamps.push([r.x+r.c*hl,r.y+8.15,r.z+r.sn*hl,-r.th]);const pl=sd*6.2;pools.push([r.x+r.c*pl,r.y+.04,r.z+r.sn*pl])}
      const hg=new T.BoxGeometry(1.2,.22,.5),hm=new T.InstancedMesh(hg,this.M.lampHead,lamps.length),pm=new T.InstancedMesh(new T.PlaneGeometry(17,17).rotateX(-Math.PI/2),this.M.pool,pools.length),d=new T.Object3D();
      lamps.forEach((p,i)=>{d.position.set(p[0],p[1],p[2]);d.rotation.set(0,p[3],0);d.updateMatrix();hm.setMatrixAt(i,d.matrix)});
      pools.forEach((p,i)=>{d.position.set(p[0],p[1],p[2]);d.rotation.set(0,0,0);d.updateMatrix();pm.setMatrixAt(i,d.matrix)});pm.renderOrder=2;grp.add(hm,pm);
      // cat's-eye studs on the centre line
      const st=[];for(let i=0;i<=n;i+=3){const r=rows[i];st.push([r.x,r.y+.03,r.z,-r.th])}const sm=new T.InstancedMesh(new T.BoxGeometry(.14,.05,.1),this.M.stud,st.length);st.forEach((p,i)=>{d.position.set(p[0],p[1],p[2]);d.rotation.set(0,p[3],0);d.updateMatrix();sm.setMatrixAt(i,d.matrix)});grp.add(sm)}
    if(L.city&&R.L==='valley'){const Pp=[],Cc=[];for(let q=0;q<140;q++){const i=Math.floor(rng()*n),o=70+rng()*130,[x,y,z]=place('valley',-1,o,i);Pp.push(x,y+1.5,z);const c=lin([0xffd27a,0xfff1c8,0xffb060,0x9fd8ff][Math.floor(rng()*4)]);Cc.push(c.r,c.g,c.b)}
      const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(Pp,3));g.setAttribute('color',new T.Float32BufferAttribute(Cc,3));grp.add(new T.Points(g,this.M.city))}
    // chevron boards on the outside of sharp bends
    const ch=[];for(let i=1;i<n;i+=4){const r=rows[i],kp=this.road.kappa(r.s);if(Math.abs(kp)>.0024){const sd=kp>0?-1:1,lat=sd*10.1;ch.push([r.x+r.c*lat,r.y+1.35,r.z+r.sn*lat,-r.th+(sd>0?-Math.PI/2:Math.PI/2),kp>0?1:-1])}}
    if(ch.length){const bm=new T.InstancedMesh(new T.PlaneGeometry(1.7,.85),this.M.chev,ch.length),d=new T.Object3D();ch.forEach((p,i)=>{d.position.set(p[0],p[1],p[2]);d.rotation.set(0,p[3],0);d.scale.set(p[4],1,1);d.updateMatrix();bm.setMatrixAt(i,d.matrix)});grp.add(bm)}
    // instance the props
    const d=new T.Object3D(),cc=new T.Color();
    for(const key in put){const list=put[key],m=new T.InstancedMesh(P[key],this.M.prop,list.length);
      list.forEach((p,i)=>{d.position.set(p[0],p[1],p[2]);d.rotation.set(0,p[3],0);d.scale.set(p[4],p[5],p[4]);d.updateMatrix();m.setMatrixAt(i,d.matrix);
        if(p[6]!=null)cc.set(p[6]).lerp(new T.Color(1,1,1),.55).convertSRGBToLinear();else{const j=.85+rng()*.3;cc.setRGB(j,j,j);if(R.id==='night')cc.multiplyScalar(.75)}m.setColorAt(i,cc)});
      if(m.instanceColor)m.instanceColor.needsUpdate=true;grp.add(m)}
    grp.userData={k,base:{x:base.x,z:base.z}};
    this.sc.add(grp);return grp;
  }
  dropChunk(c){this.sc.remove(c);c.traverse(o=>{if(o.geometry&&!o.isInstancedMesh)o.geometry.dispose();else if(o.isInstancedMesh){if(!Object.values(PROPS).includes(o.geometry)&&o.geometry!==PROPS.post)o.geometry.dispose();o.dispose&&o.dispose()}})}
  updateChunks(s,all){
    const k0=Math.floor((s-70)/CH),k1=Math.floor((s+820)/CH);let built=0;
    for(const[k,c]of this.chunks)if(k<k0-1||k>k1+1){this.dropChunk(c);this.chunks.delete(k)}
    for(let k=k0;k<=k1;k++){if(k<-1||this.chunks.has(k))continue;if(!all&&built>=1&&k>Math.floor(s/CH)+1)break;this.chunks.set(k,this.buildChunk(k));built++}
  }
  // keep coordinates small (float precision): move the origin with the camera
  rebase(){const c=this.cam.position,dx=c.x,dz=c.z;if(Math.abs(dx)<1500&&Math.abs(dz)<1500)return;
    this.ox+=dx;this.oz+=dz;for(const[,ch]of this.chunks){ch.position.x-=dx;ch.position.z-=dz}
    c.x-=dx;c.z-=dz;if(this.camP){this.camP.x-=dx;this.camP.z-=dz;this.camL.x-=dx;this.camL.z-=dz}this.fx.shift(dx,dz)}
  /* ---- per frame ---- */
  placeTraffic(t,s){
    const list=this.traffic.query(t,s-80,s+760),T=this.TM,d=this.dm||(this.dm=new THREE.Object3D()),cc=this.cc||(this.cc=new THREE.Color());
    for(const k in T)T[k].n=0;let nb=0,nbm=0;const p={};
    for(const o of list){
      const c=o.c,M=T[c.type];if(!M||M.n>=M.cap)continue;
      this.P(o.z,o.x,0,p);const onc=o.v<0,sl=this.road.slope(o.z);
      d.position.set(p.x,p.y,p.z);d.rotation.set(onc?Math.atan(sl):-Math.atan(sl),onc?-p.th:Math.PI-p.th,0,'YXZ');d.scale.set(1,1,1);d.updateMatrix();
      for(const m of M.meshes)m.setMatrixAt(M.n,d.matrix);
      cc.setHex(c.type==='bus'?BUSCOL[c.col%4]:c.type==='truck'?TRUCKCOL[c.col%5]:CARCOL[c.col]).convertSRGBToLinear();M.paint.setColorAt(M.n,cc);
      M.n++;
      if(nb<this.blobs.instanceMatrix.count){d.position.y+=.03;d.rotation.set(0,d.rotation.y,0);d.scale.set(c.w*1.25,1,c.l*1.12);d.updateMatrix();this.blobs.setMatrixAt(nb++,d.matrix)}
      if(this.beams&&nbm<70){d.position.y=p.y+.05;d.scale.set(c.type==='bus'||c.type==='truck'?1.2:1,1,1);d.updateMatrix();const off=new THREE.Matrix4().makeTranslation(0,0,c.l/2);d.matrix.multiply(off);this.beams.setMatrixAt(nbm++,d.matrix)}
    }
    for(const k in T){const M=T[k];for(const m of M.meshes){m.count=M.n;m.visible=M.n>0;m.instanceMatrix.needsUpdate=true}if(M.paint.instanceColor)M.paint.instanceColor.needsUpdate=true}   // empty types cost no draw calls
    this.blobN=nb;if(this.beams){this.beams.count=nbm;this.beams.instanceMatrix.needsUpdate=true}
  }
  carPose(car,D,vis,dt){
    // D = {d, x, xv, v, steer, brake, boost, yawX (extra spin when crashed)}
    const p=this.P(D.d,D.x,0),sl=this.road.slope(D.d),yaw=Math.atan2(D.xv,Math.max(4,D.v))+(D.spin||0);
    car.root.position.set(p.x,p.y,p.z);car.root.rotation.set(-Math.atan(sl),Math.PI-p.th-yaw,0,'YXZ');
    // body lean and pitch, wheels
    car.lean=lerp(car.lean||0,clamp(-(D.xv-(car.lxv||0))/dt*.004,-.06,.06),Math.min(1,dt*6));car.lxv=D.xv;
    car.pitch=lerp(car.pitch||0,clamp((D.v-(car.lv||0))/dt*.0025,-.04,.03),Math.min(1,dt*5));car.lv=D.v;
    car.body.rotation.set(-car.pitch,0,car.lean);
    car.wheels.forEach(w=>{w.spin.rotation.x+=D.v*dt/w.r;if(w.front)w.steer.rotation.y=-(D.steer||0)*.32});
    car.setBrake(!!D.brake);car.setBoost(!!D.boost,performance.now()/1000);
    car.root.visible=vis;
    // shadow
    if(vis&&this.blobN<this.blobs.instanceMatrix.count){const d=this.dm;d.position.set(p.x,p.y+.035,p.z);d.rotation.set(0,car.root.rotation.y,0);d.scale.set(2.4,1,car.len*1.1);d.updateMatrix();this.blobs.setMatrixAt(this.blobN++,d.matrix)}
    return p;
  }
  camera(D,mode,dt,v,crowd){
    // crowd: a vehicle is right behind you (it is nudging you along): lift the camera over it
    const back=[6.6,10.5,-.2][mode]-(crowd&&mode<2?1.2:0),up=[2.1,3.4,1.05][mode]+(crowd&&mode<2?2.6:0),look=[12,15,30][mode];
    const k=1-Math.exp(-dt*7),ks=this.cs||(this.cs={lat:D.x,back,up,v});
    if(mode===2||this.camP==null){ks.lat=D.x;ks.back=back;ks.up=up}
    ks.lat=lerp(ks.lat,D.x*(mode===2?1:.85),mode===2?1:k);ks.back=lerp(ks.back,back*(1+Math.min(.22,v/320)),k);ks.up=lerp(ks.up,up,k);
    const db=D.d-ks.back,c=this.P(Math.max(-30,db),ks.lat,0),l=this.P(D.d+look,lerp(ks.lat,D.x,.6),0);
    const ry=Math.max(c.y,this.road.y(D.d)-.4);
    this.camP=new THREE.Vector3(c.x,ry+ks.up,c.z);this.camL=new THREE.Vector3(l.x,l.y+(mode===2?.9:1.0),l.z);
    const cam=this.cam;cam.position.copy(this.camP);
    if(this.shake>0){cam.position.x+=(Math.random()-.5)*this.shake;cam.position.y+=(Math.random()-.5)*this.shake*.6;this.shake=Math.max(0,this.shake-dt*2.5)}
    cam.lookAt(this.camL);
    // tall phone screens get a wider view so the neighbouring lanes stay visible
    const fov=62+11*clamp((v-18)/52,0,1)+(D.boost?6:0)+(mode===2?6:0)+clamp((1-this.cam.aspect)*44,0,24);this.fov=lerp(this.fov,fov,Math.min(1,dt*3));if(Math.abs(cam.fov-this.fov)>.05){cam.fov=this.fov;cam.updateProjectionMatrix()}
    // things that follow the camera
    this.sky.position.copy(cam.position);if(this.ring)this.ring.position.set(cam.position.x,0,cam.position.z);
    if(this.sea){this.sea.position.x=cam.position.x;this.sea.position.z=cam.position.z;const nt=this.sea.material.normalMap,t=performance.now()/1000;nt.offset.set((cam.position.x+this.ox)/100+t*.01,-(cam.position.z+this.oz)/100+t*.006)}
  }
  render(){this.blobs.count=this.blobN;this.blobs.instanceMatrix.needsUpdate=true;this.r.render(this.sc,this.cam)}
  dispose(){this.clear();this.r.dispose()}
}

/* =================== effects: sparks + smoke (pooled points) =================== */
class FX{
  constructor(sc){
    const mk=(n,size,blend,op)=>{const g=new THREE.BufferGeometry(),P=new Float32Array(n*3),Cc=new Float32Array(n*3);g.setAttribute('position',new THREE.BufferAttribute(P,3));g.setAttribute('color',new THREE.BufferAttribute(Cc,3));
      const m=new THREE.Points(g,new THREE.PointsMaterial({size,vertexColors:true,transparent:true,opacity:op,depthWrite:false,blending:blend,sizeAttenuation:true}));m.frustumCulled=false;sc.add(m);return{m,P,Cc,n,list:[]}};
    this.sp=mk(160,.22,THREE.AdditiveBlending,1);this.sm=mk(120,2.2,THREE.NormalBlending,.55);
  }
  emit(sys,x,y,z,vx,vy,vz,life,col){const S=this[sys];if(S.list.length>=S.n)S.list.shift();S.list.push({x,y,z,vx,vy,vz,t:0,life,col})}
  sparks(p,n,dir){for(let i=0;i<n;i++)this.emit('sp',p.x,p.y+.3,p.z,(Math.random()-.5)*8+(dir?dir.x*6:0),2+Math.random()*4,(Math.random()-.5)*8+(dir?dir.z*6:0),.35+Math.random()*.35,[1,.7+Math.random()*.3,.3])}
  smoke(p,n,dark){for(let i=0;i<n;i++)this.emit('sm',p.x+(Math.random()-.5)*1.5,p.y+.4,p.z+(Math.random()-.5)*1.5,(Math.random()-.5)*1.5,1+Math.random()*1.5,(Math.random()-.5)*1.5,1.4+Math.random(),dark?[.25,.25,.27]:[.8,.8,.8])}
  shift(dx,dz){for(const s of[this.sp,this.sm])for(const p of s.list){p.x-=dx;p.z-=dz}}
  update(dt){for(const S of[this.sp,this.sm]){let j=0;S.list=S.list.filter(p=>(p.t+=dt)<p.life);
    for(const p of S.list){p.vy-=S===this.sp?14*dt:-.4*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.z+=p.vz*dt;const f=1-p.t/p.life;S.P.set([p.x,p.y,p.z],j*3);S.Cc.set([p.col[0]*f,p.col[1]*f,p.col[2]*f],j*3);j++}
    S.m.geometry.setDrawRange(0,j);S.m.geometry.attributes.position.needsUpdate=true;S.m.geometry.attributes.color.needsUpdate=true}}
}

/* =================== engine + wind sound =================== */
const ENG={on:false,
  start(){try{if(!ctx()||this.on)return;const t=AC.currentTime;this.on=true;
    this.g=AC.createGain();this.g.gain.value=0;this.f=AC.createBiquadFilter();this.f.type='lowpass';this.f.frequency.value=700;this.f.Q.value=2;
    this.o1=AC.createOscillator();this.o1.type='sawtooth';this.o2=AC.createOscillator();this.o2.type='square';this.o3=AC.createOscillator();this.o3.type='triangle';
    const g2=AC.createGain();g2.gain.value=.45;const g3=AC.createGain();g3.gain.value=.6;
    this.o1.connect(this.f);this.o2.connect(g2);g2.connect(this.f);this.o3.connect(g3);g3.connect(this.f);this.f.connect(this.g);this.g.connect(SG);
    this.w=AC.createBufferSource();this.w.buffer=NB;this.w.loop=true;this.wf=AC.createBiquadFilter();this.wf.type='bandpass';this.wf.frequency.value=900;this.wf.Q.value=.6;this.wg=AC.createGain();this.wg.gain.value=0;
    this.w.connect(this.wf);this.wf.connect(this.wg);this.wg.connect(SG);
    [this.o1,this.o2,this.o3,this.w].forEach(o=>o.start(t))}catch(e){this.on=false}},
  set(rpm,gas,v,mute){if(!this.on)return;const t=AC.currentTime,f=rpm/60*2;
    this.o1.frequency.setTargetAtTime(f,t,.03);this.o2.frequency.setTargetAtTime(f*.5,t,.03);this.o3.frequency.setTargetAtTime(f*1.5,t,.03);
    this.f.frequency.setTargetAtTime(300+gas*1400+rpm*.18,t,.05);
    this.g.gain.setTargetAtTime(mute?0:.05+gas*.05,t,.08);this.wg.gain.setTargetAtTime(mute?0:Math.min(.16,v*v*.00004),t,.1);this.wf.frequency.setTargetAtTime(500+v*20,t,.1)},
  stop(){if(!this.on)return;this.on=false;try{const t=AC.currentTime;this.g.gain.setTargetAtTime(0,t,.05);this.wg.gain.setTargetAtTime(0,t,.05);const o=[this.o1,this.o2,this.o3,this.w];setTimeout(()=>o.forEach(x=>{try{x.stop()}catch(e){}}),300)}catch(e){}}
};
const SND={
  near(onc){try{if(!ctx()||!sOn)return;const t=AC.currentTime;nz(t,.32,500,.5,SG,'bandpass',1.1,onc?4200:2600);tone(onc?84:79,t+.02,.12,'triangle',.08,SG)}catch(e){}},
  honk(){try{if(!ctx()||!sOn)return;const t=AC.currentTime;[0,.22].forEach(d=>{tone(57,t+d,.18,'square',.05,SG,{lp:1400});tone(61,t+d,.18,'square',.05,SG,{lp:1400})})}catch(e){}},
  crash(){try{if(!ctx()||!sOn)return;const t=AC.currentTime;kick(t,1,SG,90);nz(t,.9,1800,.8,SG,'lowpass',.8,200);nz(t+.05,.5,4000,.35,SG,'highpass');for(let k=0;k<5;k++)tone(70+Math.random()*20|0,t+.05+k*.06,.12,'square',.03,SG,{lp:5000})}catch(e){}},
  scrape(){try{if(!ctx()||!sOn)return;nz(AC.currentTime,.12,3000,.25,SG,'bandpass',3)}catch(e){}},
  nitro(){try{if(!ctx()||!sOn)return;nz(AC.currentTime,.5,300,.35,SG,'bandpass',1,2400)}catch(e){}}
};
const GEARS=[0,11,20,30,41,53,66,200];
function gearOf(v){let g=1;while(g<6&&v>GEARS[g])g++;return g}
function rpmOf(v,gas){if(v<.5)return 900+gas*1800;const g=gearOf(v),lo=GEARS[g-1],hi=g===6?84:GEARS[g];return clamp(1500+(v-lo)/(hi-lo)*5900,900,7800)}

/* =================== the game =================== */
const G_={
  world:null,state:'idle',mode:'solo',keys:{},touch:{l:0,r:0,brake:0,nitro:0,gas:0},steerV:0,camMode:+(store('ssCam')||0)%3,
  // per run
  road:null,traffic:null,me:null,route:'coast',seed:1,t:0,goAt:0,pausedAt:0,paused:false,acc:0,last:0,car:null,
  riv:null,rivCar:null,rbuf:[],rivInfo:null,result:null,net:{last:0}
};
const newSeed=()=>(Math.random()*1e9|0)+1;
function initWorld(){
  if(!G_.world){try{G_.world=new World($('#sscv'))}catch(e){err('WebGL is not available on this device.');return false}}
  return true;
}
function plateText(){return(me.n||'SLIP').toUpperCase().replace(/[^A-Z0-9 ]/g,'').slice(0,8)||'SLIP 01'}
function setupRun(route,seed,startX){
  const W=G_.world;G_.route=route;G_.seed=seed;
  G_.road=new C.Road(seed);G_.traffic=new C.Traffic(seed);
  G_.me=new C.Driver(sel.style,startX);G_.me.spin=0;
  W.load(route,G_.road,G_.traffic);
  if(G_.car)G_.car.dispose();
  G_.car=SSCars.player(sel.style,PAINTS[sel.paint],plateText());W.cars.add(G_.car.root);G_.car.setNight(route==='night');
  if(G_.rivCar){G_.rivCar.dispose();G_.rivCar=null}
  G_.t=0;G_.acc=0;G_.rbuf=[];G_.riv=null;G_.result=null;G_.wreckT=0;G_.steerV=0;G_.lastNear=0;G_.popN=0;
  W.updateChunks(0,true);
  // headlights at night: a real spot light that follows you
  if(route==='night'){const sp=new THREE.SpotLight(0xfff1d6,3.2,90,.42,.5,1.2);sp.position.set(0,1,1.9);G_.car.root.add(sp);sp.target.position.set(0,0,30);G_.car.root.add(sp.target)}
  hud.reset();
}
function startCountdown(at){G_.goAt=at;G_.cdn=null;G_.state='count';G_.paused=false;$('#sspm').hidden=true}
function raceTime(now){return(now-G_.goAt)/1000}

/* ---------- input ---------- */
const typing=e=>e.target&&/INPUT|SELECT|TEXTAREA/.test(e.target.tagName);
addEventListener('keydown',e=>{if($('#ssgame').hidden||typing(e))return;
  if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code))e.preventDefault();
  if(!e.repeat&&(e.code==='KeyP'||e.code==='Escape'))return setPause(!G_.paused);
  if(!e.repeat&&e.code==='KeyC')return cycleCam();
  if((e.code==='ShiftLeft'||e.code==='ShiftRight'||e.code==='Space')&&!G_.keys.nitro&&G_.me&&G_.me.nitro>.05)SND.nitro();
  G_.keys[e.code]=true;if(e.code.startsWith('Shift')||e.code==='Space')G_.keys.nitro=true});
addEventListener('keyup',e=>{G_.keys[e.code]=false;if(e.code.startsWith('Shift')||e.code==='Space')G_.keys.nitro=false});
addEventListener('blur',()=>{G_.keys={};G_.touch={l:0,r:0,brake:0,nitro:0,gas:0};if(G_.state==='run'&&G_.mode==='solo')setPause(true)});
function input(dt){
  if(G_.auto)return G_.auto(G_.t,dt);   // test hook (autopilot), never set during normal play
  const k=G_.keys,t=G_.touch;
  let want=((k.ArrowRight||k.KeyD||t.r)?1:0)-((k.ArrowLeft||k.KeyA||t.l)?1:0);
  // smooth steering: ramps in, snaps back
  const rate=want===0?9:(Math.sign(want)!==Math.sign(G_.steerV)?10:4.2);
  G_.steerV+=clamp(want-G_.steerV,-rate*dt,rate*dt);
  const brake=!!(k.ArrowDown||k.KeyS||t.brake),gasKey=!!(k.ArrowUp||k.KeyW||t.gas);
  return{steer:G_.steerV,gas:brake?0:(autoGas||gasKey?1:0),brake,nitro:!!(k.nitro||t.nitro)};
}
function cycleCam(){G_.camMode=(G_.camMode+1)%3;store('ssCam',G_.camMode);SFX.ui();if(G_.world)G_.world.camP=null;tip(['Chase camera','Far camera','Bumper camera'][G_.camMode],1200)}
function buildPads(){
  const box=$('#sspads');box.hidden=!TOUCH_UI;if(!TOUCH_UI)return;
  box.innerHTML=`<div class="padl"><button class="pb st" data-k="l" aria-label="Steer left">◀</button><button class="pb st" data-k="r" aria-label="Steer right">▶</button></div>
   <div class="padr"><button class="pb ni" data-k="nitro"><b>⚡</b>NITRO</button>${autoGas?'':'<button class="pb gas" data-k="gas"><b>▲</b>GAS</button>'}<button class="pb br" data-k="brake"><b>■</b>BRAKE</button></div>`;
  box.querySelectorAll('.pb').forEach(b=>{const k=b.dataset.k;
    b.addEventListener('pointerdown',e=>{e.preventDefault();try{b.setPointerCapture(e.pointerId)}catch(x){}b.classList.add('act');G_.touch[k]=1;if(k==='nitro'&&G_.me&&G_.me.nitro>.05)SND.nitro()});
    const up=()=>{b.classList.remove('act');G_.touch[k]=0};['pointerup','pointercancel','lostpointercapture'].forEach(n=>b.addEventListener(n,up))});
}

/* ---------- HUD ---------- */
let popT=0,tipT=0;
function pop(txt,cls){const p=$('#sspop'),e=document.createElement('div');e.className='pp '+(cls||'');e.innerHTML=txt;p.append(e);setTimeout(()=>e.remove(),1300);while(p.children.length>3)p.firstChild.remove()}
function tip(t,ms){const e=$('#sstip');e.textContent=t;e.classList.add('on');clearTimeout(tipT);tipT=setTimeout(()=>e.classList.remove('on'),ms||2000)}
function msg(h){const m=$('#ssmsg');if(m.dataset.h!==h){m.dataset.h=h;m.innerHTML=h}}
function flash(col){const f=$('#ssflash');f.style.background=col;f.classList.remove('on');void f.offsetWidth;f.classList.add('on')}
const ARC=Math.PI*80*1.5;   // 270° of an r=80 circle
const hud={
  reset(){this.c={};$('#ssbest').textContent=best(G_.route)?'BEST '+best(G_.route).toLocaleString():'';$('#ssriv').hidden=G_.mode!=='online';$('#sspause').hidden=G_.mode==='online';
    $('#ssrpm').style.strokeDasharray=ARC+' '+ARC;$('#sspop').innerHTML='';msg('');const k=$('#sskeys');k.hidden=TOUCH_UI;k.classList.remove('fade');clearTimeout(this.kt);this.kt=setTimeout(()=>k.classList.add('fade'),9000);
    $('#ssstage').dataset.route=G_.route},
  set(id,v,fn){if(this.c[id]!==v){this.c[id]=v;fn?fn(v):($(id).textContent=v)}},
  update(D,inp){
    const v=D.v,kmh=Math.round(v*3.6),rpm=rpmOf(v,inp?inp.gas:0);
    this.set('#sssc',Math.floor(D.score).toLocaleString());this.set('#ssdist',(D.d/1000).toFixed(2)+' km');
    this.set('#ssmult','×'+D.mult.toFixed(1),x=>{$('#ssmult').textContent=x;$('#ssmult').classList.toggle('hot',D.mult>=2)});
    this.set('#sskmh',String(kmh));this.set('#ssgear',v<.5&&!(inp&&inp.gas)?'N':String(gearOf(v)));
    this.set('rpm',Math.round(rpm/50),()=>{$('#ssrpm').style.strokeDashoffset=ARC*(1-clamp((rpm-800)/7000,0,1));$('#ssrpm').classList.toggle('hi',rpm>6800)});
    this.set('nitro',Math.round(D.nitro*50),()=>{$('#ssnitro i').style.width=(D.nitro*100)+'%';$('#ssnitro').classList.toggle('full',D.nitro>.98)});
    this.set('boost',D.boost,b=>{$('#ssstage').classList.toggle('boost',b)});
    $('#ssspeed').style.opacity=clamp((v-40)/30,0,1)*.9;
    if(G_.mode==='online'){const r=G_.riv,ri=G_.rivInfo;
      this.set('#ssrn',on||'Rival');
      if(r){const gap=Math.round(r.d-D.d);this.set('#ssrs',Math.floor(r.sc||0).toLocaleString()+(r.cr?' · CRASHED':''));this.set('#ssrg',r.cr?'':gap>=0?gap+' m ahead':(-gap)+' m behind')}
      else this.set('#ssrs',opp?'…':'left the game');}
  }
};

/* ---------- loop ---------- */
function frame(now){
  G_.raf=requestAnimationFrame(frame);
  const W=G_.world;if(!W||$('#ssgame').hidden||!G_.road)return;
  W.resize();
  const dtR=Math.min(.05,(now-(G_.last||now))/1000);G_.last=now;
  const D=G_.me;let inp=null;
  if(G_.state==='count'){
    const left=(G_.goAt-now)/1000;
    msg(left>3?`<span class="rd">GET READY</span>`:`<span class="cd">${Math.ceil(left)}</span>`);
    if(Math.ceil(left)!==G_.cdn){G_.cdn=Math.ceil(left);if(left<=3&&left>0)SFX.count()}
    if(left<=0){G_.state='run';msg('<span class="go">GO!</span>');SFX.go();setTimeout(()=>{if(G_.state==='run'||G_.state==='spect')msg('')},700)}
    ENG.set(900+Math.sin(now/90)*60,0,0,false);
  }else if(G_.state==='run'||G_.state==='wreck'||G_.state==='spect'||G_.state==='won'){
    if(!G_.paused){
      let target=raceTime(now);
      if(G_.mode==='solo'&&G_.state==='wreck')target=G_.t+dtR*.3;  // slow motion after a crash (solo only)
      // never jump ahead in time (traffic would teleport onto you): if this device falls behind,
      // the race clock is held back instead, so the game just runs a little slower for a moment
      if(target-G_.t>.25){G_.goAt+=(target-G_.t-.25)*1000;target=G_.t+.25}
      let steps=0;inp=input(dtR);
      while(G_.t+STEP<=target&&steps<30){
        if(G_.auto)inp=G_.auto(G_.t);
        if(D.alive&&G_.state==='run'){const ev=D.step(STEP,inp,G_.road,G_.traffic,G_.t);if(ev.length)events(ev)}
        G_.t+=STEP;steps++;
      }
      if(!D.alive)wreckMove(D,dtR);
    }
  }
  // online: rival + messages
  if(G_.mode==='online'&&G_.state!=='idle'){netSend(now);rivalPose(now);checkOnline()}
  // draw
  const spect=G_.state==='spect'&&G_.riv&&!G_.riv.cr;
  const focus=spect?G_.riv:D;
  W.rebase();W.updateChunks(focus.d,false);
  W.placeTraffic(G_.t,focus.d);
  W.blobN=W.blobN||0;
  const wreckHide=G_.state==='spect'||G_.state==='done'&&G_.mode==='online'&&G_.wreckT>2.5;
  W.carPose(G_.car,{d:D.d,x:D.x,xv:D.alive?D.xv:0,v:D.v,steer:G_.steerV,brake:inp?inp.brake:false,boost:D.boost&&D.alive,spin:D.spin},!wreckHide&&(G_.camMode!==2||!D.alive),dtR);
  if(G_.rivCar&&G_.riv){const r=G_.riv,vis=Math.abs(r.d-focus.d)<700&&!(r.cr&&r.crT>3);W.carPose(G_.rivCar,{d:r.d,x:r.x,xv:r.xv||0,v:r.v||0,brake:r.b,boost:r.n,spin:r.spin||0},vis,dtR);if(G_.rivTag){G_.rivTag.visible=vis}}
  const crowd=G_.traffic.query(G_.t,focus.d-11,focus.d-1).some(o=>Math.abs(o.x-focus.x)<2.6);
  W.camera(focus,spect?0:G_.camMode,dtR,focus.v||0,crowd);
  W.fx.update(dtR);
  W.render();
  hud.update(D,inp);
  ENG.set(rpmOf(D.v,inp?inp.gas:0),inp?inp.gas:0,D.v,!D.alive||G_.paused||G_.state==='done');
}
function events(ev){
  const W=G_.world;
  for(const e of ev){
    if(e.k==='near'){SND.near(e.onc);W.shake=Math.max(W.shake,.18);
      pop(`${e.onc?'HEAD-ON ':''}NEAR MISS${e.close?' <i>INCHES!</i>':''} <b>+${e.pts}</b>${e.combo>1?` <em>×${e.combo}</em>`:''}`,e.onc?'onc':'');
      if(e.type==='bus'||e.type==='truck')setTimeout(()=>tip(e.type==='bus'?'That was a bus!':'That was a truck!',1100),200)}
    else if(e.k==='push'){SND.honk();pop('HONK! <b>Speed up</b>','honk');W.shake=.3}
    else if(e.k==='wall'){if(performance.now()-(G_.lastScr||0)>140){G_.lastScr=performance.now();SND.scrape();W.shake=Math.max(W.shake,.12);const p=W.P(G_.me.d+1.5,G_.me.x+e.side*1,.2);W.fx.sparks(p,6)}}
    else if(e.k==='crash')crash(e.o);
  }
}
function crash(o){
  const D=G_.me,W=G_.world,head=D.crash.head;SND.crash();flash('#fff');W.shake=1.2;
  D.spin=0;D.spinV=(D.crash.dx>0?-1:1)*(3+Math.random()*3);D.v0=D.v;
  const p=W.P(D.d+2,D.x,.5);W.fx.sparks(p,40);W.fx.smoke(p,24,true);
  G_.state='wreck';G_.wreckT=0;msg(`<span class="crash">${head?'HEAD-ON!':'CRASH!'}</span>`);
  if(G_.mode==='online'){NET.ev({e:'sscr',g:myG,sc:Math.floor(D.score),d:Math.round(D.d)});G_.myFinal=Math.floor(D.score)}
  setTimeout(afterCrash,G_.mode==='solo'?1700:2200);
}
function wreckMove(D,dt){
  G_.wreckT+=dt;if(G_.wreckT>4)return;
  // the wreck skids to a stop, spinning
  const k=G_.mode==='solo'?.3:1;D.v=Math.max(0,D.v-D.v0*1.1*dt*k);D.d+=D.v*dt*k;D.spin+=D.spinV*dt*k;D.spinV*=1-1.5*dt*k;
  if(Math.random()<.3){const p=G_.world.P(D.d,D.x,.3);G_.world.fx.smoke(p,1,true)}
}
function afterCrash(){
  if(G_.mode==='solo'){if(G_.state==='wreck')endRun(false)}
  else{if(G_.state!=='wreck')return;if(G_.riv&&!G_.riv.cr&&opp){G_.state='spect';G_.world.camP=null;msg('');tip(`Watching ${on||'your rival'} — they need ${(G_.myFinal||0).toLocaleString()} to beat you`,3500)}else checkOnline(true)}
}
function endRun(){
  const D=G_.me,sc=Math.floor(D.score),b=best(G_.route),nb=sc>b;if(nb)store('ssBest_'+G_.route,sc);
  G_.state='done';ENG.stop();jingle(nb);
  const R=ROUTES.find(r=>r.id===G_.route);
  setOver(nb?'NEW BEST!':'WRECKED!',`<div class="ssres"><b>${sc.toLocaleString()}</b> points on <b>${esc(R.n)}</b><br>${(D.d/1000).toFixed(2)} km · top speed ${Math.round(D.top*3.6)} km/h · ${D.nears} near miss${D.nears===1?'':'es'}${D.onc>50?` · ${Math.round(D.onc)} m on the wrong side`:''}<br><small>${nb?(b?'Old best '+b.toLocaleString():'First run on this road!'):'Best '+b.toLocaleString()}</small></div>`,'Drive again!');
}

/* ---------- online ---------- */
function netSend(now){
  if(now-G_.net.last<50||G_.state==='count'||G_.state==='idle'||G_.state==='done'||G_.state==='wait')return;G_.net.last=now;
  const D=G_.me,q=v=>Math.round(v*100)/100;
  NET.sendFast({f:1,g:myG,t:q(G_.t),d:q(D.d),x:q(D.x),xv:q(D.xv),v:q(D.v),b:G_.keys.ArrowDown||G_.keys.KeyS||G_.touch.brake?1:0,n:D.boost?1:0,cr:D.alive?0:1,sc:Math.floor(D.score),sp:q(D.spin||0)});
}
function fast(d){
  if(phase!=='ssplay'||+d.g!==myG)return;
  const b=G_.rbuf,t=+d.t;if(b.length&&t<=b[b.length-1].t)return;
  b.push({t,d:+d.d,x:+d.x,xv:+d.xv,v:+d.v,b:!!d.b,n:!!d.n,cr:!!d.cr,sc:+d.sc,sp:+d.sp||0});if(b.length>40)b.shift();
}
function rivalPose(now){
  const b=G_.rbuf;if(!b.length)return;
  const tr=G_.t-.12;let a=b[0],z=a,k=0;
  if(tr>=b[b.length-1].t){a=z=b[b.length-1]}else if(tr>b[0].t){for(let i=0;i<b.length-1;i++)if(b[i+1].t>tr){a=b[i];z=b[i+1];break}k=(tr-a.t)/Math.max(1e-3,z.t-a.t)}
  const ex=a===z&&!z.cr?Math.min(.6,Math.max(0,tr-z.t)):0;
  const r=G_.riv||(G_.riv={crT:0});
  Object.assign(r,{d:a.d+(z.d-a.d)*k+z.v*ex,x:a.x+(z.x-a.x)*k,xv:z.xv,v:z.v,b:z.b,n:z.n,sc:Math.max(r.sc||0,z.sc),spin:z.sp});
  if(z.cr&&!r.cr){r.cr=true;r.crT=0;const p=G_.world.P(r.d+2,r.x,.5);G_.world.fx.sparks(p,30);G_.world.fx.smoke(p,16,true);if(G_.me.alive)tip(`${on||'Rival'} crashed! Beat ${Math.floor(r.sc).toLocaleString()} to win`,3500)}
  if(r.cr)r.crT=(r.crT||0)+Math.min(.05,(now-(r.lastNow||now))/1000);r.lastNow=now;
  if(!G_.rivCar||G_.rivCar.key!==rivalKey()){if(G_.rivCar){G_.rivCar.root.parent&&G_.rivCar.root.parent.remove(G_.rivCar.root);G_.rivCar.dispose()}
    const c=(opp&&opp.x&&opp.x.car)||['gt',4];G_.rivCar=SSCars.player(STYLES[c[0]]?c[0]:'gt',PAINTS[(+c[1]||0)%PAINTS.length],String(on||'RIVAL').toUpperCase().slice(0,8));G_.rivCar.key=rivalKey();G_.rivCar.setNight(G_.route==='night');
    G_.world.cars.add(G_.rivCar.root);G_.rivTag=nameTag(on||'Rival');G_.rivCar.root.add(G_.rivTag)}
}
function rivalKey(){const c=(opp&&opp.x&&opp.x.car)||['gt',4];return c.join('/')+(on||'')}
function nameTag(n){const cv=document.createElement('canvas');cv.width=256;cv.height=64;const c=cv.getContext('2d');c.fillStyle='rgba(20,17,31,.85)';const w=Math.min(250,44+String(n).slice(0,12).length*19);
  c.beginPath();c.roundRect?c.roundRect(128-w/2,8,w,48,14):c.rect(128-w/2,8,w,48);c.fill();c.fillStyle='#ffe14d';c.font='bold 30px Bangers,Impact,sans-serif';c.textAlign='center';c.textBaseline='middle';c.fillText(String(n).slice(0,12).toUpperCase(),128,33);
  const t=new THREE.CanvasTexture(cv);t.encoding=THREE.sRGBEncoding;const s=new THREE.Sprite(new THREE.SpriteMaterial({map:t,depthTest:false,transparent:true}));s.scale.set(3.2,.8,1);s.position.set(0,2.6,0);s.renderOrder=5;return s}
function checkOnline(force){
  if(G_.mode!=='online'||G_.state==='done'||G_.state==='count'||G_.state==='idle')return;
  const D=G_.me,r=G_.riv,mine=Math.floor(D.score);
  if(!opp){if(!D.alive&&(G_.state==='spect'||force)){G_.state='done';finishOnline(null)}return}
  if(!r)return;
  const rs=Math.floor(r.cr&&G_.rivFinal!=null?G_.rivFinal:r.sc||0);
  if(D.alive&&r.cr&&mine>rs){G_.state='won';NET.ev({e:'sswin',g:myG,sc:mine});G_.myFinal=mine;finishOnline(true);return}
  if(!D.alive&&!r.cr&&rs>(G_.myFinal||mine)&&(G_.state==='spect'||force)){finishOnline(false);return}
  if(!D.alive&&r.cr&&(G_.state==='spect'||force||G_.state==='wreck'&&G_.wreckT>2)){const m=G_.myFinal!=null?G_.myFinal:mine;finishOnline(m>rs||m===rs&&HOST)}
}
function finishOnline(win){
  if(G_.state==='done'&&G_.result!=null)return;G_.state='done';G_.result=win;ENG.stop();
  const D=G_.me,mine=G_.myFinal!=null?G_.myFinal:Math.floor(D.score),r=G_.riv,rs=Math.floor(G_.rivFinal!=null?G_.rivFinal:r?r.sc:0);
  if(win===null){setOver('RIVAL LEFT',`Your run: <b>${mine.toLocaleString()}</b> points`,null);$('#rm').hidden=true;return}
  jingle(win);
  setOver(win?'YOU WIN!':'YOU LOSE!',`<div class="ssres">You <b>${mine.toLocaleString()}</b> · ${esc(on||'Rival')} <b>${rs.toLocaleString()}</b><br>${(D.d/1000).toFixed(2)} km · top speed ${Math.round(D.top*3.6)} km/h · ${D.nears} near miss${D.nears===1?'':'es'}</div>`,null);
}
function sendGo(){
  // the host picks the road; both start 4 s from now (on the host's clock)
  G_.seed=newSeed();const at=performance.now()+4200;G_.go={s:G_.seed,r:sel.route,at,g:myG,used:true};
  NET.ev({e:'ssgo',g:myG,s:G_.seed,r:sel.route,at,hn:performance.now()});pub();
  beginOnline(G_.go.r,G_.go.s,at);
}
function beginOnline(route,seed,localAt){
  setupRun(route,seed,CFG.laneX[HOST?0:1]);G_.myFinal=null;G_.rivFinal=null;G_.waitRe=false;$('#over').hidden=true;startCountdown(localAt);ENG.start();
}
function useGo(){const g=G_.go;if(!g||g.used||g.g!==myG)return;g.used=true;beginOnline(ROUTES.find(r=>r.id===g.r)?g.r:'coast',g.s,g.local)}
function hostToLocal(at,hn){return NET.clk!=null?at-NET.clk:performance.now()+(at-(hn||at-4200))-NET.rtt/2}
function event(d){
  if(phase!=='ssplay'&&phase!=='lobby')return;
  if(d.e==='ssgo'&&+d.g===myG&&!HOST){if(G_.go&&G_.go.s===+d.s&&G_.go.g===myG&&G_.go.used)return;G_.go={s:+d.s,r:String(d.r),at:+d.at,g:myG,local:hostToLocal(+d.at,+d.hn)};if(phase==='ssplay')useGo()}
  else if(d.e==='sscr'&&+d.g===myG){G_.rivFinal=+d.sc||0;if(G_.riv){G_.riv.cr=true;G_.riv.sc=G_.rivFinal}}
  else if(d.e==='sswin'&&+d.g===myG){G_.rivFinal=+d.sc||0;if(G_.state!=='done')finishOnline(false)}
}
function sync(){
  if(phase!=='ssplay')return;
  if(!opp){if(G_.state==='wait')msg(`<div class="pnl">Your rival left. Waiting…</div>`);return}
  if(HOST&&(G_.state==='wait'||G_.waitRe&&opp.g===myG))return sendGo();
  // guest: pick up a start we missed from the host's heartbeat
  const x=opp.x;if(!HOST&&x&&x.go&&+x.go.g===myG&&(G_.state==='wait'||G_.waitRe)&&!(G_.go&&G_.go.s===+x.go.s&&G_.go.g===myG&&G_.go.used)){G_.go={s:+x.go.s,r:String(x.go.r),at:+x.go.at,g:myG,local:hostToLocal(+x.go.at,+x.go.hn)};useGo()}
  if(!$('#over').hidden)rmLabel();
}

/* ---------- start / stop / pause ---------- */
function setPause(p){if(G_.mode!=='solo'||!(G_.state==='run'||G_.state==='count'))return;if(p===G_.paused)return;
  G_.paused=p;$('#sspm').hidden=!p;if(p){G_.pausedAt=performance.now()}else{G_.goAt+=performance.now()-G_.pausedAt;G_.keys={}}SFX.ui()}
const fsEl=()=>document.fullscreenElement||document.webkitFullscreenElement;
const fsOK=()=>!!(document.fullscreenEnabled||document.webkitFullscreenEnabled);
function enterFS(){if(!fsOK()||fsEl())return;const d=document.documentElement,f=d.requestFullscreen||d.webkitRequestFullscreen;try{const r=f.call(d,{navigationUI:'hide'});G_.fsMine=true;if(r&&r.catch)r.catch(()=>{G_.fsMine=false})}catch(e){G_.fsMine=false}}
function exitFS(){if(!fsEl())return;const f=document.exitFullscreen||document.webkitExitFullscreen;try{const r=f.call(document);if(r&&r.catch)r.catch(()=>{})}catch(e){}}
$('#ssfs').onclick=()=>{fsEl()?exitFS():enterFS();SFX.ui()};
['fullscreenchange','webkitfullscreenchange'].forEach(n=>document.addEventListener(n,()=>{$('#ssfs').hidden=!fsOK();if(G_.world)setTimeout(()=>G_.world.resize(),60)}));
function start(mode){
  me.n=($('#nm').value.trim()||'Driver').slice(0,12);
  if(mode!=='online'){leave();G='slip';cpu=true}
  G_.mode=mode==='online'?'online':'solo';
  phase='ssplay';show('ssgame');$('#net').hidden=mode!=='online';
  document.documentElement.classList.add('sson');document.documentElement.classList.toggle('sstouch',TOUCH_UI);
  if(!window.THREE){err('The 3D engine did not load. Check your internet and try again.');return}
  if(!initWorld())return;
  if(mode!=='online')enterFS();$('#ssfs').hidden=!fsOK();
  buildPads();G_.keys={};G_.touch={l:0,r:0,brake:0,nitro:0,gas:0};G_.last=0;
  if(G_.mode==='solo'){setupRun(sel.route,newSeed(),CFG.laneX[1]);startCountdown(performance.now()+3600);ENG.start()}
  else{G_.state='wait';if(HOST||!G_.go||G_.go.g!==myG)G_.go=null;G_.waitRe=false;
    // show the road while we wait for the host's start signal
    setupRun(sel.route,1,CFG.laneX[HOST?0:1]);G_.state='wait';msg(`<div class="pnl">${HOST?'Starting…':'Waiting for the host to start…'}</div>`);
    if(HOST&&opp)sendGo();else if(!HOST){if(G_.go&&G_.go.g===myG&&!G_.go.used)useGo();else sync()}}
  if(!G_.raf)G_.raf=requestAnimationFrame(frame);
}
function stop(){
  cancelAnimationFrame(G_.raf);G_.raf=0;G_.state='idle';ENG.stop();
  document.documentElement.classList.remove('sson','sstouch');if(G_.fsMine){G_.fsMine=false;exitFS()}
  if(G_.world){G_.world.clear();if(G_.car){G_.car.dispose();G_.car=null}if(G_.rivCar){G_.rivCar.dispose();G_.rivCar=null}}
  G_.road=null;G_.go=null;G_.auto=null;
}
function rematch(){
  if(G_.mode==='solo'){$('#over').hidden=true;setupRun(sel.route,newSeed(),CFG.laneX[1]);startCountdown(performance.now()+3600);ENG.start();return}
  if(!opp)return;myG=opp.g>myG?opp.g:myG+1;pub();G_.waitRe=true;G_.state='done';
  if(opp.g===myG){if(HOST)sendGo()}
  $('#ssmsg').dataset.h='';msg(`<div class="pnl">Waiting for ${esc(on||'your rival')}…</div>`);
}
function restartSolo(){if(G_.mode!=='solo')return;$('#sspm').hidden=true;G_.paused=false;setupRun(sel.route,newSeed(),CFG.laneX[1]);startCountdown(performance.now()+3600)}
$('#sssolo').onclick=()=>{need3D().then(()=>start('solo'),()=>err('The 3D engine did not load. Check your internet and try again.'))};
$('#ssgo').onclick=()=>join('slip');
$('#ssquit').onclick=leave;$('#ssleave').onclick=leave;
$('#sspause').onclick=()=>setPause(!G_.paused);$('#ssres').onclick=()=>setPause(false);$('#ssre').onclick=restartSolo;
$('#sscam').onclick=cycleCam;
addEventListener('resize',()=>{if(G_.world&&!$('#ssgame').hidden)setTimeout(()=>G_.world.resize(),50)});

/* ---------- music + card art ---------- */
THEMES.slip={bpm:118,vol:.75,key:69,maj:0,prog:prog('A2:min F2:maj C3:maj G2:maj'),
  bass:seq('0 . 0 0 12 . 0 . 0 . 0 0 12 . 7 .'),bassT:'sawtooth',bassV:.12,bassLp:560,bassD:.9,
  arp:seq('0 1 2 1 0 1 2 3 0 1 2 1 2 1 0 1'),arpO:24,arpT:'square',arpV:.018,arpDl:.25,
  lead:[seq('E5 . . . . . D5 . C5 . . . A4 . . .'),seq('F5 . . . E5 . . . C5 . . . D5 . . .'),seq('G5 . . . E5 . . . C5 . . . E5 . . .'),seq('D5 . . . B4 . . . G4 . . . B4 . D5 .')],leadT:'triangle',leadV:.07,leadD:2.4,leadDl:.3,leadVib:5,
  k:'x...x...x...x...',s:'....x.......x...',h:'..x...x...x...x.',hV:.05};
ART_GEN.slip=(W,n)=>{
  // a coast road in perspective: sea on the left, hills on the right, a sports car weaving past a bus
  const cx=W/2,u='_s'+n,K='#14111f',hz=58,k=Math.min(1,(W-12)/260);
  const lerpP=(a,b,t)=>a+(b-a)*t,road=(t,o)=>{const y=lerpP(hz,134,t),w=lerpP(6,170,t),x=cx+Math.sin(t*2.2)*-18*(1-t);return[x+o*w,y]};
  let dash='';for(let i=0;i<7;i++){const t0=(i+.2)/7,t1=(i+.55)/7,[a,b]=road(t0*t0,0),[c,d]=road(t1*t1,0);dash+=`<path d="M${a.toFixed(1)} ${b.toFixed(1)}L${c.toFixed(1)} ${d.toFixed(1)}" />`}
  const edge=o=>{let d='';for(let i=0;i<=20;i++){const t=(i/20)**2,[x,y]=road(t,o);d+=(i?'L':'M')+x.toFixed(1)+' '+y.toFixed(1)}return d};
  const roadPoly=()=>{const L=[],Rr=[];for(let i=0;i<=20;i++){const t=(i/20)**2;L.push(road(t,-1));Rr.push(road(t,1))}return'M'+[...L,...Rr.reverse()].map(([x,y])=>x.toFixed(1)+' '+y.toFixed(1)).join('L')+'Z'};
  const car=(x,y,s,col)=>`<g transform="translate(${x} ${y}) scale(${s})"><ellipse cx="0" cy="3" rx="30" ry="6" fill="#000" opacity=".3"/>
    <path d="M-28 0L-27 -12Q-24 -18 -14 -19L-10 -28Q0 -32 10 -28L14 -19Q24 -18 27 -12L28 0Z" fill="${col}" stroke="${K}" stroke-width="2.6" stroke-linejoin="round"/>
    <path d="M-9 -26Q0 -29 9 -26L12 -19H-12Z" fill="#1d2735" stroke="${K}" stroke-width="1.8"/><rect x="-23" y="-11" width="11" height="4" rx="1.5" fill="#ff2a3a" stroke="${K}" stroke-width="1.4"/><rect x="12" y="-11" width="11" height="4" rx="1.5" fill="#ff2a3a" stroke="${K}" stroke-width="1.4"/>
    <rect x="-7" y="-6" width="14" height="5" rx="1" fill="#f4f4ee" stroke="${K}" stroke-width="1.2"/><rect x="-27" y="-2" width="8" height="7" rx="2" fill="${K}"/><rect x="19" y="-2" width="8" height="7" rx="2" fill="${K}"/></g>`;
  const bus=(x,y,s)=>`<g transform="translate(${x} ${y}) scale(${s})"><rect x="-15" y="-34" width="30" height="34" rx="4" fill="#f2c230" stroke="${K}" stroke-width="2.4"/><rect x="-12" y="-30" width="24" height="13" rx="2" fill="#1d2735"/><rect x="-14" y="-12" width="28" height="3" fill="#fff"/><circle cx="-9" cy="-5" r="2.4" fill="#fff6d0" stroke="${K}" stroke-width="1"/><circle cx="9" cy="-5" r="2.4" fill="#fff6d0" stroke="${K}" stroke-width="1"/></g>`;
  return `<svg viewBox="0 0 ${W} 140" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><defs>
   <linearGradient id="sk${u}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2a6bc4"/><stop offset="1" stop-color="#cfe4f4"/></linearGradient>
   <linearGradient id="se${u}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a8ccc"/><stop offset="1" stop-color="#1d6f9e"/></linearGradient></defs>
   <rect width="${W}" height="140" fill="url(#sk${u})"/><circle cx="${W*.22}" cy="24" r="14" fill="#fffbe6" opacity=".95"/><circle cx="${W*.22}" cy="24" r="26" fill="#fff" opacity=".25"/>
   <g fill="#fff" opacity=".85"><ellipse cx="${W*.62}" cy="22" rx="28" ry="7"/><ellipse cx="${W*.66}" cy="17" rx="16" ry="7"/><ellipse cx="${W*.86}" cy="34" rx="22" ry="5"/></g>
   <path d="M0 ${hz}H${cx}V140H0Z" fill="url(#se${u})"/><g stroke="#fff" stroke-width="1.5" opacity=".5" stroke-linecap="round"><path d="M${W*.06} 76h22M${W*.2} 92h30M${W*.1} 112h36M${W*.3} 70h14"/></g>
   <path d="M${cx-30} ${hz}Q${W*.75} 8 ${W+10} ${hz-24}V140H${cx+40}Z" fill="#5d9a3a" stroke="${K}" stroke-width="2.5"/><path d="M${cx+20} ${hz+2}Q${W*.8} 30 ${W+10} 40V140H${cx+60}Z" fill="#4a8a33"/>
   ${Array.from({length:7},(_,i)=>{const x=cx+40+i*((W/2-30)/7),y=hz-6-Math.sin(i)*8-i*2;return`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(5+i%3*2)}" fill="${i%2?'#3f7f30':'#62a347'}" stroke="${K}" stroke-width="1.5"/>`}).join('')}
   <path d="${roadPoly()}" fill="#4a4d53"/>
   <path d="${edge(-1)}" stroke="#c4c9d0" stroke-width="3" fill="none"/><path d="${edge(1)}" stroke="#b9ad98" stroke-width="4" fill="none"/>
   <g stroke="#f5cd3c" stroke-width="2" stroke-linecap="round">${dash}</g>
   ${bus(cx+14,92,.7)}
   <g class="ssc">${car(cx-26,128,1,'#e8203a')}</g>
   <path d="M${cx-62} 112l-14 4M${cx-60} 122l-20 2M${cx-58} 132l-16 -1" stroke="#fff" stroke-width="2.5" stroke-linecap="round" opacity=".8"/>
  </svg>`;
};

regGame('slip',{name:'Slipstream',menu:'ssmenu',stage:'ssgame',cd:'#cd11',theme:'slip',prep:()=>need3D(),start,sync,event,fast,rematch,stop,
  hb:()=>({car:[sel.style,sel.paint],st:G_.state,sc:G_.me?Math.floor(G_.me.score):0,go:HOST&&G_.go&&G_.go.g===myG?{s:G_.go.s,r:G_.go.r,at:G_.go.at,hn:performance.now(),g:myG}:null})});
window.Slipstream={G:G_,World,ROUTES,LOOK};
})();
