/* GAME: Rock Paper Scissors — best of 3/5/7; solo, same-device and online. */
mountScreens(`
<!-- GAME 6 MENU: ROCK PAPER SCISSORS -->
<section id="qmenu" class="card gmenu" hidden>
<div class="mhero"><div class="mart" data-art="rps"></div><h2 class="mh">Rock Paper Scissors</h2></div>
<div class="row rsets">
  <label>Match length<select id="qbo-sel"><option value="3" selected>Best of 3</option><option value="5">Best of 5</option><option value="7">Best of 7</option></select></label>
  <label>Player 2 name (same device)<input id="qp2name" maxlength="12" placeholder="Player 2" autocomplete="off"></label>
  <label>Online room code<input id="cd6" maxlength="6" autocomplete="off"></label>
</div>
<div class="row"><button class="btn b" id="qsolo">Solo vs CPU</button><button class="btn o" id="qlocal">2 Players · same device</button><button class="btn" id="qgo">Online with a friend</button></div>
<p class="note" id="msg6"></p>
<ul class="rules"><li>Rock beats Scissors, Scissors beats Paper, Paper beats Rock.</li><li><b>Same device:</b> pick in secret with the keys. Player 1 uses <b>A S D</b>, Player 2 uses <b>J K L</b>.</li><li>The CPU learns your habits, so mix it up!</li></ul>
<button class="btn m back" data-back>← All games</button></section>


<!-- GAME 6 STAGE: ROCK PAPER SCISSORS -->
<section id="qgame" hidden>
<div class="card qtop">
  <div class="qpl"><b id="qn0"></b><span class="qpips" id="qs0"></span></div>
  <div class="qmid"><span id="qbo">BEST OF 3</span><span id="qrd" class="bang">ROUND 1</span></div>
  <div class="qpl r"><b id="qn1"></b><span class="qpips" id="qs1"></span></div>
</div>
<div class="qstage">
  <div class="qhand l" id="qh0"></div><div class="qhand r" id="qh1"></div>
  <span class="qlock l" id="ql0" hidden>LOCKED ✓</span><span class="qlock r" id="ql1" hidden>LOCKED ✓</span>
  <div class="qcall" id="qcall"></div>
  <div class="qres" id="qres"></div>
</div>
<div class="qhist" id="qhist"></div>
<p id="qcap" class="qcap"></p>
<div class="qpads" id="qpads"><div class="qpad" id="qp0"></div><div class="qpad" id="qp1"></div></div>
<div class="row" style="margin-top:8px"><button class="btn b sm" id="qquit">Exit to hub</button></div>
</section>
`);

/* =========================================================================
   GAME 6: ROCK PAPER SCISSORS — solo vs CPU, same-device duel, online
   ========================================================================= */
const RPS_N={R:'ROCK',P:'PAPER',S:'SCISSORS'},RPS_BEATS={R:'S',P:'R',S:'P'};
let Qm='cpu',Qbo=3,Qsc=[0,0],Qloc=['',''],QSx={qb:3},Qstat={R:0,P:0,S:0},Qtrans={};
function handSVG(sh,skin,sleeve){
 const st=(w,c='#14111f')=>`stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"`;
 const fg=(x,y,X,Y)=>`<path d="M${x} ${y}L${X} ${Y}" ${st(22)} fill="none"/><path d="M${x} ${y}L${X} ${Y}" ${st(14,skin)} fill="none"/>`;
 const sl=`<path d="M-4 34H58V90H-4Z" fill="${sleeve}" ${st(4)}/><path d="M52 30H68V94H52Z" fill="#fff" ${st(4)}/>`;
 let h='';
 if(sh=='R')h=`<rect x="64" y="26" width="80" height="72" rx="30" fill="${skin}" ${st(4)}/><path d="M132 36Q124 50 132 62M134 62Q124 74 132 88" fill="none" ${st(3.5)}/><path d="M86 34Q110 20 128 32Q118 42 98 42Z" fill="${skin}" ${st(4)}/><path d="M104 52Q116 58 114 76Q112 86 100 88" fill="none" ${st(3.5)}/>`;
 else if(sh=='P')h=`${fg(110,40,182,26)}${fg(116,54,192,50)}${fg(116,68,190,74)}${fg(110,82,178,96)}${fg(92,36,114,6)}<rect x="64" y="28" width="66" height="68" rx="24" fill="${skin}" ${st(4)}/><path d="M118 34Q126 60 118 88" fill="none" ${st(3)} opacity=".35"/>`;
 else h=`${fg(112,44,188,18)}${fg(116,60,194,64)}<rect x="64" y="28" width="72" height="70" rx="26" fill="${skin}" ${st(4)}/><path d="M122 70Q134 76 128 90M108 78Q122 84 116 96" fill="none" ${st(3.5)}/><path d="M88 36Q106 26 118 38Q110 46 96 46Z" fill="${skin}" ${st(4)}/>`;
 return`<svg viewBox="-6 0 206 124" xmlns="http://www.w3.org/2000/svg">${sl}${h}</svg>`}
