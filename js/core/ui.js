/* Screens & navigation: light/dark theme, show(screen), the game plug-in registry
   (regGame), the results overlay (setOver) and the shared rematch button. */
/* Theme Switcher */
let darkTheme=false;
try{
  if(localStorage.bbtheme){darkTheme=localStorage.bbtheme==='dark';document.documentElement.setAttribute('data-theme',darkTheme?'dark':'light')}
}catch(e){}
$('#bt').onclick=()=>{
  const curTheme=document.documentElement.getAttribute('data-theme');
  const isDark=curTheme?curTheme==='dark':window.matchMedia('(prefers-color-scheme:dark)').matches;
  const next=isDark?'light':'dark';
  document.documentElement.setAttribute('data-theme',next);
  try{localStorage.bbtheme=next}catch(e){}
  SFX.ui();
};
$('#home-logo').onclick=()=>{if(phase!=='menu')leave();else show('hub')};

/* ---------- game plug-ins ----------
   Newer games live in their own files (games/*.js) and register here. Each one gives:
   menu / stage section ids, a room-code input, a music theme, and hooks the shared
   online code calls: start(mode), sync(), event(d), fast(d), hb(), stop(), rematch(). */
const GAMES={};
function regGame(id,def){GAMES[id]=def;MENU_MAP[id]=def.menu;
  const cd=def.cd&&$(def.cd);if(cd)cd.value=(IV&&IV.c)||$('#cd').value;
  document.querySelectorAll(`[data-art="${id}"]`).forEach(el=>{if(ART_GEN[id])drawScene(el)});
  if(IV&&IV.g===id)$('#it').textContent='You were invited to play '+def.name+' (room '+IV.c+'). Enter your name and hero, then:';}
const plugSections=()=>Object.values(GAMES).flatMap(g=>[g.menu,g.stage]);
function show(id){
  ['hub','menu','dmenu','rmenu','pmenu','hmenu','qmenu','lobby','game','dgame','rgame','pgame','hgame','qgame',...plugSections()].forEach(x=>{const e=$('#'+x);if(e)e.hidden=x!=id});
  $('#over').hidden=true;$('#dres').hidden=true;
  const plug=Object.values(GAMES).find(g=>g.menu===id||g.stage===id);
  const ingame=['game','dgame','rgame','pgame','hgame','qgame'].includes(id)||!!(plug&&plug.stage===id);
  document.documentElement.classList.toggle('touchrace',id==='rgame'&&(typeof TOUCH_UI!=='undefined'&&TOUCH_UI));
  $('#app').classList.toggle('ingame',ingame);
  $('#net').hidden=['hub','menu','dmenu','rmenu','pmenu','hmenu','qmenu'].includes(id)||!!(plug&&plug.menu===id)||cpu;
  music(plug?plug.theme:{game:'brawl',menu:'brawl',dgame:'donut',dmenu:'donut',rgame:'race',rmenu:'race',pgame:'puzzle',pmenu:'puzzle',hgame:'hang',hmenu:'hang',qgame:'rps',qmenu:'rps'}[id]||(id=='lobby'?(GAMES[G]?GAMES[G].theme:{brawl:'brawl',donut:'donut',race:'race',puzzle:'puzzle',hang:'hang',rps:'rps'}[G]):'hub'));
  if(id==='rmenu')initGarage3D();
  scrollTo(0,0);
}

// Each game file adds its menu + game screens to the page with this.
function mountScreens(html){$('#app').insertAdjacentHTML('beforeend',html)}
function mountOverlay(html){document.body.insertAdjacentHTML('beforeend',html)}

function rmLabel(){$('#rm').textContent=opp&&opp.g>myG?'Accept rematch!':'Rematch!'}
function setOver(title,sub,btn){$('#ot').textContent=title;$('#os').innerHTML=sub;$('#rm').hidden=false;if(btn)$('#rm').textContent=btn;else rmLabel();$('#over').hidden=false}
function rematch(){
  if(GAMES[G]&&GAMES[G].rematch){$('#over').hidden=true;return GAMES[G].rematch()}
  if(G=='race'){
    $('#over').hidden=true;
    if(rMode=='online'&&opp){myG=opp.g>myG?opp.g:myG+1;pub();startRace(rMode)}
    else startRace(rMode);
    return;
  }
  if(G=='puzzle'){
    $('#over').hidden=true;
    if(pModeType==='ocoop')return pNewVault();
    startPuzzle(pModeType==='coop'||pModeType==='duel'?'local':pModeType);
    return;
  }
  if(G=='rps'){$('#over').hidden=true;if(Qm!='online')return startRps(Qm);if(!opp)return;myG=opp.g>myG?opp.g:myG+1;mh=oh='';pub();$('#qcap').textContent='Waiting for your rival to accept...';$('#over').hidden=false;$('#os').textContent='Waiting for your rival to accept...';return rpsSync()}
  if(G=='hang'){$('#over').hidden=true;if(Hm!='online')return startHang(Hm);if(!opp)return;myG=opp.g>myG?opp.g:myG+1;Hph='rematch';pub();hMsg('Waiting for your rival to accept...');return hangSync()}
  if(cpu){mh=oh='';return startBattle()}
  if(!opp)return;myG=opp.g>myG?opp.g:myG+1;mh=oh='';sel=null;pub();$('#os').textContent='Waiting for your rival to accept...';chk()
}

// hub card -> menu screen for each game (newer games add themselves via regGame)
var MENU_MAP={brawl:'menu',donut:'dmenu',race:'rmenu',puzzle:'pmenu',hang:'hmenu',rps:'qmenu'};
