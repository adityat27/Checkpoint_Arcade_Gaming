/* Online play. MQTT (public brokers) finds your friend by room code; then a direct
   WebRTC link carries the game traffic (falls back to MQTT if it can't connect).
   join(game) opens the lobby, leave() goes back to the hub. */
/* Multiplayer Networking (MQTT) */
const ID=Math.random().toString(36).slice(2,10),BR=['wss://broker.hivemq.com:8884/mqtt','wss://broker.emqx.io:8084/mqtt'];
const TOP=()=>'bambrawl/v1/'+(G=='brawl'?'':G+'-')+code;
let CL=[],peers={},t0=0,hb=0,full=false;
let RSx={rcar:0,rtrk:0,rlaps:3,rp:0,rlap:1,rdone:0,rtm:0},PSx={ps:0,pstg:0,pdone:0,pseed:0};
function send(o){const m=JSON.stringify(o);CL.forEach(c=>{try{c.connected&&c.publish(TOP(),m)}catch(e){}})}
/* ---------- Direct connection (WebRTC) ----------
   MQTT is only used to find each other and swap connection details. Once the
   direct link is up, game traffic goes browser-to-browser:
     rel  : reliable, ordered  -> game events and state
     fast : unordered, no resend -> 30 Hz position snapshots (a late packet is useless)
   If a direct link can't be made, everything falls back to MQTT automatically. */
