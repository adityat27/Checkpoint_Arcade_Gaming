/* =========================================================================
   SLIPSTREAM · cars (needs THREE)
   -------------------------------------------------------------------------
   Every vehicle is built from code, with no model files.

   BODY  The body is "lofted": a list of key cross-sections from the nose to
         the tail (half width, sill width, bottom, belt line, roof, roof
         width) is smoothly interpolated (monotone cubic) into rings, and the
         rings are skinned. Each ring has a rocker, a shoulder crease, a
         window seal and a greenhouse that leans in (tumblehome), so the
         surfaces catch light like a real car. Wheel arches are cut out and
         flared, and each strip of the skin gets a material from where it
         sits: paint, glass, pillar, roof, window trim, cladding, underbody.
   DETAIL Lights, grilles, vents, panel lines and badges-free trim are
         "decals": flat 2D outlines that are projected onto the body surface
         (front, rear, side or top) and lifted a few millimetres along the
         surface normal, so they follow every curve.
   WHEELS Lathed tyres with sidewalls and tread grooves; extruded multi-spoke
         rims (several designs), brake discs and calipers behind the spokes.

   SSCars.player(style, colour, plate)  -> detailed car for you / your rival
   SSCars.traffic(type)                  -> per-material geometries for instancing
   SSCars.SHAPES                          key sections (edit to reshape a car)
   ========================================================================= */
