import { erosionGLSL } from '../lib/erosion.mjs';
import {
  lunarFlowGLSL,
  lunarTiming,
  lunarNotchGLSL,
} from '../lib/lunar-flow.mjs';

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
uniform float uProgress, uSpin, uTime;
uniform sampler2D uTexture;
varying vec3 vPosition, vNormal, vView;
varying vec2 vUv;
${erosionGLSL}
${lunarNotchGLSL}
void main(){
  vec3 p=normalize(vPosition);
  float facing=max(0.,dot(normalize(vNormal),normalize(-vView)));
  float left=1.-smoothstep(-.65,.05,p.x);
  float edgeWidth=mix(.09,.27,left);
  float rim=smoothstep(.015,edgeWidth,facing);
  float breeze=erosionNoise(p*5.+vec3(uTime*.075,0.,0.))-.5;
  float notch=notchAt(p.y)+breeze*.075;
  float cutaway=smoothstep(notch-.20,notch+.23,p.x);
  float erosion=uProgress*${lunarTiming.erosionScale};
  float remaining=1.;
  if(erosion>.005){
    float threshold=thresholdAt(p,0.);
    remaining=1.-smoothstep(threshold-.075,threshold+.055,erosion);
  }
  float feather=(1.-rim)+4.*remaining*(1.-remaining)+4.*cutaway*(1.-cutaway);
  vec2 uv=vec2(vUv.x+uSpin/6.2831853,vUv.y);
  vec3 tex=texture2D(uTexture,uv,min(3.,feather*2.7)).rgb;
  float lum=dot(tex,vec3(.299,.587,.114));
  float light=.48+.55*pow(max(0.,dot(p,normalize(vec3(.75,.35,1.8)))),.5);
  float shadow=mix(.48,1.,smoothstep(-.48,.22,p.x+sin(p.y*3.)*.04));
  float alpha=rim*remaining*cutaway;
  vec3 color=vec3(.94,.95,.91)*pow(lum,.46)*1.16*light*shadow;
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
  float poleFade=1.-smoothstep(.50,.97,abs(position.y));
  float flowing=release*lifeAlpha*(.35+seed*.46)*band*poleFade;
  vAlpha=mix(flowing,.42+aFlow.y*.2,gather)*(1.-handoffAt(uProgress));
  vLight=.56+.4*pow(max(0.,dot(normalize(position),normalize(vec3(.75,.35,1.8)))),.5);
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