let pubSeq=0;const seenMid=new Set(),seenQ=[];
const NET={pc:null,rel:null,fast:null,peer:null,offerer:false,iq:[],tries:0,timer:0,rtt:80,lastFast:0,pingT:0,
  ice:[{urls:['stun:stun.l.google.com:19302','stun:stun1.l.google.com:19302']},{urls:'stun:stun.cloudflare.com:3478'}],
  direct(){return!!(this.rel&&this.rel.readyState==='open')},
  fastOK(){return!!(this.fast&&this.fast.readyState==='open')},
  ensure(peerId){if(this.pc||!window.RTCPeerConnection||this.tries>=3)return;if(HOST)this.start(peerId,true)},
  start(peerId,offerer){
    this.stop(true);this.peer=peerId;this.offerer=offerer;this.tries++;
    let pc;try{pc=this.pc=new RTCPeerConnection({iceServers:this.ice})}catch(e){this.pc=null;return}
    pc.onicecandidate=e=>{if(e.candidate&&this.pc===pc)sigSend(peerId,{ice:e.candidate.toJSON()})};
    pc.onconnectionstatechange=()=>{if(this.pc!==pc)return;const st=pc.connectionState;
      if(st==='failed'||st==='closed'){this.stop(true);net();if(offerer&&opp&&this.tries<3)setTimeout(()=>{if(!this.pc&&opp)this.start(opp.id,true)},1500)}
      net()};
    if(offerer){
      this.wire(pc.createDataChannel('rel',{ordered:true}));
      this.wire(pc.createDataChannel('fast',{ordered:false,maxRetransmits:0}));
      pc.createOffer().then(o=>pc.setLocalDescription(o)).then(()=>sigSend(peerId,{sdp:pc.localDescription.toJSON()})).catch(()=>{});
    }else pc.ondatachannel=e=>this.wire(e.channel);
    clearTimeout(this.timer);
    this.timer=setTimeout(()=>{if(this.pc===pc&&!this.direct()){this.stop(true);net();if(offerer&&opp&&this.tries<3)this.start(opp.id,true)}},12000);
  },
  wire(ch){
    ch.onopen=()=>{if(ch.label==='rel'){this.tries=0;pub();this.ping();setTimeout(()=>this.ping(),150);setTimeout(()=>this.ping(),400)}net()};
    ch.onclose=()=>net();
    ch.onmessage=e=>onMsg(e.data,true);
    if(ch.label==='rel')this.rel=ch;else this.fast=ch;
  },
  async onSig(from,s){
    try{
      if(s.sdp&&s.sdp.type==='offer'){if(this.pc&&this.peer===from&&this.pc.remoteDescription)return;this.start(from,false)}
      if(!this.pc||this.peer!==from)return;
      const pc=this.pc;
      if(s.sdp){
        if(s.sdp.type==='answer'&&pc.signalingState!=='have-local-offer')return;
        await pc.setRemoteDescription(s.sdp);
        for(const c of this.iq.splice(0))pc.addIceCandidate(c).catch(()=>{});
        if(s.sdp.type==='offer'){const a=await pc.createAnswer();await pc.setLocalDescription(a);sigSend(from,{sdp:pc.localDescription.toJSON()})}
      }else if(s.ice){if(pc.remoteDescription)pc.addIceCandidate(s.ice).catch(()=>{});else this.iq.push(s.ice)}
    }catch(e){}
  },
  stop(keepTries){
    clearTimeout(this.timer);this.clk=this.clkRtt=null;
    try{this.rel&&this.rel.close()}catch(e){}try{this.fast&&this.fast.close()}catch(e){}try{this.pc&&this.pc.close()}catch(e){}
    this.pc=this.rel=this.fast=null;this.iq=[];if(!keepTries)this.tries=0;
  },
  // reliable game event (direct link if up, otherwise MQTT)
  ev(o){o.id=ID;o.mid=Math.random().toString(36).slice(2,10);const m=JSON.stringify(o);
    if(this.direct()){try{this.rel.send(m);return}catch(e){}}send(o)},
  // high-rate snapshot: direct link only; over MQTT it is throttled to 8 per second
  sendFast(o){o.id=ID;const m=JSON.stringify(o);
    if(this.fastOK()){try{this.fast.send(m);return}catch(e){}}
    const now=performance.now();if(now-this.lastFast>=125){this.lastFast=now;send(o)}},
  ping(){if(this.direct()){try{this.rel.send(JSON.stringify({id:ID,e:'ping',t:performance.now()}))}catch(e){}}}
};
function sigSend(to,sig){send({id:ID,to,mid:Math.random().toString(36).slice(2,10),sig})}
setInterval(()=>{if(NET.direct())NET.ping()},1000);
function pub(){
  if(!CL.length)return;
  const extra=GAMES[G]?{x:GAMES[G].hb?GAMES[G].hb():null}:G=='donut'?DSx:G=='race'?RSx:G=='puzzle'?PSx:G=='hang'?HSx:G=='rps'?QSx:{};
  const o=Object.assign({id:ID,n:me.n,ch:me.ch,g:myG,h:mh,t:t0,q:++pubSeq},extra);
  if(NET.direct()){try{NET.rel.send(JSON.stringify(o))}catch(e){}}
  send(o);
}
function onEvent(d){
  if(d.e==='ping'){try{NET.rel&&NET.rel.send(JSON.stringify({id:ID,e:'pong',t:d.t,r:performance.now()}))}catch(e){}return}
  if(d.e==='pong'){const now=performance.now(),r=now-(+d.t||0);if(r>=0&&r<5000){NET.rtt=NET.rtt*0.7+r*0.3;
    // clock offset (their clock minus ours), trusting the fastest round trips most
    const off=(+d.r)+r/2-now;if(NET.clkRtt==null||r<NET.clkRtt*1.3){NET.clk=NET.clk==null?off:NET.clk*0.5+off*0.5;NET.clkRtt=NET.clkRtt==null?r:Math.min(NET.clkRtt*1.02,r)}}return}
  if(G==='race')raceEvent(d);
  else if(G==='puzzle')puzzleEvent(d);
  else if(GAMES[G]&&GAMES[G].event)GAMES[G].event(d);
}
function onMsg(b,viaDirect){if(phase=='menu')return;let d;try{d=JSON.parse(b.toString())}catch(e){return}
 if(!d||typeof d.id!='string'||d.id==ID)return;
 if(d.mid){if(seenMid.has(d.mid))return;seenMid.add(d.mid);seenQ.push(d.mid);if(seenQ.length>500)seenMid.delete(seenQ.shift())}
 if(d.sig){if(d.to===ID)NET.onSig(d.id,d.sig);return}
 if(d.bye){delete peers[d.id];if(NET.peer===d.id)NET.stop();return upd()}
 if(d.f||d.e){if(peers[d.id])peers[d.id].seen=Date.now();if(d.f){if(G==='race')raceNetRecv(d);else if(GAMES[G]&&GAMES[G].fast)GAMES[G].fast(d)}else onEvent(d);return}
 if(peers[d.id]&&+d.q&&+d.q<=peers[d.id].q){peers[d.id].seen=Date.now();return}
 const fresh=!peers[d.id];
 peers[d.id]={q:+d.q||0,pm:d.pm==='race'?'race':'coop',x:d.x&&typeof d.x==='object'?d.x:null,
   n:String(d.n||'Rival').slice(0,12),
   ch:Math.max(0,Math.min(H.length-1,+d.ch||0)),
   g:+d.g||0,
   h:String(d.h||'').replace(G=='rps'?/[^RPS]/g:/[^CSGMKT]/g,'').slice(0,60),
   t:+d.t||0,
   rd:+d.rd?1:0,sd:+d.sd||0,gn:+d.gn||0,rq:+d.rq||0,dn:+d.dn?1:0,pr:+d.pr||0,
   ds:typeof d.ds=='string'?d.ds.slice(0,60000):'',
   rcar:Math.max(0,Math.min(4,+d.rcar||0)),rtrk:Math.max(0,Math.min(3,+d.rtrk||0)),rlaps:+d.rlaps||3,rbt:Math.max(0,Math.min(5,+d.rbt||0)),rp:+d.rp||0,rlap:+d.rlap||1,rdone:+d.rdone||0,rtm:+d.rtm||0,
   ps:+d.ps||0,pstg:+d.pstg||0,pdone:+d.pdone||0,pseed:+d.pseed||0,plen:Math.max(1,Math.min(7,+d.plen||5)),pdf:Math.max(1,Math.min(3,+d.pdf||2)),
   hr:Math.max(0,Math.min(20,+d.hr||0)),hw:hClean(d.hw),hc:String(d.hc||'').replace(/[^A-Za-z]/g,'').slice(0,16),hg:String(d.hg||'').toUpperCase().replace(/[^A-Z]/g,'').slice(0,26),hs:+d.hs||0,hm:String(d.hm||'').replace(/[^A-Za-z0-9|]/g,'').slice(0,40),qb:[3,5,7].includes(+d.qb)?+d.qb:0,
   seen:Date.now()
 };
 if(fresh)pub();upd()}