(function(root){
'use strict';
const T=()=>root.THREE;
const lerp=(a,b,t)=>a+(b-a)*t,clamp=(v,a,b)=>v<a?a:v>b?b:v;
const sstep=(a,b,v)=>{const t=clamp((v-a)/(b-a),0,1);return t*t*(3-2*t)};

/* ---------- body shapes ----------
   Key section columns: z (m, + = front), w (half width at the shoulder crease),
   ws (half width at the sill), yb (bottom of the body), yh (belt line: where the
   side glass starts, or the edge of the hood / boot), yr (roof, or the top of the
   hood / boot), wr (half width of the roof or hood top), s = what the body is from
   this section to the next one: 'h' hood, 'w' windscreen, 'c' cabin (side windows),
   'p' pillar, 'r' rear glass, 't' tail / boot.
   Wheels: r radius, f/b axle positions, tw tyre width, rim design.
   Real-world proportions: each player car keeps the length, width, height,
   wheelbase and wheel size of the car it is modelled after. */
const SHAPES={
  // V8 fastback coupé (Mustang GT-like): long hood, short deck, wide hips
  gt:{len:4.81,wheel:{r:.345,f:1.455,b:-1.265,tw:.265,rim:'split5',rimCol:'gunmetal',caliper:'red'},
    crease:.70,shoulder:.04,flare:.012,flareR:.03,roof:'paint',pillars:'black',belt:'black',doors:1,
    k:[[2.405,.64,.54,.42,.63,.665,.46,'h'],[2.385,.8,.7,.26,.69,.735,.57,'h'],[2.34,.875,.8,.19,.735,.785,.64,'h'],[2.22,.92,.86,.17,.775,.83,.68,'h'],[2.0,.94,.875,.165,.81,.865,.7,'h'],
      [1.45,.95,.885,.17,.87,.925,.71,'h'],[.6,.95,.885,.19,.955,.985,.72,'w'],[.32,.945,.88,.19,.975,1.19,.66,'w'],
      [-.2,.95,.885,.19,.99,1.39,.6,'c'],[-.55,.955,.89,.19,.995,1.38,.6,'p'],[-.6,.955,.89,.19,.995,1.375,.6,'c'],
      [-.92,.965,.9,.19,1.0,1.345,.6,'r'],[-1.72,.965,.9,.2,1.02,1.08,.63,'t'],[-2.16,.955,.89,.22,1.025,1.075,.65,'t'],
      [-2.34,.91,.83,.25,.99,1.045,.61,'t'],[-2.405,.82,.72,.3,.92,.96,.52,'t']]},
  // mid-engine hypercar: knife-edge nose, cab-forward bubble canopy, louvred engine cover, wide hips, fixed wing
  hatch:{len:4.62,wheel:{r:.356,f:1.43,b:-1.36,tw:.3,rim:'aero10',rimCol:'black',caliper:'red'},
    crease:.6,shoulder:.045,flare:.022,flareR:.045,archGap:.06,roof:'carbon',pillars:'black',belt:'black',doors:1,
    k:[[2.31,.56,.46,.22,.33,.36,.36,'h'],[2.28,.78,.68,.14,.4,.44,.54,'h'],[2.19,.92,.83,.115,.5,.55,.63,'h'],[1.98,.99,.91,.115,.65,.7,.67,'h'],
      [1.5,1.0,.93,.13,.8,.85,.66,'h'],[1.06,.985,.92,.14,.82,.84,.64,'w'],[.56,.975,.91,.15,.8,.99,.58,'w'],
      [.12,.975,.91,.15,.75,1.115,.54,'c'],[-.38,.985,.92,.15,.765,1.125,.54,'p'],[-.45,.985,.92,.15,.765,1.12,.54,'c'],
      [-.82,1.0,.935,.15,.78,1.07,.57,'r'],[-1.02,1.02,.95,.16,.8,1.0,.62,'t'],[-1.5,1.04,.97,.16,.83,.95,.68,'t'],
      [-1.98,1.03,.96,.18,.845,.915,.69,'t'],[-2.24,.99,.91,.22,.83,.885,.63,'t'],[-2.31,.9,.8,.28,.79,.83,.52,'t']]},
  // super-SUV (Urus-like): low sharp nose, fast coupé roofline, big flared arches, 23-inch wheels, no chrome
  suv:{len:5.11,wheel:{r:.405,f:1.53,b:-1.49,tw:.3,rim:'y5',rimCol:'black',caliper:'red'},
    crease:.62,shoulder:.042,flare:.022,flareR:.04,archGap:.07,roof:'black',pillars:'black',belt:'black',doors:2,archClad:1,
    k:[[2.555,.7,.62,.3,.66,.7,.48,'h'],[2.52,.86,.79,.24,.74,.79,.62,'h'],[2.4,.95,.88,.22,.81,.87,.7,'h'],[2.05,.985,.92,.23,.89,.95,.74,'h'],
      [1.53,1.0,.935,.25,.95,1.01,.75,'h'],[.98,.99,.925,.27,1.01,1.055,.76,'w'],[.5,.98,.915,.28,1.05,1.42,.72,'w'],
      [.08,.98,.915,.28,1.06,1.615,.67,'c'],[-.42,.98,.915,.28,1.07,1.635,.67,'p'],[-.5,.98,.915,.28,1.07,1.635,.67,'c'],
      [-1.32,.99,.925,.28,1.08,1.585,.66,'p'],[-1.42,.99,.925,.28,1.08,1.565,.66,'c'],[-1.66,1.0,.935,.29,1.09,1.5,.65,'r'],
      [-2.2,1.0,.935,.31,1.1,1.27,.62,'t'],[-2.45,.98,.915,.34,1.08,1.17,.58,'t'],[-2.555,.89,.82,.4,1.0,1.07,.5,'t']]},
  // four-door super saloon (M5 CS-like): long wheelbase, carbon roof, quad pipes
  saloon:{len:4.983,wheel:{r:.352,f:1.63,b:-1.352,tw:.275,rim:'y5',rimCol:'bronze',caliper:'red'},
    crease:.68,shoulder:.036,flare:.012,flareR:.018,roof:'carbon',pillars:'black',belt:'black',doors:2,
    k:[[2.4915,.66,.58,.3,.62,.665,.46,'h'],[2.47,.82,.74,.19,.685,.74,.57,'h'],[2.37,.915,.85,.16,.745,.8,.65,'h'],[2.05,.945,.885,.16,.8,.86,.69,'h'],
      [1.63,.95,.89,.17,.85,.91,.71,'h'],[.74,.945,.885,.19,.945,.97,.72,'w'],[.34,.94,.88,.19,.97,1.22,.67,'w'],
      [-.06,.94,.88,.19,.985,1.44,.63,'c'],[-.4,.94,.88,.19,.99,1.455,.63,'p'],[-.48,.94,.88,.19,.99,1.455,.63,'c'],
      [-1.2,.95,.89,.19,1.0,1.4,.62,'r'],[-1.8,.95,.89,.2,1.02,1.085,.64,'t'],[-2.3,.935,.875,.22,1.02,1.065,.64,'t'],
      [-2.44,.89,.82,.26,.98,1.03,.58,'t'],[-2.4915,.8,.72,.32,.9,.95,.5,'t']]},

  // ---- traffic: everyday Indian highway cars ----
  hatchT:{len:3.85,wheel:{r:.31,f:1.17,b:-1.28,tw:.19,rim:'cap'},crease:.66,shoulder:.03,pillars:'black',belt:'black',
    k:[[1.925,.64,.58,.36,.66,.7,.44,'h'],[1.89,.78,.73,.31,.72,.77,.56,'h'],[1.75,.83,.8,.3,.79,.83,.62,'h'],[1.17,.86,.83,.3,.88,.92,.66,'h'],
      [.86,.865,.83,.3,.92,.95,.67,'w'],[.0,.86,.83,.3,.96,1.5,.63,'c'],[-.36,.86,.83,.3,.965,1.51,.63,'p'],[-.42,.86,.83,.3,.965,1.51,.63,'c'],
      [-1.3,.865,.835,.3,.98,1.47,.62,'r'],[-1.72,.86,.83,.32,.99,1.3,.58,'t'],[-1.88,.82,.78,.36,.96,1.12,.52,'t'],[-1.925,.75,.7,.4,.9,1.0,.46,'t']]},
  sedan:{len:4.45,wheel:{r:.31,f:1.4,b:-1.2,tw:.195,rim:'cap'},crease:.68,shoulder:.032,pillars:'black',belt:'chrome',
    k:[[2.225,.66,.6,.33,.62,.66,.44,'h'],[2.19,.8,.74,.28,.68,.73,.56,'h'],[2.05,.855,.81,.27,.75,.8,.63,'h'],[1.4,.875,.84,.27,.82,.87,.67,'h'],
      [.7,.875,.84,.28,.9,.93,.68,'w'],[-.1,.87,.835,.28,.93,1.46,.62,'c'],[-.48,.87,.835,.28,.935,1.47,.62,'p'],[-.55,.87,.835,.28,.935,1.47,.62,'c'],
      [-1.12,.875,.84,.28,.95,1.42,.61,'r'],[-1.62,.875,.84,.29,.97,1.03,.63,'t'],[-2.1,.86,.825,.3,.97,1.01,.62,'t'],[-2.225,.78,.72,.36,.9,.94,.5,'t']]},
  suvT:{len:4.3,wheel:{r:.34,f:1.3,b:-1.31,tw:.215,rim:'cap'},crease:.62,shoulder:.03,pillars:'black',belt:'black',clad:1,archClad:1,rails:1,
    k:[[2.15,.68,.62,.38,.78,.82,.46,'h'],[2.115,.82,.77,.34,.85,.9,.6,'h'],[1.98,.875,.835,.33,.92,.96,.67,'h'],[1.3,.895,.855,.34,.98,1.02,.71,'h'],
      [.88,.895,.855,.35,1.02,1.05,.72,'w'],[.0,.89,.85,.35,1.05,1.62,.68,'c'],[-.4,.89,.85,.35,1.055,1.63,.68,'p'],[-.47,.89,.85,.35,1.055,1.63,.68,'c'],
      [-1.62,.895,.855,.35,1.07,1.6,.67,'r'],[-1.95,.89,.85,.37,1.07,1.46,.63,'t'],[-2.1,.86,.81,.4,1.04,1.3,.57,'t'],[-2.15,.79,.73,.44,.98,1.14,.5,'t']]},
  van:{len:4.75,wheel:{r:.34,f:1.5,b:-1.25,tw:.205,rim:'cap'},crease:.64,shoulder:.028,pillars:'black',belt:'black',
    k:[[2.375,.7,.64,.38,.74,.78,.48,'h'],[2.34,.84,.79,.33,.81,.86,.62,'h'],[2.2,.895,.86,.32,.88,.93,.69,'h'],[1.6,.915,.88,.33,.96,1.0,.72,'h'],
      [1.18,.915,.88,.34,1.0,1.04,.74,'w'],[.5,.915,.88,.34,1.04,1.74,.7,'c'],[.1,.915,.88,.34,1.05,1.78,.7,'p'],[.02,.915,.88,.34,1.05,1.78,.7,'c'],
      [-1.0,.915,.88,.34,1.06,1.78,.7,'p'],[-1.08,.915,.88,.34,1.06,1.78,.7,'c'],[-2.02,.915,.88,.35,1.07,1.76,.69,'r'],
      [-2.24,.91,.875,.37,1.07,1.6,.66,'t'],[-2.34,.88,.84,.4,1.04,1.4,.6,'t'],[-2.375,.81,.75,.44,.98,1.2,.52,'t']]},
  bus:{len:11.6,wheel:{r:.52,f:3.55,b:-2.95,tw:.3,rim:'bus',dual:1},crease:.5,shoulder:.02,belt:'black',pillars:'black',
    k:[[5.8,1.16,1.12,.5,.9,1.0,.98,'h'],[5.74,1.25,1.22,.45,1.0,1.4,1.12,'w'],[5.5,1.275,1.25,.44,1.12,3.0,1.17,'c'],
      ...Array.from({length:8},(_,i)=>[[4.65-i*1.22,1.275,1.25,.44,1.42,3.08,1.18,'p'],[4.52-i*1.22,1.275,1.25,.44,1.42,3.08,1.18,'c']]).flat(),
      [-5.25,1.275,1.25,.44,1.42,3.08,1.18,'p'],[-5.62,1.27,1.24,.46,1.42,3.05,1.17,'t'],[-5.8,1.22,1.18,.52,1.38,2.95,1.1,'t']]},
  truckCab:{len:2.4,wheel:null,crease:.55,shoulder:.02,belt:'black',pillars:'paint',
    k:[[1.2,1.12,1.1,.62,1.25,1.3,1.0,'h'],[1.12,1.2,1.18,.58,1.3,1.4,1.08,'w'],[.82,1.23,1.21,.58,1.38,2.62,1.12,'p'],[.7,1.24,1.22,.58,1.4,2.72,1.14,'c'],
      [-.38,1.24,1.22,.58,1.4,2.78,1.15,'p'],[-1.2,1.22,1.2,.62,1.4,2.74,1.12,'t']]}
};

/* ---------- OVERDRIVE race cars (same columns as above) ----------
   open: open-wheel (no arches; wheels sit out at wheel.track), numAt: race-number area on the bonnet
   [x0,z0,x1,z1], lamp: glow + exhaust positions {hl:[x,y]|null, tl:[x,y], ex:[[x,y]…]} */
Object.assign(SHAPES,{
  // Inferno F1: needle nose, narrow tub, sidepods, airbox; the wings, halo and arms are added in dressODF1
  odF1:{len:5.3,open:1,noInterior:1,noPlate:1,doors:0,wheel:{r:.355,f:1.86,b:-1.72,tw:.37,track:.8,rim:'aero10',rimCol:'black',caliper:'#d8a21c'},
    crease:.5,shoulder:.03,roof:'paint',numAt:[-.11,1.62,.11,1.98],lamp:{hl:null,tl:[0,.36],ex:[[0,.47]]},
    k:[[2.65,.08,.06,.17,.21,.25,.06,'h'],[2.45,.15,.12,.15,.26,.31,.12,'h'],[1.95,.22,.19,.14,.33,.4,.16,'h'],[1.25,.29,.26,.12,.42,.51,.21,'h'],
      [.62,.36,.33,.1,.49,.6,.25,'h'],[.22,.6,.56,.09,.5,.63,.24,'t'],[-.35,.76,.72,.08,.51,.66,.24,'t'],[-.95,.7,.66,.08,.5,.72,.2,'t'],
      [-1.55,.47,.43,.1,.46,.62,.16,'t'],[-2.1,.29,.25,.14,.4,.5,.11,'t'],[-2.45,.19,.15,.2,.36,.42,.09,'t']]},
  // Voltage GT: wedge supercar, scissor-door profile, racing stripes
  odSuper:{len:4.7,wheel:{r:.35,f:1.43,b:-1.38,tw:.3,rim:'split5',rimCol:'black',caliper:'#d6ff2e'},
    crease:.55,shoulder:.06,flare:.02,flareR:.045,archGap:.06,roof:'paint',pillars:'black',belt:'black',doors:1,mirror:'black',noPlate:1,numAt:[-.3,1.25,.3,1.8],
    lamp:{hl:[.72,.41],tl:[.68,.66],ex:[[.08,.36],[.22,.36]]},
    k:[[2.35,.58,.48,.2,.3,.33,.4,'h'],[2.3,.83,.73,.13,.37,.41,.6,'h'],[2.15,.96,.88,.11,.48,.53,.68,'h'],[1.9,1.0,.92,.11,.65,.7,.7,'h'],[1.4,1.0,.93,.12,.8,.85,.7,'h'],
      [.95,.99,.92,.13,.82,.84,.66,'w'],[.45,.98,.91,.14,.79,.98,.58,'w'],[.0,.98,.91,.14,.72,1.1,.52,'c'],[-.5,.99,.92,.14,.74,1.1,.52,'c'],[-.85,1.0,.93,.15,.76,1.04,.56,'r'],
      [-1.15,1.02,.95,.15,.79,.96,.64,'t'],[-1.7,1.04,.97,.16,.82,.9,.7,'t'],[-2.15,1.02,.95,.18,.82,.87,.68,'t'],[-2.35,.94,.85,.24,.78,.82,.56,'t']]},
  // Specter GT: front-engined GT3 racer, long bonnet, swan-neck wing
  odSpecter:{len:4.75,wheel:{r:.355,f:1.38,b:-1.27,tw:.31,rim:'six',rimCol:'black',caliper:'red'},
    crease:.6,shoulder:.045,flare:.03,flareR:.05,archGap:.06,roof:'paint',pillars:'black',belt:'black',doors:1,mirror:'black',noPlate:1,numAt:[-.3,1.0,.3,1.55],
    lamp:{hl:[.74,.56],tl:[.72,.84],ex:[[.38,.24]]},
    k:[[2.375,.66,.56,.2,.42,.46,.46,'h'],[2.33,.88,.8,.12,.5,.55,.64,'h'],[2.15,.98,.92,.1,.6,.66,.72,'h'],[1.75,1.02,.95,.1,.79,.84,.74,'h'],[1.1,1.0,.93,.11,.82,.87,.72,'h'],
      [.5,.97,.9,.12,.85,.88,.7,'w'],[.1,.96,.89,.12,.84,1.1,.62,'w'],[-.3,.96,.89,.12,.86,1.25,.56,'c'],[-.85,.97,.9,.12,.88,1.24,.56,'c'],[-1.15,.99,.92,.13,.9,1.16,.6,'r'],
      [-1.6,1.04,.97,.14,.92,1.0,.7,'t'],[-2.1,1.03,.96,.16,.93,.98,.72,'t'],[-2.375,.95,.86,.22,.9,.94,.6,'t']]},
  // Sentinel V12: grand hypercar, horseshoe grille, LED C-line on the flanks
  odSentinel:{len:4.6,wheel:{r:.36,f:1.38,b:-1.34,tw:.3,rim:'y5',rimCol:'gunmetal',caliper:'#1fb4ff'},
    crease:.62,shoulder:.04,flare:.018,flareR:.035,archGap:.065,roof:'paint',pillars:'black',belt:'black',doors:1,mirror:'black',noPlate:1,numAt:[-.28,1.15,.28,1.65],
    lamp:{hl:[.72,.53],tl:[.6,.8],ex:[[.07,.38],[.2,.38]]},
    k:[[2.3,.62,.52,.22,.4,.44,.46,'h'],[2.26,.86,.78,.14,.47,.52,.62,'h'],[2.1,.97,.9,.12,.56,.62,.7,'h'],[1.8,1.0,.93,.12,.72,.78,.72,'h'],[1.3,1.0,.93,.13,.82,.87,.72,'h'],
      [.9,.99,.92,.14,.84,.86,.68,'w'],[.4,.98,.91,.15,.82,1.02,.6,'w'],[-.05,.98,.91,.15,.79,1.14,.56,'c'],[-.55,.99,.92,.15,.8,1.14,.56,'c'],[-.85,1.0,.93,.15,.82,1.1,.58,'r'],
      [-1.1,1.02,.95,.16,.84,1.02,.64,'t'],[-1.7,1.03,.96,.17,.86,.96,.7,'t'],[-2.15,1.0,.93,.2,.85,.92,.68,'t'],[-2.3,.92,.83,.26,.82,.86,.56,'t']]},
  // Aero-Blade X: Le Mans-style hypercar, teardrop canopy, three fins
  odAero:{len:4.9,wheel:{r:.36,f:1.5,b:-1.38,tw:.3,rim:'aero10',rimCol:'gunmetal',caliper:'#ffb42a'},
    crease:.55,shoulder:.05,flare:.03,flareR:.05,archGap:.06,roof:'paint',pillars:'black',belt:'black',doors:1,mirror:'black',noPlate:1,numAt:[-.26,1.35,.26,1.85],
    lamp:{hl:[.78,.43],tl:[.7,.62],ex:[[0,.55]]},
    k:[[2.45,.55,.45,.16,.26,.3,.4,'h'],[2.4,.82,.72,.1,.32,.36,.6,'h'],[2.2,.97,.88,.09,.46,.5,.7,'h'],[1.9,1.0,.92,.09,.66,.71,.72,'h'],[1.4,.99,.92,.1,.8,.84,.6,'h'],
      [1.0,.97,.9,.11,.82,.835,.46,'w'],[.55,.96,.89,.11,.82,.94,.42,'w'],[.1,.96,.89,.11,.82,1.05,.4,'c'],[-.45,.97,.9,.11,.82,1.05,.4,'c'],[-.8,.99,.92,.11,.82,.99,.42,'r'],
      [-1.2,1.02,.95,.12,.83,.92,.5,'t'],[-1.8,1.03,.96,.13,.82,.88,.55,'t'],[-2.25,1.0,.93,.15,.78,.83,.52,'t'],[-2.45,.9,.8,.2,.72,.77,.44,'t']]}
});

/* ---------- smooth interpolation of the key sections (monotone cubic: no wobbles) ---------- */
const PREP=new WeakMap();
function prep(K){
  let p=PREP.get(K);if(p)return p;const n=K.length;p=[];
  for(let j=1;j<=6;j++){const h=[],d=[],m=[];
    for(let k=0;k<n-1;k++){h[k]=K[k][0]-K[k+1][0];d[k]=(K[k+1][j]-K[k][j])/h[k]}
    for(let k=0;k<n;k++){if(k===0)m[k]=d[0];else if(k===n-1)m[k]=d[n-2];else if(d[k-1]*d[k]<=0)m[k]=0;else{const a=h[k-1],b=h[k];m[k]=3*(a+b)/((2*b+a)/d[k-1]+(b+2*a)/d[k])}}
    p[j]={h,m}}
  PREP.set(K,p);return p;
}
function segIdx(K,z){let lo=0,hi=K.length-1;if(z>=K[0][0])return 0;if(z<=K[hi][0])return hi-1;while(hi-lo>1){const m=(lo+hi)>>1;if(K[m][0]>=z)lo=m;else hi=m}return lo}
function interp(K,j,z){
  const n=K.length;if(z>=K[0][0])return K[0][j];if(z<=K[n-1][0])return K[n-1][j];
  const i=segIdx(K,z),P=prep(K)[j],h=P.h[i],t=(K[i][0]-z)/h,t2=t*t,t3=t2*t;
  return(2*t3-3*t2+1)*K[i][j]+(t3-2*t2+t)*h*P.m[i]+(-2*t3+3*t2)*K[i+1][j]+(t3-t2)*h*P.m[i+1];
}
const segAt=(K,z)=>K[segIdx(K,z)][7];

/* ---------- cross-sections ---------- */
function archY(S,z){const W=S.wheel;if(!W||S.open)return -1;const R=W.r+(S.archGap||.075);let y=-1;
  for(const a of[W.f,W.b]){const dz=z-a;if(Math.abs(dz)<R)y=Math.max(y,W.r+.02+Math.sqrt(R*R-dz*dz))}return y}
// wheel-arch flare: the body swells a little over each wheel
function flare(S,z){const W=S.wheel;if(!W||!S.flare||S.open)return 0;let f=0;
  for(const[a,k]of[[W.f,S.flare],[W.b,S.flareR!=null?S.flareR:S.flare]]){const d=Math.abs(z-a)/(W.r+.38);if(d<1)f=Math.max(f,k*.5*(1+Math.cos(d*Math.PI)))}return f}
// half ring, centre bottom -> centre top (14 points)
function ring(S,w,ws,yb,yh,yr,wr){
  const hh=Math.max(.05,yh-yb),gh=yr-yh,cr=S.crease||.7,sIn=S.shoulder!=null?S.shoulder:.035,cut=.012,yc=yb+hh*cr;
  const p=[[0,yb],[ws*.9,yb],[ws,yb+Math.min(.05,hh*.14)],[lerp(ws,w,.74),yb+hh*cr*.42],[w,yc],[w-cut,yc+Math.min(.028,hh*.07)],
    [w-sIn*.7,lerp(yc,yh,.62)],[w-sIn,yh]];
  const xb=w-sIn-.016,y2=yh+Math.min(.01,gh*.3),rr=Math.min(.06,gh*.18),xt=wr+rr*.7,yt=yr-rr;
  p.push([xb,y2],[lerp(xb,xt,.5),lerp(y2,yt,.5)+gh*.012],[xt,yt],[wr,yr-rr*.25],[wr*.55,yr],[0,yr+Math.min(.012,gh*.05)]);
  return p;
}
function section(S,z,noArch){
  const K=S.k,g=j=>interp(K,j,z),fl=flare(S,z);
  let yb=g(3);const yh=g(4),yr=Math.max(g(5),yh+.004),a=noArch?-1:archY(S,z),arch=a>yb;if(arch)yb=Math.min(a,yh-.08);
  return{R:ring(S,g(1)+fl,g(2)+fl*.7,yb,yh,yr,g(6)),arch,seg:segAt(K,z),yb,yh,yr,w:g(1)+fl,ws:g(2)+fl*.7,wr:g(6)};
}
function sectAt(S,z){const s=section(S,z);return{w:s.w,ws:s.ws,yb:s.yb,yh:s.yh,yr:s.yr,wr:s.wr}}

// which material each strip of the skin gets (strip j joins half-ring points j and j+1)
const MK=['paint','glass','under','clad','belt','pillar','roof'];
function stripMat(S,j,sg,arch){
  if(j<=1)return'under';
  if(j===2)return(S.clad||(arch&&S.archClad))?'clad':'paint';
  if(j<=6)return'paint';
  if(sg==='h'||sg==='t')return'paint';
  if(j===7)return'belt';
  if(sg==='c')return j<=9?'glass':'roof';
  if(sg==='p')return j<=9?'pillar':'roof';
  if(sg==='w'||sg==='r')return j===8?'pillar':'glass';
  return'paint';
}

/* ---------- the lofted body: one geometry, groups in MK order ---------- */
function body(S,o={}){
  const THREE=T(),K=S.k,ds=o.ds||.05,zf=K[0][0],zb=K[K.length-1][0],W=S.wheel;
  // sample positions: every key (so glass edges are crisp), the arch edges, then fill in
  const must=K.map(k=>k[0]);if(W){const R=W.r+(S.archGap||.075);[W.f,W.b].forEach(a=>{must.push(a+R,a-R);for(let q=-6;q<=6;q++)must.push(a+R*Math.sin(q/6*Math.PI/2))})}
  must.sort((a,b)=>b-a);const zs=[];
  for(let i=0;i<must.length;i++){const a=must[i];if(zs.length&&Math.abs(zs[zs.length-1]-a)<.004)continue;zs.push(a);const b=must[i+1];
    if(b!=null){const end=Math.min(zf-a,a-zb)<.3?ds*.4:ds,n=Math.floor((a-b)/end);for(let q=1;q<n;q++)zs.push(a-(a-b)*q/n)}}
  const P=[],C=[],UV=[],rings=[];
  for(const z of zs){
    const s=section(S,z),R=s.R,loop=[R[0],...R.slice(1,13),R[13],...R.slice(1,13).reverse().map(([x,y])=>[-x,y])];
    rings.push({z,seg:s.seg,arch:s.arch,base:P.length/3});
    for(const[x,y]of loop){P.push(x,y,z);UV.push(x,z);
      // baked ambient occlusion: darker toward the ground and inside the wheel arches
      let ao=.58+.42*sstep(s.yb-.02,s.yb+.32,y);if(s.arch)ao*=.82+.18*sstep(s.yb,s.yb+.14,y);C.push(ao,ao,ao)}
  }
  const NL=26,idx=MK.map(()=>[]);
  for(let r=0;r<rings.length-1;r++){
    const A=rings[r],B=rings[r+1],mid=(A.z+B.z)/2,sg=segAt(K,mid),arch=A.arch||B.arch;
    for(let k=0;k<NL;k++){const j=k<13?k:25-k,m=MK.indexOf(stripMat(S,j,sg,arch));
      const a=A.base+k,b=A.base+(k+1)%NL,c=B.base+(k+1)%NL,d=B.base+k;idx[m].push(a,c,b,a,d,c)}
  }
  // end caps (own vertices, so they shade flat)
  [[0,1],[rings.length-1,-1]].forEach(([ri,dir])=>{
    const R_=rings[ri],st=P.length/3;let cy=0;
    for(let k=0;k<NL;k++){const q=(R_.base+k)*3;P.push(P[q],P[q+1],P[q+2]);C.push(C[q],C[q+1],C[q+2]);UV.push(P[q],P[q+2]);cy+=P[q+1]}
    P.push(0,cy/NL,R_.z);C.push(.8,.8,.8);UV.push(0,R_.z);const c=st+NL;
    for(let k=0;k<NL;k++){const a=st+k,b=st+(k+1)%NL;if(dir>0)idx[0].push(c,a,b);else idx[0].push(c,b,a)}   // painted (bumpers and lamps sit on top)
  });
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute(P,3));g.setAttribute('color',new THREE.Float32BufferAttribute(C,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(UV,2));
  const all=[];let off=0;idx.forEach((l,m)=>{g.addGroup(off,l.length,m);off+=l.length;for(const v of l)all.push(v)});
  g.setIndex(all);g.computeVertexNormals();
  g.userData={zf,zb};
  return g;
}

/* ---------- the body surface, for placing details ---------- */
function surfOf(S){
  if(S._surf)return S._surf;
  const K=S.k,zf=K[0][0],zb=K[K.length-1][0];
  const halfX=(R,y)=>{let best=-1;for(let i=0;i<R.length-1;i++){const a=R[i],b=R[i+1];if(a[1]===b[1])continue;if((a[1]-y)*(b[1]-y)<=0){const t=(y-a[1])/(b[1]-a[1]),x=a[0]+(b[0]-a[0])*t;if(x>best)best=x}}return best};
  const topY=(R,x)=>{let best=null;for(let i=0;i<R.length-1;i++){const a=R[i],b=R[i+1];if(a[0]===b[0])continue;if((a[0]-x)*(b[0]-x)<=0){const t=(x-a[0])/(b[0]-a[0]),y=a[1]+(b[1]-a[1])*t;if(best==null||y>best)best=y}}return best};
  const X=(z,y)=>halfX(section(S,z).R,y),Y=(z,x)=>topY(section(S,z,1).R,Math.abs(x)),Xn=(z,y)=>halfX(section(S,z,1).R,y);
  // front / rear: march in from the end (ignoring the arch cut-outs, which would break the search)
  const Zf=(x,y)=>{let lo=zf-1.5,hi=zf;x=Math.abs(x);if(Xn(lo,y)<x)return null;if(Xn(hi,y)>=x)return hi;for(let i=0;i<22;i++){const m=(lo+hi)/2;if(Xn(m,y)>=x)lo=m;else hi=m}return lo};
  const Zb=(x,y)=>{let lo=zb,hi=zb+1.5;x=Math.abs(x);if(Xn(hi,y)<x)return null;if(Xn(lo,y)>=x)return lo;for(let i=0;i<22;i++){const m=(lo+hi)/2;if(Xn(m,y)>=x)hi=m;else lo=m}return hi};
  return S._surf={X,Y,Zf,Zb,zf,zb};
}
const nrm=v=>{const l=Math.hypot(v[0],v[1],v[2])||1;return[v[0]/l,v[1]/l,v[2]/l]};
// (u,v) on a 2D layout -> point + outward normal on the body
function projector(S,kind){
  const F=surfOf(S),e=.005,lim=5;
  const dd=(f,a0,a1,c)=>{if(a0!=null&&a1!=null)return clamp((a1-a0)/(2*e),-lim,lim);if(a1!=null)return clamp((a1-c)/e,-lim,lim);if(a0!=null)return clamp((c-a0)/e,-lim,lim);return 0};
  if(kind==='front'||kind==='rear'){const Z=kind==='front'?F.Zf:F.Zb,s=kind==='front'?1:-1;
    return(u,v)=>{const z=Z(u,v);if(z==null)return null;const gx=dd(Z,Z(u-e,v),Z(u+e,v),z),gy=dd(Z,Z(u,v-e),Z(u,v+e),z);return{p:[u,v,z],n:nrm([-gx*s,-gy*s,s])}}}
  if(kind==='side')return(u,v)=>{const x=F.X(u,v);if(x<0)return null;const a0=F.X(u,v-e),a1=F.X(u,v+e),b0=F.X(u-e,v),b1=F.X(u+e,v);
    const gy=dd(0,a0<0?null:a0,a1<0?null:a1,x),gz=dd(0,b0<0?null:b0,b1<0?null:b1,x);return{p:[x,v,u],n:nrm([1,-gy,-gz])}};
  // top: u = x, v = z
  return(u,v)=>{const y=F.Y(v,u);if(y==null)return null;const gx=dd(0,F.Y(v,u-e),F.Y(v,u+e),y),gz=dd(0,F.Y(v-e,u),F.Y(v+e,u),y);return{p:[u,y,v],n:nrm([-gx,1,-gz])}};
}
// clip a polygon to an axis-aligned cell (Sutherland-Hodgman)
function clipRect(poly,x0,y0,x1,y1){
  let out=poly;const pass=(inside,cut)=>{const inp=out;out=[];for(let i=0;i<inp.length;i++){const a=inp[i],b=inp[(i+1)%inp.length],ia=inside(a),ib=inside(b);if(ia){out.push(a);if(!ib)out.push(cut(a,b))}else if(ib)out.push(cut(a,b))}};
  const cx=x=>(a,b)=>[x,a[1]+(b[1]-a[1])*(x-a[0])/(b[0]-a[0])],cy=y=>(a,b)=>[a[0]+(b[0]-a[0])*(y-a[1])/(b[1]-a[1]),y];
  pass(p=>p[0]>=x0,cx(x0));if(out.length)pass(p=>p[0]<=x1,cx(x1));if(out.length)pass(p=>p[1]>=y0,cy(y0));if(out.length)pass(p=>p[1]<=y1,cy(y1));
  return out;
}
/* a decal: a 2D outline projected onto the body.
   o.off  lift along the normal (m) · o.cell  grid size (smaller = follows curves better)
   o.mirror  also make the mirror image on the other side (x -> -x) · o.uv  keep (u,v) as texture coords */
function decal(S,kind,pts,o={}){
  const THREE=T(),P=projector(S,kind),off=o.off==null?.004:o.off,cell=o.cell||.035,uvs=o.uv,F=surfOf(S),dep=o.depth||.3;
  const deep=kind==='front'?q=>q.p[2]<F.zf-dep:kind==='rear'?q=>q.p[2]>F.zb+dep:()=>false;
  let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;for(const[x,y]of pts){x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y)}
  const nx=Math.max(1,Math.ceil((x1-x0)/cell)),ny=Math.max(1,Math.ceil((y1-y0)/cell)),pos=[],nor=[],uv=[];
  const cache=new Map(),pr=(u,v)=>{const k=u.toFixed(5)+','+v.toFixed(5);let r=cache.get(k);if(r===undefined){r=P(u,v);cache.set(k,r)}return r};
  for(let i=0;i<nx;i++)for(let j=0;j<ny;j++){
    const c=clipRect(pts,x0+(x1-x0)*i/nx,y0+(y1-y0)*j/ny,x0+(x1-x0)*(i+1)/nx,y0+(y1-y0)*(j+1)/ny);if(c.length<3)continue;
    let tri;try{tri=THREE.ShapeUtils.triangulateShape(c.map(p=>new THREE.Vector2(p[0],p[1])),[])}catch(e){continue}
    for(const t of tri){const q=t.map(k=>pr(c[k][0],c[k][1]));if(q.some(v=>!v||deep(v)))continue;
      const V=q.map(r=>[r.p[0]+r.n[0]*off,r.p[1]+r.n[1]*off,r.p[2]+r.n[2]*off]);
      const e1=[V[1][0]-V[0][0],V[1][1]-V[0][1],V[1][2]-V[0][2]],e2=[V[2][0]-V[0][0],V[2][1]-V[0][1],V[2][2]-V[0][2]];
      const fn=[e1[1]*e2[2]-e1[2]*e2[1],e1[2]*e2[0]-e1[0]*e2[2],e1[0]*e2[1]-e1[1]*e2[0]],an=[q[0].n[0]+q[1].n[0]+q[2].n[0],q[0].n[1]+q[1].n[1]+q[2].n[1],q[0].n[2]+q[1].n[2]+q[2].n[2]];
      const ord=fn[0]*an[0]+fn[1]*an[1]+fn[2]*an[2]<0?[0,2,1]:[0,1,2];
      for(const k of ord){pos.push(...V[k]);nor.push(...q[k].n);if(uvs)uv.push(c[t[k]][0],c[t[k]][1])}}
  }
  if(o.mirror){const n=pos.length/9;for(let t=0;t<n;t++)for(const k of[0,2,1]){const b=(t*3+k)*3;pos.push(-pos[b],pos[b+1],pos[b+2]);nor.push(-nor[b],nor[b+1],nor[b+2]);if(uvs)uv.push(-uv[(t*3+k)*2],uv[(t*3+k)*2+1])}}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(nor,3));
  if(uvs){g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.userData.keepUV=1}
  return g;
}

