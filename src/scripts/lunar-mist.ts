// Thin, horizontally stretched layers of advected noise, lit like the dust.
// The masks are open ribbons, never radial glows around the lunar silhouette.
export const mistVertex = `
varying vec2 vUv;
void main(){ vUv=uv; gl_Position=vec4(position.xy,.99,1.); }
`;
export const mistFragment = `
uniform float uTime, uProgress, uPaper;
uniform vec2 uViewport;
uniform vec3 uMoon;
varying vec2 vUv;
float hash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
float noise(vec2 p){
  vec2 i=floor(p), f=fract(p), u=f*f*(3.-2.*f);
  return mix(mix(hash(i),hash(i+vec2(1,0)),u.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),u.x),u.y);
}
float wisps(vec2 p){
  float sum=0., amplitude=.55;
  for(int i=0;i<3;i++){
    sum+=noise(p)*amplitude;
    p=p*2.03+vec2(3.1,7.3); amplitude*=.48;
  }
  return sum;
}
void main(){
  vec2 q=(vUv*uViewport-uMoon.xy)/uMoon.z;
  float time=uTime*.11;
  float bend=sin(q.x*1.5+time*.7)*.065;
  float middle=exp(-pow((q.y+.34+bend)/.21,2.));
  middle*=1.-smoothstep(-.7,-.18,q.x);
  middle*=smoothstep(.01,.18,vUv.x);
  float floorY=.13+sin(vUv.x*7.+time*.65)*.018;
  float floorBand=exp(-pow((vUv.y-floorY)/.075,2.));
  floorBand*=smoothstep(.07,.40,vUv.x);
  if(middle+floorBand<.004) discard;
  float warp=noise(vec2(q.x*.8+time*.5,q.y*4.-time*.17));
  float cloud=wisps(vec2(q.x*.88+time,q.y*7.5+warp*.8));
  float lower=wisps(vec2(vUv.x*5.2+time*.65,vUv.y*30.+warp*.6));
  float density=middle*smoothstep(.16,.80,cloud)*.3;
  density+=floorBand*smoothstep(.18,.82,lower)*.27;
  density*=1.-smoothstep(.18,.70,uProgress);
  vec3 color=mix(vec3(.71,.74,.71),vec3(.34,.36,.33),uPaper);
  gl_FragColor=vec4(color,density);
}`;