const Qskin=()=>[H[me.ch].k,H[oc].k],Qsleeve=()=>[H[me.ch].a,H[oc].a];
function qHand(s,sh,cls=''){const e=$('#qh'+s);e.innerHTML=handSVG(sh,Qskin()[s],Qsleeve()[s]);e.className='qhand '+(s?'r ':'l ')+cls}
function qPads(){const mk=(s,keys)=>['R','P','S'].map((k,i)=>`<button class="qbtn" data-s="${s}" data-k="${k}"><span class="qic">${handSVG(k,Qskin()[s],Qsleeve()[s])}</span><b>${RPS_N[k]}</b>${keys?`<kbd>${keys[i]}</kbd>`:''}</button>`).join('');
 const loc=Qm=='local';$('#qp0').innerHTML=(loc?`<p class="qwho">${esc(me.n)}</p>`:'')+`<div class="qrow">${mk(0,loc?'ASD':'123')}</div>`;$('#qp1').innerHTML=loc?`<p class="qwho">${esc(on)}</p><div class="qrow">${mk(1,'JKL')}</div>`:'';$('#qp1').hidden=!loc;$('#qpads').classList.toggle('two',loc)}
function qRender(){const need=Math.ceil(Qbo/2);
 [0,1].forEach(s=>{$('#qn'+s).textContent=nm()[s]+(s==0&&Qm!='local'?' (you)':'');$('#qs'+s).innerHTML=[...Array(need)].map((_,i)=>`<i class="${i<Qsc[s]?'on':''}"></i>`).join('')});
 $('#qbo').textContent='BEST OF '+Qbo;$('#qrd').textContent='ROUND '+(rounds+1);
 const hist=[];for(let r=0;r<rounds;r++){const a=mh[r],b=oh[r],w=a==b?-1:RPS_BEATS[a]==b?0:1;hist.push(`<span class="qhi ${w==0?'w':w==1?'l':'d'}">${RPS_N[a][0]}<small>v</small>${RPS_N[b][0]}</span>`)}
 $('#qhist').innerHTML=hist.join('');
 const lk=[mh.length>rounds,oh.length>rounds];
 document.querySelectorAll('.qbtn').forEach(b=>{const s=+b.dataset.s,mine=s==0?mh[rounds]:oh[rounds];b.disabled=phase!='qpick'||lk[s]||(Qm!='local'&&s==1);b.classList.toggle('sel',Qm!='local'&&s==0&&mine==b.dataset.k)});
 [0,1].forEach(s=>{$('#ql'+s).hidden=!(lk[s]&&phase=='qpick')});
 $('#qcap').textContent=phase=='qpick'?(Qm=='local'?(lk[0]&&!lk[1]?`${on}, your turn: press J / K / L`:!lk[0]&&lk[1]?`${me.n}, your turn: press A / S / D`:'Both players: pick in secret!'):lk[0]?'Locked in! Waiting for '+on+'...':'Pick your move!'):''}
function startRps(mode){Qm=mode;rounds=0;mh='';oh='';Qsc=[0,0];busy=false;phase='qpick';Qstat={R:0,P:0,S:0};Qtrans={};
 if(mode!='online')Qbo=+$('#qbo-sel').value||3;else if(HOST)Qbo=QSx.qb=+$('#qbo-sel').value||3;
 show('qgame');qPads();[0,1].forEach(s=>qHand(s,'R','idle'));$('#qcall').textContent='';$('#qres').className='qres';$('#qres').textContent='';qRender();pub();if(mode=='online')rpsSync()}
function qPick(s,k){if(phase!='qpick'||busy)return;if(Qm!='local'&&s!=0)return;
 if(s==0){if(mh.length>rounds)return;mh+=k}else{if(oh.length>rounds)return;oh+=k}
 SFX.sel();if(Qm=='cpu')oh+=qCpu();pub();qRender();qCheck()}