/* ---------- 2D outlines ---------- */
// rounded rectangle (CCW)
function rr(x0,y0,x1,y1,r,n=4){r=Math.min(r,(x1-x0)/2,(y1-y0)/2);const p=[],c=[[x1-r,y0+r,-90],[x1-r,y1-r,0],[x0+r,y1-r,90],[x0+r,y0+r,180]];
  for(const[cx,cy,a0]of c)for(let i=0;i<=n;i++){const a=(a0+90*i/n)*Math.PI/180;p.push([cx+Math.cos(a)*r,cy+Math.sin(a)*r])}return p}
// a polygon with its corners rounded
function rpoly(pts,r=.01,n=3){const out=[];for(let i=0;i<pts.length;i++){const a=pts[(i+pts.length-1)%pts.length],b=pts[i],c=pts[(i+1)%pts.length];
  const da=Math.hypot(a[0]-b[0],a[1]-b[1]),dc=Math.hypot(c[0]-b[0],c[1]-b[1]),k=Math.min(r,da*.45,dc*.45);
  const p0=[b[0]+(a[0]-b[0])*k/da,b[1]+(a[1]-b[1])*k/da],p1=[b[0]+(c[0]-b[0])*k/dc,b[1]+(c[1]-b[1])*k/dc];
  for(let t=0;t<=n;t++){const s=t/n,q=1-s;out.push([q*q*p0[0]+2*q*s*b[0]+s*s*p1[0],q*q*p0[1]+2*q*s*b[1]+s*s*p1[1]])}}return out}
const ccw=p=>{let a=0;for(let i=0;i<p.length;i++){const q=p[i],r=p[(i+1)%p.length];a+=q[0]*r[1]-r[0]*q[1]}return a<0?p.slice().reverse():p};
const circ=(cx,cy,r,n=18)=>Array.from({length:n},(_,i)=>{const a=i/n*Math.PI*2;return[cx+Math.cos(a)*r,cy+Math.sin(a)*r]});
const flipU=p=>p.map(([u,v])=>[-u,v]);

/* ---------- small geometry helpers ---------- */
function box(w,h,d,x,y,z,rx=0,ry=0,rz=0){const g=new(T().BoxGeometry)(w,h,d);if(rx||ry||rz)g.applyMatrix4(new(T().Matrix4)().makeRotationFromEuler(new(T().Euler)(rx,ry,rz)));g.translate(x,y,z);return g}
function cyl(r1,r2,h,seg,x,y,z,axis='y'){const g=new(T().CylinderGeometry)(r1,r2,h,seg);if(axis==='x')g.rotateZ(Math.PI/2);if(axis==='z')g.rotateX(Math.PI/2);g.translate(x,y,z);return g}
function plain(g){const n=g.index?g.toNonIndexed():g;if(n!==g)g.dispose();if(n.attributes.uv&&!n.userData.keepUV)n.deleteAttribute('uv');if(!n.attributes.normal)n.computeVertexNormals();return n}
// merge geometries (position, normal, colour; uv when every part has one)
function merge(list){
  const THREE=T();list=list.filter(g=>g&&g.attributes.position.count).map(plain);if(!list.length)return null;
  let n=0;list.forEach(g=>n+=g.attributes.position.count);const withUV=list.every(g=>g.attributes.uv);
  const P=new Float32Array(n*3),N=new Float32Array(n*3),Cc=new Float32Array(n*3).fill(1),U=withUV?new Float32Array(n*2):null;let o=0;
  list.forEach(g=>{const c=g.attributes.position.count;P.set(g.attributes.position.array,o*3);N.set(g.attributes.normal.array,o*3);if(g.attributes.color)Cc.set(g.attributes.color.array,o*3);if(U)U.set(g.attributes.uv.array,o*2);o+=c;g.dispose()});
  const G=new THREE.BufferGeometry();G.setAttribute('position',new THREE.BufferAttribute(P,3));G.setAttribute('normal',new THREE.BufferAttribute(N,3));G.setAttribute('color',new THREE.BufferAttribute(Cc,3));
  if(U)G.setAttribute('uv',new THREE.BufferAttribute(U,2));G.computeBoundingSphere();return G;
}
// pull one material group out of a grouped geometry (keeps vertex colours)
function groupGeo(g,m){
  const THREE=T(),gr=g.groups.find(q=>q.materialIndex===m);if(!gr||!gr.count)return null;
  const I=g.index.array,A=g.attributes,G=new THREE.BufferGeometry();
  ['position','normal','color'].forEach(k=>{if(!A[k])return;const src=A[k].array,out=new Float32Array(gr.count*3);for(let i=0;i<gr.count;i++){const v=I[gr.start+i];out[i*3]=src[v*3];out[i*3+1]=src[v*3+1];out[i*3+2]=src[v*3+2]}G.setAttribute(k,new THREE.BufferAttribute(out,3))});
  return G;
}

