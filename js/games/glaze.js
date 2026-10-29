/* GAME: Glaze Craze — copy the order donut in 3D; judged by how close your toppings match. */
mountScreens(`
<!-- GAME 2 MENU: GLAZE CRAZE -->
<section id="dmenu" class="card gmenu" hidden>
<div class="mhero"><div class="mart" data-art="donut"></div><h2 class="mh">Glaze Craze</h2></div>
<label>Room code (auto-filled if you opened an invite link)<input id="cd2" maxlength="6" autocomplete="off"></label>
<div class="row"><button class="btn" id="go2">Play a friend online</button><button class="btn b" id="solo2">Solo vs Chef Bot</button></div>
<p class="note" id="msg2"></p>
<ul class="rules"><li>Both bakers get the same order ticket and 75 seconds to copy it.</li><li><b>Glaze</b>: pick a bowl, then tap the donut to dip it. <b>Drizzle</b>: drag across the donut. <b>Toppings</b> and <b>Cream</b>: tap or drag where they go.</li><li>The judge checks the glaze, and the amount and position of every topping, drizzle and dollop. A perfect copy earns ₹129.</li></ul>
<button class="btn m back" data-back>← All games</button></section>


<!-- GAME 2 STAGE: GLAZE CRAZE -->
<section id="dgame" hidden>
<div class="card dbar">
  <div class="dclock" id="dclock"><b id="dtm">1:15</b></div>
  <div class="dmid"><span id="dst">Get ready!</span><div class="dmeter"><span class="dstarbar" id="dstars"></span><em id="dpct">0%</em></div></div>
  <div class="dright"><span id="dpr"></span><button class="btn b sm" id="dquit">Exit</button></div>
</div>
<div id="dstage">
  <div class="awn"></div>
  <canvas id="dcv"></canvas>
  <div id="dref" class="big" title="Tap to zoom the order ticket">
    <div class="tclip"></div>
    <div class="thead"><b>ORDER</b><span id="dordno">#101</span></div>
    <div class="tpic"><canvas id="rcv"></canvas></div>
    <ul id="drecipe"></ul>
  </div>
  <div id="dbrush" hidden></div>
  <div id="dfx"></div>
  <div id="dcam-bar">
    <button class="rbtn2" id="dspin" title="Auto-spin the donut" aria-label="Auto-spin">⟳</button>
    <button class="rbtn2" id="dzoom-btn" title="Zoom the order ticket" aria-label="Zoom ticket">🧾</button>
  </div>
  <div id="dcount"></div>
  <button class="btn" id="drdy">I'M READY!</button>
</div>
<div class="card" id="dtray">
  <div class="dtabs" id="dtabs"></div>
  <div class="dtools" id="dts"></div>
  <div class="dhint"><span id="dhint"></span><span id="ditem-cnt"></span></div>
  <div class="dbtn">
    <button class="btn b sm" id="dundo">↶ Undo</button>
    <button class="btn o sm" id="dclr">🗑 Clear</button>
    <button class="btn m" id="ddone">SERVE! 🛎️</button>
  </div>
</div>
</section>
`);

mountOverlay(`<div id="dres" class="ov" hidden><div class="card res" id="dr"></div></div>`);
/* =========================================================================
   GAME 2: GLAZE CRAZE — REFINED SCORING & UPGRADED 3D UI
   ========================================================================= */
const GL=['#ff7eb6','#6b3a1e','#fff1d6','#7fe3b0','#6ec6ff','#ffb347'],GLN=['Strawberry','Chocolate','Vanilla','Mint','Blueberry','Orange'];
const SY=['#ffffff','#a8703a','#2b1608','#e8123c'],SYN=['White Choc','Milk Choc','Dark Choc','Berry Drizzle'];
const SPC=['#ff3b6b','#ffd23f','#2fe3a0','#2d9bff','#ff8a1f','#b45cff'];
const CM=['#fffdf7','#ff9fc4','#7b4a2a'],CMN=['Vanilla','Berry','Mocha'];
const CRB=['#d9a066','#b9783a','#8a5527'];
const TL=[['🌈','Sprinkles'],['🍫','Choc Chips'],['🍬','Candies'],['🍪','Crumbs']];
let V3=null,RV=null,RC=null,dp='',dgn=0,dseed=0,ref=null,mine=null,acts=[],cur=null,lastH=null,tool={k:'t',i:0},DSx={rd:0,sd:0,gn:0,rq:0,dn:0,pr:0,ds:''},HOST=true,dBot=false,dBotD=null,endAt=0,dtm=0,raf=0,wins=[0,0],lsec=0,autoSpin=false;

function genRef(sd){
  const R=rng(sd),P=a=>a[R()*a.length|0],Q=x=>Math.min(999,Math.max(0,Math.round(x*1000))),d={g:R()*6|0,i:[],s:[]},nt=R()<.4?2:1,ty=[0,1,2,3].sort(()=>R()-.5).slice(0,nt);
  ty.forEach(t=>{const n=[56,24,18,32][t]/(nt>1?1.5:1)|0,lay=P(['all','arc','band','patch']),u0=R(),sd2=R()<.5,cl=[R(),R(),R()];
   for(let k=0;k<n;k++){let u,v;
    if(lay=='all'){u=R();v=.1+R()*.3}else if(lay=='arc'){u=(u0+R()*.5)%1;v=.12+R()*.26}else if(lay=='band'){u=R();v=sd2?.1+R()*.1:.3+R()*.1}else{u=(cl[k%3]+(R()-.5)*.16+1)%1;v=.18+R()*.16}
    d.i.push([t,Q(u),Q(v),R()*16|0,R()*6|0])}});
  if(R()<.7){const c=P([0,1,2,3]),zig=R()<.5,u0=R()*.35,p=[];
   if(zig){for(let k=0;k<=36;k++)p.push(Q(u0+k*.016),Q(.25+.1*Math.sin(k*.5)));d.s.push([c,p])}
   else for(let m=0;m<5;m++){const u=u0+m*.07,q=[];for(let k=0;k<=8;k++)q.push(Q(u+(k%2?.012:0)),Q(.1+k*.04));d.s.push([c,q])}}
  if(R()<.55){const n=3+(R()*3|0),c=R()*3|0,o=R();for(let k=0;k<n;k++)d.i.push([4,Q((o+k/n)%1),250,0,c])}
  return d;
}

