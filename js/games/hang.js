/* GAME: Hang Tight — hangman; solo, same-device duel and online duel. */
mountScreens(`
<!-- GAME 5 MENU: HANG TIGHT -->
<section id="hmenu" class="card gmenu" hidden>
<div class="mhero"><div class="mart" data-art="hang"></div><h2 class="mh">Hang Tight</h2></div>
<div class="row rsets">
  <label>Rounds (2 players)<select id="hrounds"><option value="2">2 rounds</option><option value="4" selected>4 rounds</option><option value="6">6 rounds</option></select></label>
  <label>Who picks the words?<select id="hsrc"><option value="players">Players (secret words)</option><option value="cpu">Computer (random)</option></select></label>
  <label>Category<select id="hcat-sel"></select></label>
</div>
<div class="row rsets"><label>Player 2 name (same device)<input id="hp2name" maxlength="12" placeholder="Player 2" autocomplete="off"></label><label>Online room code<input id="cd5" maxlength="6" autocomplete="off"></label></div>
<div class="row"><button class="btn b" id="hsolo">Solo</button><button class="btn o" id="hlocal">2 Players · same device</button><button class="btn" id="hgo">Online with a friend</button></div>
<p class="note" id="msg5"></p>
<ul class="rules"><li>Guess the hidden word one letter at a time. Six wrong guesses and the hero falls!</li><li><b>2 players:</b> take turns. One player picks a secret word, the other guesses it. Every save scores the lives left + 1.</li><li>Type on your keyboard or tap the letters.</li></ul>
<button class="btn m back" data-back>← All games</button></section>


<!-- GAME 5 STAGE: HANG TIGHT -->
<section id="hgame" hidden>
<div class="card htop">
  <div class="hpl" id="hpl0"><b id="hn0"></b><span id="hsc0"></span></div>
  <div class="hmid"><span id="hrd" class="bang">ROUND 1</span><span class="hcat" id="hcat"></span></div>
  <div class="hpl r" id="hpl1"><b id="hn1"></b><span id="hsc1"></span></div>
</div>
<div class="card hmain">
  <div class="hgal" id="hgal"></div>
  <div class="hside">
    <p class="hrole" id="hrole"></p>
    <div class="hword" id="hword"></div>
    <div class="hlives" id="hlives"></div>
    <p class="hmsg" id="hmsg2"></p>
    <div class="hset" id="hset" hidden>
      <div class="hsrow"><input id="hwin" type="password" maxlength="16" autocomplete="off" placeholder="Secret word"><button class="btn b sm" id="hshow" title="Show / hide" aria-label="Show or hide the word">👁</button></div>
      <div class="hsrow"><select id="hcin" aria-label="Category hint"></select><button class="btn o sm" id="hrand">🎲 Random</button></div>
      <button class="btn m" id="hok">Lock in the word!</button>
    </div>
  </div>
</div>
<div class="hkeys" id="hkeys"></div>
<div class="row hbtns"><button class="btn o sm" id="hhint">💡 Hint (costs 1 life)</button><button class="btn m sm" id="hnext" hidden>Next word →</button><button class="btn b sm" id="hquit">Exit</button></div>
</section>
`);

/* =========================================================================
   GAME 5: HANG TIGHT — classic hangman. Solo, same-device duel, online duel
   ========================================================================= */