/* ---------- wheels ---------- */
function tyreGeo(r,w,seg=30,lite){
  const THREE=T(),ri=r*.7,h=w/2,b=Math.min(.045,w*.2);
  if(lite){const g=new THREE.LatheGeometry([[ri,-h],[r-b,-h-.004],[r,-h+b],[r,h-b],[r-b,h+.004],[ri,h]].map(([x,y])=>new THREE.Vector2(x,y)),seg);g.rotateZ(Math.PI/2);return g}
  const pts=[[ri,-h+.012],[ri+.012,-h],[lerp(ri,r,.55),-h-.008],[r-b*.55,-h+.004],[r-b*.12,-h+b*.55],[r,-h+b],
    [r,-h*.42],[r-.007,-h*.38],[r-.007,-h*.3],[r,-h*.26],[r,h*.26],[r-.007,h*.3],[r-.007,h*.38],[r,h*.42],
    [r,h-b],[r-b*.12,h-b*.55],[r-b*.55,h-.004],[lerp(ri,r,.55),h+.008],[ri+.012,h],[ri,h-.012]].map(([x,y])=>new THREE.Vector2(x,y));
  const g=new THREE.LatheGeometry(pts,seg);g.rotateZ(Math.PI/2);return g;   // axis along x
}
// rim designs: spoke angles (deg) and how wide the spokes are at the hub and at the rim (m)
const RIMS={
  split5:{sp:[...Array(5)].flatMap((_,i)=>[i*72-6.5,i*72+6.5]),hw0:.012,hw1:.011,hub:.3,dish:.03},
  twin:{sp:[...Array(5)].flatMap((_,i)=>[i*72-9,i*72+9]),hw0:.014,hw1:.012,hub:.28,dish:.018},
  six:{sp:[...Array(6)].map((_,i)=>i*60),hw0:.034,hw1:.026,hub:.3,dish:.02},
  y5:{sp:[...Array(5)].map((_,i)=>i*72),hw0:.03,hw1:.05,hub:.28,dish:.035,y:1},
  aero10:{sp:[...Array(10)].map((_,i)=>i*36+(i%2?4:-4)),hw0:.011,hw1:.013,hub:.25,dish:.045},
  cap:{sp:[...Array(8)].map((_,i)=>i*45),hw0:.05,hw1:.045,hub:.42,dish:.008,cap:1},
  bus:{sp:[...Array(10)].map((_,i)=>i*36),hw0:.06,hw1:.05,hub:.5,dish:.01,cap:1}
};
function rimFace(R,style){
  const THREE=T(),D=RIMS[style]||RIMS.six,sp=D.sp.map(a=>a*Math.PI/180),r0=R*D.hub,r1=R*.86;
  const shape=new THREE.Shape(circ(0,0,R,40).map(([x,y])=>new THREE.Vector2(x,y)));
  for(let i=0;i<sp.length;i++){
    const a0=sp[i],a1=sp[(i+1)%sp.length]+(i===sp.length-1?Math.PI*2:0);
    const o0=a0+D.hw1/r1,o1=a1-D.hw1/r1,i0=a0+D.hw0/r0,i1=a1-D.hw0/r0;if(o1-o0<.05||i1-i0<.01)continue;
    const pts=[],n=Math.max(3,Math.ceil((o1-o0)/.14));
    for(let k=0;k<=n;k++){const a=o0+(o1-o0)*k/n;pts.push([Math.cos(a)*r1,Math.sin(a)*r1])}
    const m=Math.max(2,Math.ceil((i1-i0)/.2));for(let k=m;k>=0;k--){const a=i0+(i1-i0)*k/m;pts.push([Math.cos(a)*r0,Math.sin(a)*r0])}
    shape.holes.push(new THREE.Path(rpoly(pts,.012,2).reverse().map(([x,y])=>new THREE.Vector2(x,y))));
    if(D.y){// Y spokes: a small window between the two arms of each spoke
      const a=a0,q=[[Math.cos(a)*R*.5,Math.sin(a)*R*.5]];const d=.2;for(let k=0;k<=3;k++){const b=a-d+2*d*k/3;q.push([Math.cos(b)*r1,Math.sin(b)*r1])}
      shape.holes.push(new THREE.Path(rpoly(q,.01,2).reverse().map(([x,y])=>new THREE.Vector2(x,y))));
    }
  }
  const g=new THREE.ExtrudeGeometry(shape,{depth:.022,bevelEnabled:true,bevelThickness:.007,bevelSize:.005,bevelSegments:1,curveSegments:6});
  const P=g.attributes.position;for(let i=0;i<P.count;i++){const x=P.getX(i),y=P.getY(i),r=Math.hypot(x,y)/R;P.setZ(i,P.getZ(i)-D.dish*(1-r*r))}
  g.computeVertexNormals();g.rotateY(Math.PI/2);   // face toward +x
  return g;
}
// one wheel (axis x, outer face at +x): {rubber, rim, dark, disc, caliper} geometries
function wheelParts(r,w,style,lite){
  const rr_=r*.7,face=w/2-.012,out={rubber:[],rim:[],dark:[],disc:[],caliper:[]};
  out.rubber.push(tyreGeo(r,w,lite?12:32,lite));
  if(lite){out.rim.push(cyl(rr_,rr_*.92,.03,12,face-.02,0,0,'x'));out.dark.push(cyl(rr_*.3,rr_*.3,.035,8,face-.01,0,0,'x'));return out}
  const f=rimFace(rr_,style);f.translate(face-.03,0,0);out.rim.push(f);
  {const lip=new(T().TorusGeometry)(rr_-.008,.011,6,lite?20:40);lip.rotateY(Math.PI/2);lip.translate(face-.006,0,0);out.rim.push(lip)}   // outer lip
  out.dark.push(new(T().CylinderGeometry)(rr_*.97,rr_*.97,w*.8,lite?12:24,1,true).rotateZ(Math.PI/2).translate(-.01,0,0));       // barrel (open)
  out.dark.push(cyl(rr_*.96,rr_*.96,.01,lite?12:24,-w*.3,0,0,'x'));                    // back wall
  out.rim.push(cyl(rr_*.17,rr_*.19,.05,12,face-.01,0,0,'x'));                           // centre cap
  if(!lite){
    out.disc.push(cyl(rr_*.78,rr_*.78,.026,28,face-.11,0,0,'x'));out.dark.push(cyl(rr_*.34,rr_*.34,.05,14,face-.1,0,0,'x'));
    const cp=new(T().CylinderGeometry)(rr_*.83,rr_*.83,.07,10,1,false,-.55,1.1);cp.rotateZ(Math.PI/2);cp.translate(face-.1,0,0);
    const cb=box(.08,rr_*.28,rr_*.6,face-.1,rr_*.66,-rr_*.2,0,0,0);cb.rotateX(.95);out.caliper.push(cb);
  }
  return out;
}

/* ---------- textures (drawn once) ---------- */
const TEX={};
function canvasTex(key,w,h,draw,o={}){
  if(TEX[key])return TEX[key];const THREE=T(),cv=document.createElement('canvas');cv.width=w;cv.height=h;draw(cv.getContext('2d'),w,h);
  const t=new THREE.CanvasTexture(cv);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=4;if(!o.lin&&THREE.sRGBEncoding)t.encoding=THREE.sRGBEncoding;return TEX[key]=t;
}
const texHex=()=>canvasTex('hex',128,128,(c,w,h)=>{c.fillStyle='#0d0e10';c.fillRect(0,0,w,h);c.strokeStyle='#3a3d44';c.lineWidth=4;
  const s=16;for(let y=-1;y<10;y++)for(let x=-1;x<6;x++){const cx=x*s*1.73+(y%2)*s*.866,cy=y*s*1.5;c.beginPath();for(let k=0;k<6;k++){const a=Math.PI/6+k*Math.PI/3;c.lineTo(cx+Math.cos(a)*s*.92,cy+Math.sin(a)*s*.92)}c.closePath();c.stroke()}});
const texSlat=()=>canvasTex('slat',64,64,(c,w,h)=>{c.fillStyle='#0b0c0e';c.fillRect(0,0,w,h);const g=c.createLinearGradient(0,0,0,16);g.addColorStop(0,'#55585f');g.addColorStop(.5,'#2a2c31');g.addColorStop(1,'#0b0c0e');for(let y=0;y<h;y+=16){c.fillStyle=g;c.save();c.translate(0,y);c.fillRect(0,0,w,9);c.restore()}});
const texCarbon=()=>canvasTex('carbon',64,64,(c,w,h)=>{for(let y=0;y<8;y++)for(let x=0;x<8;x++){const g=c.createLinearGradient(x*8,y*8,x*8+8,y*8+8);const a=(x+y)%2?['#1d1f23','#0c0d0f']:['#0c0d0f','#25282d'];g.addColorStop(0,a[0]);g.addColorStop(1,a[1]);c.fillStyle=g;c.fillRect(x*8,y*8,8,8)}});
function plateTex(text){
  const THREE=T(),cv=document.createElement('canvas');cv.width=256;cv.height=64;const c=cv.getContext('2d');
  c.fillStyle='#f6f6f0';c.fillRect(0,0,256,64);c.strokeStyle='#202226';c.lineWidth=4;c.strokeRect(4,4,248,56);
  c.fillStyle='#1e3a8a';c.fillRect(6,6,22,52);c.fillStyle='#fff';c.font='bold 12px Arial,sans-serif';c.textAlign='center';c.fillText('IND',17,54);
  c.fillStyle='#16181c';c.font='bold 38px "Arial Narrow",Arial,sans-serif';c.textBaseline='middle';c.fillText(String(text).toUpperCase().slice(0,9),142,35);
  const t=new THREE.CanvasTexture(cv);t.anisotropy=4;if(THREE.sRGBEncoding)t.encoding=THREE.sRGBEncoding;return t;
}
// race number roundel: white disc, bold number
function numTex(n,col){
  const THREE=T(),cv=document.createElement('canvas');cv.width=cv.height=128;const c=cv.getContext('2d');
  c.fillStyle='rgba(250,250,247,.96)';c.beginPath();c.arc(64,64,58,0,7);c.fill();c.lineWidth=5;c.strokeStyle='rgba(20,20,24,.85)';c.stroke();
  c.fillStyle=col;c.font='900 72px "Arial Black",Arial,sans-serif';c.textAlign='center';c.textBaseline='middle';c.fillText(String(n),64,70);
  const t=new THREE.CanvasTexture(cv);t.anisotropy=4;if(THREE.sRGBEncoding)t.encoding=THREE.sRGBEncoding;return t;
}
function glowTex(){return canvasTex('glow',64,64,(c)=>{const g=c.createRadialGradient(32,32,0,32,32,32);g.addColorStop(0,'rgba(255,255,255,1)');g.addColorStop(.18,'rgba(255,255,255,.6)');g.addColorStop(.5,'rgba(255,255,255,.12)');g.addColorStop(1,'rgba(255,255,255,0)');c.fillStyle=g;c.fillRect(0,0,64,64)},{lin:1})}

/* =========================================================================
   DETAILS: per-car trim. Each returns a list of [material key, geometry].
   Coordinates: x = sideways (the car's right is -x), y = up, z = forward.
   ========================================================================= */
function dressCommon(S,add,o={}){
  const W=S.wheel,F=surfOf(S),lite=o.lite;
  // door shut lines and handles
  if(!lite&&S.doors){
    const K=S.k,wsZ=K.find(k=>k[7]==='w')[0],pz=K.filter(k=>k[7]==='p').map(k=>k[0]);
    const lines=[W.f-W.r-.22,...(S.doors>1?[pz[0]-.03]:[]),S.doors>1?W.b+W.r+.2:pz[0]-.06];
    const sec=z=>sectAt(S,z);
    lines.forEach(z=>{const s=sec(z);add('gap',decal(S,'side',[[z-.004,s.yb+.07],[z+.004,s.yb+.07],[z+.004,s.yh-.005],[z-.004,s.yh-.005]],{mirror:1,off:.0025,cell:.06}))});
    const hy=z=>{const s=sec(z);return s.yb+(s.yh-s.yb)*.9};
    [lines[0]-.32,...(S.doors>1?[lines[1]-.3]:[])].forEach(z=>{const y=hy(z);add('handle',decal(S,'side',rr(z-.085,y-.014,z+.085,y+.014,.012),{mirror:1,off:.005,cell:.05}))});
    // window line across the top of the door (sill line of the greenhouse already exists): rocker shadow line
  }
  // mirrors: a rounded housing on a short arm, near the A-pillar
  if(!o.noMirror&&!S.open){const K=S.k,wz=K.find(k=>k[7]==='w')[0]-.16,s=sectAt(S,wz),y=s.yh+.075,x=s.w-S.shoulder-.01;
    [-1,1].forEach(sd=>{const g=new(T().SphereGeometry)(.1,lite?8:16,lite?6:10);g.scale(.95,.6,.55);g.translate(sd*(x+.1),y,wz);add(o.mirrorMat||'paint',g);
      add('black',box(.14,.04,.07,sd*(x+.01),y-.04,wz+.01));
      if(!lite){const gl=new(T().CircleGeometry)(.082,14);gl.scale(1,.54,1);gl.rotateY(Math.PI);gl.translate(sd*(x+.1),y,wz-.052);add('mirror',gl);
        add('amber',box(.06,.01,.03,sd*(x+.15),y-.035,wz+.01))}})}
  // wheel-well liners (half cylinders inside the arches)
  if(!S.open)[W.f,W.b].forEach(z=>{const s=sectAt(S,z),R=W.r+(S.archGap||.075);[-1,1].forEach(sd=>{
    const g=new(T().CylinderGeometry)(R,R,W.tw+.14,lite?10:18,1,true,0,Math.PI);g.rotateZ(Math.PI/2);g.translate(sd*(s.ws-W.tw/2+.01),W.r+.02,z);add('well',g)})});
  // underbody tray so the car never looks hollow from low angles
  {const zb=F.zb+.25,zf=F.zf-.3,yb=Math.max(sectAt(S,0).yb,.12)+.01,hw=sectAt(S,0).ws*.9;add('under',box(hw*2,.02,zf-zb,0,yb,(zf+zb)/2))}
}

/* ---- the V8 fastback ---- */
function dressGT(S,add){
  const F=surfOf(S);
  // grille: a wide trapezoid in the nose, with honeycomb
  add('grille',decal(S,'front',ccw(rpoly([[-.5,.38],[.5,.38],[.58,.62],[-.58,.62]],.05)),{off:.003,uv:1,cell:.06}));
  add('black',decal(S,'front',ccw(rpoly([[-.54,.35],[.54,.35],[.62,.645],[-.62,.645]],.06)),{off:.0015,cell:.06}));
  // lower intakes + splitter
  add('grille',decal(S,'front',ccw(rpoly([[-.36,.21],[.36,.21],[.3,.3],[-.3,.3]],.03)),{off:.003,uv:1,cell:.06}));
  add('grille',decal(S,'front',ccw(rpoly([[.56,.22],[.82,.25],[.78,.42],[.62,.36]],.03)),{off:.003,uv:1,cell:.04,mirror:1}));
  add('black',decal(S,'front',ccw([[-.88,.17],[.88,.17],[.86,.2],[-.86,.2]]),{off:.004,cell:.08}));
  // headlights: slim angular housings in the top corners with three vertical light bars
  const hl=ccw(rpoly([[.48,.6],[.83,.62],[.88,.7],[.56,.7]],.02));
  add('lampIn',decal(S,'front',hl,{mirror:1,off:.003,cell:.025}));
  [[.6,.63],[.66,.635],[.72,.64]].forEach(([x,y])=>add('lightF',decal(S,'front',rr(x-.012,y,x+.012,y+.055,.008),{mirror:1,off:.006,cell:.02})));
  add('lens',decal(S,'front',circ(.8,.665,.022,12),{mirror:1,off:.006,cell:.02}));
  // hood: power dome + two vents
  add('vent',decal(S,'top',rr(.2,1.2,.33,1.55,.02),{mirror:1,off:.003,cell:.04,uv:1}));
  // side: rocker in black, a sculpted vent ahead of the rear wheel
  const W=S.wheel;
  // tail: three vertical bars each side in a dark panel, a black diffuser, quad pipes
  add('tailIn',decal(S,'rear',ccw(rpoly([[.4,.8],[.86,.8],[.84,.95],[.42,.95]],.03)),{mirror:1,off:.003,cell:.03}));
  [.5,.61,.72].forEach(x=>add('lightR',decal(S,'rear',rr(x-.035,.82,x+.035,.93,.012),{mirror:1,off:.006,cell:.02})));
  add('black',decal(S,'rear',ccw(rpoly([[-.36,.8],[.36,.8],[.36,.93],[-.36,.93]],.02)),{off:.002,cell:.04}));
  add('black',decal(S,'rear',ccw([[-.7,.22],[.7,.22],[.66,.38],[-.66,.38]]),{off:.003,cell:.06}));
  [[.36,.31],[.5,.31]].forEach(([x,y])=>{[-1,1].forEach(sd=>{const g=cyl(.045,.048,.2,16,sd*x,y,F.zb+.06,'z');add('metal',g);const d=cyl(.036,.036,.21,14,sd*x,y,F.zb+.055,'z');add('black',d)})});
  // ducktail lip
  add('black',decal(S,'top',ccw([[-.6,-2.3],[.6,-2.3],[.62,-2.25],[-.62,-2.25]]),{off:.004,cell:.06}));
}