/* ---- Judging: precise, symmetric, and identical on both players' screens ----
   Each donut becomes density maps (one channel per topping type, cream colour and syrup colour)
   on a 32x16 grid wrapped around the torus. Maps are blurred at a fine and a coarse scale and
   compared with Bray-Curtis similarity, which rewards the right amount in the right place.
   An identical donut always scores the full 129. */
const GX=32,GY=16,NCH=11,rgb=h=>[1,3,5].map(i=>parseInt(h.substr(i,2),16));
const KER={};function kern(s){if(KER[s])return KER[s];const r=Math.ceil(s*2.5),k=[];let t=0;for(let i=-r;i<=r;i++){const v=Math.exp(-i*i/(2*s*s));k.push(v);t+=v}return KER[s]=k.map(v=>v/t)}
function blur(src,s){const k=kern(s),r=(k.length-1)/2,tmp=new Float64Array(GX*GY),out=new Float64Array(GX*GY);
 for(let y=0;y<GY;y++)for(let x=0;x<GX;x++){let a=0;for(let j=-r;j<=r;j++)a+=src[y*GX+(x+j+GX*4)%GX]*k[j+r];tmp[y*GX+x]=a}
 for(let y=0;y<GY;y++)for(let x=0;x<GX;x++){let a=0;for(let j=-r;j<=r;j++)a+=tmp[((y+j+GY*4)%GY)*GX+x]*k[j+r];out[y*GX+x]=a}return out}
function dens(d){const G=[...Array(NCH)].map(()=>new Float64Array(GX*GY));
 const add=(ch,u,v,w)=>{G[ch][Math.min(GY-1,Math.floor(v*GY))*GX+Math.min(GX-1,Math.floor(u*GX))]+=w};
 d.i.forEach(t=>add(t[0]==4?4+t[4]%3:t[0],t[1]/1000,t[2]/1000,[1,1.6,1.6,1.3,3.5][t[0]]));
 d.s.forEach(([c,p])=>{for(let k=2;k<p.length;k+=2){const x0=p[k-2],y0=p[k-1],x1=p[k],y1=p[k+1];if(Math.abs(x1-x0)>500)continue;const n=Math.max(1,Math.round(Math.hypot(x1-x0,y1-y0)/8));
  for(let j=0;j<n;j++)add(7+c,(x0+(x1-x0)*j/n)/1000,(y0+(y1-y0)*j/n)/1000,.35*Math.hypot(x1-x0,y1-y0)/8/n)}});
 return G}
function bc(A,B,chs){let mn=0,sm=0;chs.forEach(c=>{const a=A[c],b=B[c];for(let i=0;i<a.length;i++){mn+=Math.min(a[i],b[i]);sm+=a[i]+b[i]}});return sm>1e-9?2*mn/sm:null}
const SCACHE={};
const GRP=[['tp',[0,1,2,3],.35],['sy',[7,8,9,10],.2],['cr',[4,5,6],.2]];
function scoreOf(d,r){
 if(!d||!r)return{tot:0,gl:0,tp:null,cr:null,sy:null,raw:0};
 const A=dens(d),bl=G=>[1.1,2.6].map(s=>G.map(g=>blur(g,s)));if(SCACHE.r!==r){SCACHE.r=r;SCACHE.b=bl(dens(r));SCACHE.B=dens(r)}const B=SCACHE.B,BA=bl(A),sc=BA.map((X,i)=>[X,SCACHE.b[i]]);
 let gl=0;if(d.g>=0&&r.g>=0){if(d.g==r.g)gl=1;else{const a=rgb(GL[d.g]),b=rgb(GL[r.g]);gl=.3*Math.max(0,1-Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2])/300)}}
 let ws=gl*.25,wt=.25;const o={gl};
 GRP.forEach(([k,chs,w])=>{const has=x=>chs.some(c=>x[c].some(v=>v>0)),tr=has(B),pl=has(A);
  if(!tr&&!pl){o[k]=null;return}
  if(!tr){o[k]=0;o['x'+k]=1;ws+=0;wt+=w*.5;return}
  const s=sc.reduce((a,[X,Y])=>a+(bc(X,Y,chs)||0),0)/sc.length;o[k]=s;ws+=s*w;wt+=w});
 o.raw=Math.pow(Math.min(1,ws/wt),1.6);o.tot=Math.round(129*o.raw);return o}
function botD(r){
  const R=rng(dseed+7),c=x=>Math.max(0,Math.min(999,Math.round(x))),sk=.6+R()*.35,j=1-sk;
  return{
    g:R()<.82?r.g:R()*6|0,
    i:r.i.filter(()=>R()<sk+.1).concat(r.i.filter(()=>R()<j*.5)).map(a=>[a[0],c(a[1]+(R()-.5)*260*j),c(a[2]+(R()-.5)*200*j),a[3],a[4]]),
    s:r.s.filter(()=>R()<.9).map(([k,p])=>{const dx=(R()-.5)*240*j,dy=(R()-.5)*160*j;return[k,p.map((x,i)=>c(x+(i%2?dy:dx)))]})
  };
}
/* compact, lossless-enough wire format (both screens score the same decoded copy) */
const b36=n=>Math.max(0,Math.min(999,n|0)).toString(36).padStart(2,'0');
function encD(d){let pts=0;const s=d.s.map(([c,p])=>{let o=''+c,lx=-99,ly=-99;for(let k=0;k<p.length;k+=2){const x=p[k],y=p[k+1],last=k>=p.length-2;if(pts>2400)break;if(!last&&Math.hypot(x-lx,y-ly)<6)continue;o+=b36(x)+b36(y);lx=x;ly=y;pts++}return o}).filter(x=>x.length>=5);
 return(d.g<0?'z':d.g)+'|'+d.i.slice(0,400).map(t=>t[0]+b36(t[1])+b36(t[2])+(t[3]&15).toString(16)+(t[4]%10)).join('')+'|'+s.join(';')}