const HCAT={
 Animals:'Elephant,Giraffe,Kangaroo,Penguin,Dolphin,Cheetah,Octopus,Tortoise,Hamster,Peacock,Gorilla,Raccoon,Flamingo,Crocodile,Butterfly,Squirrel,Hedgehog,Jellyfish,Panther,Rhino,Zebra,Lobster,Parrot,Beaver,Camel,Ostrich,Chameleon,Walrus,Meerkat,Sloth,Polar Bear,Sea Turtle',
 Food:'Pizza,Pancake,Sandwich,Noodles,Burrito,Cupcake,Dumpling,Muffin,Waffle,Brownie,Lasagna,Omelette,Popcorn,Pretzel,Samosa,Biryani,Paneer,Mango,Pineapple,Avocado,Broccoli,Spaghetti,Cheesecake,Croissant,Doughnut,Ketchup,Chocolate,Coconut,Blueberry,Taco,Ice Cream,Hot Dog',
 Countries:'India,Brazil,Canada,Japan,Egypt,Mexico,Norway,Kenya,France,Germany,Italy,Spain,Turkey,Vietnam,Argentina,Australia,Thailand,Portugal,Iceland,Morocco,Nepal,Peru,Chile,Greece,Sweden,Ireland,Singapore,Indonesia,Jamaica,Finland,New Zealand,South Africa',
 Sports:'Cricket,Football,Basketball,Badminton,Tennis,Hockey,Volleyball,Skateboarding,Surfing,Archery,Boxing,Cycling,Swimming,Karate,Fencing,Rowing,Climbing,Baseball,Rugby,Golf,Bowling,Skiing,Snowboarding,Marathon,Gymnastics,Wrestling,Kabaddi,Chess,Darts,Table Tennis,Water Polo',
 Space:'Planet,Galaxy,Comet,Asteroid,Rocket,Astronaut,Nebula,Satellite,Telescope,Jupiter,Saturn,Mercury,Neptune,Eclipse,Meteor,Orbit,Gravity,Moon,Spaceship,Supernova,Constellation,Mars,Venus,Uranus,Cosmos,Launchpad,Stardust,Black Hole,Milky Way,Space Station',
 Jobs:'Doctor,Teacher,Pilot,Chef,Farmer,Engineer,Dentist,Painter,Plumber,Scientist,Librarian,Firefighter,Mechanic,Architect,Journalist,Musician,Baker,Barber,Carpenter,Lawyer,Nurse,Photographer,Postman,Surgeon,Tailor,Astronomer,Designer,Gardener,Judge,Zookeeper',
 Home:'Pillow,Blanket,Toaster,Kettle,Curtain,Sofa,Lamp,Mirror,Bookshelf,Wardrobe,Bathtub,Toothbrush,Refrigerator,Microwave,Doorbell,Staircase,Carpet,Cushion,Television,Spatula,Teapot,Hammer,Umbrella,Backpack,Candle,Bucket,Ladder,Scissors,Calendar,Alarm Clock,Frying Pan',
 Nature:'Volcano,Rainbow,Waterfall,Glacier,Thunder,Canyon,Meadow,Jungle,Desert,Island,Lightning,Tornado,Blizzard,Sunflower,Mushroom,Cactus,Bamboo,Lagoon,Avalanche,Hurricane,Ocean,Forest,Pebble,Boulder,Sunrise,Moonlight,Breeze,River,Coral Reef,Rain Forest'
};
const HCATS=Object.keys(HCAT),HLIVES=6;
const hList=c=>HCAT[c].split(',').map(x=>x.trim().toUpperCase());
function hRand(cat,R=Math.random){const c=HCATS.includes(cat)?cat:HCATS[R()*HCATS.length|0],L=hList(c);return{w:L[R()*L.length|0],c}}
const hClean=s=>String(s||'').toUpperCase().replace(/[^A-Z ]/g,'').replace(/\s+/g,' ').trim().slice(0,16);
let Hm='solo',Hrounds=4,Hsrc='players',Hcat='Any',Hr=0,Hw='',Hc='',Hg='',Hpen=0,Hsc=[0,0],Hres=[],Hstreak=0,Hbest=0,Hph='',Hseed=0,Hto=0,HSx={hr:0,hw:'',hc:'',hg:'',hs:0,hm:''};
try{Hbest=+localStorage.hbest||0}catch(e){}
const hWrong=()=>[...new Set(Hg)].filter(l=>!Hw.includes(l)).length+Hpen;
const hSolved=()=>Hw&&[...Hw].every(l=>l==' '||Hg.includes(l));
function hGuesser(r){if(Hm=='solo')return 0;const g=Hsrc=='players'?(r%2==0?1:0):(r%2==0?0:1);if(Hm=='local')return g;return g==(HOST?0:1)?0:1}
const hNames=()=>[me.n,Hm=='solo'?'Best streak':on];
function hGal(){const w=hWrong(),gi=hGuesser(Hr),c=H[gi==0?me.ch:oc],lost=w>=HLIVES,won=hSolved()&&Hph=='end',st=(n,col='#14111f')=>`stroke="${col}" stroke-width="${n}" stroke-linecap="round" stroke-linejoin="round" fill="none"`;
 const P=(i,d)=>`<g class="hp ${w>i?'on':''}">${d}</g>`,limb=(x,y,X,Y,col)=>`<path d="M${x} ${y}L${X} ${Y}" ${st(13)}/><path d="M${x} ${y}L${X} ${Y}" ${st(7,col)}/>`;
 const face=lost?`<path d="M131 58l7 7M138 58l-7 7M143 58l7 7M150 58l-7 7" ${st(3)}/><path d="M133 74q7-5 14 0" ${st(3)}/>`:won?`<path d="M130 62q4-6 8 0M142 62q4-6 8 0" ${st(3)}/><path d="M132 70q8 9 16 0" ${st(3)}/>`:`<circle cx="134" cy="62" r="3" fill="#14111f"/><circle cx="146" cy="62" r="3" fill="#14111f"/><ellipse cx="140" cy="72" rx="4" ry="3" fill="#7a1230"/>${w>=4?'<path d="M156 52q5 3 3 9" stroke="#7fd4ff" stroke-width="3" fill="none" stroke-linecap="round"/>':''}`;
 return`<svg viewBox="0 0 200 220" class="${lost?'lost':''}${won?' won':''}"><ellipse cx="96" cy="208" rx="86" ry="8" fill="#14111f22"/><path d="M18 206H156M48 206V18H142M48 54L84 18" ${st(14)}/><path d="M18 206H156M48 206V18H142M48 54L84 18" ${st(8,'#b8743a')}/><path d="M140 18V${won?30:44}" ${st(5,'#c9a46a')}/>
 <g class="fig">${P(1,limb(140,82,140,138,c.a))}${P(2,limb(140,96,118,124,c.a))}${P(3,limb(140,96,162,124,c.a))}${P(4,limb(140,138,122,176,c.c))}${P(5,limb(140,138,158,176,c.c))}${P(0,`<circle cx="140" cy="64" r="18" fill="${c.k}" ${st(4)}/>${face}`)}</g></svg>`}
