/* GAME: Cipher Sync — seven puzzle types; solo, same-device and online co-op on one shared board. */
mountScreens(`
<!-- GAME 4 MENU: CIPHER SYNC -->
<section id="pmenu" class="card gmenu" hidden><div class="mhero"><div class="mart short dark" data-art="puzzle"></div><h2 class="mh">Cipher Sync</h2></div>
<div class="row rsets">
  <label>Puzzle size (no timer)
    <select id="pdiff">
      <option value="1">Relaxed · small grids</option>
      <option value="2" selected>Standard · balanced</option>
      <option value="3">Master · big grids</option>
    </select>
  </label>
  <label>Vault length
    <select id="plen">
      <option value="3">3 locks · quick</option>
      <option value="5" selected>5 locks · standard</option>
      <option value="7">7 locks · every puzzle</option>
    </select>
  </label>
  <label>Local 2P mode
    <select id="pmode">
      <option value="coop">Co-op relay (solve together)</option>
      <option value="duel">Turn duel (best score wins)</option>
    </select>
  </label>
  <label>Online mode
    <select id="pnet">
      <option value="coop">Co-op · same puzzles, together</option>
      <option value="race">Race · first to open the vault</option>
    </select>
  </label>
</div>
<label>Online room code (2-player online vault race)<input id="cd4" maxlength="6" autocomplete="off"></label>
<div class="row">
  <button class="btn b" id="psolo">Solo Vault</button>
  <button class="btn o" id="plocal">2-Player Same Device</button>
  <button class="btn" id="pgo">Online 2P Vault Race!</button>
</div>
<p class="note" id="msg4"></p>
<div class="ptypes">
  <span>🟥 Gem Swap</span><span>⚡ Neon Flip</span><span>➕ Power Sum</span><span>🔢 Vault Slider</span><span>🔌 Circuit Link</span><span>🔦 Prism Relay</span><span>🔐 Cipher Crack</span>
</div>
<ul class="rules">
  <li><b>No timer:</b> every vault mixes the puzzle types above at random. Solve each lock to open the next.</li>
  <li><b>Online co-op:</b> you and your friend work on the same board at the same time. Every tap shows up on both screens, and your partner's taps flash orange.</li>
  <li><b>Never get stuck:</b> press <b>💡 Hint</b> anytime and it plays one correct step for you (fewer moves &amp; hints = more points).</li>
</ul>
<button class="btn m back" data-back>← All games</button></section>


<!-- GAME 4 STAGE: CIPHER SYNC: QUANTUM VAULT -->
<section id="pgame" hidden>
<div class="card ptop">
  <div class="rhud-grp">
    <span class="rpill">♾️ <b id="ptm">NO TIMER</b></span>
    <span class="rpill">SCORE <b id="pscore">0</b></span>
    <span class="rpill" id="pturn-pill">PLAYER <b id="pwho">P1</b></span>
  </div>
  <div class="rhud-grp">
    <span id="prival-txt" style="font-weight:900;font-size:14px"></span>
    <button class="btn o sm" id="phint" title="Plays one correct step for you">💡 Hint</button>
    <button class="btn p sm" id="pskip">🔀 New Vault</button>
    <button class="btn b sm" id="pquit">Exit Vault</button>
  </div>
</div>
<div id="pstage">
  <div class="pvault-hdr">
    <div>
      <h3 id="ptitle" style="margin:0;font-size:28px;color:#ffe14d">LOCK 1</h3>
      <p id="pdesc" style="margin:2px 0 0;font-size:14px;color:#d8d2e8"></p>
    </div>
    <div class="pstage-dots" id="pdots"></div>
  </div>
  <div id="pboard-wrap"></div>
  <div class="pfoot">
    <span id="pstatus" class="bang" style="font-size:22px;color:#2fe3a0">Vault status: Active</span>
    <span id="pmoves" style="font-size:14px;color:#cbd5e1">Moves: 0</span>
  </div>
</div>
</section>
`);

/* =========================================================================
   GAME 4: CIPHER SYNC: QUANTUM VAULT — 7 visual, timer-free puzzle types
   ========================================================================= */
let pModeType='solo',pSeed=0,pStageIdx=0,pScore=0,pMoves=0,ptimer=0,pStages=[],pCur=null,pTurn=0,pP2Score=0,pStageMoves=0,pStageHints=0,pDiff=2,pLen=5;
const P_TYPES=['swap','flip','sum','slide','pipe','laser','code'];
const MIR=[null,[1,0,3,2],[3,2,1,0]]; // '/' and '\' : dir -> dir  (0 up,1 right,2 down,3 left)
const PD=[[-1,0],[0,1],[1,0],[0,-1]];

function genPuzzleStages(seed,diff,len){
  const R=rng(seed),sz=diff===1?3:diff===2?4:5,order=[...P_TYPES];
  for(let i=order.length-1;i>0;i--){const j=Math.floor(R()*(i+1));[order[i],order[j]]=[order[j],order[i]]}
  return order.slice(0,Math.max(1,Math.min(len||5,order.length))).map((t,k)=>buildStage(t,t==='sum'?Math.min(4,sz):sz,Math.floor(R()*1e8)+101*(k+1)));
}