function decD(str){const o={g:-1,i:[],s:[]};if(typeof str!='string')return o;const P=str.split('|');if(P.length<3)return o;
 const n=x=>{const v=parseInt(x,36);return isNaN(v)?0:Math.max(0,Math.min(999,v))};
 o.g=/^[0-5]$/.test(P[0])?+P[0]:-1;
 const I=P[1].match(/[0-4][0-9a-z]{4}[0-9a-f][0-9]/g)||[];o.i=I.slice(0,400).map(x=>{const t=+x[0];return[t,n(x.substr(1,2)),n(x.substr(3,2)),parseInt(x[5],16),(+x[6])%(t==4?3:6)]});
 o.s=P[2].split(';').filter(x=>/^[0-3]([0-9a-z]{4})+$/.test(x)).slice(0,80).map(x=>{const p=[];for(let k=1;k+4<=x.length;k+=4)p.push(n(x.substr(k,2)),n(x.substr(k+2,2)));return[+x[0],p]});
 return o}

function recipeChips(){
  const chips=[{ic:'🍩',lbl:GLN[ref.g]+' glaze',ok:mine.g===ref.g,sw:GL[ref.g]}];
  const topTypes=[...new Set(ref.i.filter(x=>x[0]<4).map(x=>x[0]))];
  topTypes.forEach(t=>{const need=ref.i.filter(x=>x[0]===t).length,have=mine.i.filter(x=>x[0]===t).length;chips.push({ic:TL[t][0],lbl:`${TL[t][1]} <small>${have}/${need}</small>`,ok:have>=Math.ceil(need*.7)&&have<=need*1.5})});
  [...new Set(ref.s.map(x=>x[0]))].forEach(c=>chips.push({ic:'🍯',lbl:SYN[c]+' drizzle',ok:mine.s.some(x=>x[0]===c),sw:SY[c]}));
  const cr=ref.i.filter(x=>x[0]===4);if(cr.length){const c=cr[0][4],have=mine.i.filter(x=>x[0]===4&&x[4]===c).length;chips.push({ic:'🍦',lbl:`${CMN[c]} cream <small>${have}/${cr.length}</small>`,ok:have>=cr.length&&have<=cr.length+2,sw:CM[c]})}
  return chips}
let lastDone='';
function updDonutHUD(){
  if(!ref||!mine)return;
  const sc=scoreOf(mine,ref);
  $('#dstars').style.setProperty('--f',(sc.raw*100).toFixed(1)+'%');
  $('#dstars').title='Match: '+Math.round(sc.raw*100)+'%';
  $('#dpct').textContent=Math.round(sc.raw*100)+'%';
  const n=mine.i.length+mine.s.length;$('#ditem-cnt').textContent=n?n+' added':'';
  const chips=recipeChips(),done=chips.map(c=>c.ok?1:0).join('');
  $('#drecipe').innerHTML=chips.map((c,i)=>`<li class="${c.ok?'done':''}${c.ok&&lastDone[i]==='0'?' just':''}"><span class="ck">${c.ok?'✓':''}</span>${c.sw?`<i class="sw" style="background:${c.sw}"></i>`:`<i>${c.ic}</i>`}<span>${c.lbl}</span></li>`).join('');
  if(dp=='play'&&lastDone&&[...done].some((x,i)=>x=='1'&&lastDone[i]=='0'))SFX.ding();
  lastDone=done;
}

/* --- 3D Donut Rendering --- */
let GEO=null,MAT={};const mat=(c,r)=>MAT[c+r]||(MAT[c+r]=new THREE.MeshStandardMaterial({color:c,roughness:r}));
const geos=()=>GEO||(GEO={sp:new THREE.CylinderGeometry(.011,.011,.1,6),ch:new THREE.ConeGeometry(.045,.075,8),ca:new THREE.SphereGeometry(.05,12,8),cr:new THREE.DodecahedronGeometry(.045),d1:new THREE.SphereGeometry(.15,14,10),d2:new THREE.SphereGeometry(.105,12,8),d3:new THREE.ConeGeometry(.06,.14,10)});
function mkItem(it){const[t,U,V,a,c]=it,u=U/500*Math.PI,v=V/500*Math.PI,cu=Math.cos(u),su=Math.sin(u),cv=Math.cos(v),sv=Math.sin(v),n=new THREE.Vector3(cv*cu,cv*su,sv),p=new THREE.Vector3((1+.42*cv)*cu,(1+.42*cv)*su,.42*sv),Q=geos(),Y=new THREE.Vector3(0,1,0);let m;
 if(t==0){m=new THREE.Mesh(Q.sp,mat(SPC[c%6],.4));const t1=new THREE.Vector3(-su,cu,0),t2=new THREE.Vector3().crossVectors(n,t1),an=a*Math.PI/8;m.quaternion.setFromUnitVectors(Y,t1.multiplyScalar(Math.cos(an)).addScaledVector(t2,Math.sin(an)).normalize());p.addScaledVector(n,.014)}
 else if(t==1){m=new THREE.Mesh(Q.ch,mat('#4a2511',.5));m.quaternion.setFromUnitVectors(Y,n);p.addScaledVector(n,.03)}
 else if(t==2){m=new THREE.Mesh(Q.ca,mat(SPC[c%5],.3));m.scale.set(1,.55,1);m.quaternion.setFromUnitVectors(Y,n);p.addScaledVector(n,.02)}
 else if(t==3){m=new THREE.Mesh(Q.cr,mat(CRB[c%3],.9));m.rotation.set(a,c,a*2);m.scale.setScalar(.7+(c%3)*.3);p.addScaledVector(n,.02)}
 else{m=new THREE.Group();const o=mat(CM[c%3],.35),b=new THREE.Mesh(Q.d1,o),b2=new THREE.Mesh(Q.d2,o),b3=new THREE.Mesh(Q.d3,o);b.scale.y=.6;b.position.y=.03;b2.scale.y=.7;b2.position.y=.13;b3.position.y=.24;m.add(b,b2,b3);m.quaternion.setFromUnitVectors(Y,n);p.addScaledVector(n,.02)}
 m.position.copy(p);return m}
