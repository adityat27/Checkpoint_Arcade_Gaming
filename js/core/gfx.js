/* =========================================================================
   GFX · the shared graphics engine for the 3D racing games (Slipstream, Overdrive)
   -------------------------------------------------------------------------
   Loaded with the core scripts; it only touches THREE when a game calls it,
   so pages that never load three.js pay nothing.

   GFX.quality()            'auto' | 'high' | 'medium' | 'low'   (saved per browser)
   GFX.setQuality(q)
   GFX.on()                 false on 'low': games then render exactly as before
   GFX.pixelRatio()         resolution to render at (auto mode lowers it if the frame rate drops)
   new GFX.Post(renderer)   the post-processing chain:
       .render(scene, views)    views = [{camera, rect:[x,y,w,h] (0..1, bottom-left), speed 0..1,
                                          sunDir (world, normalised), sunColor THREE.Color}]
       .look(o)                 colour grade + effect strengths (see LOOK_DEFAULT)
       .dispose()
   GFX.atmos(uniforms)      returns a function that patches a scene's materials with
                            sun-tinted, height-aware fog (call it on the scene now and then)
   GFX.meter                frame-time meter (+ an on-screen FPS counter with ?fps in the address)

   The scene is drawn into an off-screen image (MSAA when the browser allows), then:
   bloom (a 6-level blur pyramid), light shafts and lens ghosts from the sun (quarter
   resolution), speed blur toward the vanishing point, edge colour fringing, a filmic
   colour grade, vignette and fine grain. Materials still tone-map themselves (three r128),
   so a game's existing look is the starting point and every effect is added on top.
   ========================================================================= */