/* ---- the mid-engine hypercar ---- */
function dressHatch(S,add){
  const F=surfOf(S),W=S.wheel;
  // headlights: thin swept slits at the top corners of the nose, each with an LED blade
  const hl=ccw(rpoly([[.5,.43],[.86,.465],[.9,.52],[.58,.5]],.018));
  add('lampIn',decal(S,'front',hl,{mirror:1,off:.003,cell:.022}));
  add('drl',decal(S,'front',ccw([[.54,.468],[.86,.49],[.87,.502],[.55,.48]]),{mirror:1,off:.006,cell:.018}));
  add('lens',decal(S,'front',circ(.74,.475,.018,12),{mirror:1,off:.006,cell:.018}));
  // two huge corner intakes and a centre duct, carbon splitter
  add('black',decal(S,'front',ccw(rpoly([[.36,.14],[.82,.16],[.78,.36],[.44,.3]],.04)),{mirror:1,off:.002,cell:.03}));
  add('grille',decal(S,'front',ccw(rpoly([[.4,.16],[.78,.18],[.75,.33],[.46,.28]],.035)),{mirror:1,off:.004,uv:1,cell:.03}));
  add('black',decal(S,'front',ccw(rpoly([[-.3,.17],[.3,.17],[.26,.27],[-.26,.27]],.03)),{off:.003,cell:.04}));
  add('carbon',decal(S,'front',ccw([[-.98,.115],[.98,.115],[.96,.15],[-.96,.15]]),{off:.006,uv:1,cell:.06}));
  // bonnet: two heat-extractor ducts
  add('gap',decal(S,'top',rr(.1,1.55,.36,1.98,.04),{mirror:1,off:.003,cell:.035}));
  add('grille',decal(S,'top',rr(.13,1.58,.33,1.95,.03),{mirror:1,off:.005,cell:.035,uv:1}));
  // side: big scoop ahead of the rear wheel feeding the engine, carbon sill
  const z0=W.b+W.r+.1,z1=W.b+W.r+.9;
  add('black',decal(S,'side',ccw(rpoly([[z0,.36],[z1,.52],[z1-.06,.7],[z0+.05,.62]],.05)),{mirror:1,off:.004,cell:.04}));
  add('grille',decal(S,'side',ccw(rpoly([[z0+.06,.4],[z1-.1,.53],[z1-.14,.66],[z0+.1,.6]],.04)),{mirror:1,off:.006,uv:1,cell:.035}));
  add('carbon',decal(S,'side',ccw([[W.f-W.r-.1,.17],[W.b+W.r+.1,.17],[W.b+W.r+.1,.25],[W.f-W.r-.1,.25]]),{mirror:1,off:.005,uv:1,cell:.06}));
  // engine cover: louvres across the hump
  add('gap',decal(S,'top',rr(-.46,-1.82,.46,-1.08,.04),{off:.003,cell:.04}));
  [-1.17,-1.31,-1.45,-1.59,-1.73].forEach(z=>add('carbon',decal(S,'top',rr(-.43,z-.035,.43,z+.035,.01),{off:.006,cell:.04,uv:1})));
  // tail: full-width light blade, dark panel, carbon diffuser with fins, twin centre exits
  add('tailIn',decal(S,'rear',ccw(rpoly([[-.9,.7],[.9,.7],[.88,.8],[-.88,.8]],.02)),{off:.003,cell:.03}));
  add('lightR',decal(S,'rear',ccw([[-.88,.735],[.88,.735],[.87,.755],[-.87,.755]]),{off:.006,cell:.025}));
  add('lightR',decal(S,'rear',ccw(rpoly([[.66,.71],[.88,.71],[.87,.79],[.7,.79]],.015)),{mirror:1,off:.0065,cell:.02}));
  add('black',decal(S,'rear',ccw(rpoly([[-.92,.36],[.92,.36],[.9,.66],[-.9,.66]],.03)),{off:.002,cell:.05}));
  add('carbon',decal(S,'rear',ccw([[-.86,.2],[.86,.2],[.82,.38],[-.82,.38]]),{off:.004,uv:1,cell:.05}));
  [-1,1].forEach(sd=>{add('metal',cyl(.055,.058,.18,18,sd*.11,.42,F.zb+.05,'z'));add('black',cyl(.045,.045,.19,14,sd*.11,.42,F.zb+.045,'z'))});
  // fixed rear wing on two swan-neck struts
  const wz=-1.98,wy=1.08;add('carbon',box(1.78,.028,.34,0,wy,wz,-.06));add('carbon',box(.02,.13,.36,-.89,wy-.02,wz));add('carbon',box(.02,.13,.36,.89,wy-.02,wz));
  [-1,1].forEach(sd=>add('black',box(.03,.18,.12,sd*.42,wy-.1,wz+.04,.25)));
}

/* ---- the super-SUV ---- */
function dressSUV(S,add){
  const F=surfOf(S),W=S.wheel;
  // big hexagonal grille in gloss black, honeycomb mesh
  add('black',decal(S,'front',ccw(rpoly([[-.5,.33],[.5,.33],[.6,.47],[.5,.6],[-.5,.6],[-.6,.47]],.04)),{off:.002,cell:.035}));
  add('grille',decal(S,'front',ccw(rpoly([[-.47,.355],[.47,.355],[.56,.47],[.47,.575],[-.47,.575],[-.56,.47]],.035)),{off:.004,uv:1,cell:.035}));
  // headlamps: sharp slits high in the corners with a Y-shaped LED signature
  const hl=ccw(rpoly([[.56,.68],[.92,.72],[.95,.8],[.6,.76]],.02));
  add('lampIn',decal(S,'front',hl,{mirror:1,off:.003,cell:.022}));
  add('drl',decal(S,'front',ccw([[.6,.725],[.9,.755],[.9,.77],[.6,.74]]),{mirror:1,off:.006,cell:.018}));
  add('drl',decal(S,'front',ccw([[.73,.748],[.76,.75],[.71,.69],[.68,.69]]),{mirror:1,off:.006,cell:.016}));
  add('lens',decal(S,'front',circ(.83,.758,.02,12),{mirror:1,off:.006,cell:.018}));
  // corner intakes (vertical blades) and a carbon splitter
  add('black',decal(S,'front',ccw(rpoly([[.66,.26],[.86,.28],[.86,.56],[.72,.52]],.03)),{mirror:1,off:.002,cell:.03}));
  add('grilleS',decal(S,'front',ccw(rpoly([[.68,.28],[.84,.3],[.84,.54],[.73,.5]],.025)),{mirror:1,off:.004,uv:1,cell:.03}));
  add('carbon',decal(S,'front',ccw([[-.86,.225],[.86,.225],[.84,.27],[-.84,.27]]),{off:.006,uv:1,cell:.06}));
  // bonnet: two raised creases (vents)
  add('vent',decal(S,'top',rr(.22,1.35,.32,1.95,.02),{mirror:1,off:.003,cell:.04,uv:1}));
  // side: gloss-black lower sill blade and a vent behind the front wheel
  add('black',decal(S,'side',ccw([[W.f-W.r-.12,.3],[W.b+W.r+.12,.3],[W.b+W.r+.12,.4],[W.f-W.r-.12,.4]]),{mirror:1,off:.004,cell:.06}));
  add('black',decal(S,'side',ccw(rpoly([[W.f-W.r-.24,.62],[W.f-W.r-.08,.6],[W.f-W.r-.1,.74],[W.f-W.r-.26,.76]],.01)),{mirror:1,off:.004,cell:.03}));
  // tail: thin full-width light bar plus Y-shaped lamps, gloss black diffuser, quad trapezoid pipes, roof spoiler
  add('tailIn',decal(S,'rear',ccw(rpoly([[-.92,1.0],[.92,1.0],[.9,1.1],[-.9,1.1]],.02)),{off:.003,cell:.03}));
  add('lightR',decal(S,'rear',ccw([[-.9,1.045],[.9,1.045],[.89,1.06],[-.89,1.06]]),{off:.006,cell:.025}));
  add('lightR',decal(S,'rear',ccw([[.66,1.01],[.9,1.03],[.9,1.05],[.7,1.03]]),{mirror:1,off:.0065,cell:.02}));
  add('lightR',decal(S,'rear',ccw([[.7,1.07],[.9,1.07],[.9,1.09],[.66,1.09]]),{mirror:1,off:.0065,cell:.02}));
  add('black',decal(S,'rear',ccw(rpoly([[-.9,.4],[.9,.4],[.88,.62],[-.88,.62]],.03)),{off:.002,cell:.06}));
  add('carbon',decal(S,'rear',ccw([[-.62,.42],[.62,.42],[.58,.52],[-.58,.52]]),{off:.004,uv:1,cell:.05}));
  [[.5,.47],[.66,.47]].forEach(([x,y])=>[-1,1].forEach(sd=>{add('metal',box(.13,.07,.16,sd*x,y,F.zb+.06));add('black',box(.11,.05,.17,sd*x,y,F.zb+.055))}));
  add('black',decal(S,'top',ccw([[-.6,-1.73],[.6,-1.73],[.6,-1.62],[-.6,-1.62]]),{off:.014,cell:.05}));
}

/* ---- the super saloon ---- */
function dressSaloon(S,add){
  const F=surfOf(S),W=S.wheel;
  // twin grilles (tall, side by side) with double slats
  [-1,1].forEach(sd=>{const g=ccw(rpoly([[sd*.03,.4],[sd*.24,.4],[sd*.26,.62],[sd*.05,.63]].map(p=>p),.05));
    add('chrome',decal(S,'front',ccw(rpoly([[sd*.02,.385],[sd*.255,.385],[sd*.275,.635],[sd*.04,.645]],.055)),{off:.002,cell:.03}));
    add('grilleS',decal(S,'front',g,{off:.004,uv:1,cell:.03}))});
  // angular headlamps with yellow L-shaped running lights
  const hl=ccw(rpoly([[.3,.56],[.8,.58],[.86,.68],[.34,.67]],.02));
  add('lampIn',decal(S,'front',hl,{mirror:1,off:.003,cell:.025}));
  add('drlY',decal(S,'front',ccw([[.38,.6],[.52,.605],[.52,.62],[.4,.617]]),{mirror:1,off:.006,cell:.02}));
  add('drlY',decal(S,'front',ccw([[.56,.607],[.76,.615],[.79,.655],[.77,.656],[.75,.632],[.56,.625]]),{mirror:1,off:.006,cell:.02}));
  add('lens',decal(S,'front',circ(.46,.645,.022,12),{mirror:1,off:.006,cell:.02}));
  add('lens',decal(S,'front',circ(.66,.65,.022,12),{mirror:1,off:.006,cell:.02}));
  // huge intakes, carbon splitter
  add('grille',decal(S,'front',ccw(rpoly([[-.3,.2],[.3,.2],[.26,.33],[-.26,.33]],.03)),{off:.003,uv:1,cell:.05}));
  add('grille',decal(S,'front',ccw(rpoly([[.4,.2],[.84,.24],[.82,.48],[.5,.4]],.04)),{mirror:1,off:.003,uv:1,cell:.04}));
  add('carbon',decal(S,'front',ccw([[-.9,.16],[.9,.16],[.88,.205],[-.88,.205]]),{off:.005,uv:1,cell:.06}));
  // hood: two vents (CS)
  add('vent',decal(S,'top',rr(.14,1.3,.3,1.62,.02),{mirror:1,off:.003,cell:.04,uv:1}));
  // side gill behind the front wheel
  add('black',decal(S,'side',ccw(rpoly([[W.f-W.r-.2,.6],[W.f-W.r-.06,.6],[W.f-W.r-.08,.66],[W.f-W.r-.2,.66]],.01)),{mirror:1,off:.004,cell:.03}));
  // L-shaped tail lamps, carbon diffuser, quad pipes, boot lip
  const tl=ccw([[.42,.82],[.88,.83],[.88,.95],[.78,.95],[.76,.9],[.44,.9]]);
  add('tailIn',decal(S,'rear',tl,{mirror:1,off:.003,cell:.025}));
  add('lightR',decal(S,'rear',ccw([[.46,.85],[.86,.86],[.86,.875],[.46,.865]]),{mirror:1,off:.006,cell:.02}));
  add('lightR',decal(S,'rear',ccw([[.8,.87],[.86,.87],[.86,.93],[.82,.93]]),{mirror:1,off:.006,cell:.02}));
  add('carbon',decal(S,'rear',ccw([[-.84,.24],[.84,.24],[.8,.38],[-.8,.38]]),{off:.003,uv:1,cell:.06}));
  [[.42,.3],[.56,.3]].forEach(([x,y])=>{[-1,1].forEach(sd=>{add('metal',cyl(.048,.05,.2,18,sd*x,y,F.zb+.06,'z'));add('black',cyl(.038,.038,.21,14,sd*x,y,F.zb+.055,'z'))})});
  add('carbon',decal(S,'top',ccw([[-.62,-2.36],[.62,-2.36],[.64,-2.3],[-.64,-2.3]]),{off:.006,uv:1,cell:.05}));
}

/* ---- traffic trim: cheap and quick (lights, grille, plates) ---- */
function dressTraffic(S,add,type){
  const F=surfOf(S),tip=F.zf,s=sectAt(S,tip-.08),yb=s.yb,yh=s.yh,ly=lerp(yb,yh,.72);
  const x=s.w;
  if(type==='bus'){
    add('lightF',decal(S,'front',ccw(rr(.72,.62,1.0,.74,.02)),{mirror:1,off:.004,cell:.06}));
    add('dark',decal(S,'front',ccw(rr(-.6,.55,.6,.85,.04)),{off:.003,cell:.08}));
    add('ind',decal(S,'front',ccw(rr(1.02,.62,1.1,.74,.01)),{mirror:1,off:.004,cell:.06}));
    add('lightR',decal(S,'rear',ccw(rr(.92,.7,1.08,1.1,.02)),{mirror:1,off:.004,cell:.06}));
    add('ind',decal(S,'rear',ccw(rr(.92,1.12,1.08,1.2,.01)),{mirror:1,off:.004,cell:.06}));
    add('dark',decal(S,'rear',ccw(rr(-1.1,.5,1.1,.62,.02)),{off:.003,cell:.1}));
    return;
  }
  if(type==='cab'){
    add('lightF',decal(S,'front',ccw(rr(.78,.82,1.02,.98,.03)),{mirror:1,off:.004,cell:.06}));
    add('ind',decal(S,'front',ccw(rr(1.04,.82,1.1,.98,.01)),{mirror:1,off:.004,cell:.06}));
    add('dark',decal(S,'front',ccw(rr(-.62,.72,.62,1.22,.04)),{off:.003,cell:.08}));
    return;
  }
  // headlamps + indicators
  const hl=ccw(rpoly([[x*.52,ly-.05],[x*.92,ly-.03],[x*.95,ly+.05],[x*.56,ly+.05]],.02));
  add('lightF',decal(S,'front',hl,{mirror:1,off:.004,cell:.05}));
  add('ind',decal(S,'front',ccw(rr(x*.92,ly-.06,x*1.02,ly-.02,.01)),{mirror:1,off:.006,cell:.05}));
  add('dark',decal(S,'front',ccw(rpoly([[-x*.45,ly-.08],[x*.45,ly-.08],[x*.48,ly+.04],[-x*.48,ly+.04]],.03)),{off:.003,cell:.06}));
  add('dark',decal(S,'front',ccw(rpoly([[-x*.6,yb+.05],[x*.6,yb+.05],[x*.55,yb+.15],[-x*.55,yb+.15]],.03)),{off:.003,cell:.08}));
  if(S.belt==='chrome')add('metal',decal(S,'front',ccw([[-x*.45,ly+.02],[x*.45,ly+.02],[x*.47,ly+.04],[-x*.47,ly+.04]]),{off:.005,cell:.06}));
  // tail lamps + indicators
  const sb=sectAt(S,F.zb+.08),xb=sb.w,lr=lerp(sb.yb,sb.yh,.78);
  add('lightR',decal(S,'rear',ccw(rpoly([[xb*.55,lr-.05],[xb*.94,lr-.05],[xb*.94,lr+.06],[xb*.6,lr+.06]],.02)),{mirror:1,off:.004,cell:.05}));
  add('ind',decal(S,'rear',ccw(rr(xb*.62,lr-.08,xb*.92,lr-.055,.008)),{mirror:1,off:.006,cell:.05}));
  add('dark',decal(S,'rear',ccw(rpoly([[-xb*.85,sb.yb+.06],[xb*.85,sb.yb+.06],[xb*.85,sb.yb+.18],[-xb*.85,sb.yb+.18]],.03)),{off:.003,cell:.08}));
  add('white',decal(S,'rear',ccw(rr(-.25,lr-.2,.25,lr-.08,.01)),{off:.005,cell:.08}));
  add('white',decal(S,'front',ccw(rr(-.25,yb+.17,.25,yb+.28,.01)),{off:.005,cell:.08}));
}

