/* GAME: Bam! Brawl — pick a move each round; Strike beats Grab, Grab beats Guard, Guard blocks Strike, Kick breaks Guard. */
mountScreens(`
<!-- GAME 1 MENU: BAM! BRAWL -->
<section id="menu" class="card gmenu" hidden>
<div class="mhero"><div class="mart" data-art="brawl"></div><h2 class="mh">Bam! Brawl</h2></div>
<label>Room code (auto-filled if you opened an invite link)<input id="cd" maxlength="6" autocomplete="off"></label>
<div class="row"><button class="btn" id="go">Duel a friend online</button><button class="btn b" id="solo">Practice vs CPU</button></div>
<p class="note" id="msg"></p>
<ul class="rules"><li>Both players lock in a move at the same time, then it all explodes. Keys <b>1–6</b> pick a move, <b>Enter</b> locks it in.</li><li><b>Strike</b> beats Grab · <b>Grab</b> beats Guard · <b>Guard</b> blocks Strike · <b>Kick</b> cracks through Guard.</li><li><b>Grab</b> also steals 1⚡. <b>Mega</b> needs 3⚡ and hits for 3. You can't Guard twice in a row.</li><li>Empty your rival's 6 health segments to win.</li></ul>
<button class="btn m back" data-back>← All games</button></section>


<!-- GAME 1 STAGE: BAM! BRAWL -->
<section id="game" hidden>
<div class="hud"><div class="card pl"><div class="nm" id="n0"></div><div class="hp" id="hp0"></div><div class="en" id="en0"></div></div>
<div class="card pl r"><span class="lk bang" id="lk1" hidden>LOCKED IN!</span><div class="nm" id="n1"></div><div class="hp" id="hp1"></div><div class="en" id="en1"></div></div></div>
<div class="stage"><svg class="sky" viewBox="0 0 400 100" preserveAspectRatio="none"><path d="M0 100V60h30V35h40v30h25V20h45v45h30V45h40V70h30V30h40v40h30V50h40v50z" fill="#8a6fd6" stroke="#14111f" stroke-width="3"/></svg>
<span id="rtag">ROUND 1</span><div class="mcard" id="mc0"></div><div class="mcard" id="mc1"></div>
<div class="h idle" id="h0"></div><div class="h idle" id="h1"></div><div id="bw"><div id="burst"></div></div></div>
<p id="cap" class="bang" style="font-size:24px">Get ready!</p>
<div class="moves" id="moves"></div>
<button class="btn" id="lock">PICK A MOVE</button>
<div class="row" style="margin-top:6px"><button class="btn b sm" id="brawl-quit">Exit to hub</button></div>
</section>
`);

const H=[
  {n:'Blaze',k:'#ffd2a6',a:'#ff4b3e',b:'#ffd23f',c:'#ff7a00'},
  {n:'Volt',k:'#ffe0bd',a:'#2d7bff',b:'#ffe14d',c:'#ffd400'},
  {n:'Mochi',k:'#ffe3d3',a:'#ff6fb5',b:'#ffffff',c:'#7b3fe4'},
  {n:'Gizmo',k:'#9fe8d8',a:'#2fbf8f',b:'#ff8a1f',c:'#8a5cff'},
  {n:'Rex',k:'#ffd9b8',a:'#3dbb5e',b:'#ffe14d',c:'#2a8a45'},
  {n:'Pip',k:'#fff1e6',a:'#ff9fca',b:'#ffffff',c:'#57b8ff'},
  {n:'Ace',k:'#f1c7a4',a:'#ff8a1f',b:'#2fe3a0',c:'#1f2a44'},
  {n:'Luna',k:'#ffe3d3',a:'#8a5cff',b:'#ffe14d',c:'#2b1f6b'}
];
const MV={S:['👊','STRIKE','1⚡ · 1 dmg'],K:['🦶','KICK','2⚡ · 2 dmg · breaks guard'],T:['🤼','GRAB','1⚡ · beats Guard · steals ⚡'],G:['🛡️','GUARD','Blocks Strike · +1⚡'],C:['⚡','CHARGE','+1 energy'],M:['💥','MEGA','3⚡ · 3 dmg']};
const MOVES='SKTGCM',COST={S:1,K:2,T:1,M:3};
const POSE={C:'charge',S:'strike',G:'guard',M:'mega',K:'kick',T:'grab'},HP=6;
let prevHP=[HP,HP];