function mkD(){const cv=document.createElement('canvas'),rc=document.createElement('canvas'),bs=document.createElement('canvas');[cv,rc,bs].forEach(c=>{c.width=512;c.height=256});
 const b=bs.getContext('2d'),R=rng(5),gr=b.createLinearGradient(0,0,0,256);[[0,'#c98a4b'],[.22,'#ebb673'],[.5,'#c98a4b'],[.75,'#b27238'],[1,'#c98a4b']].forEach(x=>gr.addColorStop(x[0],x[1]));b.fillStyle=gr;b.fillRect(0,0,512,256);
 for(let i=0;i<500;i++){b.fillStyle=R()<.5?'#ffe2ac44':'#8a542433';b.fillRect(R()*512,R()*256,2+R()*3,2+R()*3)}
 const tex=new THREE.CanvasTexture(cv),rt=new THREE.CanvasTexture(rc);tex.flipY=rt.flipY=false;
 const m=new THREE.Mesh(new THREE.TorusGeometry(1,.42,40,96),new THREE.MeshStandardMaterial({map:tex,roughnessMap:rt,roughness:1,metalness:0})),g=new THREE.Group(),root=new THREE.Group();
 const plate=new THREE.Mesh(new THREE.CylinderGeometry(1.66,1.42,.1,56),new THREE.MeshStandardMaterial({color:0xffffff,roughness:.2}));plate.position.y=-.46;
 const rim=new THREE.Mesh(new THREE.TorusGeometry(1.6,.05,12,72),new THREE.MeshStandardMaterial({color:0xff6fa5,roughness:.35}));rim.rotation.x=Math.PI/2;rim.position.y=-.41;
 const rim2=new THREE.Mesh(new THREE.TorusGeometry(1.3,.02,8,72),new THREE.MeshStandardMaterial({color:0xffb3d1,roughness:.4}));rim2.rotation.x=Math.PI/2;rim2.position.y=-.405;
 g.add(m);g.rotation.x=-Math.PI/2;root.add(plate,rim,rim2,g);
 return{root,g,m,cv,rc,bs,tex,rt,ms:[]}}
function paint(D,d){const c=D.cv.getContext('2d'),r=D.rc.getContext('2d'),K=2*Math.PI;c.drawImage(D.bs,0,0);r.fillStyle='#e6e6e6';r.fillRect(0,0,512,256);
 if(d.g>=0){const p=new Path2D();for(let x=0;x<=512;x+=4){const u=x/512,y=(.05+.014*Math.sin(u*K*9)+.01*Math.sin(u*K*23))*256;x?p.lineTo(x,y):p.moveTo(x,y)}for(let x=512;x>=0;x-=4){const u=x/512,y=(.47-.012*Math.sin(u*K*7+1)-.008*Math.sin(u*K*19))*256;p.lineTo(x,y)}p.closePath();c.fillStyle=GL[d.g];c.fill(p);c.save();c.clip(p);c.globalAlpha=.18;c.fillStyle='#fff';for(let x=0;x<512;x+=64){c.beginPath();c.ellipse(x+20,40,26,6,0,0,K);c.fill()}c.restore();r.fillStyle='#3a3a3a';r.fill(p)}
 c.lineCap=c.lineJoin='round';c.lineWidth=7;d.s.forEach(([ci,p])=>{c.strokeStyle=SY[ci];c.beginPath();for(let k=0;k<p.length;k+=2){const x=p[k]/1000*512,y=p[k+1]/1000*256;k&&Math.abs(p[k]-p[k-2])<500?c.lineTo(x,y):c.moveTo(x,y)}c.stroke()});
 D.tex.needsUpdate=D.rt.needsUpdate=true}