function buildStage(type,sz,sd){
  const R=rng(sd);
  if(type==='swap'){
    const gems=['🟥','🟦','🟩','🟨','🟪'];
    const target=[...Array(sz)].map(()=>[...Array(sz)].map(()=>gems[Math.floor(R()*Math.min(sz+1,gems.length))]));
    const board=target.map(r=>[...r]);
    const swaps=sz===3?3:4;
    for(let k=0;k<swaps;k++){
      const r1=Math.floor(R()*sz),c1=Math.floor(R()*sz);
      let r2=Math.floor(R()*sz),c2=Math.floor(R()*sz);
      if(r1===r2&&c1===c2)r2=(r2+1)%sz;
      const tmp=board[r1][c1];board[r1][c1]=board[r2][c2];board[r2][c2]=tmp;
    }
    if(board.every((row,r)=>row.every((v,c)=>v===target[r][c]))){
      for(let i=1;i<sz*sz;i++){const r=Math.floor(i/sz),c=i%sz;if(board[r][c]!==board[0][0]){const t=board[0][0];board[0][0]=board[r][c];board[r][c]=t;break}}
    }
    return{type:'swap',title:'GEM SWAP BLUEPRINT',desc:'Tap two gems on YOUR BOARD to swap them until it matches the TARGET. Tiles with ✓ are already right.',sz,target,board,sel:null};
  }
  if(type==='flip'){
    const grid=[...Array(sz)].map(()=>Array(sz).fill(true));
    const flipAt=(r,c)=>{[[0,0],[1,0],[-1,0],[0,1],[0,-1]].forEach(([dr,dc])=>{const nr=r+dr,nc=c+dc;if(nr>=0&&nr<sz&&nc>=0&&nc<sz)grid[nr][nc]=!grid[nr][nc]})};
    const needMoves=new Set(),numFlips=sz===3?3:4;
    for(let k=0;k<numFlips;k++){const r=Math.floor(R()*sz),c=Math.floor(R()*sz),key=r+','+c;if(needMoves.has(key))needMoves.delete(key);else needMoves.add(key);flipAt(r,c)}
    if(needMoves.size===0){needMoves.add('1,1');flipAt(1,1)}
    return{type:'flip',title:'NEON MATRIX FLIP',desc:'Tapping a tile flips it and its 4 neighbours (+ shape). Light up EVERY tile ⚡ to unlock!',sz,grid,needMoves,flipAt};
  }
  if(type==='sum'){
    const n=sz;
    const vals=[...Array(n)].map(()=>[...Array(n)].map(()=>1+Math.floor(R()*4)));
    const sol=[...Array(n)].map(()=>[...Array(n)].map(()=>R()<0.55));
    for(let r=0;r<n;r++)if(!sol[r].some(Boolean))sol[r][Math.floor(R()*n)]=true;
    const rowT=vals.map((row,r)=>row.reduce((s,v,c)=>s+(sol[r][c]?v:0),0));
    const colT=[...Array(n)].map((_,c)=>vals.reduce((s,row,r)=>s+(sol[r][c]?row[c]:0),0));
    return{type:'sum',title:'POWER SUM CIRCUIT',desc:'Tap numbers ON (green) or OFF so every row and column adds up to its target.',sz:n,vals,sol,rowT,colT,cur:[...Array(n)].map(()=>Array(n).fill(false))};
  }
  if(type==='slide'){
    const n=sz===5?4:3,moves=sz===3?14:sz===4?24:34,NN=n*n;
    const solved=b=>b.every((v,i)=>v===(i+1)%NN);
    let b,e,hist;
    do{
      b=[...Array(NN)].map((_,i)=>(i+1)%NN);e=NN-1;hist=[];let prev=-1;
      for(let k=0;k<moves;k++){const r=Math.floor(e/n),c=e%n,nb=[];if(r>0)nb.push(e-n);if(r<n-1)nb.push(e+n);if(c>0)nb.push(e-1);if(c<n-1)nb.push(e+1);
        const opts=nb.filter(x=>x!==prev),t=opts[Math.floor(R()*opts.length)];hist.push(e);b[e]=b[t];b[t]=0;prev=e;e=t}
    }while(solved(b));
    return{type:'slide',title:'VAULT SLIDER',desc:`Tap a tile in line with the empty slot to slide it. Put the numbers back in order 1 → ${NN-1}!`,sz:n,b,e,hist};
  }
  if(type==='pipe'){
    const n=sz+1,src=Math.floor(n/2)*n+Math.floor(n/2),sol=Array(n*n).fill(0),vis=Array(n*n).fill(false),st=[src];vis[src]=true;
    while(st.length){const cur=st[st.length-1],r=Math.floor(cur/n),c=cur%n,nb=[];
      if(r>0&&!vis[cur-n])nb.push([cur-n,1,4]);if(c<n-1&&!vis[cur+1])nb.push([cur+1,2,8]);if(r<n-1&&!vis[cur+n])nb.push([cur+n,4,1]);if(c>0&&!vis[cur-1])nb.push([cur-1,8,2]);
      if(!nb.length||(st.length>3&&R()<0.18)){st.pop();if(!nb.length)continue;else{st.unshift(cur);continue}}
      const[nx,b1,b2]=nb[Math.floor(R()*nb.length)];sol[cur]|=b1;sol[nx]|=b2;vis[nx]=true;st.push(nx)}
    const rot=m=>((m<<1)|(m>>3))&15;
    const stg={type:'pipe',title:'CIRCUIT LINK',desc:'Tap tiles to rotate the wires. Connect every node to the ⚡ power core — no loose ends!',sz:n,sol,src,rot,cur:null};
    let tries=0;
    do{stg.cur=sol.map(m=>{let k=Math.floor(R()*4),x=m;while(k--)x=rot(x);return x});tries++}while(pipePower(stg).solved&&tries<20);
    return stg;
  }
  if(type==='laser'){
    const n=sz+1;let best=null;
    for(let tries=0;tries<80;tries++){
      const grid=Array(n*n).fill(0),r0=Math.floor(R()*n);let r=r0,c=0,d=1,turns=0;const vis=new Set([r*n]),path=[[r,c]];
      for(let step=0;step<n*n*2;step++){
        const nr=r+PD[d][0],nc=c+PD[d][1];if(nr<0||nr>=n||nc<0||nc>=n)break;if(vis.has(nr*n+nc))break;
        r=nr;c=nc;vis.add(r*n+c);path.push([r,c]);
        if(R()<0.45){const nd=R()<0.5?(d+1)%4:(d+3)%4,np=[r+PD[nd][0],c+PD[nd][1]];
          if(np[0]>=0&&np[0]<n&&np[1]>=0&&np[1]<n&&!vis.has(np[0]*n+np[1])){grid[r*n+c]=MIR[1][d]===nd?1:2;d=nd;turns++}}
      }
      const cands=path.slice(1).filter(([a,b])=>!grid[a*n+b]);
      if(turns>=2&&cands.length>=2){best={grid,r0,path,cands,vis};if(turns>=Math.min(4,n-1))break}
    }
    if(!best)return buildStage('flip',sz,sd+1);
    const{grid,r0,cands,vis}=best;
    const ns=n>=6?3:2,sensors=[cands[cands.length-1]];
    if(ns>=2)sensors.push(cands[Math.floor(cands.length/2)]);
    if(ns>=3&&cands.length>2)sensors.push(cands[Math.floor(cands.length/4)]);
    const sens=new Set(sensors.map(([a,b])=>a*n+b));
    const free=[];for(let i=0;i<n*n;i++)if(!vis.has(i)&&!sens.has(i))free.push(i);
    for(let k=0;k<n-2&&free.length;k++){const i=free.splice(Math.floor(R()*free.length),1)[0];grid[i]=R()<0.5?1:2}
    const sol=grid.slice(),cur=grid.slice(),mirrors=[];for(let i=0;i<n*n;i++)if(sol[i])mirrors.push(i);
    const stg={type:'laser',title:'PRISM RELAY',desc:'Tap mirrors to flip them ( / ↔ \\ ). Bounce the laser through every ◎ sensor!',sz:n,r0,sol,cur,sens,mirrors};
    let t=0;do{mirrors.forEach(i=>{if(vis.has(i)&&R()<0.7)cur[i]=3-cur[i]});t++}while(laserTrace(stg).solved&&t<20);
    if(laserTrace(stg).solved){const i=mirrors.find(i=>vis.has(i));cur[i]=3-cur[i]}
    return stg;
  }
  // code
  const L=sz===3?3:sz===4?4:5,K=L+2,pool=[...Array(K).keys()],code=[];
  for(let i=0;i<L;i++)code.push(pool.splice(Math.floor(R()*pool.length),1)[0]);
  return{type:'code',title:'CIPHER CRACK',desc:`Crack the ${L}-symbol code — every symbol is different. After each guess, each tile turns green (right spot), yellow (in the code, wrong spot) or grey (not in the code).`,sz:L,K,code,guess:Array(L).fill(-1),fixed:Array(L).fill(-1),hist:[],sel:0,out:new Set()};
}