function hero(i,p,vb='0 0 230 240'){
 const{k,a,b,c}=H[i],st=(w,x='',col=I)=>`stroke="${col}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" ${x}`;
 const A=(x,y,X,Y)=>`<path d="M${x} ${y}L${X} ${Y}" ${st(23)}/><path d="M${x} ${y}L${X} ${Y}" ${st(15,'',a)}/><circle cx="${X}" cy="${Y}" r="12" fill="${b}" ${st(4)}/>`;
 const arms={idle:[58,152,146,150],charge:[72,166,128,166],strike:[60,140,180,108],guard:[112,92,88,92],mega:[172,104,176,114],hurt:[48,98,152,98],win:[58,150,150,52],kick:[66,128,136,104],grab:[170,126,182,146]}[p]||[58,152,146,150];
 const legs=p=='kick'?[[88,176,84,222],[112,176,182,150]]:p=='grab'?[[88,176,74,222],[112,176,132,220]]:[[88,176,84,222],[112,176,116,222]];
 const L=([x,y,X,Y],i)=>`<path d="M${x} ${y}L${X} ${Y}" ${st(25)}/><path d="M${x} ${y}L${X} ${Y}" ${st(17,'',a)}/>`;
 const foot=([,,X,Y],kk)=>kk&&p=='kick'?`<ellipse cx="${X+6}" cy="${Y-2}" rx="17" ry="10" transform="rotate(-25 ${X+6} ${Y-2})" fill="${c}" ${st(4)}/>`:`<ellipse cx="${X-2}" cy="${Y+5}" rx="17" ry="9" fill="${c}" ${st(4)}/>`;
 const bk=[
  `<path d="M64 62L58 24 78 42 88 10 102 38 118 8 124 40 144 22 136 62Z" fill="${c}" ${st(4)}/>`,
  `<path d="M66 60L54 36 80 44 76 14 98 36 112 4 120 36 146 20 134 60Z" fill="${c}" ${st(4)}/>`,
  `<path d="M64 74Q60 34 100 36Q140 34 136 74L136 100 124 100 124 70 76 70 76 100 64 100Z" fill="${c}" ${st(4)}/><path d="M66 54L60 14 92 38ZM134 54L140 14 108 38Z" fill="${c}" ${st(4)}/><path d="M68 40L66 26 80 36ZM132 40L134 26 120 36Z" fill="#ffc2e0"/>`,
  `<path d="M100 42V18" ${st(5)}/><circle cx="100" cy="15" r="7" fill="${b}" ${st(4)}/><circle cx="64" cy="74" r="9" fill="${b}" ${st(4)}/><circle cx="136" cy="74" r="9" fill="${b}" ${st(4)}/>`,
  `<path d="M78 36L84 14 94 32 102 10 110 32 120 14 124 38Z" fill="${b}" ${st(4)}/><path d="M60 92Q54 30 100 28Q146 30 140 92Z" fill="${c}" ${st(4)}/>`,
  `<path d="M80 48Q62 -4 82 2Q98 10 94 44Z" fill="${b}" ${st(4)}/><path d="M120 48Q138 -4 118 2Q102 10 106 44Z" fill="${b}" ${st(4)}/><path d="M83 40Q74 10 83 12Q89 18 88 40ZM117 40Q126 10 117 12Q111 18 112 40Z" fill="#ffb3d1"/>`,
  `<path d="M63 82Q58 32 100 32Q142 32 137 82L137 100 126 100 126 72 74 72 74 100 63 100Z" fill="#7a4a2a" ${st(4)}/>`,
  `<path d="M100 -2L70 48H130Z" fill="${c}" ${st(4)}/><path d="M100 14l3 7 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z" fill="${b}" ${st(2)}/>`
 ][i];
 const fr=[
  `<path d="M66 62Q100 50 134 62L130 86Q100 80 70 86Z" fill="${a}" ${st(4)}/>`,
  `<path d="M66 72H134" ${st(5)}/><circle cx="86" cy="72" r="14" fill="#7fd4ff" ${st(4)}/><circle cx="114" cy="72" r="14" fill="#7fd4ff" ${st(4)}/>`,
  `<path d="M68 62Q80 40 100 46Q120 40 132 62Q116 52 100 58Q84 52 68 62Z" fill="${c}" ${st(3)}/>`,
  `<rect x="70" y="56" width="60" height="32" rx="14" fill="#1b1740" ${st(4)}/>`,
  `<path d="M64 62Q100 40 136 62L136 54Q100 30 64 54Z" fill="${c}" ${st(4)}/><path d="M72 58l5 7 5-8 6 7 6-8 6 8 6-8 6 7 5-7 5 7" fill="#fff" ${st(2.5)}/>`,
  `<path d="M67 64Q74 42 100 42Q126 42 133 64Q122 54 112 58Q104 48 96 58Q86 50 67 64Z" fill="#9a6440" ${st(3)}/><circle cx="80" cy="86" r="5" fill="#ff9fca" opacity=".7"/><circle cx="120" cy="86" r="5" fill="#ff9fca" opacity=".7"/>`,
  `<path d="M64 54H136" ${st(7,'','#5a3a22')}/><circle cx="85" cy="52" r="11" fill="#7fd4ff" ${st(4)}/><circle cx="115" cy="52" r="11" fill="#7fd4ff" ${st(4)}/><path d="M80 48l5-3M110 48l5-3" ${st(2.5,'','#fff')}/>`,
  `<ellipse cx="100" cy="47" rx="46" ry="9" fill="${c}" ${st(4)}/><path d="M70 54Q84 64 100 56Q116 64 130 54L130 50 70 50Z" fill="#6b4bd6" ${st(3)}/>`
 ][i];
 const head=i==3?`<rect x="66" y="40" width="68" height="62" rx="18" fill="${k}" ${st(5)}/>`:`<circle cx="100" cy="72" r="34" fill="${k}" ${st(5)}/>`;
 const eyes={hurt:`<path d="M80 64l16 16M96 64L80 80M104 64l16 16M120 64L104 80" ${st(4)}/>`,win:`<path d="M80 76Q88 62 96 76M104 76Q112 62 120 76" fill="none" ${st(4,'',i==3?'#fff':I)}/>`,guard:`<path d="M80 72H96M104 72H120" ${st(5,'',i==3?'#fff':I)}/>`}[p]||`<ellipse cx="88" cy="72" rx="8" ry="10" fill="#fff" ${st(3)}/><ellipse cx="112" cy="72" rx="8" ry="10" fill="#fff" ${st(3)}/><circle cx="91" cy="73" r="4" fill="${I}"/><circle cx="115" cy="73" r="4" fill="${I}"/><path d="M78 ${i==4||i==7?60:57}L97 64M122 ${i==4||i==7?60:57}L103 64" ${st(4)}/>`;
 const mouth={strike:`<ellipse cx="100" cy="93" rx="9" ry="7" fill="#7a1230" ${st(3)}/>`,kick:`<ellipse cx="100" cy="93" rx="9" ry="7" fill="#7a1230" ${st(3)}/>`,grab:`<path d="M88 88h24v8q-12 6-24 0z" fill="#fff" ${st(3)}/>`,mega:`<ellipse cx="100" cy="93" rx="10" ry="8" fill="#7a1230" ${st(3)}/>`,charge:`<path d="M88 88h24v8q-12 6-24 0z" fill="#fff" ${st(3)}/>`,hurt:`<path d="M90 95q5-6 10 0t10 0" fill="none" ${st(3)}/>`,win:`<path d="M88 86Q100 108 112 86Z" fill="#7a1230" ${st(3)}/>`,guard:`<path d="M90 93h20" ${st(4)}/>`}[p]||`<path d="M91 90Q100 97 109 90" fill="none" ${st(3.5)}/>`;
 const fx={charge:`<ellipse cx="100" cy="140" rx="78" ry="104" fill="#ffe14d" opacity=".4"/><path d="M26 80L48 126 34 126 54 176M174 70L152 116 166 116 146 166" fill="none" ${st(6,'','#ffe14d')}/>`,guard:`<path d="M100 36Q156 50 156 112Q156 172 100 200Q44 172 44 112Q44 50 100 36Z" fill="#7fd4ff" fill-opacity=".5" ${st(5)}/>`,mega:`<path d="M182 112H320" ${st(26)}/><path d="M182 112H320" ${st(16,'','#7fe3ff')}/><path d="M182 112H320" ${st(6,'','#fff')}/><circle cx="188" cy="110" r="26" fill="#fff" ${st(5)}/><circle cx="188" cy="110" r="14" fill="#ff8a1f"/>`,strike:`<path d="M12 96h38M4 122h44M18 148h34" ${st(4)} opacity=".5"/>`,kick:`<path d="M120 196Q170 196 196 132" fill="none" ${st(5,'','#fff')} opacity=".9"/><path d="M10 120h36M2 146h40" ${st(4)} opacity=".5"/>`,grab:`<path d="M6 104h40M0 132h46M10 160h36" ${st(4)} opacity=".5"/><path d="M196 112l12-8M198 132l14 2M194 152l12 8" ${st(4)}/>`,hurt:`<path d="M60 20l5 11 12 1-9 8 3 12-11-6-11 6 3-12-9-8 12-1z" fill="#ffe14d" ${st(3)}/>`}[p]||'';
 return`<svg viewBox="${vb}" preserveAspectRatio="xMidYMax meet" xmlns="http://www.w3.org/2000/svg">${p=='charge'?fx:''}<path d="M80 108Q36 170 58 226L142 226Q164 170 120 108Z" fill="${c}" ${st(5)}/>${legs.map(L).join('')}${legs.map(foot).join('')}<path d="M72 112Q100 104 128 112L124 182Q100 190 76 182Z" fill="${a}" ${st(5)}/><rect x="76" y="168" width="48" height="11" fill="${b}" ${st(3)}/><circle cx="100" cy="140" r="14" fill="${b}" ${st(3)}/><path d="M100 129l3.5 7 8 1-6 5.5 2 8-7.5-4-7.5 4 2-8-6-5.5 8-1z" fill="${a}"/>${A(78,122,arms[0],arms[1])}${bk}${head}${fr}${eyes}${mouth}${A(122,122,arms[2],arms[3])}${p=='charge'?'':fx}</svg>`}