function hRender(){const gi=hGuesser(Hr),nm2=hNames(),w=hWrong(),end=Hph=='end'||Hph=='over';
 [0,1].forEach(s=>{$('#hn'+s).textContent=nm2[s]+(Hm=='online'&&s==0?' (you)':'');$('#hsc'+s).textContent=Hm=='solo'?(s?String(Hbest):'Streak '+Hstreak):Hsc[s]+' pts';$('#hpl'+s).classList.toggle('turn',Hm!='solo'&&gi==s&&!end)});
 $('#hrd').textContent=Hm=='solo'?'WORD '+(Hr+1):'ROUND '+Math.min(Hr+1,Hrounds)+'/'+Hrounds;
 $('#hcat').textContent=Hc?'Category: '+Hc:'';$('#hcat').hidden=!Hc;
 $('#hgal').innerHTML=hGal();
 const reveal=end||(Hm=='online'&&Hph=='watch'&&Hsrc=='players');
 $('#hword').innerHTML=Hw?Hw.split(' ').map(wd=>`<span class="hwd">${[...wd].map(l=>{const g=Hg.includes(l);return`<span class="hl ${g?'got':''} ${!g&&end?'miss':''} ${!g&&reveal&&!end?'peek':''}">${g||reveal?l:''}</span>`}).join('')}</span>`).join(''):`<span class="hwait">${Hph=='set'?'✍️':'⏳'}</span>`;
 $('#hlives').innerHTML=[...Array(HLIVES)].map((_,i)=>`<i class="${i<HLIVES-w?'':'x'}">${i<HLIVES-w?'❤':'💔'}</i>`).join('');
 const canGuess=Hph=='guess'&&(Hm!='online'||gi==0);
 $('#hkeys').innerHTML=['QWERTYUIOP','ASDFGHJKL','ZXCVBNM'].map(r=>`<div class="hkr">${[...r].map(l=>{const g=Hg.includes(l);return`<button class="hk ${g?(Hw.includes(l)?'ok':'no'):''}" data-l="${l}" ${g||!canGuess?'disabled':''}>${l}</button>`}).join('')}</div>`).join('');
 $('#hkeys').classList.toggle('off',!canGuess);
 $('#hset').hidden=Hph!='set';$('#hhint').hidden=!(Hm=='solo'&&Hph=='guess');$('#hnext').hidden=!(Hm=='solo'&&Hph=='end');
 $('#hrole').textContent=Hph=='set'?(Hm=='local'?`${nm2[1-gi]}: choose a secret word for ${nm2[gi]}. No peeking, ${nm2[gi]}!`:`Choose a secret word for ${nm2[gi]}!`):Hph=='wait'?`${nm2[1]} is choosing a secret word...`:Hph=='watch'?`${nm2[gi]} is guessing${Hsrc=='players'?' your word':''}...`:Hph=='guess'?(Hm=='local'?`${nm2[gi]}, guess the word!`:'Guess the word!'):Hph=='init'?'Connecting...':'';
}
function hMsg(t,cls=''){const e=$('#hmsg2');e.textContent=t;e.className='hmsg '+cls}
function hBegin(r){clearTimeout(Hto);Hr=r;Hg='';Hpen=0;Hw='';Hc='';hMsg('');const gi=hGuesser(r);
 Object.assign(HSx,{hr:r,hw:'',hc:'',hg:''});
 if(Hm=='solo'||Hsrc=='cpu'){const R=Hm=='solo'?Math.random:rng(Hseed+myG*1009+r*7919);const x=hRand(Hcat,R);Hw=x.w;Hc=x.c;Hph=Hm=='online'&&gi!=0?'watch':'guess'}
 else if(Hm=='local'){Hph='set'}
 else Hph=gi==0?'wait':'set';
 if(Hph=='set'){$('#hwin').value='';$('#hwin').type='password';$('#hcin').value=HCATS.includes(Hcat)?Hcat:'Animals';setTimeout(()=>{try{$('#hwin').focus()}catch(e){}},50)}
 hRender();pub();if(Hm=='online')hangSync()}