function fillD(D,d){paint(D,d);D.ms.forEach(m=>D.g.remove(m));D.ms=d.i.map(it=>{const m=mkItem(it);D.g.add(m);return m})}
function mkS(cv,keep){const r=new THREE.WebGLRenderer({canvas:cv,antialias:true,alpha:true,preserveDrawingBuffer:keep});r.setPixelRatio(Math.min(window.devicePixelRatio||1,2));const sc=new THREE.Scene(),cam=new THREE.PerspectiveCamera(38,1,.1,60),dl=new THREE.DirectionalLight(0xffffff,.9);sc.add(new THREE.HemisphereLight(0xffffff,0xffd2a8,.9));dl.position.set(2.5,5,3);sc.add(dl);return{r,sc,cam,d:5}}
function fit(X,w,h){X.r.setSize(w,h,false);X.cam.aspect=w/h;X.d=Math.max(4.4,1.8/(Math.tan(19*Math.PI/180)*(w/h)));X.cam.position.set(0,X.d*Math.sin(1.08),X.d*Math.cos(1.08));X.cam.lookAt(0,0,0);X.cam.updateProjectionMatrix()}
function fitAll(){if(!V3)return;let b=$('#dcv').getBoundingClientRect();if(b.width)fit(V3.S,b.width,b.height);b=$('#rcv').getBoundingClientRect();if(b.width)fit(RV.S,b.width,b.height)}
function sn(d){const cv=document.createElement('canvas'),Z=mkS(cv,true),D=mkD();cv.width=cv.height=300;fillD(D,d);Z.sc.add(D.root);fit(Z,300,300);Z.r.render(Z.sc,Z.cam);const u=cv.toDataURL('image/png');try{Z.r.dispose();Z.r.forceContextLoss()}catch(e){}return u}
let dWob=0;
function loop(){
  raf=requestAnimationFrame(loop);
  if(!V3||$('#dgame').hidden)return;
  const t=performance.now()/1000,X=V3.S;
  X.cam.position.x=V3.mx*.65;X.cam.lookAt(0,0,0);
  dWob*=.9;V3.D.root.position.y=Math.sin(t*1.6)*.025+dWob*.06;V3.D.root.scale.setScalar(1+dWob*.04);
  if(autoSpin){V3.D.root.rotation.y+=0.012;RV.D.root.rotation.y=V3.D.root.rotation.y}
  else{V3.D.root.rotation.y*=0.9;RV.D.root.rotation.y+=0.006}
  X.r.render(X.sc,X.cam);RV.S.r.render(RV.S.sc,RV.S.cam);
}
function hit(e){const b=$('#dcv').getBoundingClientRect();V3.S.cam.updateMatrixWorld();V3.D.root.updateMatrixWorld(true);RC.setFromCamera({x:(e.clientX-b.left)/b.width*2-1,y:-((e.clientY-b.top)/b.height)*2+1},V3.S.cam);const h=RC.intersectObject(V3.D.m)[0];if(!h)return null;const l=V3.D.m.worldToLocal(h.point.clone()),K=2*Math.PI;return[(Math.atan2(l.y,l.x)/K+1)%1,(Math.atan2(l.z,Math.hypot(l.x,l.y)-1)/K+1)%1]}
const U1=x=>Math.min(999,Math.max(0,x*1000|0));
function dpart(e,html,cls=''){const b=$('#dstage').getBoundingClientRect(),s=document.createElement('span');s.className='dpart '+cls;s.innerHTML=html;s.style.left=(e.clientX-b.left)+'px';s.style.top=(e.clientY-b.top)+'px';s.style.setProperty('--dx',((Math.random()-.5)*60|0)+'px');$('#dfx').append(s);setTimeout(()=>s.remove(),900)}
function addIt(it){if(mine.i.length>=380)return false;mine.i.push(it);const m=mkItem(it);V3.D.g.add(m);V3.D.ms.push(m);cur.n++;DSx.pr=mine.i.length+mine.s.length;return true}
function scat(h,e){const t=tool.i,n=[4,2,2,3][t],r=Math.random;let ok=false;for(let k=0;k<n;k++)ok=addIt([t,U1((h[0]+(r()-.5)*.04+1)%1),U1(Math.min(.499,Math.max(0,h[1]+(r()-.5)*.06))),r()*16|0,r()*6|0])||ok;if(ok){SFX.sprinkle();if(e&&r()<.5)dpart(e,TL[t][0],'pt');updDonutHUD()}}
function hlTools(){document.querySelectorAll('.tub').forEach(x=>{const k=x.dataset.k,i=+x.dataset.i;x.classList.toggle('on',k==tool.k&&i==tool.i);x.classList.toggle('used',k=='g'&&!!mine&&i==mine.g)});
 document.querySelectorAll('.dtab').forEach(x=>x.classList.toggle('on',x.dataset.k==tool.k));
 const hint={g:'Tap the donut to dip it in glaze',s:'Drag across the donut to drizzle',t:'Tap or drag to sprinkle toppings',c:'Tap to pipe a cream dollop'}[tool.k];$('#dhint').textContent=hint}
function undo(){if(dp!='play')return;const a=acts.pop();if(!a)return;if(a.gl!==undefined)mine.g=a.gl;else{for(let k=0;k<a.n;k++){mine.i.pop();V3.D.g.remove(V3.D.ms.pop())}for(let k=0;k<a.s;k++)mine.s.pop()}paint(V3.D,mine);hlTools();DSx.pr=mine.i.length+mine.s.length;updDonutHUD();SFX.undo()}
const STN={g:['🍩','Glaze',GL.map((c,i)=>[c,GLN[i]])],s:['🍯','Drizzle',SY.map((c,i)=>[c,SYN[i]])],t:['🌈','Toppings',TL.map(x=>[x[0],x[1]])],c:['🍦','Cream',CM.map((c,i)=>[c,CMN[i]])]};
function tubs(k){const[ic,,list]=STN[k];$('#dts').innerHTML=list.map(([c,n],i)=>`<button class="tub tub-${k}" data-k="${k}" data-i="${i}" aria-label="${n}" title="${n}">${k=='t'?`<span class="jar"><i>${c}</i></span>`:`<span class="jar" style="--c:${c}"><i></i></span>`}<b>${n}</b></button>`).join('');hlTools()}
function tray(){
  $('#dtabs').innerHTML=Object.entries(STN).map(([k,[ic,n]])=>`<button class="dtab" data-k="${k}"><i>${ic}</i><b>${n}</b></button>`).join('');
  $('#dtabs').onclick=e=>{const b=e.target.closest('.dtab');if(!b)return;const k=b.dataset.k;if(tool.k!=k){tool={k,i:k=='g'&&mine?Math.max(0,mine.g):0};tubs(k);SFX.sel()}};
  $('#dts').onclick=e=>{const b=e.target.closest('.tub');if(!b)return;tool={k:b.dataset.k,i:+b.dataset.i};hlTools();SFX.ui()};
  tool={k:'g',i:0};tubs('g');
}
function setBrush(e){const br=$('#dbrush');if(!e||dp!='play'||e.pointerType=='touch'){br.hidden=true;return}const b=$('#dstage').getBoundingClientRect();br.hidden=false;br.style.left=(e.clientX-b.left)+'px';br.style.top=(e.clientY-b.top)+'px';
 const col=tool.k=='g'?GL[tool.i]:tool.k=='s'?SY[tool.i]:tool.k=='c'?CM[tool.i]:'#fff';br.style.setProperty('--c',col);br.dataset.k=tool.k;br.innerHTML=tool.k=='t'?TL[tool.i][0]:''}