const star=n=>'polygon('+[...Array(n*2)].map((_,i)=>{const r=i%2?36:50,a=Math.PI*i/n;return(50+r*Math.cos(a)).toFixed(1)+'% '+(50+r*Math.sin(a)).toFixed(1)+'%'}).join()+')';
$('#burst').style.clipPath=star(11);
function bang(t){const b=$('#burst');b.textContent=t;b.classList.remove('pop');void b.offsetWidth;b.classList.add('pop')}
const ch=()=>[me.ch,oc],nm=()=>[me.n,on];
const valid=(s,X,m)=>m=='C'||(m=='G'&&!X.lg[s])||(COST[m]&&X.en[s]>=COST[m]);
/* Simultaneous resolution. Strike beats Grab, Grab beats Guard, Guard blocks Strike, Kick breaks Guard. */
function step(X,a,b){const m=[a,b],en=[...X.en],d=[0,0],gain=[0,0],stl=[0,0],blk=[0,0];
 for(let i=0;i<2;i++)if(COST[m[i]])en[i]-=COST[m[i]];
 for(let i=0;i<2;i++){const o=1-i,x=m[i],y=m[o];
  if(x=='S'){if(y=='G'){gain[o]++;blk[o]=1}else d[o]+=y=='T'?2:1}
  if(x=='K'){d[o]+=y=='G'?1:2;if(y=='G')blk[o]=2}
  if(x=='T'){if(y=='G'){d[o]+=2;stl[i]=1}else if(y=='C'){d[o]+=1;stl[i]=1}}
  if(x=='M'){d[o]+=y=='G'?1:3;if(y=='G')blk[o]=2}
  if(x=='C')gain[i]++}
 for(let i=0;i<2;i++)en[i]=Math.min(3,en[i]+gain[i]);
 for(let i=0;i<2;i++)if(stl[i]){const o=1-i;if(en[o]>0){en[o]--;en[i]=Math.min(3,en[i]+1)}else stl[i]=0}
 return{hp:[X.hp[0]-d[0],X.hp[1]-d[1]],en,lg:[+(a=='G'),+(b=='G')],d,stl,blk}}