function prune(){const n=Date.now();let c=0;for(const k in peers)if(n-peers[k].seen>15000){delete peers[k];c=1}if(c||lostAt)upd()}
function upd(){if(phase=='menu')return;
 const all=Object.keys(peers).map(id=>({id,...peers[id]}));all.push({id:ID,t:t0});all.sort((a,b)=>a.t-b.t||(a.id<b.id?-1:1));
 const two=all.slice(0,2);full=!two.some(p=>p.id==ID);const q=two.find(p=>p.id!=ID)||null;opp=q;HOST=two[0].id==ID;
 if(full){leave();err('That room already has two players. Try another code.');return}
 if(q)NET.ensure(q.id);
 if(q){on=q.n;oc=q.ch;oh=q.g==myG?q.h:''}
 if(phase=='lobby'){
   net();
   if(q&&!full){
     if(GAMES[G])GAMES[G].start('online');
     else if(G=='donut')startDonut();
     else if(G=='race')startRace('online');
     else if(G=='puzzle')startPuzzle('online');
     else if(G=='hang')startHang('online');
     else if(G=='rps'){myG=q.g;startRps('online')}
     else{myG=q.g;startBattle()}
   }
   return;
 }
 if(GAMES[G]){if(GAMES[G].sync)GAMES[G].sync();return}
 if(G=='donut'){donutSync();return}
 if(G=='race'){raceSync();return}
 if(G=='puzzle'){puzzleSync();return}
 if(G=='hang'){hangSync();return}
 if(G=='rps'){rpsSync();return}
 if(!q){if(phase=='over'){$('#rm').hidden=true;return}
  lostAt=lostAt||Date.now();
  if(Date.now()-lostAt>20000){phase='over';busy=false;$('#ot').textContent='RIVAL LEFT';$('#os').textContent='Your opponent disconnected.';$('#rm').hidden=true;$('#over').hidden=false}
  else $('#cap').textContent='Rival disconnected. Waiting for them to come back...';return}
 lostAt=0;if(phase=='over'){$('#rm').hidden=false;rmLabel();chk()}else{render();sync()}}