function qCpu(){const last=mh[mh.length-2];let w={R:1,P:1,S:1};
 if(last&&Qtrans[last]){const t=Qtrans[last],tot=t.R+t.P+t.S;if(tot>=2){['R','P','S'].forEach(k=>{const beat=Object.keys(RPS_BEATS).find(x=>RPS_BEATS[x]==k);w[beat]+=2.2*t[k]/tot})}}
 const tot=Qstat.R+Qstat.P+Qstat.S;if(tot>=3)['R','P','S'].forEach(k=>{const beat=Object.keys(RPS_BEATS).find(x=>RPS_BEATS[x]==k);w[beat]+=1.2*Qstat[k]/tot});
 let r=Math.random()*(w.R+w.P+w.S);for(const k of['R','P','S']){r-=w[k];if(r<0)return k}return'R'}
function qCheck(){if(phase=='qpick'&&!busy&&mh.length>rounds&&oh.length>rounds)qReveal()}
async function qReveal(){busy=true;phase='qreveal';qRender();const a=mh[rounds],b=oh[rounds],g=myG;
 const pm=mh[rounds-1];if(pm){Qtrans[pm]=Qtrans[pm]||{R:0,P:0,S:0};Qtrans[pm][a]++}Qstat[a]++;
 $('#qres').className='qres';
 for(const w of['ROCK...','PAPER...','SCISSORS...']){$('#qcall').innerHTML=`<span>${w}</span>`;[0,1].forEach(s=>qHand(s,'R','bob'));SFX.shake();await wait(430);if(g!=myG||$('#qgame').hidden)return}
 $('#qcall').innerHTML='<span class="shoot">SHOOT!</span>';SFX.shoot();
 const w=a==b?-1:RPS_BEATS[a]==b?0:1;
 qHand(0,a,'show'+(w==0?' win':w==1?' lose':''));qHand(1,b,'show'+(w==1?' win':w==0?' lose':''));
 await wait(420);if($('#qgame').hidden)return;
 if(w>=0)Qsc[w]++;
 const loc=Qm=='local',txt=w<0?'DRAW!':loc?`${nm()[w]} WINS THE ROUND!`:w==0?'YOU WIN THE ROUND!':'YOU LOSE THE ROUND';
 const why=w<0?`Both picked ${RPS_N[a]}`:`${RPS_N[w==0?a:b]} beats ${RPS_N[w==0?b:a]}`;
 $('#qres').innerHTML=`<b>${txt}</b><small>${why}</small>`;$('#qres').className='qres show '+(w<0?'d':w==0||loc?'w':'l');
 if(w<0)SFX.ui();else if(w==0||loc)SFX.correct();else SFX.wrong();
 rounds++;qRender();await wait(1500);if(g!=myG||$('#qgame').hidden)return;
 const need=Math.ceil(Qbo/2);
 if(Qsc[0]>=need||Qsc[1]>=need){phase='over';busy=false;const W=Qsc[0]>=need?0:1;jingle(W==0||loc);
  $('#ot').textContent=loc?`${nm()[W]} WINS!`:W==0?'YOU WIN!':'YOU LOSE!';$('#os').textContent=`Final score ${Qsc[0]} – ${Qsc[1]} (best of ${Qbo})`;rmLabel();$('#rm').hidden=false;$('#over').hidden=false;return}
 $('#qcall').textContent='';$('#qres').className='qres';[0,1].forEach(s=>qHand(s,'R','idle'));phase='qpick';busy=false;qRender();qCheck()}
function rpsSync(){const q=opp;
 if(!q){if(phase=='over'){$('#rm').hidden=true;return}lostAt=lostAt||Date.now();if(Date.now()-lostAt>20000){phase='over';busy=false;$('#ot').textContent='RIVAL LEFT';$('#os').textContent='Your opponent disconnected.';$('#rm').hidden=true;$('#over').hidden=false}else $('#qcap').textContent='Rival disconnected. Waiting for them to come back...';return}
 lostAt=0;if(!HOST&&q.qb&&q.qb!=Qbo&&rounds==0){Qbo=q.qb;qRender()}
 if(phase=='over'){$('#rm').hidden=false;rmLabel();if(q.g==myG&&mh=='')startRps('online');return}
 qRender();qCheck()}
$('#qp0').onclick=$('#qp1').onclick=e=>{const b=e.target.closest('.qbtn');if(b&&!b.disabled)qPick(+b.dataset.s,b.dataset.k)};
addEventListener('keydown',e=>{if($('#qgame').hidden||phase!='qpick')return;const k=e.key.toLowerCase();
 if(Qm=='local'){const m={a:[0,'R'],s:[0,'P'],d:[0,'S'],j:[1,'R'],k:[1,'P'],l:[1,'S']}[k];if(m)qPick(m[0],m[1])}
 else{const m={'1':'R','2':'P','3':'S',r:'R',p:'P',s:'S'}[k];if(m)qPick(0,m)}});