function word(a,b){const p=a+b,has=x=>a==x||b==x,both=(x,y)=>p==x+y||p==y+x;
 if(a=='M'&&b=='M')return'MEGA CLASH!';if(has('M'))return has('G')?'CRACK!':'KA-BOOM!';
 if(both('T','G'))return'GOTCHA!';if(both('T','C'))return'SNATCHED!';if(both('T','S'))return'COUNTER!';if(both('T','K'))return'THWACK!';if(p=='TT')return'TUSSLE!';
 if(both('K','G'))return'GUARD BREAK!';if(p=='KK')return'DOUBLE KICK!';if(has('K'))return'WHAM!';
 if(p=='SS')return'CLASH!';if(has('S'))return has('G')?'BLOCKED!':'POW!';return p=='GG'?'STAND-OFF!':'POWER UP!'}
function setPose(s,p,cls=''){const e=$('#h'+s);e.innerHTML=hero(ch()[s],p);e.className='h '+cls}


function render(){if(!S)return;
 [0,1].forEach(s=>{const lost=prevHP[s]>S.hp[s];$('#hp'+s).innerHTML=[...Array(HP)].map((_,i)=>`<i class="${i<S.hp[s]?'':'x'}${lost&&i>=S.hp[s]&&i<prevHP[s]?' drop':''}"></i>`).join('');prevHP[s]=S.hp[s];
  $('#en'+s).innerHTML=[0,1,2].map(i=>`<b class="${i<S.en[s]?'on':''}">⚡</b>`).join('');$('#n'+s).textContent=nm()[s]+(s?'':' (you)')});
 $('#lk1').hidden=busy||phase=='over'||!(oh.length>rounds);
 document.querySelectorAll('.mv').forEach(b=>{const m=b.dataset.m;b.disabled=phase!='pick'||!valid(0,S,m);b.classList.toggle('sel',sel==m)});
 $('#lock').disabled=phase!='pick'||!sel;$('#lock').textContent=phase=='wait'?'Waiting for rival...':sel?'LOCK IN '+MV[sel][1]+'!':'PICK A MOVE'}