function hSubmitWord(){if(Hph!='set')return;const w=hClean($('#hwin').value);if(w.replace(/ /g,'').length<3){hMsg('Use at least 3 letters (A–Z).','bad');SFX.wrong();return}
 Hw=w;Hc=$('#hcin').value;SFX.sel();hMsg('');
 if(Hm=='local'){Hph='guess'}else{Hph='watch';HSx.hw=Hw;HSx.hc=Hc;pub()}hRender()}
function hGuess(l){const gi=hGuesser(Hr);if(Hph!='guess'||(Hm=='online'&&gi!=0)||Hg.includes(l)||!/^[A-Z]$/.test(l))return;
 Hg+=l;HSx.hg=Hg;const ok=Hw.includes(l);if(ok){SFX.correct();hMsg(['Nice!','Yes!','Good one!','Got it!'][Math.random()*4|0],'good')}else{SFX.wrong();hMsg(`No "${l}"`,'bad');$('#hgal').classList.remove('wob');void $('#hgal').offsetWidth;$('#hgal').classList.add('wob')}
 pub();hCheckEnd();if(Hph=='guess')hRender()}
function hHint(){if(Hm!='solo'||Hph!='guess')return;const left=[...new Set(Hw.replace(/ /g,''))].filter(l=>!Hg.includes(l));if(left.length<2){hMsg('No hints on the last letter!','bad');return}
 const l=left[Math.random()*left.length|0];Hg+=l;Hpen++;SFX.chime();hMsg(`Hint: "${l}" (cost 1 life)`,'');hCheckEnd();if(Hph=='guess')hRender()}
