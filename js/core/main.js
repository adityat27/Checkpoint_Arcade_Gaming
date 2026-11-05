/* Startup: fills in the profile (name, avatar picker), paints the menu art, wires
   invite links and the music/sound buttons. The hub itself (cards, featured game) is js/core/hub.js. Loaded after the built-in games, before the plug-in games. */
try{const c=+localStorage.bbch;if(c>=0&&c<H.length)me.ch=c}catch(e){}
const pava=()=>{$('#pava').innerHTML=hero(me.ch,'idle','46 -6 108 118');if(window.HUB)HUB.syncChip()};
$('#picks').innerHTML=H.map((h,i)=>`<button class="pick" data-i="${i}" aria-label="${h.n}">${hero(i,'idle','46 -6 108 118')}<b>${h.n}</b></button>`).join('');
$('#picks').onclick=e=>{const b=e.target.closest('.pick');if(!b)return;me.ch=+b.dataset.i;try{localStorage.bbch=me.ch}catch(x){}document.querySelectorAll('.pick').forEach(x=>x.classList.toggle('on',x==b));pava();SFX.sel()};
document.querySelectorAll('.pick')[me.ch].classList.add('on');pava();
$('#bk').onclick=leave;$('#mn').onclick=leave;$('#rm').onclick=rematch;
$('#cp').onclick=async()=>{const t=`Join my CHECKPOINT!! match: ${link()}`;try{await navigator.clipboard.writeText(t);$('#lm').textContent='Link copied! Send it to your friend.'}catch(e){$('#lm').textContent='Copy the link above and send it to your friend.'}};
let nm0='';try{nm0=localStorage.bbnm||''}catch(e){}$('#nm').value=nm0||'Hero'+Math.floor(10+Math.random()*90);$('#nm').onchange=()=>{try{localStorage.bbnm=$('#nm').value.trim().slice(0,12)}catch(e){}};$('#nm').oninput=()=>{if(window.HUB)HUB.syncChip()};
$('#cd').value=(location.hash.replace(/[^a-zA-Z0-9]/g,'').slice(0,6)||Math.random().toString(36).slice(2,7)).toUpperCase();
document.querySelectorAll('[data-art]').forEach(paintArt);

document.querySelectorAll('[data-back]').forEach(b=>b.onclick=()=>{show('hub');SFX.back()});
$('#cd2').value=$('#cd3').value=$('#cd4').value=$('#cd5').value=$('#cd6').value=$('#cd').value;

const IV=(()=>{const m=location.hash.match(/^#(?:([a-z]+)[\/-])?([A-Za-z0-9]{3,6})$/);return m?{g:m[1]||'brawl',c:m[2].toUpperCase()}:null})();
if(IV){
  $('#cd').value=$('#cd2').value=$('#cd3').value=$('#cd4').value=$('#cd5').value=$('#cd6').value=IV.c;
  $('#ibx').hidden=false;
  const gNames={brawl:'Bam! Brawl',donut:'Glaze Craze',race:'Overdrive',puzzle:'Cipher Sync',hang:'Hang Tight',rps:'Rock Paper Scissors'};
  $('#it').textContent='You were invited to play '+(gNames[IV.g]||'Bam! Brawl')+' (room '+IV.c+'). Enter your name and hero, then:';
  $('#ib').onclick=()=>join(IV.g);
}
['pointerdown','keydown'].forEach(e=>addEventListener(e,()=>{ctx();music(trk)},{once:true}));
$('#bm').onclick=()=>{ctx();mOn=!mOn;try{localStorage.bbm=mOn?1:0}catch(e){}vol();if(mOn)music(trk);else{clearInterval(mt);mt=0}snd()};
$('#bs').onclick=()=>{ctx();sOn=!sOn;try{localStorage.bbs=sOn?1:0}catch(e){}vol();snd();SFX.ui()};
addEventListener('pagehide',()=>{try{send({id:ID,bye:1})}catch(e){}});snd();
// warm up the 3D + online libraries in the background so games start instantly
setTimeout(()=>{need3D().catch(()=>{});needNet().catch(()=>{})},60);
