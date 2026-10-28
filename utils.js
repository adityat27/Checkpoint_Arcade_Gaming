/* Small helpers every file uses, plus the background loader for the 3D engine
   (three.js) and the online library (MQTT). Loaded first. */
const $=s=>document.querySelector(s),I='#14111f',wait=ms=>new Promise(r=>setTimeout(r,ms));
/* Non-blocking library loader: the page renders instantly, 3D & online libraries load in the background with CDN fallbacks */
const LIBS={three:['https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js','https://cdn.jsdelivr.net/npm/three@0.128.0/build/three.min.js','https://unpkg.com/three@0.128.0/build/three.min.js'],
  mqtt:['https://cdn.jsdelivr.net/npm/mqtt@4.3.7/dist/mqtt.min.js','https://unpkg.com/mqtt@4.3.7/dist/mqtt.min.js']};
const LOADS={};
function loadLib(name,test){
  if(test())return Promise.resolve();
  if(LOADS[name])return LOADS[name];
  const urls=LIBS[name];
  return LOADS[name]=new Promise((res,rej)=>{let i=0;
    const next=()=>{if(test())return res();if(i>=urls.length){delete LOADS[name];return rej(new Error(name+' failed'))}
      const sc=document.createElement('script');sc.src=urls[i++];sc.async=true;let done=false;
      const fin=()=>{if(done)return;done=true;clearTimeout(t);test()?res():next()};
      const t=setTimeout(fin,12000);sc.onload=fin;sc.onerror=fin;document.head.appendChild(sc)};
    next()});
}
const need3D=()=>loadLib('three',()=>!!window.THREE),needNet=()=>loadLib('mqtt',()=>!!window.mqtt);
const rng=a=>()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296};
const fmt=n=>(n/60|0)+':'+String(n%60).padStart(2,'0'),esc=t=>String(t).replace(/[&<>"']/g,c=>'&#'+c.charCodeAt(0)+';');
// touch devices get on-screen pads and (by default) auto-accelerate
const TOUCH_UI=(window.matchMedia&&matchMedia('(pointer:coarse)').matches)||(navigator.maxTouchPoints||0)>0;
const angW=a=>{while(a>Math.PI)a-=2*Math.PI;while(a<-Math.PI)a+=2*Math.PI;return a};