function hCheckEnd(){if(Hph!='guess'&&Hph!='watch')return;const won=hSolved(),lost=hWrong()>=HLIVES;if(!won&&!lost)return;
 Hph='end';const gi=hGuesser(Hr),nm2=hNames(),pts=won?HLIVES-hWrong()+1:0;
 if(Hm=='solo'){if(won){Hstreak++;if(Hstreak>Hbest){Hbest=Hstreak;try{localStorage.hbest=Hbest}catch(e){}}}else Hstreak=0}
 else{Hres[Hr]={gi,won,pts};Hsc[gi]+=pts}
 const me1=Hm=='online'?gi==0:true;
 if(won){hMsg(Hm=='solo'?`Saved! Streak ${Hstreak}`:`${nm2[gi]} saved the hero! +${pts} pts`,'good');if(me1||Hm=='local')jingleS(true);else SFX.wrong()}
 else{hMsg(`Oh no! The word was ${Hw}`,'bad');SFX.creak();setTimeout(()=>{if(me1)jingleS(false);else SFX.correct()},500)}
 hRender();
 if(Hm!='solo'){Hto=setTimeout(()=>{if(Hr+1<Hrounds)hBegin(Hr+1);else hOver()},3200)}}
function jingleS(w){if(!AC||!sOn)return;const t=AC.currentTime+.02;(w?[76,79,84]:[67,63,60]).forEach((m,i)=>tone(m,t+i*.11,.22,'triangle',.12,SG))}
function hOver(){Hph='over';hRender();const nm2=hNames(),W=Hsc[0]==Hsc[1]?-1:Hsc[0]>Hsc[1]?0:1;jingle(W!=1||Hm=='local');
 $('#ot').textContent=W<0?'DRAW!':Hm=='local'?`${nm2[W]} WINS!`:W==0?'YOU WIN!':'YOU LOSE!';$('#os').textContent=`${nm2[0]} ${Hsc[0]} pts – ${Hsc[1]} pts ${nm2[1]}`;rmLabel();$('#rm').hidden=false;$('#over').hidden=false}
function startHang(mode){clearTimeout(Hto);Hm=mode;Hsc=[0,0];Hres=[];Hstreak=0;phase='hplay';
 if(mode!='online'||HOST){Hrounds=+$('#hrounds').value||4;Hsrc=$('#hsrc').value=='cpu'?'cpu':'players';Hcat=$('#hcat-sel').value;if(mode=='online'){Hseed=Hseed||((Math.random()*1e9|0)+1);HSx.hs=Hseed;HSx.hm=[Hrounds,Hsrc,Hcat].join('|')}}
 if(mode=='solo')Hsrc='cpu';
 show('hgame');$('#hgame').classList.toggle('solo',mode=='solo');
 if(mode=='online'&&!HOST){Hph='init';Hw='';Hg='';hRender();hangSync();return}
 hBegin(0)}