function pipePower(st){
  const n=st.sz,m=st.cur,on=Array(n*n).fill(false),q=[st.src];on[st.src]=true;let loose=0;
  const D=[[-n,1,4,(r)=>r>0],[1,2,8,(r,c)=>c<n-1],[n,4,1,(r)=>r<n-1],[-1,8,2,(r,c)=>c>0]];
  while(q.length){const i=q.shift(),r=Math.floor(i/n),c=i%n;
    for(const[dI,b,ob,ok]of D){if(!(m[i]&b))continue;if(!ok(r,c)){loose++;continue}const j=i+dI;if(!(m[j]&ob)){loose++;continue}if(!on[j]){on[j]=true;q.push(j)}}}
  return{on,loose,solved:on.every(Boolean)&&loose===0};
}
function laserTrace(st){
  const n=st.sz;let r=st.r0,c=0,d=1;const pts=[[c+0.5,r+0.5]],hit=new Set(),seen=new Set();let out=false;
  for(let k=0;k<n*n*4;k++){
    const nr=r+PD[d][0],nc=c+PD[d][1];
    if(nr<0||nr>=n||nc<0||nc>=n){pts.push([c+0.5+PD[d][1]*0.5,r+0.5+PD[d][0]*0.5]);out=true;break}
    r=nr;c=nc;const i=r*n+c,key=i*4+d;if(seen.has(key))break;seen.add(key);
    if(st.sens.has(i))hit.add(i);
    const m=st.cur[i];if(m){pts.push([c+0.5,r+0.5]);d=MIR[m][d]}
  }
  if(!out)pts.push([c+0.5,r+0.5]);
  return{pts,hit,solved:[...st.sens].every(i=>hit.has(i))};
}

function evalStageSolved(st){
  if(st.type==='swap')return st.board.every((row,r)=>row.every((v,c)=>v===st.target[r][c]));
  if(st.type==='flip')return st.grid.every(row=>row.every(Boolean));
  if(st.type==='sum'){const n=st.sz;
    for(let r=0;r<n;r++){let s=0;for(let c=0;c<n;c++)if(st.cur[r][c])s+=st.vals[r][c];if(s!==st.rowT[r])return false}
    for(let c=0;c<n;c++){let s=0;for(let r=0;r<n;r++)if(st.cur[r][c])s+=st.vals[r][c];if(s!==st.colT[c])return false}
    return true}
  if(st.type==='slide'){const NN=st.sz*st.sz;return st.b.every((v,i)=>v===(i+1)%NN)}
  if(st.type==='pipe')return pipePower(st).solved;
  if(st.type==='laser')return laserTrace(st).solved;
  if(st.type==='code')return st.hist.length>0&&st.hist[st.hist.length-1].ex===st.sz;
  return false;
}

const pipeSvg=(m,on,kind)=>{const c=on?'#2fe3a0':'#6b5fb0',L=[];if(m&1)L.push('M50 50V-2');if(m&2)L.push('M50 50H102');if(m&4)L.push('M50 50V102');if(m&8)L.push('M50 50H-2');
  let s=`<svg viewBox="0 0 100 100" class="pipe-svg"><path d="${L.join('')}" stroke="#0d0a18" stroke-width="26" stroke-linecap="round" fill="none"/><path d="${L.join('')}" stroke="${c}" stroke-width="15" stroke-linecap="round" fill="none"${on?' filter="url(#pglow)"':''}/>`;
  if(kind==='src')s+=`<circle cx="50" cy="50" r="27" fill="#ffe14d" stroke="#14111f" stroke-width="6"/><path d="M54 30L38 54h12l-4 18 16-25H50z" fill="#14111f"/>`;
  else if(kind==='leaf')s+=`<circle cx="50" cy="50" r="20" fill="${on?'#ffe14d':'#2a2250'}" stroke="${on?'#fff':'#6b5fb0'}" stroke-width="6"/>`;
  else s+=`<circle cx="50" cy="50" r="10" fill="${c}"/>`;
  return s+'</svg>'};
const mirSvg=m=>`<svg viewBox="0 0 100 100" class="pipe-svg"><path d="${m===1?'M18 82L82 18':'M18 18L82 82'}" stroke="#14111f" stroke-width="20" stroke-linecap="round"/><path d="${m===1?'M18 82L82 18':'M18 18L82 82'}" stroke="#bfefff" stroke-width="11" stroke-linecap="round"/></svg>`;