/* ---------- interior: dash, seats, a driver (right-hand drive), headliner ---------- */
function interior(S,add){
  const K=S.k,W=S.wheel,wz=K.find(k=>k[7]==='w')[0],rz=K.filter(k=>k[7]==='r'),rearZ=rz.length?rz[rz.length-1][0]:K[K.length-1][0];
  const lastR=(()=>{for(let i=K.length-1;i>=0;i--)if(K[i][7]==='r')return K[i+1][0];return rearZ})();
  const s0=sectAt(S,(wz+lastR)/2),yb=s0.yh-.12,hw=s0.w-S.shoulder-.06,front=wz-.15,back=lastR+.12;
  const cz=K.filter(k=>k[7]==='c'||k[7]==='p').map(k=>k[0]),rf=Math.max(...cz),rb=Math.min(...cz);
  let roofMin=9;for(let z=rf;z>=rb;z-=.05)roofMin=Math.min(roofMin,sectAt(S,z).yr);const room=roofMin-yb-.07;
  add('cabin',box(hw*2,.02,front-back,0,yb,(front+back)/2));                                        // floor at belt height
  add('cabin',box(hw*1.6,.13,.42,0,yb+.08,front-.16));                                                // dashboard
  const tall=Math.min(.42,room*.62),hr=Math.min(.15,room*.26);
  const seat=(x,z)=>{add('seat',box(.46,tall,.12,x,yb+tall/2,z,-.15));add('seat',box(.24,hr,.1,x,yb+tall+hr/2+.02,z-.03,-.1))};
  const fz=Math.min(rf-.25,(wz+back)/2+.25);seat(-.37,fz-.05);seat(.37,fz-.05);
  if(S.doors>1&&(fz-.9)>back+.1){add('seat',box(hw*1.7,tall*.85,.14,0,yb+tall*.42,fz-.95,-.18));[-.4,0,.4].forEach(x=>add('seat',box(.22,hr*.85,.09,x,yb+tall*.85+hr*.42,fz-.97,-.1)))}
  // steering wheel + driver on the right-hand side (-x)
  const tg=new(T().TorusGeometry)(.17,.022,8,20);tg.rotateX(-.35);tg.translate(-.37,yb+.15,front-.42);add('cabin',tg);
  const hy=Math.min(yb+.48,roofMin-.15);const head=new(T().SphereGeometry)(.1,12,10);head.scale(.9,1.08,1);head.translate(-.37,hy,fz+.04);add('skin',head);
  const hair=new(T().SphereGeometry)(.105,12,8,0,Math.PI*2,0,Math.PI*.55);hair.translate(-.37,hy+.02,fz+.02);add('hair',hair);
  add('shirt',box(.42,Math.min(.3,hy-yb-.1),.24,-.37,yb+Math.min(.3,hy-yb-.1)/2,fz+.04,-.15));
  // headliner just under the roof skin
  add('liner',box(s0.wr*1.7,.01,rf-rb,0,roofMin-.03,(rf+rb)/2));
}

/* ---------- plates ---------- */
function plates(S,plate,add){
  const F=surfOf(S),PT=plateTex(plate||'SLIP 01'),THREE=T();
  const mk=(kind,y)=>{const g=decal(S,kind,ccw(rr(-.26,y-.065,.26,y+.065,.012)),{off:.01,uv:1,cell:.06});
    const U=g.attributes.uv;for(let i=0;i<U.count;i++){U.setXY(i,(U.getX(i)*(kind==='rear'?-1:1)+.26)/.52,(U.getY(i)-(y-.065))/.13)}return g};
  const yF={gt:.28,hatch:.21,suv:.29,saloon:.27}[S.id]||.4,yR={gt:.58,hatch:.59,suv:.78,saloon:.58}[S.id]||.6;
  const mat=new THREE.MeshStandardMaterial({map:PT,roughness:.45,metalness:.1});
  return{mat,tex:PT,meshes:[new THREE.Mesh(mk('front',yF),mat),new THREE.Mesh(mk('rear',yR),mat)]};
}

/* =========================================================================
   MATERIALS
   ========================================================================= */