function hangSync(){const q=opp;if(Hm!='online')return;
 if(!q){if(Hph=='over'){$('#rm').hidden=true;return}lostAt=lostAt||Date.now();if(Date.now()-lostAt>20000){clearTimeout(Hto);Hph='over';$('#ot').textContent='RIVAL LEFT';$('#os').textContent='Your opponent disconnected.';$('#rm').hidden=true;$('#over').hidden=false}else hMsg('Rival disconnected. Waiting for them...','bad');return}
 lostAt=0;
 if(!HOST&&q.hm&&q.hs&&Hph=='init'){const[x,y,z]=q.hm.split('|');Hrounds=Math.max(2,Math.min(10,+x||4));Hsrc=y=='cpu'?'cpu':'players';Hcat=HCATS.includes(z)?z:'Any';Hseed=q.hs;return hBegin(0)}
 if(Hph=='rematch'){if(q.g==myG){Hsc=[0,0];Hres=[];hBegin(0)}return}
 if(Hph=='over'){$('#rm').hidden=false;rmLabel();return}
 if(q.hr!==Hr)return;
 const gi=hGuesser(Hr);
 if(Hph=='wait'&&q.hw){Hw=hClean(q.hw);Hc=HCATS.includes(q.hc)?q.hc:'';Hph='guess';SFX.bell();hRender();return}
 if((Hph=='watch')&&gi==1){const g=q.hg||'';if(g!==Hg){const nl=g.slice(Hg.length);Hg=g;if(nl){Hw.includes(nl[nl.length-1])?SFX.correct():SFX.wrong()}hRender();hCheckEnd()}}
}
$('#hkeys').onclick=e=>{const b=e.target.closest('.hk');if(b&&!b.disabled)hGuess(b.dataset.l)};
addEventListener('keydown',e=>{if($('#hgame').hidden||e.target.tagName=='INPUT'||e.target.tagName=='SELECT')return;const l=e.key.toUpperCase();if(/^[A-Z]$/.test(l)&&!e.ctrlKey&&!e.metaKey){hGuess(l)}else if(e.key=='Enter'&&Hm=='solo'&&Hph=='end')hNextSolo()});
function hNextSolo(){if(Hm=='solo'&&Hph=='end'){SFX.sel();hBegin(Hr+1)}}
$('#hnext').onclick=hNextSolo;$('#hhint').onclick=hHint;$('#hquit').onclick=()=>{clearTimeout(Hto);leave()};
$('#hok').onclick=hSubmitWord;$('#hwin').onkeydown=e=>{if(e.key=='Enter')hSubmitWord()};
$('#hshow').onclick=()=>{$('#hwin').type=$('#hwin').type=='password'?'text':'password';SFX.ui()};
$('#hrand').onclick=()=>{const x=hRand($('#hcin').value);$('#hwin').value=x.w;SFX.ui()};
$('#hcin').innerHTML=HCATS.map(c=>`<option>${c}</option>`).join('');
$('#hcat-sel').innerHTML='<option value="Any">Any category</option>'+HCATS.map(c=>`<option>${c}</option>`).join('');
$('#hsolo').onclick=()=>{me.n=($('#nm').value.trim()||'Hero').slice(0,12);G='hang';leave();G='hang';cpu=true;on='Best';startHang('solo');$('#net').hidden=true};
$('#hlocal').onclick=()=>{me.n=($('#nm').value.trim()||'Player 1').slice(0,12);G='hang';leave();G='hang';cpu=true;oc=(me.ch+1)%H.length;on=($('#hp2name').value.trim()||'Player 2').slice(0,12);startHang('local');$('#net').hidden=true};
$('#hgo').onclick=()=>join('hang');