function float(s,t,cls=''){const e=document.createElement('span');e.className='dmg '+cls;e.textContent=t;e.style.left=s?'70%':'24%';$('.stage').append(e);setTimeout(()=>e.remove(),1300)}
function spark(s,cls){const e=document.createElement('span');e.className='spark '+cls;e.style.left=s?'66%':'34%';$('.stage').append(e);setTimeout(()=>e.remove(),600)}
function confetti(){const st=$('.stage');for(let k=0;k<36;k++){const e=document.createElement('i');e.className='conf';e.style.left=(Math.random()*100)+'%';e.style.background=['#ff3e8a','#ffe14d','#2fe3a0','#2d7bff','#ff8a1f'][k%5];e.style.animationDelay=(Math.random()*.5)+'s';e.style.setProperty('--r',(Math.random()*720-360|0)+'deg');st.append(e);setTimeout(()=>e.remove(),2600)}}
function startBattle(){S={hp:[HP,HP],en:[1,1],lg:[0,0]};prevHP=[HP,HP];rounds=0;mh='';sel=null;busy=false;phase='pick';
 show('game');setPose(0,'idle','idle');setPose(1,'idle','idle');$('#cap').textContent='Round 1 — pick your move!';$('#rtag').textContent='ROUND 1';render();bang('FIGHT!');SFX.go();pub()}