function renderPuzzleBoard(){
  if(!pCur)return;
  const solved=evalStageSolved(pCur),NS=pStages.length;
  $('#ptitle').textContent=`LOCK ${pStageIdx+1}/${NS}: ${pCur.title}`;
  $('#pdesc').textContent=pCur.desc;
  $('#pdots').innerHTML=pStages.map((s,i)=>`<span class="pdot ${i<pStageIdx?'ok':i==pStageIdx?'on':''}">${i<pStageIdx?'✓':i+1}</span>`).join('');
  $('#pmoves').textContent=`Moves: ${pMoves} · No timer`;
  $('#pscore').textContent=pScore;
  $('#pwho').textContent=pModeType==='ocoop'?'TEAM':pModeType==='coop'?(pMoves%2===0?'P1':'P2'):pModeType==='duel'?(pTurn===0?'P1':'P2'):me.n;
  const wrap=$('#pboard-wrap');let html='';
  if(pCur.type==='swap'){
    const sz=pCur.sz;
    html=`<div class="pduo"><div><div class="plbl" style="color:#7fd4ff">🎯 TARGET</div><div class="pgrid" style="grid-template-columns:repeat(${sz},1fr);border-color:#7fd4ff">`;
    for(let r=0;r<sz;r++)for(let c=0;c<sz;c++)html+=`<div class="pcell mini">${pCur.target[r][c]}</div>`;
    html+=`</div></div><div><div class="plbl">👆 YOUR BOARD</div><div class="pgrid" style="grid-template-columns:repeat(${sz},1fr)">`;
    for(let r=0;r<sz;r++)for(let c=0;c<sz;c++){const match=pCur.board[r][c]===pCur.target[r][c],sl=pCur.sels||[],isSel=(q=>q&&q[0]===r&&q[1]===c),mineSel=isSel(sl[pWho()]),theirSel=isSel(sl[1-pWho()]),isSel_=mineSel;
      html+=`<button class="pcell ${match?'lit':''} ${mineSel?'psel':''} ${theirSel?'psel2':''}" data-pr="${r}" data-pc="${c}">${pCur.board[r][c]}<small class="pok">${match?'✓':''}</small></button>`}
    html+=`</div></div></div>`;
  }else if(pCur.type==='flip'){
    const sz=pCur.sz,litCnt=pCur.grid.reduce((s,row)=>s+row.filter(Boolean).length,0);
    html=`<div class="plbl">Lit tiles: ${litCnt} / ${sz*sz}</div><div class="pgrid" style="grid-template-columns:repeat(${sz},1fr)">`;
    for(let r=0;r<sz;r++)for(let c=0;c<sz;c++){const on=pCur.grid[r][c];html+=`<button class="pcell ${on?'lit':''}" data-pr="${r}" data-pc="${c}">${on?'⚡':'🌑'}</button>`}
    html+=`</div>`;
  }else if(pCur.type==='sum'){
    const n=pCur.sz;html=`<div class="pgrid" style="grid-template-columns:repeat(${n+1},1fr)">`;
    for(let r=0;r<n;r++){let rs=0;for(let c=0;c<n;c++){const on=pCur.cur[r][c],v=pCur.vals[r][c];if(on)rs+=v;html+=`<button class="pcell ${on?'lit':''}" data-pr="${r}" data-pc="${c}">+${v}</button>`}
      const ok=rs===pCur.rowT[r];html+=`<div class="pcell sum ${ok?'ok':''}">${rs}/${pCur.rowT[r]}</div>`}
    for(let c=0;c<n;c++){let cs=0;for(let r=0;r<n;r++)if(pCur.cur[r][c])cs+=pCur.vals[r][c];const ok=cs===pCur.colT[c];html+=`<div class="pcell sum ${ok?'ok':''}">${cs}/${pCur.colT[c]}</div>`}
    html+=`<div class="pcell sum ok">⚡</div></div>`;
  }else if(pCur.type==='slide'){
    const n=pCur.sz,NN=n*n,hues=['#ff3e8a','#ff8a1f','#ffe14d','#2fe3a0','#2d9bff','#8a5cff','#ff6fb5','#7fd4ff','#b45cff','#ffd23f','#2fbf8f','#ff4b3e','#5ec8ff','#c8b6ff','#f1c27d'];
    html=`<div class="plbl">Order: 1 → ${NN-1}, empty slot last</div><div class="pgrid" style="grid-template-columns:repeat(${n},1fr)">`;
    pCur.b.forEach((v,i)=>{const r=Math.floor(i/n),c=i%n;
      if(!v)html+=`<div class="pcell pempty"></div>`;
      else html+=`<button class="pcell ptile ${v===i+1?'lit':''}" style="--tc:${hues[(v-1)%hues.length]}" data-pr="${r}" data-pc="${c}">${v}</button>`});
    html+=`</div>`;
  }else if(pCur.type==='pipe'){
    const n=pCur.sz,pw=pipePower(pCur),deg=m=>(m&1)+(m>>1&1)+(m>>2&1)+(m>>3&1);
    const lit=pw.on.filter(Boolean).length;
    html=`<svg width="0" height="0" style="position:absolute"><defs><filter id="pglow"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs></svg><div class="plbl">Powered: ${lit} / ${n*n}${pw.loose&&lit===n*n?' · fix the loose ends!':''}</div><div class="pgrid pipes" style="grid-template-columns:repeat(${n},1fr)">`;
    pCur.cur.forEach((m,i)=>{const r=Math.floor(i/n),c=i%n,kind=i===pCur.src?'src':deg(pCur.sol[i])===1?'leaf':'';
      html+=`<button class="pcell pp ${pw.on[i]?'on':''}" data-pr="${r}" data-pc="${c}">${pipeSvg(m,pw.on[i],kind)}</button>`});
    html+=`</div>`;
  }else if(pCur.type==='laser'){
    const n=pCur.sz,tr=laserTrace(pCur);
    html=`<div class="plbl">Sensors lit: ${tr.hit.size} / ${pCur.sens.size}</div><div class="lwrap"><div class="pgrid lgrid" style="grid-template-columns:repeat(${n},1fr)">`;
    for(let i=0;i<n*n;i++){const r=Math.floor(i/n),c=i%n,m=pCur.cur[i];
      if(r===pCur.r0&&c===0)html+=`<div class="pcell lsrc">◉</div>`;
      else if(pCur.sens.has(i))html+=`<div class="pcell lsens ${tr.hit.has(i)?'ok':''}">◎</div>`;
      else if(m)html+=`<button class="pcell lmir" data-pr="${r}" data-pc="${c}">${mirSvg(m)}</button>`;
      else html+=`<div class="pcell lempty"></div>`}
    html+=`</div><svg class="lbeam" viewBox="0 0 ${n} ${n}" preserveAspectRatio="none"><polyline points="${tr.pts.map(p=>p.join(',')).join(' ')}" fill="none" stroke="#ff3e8a" stroke-width="0.16" stroke-linecap="round" stroke-linejoin="round" opacity=".45"/><polyline points="${tr.pts.map(p=>p.join(',')).join(' ')}" fill="none" stroke="#fff" stroke-width="0.05" stroke-linecap="round" stroke-linejoin="round"/></svg></div>`;
  }else if(pCur.type==='code'){
    const L=pCur.sz,tok=(k,f='')=>k>=0?`<span class="ctok ${f}" style="--c:${CSY[k][0]}">${CSY[k][1]}</span>`:`<span class="ctok empty"></span>`;
    html=`<div class="cwrap"><div class="chist">`;
    if(!pCur.hist.length)html+=`<p class="cnote">Tap symbols to fill the ${L} slots, then press <b>UNLOCK</b>.</p>`;
    const H=pCur.hist;if(H.length>5)html+=`<p class="cnote">+${H.length-5} earlier guess${H.length>6?'es':''}</p>`;
    H.slice(-5).forEach(h=>{html+=`<div class="crow">${h.g.map((k,i)=>tok(k,'fb '+h.fb[i])).join('')}</div>`});
    html+=`</div><div class="crow cur">`;
    for(let i=0;i<L;i++)html+=`<button class="cslot ${pCur.sel===i?'sel':''} ${pCur.fixed[i]>=0?'lit':''}" data-pr="${200+i}" data-pc="0" aria-label="Slot ${i+1}">${tok(pCur.guess[i])}</button>`;
    html+=`</div><p class="cnote">${pCur.hist.length?'Tap a slot to change it, then pick a symbol.':''}</p><div class="cpal">`;
    for(let k=0;k<pCur.K;k++)html+=`<button class="cpick ${pCur.guess.includes(k)?'used':''} ${pCur.out.has(k)?'out':''}" data-pr="${100+k}" data-pc="0" aria-label="Symbol ${k+1}">${tok(k)}</button>`;
    html+=`</div><div class="crow ctools"><button class="btn o sm" data-pr="301" data-pc="0">Clear</button><button class="btn m sm csub" data-pr="300" data-pc="0" ${pCur.guess.includes(-1)?'disabled':''}>UNLOCK ▶</button></div>`;
    html+=`<p class="clegend"><span class="ctok mini fb g"></span> right spot <span class="ctok mini fb y"></span> wrong spot <span class="ctok mini fb x"></span> not in code</p></div>`;
  }
  wrap.innerHTML=html;
  wrap.querySelectorAll('[data-pr]').forEach(b=>{b.onclick=()=>onPuzzleCellClick(+b.dataset.pr,+b.dataset.pc)});
  if(pCur.justSolved){
    const st=pCur;st.justSolved=false;
    SFX.chime();
    $('#pstatus').textContent=`✅ LOCK OPEN! +${st.gain} pts`+(pModeType==='ocoop'?' · nice teamwork!':'');
    wrap.classList.add('psolved');
    setTimeout(()=>{wrap.classList.remove('psolved');if(phase==='pplay'&&pCur===st)advancePuzzleStage()},800);
  }
  if(pPing){const[r,c]=pPing;pPing=null;const e=wrap.querySelector(`[data-pr="${r}"][data-pc="${c}"]`);if(e){e.classList.remove('pping');void e.offsetWidth;e.classList.add('pping')}}
}
function pCheckSolved(){
  if(pCur&&!pCur.done&&evalStageSolved(pCur)){
    pCur.done=true;pCur.justSolved=true;
    pCur.gain=Math.max(60,250+Math.max(0,150-pStageMoves*6)-pStageHints*60);
    pScore+=pCur.gain;
  }
}