function init3(){if(V3)return;RC=new THREE.Raycaster();V3={S:mkS($('#dcv'),false),D:mkD(),mx:0};V3.S.sc.add(V3.D.root);RV={S:mkS($('#rcv'),false),D:mkD()};RV.S.sc.add(RV.D.root);tray();
 const ro=new ResizeObserver(fitAll);ro.observe($('#dstage'));ro.observe($('#dref'));const c=$('#dcv');
 c.onpointerdown=e=>{if(dp!='play')return;try{c.setPointerCapture(e.pointerId)}catch(x){}const h=hit(e);if(!h)return;lastH=h;cur={n:0,s:0};
  if(tool.k=='g'){if(mine.g!=tool.i){acts.push({gl:mine.g,n:0,s:0});mine.g=tool.i;paint(V3.D,mine);hlTools();updDonutHUD();dWob=1;SFX.splat();dpart(e,'','ripple');$('#dstage').style.setProperty('--rc',GL[tool.i])}cur=null}
  else if(tool.k=='s'){mine.s.push([tool.i,[U1(h[0]),U1(h[1])]]);cur.s++;paint(V3.D,mine);updDonutHUD();SFX.drizzle()}
  else if(tool.k=='c'){if(addIt([4,U1(h[0]),U1(h[1]),0,tool.i])){dWob=.4;SFX.squirt();dpart(e,'🍦','pt');updDonutHUD()}}
  else if(tool.k=='t')scat(h,e)};
 c.onpointermove=e=>{V3.mx=e.clientX/innerWidth-.5;setBrush(e);if(!cur||dp!='play')return;const h=hit(e);if(!h)return;
  if(tool.k=='s'){const p=mine.s[mine.s.length-1][1],lx=p[p.length-2]/1000,ly=p[p.length-1]/1000;if(Math.abs(h[0]-lx)>.5){mine.s.push([tool.i,[U1(h[0]),U1(h[1])]]);cur.s++}else if(Math.hypot(h[0]-lx,h[1]-ly)>.01)p.push(U1(h[0]),U1(h[1]));paint(V3.D,mine);DSx.pr=mine.i.length+mine.s.length;if(Math.random()<.15)SFX.drizzle();updDonutHUD()}
  else if(tool.k=='t'&&Math.hypot((h[0]-lastH[0])*2,h[1]-lastH[1])>.035){scat(h,e);lastH=h}};
 c.onpointerleave=()=>setBrush(null);
 c.onpointerup=c.onpointercancel=()=>{if(cur&&(cur.n||cur.s))acts.push(cur);cur=null};
 $('#dref').onclick=()=>{if(dp!='brief'){$('#dref').classList.toggle('big');SFX.ui()}};
 $('#dzoom-btn').onclick=()=>{if(dp!='brief'){$('#dref').classList.toggle('big');SFX.ui()}};
 $('#dspin').onclick=()=>{autoSpin=!autoSpin;$('#dspin').classList.toggle('on',autoSpin);SFX.ui()};
 $('#dquit').onclick=leave;
 $('#dundo').onclick=undo;$('#dclr').onclick=()=>{if(dp!='play')return;acts=[];mine={g:-1,i:[],s:[]};fillD(V3.D,mine);hlTools();DSx.pr=0;updDonutHUD();SFX.trash()};$('#ddone').onclick=finish;
 $('#drdy').onclick=()=>{if(dp!='brief')return;DSx.rd=1;$('#drdy').disabled=true;$('#drdy').textContent='Waiting for rival...';SFX.sel();pub();chkStart()}}

function resetRound(sd,gn){clearInterval(dtm);dseed=sd;dgn=gn;ref=genRef(sd);mine={g:-1,i:[],s:[]};acts=[];cur=null;lastDone='';Object.assign(DSx,{gn,sd,rd:0,dn:0,pr:0,ds:'',rq:0});dp='brief';
 fillD(V3.D,mine);fillD(RV.D,ref);tool={k:'g',i:0};tubs('g');updDonutHUD();$('#dcount').textContent='';$('#dref').classList.add('big');$('#dordno').textContent='#'+(101+gn);$('#drdy').hidden=false;$('#drdy').disabled=false;$('#drdy').textContent="I'M READY!";$('#dst').textContent='New order! Study the ticket';$('#dtm').textContent=fmt(75);$('#dclock').style.setProperty('--p',1);$('#dclock').classList.remove('hot2');$('#dres').hidden=true;$('#over').hidden=true;dBotD=null;$('#dgame').classList.add('brief');pub();fitAll();SFX.bell()}
function newRound(){resetRound((Math.random()*1e9|0)+1,dgn+1)}
function chkStart(){if(dp=='brief'&&DSx.rd&&(dBot||(opp&&opp.rd&&opp.sd==dseed)))startCount()}
async function startCount(){dp='count';$('#drdy').hidden=true;$('#dref').classList.remove('big');$('#dgame').classList.remove('brief');const g=dgn;
 for(const n of[3,2,1]){$('#dcount').innerHTML=`<span class="dcn">${n}</span>`;SFX.count();await wait(800);if(dp!='count'||g!=dgn)return}
 $('#dcount').innerHTML='<span class="dcn go">DECORATE!</span>';SFX.go();await wait(650);if(dp!='count'||g!=dgn)return;$('#dcount').textContent='';
 endAt=Date.now()+75000;dp='play';lsec=0;$('#dst').textContent='Copy the order!';clearInterval(dtm);dtm=setInterval(tick,200);tick()}
function tick(){const l=Math.max(0,endAt-Date.now()),s=Math.ceil(l/1000);$('#dtm').textContent=fmt(s);$('#dclock').style.setProperty('--p',(l/75000).toFixed(3));$('#dclock').classList.toggle('hot2',s<=10);if(s<=10&&s>0&&s!=lsec){lsec=s;SFX.tick()}if(l<=0)finish()}
let mineSent=null;
function finish(){if(dp!='play')return;clearInterval(dtm);dp='wait';cur=null;setBrush(null);DSx.dn=1;DSx.pr=mine.i.length+mine.s.length;DSx.ds=encD(mine);mineSent=decD(DSx.ds);$('#dclock').classList.remove('hot2');$('#dst').textContent=dBot?'The customer is tasting...':'Served! Waiting for your rival...';SFX.bell();pub();
 if(dBot){dBotD=decD(encD(botD(ref)));setTimeout(showResult,1100)}else donutSync()}
