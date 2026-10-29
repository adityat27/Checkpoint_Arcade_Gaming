/* Sound: one music theme per game (a tiny 16-step sequencer) and named sound effects (SFX.xxx()).
   Add a theme with THEMES.mygame = {...}; play an effect with SFX.ding(). */
/* Audio Engine: every game has its own music theme and its own sound set */
let AC,MG,SG,NB,DLY,mOn=true,sOn=true,trk='hub',st=0,nt=0,mt=0,mTheme=null;
try{mOn=localStorage.bbm!=='0';sOn=localStorage.bbs!=='0'}catch(e){}
function ctx(){if(!AC){const X=window.AudioContext||window.webkitAudioContext;if(!X)return null;AC=new X();
 const comp=AC.createDynamicsCompressor();comp.threshold.value=-16;comp.ratio.value=4;comp.connect(AC.destination);
 MG=AC.createGain();SG=AC.createGain();MG.connect(comp);SG.connect(comp);
 DLY=AC.createDelay(1);const fb=AC.createGain(),lp=AC.createBiquadFilter(),wet=AC.createGain();lp.type='lowpass';lp.frequency.value=2400;fb.gain.value=.3;wet.gain.value=.55;DLY.delayTime.value=.3;DLY.connect(lp);lp.connect(fb);fb.connect(DLY);lp.connect(wet);wet.connect(MG);
 NB=AC.createBuffer(1,AC.sampleRate*.5,AC.sampleRate);const d=NB.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;vol()}
 if(AC.state=='suspended')AC.resume();return AC}
function vol(){if(MG){MG.gain.value=mOn?.3*(mTheme&&mTheme.vol||1):0;SG.gain.value=sOn?1:0}}
const mf=m=>440*2**((m-69)/12);
function tone(m,t,d,ty,v,out,o={}){const osc=AC.createOscillator(),g=AC.createGain();osc.type=ty;osc.frequency.value=mf(m);if(o.det)osc.detune.value=o.det;
 if(o.to){osc.frequency.setValueAtTime(mf(m),t);osc.frequency.exponentialRampToValueAtTime(mf(o.to),t+d)}
 const a=o.a||.004;g.gain.setValueAtTime(.0001,t);g.gain.linearRampToValueAtTime(v,t+a);g.gain.exponentialRampToValueAtTime(.0008,t+d);
 let n=osc;if(o.lp){const f=AC.createBiquadFilter();f.type='lowpass';f.frequency.value=o.lp;f.Q.value=o.q||.8;n.connect(f);n=f}
 n.connect(g);g.connect(out||MG);if(o.dl&&DLY){const s=AC.createGain();s.gain.value=o.dl;g.connect(s);s.connect(DLY)}
 if(o.vib){const l=AC.createOscillator(),lg=AC.createGain();l.frequency.value=o.vr||5.5;lg.gain.value=o.vib;l.connect(lg);lg.connect(osc.detune);l.start(t);l.stop(t+d+.05)}
 osc.start(t);osc.stop(t+d+.05)}
function nz(t,d,f,v,out,ty='highpass',q=.7,f2){const s=AC.createBufferSource(),fl=AC.createBiquadFilter(),g=AC.createGain();s.buffer=NB;fl.type=ty;fl.frequency.setValueAtTime(f,t);if(f2)fl.frequency.exponentialRampToValueAtTime(f2,t+d);fl.Q.value=q;g.gain.setValueAtTime(v,t);g.gain.exponentialRampToValueAtTime(.001,t+d);s.connect(fl);fl.connect(g);g.connect(out||MG);s.start(t,Math.random()*.2);s.stop(t+d+.02)}
function kick(t,v=.9,out,f0=150){const o=AC.createOscillator(),g=AC.createGain();o.frequency.setValueAtTime(f0,t);o.frequency.exponentialRampToValueAtTime(42,t+.13);g.gain.setValueAtTime(v,t);g.gain.exponentialRampToValueAtTime(.001,t+.2);o.connect(g);g.connect(out||MG);o.start(t);o.stop(t+.22)}