function net(){const up=CL.filter(c=>c.connected).length;$('#net').textContent=NET.direct()?'⚡ direct link':up?(opp&&NET.pc?'● online · linking…':'● online'):'○ connecting...';
 if(phase=='lobby')$('#lm').textContent=full?'This room already has two players. Try another code.':up?'Connected! Waiting for your friend to open the invite link...':'Connecting to the game server...'}
function connect(){BR.forEach(u=>{const c=mqtt.connect(u,{clientId:'bb'+ID+Math.random().toString(16).slice(2,6),keepalive:20,reconnectPeriod:2000,connectTimeout:8000,clean:true,will:{topic:TOP(),payload:JSON.stringify({id:ID,bye:1}),qos:0,retain:false}});
 c.on('connect',()=>{c.subscribe(TOP());net();pub()});c.on('close',net);c.on('error',()=>{});c.on('message',(t,b)=>onMsg(b));CL.push(c)})}
const link=()=>location.href.split('#')[0]+'#'+G+'/'+code.toUpperCase();
const err=t=>{['#msg','#msg2','#msg3','#msg4','#msg5','#msg6','#hmsg'].forEach(x=>{if($(x))$(x).textContent=t});document.querySelectorAll('[data-msg]').forEach(e=>e.textContent=t)};
async function join(g){
  G=g;
  me.n=($('#nm').value.trim()||'Hero').slice(0,12);
  const cdInput=GAMES[g]?GAMES[g].cd:{donut:'#cd2',race:'#cd3',puzzle:'#cd4',hang:'#cd5',rps:'#cd6'}[g]||'#cd';
  code=$(cdInput).value.toLowerCase().replace(/[^a-z0-9]/g,'').slice(0,6);
  if(code.length<3)return err('Room code needs at least 3 letters or numbers.');
  err('Connecting…');
  try{await needNet()}catch(e){return err('Could not load the multiplayer library. Check your internet connection. You can still play solo.')}
  if(GAMES[g]&&GAMES[g].prep){try{await GAMES[g].prep()}catch(e){return err(e.message||'Could not load the game.')}}
  if(g=='donut'||g=='race'){try{await need3D()}catch(e){return err('The 3D engine did not load. Check your internet and try again.')}}
  err('');
  leave();G=g;cpu=false;myG=0;mh=oh='';peers={};full=false;lostAt=0;dBot=false;t0=Date.now();phase='lobby';
  $('#lc').textContent=code.toUpperCase();$('#ln').textContent=link();$('#rm').hidden=false;show('lobby');net();connect();
  hb=setInterval(()=>{pub();prune()},1200);
  setTimeout(()=>{if(phase=='lobby'&&!CL.some(c=>c.connected))$('#lm').textContent='Cannot reach the game server. Check your internet, or try another network.'},10000);
}
function leave(){
  clearInterval(hb);clearInterval(dtm);clearInterval(ptimer);clearTimeout(Hto);
  cancelAnimationFrame(raf);raf=0;
  cancelAnimationFrame(rRaf);rRaf=0;rState='idle';stopEngine();
  dp='';
  Object.values(GAMES).forEach(g=>{try{g.stop&&g.stop()}catch(e){}});
  try{NET.ev({bye:1})}catch(e){}
  try{send({id:ID,bye:1})}catch(e){}
  NET.stop();
  CL.forEach(c=>{try{c.end()}catch(e){}});CL=[];peers={};opp=null;S=null;busy=false;phase='menu';show('hub');err('');
}
