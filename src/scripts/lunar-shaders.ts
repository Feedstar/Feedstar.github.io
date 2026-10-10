import { erosionGLSL } from '../lib/erosion.mjs';
import { lunarFlowGLSL, lunarTiming } from '../lib/lunar-flow.mjs';

export const surfaceVertex = `
varying vec3 vPosition, vNormal, vView;
varying vec2 vUv;
void main(){
  vPosition=position; vUv=uv;
  vec4 mv=modelViewMatrix*vec4(position,1.);
  vView=mv.xyz; vNormal=normalMatrix*normal;
  gl_Position=projectionMatrix*mv;
}`;
export const surfaceFragment = `
uniform float uProgress, uSpin;
uniform sampler2D uTexture;
varying vec3 vPosition, vNormal, vView;
varying vec2 vUv;
${erosionGLSL}
void main(){
  vec3 p=normalize(vPosition);
  float facing=max(0.,dot(normalize(vNormal),normalize(-vView)));
  float left=1.-smoothstep(-.65,.05,p.x);
  // A wide, irregular feather joins the illuminated limb to the fine dust.
  float edgeWidth=mix(.22,.59,left);
  float rim=smoothstep(.015,edgeWidth,facing);
  float erosion=uProgress*${lunarTiming.erosionScale};
  float remaining=1.;
  if(erosion>.005){
    float threshold=thresholdAt(p,0.);
    remaining=1.-smoothstep(threshold-.075,threshold+.055,erosion);
  }
  float feather=(1.-rim)+4.*remaining*(1.-remaining);
  vec2 uv=vec2(vUv.x+uSpin/6.2831853,vUv.y);
  vec3 tex=texture2D(uTexture,uv,min(3.,feather*2.7)).rgb;
  float lum=dot(tex,vec3(.299,.587,.114));
  float light=.19+.84*pow(max(0.,dot(p,normalize(vec3(-.6,.65,1.2)))),.6);
  float grain=erosionHash(floor(p*490.));
  float alpha=rim*remaining;
  alpha*=mix(1.,smoothstep(.08,.78,grain),clamp(feather*.68,0.,.9));
  vec3 color=vec3(.96,.95,.91)*pow(lum,.75)*1.12*light;
  gl_FragColor=vec4(color,alpha);
}`;

export const flowVertex = `
uniform float uProgress, uTime, uDpr;
uniform vec2 uViewport, uPointer;
attribute vec4 aFlow;
attribute vec3 aTarget, aTargetColor;
varying float vAlpha, vLight, vGather;
varying vec2 vUv;
varying vec3 vTargetColor;
${lunarFlowGLSL}
void main(){
  float seed=aFlow.x;
  float release=releaseAt(aFlow.w,uProgress,aFlow.z);
  float lifeAlpha;
  vec3 p=windPosition(position,seed,uProgress,uTime,release,aFlow.w,lifeAlpha);
  float gather=gatherAt(uProgress,seed);
  vec4 source=modelViewMatrix*vec4(p*1.004,1.);
  vec4 target=viewMatrix*vec4(aTarget,1.);
  vec4 mv=mix(source,target,gather);
  float arc=sin(gather*3.14159265);
  mv.y+=arc*((seed-.5)*.28+sin(uTime*.3+seed*6.28)*.035);
  mv.z+=arc*(aFlow.y-.5)*.18;
  float band=.58+.42*pow(.5+.5*sin(position.y*13.+seed),2.);
  float flowing=release*lifeAlpha*(.35+seed*.46)*band;
  vAlpha=mix(flowing,.42+aFlow.y*.2,gather)*(1.-handoffAt(uProgress));
  vLight=.24+.8*pow(max(0.,dot(normalize(position),normalize(vec3(-.6,.65,1.2)))),.6);
  vGather=gather; vTargetColor=aTargetColor; vUv=uv;
  gl_Position=projectionMatrix*mv;
  vec2 screen=(gl_Position.xy/gl_Position.w*.5+.5)*uViewport;
  vec2 delta=screen-uPointer;
  float distance=length(delta);
  float influence=pow(1.-smoothstep(0.,110.,distance),2.)*(1.-gather);
  gl_Position.xy+=delta/max(1.,distance)*influence*10./uViewport*2.*gl_Position.w;
  float grainSize=mix(.85+pow(aFlow.y,3.)*.9,2.0,gather);
  gl_PointSize=clamp(grainSize*uDpr*(5./-mv.z),.65,2.8);
}`;
export const flowFragment = `
uniform sampler2D uTexture;
uniform float uSpin, uPaper;
varying float vAlpha, vLight, vGather;
varying vec2 vUv;
varying vec3 vTargetColor;
void main(){
  float r=length(gl_PointCoord-.5);
  if(r>.5) discard;
  vec3 tex=texture2D(uTexture,vec2(vUv.x+uSpin/6.2831853,vUv.y)).rgb;
  float lum=dot(tex,vec3(.299,.587,.114));
  vec3 milk=vec3(.96,.95,.91)*(.4+.6*pow(lum,.75))*vLight;
  vec3 color=mix(milk,vec3(.35,.34,.32),uPaper);
  color=mix(color,vTargetColor,vGather);
  gl_FragColor=vec4(color,vAlpha*(1.-smoothstep(.10,.5,r)));
}`;