function slideTo(st,t){ // move blank to adjacent t
  const e=st.e;st.b[e]=st.b[t];st.b[t]=0;
  if(st.hist.length&&st.hist[st.hist.length-1]===t)st.hist.pop();else st.hist.push(e);
  st.e=t;
}
/* ---------- online co-op: one shared board ----------
   The room host keeps the official order of moves. A guest's tap is sent to the host,
   numbered, applied, and sent back to both screens, so the two boards can never differ.
   If a move is ever missed, the guest asks for the whole move list and replays it. */
let pLog=[],pSeq=0,pApplied=0,pPing=null;
const pWho=()=>pModeType==='ocoop'&&!HOST?1:0;
function onPuzzleCellClick(r,c){
  if(!pCur||pCur.done)return;
  if(pModeType==='ocoop'){
    SFX.slide();const m={s:pStageIdx,r,c,w:pWho()};
    if(HOST)pCommit(m);else NET.ev({e:'preq',m});
    return;
  }
  puzzleTap(r,c,0);renderPuzzleBoard();
}
function pCommit(m){
  if(!pCur||m.s!==pStageIdx||pCur.done)return;
  m.n=++pSeq;pLog.push(m);pApply(m,true);
  NET.ev({e:'pmv',seed:pSeed,m});
}
function pAdvanceSilent(){pStageIdx++;pStageMoves=0;pStageHints=0;if(pStageIdx<pStages.length)pCur=pStages[pStageIdx]}
function pApply(m,show){
  while(pStageIdx<m.s&&pStageIdx<pStages.length-1)pAdvanceSilent();
  if(m.s!==pStageIdx||!pCur||pCur.done)return;
  if(m.k==='h')hintCore();else puzzleTap(m.r,m.c,m.w);
  if(m.w!==pWho()&&m.k!=='h'){pPing=[m.r,m.c];if(show)sfx(660,.06,'triangle',1.3)}
  if(show)renderPuzzleBoard();
}
function pNewVault(){
  if(!HOST)return NET.ev({e:'preq',m:{k:'new'}});
  pSeed=(Math.random()*1e9|0)+1;pSetupVault();PSx.pseed=pSeed;PSx.pdone=0;pub();
  NET.ev({e:'pnew',seed:pSeed,dif:pDiff,len:pLen});
}
function pSetupVault(){
  pStages=genPuzzleStages(pSeed,pDiff,pLen);pStageIdx=0;pScore=0;pMoves=0;pTurn=0;pStageMoves=0;pStageHints=0;pCur=pStages[0];
  pLog=[];pSeq=0;pApplied=0;$('#over').hidden=true;
  $('#pstatus').textContent=pModeType==='ocoop'?'Co-op: you share this board — tap together!':'Take your time — press 💡 Hint whenever you are stuck.';
  renderPuzzleBoard();
}
function puzzleEvent(d){
  if(phase!=='pplay'||pModeType!=='ocoop')return;
  if(HOST){
    if(d.e==='preq'&&d.m){const m=d.m;
      if(m.k==='new')return pNewVault();
      if(m.k==='h')return pCommit({s:+m.s,k:'h',w:1});
      pCommit({s:+m.s,r:+m.r,c:+m.c,w:1});
    }else if(d.e==='psync')NET.ev({e:'plog',seed:pSeed,dif:pDiff,len:pLen,log:pLog});
    return;
  }
  if(d.e==='pmv'&&d.m){
    if(+d.seed!==pSeed||+d.m.n>pApplied+1){NET.ev({e:'psync'});return}
    if(+d.m.n<=pApplied)return;
    pApplied=+d.m.n;pApply(d.m,true);
  }else if(d.e==='pnew'){pSeed=+d.seed;pDiff=+d.dif||pDiff;pLen=+d.len||pLen;pSetupVault()}
  else if(d.e==='plog'&&Array.isArray(d.log)){
    pSeed=+d.seed;pDiff=+d.dif||pDiff;pLen=+d.len||pLen;
    pStages=genPuzzleStages(pSeed,pDiff,pLen);pStageIdx=0;pScore=0;pMoves=0;pStageMoves=0;pStageHints=0;pCur=pStages[0];pApplied=0;$('#over').hidden=true;
    d.log.forEach(m=>{pApply(m,false);pApplied=+m.n||pApplied});
    renderPuzzleBoard();
  }
}
function puzzleTap(r,c,who){
  if(!pCur||pCur.done)return;
  if(pModeType!=='ocoop')SFX.slide();
  let moved=true;
  if(pCur.type==='swap'){
    moved=false;const sl=pCur.sels||(pCur.sels=[null,null]),q=sl[who];
    if(!q)sl[who]=[r,c];
    else{const[r0,c0]=q;if(r0!==r||c0!==c){const t=pCur.board[r0][c0];pCur.board[r0][c0]=pCur.board[r][c];pCur.board[r][c]=t;moved=true}sl[who]=null}
  }else if(pCur.type==='flip'){
    const key=r+','+c;if(pCur.needMoves.has(key))pCur.needMoves.delete(key);else pCur.needMoves.add(key);pCur.flipAt(r,c);
  }else if(pCur.type==='sum'){
    pCur.cur[r][c]=!pCur.cur[r][c];
  }else if(pCur.type==='slide'){
    const n=pCur.sz,er=Math.floor(pCur.e/n),ec=pCur.e%n;
    if(er===r&&ec!==c){const s=c>ec?1:-1;for(let x=ec+s;x!==c+s;x+=s)slideTo(pCur,r*n+x)}
    else if(ec===c&&er!==r){const s=r>er?1:-1;for(let y=er+s;y!==r+s;y+=s)slideTo(pCur,y*n+c)}
    else moved=false;
  }else if(pCur.type==='pipe'){
    const i=r*pCur.sz+c;pCur.cur[i]=pCur.rot(pCur.cur[i]);
  }else if(pCur.type==='laser'){
    const i=r*pCur.sz+c;if(pCur.cur[i])pCur.cur[i]=3-pCur.cur[i];else moved=false;
  }else if(pCur.type==='code'){
    moved=false;const st=pCur,free=i=>st.fixed[i]<0;
    const nextEmpty=from=>{for(let d=0;d<st.sz;d++){const j=(from+d)%st.sz;if(st.guess[j]<0&&free(j))return j}return -1};
    if(r>=100&&r<200){
      const k=r-100,last=st.hist[st.hist.length-1];let i=st.sel>=0&&free(st.sel)?st.sel:nextEmpty(0);
      // nothing selected and the row is full: replace the first slot that wasn't confirmed green
      if(i<0)i=st.guess.findIndex((g,j)=>free(j)&&!(last&&last.g[j]===g&&last.fb[j]==='g'));
      const j=st.guess.indexOf(k);
      if(i>=0&&!(j>=0&&!free(j))){if(j>=0)st.guess[j]=-1;st.guess[i]=k;st.sel=nextEmpty(i+1)}
    }else if(r>=200&&r<300){const i=r-200;if(free(i)){if(st.sel===i&&st.guess[i]>=0){st.guess[i]=-1}else st.sel=i}}
    else if(r===301){st.guess=st.fixed.slice();st.sel=nextEmpty(0)}
    else if(r===300&&!st.guess.includes(-1)){
      const last=st.hist[st.hist.length-1];
      if(last&&last.g.join()===st.guess.join()){$('#pstatus').textContent='You already tried that code — change at least one symbol.'}
      else{codeSubmit(st);moved=true}
    }
  }
  if(moved){pMoves++;pStageMoves++}
  pCheckSolved();
}
const CSY=[['#ff4d5e','●'],['#20c98a','▲'],['#3d8bff','■'],['#f5b800','◆'],['#b45cff','★'],['#ff8a1f','✚'],['#ff6fc0','♥']];
function codeSubmit(st){
  const g=st.guess.slice(),fb=g.map((k,i)=>st.code[i]===k?'g':st.code.includes(k)?'y':'x');
  const ex=fb.filter(f=>f==='g').length,nr=fb.filter(f=>f==='y').length;
  st.hist.push({g,fb,ex,nr});
  g.forEach((k,i)=>{if(fb[i]==='x')st.out.add(k)});
  st.sel=-1;   // keep the guess on the board so it can be tweaked
  if(ex===st.sz)st.guess=st.code.slice();
  sfx(ex===st.sz?900:420+ex*80,.12,'triangle',1.2);
}