const REACT=[[.9,'😍','Perfect copy!'],[.75,'😋','Delicious!'],[.55,'🙂','Pretty good'],[.35,'😐','Hmm... close-ish'],[0,'😖','What is this?!']];
const starsHTML=r=>`<span class="dstarbar" style="--f:${(Math.round(r*10)/10*100).toFixed(0)}%"></span>`;
function showResult(){if(dp!='wait')return;dp='res';const rv=dBot?dBotD:decD(opp.ds),a=scoreOf(mineSent||mine,ref),b=scoreOf(rv,ref),w=a.tot>b.tot?0:a.tot<b.tot?1:-1;if(w>=0)wins[w]++;
 const bars=r=>[['Glaze',r.gl,0],['Drizzle',r.sy,r.xsy],['Cream',r.cr,r.xcr],['Toppings',r.tp,r.xtp]].map(x=>`<div class="br"><span>${x[0]}</span><div class="bar"><i style="--w:${x[1]==null?100:Math.round(x[1]*100)}%"></i></div><em class="${x[2]?'xtra':''}">${x[2]?'extra!':x[1]==null?'—':Math.round(x[1]*100)+'%'}</em></div>`).join('');
 const card=(img,name,r,win,cls)=>{const re=REACT.find(x=>r.raw>=x[0]);return`<div class="rc ${cls} ${win?'win':''}">${win?'<span class="crown">👑</span>':''}<div class="plate"><img src="${img}" alt=""></div><b>${esc(name)}</b>${starsHTML(r.raw)}<div class="sc"><span class="cnt" data-to="${r.tot}">0</span><small>/129</small></div><div class="react">${re[1]} ${re[2]}</div>${bars(r)}</div>`};
 $('#dr').innerHTML=`<div class="tkt-top">ORDER ${$('#dordno').textContent} · JUDGING</div><h2>${w<0?'DRAW!':w==0?'YOU WIN!':'YOU LOSE!'}</h2><div class="rg"><div class="rc tgt"><div class="plate"><img src="${sn(ref)}" alt="Target donut"></div><b>THE ORDER</b><div class="sc">₹129</div><div class="react">🧾 Target</div></div>${card(sn(mineSent||mine),me.n+' (you)',a,w==0,'')}${card(sn(rv),on,b,w==1,'')}</div><p class="dsess">Session: ${esc(me.n)} <b>${wins[0]}</b> – <b>${wins[1]}</b> ${esc(on)}</p><div class="row"><button class="btn m" id="dagain">Next order!</button><button class="btn b" id="dback">Menu</button></div>`;
 $('#dres').hidden=false;$('#dback').onclick=leave;$('#dagain').onclick=()=>{if(dBot||HOST)newRound();else{DSx.rq=dgn+1;pub();$('#dagain').textContent='Waiting for host...'}};
 document.querySelectorAll('#dr .cnt').forEach(el=>{const to=+el.dataset.to,t0=performance.now();const f=()=>{const k=Math.min(1,(performance.now()-t0)/1100);el.textContent='₹'+Math.round(to*(1-Math.pow(1-k,3)));if(k<1)requestAnimationFrame(f)};requestAnimationFrame(f)});
 setTimeout(()=>{$('#dr').classList.add('show');SFX.coin()},60);setTimeout(()=>jingle(w==0),900)}
function donutSync(){const q=opp;
 if(!q){if(dBot)return;lostAt=lostAt||Date.now();if(dp!='res'&&dp!='lost'){$('#dst').textContent='Rival disconnected...';if(Date.now()-lostAt>20000){dp='lost';clearInterval(dtm);$('#ot').textContent='RIVAL LEFT';$('#os').textContent='Your opponent disconnected.';$('#rm').hidden=true;$('#over').hidden=false}}return}
 lostAt=0;
 if(!HOST&&q.sd&&(q.gn!=dgn||q.sd!=dseed))return resetRound(q.sd,q.gn);
 if(HOST&&q.rq>dgn&&q.sd==dseed)return newRound();
 chkStart();if(dp=='wait'&&q.dn&&q.sd==dseed&&q.ds)showResult();
 $('#dpr').textContent=q.sd==dseed?(q.dn?'Rival: served!':'Rival: '+q.pr+' added'):''}
function startDonut(){if(!window.THREE){leave();return err('The 3D engine did not load. Reload the page.')}
 phase='dplay';dBot=false;show('dgame');init3();fitAll();$('#dpr').textContent='';wins=[0,0];
 if(HOST)resetRound((Math.random()*1e9|0)+1,0);else{dp='init';dseed=0;dgn=-1;$('#drdy').hidden=true;$('#dref').classList.remove('big');$('#dst').textContent='Connecting to the bakery...'}
 if(!raf)loop()}
async function soloD(){me.n=($('#nm').value.trim()||'Hero').slice(0,12);if(!window.THREE){err('Loading 3D engine…');try{await need3D()}catch(e){return err('The 3D engine did not load. Check your internet and try again.')}}leave();G='donut';cpu=true;dBot=true;HOST=true;on='Chef Bot';oc=(me.ch+1)%H.length;wins=[0,0];phase='dplay';show('dgame');init3();fitAll();$('#net').hidden=true;$('#dpr').textContent='Rival: Chef Bot';resetRound((Math.random()*1e9|0)+1,0);if(!raf)loop()}

