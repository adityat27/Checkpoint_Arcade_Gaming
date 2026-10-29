/* Card art for the hub and the menu banners.
   ART_GEN[key] = (width, n) => svg   pictures drawn to fit the card's shape
   ART_SVG[key] = 'svg' | fn(el)      fixed pictures
   ART.ink / ART.rays / ART.dots       drawing helpers */
const ART=(()=>{
const K='#14111f',ink=(w=3)=>`stroke="${K}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"`;
const rays=(cx,cy,n,R,a,b,op=1)=>{let o=`<g opacity="${op}">`;for(let i=0;i<n;i++){const t0=i/n*Math.PI*2,t1=(i+.5)/n*Math.PI*2;o+=`<path d="M${cx} ${cy}L${(cx+Math.cos(t0)*R).toFixed(1)} ${(cy+Math.sin(t0)*R).toFixed(1)}L${(cx+Math.cos(t1)*R).toFixed(1)} ${(cy+Math.sin(t1)*R).toFixed(1)}Z" fill="${i%2?b:a}"/>`}return o+'</g>'};
const dots=(id,col,op)=>`<pattern id="${id}" width="9" height="9" patternUnits="userSpaceOnUse"><circle cx="4.5" cy="4.5" r="1.5" fill="${col}" opacity="${op}"/></pattern>`;
return{K,ink,rays,dots}})();
const ART_GEN={},ART_SVG={};
let artN=0;
function drawScene(el){const r=el.getBoundingClientRect(),W=el.classList.contains('mart')?1100:r.width>0&&r.height>0?Math.round(Math.max(200,Math.min(1100,130*r.width/r.height))):360;if(el._w===W)return;el._w=W;el.innerHTML=ART_GEN[el.dataset.art](W,++artN)}
let sceneT=0;addEventListener('resize',()=>{clearTimeout(sceneT);sceneT=setTimeout(()=>document.querySelectorAll('.gc .art.scene').forEach(e=>{if(e.offsetParent)drawScene(e)}),200)});
function paintArt(el){const k=el.dataset.art;if(ART_GEN[k])return drawScene(el);const a=ART_SVG[k];if(!a)return;if(typeof a==='function')return a(el);
  const n=++artN,sfx=`_${n}`;el.innerHTML=a.replace(/ id="([A-Za-z0-9_]+)"/g,` id="$1${sfx}"`).replace(/url[(]#([A-Za-z0-9_]+)[)]/g,`url(#$1${sfx})`).replace(/ href="#([A-Za-z0-9_]+)"/g,` href="#$1${sfx}"`)}