function advancePuzzleStage(){
  pStageIdx++;pStageMoves=0;pStageHints=0;
  PSx.pstg=pStageIdx;PSx.ps=pScore;pub();
  if(pStageIdx>=pStages.length){
    if(pModeType==='duel'&&pTurn===0){
      pP2Score=pScore;pTurn=1;pStageIdx=0;pScore=0;pMoves=0;
      pStages=genPuzzleStages(pSeed+55,pDiff,pLen);pCur=pStages[0];
      $('#pstatus').textContent='Player 2, your turn! Beat '+pP2Score+' pts';
      renderPuzzleBoard();return;
    }
    finishPuzzle(true);return;
  }
  pCur=pStages[pStageIdx];
  $('#pstatus').textContent=`Lock ${pStageIdx+1} ready — take your time!`;
  renderPuzzleBoard();
}

function givePuzzleHint(){
  if(!pCur||pCur.done)return;
  if(pModeType==='ocoop'){if(HOST)pCommit({s:pStageIdx,k:'h',w:0});else NET.ev({e:'preq',m:{s:pStageIdx,k:'h'}});return}
  hintCore();renderPuzzleBoard();
}
function hintCore(){
  if(!pCur||pCur.done)return;
  SFX.star();
  pStageHints++;
  $('#pstatus').textContent='💡 Hint used — one correct step applied!';
  const P=pCur;
  if(P.type==='swap'){
    const sz=P.sz;
    outer:for(let r=0;r<sz;r++)for(let c=0;c<sz;c++){if(P.board[r][c]!==P.target[r][c]){
      for(let r2=0;r2<sz;r2++)for(let c2=0;c2<sz;c2++){if((r2!==r||c2!==c)&&P.board[r2][c2]===P.target[r][c]&&P.board[r2][c2]!==P.target[r2][c2]){const t=P.board[r][c];P.board[r][c]=P.board[r2][c2];P.board[r2][c2]=t;P.sels=null;break outer}}}}
  }else if(P.type==='flip'){
    const first=[...P.needMoves][0];if(first){const[r,c]=first.split(',').map(Number);P.needMoves.delete(first);P.flipAt(r,c)}
  }else if(P.type==='sum'){
    outer2:for(let r=0;r<P.sz;r++)for(let c=0;c<P.sz;c++)if(P.cur[r][c]!==P.sol[r][c]){P.cur[r][c]=P.sol[r][c];break outer2}
  }else if(P.type==='slide'){
    if(P.hist.length){const t=P.hist[P.hist.length-1];slideTo(P,t)}
  }else if(P.type==='pipe'){
    const i=P.cur.findIndex((m,i)=>m!==P.sol[i]);if(i>=0)P.cur[i]=P.sol[i];
  }else if(P.type==='laser'){
    const tr=laserTrace(P);
    // prefer a wrong mirror the beam actually touches
    const touched=new Set(tr.pts.map(([x,y])=>Math.floor(y)*P.sz+Math.floor(x)));
    let i=P.mirrors.find(i=>P.cur[i]!==P.sol[i]&&touched.has(i));if(i==null)i=P.mirrors.find(i=>P.cur[i]!==P.sol[i]);
    if(i!=null)P.cur[i]=P.sol[i];
  }else if(P.type==='code'){
    const i=P.fixed.findIndex(v=>v<0);
    if(i>=0){P.fixed[i]=P.code[i];P.guess=P.guess.map((k,j)=>P.fixed[j]>=0?P.fixed[j]:(k===P.code[i]?-1:k));P.sel=P.guess.findIndex((k,j)=>k<0&&P.fixed[j]<0)}
    if(!P.fixed.includes(-1)){P.guess=P.code.slice();codeSubmit(P)}
  }
  pCheckSolved();
}