ART_GEN.hang=(()=>{const {K,ink,rays,dots}=ART;
function hang(W,n){
  const cx=W/2,u='_h'+n;
  const tile=(x,y,r,l,bg,fg='#14111f')=>`<g transform="translate(${x} ${y}) rotate(${r})"><rect x="-13" y="-13" width="26" height="26" rx="5" fill="${bg}" ${ink(2.5)}/><text y="7.5" text-anchor="middle" font-family="Bangers,Impact,sans-serif" font-size="21" fill="${fg}">${l}</text></g>`;
  let cl='';[[cx-190,22,1],[cx+250,34,1.1],[cx-290,40,.9],[cx-60,12,.7]].forEach(([x,y,s])=>cl+=`<g transform="translate(${x} ${y}) scale(${s})" fill="#fff" ${ink(2.5)}><path d="M-22 6Q-24 -6 -12 -6Q-8 -16 4 -12Q14 -18 20 -6Q30 -4 26 6Z"/></g>`);
  return `<svg viewBox="0 0 ${W} 130" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><defs>
  <linearGradient id="hs${u}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#54c6ff"/><stop offset="1" stop-color="#c9f0ff"/></linearGradient>${dots('hd'+u,'#fff',.35)}</defs>
  <rect width="${W}" height="130" fill="url(#hs${u})"/>${rays(cx,40,28,W,'#ffffff40','#ffffff00')}<rect width="${W}" height="130" fill="url(#hd${u})"/>
  ${cl}
  <path d="M-10 130V92Q${cx-200} 84 ${cx-128} 94L${cx-104} 130Z" fill="#69cf7f" ${ink(3)}/>
  <path d="M${cx-128} 94L${cx-104} 130" fill="none"/><path d="M${W+10} 130V100Q${cx+210} 92 ${cx+132} 104L${cx+114} 130Z" fill="#69cf7f" ${ink(3)}/>
  <path d="M${cx-104} 130L${cx-96} 112H${cx+104}L${cx+114} 130Z" fill="#3a2a6e" ${ink(3)}/>
  <path d="M${W+10} -4L${cx-30} 6 ${cx-34} 14 ${W+10} 12Z" fill="#9a5b2e" ${ink(3)}/><path d="M${cx+40} 8l10 -12M${cx+110} 5l8 -10" ${ink(3)}/>
  <g fill="#3fa34d" ${ink(2.5)}><circle cx="${cx+52}" cy="-2" r="9"/><circle cx="${cx+120}" cy="-4" r="8"/></g>
  <g class="hswing2" style="transform-origin:${cx+2}px 10px">
   <path d="M${cx+2} 10V30" stroke="#c9a46a" stroke-width="5" stroke-linecap="round"/><path d="M${cx+2} 12V30" stroke="${K}" stroke-width="1.5" stroke-dasharray="3 3"/>
   <g transform="translate(${cx+2} 25) scale(1.08)">
    <path d="M-6 6L-14 30M6 6L14 30" ${ink(11)}/><path d="M-6 6L-14 30M6 6L14 30" stroke="#ff3e8a" stroke-width="6" stroke-linecap="round"/>
    <circle cx="-5" cy="4" r="5" fill="#ffd2a6" ${ink(2.5)}/><circle cx="5" cy="4" r="5" fill="#ffd2a6" ${ink(2.5)}/>
    <g class="hkick"><path d="M-6 52L-12 74M6 52L14 72" ${ink(11)}/><path d="M-6 52L-12 74M6 52L14 72" stroke="#2d7bff" stroke-width="6" stroke-linecap="round"/>
    <ellipse cx="-14" cy="77" rx="7" ry="4" fill="#ff7a00" ${ink(2.5)}/><ellipse cx="16" cy="75" rx="7" ry="4" fill="#ff7a00" ${ink(2.5)}/></g>
    <rect x="-16" y="28" width="32" height="28" rx="10" fill="#ff3e8a" ${ink(3)}/><path d="M-6 36l6 6 6-6" fill="none" stroke="#ffe14d" stroke-width="3"/>
    <circle cy="22" r="13" fill="#ffd2a6" ${ink(3)}/>
    <path d="M-12 18Q-6 2 12 14Q4 10 0 14Q-6 10 -12 18Z" fill="#ff7a00" ${ink(2)}/>
    <ellipse cx="-5" cy="22" rx="2.4" ry="3.4" fill="${K}"/><ellipse cx="5" cy="22" rx="2.4" ry="3.4" fill="${K}"/>
    <ellipse cx="0" cy="29" rx="3.4" ry="2.4" fill="#7a1230" ${ink(1.5)}/>
    <path d="M15 12q4 3 2 8" stroke="#2d7bff" stroke-width="3" fill="none" stroke-linecap="round"/>
   </g>
  </g>
  <g font-family="Bangers,Impact,sans-serif" font-size="15" fill="#fff" text-anchor="middle">
   <text x="${cx-74}" y="125">H</text><text x="${cx-42}" y="125">_</text><text x="${cx-10}" y="125">N</text><text x="${cx+22}" y="125">_</text><text x="${cx+54}" y="125">_</text>
  </g>
  <g class="htile">${tile(cx-78,36,-10,'A','#2fe3a0')}${tile(cx-48,70,8,'X','#ff8a8a')}${tile(cx+80,58,10,'?','#ffe14d')}</g>
  </svg>`}

return hang})();