const GFX=(()=>{
'use strict';
const KEY='gfxQ',LEVELS=['auto','high','medium','low'];
const touch=()=>typeof TOUCH_UI!=='undefined'&&TOUCH_UI;
let Q=(()=>{try{const q=localStorage[KEY];return LEVELS.includes(q)?q:'auto'}catch(e){return 'auto'}})();
const qs=(()=>{try{return new URLSearchParams(location.search)}catch(e){return null}})();
if(qs&&LEVELS.includes(qs.get('gfx')))Q=qs.get('gfx');
// what 'auto' starts as: phones and tablets medium, everything else high
// (auto also drops to medium on its own if even the lowest resolution can't keep up)
let autoMed=false;
const level=()=>Q==='auto'?(touch()||autoMed?'medium':'high'):Q;
// auto mode scales resolution between 0.6 and 1 to hold the frame rate
let autoScale=1;
const PR_CAP={high:1.5,medium:1.25,low:2};
function pixelRatio(){const l=level(),d=window.devicePixelRatio||1;
  if(l==='low')return Math.min(d,touch()?1.5:1.75);
  return Math.max(.6,Math.min(d,PR_CAP[l])*(Q==='auto'?autoScale:1))}

/* ---------- frame-time meter + auto quality ---------- */
const meter={last:0,acc:0,n:0,fps:60,ms:16.7,el:null,slow:0,fast:0,
  tick(now){
    if(this.last&&now-this.last<250){this.acc+=now-this.last;this.n++}
    this.last=now;
    if(this.acc>=1000){this.ms=this.acc/this.n;this.fps=1000/this.ms;this.acc=0;this.n=0;this.adapt();this.show()}
  },
  reset(){this.last=0;this.acc=0;this.n=0;this.slow=0;this.fast=0},
  adapt(){
    if(Q!=='auto'||document.hidden)return;
    // two slow seconds in a row: render fewer pixels; six fast ones: win some back
    if(this.ms>21){if(++this.slow>=2){this.slow=0;if(autoScale<=.73&&!autoMed&&!touch()){autoMed=true;autoScale=.85}else autoScale=Math.max(.6,autoScale-.12)}this.fast=0}
    else if(this.ms<14.5){if(++this.fast>=6){this.fast=0;autoScale=Math.min(1,autoScale+.06)}this.slow=0}
    else{this.slow=0;this.fast=0}
  },
  show(){
    if(!(qs&&qs.has('fps')))return;
    if(!this.el){this.el=document.createElement('div');this.el.style.cssText='position:fixed;left:8px;bottom:8px;z-index:99;padding:4px 8px;border-radius:8px;background:rgba(0,0,0,.6);color:#9effa8;font:600 12px/1.2 ui-monospace,monospace;pointer-events:none';document.body.appendChild(this.el)}
    this.el.textContent=`${this.fps.toFixed(0)} fps · ${this.ms.toFixed(1)} ms · ${level()}${Q==='auto'?' (auto)':''} · ${pixelRatio().toFixed(2)}x`;
  }
};

/* ---------- shaders ---------- */
const VS=`varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}`;
const DEC=`vec3 dec(vec4 c){return uSRGB>0.5?pow(c.rgb,vec3(2.2)):c.rgb;}`;
// bright pass: soft knee threshold, half resolution, 4-tap box to reduce fireflies
const FS_BRIGHT=`uniform sampler2D tSrc;uniform vec2 uTexel;uniform float uThresh,uKnee,uSRGB;varying vec2 vUv;${DEC}
vec3 pick(vec2 uv){vec3 c=dec(texture2D(tSrc,uv));float l=max(c.r,max(c.g,c.b));float s=clamp(l-uThresh+uKnee,0.,2.*uKnee);s=s*s/(4.*uKnee+1e-4);return c*max(s,l-uThresh)/max(l,1e-4);}
void main(){vec2 o=uTexel*.5;vec3 c=pick(vUv+vec2(-o.x,-o.y))+pick(vUv+vec2(o.x,-o.y))+pick(vUv+vec2(-o.x,o.y))+pick(vUv+vec2(o.x,o.y));gl_FragColor=vec4(min(c*.25,vec3(24.)),1.);}`;
// downsample: 13-tap (Jimenez) filter
const FS_DOWN=`uniform sampler2D tSrc;uniform vec2 uTexel;varying vec2 vUv;
vec3 s(vec2 o){return texture2D(tSrc,vUv+o*uTexel).rgb;}
void main(){vec3 a=s(vec2(-2,2)),b=s(vec2(0,2)),c=s(vec2(2,2)),d=s(vec2(-2,0)),e=s(vec2(0,0)),f=s(vec2(2,0)),g=s(vec2(-2,-2)),h=s(vec2(0,-2)),i=s(vec2(2,-2)),j=s(vec2(-1,1)),k=s(vec2(1,1)),l=s(vec2(-1,-1)),m=s(vec2(1,-1));
vec3 r=e*.125+(a+c+g+i)*.03125+(b+d+f+h)*.0625+(j+k+l+m)*.125;gl_FragColor=vec4(r,1.);}`;
// upsample: 9-tap tent, added onto the next bigger level
const FS_UP=`uniform sampler2D tSrc,tBase;uniform vec2 uTexel;uniform float uRad;varying vec2 vUv;
vec3 s(vec2 o){return texture2D(tSrc,vUv+o*uTexel*uRad).rgb;}
void main(){vec3 r=s(vec2(0))*4.+(s(vec2(-1,0))+s(vec2(1,0))+s(vec2(0,-1))+s(vec2(0,1)))*2.+s(vec2(-1,-1))+s(vec2(1,-1))+s(vec2(-1,1))+s(vec2(1,1));
gl_FragColor=vec4(texture2D(tBase,vUv).rgb+r/16.,1.);}`;
// sun: light shafts (radial march through the bright sky toward the sun) + lens ghosts + halo
const FS_FLARE=`uniform sampler2D tScene,tBright;uniform vec2 uSun;uniform float uSunVis,uShafts,uGhosts,uAspect,uSRGB;uniform vec3 uSunCol;uniform vec4 uRect;varying vec2 vUv;${DEC}
float sky(vec2 uv){if(uv.x<uRect.x||uv.y<uRect.y||uv.x>uRect.x+uRect.z||uv.y>uRect.y+uRect.w)return 0.;vec3 c=dec(texture2D(tScene,uv));float l=dot(c,vec3(.2126,.7152,.0722));return smoothstep(.5,.95,l);}
void main(){vec3 o=vec3(0.);
 if(uShafts>0.&&uSunVis>0.){vec2 d=(uSun-vUv)/32.;vec2 p=vUv;float w=1.,acc=0.;
  for(int i=0;i<32;i++){p+=d;acc+=sky(p)*w;w*=.955;}
  vec2 dd=(vUv-uSun);dd.x*=uAspect;float fall=exp(-length(dd)*2.4);
  o+=uSunCol*acc/32.*fall*uShafts*uSunVis*2.2;}
 if(uGhosts>0.){vec2 tc=vec2(1.)-vUv;vec2 gv=(vec2(.5)-tc)*.38;
  for(int i=0;i<4;i++){vec2 q=fract(tc+gv*float(i));float wt=pow(1.-length(vec2(.5)-q)/.7071,8.);
   vec3 g=texture2D(tBright,q).rgb;o+=g*wt*vec3(1.-float(i)*.18,.85,.7+float(i)*.12)*.55;}
  vec2 hv=normalize(vec2(.5)-tc+1e-4)*.42;vec2 hq=fract(tc+hv);float hw=pow(1.-length(vec2(.5)-hq)/.7071,6.);
  o+=texture2D(tBright,hq).rgb*hw*vec3(.6,.75,1.)*.35;
  o*=uGhosts;}
 gl_FragColor=vec4(o,1.);}`;
// final image
const FS_COMP=`uniform sampler2D tScene,tBloom,tFlare;uniform vec2 uTexel;uniform float uSRGB,uTime,uFxaa,uFlareOn;
uniform float uBloom,uContrast,uSat,uVig,uGrain,uExpo,uCA,uBlurTaps;
uniform vec3 uLift,uGain,uGamma;
uniform vec4 uRectA,uRectB;uniform float uViews;
uniform vec2 uCenA,uCenB,uSunA,uSunB;uniform float uSpeedA,uSpeedB,uSunVisA,uSunVisB,uAspect;uniform vec3 uSunColA,uSunColB;
varying vec2 vUv;${DEC}
vec3 S(vec2 uv){return dec(texture2D(tScene,uv));}
float luma(vec3 c){return dot(c,vec3(.299,.587,.114));}
vec3 fxaa(vec2 uv){vec3 c=S(uv);if(uFxaa<.5)return c;
 vec3 n=S(uv+vec2(0.,uTexel.y)),s=S(uv-vec2(0.,uTexel.y)),e=S(uv+vec2(uTexel.x,0.)),w=S(uv-vec2(uTexel.x,0.));
 float lc=luma(c),ln=luma(n),ls=luma(s),le=luma(e),lw=luma(w);float mn=min(lc,min(min(ln,ls),min(le,lw))),mx=max(lc,max(max(ln,ls),max(le,lw)));
 if(mx-mn<max(.03,mx*.12))return c;vec2 dir=vec2(-(ln-ls),(le-lw));
 float dl=max((ln+ls+le+lw)*.03,.008);float rc=1./(min(abs(dir.x),abs(dir.y))+dl);dir=clamp(dir*rc,-4.,4.)*uTexel;
 vec3 a=.5*(S(uv+dir*(-1./6.))+S(uv+dir*(1./6.)));vec3 b=a*.5+.25*(S(uv+dir*-.5)+S(uv+dir*.5));float lb=luma(b);return(lb<mn||lb>mx)?a:b;}
float hash(vec2 p){p=fract(p*vec2(443.897,441.423));p+=dot(p,p.yx+19.19);return fract((p.x+p.y)*p.x);}
vec3 toSRGB(vec3 c){c=max(c,0.);return mix(c*12.92,1.055*pow(c,vec3(1./2.4))-.055,step(.0031308,c));}
void main(){
 vec2 uv=vUv;bool B=uViews>1.5&&uv.x>=uRectB.x&&uv.y>=uRectB.y&&uv.x<=uRectB.x+uRectB.z&&uv.y<=uRectB.y+uRectB.w;
 vec4 R=B?uRectB:uRectA;vec2 cen=B?uCenB:uCenA,sun=B?uSunB:uSunA;float spd=B?uSpeedB:uSpeedA,sv=B?uSunVisB:uSunVisA;vec3 sc=B?uSunColB:uSunColA;
 vec2 lo=R.xy+uTexel,hi=R.xy+R.zw-uTexel;
 // speed blur toward the vanishing point + colour fringing at the edges
 vec2 d=uv-cen;float r=length(d*vec2(uAspect,1.));
 float m=spd*smoothstep(.18,.9,r)*.055;
 vec3 col=fxaa(uv);
 if(m>.0005&&uBlurTaps>0.){vec3 acc=col;float wsum=1.;
  for(int i=1;i<9;i++){if(float(i)>uBlurTaps)break;float t=float(i)/uBlurTaps;vec2 q=clamp(uv-d*m*t,lo,hi);float wt=1.-t*.5;acc+=S(q)*wt;wsum+=wt;}
  col=acc/wsum;}
 float ca=uCA*(.35+spd)*smoothstep(.25,1.,r);
 if(ca>0.){col.r=mix(col.r,S(clamp(uv-d*ca*.012,lo,hi)).r,.85);col.b=mix(col.b,S(clamp(uv+d*ca*.012,lo,hi)).b,.85);}
 col+=texture2D(tBloom,uv).rgb*uBloom;
 if(uFlareOn>0.)col+=texture2D(tFlare,uv).rgb;
 // sun glare: a soft disc + a faint starburst, only where the sun is actually seen
 if(sv>0.){vec2 sd=uv-sun;sd.x*=uAspect;float sl=length(sd);float an=atan(sd.y,sd.x);
  float star=pow(abs(cos(an*3.+.4)),40.)*.6+pow(abs(cos(an*5.-.2)),60.)*.4;
  col+=sc*sv*(exp(-sl*9.)*.55+exp(-sl*30.)*.9+star*exp(-sl*6.)*.25);}
 col*=uExpo;
 // grade in display space
 vec3 g=toSRGB(col);
 g=g*uGain+uLift*(1.-g);g=pow(max(g,0.),1./uGamma);
 g=(g-.5)*uContrast+.5;
 float l=luma(g);g=mix(vec3(l),g,uSat);
 vec2 vv=(uv-(R.xy+R.zw*.5))/R.zw;g*=1.-uVig*smoothstep(.35,1.05,length(vv*vec2(1.,.82))*1.25);
 g+=(hash(uv*1000.+fract(uTime*7.))-.5)*uGrain;
 gl_FragColor=vec4(clamp(g,0.,1.),1.);}`;

const LOOK_DEFAULT={bloom:.6,thresh:.82,knee:.18,contrast:1.04,sat:1.06,lift:[0,0,0],gain:[1,1,1],gamma:[1,1,1],vig:.32,grain:.022,expo:1,ca:.6,shafts:.6,ghosts:.35};

/* ---------- the post chain ---------- */
class Post{
  constructor(r){
    const T=THREE;this.r=r;this.w=0;this.h=0;this.t0=performance.now();
    const gl2=r.capabilities.isWebGL2;
    const half=gl2?!!r.extensions.get('EXT_color_buffer_float'):!!(r.extensions.get('OES_texture_half_float')&&r.extensions.get('EXT_color_buffer_half_float'));
    this.half=half;this.msaa=gl2&&half&&!!T.WebGLMultisampleRenderTarget;
    // without a float buffer the scene is stored sRGB-encoded in 8 bits (no banding in the dark), decoded in the shaders
    this.srgb=!half;
    this.ftype=half?T.HalfFloatType:T.UnsignedByteType;
    this.cam=new T.OrthographicCamera(-1,1,1,-1,0,1);
    const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute([-1,-1,0,3,-1,0,-1,3,0],3));g.setAttribute('uv',new T.Float32BufferAttribute([0,0,2,0,0,2],2));
    this.quad=new T.Mesh(g,null);this.quad.frustumCulled=false;
    const mk=(fs,u)=>new T.ShaderMaterial({vertexShader:VS,fragmentShader:fs,uniforms:u,depthTest:false,depthWrite:false});
    const V2=()=>({value:new T.Vector2()}),V3=(x=1,y=1,z=1)=>({value:new T.Vector3(x,y,z)}),F=(v=0)=>({value:v}),Tx=()=>({value:null});
    this.mBright=mk(FS_BRIGHT,{tSrc:Tx(),uTexel:V2(),uThresh:F(.82),uKnee:F(.18),uSRGB:F(this.srgb?1:0)});
    this.mDown=mk(FS_DOWN,{tSrc:Tx(),uTexel:V2()});
    this.mUp=mk(FS_UP,{tSrc:Tx(),tBase:Tx(),uTexel:V2(),uRad:F(1)});
    this.mFlare=mk(FS_FLARE,{tScene:Tx(),tBright:Tx(),uSun:V2(),uSunVis:F(0),uShafts:F(0),uGhosts:F(0),uAspect:F(1),uSRGB:F(this.srgb?1:0),uSunCol:V3(),uRect:{value:new T.Vector4(0,0,1,1)}});
    this.mComp=mk(FS_COMP,{tScene:Tx(),tBloom:Tx(),tFlare:Tx(),uTexel:V2(),uSRGB:F(this.srgb?1:0),uTime:F(0),uFxaa:F(this.msaa?0:1),uFlareOn:F(0),
      uBloom:F(.6),uContrast:F(1),uSat:F(1),uVig:F(.3),uGrain:F(.02),uExpo:F(1),uCA:F(.6),uBlurTaps:F(8),uLift:V3(0,0,0),uGain:V3(),uGamma:V3(),
      uRectA:{value:new T.Vector4(0,0,1,1)},uRectB:{value:new T.Vector4(0,0,0,0)},uViews:F(1),uCenA:V2(),uCenB:V2(),uSunA:V2(),uSunB:V2(),
      uSpeedA:F(0),uSpeedB:F(0),uSunVisA:F(0),uSunVisB:F(0),uAspect:F(1),uSunColA:V3(),uSunColB:V3()});
    this.L=Object.assign({},LOOK_DEFAULT);this.look({});
    this.v3=new T.Vector3();this.v3b=new T.Vector3();
  }
  look(o){Object.assign(this.L,o);const L=this.L,u=this.mComp.uniforms;
    u.uBloom.value=L.bloom;u.uContrast.value=L.contrast;u.uSat.value=L.sat;u.uVig.value=L.vig;u.uGrain.value=L.grain;u.uExpo.value=L.expo;u.uCA.value=L.ca;
    u.uLift.value.fromArray(L.lift);u.uGain.value.fromArray(L.gain);u.uGamma.value.fromArray(L.gamma);
    this.mBright.uniforms.uThresh.value=L.thresh;this.mBright.uniforms.uKnee.value=L.knee;return this}
  rt(w,h,o={}){const T=THREE;return new T.WebGLRenderTarget(Math.max(1,w),Math.max(1,h),Object.assign({minFilter:T.LinearFilter,magFilter:T.LinearFilter,format:T.RGBAFormat,type:this.ftype,depthBuffer:false,stencilBuffer:false},o))}
  setup(w,h){
    if(w===this.w&&h===this.h&&this.lvl===level())return;this.free();this.w=w;this.h=h;this.lvl=level();
    const T=THREE,hi=this.lvl==='high',opt={minFilter:T.LinearFilter,magFilter:T.LinearFilter,format:T.RGBAFormat,type:this.ftype,depthBuffer:true,stencilBuffer:false};
    if(this.msaa){this.scene=new T.WebGLMultisampleRenderTarget(w,h,opt);this.scene.samples=hi?4:2}else this.scene=new T.WebGLRenderTarget(w,h,opt);
    if(this.srgb)this.scene.texture.encoding=T.sRGBEncoding;
    // bloom pyramid: 1/2 .. 1/64
    this.mips=[];let mw=w>>1,mh=h>>1;const n=hi?6:5;for(let i=0;i<n;i++){this.mips.push(this.rt(mw,mh));mw=Math.max(1,mw>>1);mh=Math.max(1,mh>>1)}
    this.ups=this.mips.slice(0,-1).map(m=>this.rt(m.width,m.height));
    this.flare=hi?this.rt(w>>2,h>>2):null;
    const u=this.mComp.uniforms;u.uTexel.value.set(1/w,1/h);u.uBlurTaps.value=hi?8:5;u.uFlareOn.value=this.flare?1:0;
  }
  free(){[this.scene,...(this.mips||[]),...(this.ups||[]),this.flare].forEach(t=>t&&t.dispose());this.mips=this.ups=null;this.scene=this.flare=null}
  pass(m,target){this.quad.material=m;this.r.setRenderTarget(target);this.r.render(this.quad,this.cam)}
  // where the sun is on screen, and whether it faces us at all
  sunAt(v,out){
    const c=v.camera,d=this.v3.copy(v.sunDir||this.v3.set(0,1,0));c.getWorldDirection(this.v3b);
    const face=this.v3b.dot(d);if(face<=.05){out.vis=0;return out}
    const p=this.v3b.copy(c.position).addScaledVector(d,1000).project(c);
    out.x=v.rect[0]+(p.x*.5+.5)*v.rect[2];out.y=v.rect[1]+(p.y*.5+.5)*v.rect[3];
    const edge=Math.max(Math.abs(p.x),Math.abs(p.y));out.vis=Math.min(1,(face-.05)*4)*(1-Math.min(1,Math.max(0,edge-1)*1.5));return out}
  render(scene,views){
    meter.tick(performance.now());
    const r=this.r,T=THREE,size=r.getDrawingBufferSize(this.v2||(this.v2=new T.Vector2()));
    this.setup(size.x|0,size.y|0);const W=this.w,H=this.h,hi=this.lvl==='high';
    // 1. the scene, one viewport per camera
    const S=this.scene,ac=r.autoClear;
    r.setRenderTarget(S);r.setScissorTest(false);S.scissorTest=false;r.clear();
    views.forEach((v,i)=>{const[x,y,w,h]=v.rect;S.viewport.set(x*W,y*H,w*W,h*H);S.scissor.set(x*W,y*H,w*W,h*H);S.scissorTest=views.length>1;
      r.setRenderTarget(S);r.autoClear=views.length===1;r.render(scene,v.camera)});
    r.autoClear=ac;S.viewport.set(0,0,W,H);S.scissor.set(0,0,W,H);S.scissorTest=false;
    // 2. bloom: bright pass, down, up
    const M=this.mips,U=this.ups;
    this.mBright.uniforms.tSrc.value=S.texture;this.mBright.uniforms.uTexel.value.set(1/W,1/H);this.pass(this.mBright,M[0]);
    for(let i=1;i<M.length;i++){this.mDown.uniforms.tSrc.value=M[i-1].texture;this.mDown.uniforms.uTexel.value.set(1/M[i-1].width,1/M[i-1].height);this.pass(this.mDown,M[i])}
    let src=M[M.length-1];
    for(let i=M.length-2;i>=0;i--){const u=this.mUp.uniforms;u.tSrc.value=src.texture;u.tBase.value=M[i].texture;u.uTexel.value.set(1/src.width,1/src.height);u.uRad.value=1;this.pass(this.mUp,U[i]);src=U[i]}
    const bloomTex=src.texture;
    // 3. sun: shafts + ghosts (single view only)
    const c=this.mComp.uniforms,sA=this.sunA||(this.sunA={}),sB=this.sunB||(this.sunB={});
    views.forEach((v,i)=>{const s=this.sunAt(v,i?sB:sA);const k=i?'B':'A';
      c['uSun'+k].value.set(s.x||0,s.y||0);c['uSunVis'+k].value=s.vis*(this.L.sunGlare!=null?this.L.sunGlare:1);c['uSunCol'+k].value.set(v.sunColor?v.sunColor.r:1,v.sunColor?v.sunColor.g:.95,v.sunColor?v.sunColor.b:.85);
      c['uSpeed'+k].value=Math.max(0,Math.min(1,v.speed||0));
      const rc=c['uRect'+k].value;rc.set(v.rect[0],v.rect[1],v.rect[2],v.rect[3]);
      c['uCen'+k].value.set(v.rect[0]+v.rect[2]*.5,v.rect[1]+v.rect[3]*(v.center||.56))});
    c.uViews.value=views.length;c.uAspect.value=(W*views[0].rect[2])/(H*views[0].rect[3]);
    if(this.flare){const f=this.mFlare.uniforms,v=views[0];
      f.tScene.value=S.texture;f.tBright.value=M[1].texture;f.uSun.value.copy(c.uSunA.value);f.uSunVis.value=views.length===1?c.uSunVisA.value:0;
      f.uShafts.value=this.L.shafts;f.uGhosts.value=views.length===1?this.L.ghosts:0;f.uAspect.value=c.uAspect.value;f.uSunCol.value.copy(c.uSunColA.value);f.uRect.value.copy(c.uRectA.value);
      this.pass(this.mFlare,this.flare)}
    // 4. composite to the screen
    c.tScene.value=S.texture;c.tBloom.value=bloomTex;c.tFlare.value=this.flare?this.flare.texture:null;c.uTime.value=(performance.now()-this.t0)/1000;
    c.uGrain.value=this.L.grain*(hi?1:.7);
    this.pass(this.mComp,null);
  }
  dispose(){this.free();[this.mBright,this.mDown,this.mUp,this.mFlare,this.mComp].forEach(m=>m.dispose());this.quad.geometry.dispose()}
}

/* ---------- atmosphere: sun-tinted, height-aware fog for the built-in materials ----------
   U = {sunDir:{value:Vector3}, sunCol:{value:Color}, sunK:{value}, h0:{value}, hK:{value}, hD:{value}}
   The fog colour leans toward the sun colour when you look toward the sun, and extra
   ground haze pools below h0 (valleys, the sea). */
function atmos(U){
  const done=new WeakSet();
  const patch=m=>{
    if(!m||done.has(m)||m.isShaderMaterial||m.isRawShaderMaterial||m.isSpriteMaterial||m.fog===false)return;done.add(m);
    const prev=m.onBeforeCompile;
    m.onBeforeCompile=(sh,r)=>{if(prev)prev(sh,r);
      if(!sh.vertexShader.includes('#include <begin_vertex>')||!sh.vertexShader.includes('#include <fog_vertex>'))return;
      Object.assign(sh.uniforms,{atmSun:U.sunDir,atmSunCol:U.sunCol,atmSunK:U.sunK,atmH0:U.h0,atmHK:U.hK,atmHD:U.hD});
      sh.vertexShader=sh.vertexShader.replace('#include <fog_pars_vertex>','#include <fog_pars_vertex>\n#ifdef USE_FOG\nvarying vec3 vAtmW;\n#endif')
        .replace('#include <fog_vertex>','#include <fog_vertex>\n#ifdef USE_FOG\n{vec4 aw=vec4(transformed,1.);\n#ifdef USE_INSTANCING\naw=instanceMatrix*aw;\n#endif\nvAtmW=(modelMatrix*aw).xyz;}\n#endif');
      sh.fragmentShader=sh.fragmentShader.replace('#include <fog_pars_fragment>','#include <fog_pars_fragment>\n#ifdef USE_FOG\nvarying vec3 vAtmW;uniform vec3 atmSun,atmSunCol;uniform float atmSunK,atmH0,atmHK,atmHD;\n#endif')
        .replace('#include <fog_fragment>',`#ifdef USE_FOG
 vec3 aV=vAtmW-cameraPosition;float aD=length(aV);vec3 aN=aV/max(aD,1e-3);
 #ifdef FOG_EXP2
  float fogFactor=1.0-exp(-fogDensity*fogDensity*fogDepth*fogDepth);
 #else
  float fogFactor=smoothstep(fogNear,fogFar,fogDepth);
 #endif
 // ground haze: thicker the lower the point sits under h0
 float aH=clamp((atmH0-vAtmW.y)*atmHK,0.,1.);fogFactor=1.-(1.-fogFactor)*exp(-aD*atmHD*aH);
 float aS=pow(max(dot(aN,atmSun),0.),6.)*atmSunK;
 vec3 aC=mix(fogColor,atmSunCol,clamp(aS,0.,1.));
 gl_FragColor.rgb=mix(gl_FragColor.rgb,aC,clamp(fogFactor,0.,1.));
#endif`);
    };
    const key=m.customProgramCacheKey?m.customProgramCacheKey.bind(m):null;
    m.customProgramCacheKey=()=>(key?key():'')+'|atm';
    m.needsUpdate=true;
  };
  const fn=scene=>{scene.traverse(o=>{const ms=o.material;if(!ms)return;if(Array.isArray(ms))ms.forEach(patch);else patch(ms)})};
  fn.mat=m=>{if(Array.isArray(m))m.forEach(patch);else patch(m)};
  return fn;
}

/* ---------- colour management for scenes authored without it ----------
   linearize(root): treat every colour, texture and vertex colour as sRGB (what you see in a
   colour picker) and convert it to linear, so the renderer can light it physically and encode
   the result back to sRGB. Run it once, before anything that is already linear is added. */
const s2l=c=>c<=.04045?c/12.92:Math.pow((c+.055)/1.055,2.4);
function linearize(root){
  const T=THREE,seen=new WeakSet(),geos=new WeakSet();
  const mat=m=>{if(!m||seen.has(m)||(m.userData&&m.userData.lin))return;seen.add(m);m.userData.lin=1;
    if(m.color)m.color.convertSRGBToLinear();if(m.emissive)m.emissive.convertSRGBToLinear();if(m.specular)m.specular.convertSRGBToLinear();
    ['map','emissiveMap'].forEach(k=>{const t=m[k];if(t&&t.encoding!==T.sRGBEncoding){t.encoding=T.sRGBEncoding;t.needsUpdate=true}});m.needsUpdate=true};
  root.traverse(o=>{
    if(o.isLight){if(!o.userData.lin){o.userData.lin=1;o.color.convertSRGBToLinear();if(o.groundColor)o.groundColor.convertSRGBToLinear()}return}
    if(o.material)(Array.isArray(o.material)?o.material:[o.material]).forEach(mat);
    const g=o.geometry,c=g&&g.attributes&&g.attributes.color;if(c&&!geos.has(g)){geos.add(g);const a=c.array;for(let i=0;i<a.length;i++)a[i]=s2l(a[i]);c.needsUpdate=true}
    if(o.isInstancedMesh&&o.instanceColor&&!geos.has(o.instanceColor)){geos.add(o.instanceColor);const a=o.instanceColor.array;for(let i=0;i<a.length;i++)a[i]=s2l(a[i]);o.instanceColor.needsUpdate=true}
  });
  if(root.isScene){if(root.background&&root.background.isColor)root.background.convertSRGBToLinear();if(root.fog)root.fog.color.convertSRGBToLinear()}
}
/* toPBR(root): swap Lambert/Phong materials for physically based ones (same colours and maps),
   so surfaces pick up the environment light and reflections. Shared materials stay shared. */
function toPBR(root,o={}){
  const T=THREE,map=new Map();
  const conv=m=>{if(!m||!(m.isMeshLambertMaterial||m.isMeshPhongMaterial)||(o.skip&&o.skip.has(m)))return m;if(map.has(m))return map.get(m);
    const n=new T.MeshStandardMaterial({color:m.color,map:m.map,emissive:m.emissive,emissiveMap:m.emissiveMap,emissiveIntensity:m.emissiveIntensity,
      vertexColors:m.vertexColors,side:m.side,transparent:m.transparent,opacity:m.opacity,alphaTest:m.alphaTest,depthWrite:m.depthWrite,depthTest:m.depthTest,
      blending:m.blending,polygonOffset:m.polygonOffset,polygonOffsetFactor:m.polygonOffsetFactor,polygonOffsetUnits:m.polygonOffsetUnits,fog:m.fog,toneMapped:m.toneMapped,
      flatShading:m.flatShading,metalness:0,roughness:m.isMeshPhongMaterial?(m.shininess>80?.28:.55):(o.rough!=null?o.rough:.86),envMapIntensity:o.env!=null?o.env:.7});
    n.userData=Object.assign({},m.userData,{lin:1});map.set(m,n);return n};
  root.traverse(x=>{if(!x.material)return;x.material=Array.isArray(x.material)?x.material.map(conv):conv(x.material)});
  map.forEach((n,m)=>m.dispose());
}
// smooth 1D value noise in -1..1 (camera shake)
function noise(t,seed){const i=Math.floor(t),f=t-i,u=f*f*(3-2*f),h=k=>{let x=Math.imul(k,374761393)+Math.imul(seed|0,668265263);x=Math.imul(x^x>>>13,1274126177);return((x^x>>>16)>>>0)/4294967296*2-1};return h(i)+(h(i+1)-h(i))*u}

document.addEventListener('visibilitychange',()=>meter.reset());

return{
  quality:()=>Q,level,
  setQuality(q){if(!LEVELS.includes(q))return;Q=q;autoScale=1;autoMed=false;meter.reset();try{localStorage[KEY]=q}catch(e){}},
  on:()=>level()!=='low',
  pixelRatio,Post,atmos,meter,LEVELS,linearize,toPBR,noise
};
})();