$('#qquit').onclick=leave;
$('#qsolo').onclick=()=>{me.n=($('#nm').value.trim()||'Hero').slice(0,12);G='rps';leave();G='rps';cpu=true;oc=(me.ch+1+Math.floor(Math.random()*(H.length-1)))%H.length;on='CPU '+H[oc].n;startRps('cpu');$('#net').hidden=true};
$('#qlocal').onclick=()=>{me.n=($('#nm').value.trim()||'Player 1').slice(0,12);G='rps';leave();G='rps';cpu=true;oc=(me.ch+1)%H.length;on=($('#qp2name').value.trim()||'Player 2').slice(0,12);startRps('local');$('#net').hidden=true};
$('#qgo').onclick=()=>join('rps');


ART_GEN.rps=(()=>{const {K,ink,rays,dots}=ART;
function hand(sh){
  const sk='#ffd2a6',f=(x,y,w,h,r=0)=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${w/2}" fill="${sk}" ${ink(2.5)} transform="rotate(${r} ${x+w/2} ${y+h})"/>`;
  const cuff=`<rect x="-13" y="13" width="26" height="11" rx="3" fill="#2d7bff" ${ink(2.5)}/>`,palm=`<rect x="-15" y="-7" width="30" height="24" rx="9" fill="${sk}" ${ink(2.5)}/>`;
  if(sh==='R')return cuff+f(-14,-15,8,13)+f(-6.5,-17,8,14)+f(1,-16,8,13)+f(8.5,-13,7,11)+palm+`<path d="M-14 3Q-4 -1 7 4" fill="none" ${ink(7)}/><path d="M-14 3Q-4 -1 7 4" fill="none" stroke="${sk}" stroke-width="3.5" stroke-linecap="round"/>`;
  if(sh==='P')return cuff+f(-14,-27,7,24)+f(-6.5,-31,7,28)+f(1,-30,7,27)+f(8.5,-24,6.5,21)+f(-19,-6,7,16,-45)+palm;
  return cuff+f(-10,-32,7.5,30,-14)+f(1,-32,7.5,30,14)+f(7,-12,7,10)+palm+`<path d="M-14 4Q-6 0 4 6" fill="none" ${ink(7)}/><path d="M-14 4Q-6 0 4 6" fill="none" stroke="${sk}" stroke-width="3.5" stroke-linecap="round"/>`;
}
// Rock vs Scissors, face to face: two big badges, a VS burst in the exact centre.
function rps(W,n){
  const cx=W/2,cy=66,u='_q'+n,k=Math.min(1,(W-20)/250);
  const burst=(r1,r2,pts)=>{let d='';for(let i=0;i<pts*2;i++){const a=i/(pts*2)*Math.PI*2-Math.PI/2,r=i%2?r2:r1;d+=(i?'L':'M')+(Math.cos(a)*r).toFixed(1)+' '+(Math.sin(a)*r).toFixed(1)}return d+'Z'};
  const badge=(x,sh,col,rot,flip,cls)=>`<g transform="translate(${x} 0)"><g class="${cls}">
    <circle r="40" fill="#14111f" transform="translate(4 5)"/><circle r="40" fill="${col}"/><circle r="30" fill="#ffffff" opacity=".35"/>
    <clipPath id="qc${sh}${u}"><circle r="38"/></clipPath>
    <g clip-path="url(#qc${sh}${u})"><g transform="rotate(${rot}) scale(${flip?-1.3:1.3} 1.3) translate(0 10)">${hand(sh)}</g></g>
    <circle r="40" fill="none" ${ink(4.5)}/></g></g>`;
  return `<svg viewBox="0 0 ${W} 130" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><defs>${dots('qd'+u,K,.1)}</defs>
  <rect width="${W}" height="130" fill="#7fd4ff"/><rect x="${cx}" width="${W}" height="130" fill="#ff8ab8"/>
  <g class="qspin" style="transform-origin:${cx}px ${cy}px">${rays(cx,cy,24,W,'#ffffff38','#ffffff00')}</g>
  <rect width="${W}" height="130" fill="url(#qd${u})"/>
  <g transform="translate(${cx} ${cy}) scale(${k})">
    ${badge(-74,'R','#2d7bff',90,false,'qb1')}${badge(74,'S','#ff3e5a',-90,true,'qb3')}
    <g class="qvs"><path d="${burst(36,22,10)}" fill="#ffe14d" ${ink(4)}/>
    <text y="10" text-anchor="middle" font-family="Bangers,Impact,sans-serif" font-size="30" fill="#ffffff" stroke="#14111f" stroke-width="5" paint-order="stroke" letter-spacing="1">VS</text></g>
  </g></svg>`}
return rps})();