function startPuzzle(mode){
  me.n=($('#nm').value.trim()||'Agent').slice(0,12);
  pModeType=mode;
  pDiff=+($('#pdiff').value||2);pLen=+($('#plen').value||5);
  if(mode==='local')pModeType=$('#pmode').value||'coop';
  if(mode==='online')pModeType=(HOST?$('#pnet').value:(opp&&opp.pm)||'coop')==='coop'?'ocoop':'online';
  if(mode!=='online'){leave();G='puzzle';cpu=true;$('#net').hidden=true}
  if(mode==='online'&&!HOST&&opp&&opp.pseed){pDiff=opp.pdf||pDiff;pLen=opp.plen||pLen}
  phase='pplay';
  show('pgame');
  pSeed=(mode==='online'&&!HOST&&opp&&opp.pseed)?opp.pseed:(Math.random()*1e9|0)+1;
  pStages=genPuzzleStages(pSeed,pDiff,pLen);
  pStageIdx=0;pScore=0;pMoves=0;pTurn=0;pStageMoves=0;pStageHints=0;
  pCur=pStages[0];
  PSx={ps:0,pstg:0,pdone:0,pseed:pSeed,plen:pLen,pdf:pDiff,pm:pModeType==='ocoop'?'coop':'race'};
  pLog=[];pSeq=0;pApplied=0;
  if(pModeType==='ocoop'&&!HOST)NET.ev({e:'psync'});
  pub();
  clearInterval(ptimer);
  $('#ptm').textContent='NO TIMER';
  $('#prival-txt').textContent=pModeType==='coop'?'Co-op relay (P1 & P2 take turns)':pModeType==='duel'?'2P duel · fewest moves wins':pModeType==='ocoop'?'Co-op with '+(on||'your partner'):pModeType==='online'?'Race vs '+(on||'rival'):'Solo vault';
  $('#pstatus').textContent=pModeType==='ocoop'?'Co-op: you share this board — tap together!':'Take your time — press 💡 Hint whenever you are stuck.';
  renderPuzzleBoard();
}

function finishPuzzle(won){
  clearInterval(ptimer);
  PSx.pdone=1;PSx.ps=pScore;pub();
  jingle(won);
  if(pModeType==='duel'){
    const p1Win=pP2Score>=pScore;
    $('#ot').textContent=p1Win?'🏆 PLAYER 1 WINS!':'🏆 PLAYER 2 WINS!';
    $('#os').textContent=`P1: ${pP2Score} pts vs P2: ${pScore} pts`;
  }else if(pModeType==='ocoop'){
    $('#ot').textContent='🔓 CRACKED IT TOGETHER!';
    $('#os').textContent=`${me.n} & ${on} opened all ${pStages.length} locks — ${pScore} team pts in ${pMoves} moves!`;
  }else{
    $('#ot').textContent='🔓 VAULT UNLOCKED!';
    $('#os').textContent=`${me.n} cracked all ${pStages.length} locks — ${pScore} pts in ${pMoves} moves!`;
  }
  $('#rm').hidden=false;$('#rm').textContent='New Vault!';
  $('#over').hidden=false;
}

function puzzleSync(){
  if(!opp){if(pModeType==='ocoop')$('#prival-txt').textContent='Partner disconnected — waiting…';return}
  if(!HOST&&pModeType==='ocoop'&&opp.pm==='race'){startPuzzle('online');return}
  if(pModeType==='ocoop'||(!HOST&&opp.pm==='coop'&&pModeType==='online')){
    if(!HOST&&pModeType!=='ocoop'){startPuzzle('online');return}
    $('#prival-txt').textContent='🤝 Co-op with '+on;
    if(!HOST&&opp.pseed&&opp.pseed!==pSeed)NET.ev({e:'psync'});
    return;
  }
  if(!HOST&&opp.pseed&&opp.pseed!==pSeed){
    pSeed=opp.pseed;pDiff=opp.pdf||pDiff;pLen=opp.plen||pLen;
    pStages=genPuzzleStages(pSeed,pDiff,pLen);
    pStageIdx=0;pCur=pStages[0];renderPuzzleBoard();
  }
  $('#prival-txt').textContent=`${on}: lock ${Math.min(pStages.length,(opp.pstg||0)+1)}/${pStages.length} (${opp.ps||0} pts)`;
  if(opp.pdone&&phase==='pplay'){
    clearInterval(ptimer);
    jingle(false);
    $('#ot').textContent='RIVAL CRACKED THE VAULT!';
    $('#os').textContent=`${on} opened every lock first with ${opp.ps} pts!`;
    $('#over').hidden=false;
  }
}