const SHARED={};
function lin(m){if(m.color&&!m.map&&!(m.userData&&m.userData.lin))m.color.convertSRGBToLinear();if(m.emissive)m.emissive.convertSRGBToLinear();m.userData.lin=1;return m}
function shared(){
  if(SHARED.glass)return SHARED;const THREE=T(),Std=THREE.MeshStandardMaterial,Phy=THREE.MeshPhysicalMaterial;
  const hexT=texHex();hexT.repeat.set(26,26);const slT=texSlat();slT.repeat.set(1,40);const cT=texCarbon();cT.repeat.set(26,26);
  Object.assign(SHARED,{
    glass:lin(new Phy({color:0x040608,metalness:0,roughness:.03,clearcoat:1,clearcoatRoughness:.03,transparent:true,opacity:.9,envMapIntensity:1.15,depthWrite:false})),
    glassT:lin(new Phy({color:0x111820,metalness:.2,roughness:.05,clearcoat:1,envMapIntensity:1.4})),
    under:lin(new Std({color:0x0e0f11,roughness:.85,vertexColors:true})),
    clad:lin(new Std({color:0x1a1b1e,roughness:.78,vertexColors:true})),
    black:lin(new Phy({color:0x0b0c0e,roughness:.18,metalness:.1,clearcoat:.8})),
    chrome:lin(new Std({color:0xf4f5f8,metalness:1,roughness:.06,envMapIntensity:1.4})),
    silver:lin(new Std({color:0xbfc4cb,metalness:.85,roughness:.32})),
    metal:lin(new Std({color:0xd8dbe0,metalness:1,roughness:.2})),
    grille:lin(new Std({color:0xffffff,map:hexT,roughness:.6,metalness:.3})),
    grilleS:lin(new Std({color:0xffffff,map:slT,roughness:.35,metalness:.6})),
    carbon:lin(new Phy({color:0xffffff,map:cT,roughness:.35,metalness:.3,clearcoat:1,clearcoatRoughness:.05})),
    vent:lin(new Std({color:0xffffff,map:slT,roughness:.5,metalness:.4})),
    gap:lin(new Std({color:0x050506,roughness:.9})),
    handle:lin(new Std({color:0x16171a,roughness:.3,metalness:.4})),
    lampIn:lin(new Std({color:0x2a2e35,metalness:.9,roughness:.18,envMapIntensity:1.5})),
    lens:lin(new Std({color:0xdfe6f0,metalness:1,roughness:.05,emissive:0xffffff,emissiveIntensity:.15})),
    tailIn:lin(new Phy({color:0x3a0508,roughness:.1,clearcoat:1,emissive:0x2a0003,emissiveIntensity:1})),
    amber:lin(new Std({color:0xff9a1f,emissive:0x8a4200,emissiveIntensity:.6,roughness:.3})),
    mirror:lin(new Std({color:0xaab4c2,metalness:1,roughness:.02})),
    well:lin(new Std({color:0x0c0c0d,roughness:.95,side:THREE.DoubleSide})),
    rubber:lin(new Std({color:0x141416,roughness:.88})),
    dark:lin(new Std({color:0x111214,roughness:.6})),
    disc:lin(new Std({color:0x8a8d92,metalness:.9,roughness:.45})),
    cabin:lin(new Std({color:0x141518,roughness:.85})),
    seat:lin(new Std({color:0x1c1d21,roughness:.75})),
    liner:lin(new Std({color:0x2a2b2e,roughness:.9,side:THREE.DoubleSide})),
    skin:lin(new Std({color:0xb07a58,roughness:.7})),hair:lin(new Std({color:0x16110e,roughness:.8})),shirt:lin(new Std({color:0x2b3442,roughness:.85})),
    flame:new THREE.MeshBasicMaterial({color:0x6fd8ff,transparent:true,opacity:.85,blending:THREE.AdditiveBlending,depthWrite:false})
  });
  SHARED.flame.color.convertSRGBToLinear();
  return SHARED;
}
const RIMCOL={gunmetal:[0x3a3d42,.8,.3],diamond:[0xd7dbe0,.95,.18],machined:[0xcfd3d8,.95,.22],bronze:[0x8a6a3a,.9,.3],silver:[0xc4c8ce,.9,.28],black:[0x141518,.6,.35]};
function carMats(S,paint,o={}){
  const THREE=T(),SH=shared(),pc=new THREE.Color(paint).convertSRGBToLinear(),hsl={};pc.getHSL(hsl);
  const P=new THREE.MeshPhysicalMaterial({color:pc,metalness:.5,roughness:.32,clearcoat:1,clearcoatRoughness:.04,envMapIntensity:1.2,vertexColors:true});
  const roofKind=S.roof==='contrast'?(hsl.l<.25?'white':'black'):S.roof;
  const roof=roofKind==='paint'?P:roofKind==='carbon'?SH.carbon:roofKind==='white'?lin(new THREE.MeshPhysicalMaterial({color:0xf1f1ee,roughness:.3,clearcoat:1,vertexColors:true})):SH.black;
  const rc=RIMCOL[(S.wheel&&S.wheel.rimCol)||'silver'];
  const M={paint:P,roof,pillar:S.pillars==='black'?SH.black:P,belt:S.belt==='chrome'?SH.chrome:SH.black,
    rim:lin(new THREE.MeshStandardMaterial({color:rc[0],metalness:rc[1],roughness:rc[2],envMapIntensity:1.3})),
    caliper:lin(new THREE.MeshStandardMaterial({color:S.wheel.caliper==='red'?0xc81e24:/^#/.test(S.wheel.caliper||'')?S.wheel.caliper:0x55585e,roughness:.4,metalness:.2})),
    lightF:lin(new THREE.MeshStandardMaterial({color:0xffffff,emissive:0xfff4e0,emissiveIntensity:1.6,roughness:.2})),
    drl:lin(new THREE.MeshStandardMaterial({color:0xffffff,emissive:0xf2f6ff,emissiveIntensity:2.2,roughness:.2})),
    drlY:lin(new THREE.MeshStandardMaterial({color:0xffe08a,emissive:0xffc93c,emissiveIntensity:2.2,roughness:.2})),
    lightR:lin(new THREE.MeshStandardMaterial({color:0x8a0010,emissive:0xff1a2a,emissiveIntensity:1.3,roughness:.25}))};
  // race liveries (Overdrive): a second paint, LED accent strips, helmet, number
  M.acc=o.acc?new THREE.MeshPhysicalMaterial({color:new THREE.Color(o.acc).convertSRGBToLinear(),metalness:.35,roughness:.3,clearcoat:1,clearcoatRoughness:.05,envMapIntensity:1.1}):P;
  M.neon=lin(new THREE.MeshStandardMaterial({color:0x0b0b0d,emissive:o.neon||'#9fe8ff',emissiveIntensity:2.4,roughness:.3}));
  M.helmet=new THREE.MeshPhysicalMaterial({color:new THREE.Color(o.helmet||o.acc||paint).convertSRGBToLinear(),roughness:.25,clearcoat:1,metalness:.2});
  M.visor=lin(new THREE.MeshStandardMaterial({color:0x101418,metalness:.9,roughness:.05,envMapIntensity:1.6}));
  if(o.num!=null){const t=numTex(o.num,o.numCol||'#111318');M.num=new THREE.MeshStandardMaterial({map:t,transparent:true,roughness:.35,metalness:0,polygonOffset:true,polygonOffsetFactor:-2});M.num.userData.tex=t}
  return Object.assign({},SH,M);
}

/* =========================================================================
   PLAYER / RIVAL CAR (full detail, separate moving parts)
   ========================================================================= */
const DRESS={gt:dressGT,hatch:dressHatch,suv:dressSUV,saloon:dressSaloon};
/* ---- OVERDRIVE race cars ---- */
// a thin bar from a to b ([x,y,z]), for wishbones and struts
function bar(a,b,t=.028){const THREE=T(),d=new THREE.Vector3(b[0]-a[0],b[1]-a[1],b[2]-a[2]),L=d.length(),g=new THREE.BoxGeometry(t,t*.7,L);
  g.applyMatrix4(new THREE.Matrix4().lookAt(new THREE.Vector3(),d,new THREE.Vector3(0,1,0)));g.translate((a[0]+b[0])/2,(a[1]+b[1])/2,(a[2]+b[2])/2);return g}
// a swept fin: low leading edge, rising to a raked trailing edge; t thick, centred on x
function fin(x,z0,z1,yb,h,t=.012){const THREE=T(),sh=new THREE.Shape();sh.moveTo(z0,yb);sh.lineTo(z1,yb);sh.lineTo(z1+.06,yb+h);sh.quadraticCurveTo(z1+(z0-z1)*.45,yb+h*.92,z0,yb);
  const g=new THREE.ExtrudeGeometry(sh,{depth:t,bevelEnabled:false,curveSegments:10});g.rotateY(-Math.PI/2);g.translate(x+t/2,0,0);return g}
function dressODF1(S,add){
  const F=surfOf(S),W=S.wheel,tr=W.track;
  // cockpit opening, driver's helmet and visor, the halo
  add('gap',decal(S,'top',rr(-.21,-.22,.21,.58,.08),{off:.006,cell:.04}));
  {const h=new(T().SphereGeometry)(.135,20,14);h.scale(1,1.05,1.12);h.translate(0,.7,.08);add('helmet',h);
   const v=new(T().SphereGeometry)(.137,20,8,-Math.PI*.36,Math.PI*.72,Math.PI*.38,Math.PI*.2);v.scale(1,1.05,1.12);v.translate(0,.7,.08);add('visor',v)}
  {const g=new(T().TorusGeometry)(.32,.024,8,28,Math.PI);g.rotateX(-Math.PI/2);g.scale(.95,1,1.15);g.translate(0,.84,.2);add('black',g);add('black',bar([0,.84,.56],[0,.6,.74],.05))}
  // airbox over the driver's head and a shark fin down the engine cover
  add('paint',box(.3,.3,.75,0,.86,-.62));add('gap',box(.2,.15,.03,0,.92,-.235));add('acc',box(.31,.06,.76,0,1.03,-.62));
  add('paint',box(.014,.3,1.05,0,.82,-1.55,-.12));
  // sidepod intakes
  [-1,1].forEach(sd=>{add('gap',box(.2,.24,.04,sd*.6,.38,.2));add('black',box(.04,.42,.5,sd*.79,.36,.1))});
  // front wing: main plane, two flaps, endplates, pylons to the nose
  const fz=2.42;add('black',box(1.9,.022,.42,0,.085,fz));add('acc',box(1.86,.018,.18,0,.13,fz-.1,.25));add('acc',box(1.82,.016,.14,0,.17,fz-.18,.42));
  [-1,1].forEach(sd=>{add('acc',box(.02,.2,.55,sd*.95,.15,fz-.02));add('black',box(.03,.12,.12,sd*.11,.17,fz+.05))});
  // rear wing: main plane, DRS flap, endplates, beam wing, central pylon
  const rz=-2.38;add('black',box(.96,.035,.3,0,.95,rz,-.1));add('acc',box(.94,.025,.18,0,1.04,rz-.07,-.5));
  [-1,1].forEach(sd=>add('acc',box(.02,.45,.62,sd*.49,.86,rz+.02)));add('black',box(.9,.03,.18,0,.42,rz+.1));add('black',box(.05,.5,.1,0,.68,rz+.12));
  // suspension: upper and lower wishbones and a push rod to each wheel
  [[W.f,1],[W.b,0]].forEach(([z,fr])=>[-1,1].forEach(sd=>{const x0=sd*(fr?.26:.42),x1=sd*(tr-.13);
    add('black',bar([x0,.42,z+.18],[x1,.48,z]));add('black',bar([x0,.42,z-.18],[x1,.48,z]));
    add('black',bar([x0,.25,z+.2],[x1,.22,z]));add('black',bar([x0,.25,z-.2],[x1,.22,z]));add('black',bar([x0*.8,.5,z],[x1,.24,z],.022))}));
  // floor with sidewalls, diffuser, rain light
  add('carbon',box(1.3,.02,2.6,0,.06,-.55));add('carbon',decal(S,'rear',ccw([[-.3,.18],[.3,.18],[.26,.3],[-.26,.3]]),{off:.004,uv:1,cell:.04}));
  add('lightR',box(.08,.05,.02,0,.36,F.zb-.02));
  // livery: the nose and engine cover in the second colour
  add('acc',decal(S,'top',ccw([[-.15,2.62],[.15,2.62],[.24,1.3],[-.24,1.3]]),{off:.004,cell:.04}));
  add('acc',decal(S,'side',ccw([[-.3,.3],[-1.6,.3],[-1.6,.42],[-.3,.5]]),{mirror:1,off:.004,cell:.05}));
}
function raceCommon(S,add,o){const F=surfOf(S),W=S.wheel;
  // race kit every closed car shares: carbon splitter lip, tow hook, side skirts
  add('carbon',decal(S,'front',ccw([[-.96,o.splitY],[.96,o.splitY],[.94,o.splitY+.035],[-.94,o.splitY+.035]]),{off:.006,uv:1,cell:.05}));
  add('acc',box(.06,.03,.08,.45,o.splitY+.08,F.zf+.02));
  add('carbon',decal(S,'side',ccw([[W.f-W.r-.12,.14],[W.b+W.r+.12,.14],[W.b+W.r+.12,.2],[W.f-W.r-.12,.2]]),{mirror:1,off:.005,uv:1,cell:.06}));
}
function dressODSuper(S,add){
  const F=surfOf(S),W=S.wheel;raceCommon(S,add,{splitY:.1});
  add('lampIn',decal(S,'front',ccw(rpoly([[.5,.36],[.88,.4],[.92,.46],[.6,.44]],.015)),{mirror:1,off:.003,cell:.022}));
  add('neon',decal(S,'front',ccw([[.56,.395],[.86,.42],[.87,.432],[.57,.407]]),{mirror:1,off:.006,cell:.018}));
  add('gap',decal(S,'front',ccw(rpoly([[.3,.13],[.84,.15],[.8,.31],[.38,.27]],.03)),{mirror:1,off:.002,cell:.03}));
  add('grille',decal(S,'front',ccw(rpoly([[.34,.15],[.8,.17],[.77,.29],[.41,.25]],.025)),{mirror:1,off:.004,uv:1,cell:.03}));
  add('gap',decal(S,'front',ccw(rpoly([[-.24,.15],[.24,.15],[.2,.24],[-.2,.24]],.02)),{off:.003,cell:.03}));
  // twin racing stripes over the bonnet and the engine cover
  [[2.33,1.0],[-1.05,-2.34]].forEach(([a,b])=>add('acc',decal(S,'top',ccw([[.1,a],[.27,a],[.27,b],[.1,b]]),{mirror:1,off:.005,cell:.04})));
  // flank: scoop behind the door, LED line along the sill
  const z0=W.b+W.r+.12,z1=W.b+W.r+.85;
  add('gap',decal(S,'side',ccw(rpoly([[z0,.34],[z1,.5],[z1-.08,.66],[z0+.06,.58]],.04)),{mirror:1,off:.004,cell:.035}));
  add('neon',decal(S,'side',ccw([[W.f-W.r-.08,.215],[W.b+W.r+.08,.215],[W.b+W.r+.08,.228],[W.f-W.r-.08,.228]]),{mirror:1,off:.007,cell:.05}));
  // tail: hexagon lamps, gloss panel, diffuser, four centre pipes, ducktail
  add('black',decal(S,'rear',ccw(rpoly([[-.92,.4],[.92,.4],[.9,.74],[-.9,.74]],.03)),{off:.002,cell:.05}));
  [.5,.7].forEach(x=>{add('tailIn',decal(S,'rear',circ(x,.64,.075,6),{mirror:1,off:.004,cell:.02}));add('lightR',decal(S,'rear',circ(x,.64,.05,6),{mirror:1,off:.007,cell:.02}))});
  add('carbon',decal(S,'rear',ccw([[-.86,.18],[.86,.18],[.82,.38],[-.82,.38]]),{off:.004,uv:1,cell:.05}));
  [.08,.22].forEach(x=>[-1,1].forEach(sd=>{add('metal',cyl(.05,.052,.16,6,sd*x,.36,F.zb+.05,'z'));add('black',cyl(.04,.04,.17,6,sd*x,.36,F.zb+.045,'z'))}));
  add('carbon',box(1.7,.025,.22,0,.9,-2.2,.18));
}
function dressODSpecter(S,add){
  const F=surfOf(S),W=S.wheel;raceCommon(S,add,{splitY:.085});
  add('carbon',box(1.94,.025,.24,0,.1,F.zf-.04));
  [-1,1].forEach(sd=>{add('carbon',box(.3,.012,.14,sd*.82,.3,F.zf-.12,0,0,sd*.25));add('carbon',box(.24,.012,.12,sd*.84,.38,F.zf-.16,0,0,sd*.3))});
  // round-cornered lamps with a ring light, a wide mouth
  add('lampIn',decal(S,'front',ccw(rpoly([[.56,.5],[.88,.52],[.9,.62],[.6,.6]],.05)),{mirror:1,off:.003,cell:.022}));
  add('neon',decal(S,'front',circ(.74,.56,.04,16),{mirror:1,off:.006,cell:.018}));
  add('gap',decal(S,'front',ccw(rpoly([[-.66,.14],[.66,.14],[.62,.36],[-.62,.36]],.05)),{off:.002,cell:.03}));
  add('grille',decal(S,'front',ccw(rpoly([[-.62,.16],[.62,.16],[.58,.34],[-.58,.34]],.04)),{off:.004,uv:1,cell:.03}));
  // fender louvres over the front wheels, roof scoop
  add('gap',decal(S,'top',rr(.56,1.12,.84,1.7,.03),{mirror:1,off:.003,cell:.035}));
  [1.2,1.32,1.44,1.56].forEach(z=>add('carbon',decal(S,'top',rr(.57,z-.025,.83,z+.025,.008),{mirror:1,off:.006,cell:.035,uv:1})));
  add('black',box(.32,.09,.42,0,1.27,-.42));add('gap',box(.26,.06,.02,0,1.28,-.2));
  // livery: a swept stripe down each flank, side exit exhaust
  add('acc',decal(S,'side',ccw([[1.3,.2],[.7,.2],[-.9,.62],[-.3,.62]]),{mirror:1,off:.005,cell:.05}));
  add('neon',decal(S,'side',ccw([[1.36,.2],[1.3,.2],[-.3,.62],[-.24,.62]]),{mirror:1,off:.007,cell:.05}));
  [-1,1].forEach(sd=>{add('metal',cyl(.05,.055,.18,14,sd*1.0,.22,W.b+W.r+.2,'x'));add('black',cyl(.04,.04,.19,12,sd*1.005,.22,W.b+W.r+.2,'x'))});
  // tail: slim lamp strips, big diffuser, swan-neck wing
  add('black',decal(S,'rear',ccw(rpoly([[-.9,.66],[.9,.66],[.88,.9],[-.88,.9]],.03)),{off:.002,cell:.05}));
  add('lightR',decal(S,'rear',ccw(rpoly([[.52,.8],[.88,.81],[.87,.86],[.53,.85]],.01)),{mirror:1,off:.006,cell:.02}));
  add('carbon',decal(S,'rear',ccw([[-.9,.16],[.9,.16],[.86,.44],[-.86,.44]]),{off:.004,uv:1,cell:.05}));
  const wz=-2.12,wy=1.3;add('carbon',box(1.94,.032,.36,0,wy,wz,-.08));add('carbon',box(1.9,.02,.14,0,wy+.07,wz-.15,-.45));
  [-1,1].forEach(sd=>{add('carbon',box(.02,.3,.56,sd*.98,wy-.02,wz-.02));add('black',bar([sd*.38,.96,-2.26],[sd*.38,wy,wz+.05],.04))});
}
function dressODSentinel(S,add){
  const F=surfOf(S),W=S.wheel;raceCommon(S,add,{splitY:.11});
  // horseshoe grille with a bright surround, quad LED lamps
  add('metal',decal(S,'front',ccw(rpoly([[-.26,.13],[.26,.13],[.28,.42],[.19,.51],[-.19,.51],[-.28,.42]],.06)),{off:.002,cell:.025}));
  add('grille',decal(S,'front',ccw(rpoly([[-.23,.15],[.23,.15],[.25,.41],[.17,.48],[-.17,.48],[-.25,.41]],.05)),{off:.004,uv:1,cell:.025}));
  add('lampIn',decal(S,'front',ccw(rpoly([[.5,.46],[.9,.5],[.92,.58],[.54,.55]],.02)),{mirror:1,off:.003,cell:.022}));
  [.6,.68,.76,.84].forEach(x=>add('drl',decal(S,'front',rr(x-.025,.5+(x-.6)*.08,x+.025,.53+(x-.6)*.08,.008),{mirror:1,off:.006,cell:.016})));
  add('gap',decal(S,'front',ccw(rpoly([[.4,.15],[.86,.17],[.84,.38],[.46,.3]],.04)),{mirror:1,off:.002,cell:.03}));
  // two-tone: the darker panel colour below the crease, an LED "C" sweeping round each door
  add('acc',decal(S,'side',ccw([[2.1,.14],[-2.1,.14],[-2.1,.4],[2.1,.4]]),{mirror:1,off:.003,cell:.05}));
  {const P=[],cz=-.25,cy=.52,ra=.82,rb=.3,t=.028;for(let i=0;i<=18;i++){const a=Math.PI*.5+i/18*Math.PI;P.push([cz+Math.cos(a)*-ra,cy+Math.sin(a)*rb])}
   const In=[];for(let i=18;i>=0;i--){const a=Math.PI*.5+i/18*Math.PI;In.push([cz+Math.cos(a)*-(ra-t),cy+Math.sin(a)*(rb-t)])}
   add('neon',decal(S,'side',ccw([...P,...In]),{mirror:1,off:.007,cell:.04}))}
  // tail: full-width LED bar, quad square pipes, diffuser, flush spoiler
  add('black',decal(S,'rear',ccw(rpoly([[-.9,.46],[.9,.46],[.88,.86],[-.88,.86]],.03)),{off:.002,cell:.05}));
  add('lightR',decal(S,'rear',ccw([[-.86,.78],[.86,.78],[.85,.81],[-.85,.81]]),{off:.006,cell:.025}));
  add('neon',decal(S,'rear',ccw([[-.86,.83],[.86,.83],[.85,.842],[-.85,.842]]),{off:.006,cell:.025}));
  add('carbon',decal(S,'rear',ccw([[-.84,.18],[.84,.18],[.8,.44],[-.8,.44]]),{off:.004,uv:1,cell:.05}));
  [.07,.2].forEach(x=>[-1,1].forEach(sd=>{add('metal',box(.1,.09,.16,sd*x,.38,F.zb+.06));add('black',box(.08,.07,.17,sd*x,.38,F.zb+.055))}));
  add('carbon',decal(S,'top',ccw([[-.62,-1.95],[.62,-1.95],[.62,-1.75],[-.62,-1.75]]),{off:.008,uv:1,cell:.05}));
}
function dressODAero(S,add){
  const F=surfOf(S),W=S.wheel;raceCommon(S,add,{splitY:.08});
  // small lamp clusters high on the fenders, huge venturi intakes, gold nose blade
  add('lampIn',decal(S,'front',ccw(rpoly([[.64,.36],[.9,.39],[.92,.46],[.68,.44]],.02)),{mirror:1,off:.003,cell:.02}));
  add('neon',decal(S,'front',ccw([[.68,.4],[.89,.42],[.89,.432],[.68,.412]]),{mirror:1,off:.006,cell:.016}));
  add('gap',decal(S,'front',ccw(rpoly([[.18,.1],[.86,.12],[.84,.32],[.24,.26]],.05)),{mirror:1,off:.002,cell:.03}));
  add('grille',decal(S,'front',ccw(rpoly([[.22,.12],[.82,.14],[.8,.3],[.27,.25]],.04)),{mirror:1,off:.004,uv:1,cell:.03}));
  add('acc',decal(S,'top',ccw([[-.09,2.44],[.09,2.44],[.13,1.2],[-.13,1.2]]),{off:.005,cell:.04}));
  // panels: dark carbon lower body
  add('carbon',decal(S,'side',ccw([[2.3,.12],[-2.3,.12],[-2.3,.32],[2.3,.32]]),{mirror:1,off:.003,uv:1,cell:.05}));
  // the three fins: a central shark fin over the engine, and one above each rear wheel
  add('acc',fin(0,-.8,-2.3,.9,.26,.014));
  [-1,1].forEach(sd=>add('acc',fin(sd*.72,W.b+.55,W.b-.6,.8,.16,.012)));
  // tail: a thin light blade, gold LED strip, huge diffuser, single central pipe, wing between the fins
  add('black',decal(S,'rear',ccw(rpoly([[-.9,.4],[.9,.4],[.88,.68],[-.88,.68]],.03)),{off:.002,cell:.05}));
  add('lightR',decal(S,'rear',ccw([[-.86,.6],[.86,.6],[.85,.625],[-.85,.625]]),{off:.006,cell:.025}));
  add('neon',decal(S,'rear',ccw([[-.86,.645],[.86,.645],[.85,.656],[-.85,.656]]),{off:.006,cell:.025}));
  add('carbon',decal(S,'rear',ccw([[-.88,.14],[.88,.14],[.84,.4],[-.84,.4]]),{off:.004,uv:1,cell:.05}));
  add('metal',cyl(.07,.072,.16,18,0,.55,F.zb+.05,'z'));add('black',cyl(.058,.058,.17,16,0,.55,F.zb+.045,'z'));
  add('carbon',box(1.46,.03,.3,0,.98,-2.28,-.08));
}
Object.assign(DRESS,{odF1:dressODF1,odSuper:dressODSuper,odSpecter:dressODSpecter,odSentinel:dressODSentinel,odAero:dressODAero});
const PLAYER_GEO={};   // the static geometry of each style is built once and reused
function playerGeo(style){
  if(PLAYER_GEO[style])return PLAYER_GEO[style];
  const S=SHAPES[style];S.id=style;const parts={};const add=(k,g)=>{if(!g)return;(parts[k]=parts[k]||[]).push(g)};
  const bg=body(S,{ds:.045});
  dressCommon(S,add,{mirrorMat:S.mirror||(S.id==='saloon'||S.id==='hatch'||S.id==='suv'?'black':'paint')});(DRESS[style]||(()=>{}))(S,add);if(!S.noInterior)interior(S,add);
  // race number on the bonnet (reads the right way round from the chase camera)
  if(S.numAt){const[x0,z0,x1,z1]=S.numAt,g=decal(S,'top',ccw(rr(x0,z0,x1,z1,.01)),{off:.009,uv:1,cell:.05}),U=g.attributes.uv,Pp=g.attributes.position;
    for(let i=0;i<U.count;i++)U.setXY(i,(x1-Pp.getX(i))/(x1-x0),(Pp.getZ(i)-z0)/(z1-z0));add('num',g)}
  // roof rails
  if(S.rails){const a=sectAt(S,.0),z0=S.k.find(k=>k[7]==='c')[0]-.05,z1=S.k.filter(k=>k[7]==='r')[0][0]+.1;[-1,1].forEach(sd=>{add('silver',box(.035,.04,z0-z1,sd*a.wr*.8,a.yr+.06,(z0+z1)/2));[z0-.04,z1+.04,(z0+z1)/2].forEach(z=>add('black',box(.045,.07,.07,sd*a.wr*.8,a.yr+.025,z)))})}
  const merged={};for(const k in parts){const m=merge(parts[k]);if(m)merged[k]=m}
  return PLAYER_GEO[style]={body:bg,parts:merged};
}
function player(style,paint,plate,o={}){
  const THREE=T();if(!SHAPES[style]||!DRESS[style])style='gt';const S=SHAPES[style];S.id=style;
  const M=carMats(S,paint,o),W=S.wheel,G=playerGeo(style);
  const root=new THREE.Group(),bodyG=new THREE.Group();root.add(bodyG);
  const shell=new THREE.Mesh(G.body,MK.map(k=>M[k==='glass'?'glass':k]));shell.castShadow=true;bodyG.add(shell);
  const meshes={};for(const k in G.parts){if(k==='num'&&!M.num)continue;const m=new THREE.Mesh(G.parts[k],M[k]||M.dark);m.castShadow=!/glass|cabin|seat|skin|hair|shirt|liner|light|drl|lens/.test(k);bodyG.add(m);meshes[k]=m}
  const pl=S.noPlate?{meshes:[],tex:null,mat:null}:plates(S,plate,null);pl.meshes.forEach(m=>bodyG.add(m));
  const F=surfOf(S);
  // wheels: steer group > spin group
  const wheels=[],wp=wheelParts(W.r,W.tw,W.rim,false),wg={};for(const k in wp){const m=merge(wp[k]);if(m)wg[k]=m}
  [[W.f,1],[W.b,0]].forEach(([z,front])=>[-1,1].forEach(sd=>{
    const s=sectAt(S,z),steer=new THREE.Group(),spin=new THREE.Group();steer.position.set(sd*(W.track!=null?W.track:s.ws-W.tw/2+.015),W.r,z);steer.add(spin);
    if(sd<0)steer.scale.x=-1;   // mirror so the rim faces outward
    for(const k of['rubber','rim','dark','disc']){if(!wg[k])continue;const m=new THREE.Mesh(wg[k],M[k]);m.castShadow=k==='rubber';spin.add(m)}
    if(wg.caliper)steer.add(new THREE.Mesh(wg.caliper,M.caliper));
    root.add(steer);wheels.push({steer,spin,front,r:W.r});
  }));
  // light glows (camera-facing, additive): bright at night, tail glow brightens when braking
  const glow=glowTex(),gF=new THREE.SpriteMaterial({map:glow,color:0xfff2dc,blending:THREE.AdditiveBlending,depthWrite:false,transparent:true,opacity:0}),
    gR=new THREE.SpriteMaterial({map:glow,color:0xff2030,blending:THREE.AdditiveBlending,depthWrite:false,transparent:true,opacity:.0});
  const LP=S.lamp||{hl:[{gt:.7,hatch:.72,suv:.78,saloon:.6}[style],{gt:.66,hatch:.47,suv:.75,saloon:.63}[style]],tl:[.66,{gt:.87,hatch:.745,suv:1.05,saloon:.88}[style]]};
  const glows=new THREE.Group();[-1,1].forEach(sd=>{if(LP.hl){const a=new THREE.Sprite(gF);a.position.set(sd*LP.hl[0],LP.hl[1]-.02,F.zf+.1);a.scale.set(.6,.6,1);glows.add(a)}
    if(LP.tl&&(LP.tl[0]||sd>0)){const b=new THREE.Sprite(gR);b.position.set(sd*LP.tl[0],LP.tl[1],F.zb-.05);b.scale.set(.7,.7,1);glows.add(b)}});bodyG.add(glows);
  // nitro flames from the exhausts (or under the bumper when the pipes are hidden)
  const ex=(LP.ex||{gt:[[.36,.31],[.5,.31]],saloon:[[.42,.3],[.56,.3]],hatch:[[.11,.42]],suv:[[.5,.47],[.66,.47]]}[style]).flatMap(([x,y])=>x?[[-x,y],[x,y]]:[[0,y]]);
  const flames=new THREE.Group();ex.forEach(([x,y])=>{const f=new THREE.Mesh(new THREE.ConeGeometry(.055,.5,10,1,true),M.flame);f.rotation.x=-Math.PI/2;f.position.set(x,y,F.zb-.28);flames.add(f)});
  flames.visible=false;bodyG.add(flames);
  let night=false,brake=false;
  const upd=()=>{M.lightF.emissiveIntensity=night?4:1.6;M.lightR.emissiveIntensity=brake?5:night?2.4:1.3;M.tailIn.emissiveIntensity=1;gF.opacity=night?.85:0;gR.opacity=brake?(night?.95:.5):night?.4:0};upd();
  return{root,body:bodyG,wheels,len:S.len,style,
    setBrake(b){if(b!==brake){brake=b;upd()}},
    setNight(n){night=!!n;upd()},
    setBoost(on,t){flames.visible=on;if(on)flames.children.forEach((f,i)=>{const s=.75+.45*Math.sin(t*47+i*2)+Math.random()*.25;f.scale.set(1,s,1);f.position.z=F.zb-.1-.25*s})},
    paint:M.paint,
    dispose(){if(pl.tex){pl.tex.dispose();pl.mat.dispose()}if(M.num){M.num.userData.tex.dispose();M.num.dispose()}[M.paint,M.rim,M.caliper,M.lightF,M.lightR,M.drl,M.drlY,M.neon,M.helmet,M.visor,gF,gR].forEach(m=>m.dispose());if(M.acc!==M.paint)M.acc.dispose();if(M.roof!==M.paint&&!Object.values(SHARED).includes(M.roof))M.roof.dispose();
      flames.children.forEach(f=>f.geometry.dispose());for(const k in wg)wg[k].dispose()}};
}

/* =========================================================================
   TRAFFIC: one set of geometries per type, split by material (for instancing)
   keys: paint, glass, dark, rubber, metal, white, lightF, lightR, ind, rim
   ========================================================================= */
const TRAFFIC={};
function traffic(type){
  if(TRAFFIC[type])return TRAFFIC[type];
  const out={};const add=(k,g)=>{if(!g)return;const map={under:'dark',clad:'dark',black:'dark',grille:'dark',grilleS:'dark',vent:'dark',gap:'dark',handle:'dark',well:'dark',lampIn:'dark',tailIn:'lightR',chrome:'metal',silver:'metal',roof:'paint',pillar:'dark',belt:'dark',amber:'ind',mirror:'metal',disc:'metal',caliper:'dark'};k=map[k]||k;(out[k]=out[k]||[]).push(g)};
  const addBody=(S,dz=0,o={})=>{
    S.id=S.id||type;const g=body(S,{ds:o.ds||.12});if(dz)g.translate(0,0,dz);
    MK.forEach((k,m)=>{const q=groupGeo(g,m);if(!q)return;const key=k==='paint'||k==='roof'?'paint':k==='glass'?'glass':k==='belt'&&S.belt==='chrome'?'metal':k==='pillar'&&S.pillars!=='black'?'paint':'dark';add(key,q)});
    const parts=[];dressTraffic(S,(k,q)=>parts.push([k,q]),o.kind||type);
    if(o.kind!=='cab')dressCommon(S,(k,q)=>parts.push([k,q]),{lite:1,noMirror:o.kind==='bus'});
    parts.forEach(([k,q])=>{if(dz)q.translate(0,0,dz);add(k,q)});
    g.dispose();
  };
  const wheelsAt=(r,tw,axles,ws,rim,dual)=>{
    const wp=wheelParts(r,tw,rim,true);
    axles.forEach(z=>[-1,1].forEach(sd=>{
      (dual?[0,-tw*1.04]:[0]).forEach((o,i)=>{const x=sd*(ws-tw/2+.02+o);
        for(const k in wp)wp[k].forEach(q=>{if(i>0&&k!=='rubber')return;const c=q.clone();if(sd<0)c.scale(-1,1,1);c.translate(x,r,z);
          if(sd<0){const idx=c.index;if(idx){const a=Array.from(idx.array);for(let t=0;t<a.length;t+=3){const s=a[t+1];a[t+1]=a[t+2];a[t+2]=s}c.setIndex(a)}else{const p=c.attributes.position.array,nn=c.attributes.normal.array;for(let t=0;t<p.length;t+=9)for(let j=0;j<3;j++){const s1=p[t+3+j];p[t+3+j]=p[t+6+j];p[t+6+j]=s1;const s2=nn[t+3+j];nn[t+3+j]=nn[t+6+j];nn[t+6+j]=s2}}}
          add(k==='rubber'?'rubber':k==='rim'?'rim':'dark',c)})})}));
    for(const k in wp)wp[k].forEach(q=>q.dispose());
  };
  let len;
  if(type==='truck'){
    // cab up front, a tall painted cargo body behind (Indian-highway style: bright paint, a bumper and mud flaps)
    const C=SHAPES.truckCab;C.id='cab';len=9.8;
    addBody(C,len/2-1.2,{ds:.14,kind:'cab'});
    const cz=len/2-2.45-3.5;
    add('paint',box(2.5,2.6,7.0,0,2.2,cz));add('white',box(2.52,.1,7.02,0,3.46,cz));add('white',box(2.52,.1,7.02,0,1.0,cz));
    add('dark',box(2.3,.32,8.6,0,.74,len/2-4.6));add('metal',box(2.4,.16,.12,0,.68,-len/2+.05));
    [-1,1].forEach(sd=>{add('lightR',box(.2,.12,.05,sd*1.0,.95,-len/2-.01));add('ind',box(.12,.1,.05,sd*.75,.95,-len/2-.01));add('dark',box(.5,.45,.02,sd*.85,.55,-len/2+.4))});
    add('white',box(.5,.12,.02,0,1.15,-len/2-.01));
    wheelsAt(.52,.3,[len/2-1.25],1.2,'bus',0);wheelsAt(.52,.3,[-len/2+2.6,-len/2+1.5],1.2,'bus',1);
  }else{
    const key={sedan:'sedan',hatch:'hatchT',suv:'suvT',van:'van',bus:'bus'}[type],S=SHAPES[key];S.id=type;len=S.len;
    addBody(S,0,{ds:type==='bus'?.18:.1,kind:type==='bus'?'bus':type});
    if(S.rails){const a=sectAt(S,0);[-1,1].forEach(sd=>add('dark',box(.04,.05,2.0,sd*a.wr*.8,a.yr+.05,-.5)))}
    if(type==='bus'){add('white',box(2.57,.14,10.4,0,1.3,-.1));add('dark',box(2.0,.3,.7,0,3.2,-2));add('dark',box(1.6,.2,.6,0,3.15,1.5))}
    const W=S.wheel;wheelsAt(W.r,W.tw,[W.f,W.b],interp(S.k,2,W.f),W.rim,W.dual);
  }
  const res={len,geo:{}};
  for(const k in out){const m=merge(out[k]);if(m)res.geo[k]=m}
  // indicators: split into the car's right side (x < 0) and left side, so each can blink on its own
  if(res.geo.ind){const g=res.geo.ind,P=g.attributes.position.array,N=g.attributes.normal.array,L={p:[],n:[]},R={p:[],n:[]};
    for(let t=0;t<P.length;t+=9){const side=(P[t]+P[t+3]+P[t+6])<0?R:L;for(let j=0;j<9;j++){side.p.push(P[t+j]);side.n.push(N[t+j])}}
    const mk=q=>{const G=new(T().BufferGeometry)();G.setAttribute('position',new(T().Float32BufferAttribute)(q.p,3));G.setAttribute('normal',new(T().Float32BufferAttribute)(q.n,3));return G};
    g.dispose();delete res.geo.ind;if(R.p.length)res.geo.indR=mk(R);if(L.p.length)res.geo.indL=mk(L)}
  // where the lamps are (for the night-time glows): [x, y, z] for the right headlamp and right tail lamp
  const S2=type==='truck'?null:SHAPES[{sedan:'sedan',hatch:'hatchT',suv:'suvT',van:'van',bus:'bus'}[type]];
  if(S2){const F=surfOf(S2),sf=sectAt(S2,F.zf-.08),sb=sectAt(S2,F.zb+.08);res.lamps={f:[sf.w*.72,lerp(sf.yb,sf.yh,.72),F.zf],r:[sb.w*.75,lerp(sb.yb,sb.yh,.78),F.zb]};if(type==='bus'){res.lamps.f=[.86,.68,F.zf];res.lamps.r=[1.0,.9,F.zb]}}
  else res.lamps={f:[.9,.9,len/2],r:[1.0,.95,-len/2]};
  return TRAFFIC[type]=res;
}

/* ---------- side view for the menu (SVG, no 3D needed) ---------- */
function svg(style,col){
  const S=SHAPES[style]||SHAPES.gt,K=S.k,W=S.wheel,z0=K[0][0],z1=K[K.length-1][0],sc=150/S.len,base=58;
  const X=z=>(10+(z0-z)*sc).toFixed(1),H=y=>(base-y*sc*.95).toFixed(1);
  const zs=[];for(let i=0;i<=90;i++)zs.push(z0+(z1-z0)*i/90);
  const top=zs.map(z=>X(z)+' '+H(section(S,z).yr)),bot=[...zs].reverse().map(z=>X(z)+' '+H(section(S,z).yb));
  const wh=z=>`<circle cx="${X(z)}" cy="${H(W.r)}" r="${(W.r*sc*.95).toFixed(1)}" fill="#16171a"/><circle cx="${X(z)}" cy="${H(W.r)}" r="${(W.r*sc*.62).toFixed(1)}" fill="#b9bec6"/>`;
  return `<svg viewBox="0 0 170 64" class="ss-sil" aria-hidden="true"><path d="M${top.join('L')}L${bot.join('L')}Z" fill="${col}"/>${wh(W.f)}${wh(W.b)}</svg>`;
}

root.SSCars={SHAPES,player,traffic,svg,body,sectAt,section,decal};
})(typeof window!=='undefined'?window:globalThis);