/* ---- music themes (a tiny 16-step sequencer) ---- */
const NN={C:0,'C#':1,Db:1,D:2,'D#':3,Eb:3,E:4,F:5,'F#':6,Gb:6,G:7,'G#':8,Ab:8,A:9,'A#':10,Bb:10,B:11};
const nm2=s=>{const m=s.match(/^([A-G][#b]?)(-?\d)$/);return m?NN[m[1]]+12*(+m[2]+1):null};
const seq=s=>s.trim().split(/\s+/).map(x=>x=='.'?null:/^-?\d+$/.test(x)?+x:x=='x'?1:nm2(x));
const CT={maj:[0,4,7],min:[0,3,7],maj7:[0,4,7,11],m7:[0,3,7,10],dom7:[0,4,7,10],m9:[0,3,7,10,14],sus:[0,5,7]};
const prog=s=>s.trim().split(/\s+/).map(x=>{const[a,b]=x.split(':');return[nm2(a),CT[b]]});
const THEMES={
 hub:{bpm:116,sw:.08,vol:1,key:72,maj:1,prog:prog('C3:maj A2:min F2:maj G2:maj'),
  bass:seq('0 . 12 . 7 . 12 . 0 . 12 . 7 . 12 .'),bassT:'triangle',bassV:.32,
  arp:seq('0 . 1 . 2 . 1 . 0 . 1 . 2 . 3 .'),arpO:24,arpT:'square',arpV:.025,
  lead:[seq('E5 . G5 . C6 . G5 . A5 . G5 . E5 . . .'),seq('C5 . E5 . A5 . E5 . G5 . E5 . C5 . . .'),seq('A4 . C5 . F5 . C5 . E5 . D5 . C5 . A4 .'),seq('B4 . D5 . G5 . . . F5 . D5 . B4 . G4 .')],leadT:'triangle',leadV:.1,leadD:2,leadDl:.12,
  k:'x.....x.x.......',s:'....x.......x...',h:'..x...x...x...x.'},
 brawl:{bpm:150,vol:.95,key:69,maj:0,prog:prog('A2:min F2:maj G2:maj E2:dom7'),
  bass:seq('0 0 12 0 0 12 0 0 12 0 0 12 0 12 0 12'),bassT:'sawtooth',bassV:.16,bassLp:650,
  stab:seq('x . . x . . x . . . x . x . . .'),stabO:12,stabT:'square',stabV:.022,
  lead:[seq('A4 . . A4 C5 . A4 . E5 . D5 . C5 . B4 .'),seq('A4 . . A4 C5 . A4 . F5 . E5 . C5 . A4 .'),seq('G4 . . G4 B4 . G4 . D5 . C5 . B4 . D5 .'),seq('E5 . . E5 G#5 . E5 . B5 . A5 . G#5 . E5 .')],leadT:'square',leadV:.06,leadD:1.6,leadLp:2600,
  k:'x..x..x.x..x..x.',s:'....x.......x...',h:'x.x.x.x.x.x.x.x.',c:'............x..x'},
 donut:{bpm:100,sw:.17,vol:1,key:72,maj:1,prog:prog('F2:maj7 E2:m7 D2:m7 G2:dom7'),
  bass:seq('0 . . 7 . . 0 . 7 . . 0 . . 7 .'),bassT:'triangle',bassV:.34,bassD:2.5,
  stab:seq('. . x . . x . . . . x . . x . .'),stabO:24,stabT:'sine',stabV:.05,stabD:2.6,stabDl:.1,
  lead:[seq('A5 . . . G5 . E5 . . . C5 . . . . .'),seq('B4 . . . D5 . G5 . . . F5 . E5 . . .'),seq('F5 . . . E5 . D5 . . . A4 . . . C5 .'),seq('B4 . . . D5 . F5 . . . G5 . . . . .')],leadT:'sine',leadV:.11,leadD:3,leadDl:.3,leadVib:9,
  k:'x..x....x..x....',r:'..x..x....x..x..',h:'x.x.x.x.x.x.x.x.',hV:.035},
 race:{bpm:124,vol:.55,key:69,maj:0,prog:prog('A2:min F2:maj C3:maj G2:maj'),
  bass:seq('0 12 0 12 0 12 0 12 0 12 0 12 0 12 0 12'),bassT:'sawtooth',bassV:.12,bassLp:520,bassD:.8,
  arp:seq('0 1 2 3 2 1 0 1 2 3 2 1 0 1 2 1'),arpO:24,arpT:'square',arpV:.022,arpDl:.18,
  k:'x...x...x...x...',s:'....x.......x...',h:'..x...x...x...x.'},
 puzzle:{bpm:84,vol:1,key:74,maj:0,prog:prog('D2:m9 A#1:maj7 F2:maj7 C2:sus'),
  bass:seq('0 . . . . . . . 7 . . . . . . .'),bassT:'sine',bassV:.3,bassD:7,
  arp:seq('0 2 4 3 1 3 2 4 0 2 4 3 1 3 2 4'),arpO:36,arpT:'sine',arpV:.04,arpD:1.6,arpDl:.35,
  pad:1,padO:24,padV:.025,
  lead:[seq('. . . . . . . . A5 . . . . . . .'),seq('. . . . F5 . . . . . . . . . . .'),seq('. . . . . . . . C6 . . . A5 . . .'),seq('. . . . G5 . . . . . . . . . . .')],leadT:'triangle',leadV:.06,leadD:6,leadDl:.4,
  k:'x...............',h:'........x.......',hV:.02},
 hang:{bpm:116,vol:1,key:64,maj:0,prog:prog('E2:min C2:maj A2:min B2:dom7'),
  bass:seq('0 . 7 . 0 . 7 . 0 . 7 . 0 . 7 .'),bassT:'triangle',bassV:.3,bassD:.7,
  lead:[seq('E5 . G5 . B5 . G5 . F#5 . G5 . E5 . . .'),seq('E5 . G5 . C6 . B5 . A5 . G5 . E5 . . .'),seq('C5 . E5 . A5 . G5 . F#5 . E5 . C5 . . .'),seq('D#5 . F#5 . A5 . B5 . . . A5 . F#5 . D#5 .')],leadT:'triangle',leadV:.11,leadD:.8,leadDl:.15,
  k:'x.......x.......',r:'....x.......x.x.'},
 rps:{bpm:132,vol:.95,key:67,maj:1,prog:prog('G2:maj E2:min C2:maj D2:maj'),
  bass:seq('0 . 12 . 0 . 12 . 0 . 12 . 0 . 12 .'),bassT:'square',bassV:.1,bassLp:700,
  stab:seq('x . . x . . x . . . x . x . . .'),stabO:12,stabT:'sawtooth',stabV:.022,stabLp:1800,
  lead:[seq('D5 . G5 . B5 . D6 . B5 . G5 . A5 . B5 .'),seq('G5 . E5 . B4 . E5 . G5 . . . F#5 . E5 .'),seq('E5 . G5 . C6 . E6 . D6 . C6 . B5 . A5 .'),seq('F#5 . A5 . D6 . . . C6 . A5 . F#5 . D5 .')],leadT:'square',leadV:.05,leadD:1.5,leadLp:3000,
  k:'x...x...x...x...',s:'....x.......x...',h:'x.x.x.x.x.x.x.x.'}
};
function play(s,t){const T=mTheme;if(!T)return;const bar=(s>>4)%T.prog.length,i=s&15,[r,ch]=T.prog[bar],L=60/T.bpm/4;
 const v=x=>x!==null&&x!==undefined;
 if(T.k&&T.k[i]=='x')kick(t,.75);
 if(T.s&&T.s[i]=='x'){nz(t,.16,1400,.28);tone(50,t,.08,'triangle',.18)}
 if(T.c&&T.c[i]=='x')nz(t,.12,1800,.2,MG,'bandpass',1.4);
 if(T.h&&T.h[i]=='x')nz(t,.04,7500,T.hV||.09);
 if(T.r&&T.r[i]=='x')nz(t,.05,2600,.22,MG,'bandpass',6);
 if(T.bass&&v(T.bass[i]))tone(r+T.bass[i],t,L*(T.bassD||1.4),T.bassT,T.bassV,MG,{lp:T.bassLp});
 if(T.arp&&v(T.arp[i])){const k=T.arp[i];tone(r+T.arpO+ch[k%ch.length]+12*Math.floor(k/ch.length),t,L*(T.arpD||1),T.arpT,T.arpV,MG,{dl:T.arpDl})}
 if(T.stab&&v(T.stab[i]))ch.slice(0,3).forEach(c=>tone(r+T.stabO+c,t,L*(T.stabD||1.2),T.stabT,T.stabV,MG,{lp:T.stabLp,dl:T.stabDl}));
 if(T.pad&&i==0)ch.forEach(c=>tone(r+T.padO+c,t,L*16,'sine',T.padV,MG,{a:.6}));
 if(T.lead){const n=T.lead[bar%T.lead.length][i];if(v(n))tone(n,t,L*T.leadD,T.leadT,T.leadV,MG,{lp:T.leadLp,dl:T.leadDl,vib:T.leadVib})}}
function pump(){const T=mTheme;if(!T)return;const L=60/T.bpm/4;while(nt<AC.currentTime+.2){play(st,nt+(st&1?(T.sw||0)*L:0));nt+=L;st++}}
function music(k){if(k!==undefined&&THEMES[k]){if(k!==trk||!mTheme){trk=k;mTheme=THEMES[k];st=0;if(AC)nt=AC.currentTime+.06}}
 if(!AC||!mOn)return;vol();if(DLY)DLY.delayTime.value=60/mTheme.bpm*.75;if(mt)return;nt=AC.currentTime+.06;st=0;mt=setInterval(pump,40)}
function jingle(w){if(!AC)return;clearInterval(mt);mt=0;const T=mTheme||THEMES.hub,k=T.key,t=AC.currentTime+.05;
 if(sOn){const up=T.maj?[0,4,7,12,7,12]:[0,3,7,12,10,12],dn=T.maj?[7,5,4,2,0]:[7,6,3,2,0];
  (w?up:dn).forEach((m,i)=>tone(k+m-(w?0:5),t+i*.13,w&&i==5?.6:.28,trk=='donut'||trk=='puzzle'?'triangle':'square',.11,SG,{lp:3500}));
  if(w)[0,7,12].forEach(m=>tone(k-12+m,t+.65,.7,'triangle',.08,SG))}
 setTimeout(()=>music(trk),2000)}

/* ---- named sound effects ---- */
function sfx(f,t=.15,ty='square',s=.4){try{if(!ctx()||!sOn)return;const o=AC.createOscillator(),g=AC.createGain(),n=AC.currentTime;o.type=ty;o.frequency.setValueAtTime(f,n);o.frequency.exponentialRampToValueAtTime(Math.max(30,f*s),n+t);g.gain.setValueAtTime(.1,n);g.gain.exponentialRampToValueAtTime(.001,n+t);o.connect(g);g.connect(SG);o.start();o.stop(n+t)}catch(e){}}
const SFX=new Proxy({
 ui:t=>{tone(84,t,.06,'sine',.12,SG,{to:91})},
 sel:t=>{tone(76,t,.07,'triangle',.14,SG);tone(83,t+.05,.09,'triangle',.12,SG)},
 back:t=>{tone(79,t,.07,'triangle',.12,SG);tone(72,t+.05,.09,'triangle',.1,SG)},
 tick:t=>{nz(t,.03,3200,.3,SG,'bandpass',8)},
 count:t=>{tone(72,t,.14,'square',.08,SG,{lp:2400})},
 go:t=>{tone(84,t,.35,'square',.1,SG,{lp:3000});tone(79,t,.35,'square',.07,SG,{lp:3000})},
 whoosh:t=>{nz(t,.22,500,.35,SG,'bandpass',1.2,3200)},
 punch:t=>{kick(t,.9,SG,190);nz(t,.09,900,.45,SG,'lowpass',1)},
 kickhit:t=>{kick(t,1,SG,230);nz(t,.14,700,.55,SG,'lowpass',1);nz(t+.02,.08,3000,.2,SG)},
 block:t=>{tone(88,t,.18,'square',.06,SG,{lp:5000});tone(95,t,.16,'square',.05,SG,{lp:5000});nz(t,.06,4000,.3,SG)},
 charge:t=>{tone(55,t,.45,'sawtooth',.06,SG,{to:79,lp:2200,vib:30,vr:18})},
 mega:t=>{kick(t,1,SG,120);tone(40,t,.9,'sawtooth',.12,SG,{to:24,lp:900});nz(t,.7,200,.6,SG,'lowpass',1,60)},
 grab:t=>{nz(t,.12,1500,.35,SG,'bandpass',2,600);tone(60,t+.08,.15,'square',.07,SG,{to:52,lp:1200})},
 dodge:t=>{nz(t,.18,2500,.28,SG,'bandpass',3,6000)},
 hurt:t=>{tone(64,t,.2,'square',.07,SG,{to:52,lp:1600})},
 ko:t=>{kick(t,1,SG,100);tone(67,t,.9,'sawtooth',.1,SG,{to:31,lp:1400})},
 bell:t=>{[88,93].forEach((m,i)=>tone(m,t+i*.12,1.1,'sine',.12,SG,{dl:.2}))},
 splat:t=>{nz(t,.35,300,.45,SG,'lowpass',4,1400);tone(48,t,.25,'sine',.15,SG,{to:60})},
 sprinkle:t=>{for(let k=0;k<4;k++)tone(96+Math.random()*10|0,t+k*.025,.04,'triangle',.05,SG)},
 squirt:t=>{tone(55,t,.18,'sine',.16,SG,{to:67});nz(t,.12,900,.12,SG,'bandpass',3)},
 drizzle:t=>{nz(t,.1,1100,.12,SG,'bandpass',4)},
 undo:t=>{tone(72,t,.08,'sine',.12,SG,{to:65})},
 trash:t=>{nz(t,.25,800,.35,SG,'lowpass',1,200)},
 ding:t=>{tone(84,t,.12,'triangle',.12,SG);tone(88,t+.08,.22,'triangle',.12,SG)},
 star:t=>{tone(91,t,.18,'sine',.1,SG,{dl:.2});tone(96,t+.06,.25,'sine',.08,SG)},
 coin:t=>{tone(83,t,.06,'square',.06,SG,{lp:4000});tone(88,t+.06,.2,'square',.06,SG,{lp:4000})},
 correct:t=>{tone(76,t,.1,'triangle',.14,SG);tone(83,t+.07,.18,'triangle',.14,SG)},
 wrong:t=>{tone(50,t,.22,'square',.07,SG,{to:45,lp:900});nz(t,.12,300,.2,SG,'lowpass')},
 creak:t=>{tone(43,t,.4,'sawtooth',.05,SG,{to:40,lp:600,vib:40,vr:9})},
 pop:t=>{tone(79,t,.05,'sine',.14,SG,{to:91})},
 shake:t=>{for(let k=0;k<3;k++)nz(t+k*.09,.06,1200,.25,SG,'bandpass',2)},
 shoot:t=>{kick(t,.9,SG,170);nz(t,.12,1600,.35,SG,'bandpass',1.5)},
 chime:t=>{[81,88,93].forEach((m,i)=>tone(m,t+i*.05,.5,'sine',.07,SG,{dl:.3}))},
 slide:t=>{tone(62,t,.08,'sine',.1,SG,{to:69})},
 type:t=>{nz(t,.025,4000,.2,SG,'bandpass',4)}
},{get:(o,k)=>()=>{try{if(!ctx()||!sOn||!o[k])return;o[k](AC.currentTime+.01)}catch(e){}}});
function snd(){$('#bm').classList.toggle('off',!mOn);$('#bs').classList.toggle('off',!sOn);$('#bm').setAttribute('aria-pressed',mOn);$('#bs').setAttribute('aria-pressed',sOn)}