$('#phint').onclick=givePuzzleHint;
$('#pskip').onclick=()=>pModeType==='ocoop'?pNewVault():startPuzzle(pModeType==='coop'||pModeType==='duel'?'local':pModeType);
$('#pquit').onclick=leave;
$('#psolo').onclick=()=>startPuzzle('solo');
$('#plocal').onclick=()=>startPuzzle('local');
$('#pgo').onclick=()=>{PSx.pm=$('#pnet').value;join('puzzle')};


ART_SVG.puzzle=`<svg viewBox="0 0 360 124" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><defs><radialGradient id="pbg" cx=".5" cy=".5" r=".7"><stop offset="0" stop-color="#3b2a8a"/><stop offset="1" stop-color="#0d0a18"/></radialGradient><radialGradient id="pdoor" cx=".4" cy=".35" r=".8"><stop offset="0" stop-color="#4a3aa8"/><stop offset="1" stop-color="#1f1647"/></radialGradient><filter id="pglw" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2.2"/></filter></defs><rect width="360" height="124" fill="url(#pbg)"/><g fill="none" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M0 22H44L58 36H118" stroke="#2fe3a0"/><path d="M0 104H40L54 90H118" stroke="#ff3e8a"/><path d="M360 18H316L300 34H240" stroke="#7fd4ff"/><path d="M360 106H322L306 90H246" stroke="#ffe14d"/></g><g stroke="#14111f" stroke-width="2"><circle cx="118" cy="36" r="4" fill="#2fe3a0"/><circle cx="118" cy="90" r="4" fill="#ff3e8a"/><circle cx="240" cy="34" r="4" fill="#7fd4ff"/><circle cx="246" cy="90" r="4" fill="#ffe14d"/></g><g transform="translate(36 38)" stroke="#14111f" stroke-width="2.5"><rect x="0" y="0" width="15" height="15" rx="3" fill="#2fe3a0"/><rect x="19" y="0" width="15" height="15" rx="3" fill="#2a2250"/><rect x="38" y="0" width="15" height="15" rx="3" fill="#ff3e8a"/><rect x="0" y="19" width="15" height="15" rx="3" fill="#2a2250"/><rect x="19" y="19" width="15" height="15" rx="3" fill="#ffe14d"/><rect x="38" y="19" width="15" height="15" rx="3" fill="#2a2250"/><rect x="0" y="38" width="15" height="15" rx="3" fill="#7fd4ff"/><rect x="19" y="38" width="15" height="15" rx="3" fill="#2a2250"/><rect x="38" y="38" width="15" height="15" rx="3" fill="#2fe3a0"/></g><g><polyline points="262,52 296,52 296,82 334,82" fill="none" stroke="#ff3e8a" stroke-width="7" stroke-linejoin="round" filter="url(#pglw)"/><polyline points="262,52 296,52 296,82 334,82" fill="none" stroke="#fff" stroke-width="2" stroke-linejoin="round"/></g><circle cx="262" cy="52" r="6" fill="#ff3e8a" stroke="#14111f" stroke-width="2.5"/><path d="M288 44L304 60" stroke="#14111f" stroke-width="7" stroke-linecap="round"/><path d="M288 44L304 60" stroke="#bfefff" stroke-width="3.5" stroke-linecap="round"/><path d="M288 90L304 74" stroke="#14111f" stroke-width="7" stroke-linecap="round"/><path d="M288 90L304 74" stroke="#bfefff" stroke-width="3.5" stroke-linecap="round"/><circle cx="338" cy="82" r="8" fill="#2fe3a0" stroke="#fff" stroke-width="2.5"/><circle cx="180" cy="62" r="54" fill="#14111f"/><circle cx="180" cy="62" r="50" fill="url(#pdoor)" stroke="#14111f" stroke-width="4"/><circle cx="180" cy="62" r="43" fill="none" stroke="#ffe14d" stroke-width="6"/><g fill="#fff" stroke="#14111f" stroke-width="1.5"><circle cx="180" cy="19" r="4"/><circle cx="210" cy="32" r="4"/><circle cx="223" cy="62" r="4"/><circle cx="210" cy="92" r="4"/><circle cx="180" cy="105" r="4"/><circle cx="150" cy="92" r="4"/><circle cx="137" cy="62" r="4"/><circle cx="150" cy="32" r="4"/></g><circle cx="180" cy="62" r="29" fill="#14111f" stroke="#7fd4ff" stroke-width="3"/><g><g stroke="#7fd4ff" stroke-width="2" stroke-linecap="round"><path d="M180 37v6M180 81v6M155 62h6M199 62h6M162 44l4 4M194 76l4 4M198 44l-4 4M166 76l-4 4"/></g><g stroke="#14111f" stroke-width="9" stroke-linecap="round"><path d="M180 62L180 40M180 62L199 73M180 62L161 73"/></g><g stroke="#ffe14d" stroke-width="5" stroke-linecap="round"><path d="M180 62L180 40M180 62L199 73M180 62L161 73"/></g></g><circle cx="180" cy="62" r="9" fill="#ff3e8a" stroke="#14111f" stroke-width="3"/><g fill="#ffe14d"><path d="M86 18l2 5 5 2-5 2-2 5-2-5-5-2 5-2z"/><path d="M262 104l1.6 4 4 1.6-4 1.6-1.6 4-1.6-4-4-1.6 4-1.6z"/><path d="M330 30l1.4 3.4 3.4 1.4-3.4 1.4-1.4 3.4-1.4-3.4-3.4-1.4 3.4-1.4z"/></g></svg>`;
ART_SVG.m_puzzle=`<svg viewBox="0 0 120 100" aria-hidden="true"><path d="M36 48V34Q36 14 60 14Q84 14 84 34V48" fill="none" stroke="#14111f" stroke-width="14" stroke-linecap="round"/><path d="M36 48V34Q36 14 60 14Q84 14 84 34V48" fill="none" stroke="#d7dbe6" stroke-width="6" stroke-linecap="round"/><rect x="24" y="46" width="72" height="46" rx="10" fill="#ffd23f" stroke="#14111f" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><circle cx="60" cy="64" r="8" fill="#14111f"/><path d="M60 68V80" stroke="#14111f" stroke-width="6" stroke-linecap="round"/><path d="M32 54h12" stroke="#fff" stroke-width="3.5" stroke-linecap="round" opacity=".8"/></svg>`;