function sync(){if(phase!='pick'&&phase!='wait'||busy||!S)return;if(mh.length>rounds&&oh.length>rounds)reveal(rounds)}
const ACT={S:'go',K:'go',T:'go grab',M:'charge-up',C:'pulse',G:'brace'};
async function reveal(r){busy=true;phase='reveal';const a=mh[r],b=oh[r],N=step(S,a,b),m=[a,b];render();
 [0,1].forEach(s=>{const c=$('#mc'+s);c.innerHTML=`<i>${MV[m[s]][0]}</i><b>${MV[m[s]][1]}</b>`;c.className='mcard show m'+m[s]});
 $('#cap').textContent=`${nm()[0]}: ${MV[a][1]}  vs  ${nm()[1]}: ${MV[b][1]}`;
 SFX.whoosh();await wait(520);if($('#game').hidden)return;
 [0,1].forEach(s=>setPose(s,POSE[m[s]],ACT[m[s]]));
 if(m.includes('C'))SFX.charge();if(m.includes('S')||m.includes('K')||m.includes('T'))SFX.whoosh();
 await wait(m.includes('M')?380:240);if($('#game').hidden)return;
 bang(word(a,b));
 const big=N.d[0]>=2||N.d[1]>=2;
 if(m.includes('M'))SFX.mega();else if(m.includes('K')&&(N.d[0]||N.d[1]))SFX.kickhit();else if(N.d[0]||N.d[1])SFX.punch();
 [0,1].forEach(s=>{
  if(N.d[s]){setPose(s,'hurt','hit');float(s,'-'+N.d[s],N.d[s]>=3?'huge':N.d[s]>=2?'big':'');spark(s,N.d[s]>=2?'big':'')}
  if(N.blk[s]){spark(s,'shield');if(N.blk[s]==1)SFX.block();setTimeout(()=>float(s,N.blk[s]==1?'BLOCK! +1⚡':'GUARD CRACKED','info'),150)}
  if(N.stl[s]){SFX.grab();setTimeout(()=>{float(s,'+1⚡','info');float(1-s,'-1⚡','info')},280)}
 });
 if(big){$('.stage').classList.remove('shake');void $('.stage').offsetWidth;$('.stage').classList.add('shake')}
 if(!N.d[0]&&!N.d[1]&&!N.blk[0]&&!N.blk[1]&&(a=='C'||b=='C'))[0,1].forEach(s=>{if(m[s]=='C')float(s,'+1⚡','info')});
 S=N;rounds++;render();await wait(1250);if($('#game').hidden)return;
 [0,1].forEach(s=>$('#mc'+s).className='mcard');
 const dead=[S.hp[0]<=0,S.hp[1]<=0];
 if(dead[0]||dead[1]){phase='over';busy=false;const w=dead[0]&&dead[1]?-1:dead[1]?0:1;
  [0,1].forEach(s=>setPose(s,w==-1||w!=s?'hurt':'win',w==-1||w!=s?'ko':'idle cheer'));
  bang(w<0?'DOUBLE KO!':'K.O.!');SFX.ko();$('.stage').classList.remove('shake');void $('.stage').offsetWidth;$('.stage').classList.add('shake');if(w==0)confetti();render();await wait(1500);if($('#game').hidden)return;jingle(w==0);
  $('#ot').textContent=w<0?'DRAW!':w==0?'YOU WIN!':'YOU LOSE!';$('#os').textContent=w<0?'Everybody went down. Epic.':w==0?`${nm()[0]} crushed ${nm()[1]} in ${rounds} rounds!`:`${nm()[1]} got you this time.`;
  rmLabel();$('#over').hidden=false;return}
 [0,1].forEach(s=>setPose(s,'idle','idle'));sel=null;phase='pick';busy=false;$('#rtag').textContent='ROUND '+(rounds+1);$('#cap').textContent='Round '+(rounds+1)+' — pick your move!';render();sync()}
function lock(){if(!sel||phase!='pick')return;mh+=sel;phase='wait';SFX.sel();if(cpu)oh+=cpuMove();pub();render();sync()}
function cpuMove(){
  const v=MOVES.split('').filter(m=>valid(1,S,m));
  const pEn=S.en[0],cEn=S.en[1],pG=!S.lg[0],last=mh[mh.length-2]||'';
  const w={S:3,K:2.4,T:2,G:2.2,C:2.6,M:6};
  if(pEn>=3&&pG)w.G=4.5;
  if(pEn==0){w.T=6;w.S=1.2;w.K=1.5;w.G=.6}
  if(!pG){w.S+=2;w.K+=2.5;w.T=.4}
  if(cEn>=3)w.M=8;
  if(cEn==0)w.C=5;
  if(last=='G'){w.T+=2}
  if(S.hp[0]<=2){w.K+=2;w.M+=2}
  let t=v.reduce((s,m)=>s+w[m],0)*Math.random();
  for(const m of v){t-=w[m];if(t<0)return m}
  return v[0];
}

function chk(){if(phase=='over'&&opp&&opp.g==myG&&mh==''&&!opp.h)startBattle()}
function solo(){G='brawl';me.n=($('#nm').value.trim()||'Hero').slice(0,12);leave();cpu=true;oc=(me.ch+1+Math.floor(Math.random()*(H.length-1)))%H.length;on='CPU '+H[oc].n;mh=oh='';startBattle();$('#net').hidden=true}
$('#brawl-quit').onclick=leave;

$('#moves').innerHTML=MOVES.split('').map((m,i)=>`<button class="mv" data-m="${m}"><kbd>${i+1}</kbd><i>${MV[m][0]}</i><b>${MV[m][1]}</b><span>${MV[m][2]}</span></button>`).join('');
$('#moves').onclick=e=>{const b=e.target.closest('.mv');if(b&&!b.disabled&&phase=='pick'){sel=b.dataset.m;SFX.ui();render()}};
addEventListener('keydown',e=>{if(phase!='pick'||$('#game').hidden)return;const m=MOVES[+e.key-1];if(m&&valid(0,S,m)){sel=m;SFX.ui();render()}else if(e.key=='Enter')lock()});
$('#lock').onclick=lock;$('#go').onclick=()=>join('brawl');$('#solo').onclick=solo;
ART_SVG.brawl=el=>{el.classList.add('a');el.innerHTML=hero(4,'grab')+hero(1,'hurt')};