$('#go2').onclick=()=>join('donut');$('#solo2').onclick=soloD;
ART_SVG.donut=`<svg viewBox="0 0 360 130" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><defs><pattern id="gWall" width="24" height="24" patternUnits="userSpaceOnUse"><rect width="24" height="24" fill="#ffe9f1"/><rect width="12" height="24" fill="#ffd3e4"/></pattern></defs><rect width="360" height="130" fill="url(#gWall)"/><path d="M0 28H360" stroke="#14111f" stroke-width="3"/><path d="M20 30V44M100 30V44" stroke="#14111f" stroke-width="2"/><g stroke="#14111f" stroke-width="2.5" stroke-linejoin="round"><path d="M10 44H46V72L42 76H14L10 72Z" fill="#fffdf5"/><path d="M84 44H118V70L114 74H88L84 70Z" fill="#fffdf5" transform="rotate(4 100 58)"/></g><path d="M16 52h24M16 58h18M16 64h22M90 52h22M90 58h16M90 64h20" stroke="#c9b9a0" stroke-width="2" transform=""/><rect x="0" y="0" width="360" height="16" fill="#ff5c98"/><path d="M14 0h14v16h-14zM42 0h14v16h-14zM70 0h14v16h-14zM98 0h14v16h-14zM126 0h14v16h-14zM154 0h14v16h-14zM182 0h14v16h-14zM210 0h14v16h-14zM238 0h14v16h-14zM266 0h14v16h-14zM294 0h14v16h-14zM322 0h14v16h-14zM350 0h14v16h-14z" fill="#fff"/><g stroke="#14111f" stroke-width="2.5"><path d="M0 16a7 7 0 0 0 14 0M28 16a7 7 0 0 0 14 0M56 16a7 7 0 0 0 14 0M84 16a7 7 0 0 0 14 0M112 16a7 7 0 0 0 14 0M140 16a7 7 0 0 0 14 0M168 16a7 7 0 0 0 14 0M196 16a7 7 0 0 0 14 0M224 16a7 7 0 0 0 14 0M252 16a7 7 0 0 0 14 0M280 16a7 7 0 0 0 14 0M308 16a7 7 0 0 0 14 0M336 16a7 7 0 0 0 14 0" fill="#ff5c98"/><path d="M14 16a7 7 0 0 0 14 0M42 16a7 7 0 0 0 14 0M70 16a7 7 0 0 0 14 0M98 16a7 7 0 0 0 14 0M126 16a7 7 0 0 0 14 0M154 16a7 7 0 0 0 14 0M182 16a7 7 0 0 0 14 0M210 16a7 7 0 0 0 14 0M238 16a7 7 0 0 0 14 0M266 16a7 7 0 0 0 14 0M294 16a7 7 0 0 0 14 0M322 16a7 7 0 0 0 14 0M350 16a7 7 0 0 0 14 0" fill="#fff"/><path d="M0 16H360" fill="none"/></g><rect y="98" width="360" height="32" fill="#c98446"/><rect y="94" width="360" height="8" fill="#e0a465" stroke="#14111f" stroke-width="3"/><path d="M0 112H360M0 122H360" stroke="#a8642f" stroke-width="2"/><g stroke="#14111f" stroke-width="3"><path d="M262 96V60M246 96H278" fill="none"/><ellipse cx="262" cy="60" rx="40" ry="6" fill="#fff"/><ellipse cx="262" cy="80" rx="30" ry="5" fill="#fff"/></g><g stroke="#14111f" stroke-width="2.5"><ellipse cx="244" cy="52" rx="13" ry="7" fill="#8a5527"/><ellipse cx="244" cy="50" rx="11" ry="5" fill="#5a2f14"/><ellipse cx="244" cy="50" rx="3.5" ry="1.6" fill="#ffe9f1"/><ellipse cx="270" cy="52" rx="13" ry="7" fill="#d99a52"/><ellipse cx="270" cy="50" rx="11" ry="5" fill="#6ec6ff"/><ellipse cx="270" cy="50" rx="3.5" ry="1.6" fill="#ffe9f1"/><ellipse cx="262" cy="73" rx="12" ry="6" fill="#d99a52"/><ellipse cx="262" cy="71" rx="10" ry="4.5" fill="#7fe3b0"/><ellipse cx="262" cy="71" rx="3" ry="1.5" fill="#ffe9f1"/></g><g stroke="#14111f" stroke-width="3"><ellipse cx="150" cy="96" rx="62" ry="12" fill="#fff"/><ellipse cx="150" cy="94" rx="52" ry="8" fill="none" stroke="#ff9fc4" stroke-width="2.5"/><ellipse cx="150" cy="80" rx="50" ry="24" fill="#d99a52"/><path d="M102 74Q104 54 150 52Q196 54 198 74Q196 84 186 84Q182 92 176 84Q160 90 146 86Q138 94 132 86Q114 88 108 82Q102 80 102 74Z" fill="#ff6fa8"/><ellipse cx="150" cy="70" rx="15" ry="6.5" fill="#ffe9f1"/></g><g stroke-width="4" stroke-linecap="round"><path d="M120 66l7-2" stroke="#ffe14d"/><path d="M134 60l-2 6" stroke="#2fe3a0"/><path d="M168 59l6 3" stroke="#2d9bff"/><path d="M184 70l6-1" stroke="#fff"/><path d="M128 78l6 3" stroke="#b45cff"/><path d="M166 80l-5 3" stroke="#ffe14d"/><path d="M150 57v5" stroke="#fff"/><path d="M114 74l5 1" stroke="#2d9bff"/><path d="M178 64l-4 3" stroke="#ff8a1f"/><path d="M146 80l5 1" stroke="#2fe3a0"/></g><path d="M118 56Q130 50 142 52" fill="none" stroke="#fff" stroke-width="3.5" stroke-linecap="round" opacity=".8"/><g fill="#ffe14d" stroke="#14111f" stroke-width="2" class="gspark"><path d="M214 40l3 7 7 3-7 3-3 7-3-7-7-3 7-3z"/><path d="M80 84l2 5 5 2-5 2-2 5-2-5-5-2 5-2z"/></g><g stroke="#14111f" stroke-width="3" stroke-linejoin="round"><path d="M318 96V70Q318 62 326 62H344Q352 62 352 70V96Z" fill="#fff"/><path d="M322 62Q324 46 335 44Q346 46 348 62" fill="#ff6fa8"/><rect x="324" y="72" width="22" height="14" rx="3" fill="#ffe14d"/></g><path d="M330 78h10" stroke="#14111f" stroke-width="2.5"/></svg>`;
ART_SVG.m_donut=`<svg viewBox="0 0 120 100" aria-hidden="true"><ellipse cx="60" cy="60" rx="46" ry="34" fill="#d99a52" stroke="#14111f" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><ellipse cx="60" cy="53" rx="42" ry="30" fill="#ff7eb6" stroke="#14111f" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><ellipse cx="60" cy="53" rx="13" ry="8" fill="#bfefff" stroke="#14111f" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><g stroke-width="4.5" stroke-linecap="round"><path d="M26 50l6-3" stroke="#ffd23f"/><path d="M40 36l-3 6" stroke="#2fe3a0"/><path d="M82 36l5 3" stroke="#2d9bff"/><path d="M93 54l6-2" stroke="#fff"/><path d="M45 68l5 3" stroke="#b45cff"/><path d="M78 68l-5 4" stroke="#ffd23f"/><path d="M60 29v6" stroke="#2fe3a0"/><path d="M33 60l5-1" stroke="#fff"/><path d="M88 44l-4 3" stroke="#ff8a1f"/></g></svg>`;
