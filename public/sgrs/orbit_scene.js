/* Self-contained WebGL display. Distances in Earth radii; inertial Z is north. */
(function(root){
'use strict';
const R=6378136.3, MU=3.986004415e14, D=Math.PI/180;
function period(p){return 2*Math.PI*Math.sqrt((R+p.altitude_m)**3/MU)}
function position(p,t=0,member=0){
 const a=R+p.altitude_m,e=p.eccentricity??.001;
 const raw=p.mean_anomaly_deg*D+2*Math.PI*t/period(p)-member*p.separation_m/a;
 const m=((raw+Math.PI)%(2*Math.PI)+2*Math.PI)%(2*Math.PI)-Math.PI;
 let E=e>.8?(m<0?-Math.PI:Math.PI):m;for(let j=0;j<30;j++)E-=(E-e*Math.sin(E)-m)/(1-e*Math.cos(E));
 const x=a*(Math.cos(E)-e)/R,y=a*Math.sqrt(1-e*e)*Math.sin(E)/R,i=p.inclination_deg*D,o=p.raan_deg*D;
 return [Math.cos(o)*x-Math.sin(o)*Math.cos(i)*y,Math.sin(o)*x+Math.cos(o)*Math.cos(i)*y,Math.sin(i)*y];
}
function earthAngle(mjd){const d=mjd-51544.5,T=d/36525;return ((280.46061837+360.98564736629*d+.000387933*T*T-T*T*T/38710000)%360)*D}
// Column-major TRF->CRF matrix with shortest-path quaternion interpolation.
function earthMatrix(rows,t){
 if(!rows?.length||t<rows[0][0]||t>rows.at(-1)[0])return null;
 let lo=0,hi=rows.length-1;while(hi-lo>1){const m=(lo+hi)>>1;if(rows[m][0]<=t)lo=m;else hi=m}
 const a=rows[lo],b=rows[hi],u=hi===lo?0:(t-a[0])/(b[0]-a[0]);
 let q=a.slice(1),r=b.slice(1),dot=q.reduce((v,x,i)=>v+x*r[i],0);
 if(dot<0){r=r.map(x=>-x);dot=-dot}dot=Math.min(1,dot);
 if(dot>.9995)q=q.map((x,i)=>x*(1-u)+r[i]*u);
 else{const angle=Math.acos(dot),v=Math.sin(angle);q=q.map((x,i)=>(Math.sin((1-u)*angle)*x+Math.sin(u*angle)*r[i])/v)}
 const norm=Math.hypot(...q);const [x,y,z,w]=q.map(v=>v/norm);
 return [1-2*(y*y+z*z),2*(x*y+z*w),2*(x*z-y*w),2*(x*y-z*w),1-2*(x*x+z*z),2*(y*z+x*w),2*(x*z+y*w),2*(y*z-x*w),1-2*(x*x+y*y)];
}
function temporalMap(data,component,t){
 const times=data.times_s,maps=data.fields[component];
 if(!maps||t<times[0]||t>times.at(-1))return null;
 let i=0;while(i<times.length-2&&times[i+1]<t)i++;
 const u=(t-times[i])/(times[i+1]-times[i]);
 return maps[i].map((row,j)=>row.map((v,k)=>v*(1-u)+maps[i+1][j][k]*u));
}
// right × up = outward-facing camera axis. East must project right.
function cameraBasis(yaw,pitch){return {
 right:[-Math.cos(yaw),Math.sin(yaw),0],
 up:[-Math.sin(pitch)*Math.sin(yaw),-Math.sin(pitch)*Math.cos(yaw),Math.cos(pitch)],
 face:[Math.cos(pitch)*Math.sin(yaw),Math.cos(pitch)*Math.cos(yaw),Math.sin(pitch)]};}
function sampleTrajectory(track,t){
 for(const rows of track.segments){
  if(t<rows[0][0]||t>rows.at(-1)[0])continue;
  let lo=0,hi=rows.length-1;while(hi-lo>1){const mid=(lo+hi)>>1;if(rows[mid][0]<=t)lo=mid;else hi=mid}
  const a=rows[lo],b=rows[hi],h=b[0]-a[0],u=(t-a[0])/h;
  return [0,1,2].map(k=>((2*u**3-3*u*u+1)*a[k+1]+(u**3-2*u*u+u)*h*a[k+4]+(-2*u**3+3*u*u)*b[k+1]+(u**3-u*u)*h*b[k+4])/R);
 }
 return null;
}
function validate(g){
 if(!Number.isFinite(g.start_mjd)||g.start_mjd<0||g.start_mjd>100000)throw Error('Epoch must be an MJD between 0 and 100000.');
 if(!Array.isArray(g.pairs)||!g.pairs.length||g.pairs.length>24)throw Error('Use between 1 and 24 satellite pairs.');
 for(const p of g.pairs){
  for(const k of ['altitude_m','inclination_deg','raan_deg','mean_anomaly_deg','separation_m'])if(!Number.isFinite(p[k]))throw Error('Every orbital element must be a finite number.');
  const e=p.eccentricity??.001;
  if(!Number.isFinite(e)||e<0||e>=1||(R+p.altitude_m)*(1-e)<=R)throw Error('The orbit must be elliptical and its perigee must be above Earth.');
  if(p.inclination_deg<0||p.inclination_deg>180||p.separation_m<=0||p.separation_m>=2*Math.PI*(R+p.altitude_m))throw Error('Inclination must be 0–180° and separation must be positive and below one orbit.');
 }
 return g;
}
const palette=['#e9b96d','#76c5e4','#b2b4f2','#9fd2a3','#ed9695','#cdb383'];
function rgb(hex){return hex.slice(1).match(/../g).map(x=>parseInt(x,16)/255)}
function ramp(x){x=Math.max(-1,Math.min(1,x));const a=x<0?[45,91,156]:[180,52,54],t=Math.abs(x);return a.map(v=>Math.round(242+(v-242)*t))}
class OrbitScene{
 constructor(canvas){
  this.canvas=canvas;const gl=this.gl=canvas.getContext('webgl',{antialias:true,alpha:false});if(!gl)throw Error('WebGL is unavailable. Enable hardware acceleration to use the Earth view.');
  this.yaw=.3;this.pitch=.35;this.distance=3.5;this.pairs=[];this.epoch=52395;this.seconds=0;this.coasts=[];this.field=null;this.scale=1;
  const shader=(type,src)=>{const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s};
  this.program=gl.createProgram();gl.attachShader(this.program,shader(gl.VERTEX_SHADER,`
   attribute vec3 aPosition;attribute vec2 aUV;varying vec2 vUV;varying float vLight;
   uniform mat3 uEarth;uniform float uDistance,uAspect,uPointSize;uniform vec3 uRight,uUp,uFace;
   void main(){vec3 p=uEarth*aPosition;
   float x=dot(uRight,p);float y=dot(uUp,p);float face=dot(uFace,p);float depth=uDistance-face;
   gl_Position=vec4(x*2.4/max(uAspect,1.),y*2.4*min(uAspect,1.),depth*1.004-0.2004,depth);gl_PointSize=uPointSize;vUV=aUV;vLight=.68+.32*max(0.,face/length(p));}`));
  gl.attachShader(this.program,shader(gl.FRAGMENT_SHADER,`
   precision mediump float;varying vec2 vUV;varying float vLight;uniform sampler2D uTexture;uniform bool uTextured,uPoint;uniform vec3 uColor;
   void main(){if(uPoint&&length(gl_PointCoord-vec2(.5))>.5)discard;gl_FragColor=vec4(uTextured?texture2D(uTexture,vUV).rgb*vLight:uColor,1.);}`));
  gl.linkProgram(this.program);if(!gl.getProgramParameter(this.program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(this.program));gl.useProgram(this.program);
  this.uniform={};for(const name of ['Earth','Right','Up','Face','Distance','Aspect','PointSize','Textured','Point','Color','Texture'])this.uniform[name]=gl.getUniformLocation(this.program,'u'+name);
  this.pos=gl.getAttribLocation(this.program,'aPosition');this.uv=gl.getAttribLocation(this.program,'aUV');this.buffer=gl.createBuffer();this.texture=gl.createTexture();
  const vertices=[];const v=(j,k)=>{const lat=(-90+j*180/96)*D,lon=(-180+k*360/192)*D;return [Math.cos(lat)*Math.cos(lon),Math.cos(lat)*Math.sin(lon),Math.sin(lat),k/192,j/96]};
  for(let j=0;j<96;j++)for(let k=0;k<192;k++)for(const [a,b]of [[j,k],[j,k+1],[j+1,k],[j+1,k],[j,k+1],[j+1,k+1]])vertices.push(...v(a,b));
  this.sphere=new Float32Array(vertices);this.makeTexture();
  let drag=null;canvas.addEventListener('pointerdown',e=>{drag=[e.clientX,e.clientY];canvas.setPointerCapture(e.pointerId)});
  canvas.addEventListener('pointermove',e=>{if(!drag)return;this.yaw+=(e.clientX-drag[0])*.007;this.pitch=Math.max(-1.5,Math.min(1.5,this.pitch+(e.clientY-drag[1])*.007));drag=[e.clientX,e.clientY];this.draw()});
  canvas.addEventListener('pointerup',()=>drag=null);canvas.addEventListener('pointercancel',()=>drag=null);
  canvas.addEventListener('wheel',e=>{e.preventDefault();this.zoomTo(Math.max(1.6,Math.min(12,(this.zoomTarget??this.distance)+e.deltaY*.003)))},{passive:false});
  canvas.addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','-'].includes(e.key)){e.preventDefault();this.yaw+=e.key==='ArrowLeft'?-.1:e.key==='ArrowRight'?.1:0;this.pitch=Math.max(-1.5,Math.min(1.5,this.pitch+(e.key==='ArrowUp'?.1:e.key==='ArrowDown'?-.1:0)));this.distance=Math.max(1.6,Math.min(12,this.distance+(e.key==='+'?-.2:e.key==='-'?.2:0)));this.draw()}});
  new ResizeObserver(()=>this.draw()).observe(canvas);
 }
 setGeometry(g){validate(g);this.pairs=structuredClone(g.pairs);this.ids=g.pair_ids||g.pairs.map((_,i)=>i);this.epoch=g.start_mjd;this.draw()}
 focusPair(id){this.highlight=id;this.draw()}
 setTrajectory(data,native=true){this.trajectory=data;this.native=native;this.draw()}
 setField(values,scale){this.field=values;this.scale=scale||1;this.makeTexture();this.draw()}
 zoomTo(target){
  this.zoomTarget=target;cancelAnimationFrame(this.zoomFrame);
  if(matchMedia('(prefers-reduced-motion: reduce)').matches){this.distance=target;this.draw();return}
  const start=this.distance,began=performance.now();
  const step=now=>{const t=Math.min(1,(now-began)/180);this.distance=start+(target-start)*(1-(1-t)**3);this.draw();if(t<1)this.zoomFrame=requestAnimationFrame(step)};
  this.zoomFrame=requestAnimationFrame(step);
 }
 makeTexture(){
  const c=document.createElement('canvas');c.width=1024;c.height=512;const ctx=c.getContext('2d');ctx.fillStyle='#0b0b0b';ctx.fillRect(0,0,c.width,c.height);
  if(this.field){const h=this.field.length,w=this.field[0].length,small=document.createElement('canvas');small.width=w;small.height=h;const s=small.getContext('2d'),im=s.createImageData(w,h);for(let j=0;j<h;j++)for(let k=0;k<w;k++){const n=4*(j*w+k);im.data.set([...ramp(this.field[j][k]/this.scale),255],n)}s.putImageData(im,0,0);ctx.drawImage(small,0,0,c.width,c.height)}
  const xy=([lon,lat])=>[(lon+180)/360*c.width,(lat+90)/180*c.height];
  ctx.strokeStyle=this.field?'#17253460':'#ffffff24';ctx.lineWidth=.6;
  for(let lon=-180;lon<180;lon+=30){ctx.beginPath();ctx.moveTo(...xy([lon,-90]));ctx.lineTo(...xy([lon,90]));ctx.stroke()}
  for(let lat=-60;lat<=60;lat+=30){ctx.beginPath();ctx.moveTo(...xy([-180,lat]));ctx.lineTo(...xy([180,lat]));ctx.stroke()}
  for(const polygon of this.coasts){ctx.beginPath();let previous=null;for(const p of polygon){if(!previous||Math.abs(p[0]-previous[0])>180)ctx.moveTo(...xy(p));else ctx.lineTo(...xy(p));previous=p}if(!this.field){ctx.fillStyle='#202020';ctx.fill()}ctx.strokeStyle=this.field?'#1b2739b0':'#909090';ctx.lineWidth=1;ctx.stroke()}
  const gl=this.gl;gl.bindTexture(gl.TEXTURE_2D,this.texture);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,c);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
 }
 draw(){
  const gl=this.gl,c=this.canvas;if(!c.clientWidth||!c.clientHeight)return;const d=Math.min(devicePixelRatio||1,2);const w=Math.round(c.clientWidth*d),h=Math.round(c.clientHeight*d);if(c.width!==w)c.width=w;if(c.height!==h)c.height=h;gl.viewport(0,0,c.width,c.height);gl.clearColor(0,0,0,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.enable(gl.DEPTH_TEST);gl.useProgram(this.program);
  const u=this.uniform;const basis=cameraBasis(this.yaw,this.pitch);gl.uniform3fv(u.Right,basis.right);gl.uniform3fv(u.Up,basis.up);gl.uniform3fv(u.Face,basis.face);gl.uniform1f(u.Distance,this.distance);gl.uniform1f(u.Aspect,c.width/c.height);gl.uniform1i(u.Texture,0);gl.bindTexture(gl.TEXTURE_2D,this.texture);
  const draw=(data,mode,color,rotation=0,textured=false,point=false)=>{gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);gl.bufferData(gl.ARRAY_BUFFER,data,gl.DYNAMIC_DRAW);gl.enableVertexAttribArray(this.pos);gl.vertexAttribPointer(this.pos,3,gl.FLOAT,false,20,0);gl.enableVertexAttribArray(this.uv);gl.vertexAttribPointer(this.uv,2,gl.FLOAT,false,20,12);const co=Math.cos(rotation),si=Math.sin(rotation);gl.uniformMatrix3fv(u.Earth,false,Array.isArray(rotation)?rotation:[co,si,0,-si,co,0,0,0,1]);gl.uniform1i(u.Textured,textured);gl.uniform1i(u.Point,point);gl.uniform1f(u.PointSize,(point?8:1)*d);gl.uniform3fv(u.Color,color);gl.drawArrays(mode,0,data.length/5)};
  const orientation=earthMatrix(this.temporal?.earth,this.seconds)||earthAngle(this.epoch+this.seconds/86400);
  draw(this.sphere,gl.TRIANGLES,[1,1,1],orientation,true);
  if(this.showCoverage&&this.temporal){
   for(const track of this.temporal.tracks){if(!this.ids.includes(track.pair_id))continue;
    const points=[];for(const [t,lon,lat]of track.rows){if(t>this.seconds)break;const a=lat*D,b=lon*D;points.push(1.002*Math.cos(a)*Math.cos(b),1.002*Math.cos(a)*Math.sin(b),1.002*Math.sin(a),0,0)}
    if(points.length)draw(new Float32Array(points),gl.POINTS,rgb(palette[track.pair_id%palette.length]),orientation);
   }
  }
  if(this.native){
   const positions=new Map();
   for(const tr of this.trajectory?.tracks||[]){
    const focus=this.highlight==null||this.highlight===tr.pair_id?1:.22;
    const color=(tr.member==='A'?rgb(palette[tr.pair_id%palette.length]):[.96,.97,1]).map(v=>v*focus);
    for(const rows of tr.segments){const trail=rows.filter(r=>r[0]>=this.seconds-5400&&r[0]<=this.seconds).flatMap(r=>[r[1]/R,r[2]/R,r[3]/R,0,0]);if(trail.length>5)draw(new Float32Array(trail),gl.LINE_STRIP,color.map(v=>v*.5))}
    const pos=sampleTrajectory(tr,this.seconds);if(!pos)continue;
    positions.set(tr.pair_id+tr.member,pos);draw(new Float32Array([...pos,0,0]),gl.POINTS,color,0,false,true);
   }
   for(const id of this.ids){const a=positions.get(id+'A'),b=positions.get(id+'B');if(a&&b)draw(new Float32Array([...a,0,0,...b,0,0]),gl.LINES,rgb(palette[id%palette.length]))}
   return;
  }
  this.pairs.forEach((p,index)=>{const focus=this.highlight==null||this.highlight===this.ids[index]?1:.22,color=rgb(palette[this.ids[index]%palette.length]).map(v=>v*focus),path=[];for(let k=0;k<256;k++)path.push(...position(p,period(p)*k/256),0,0);draw(new Float32Array(path),gl.LINE_LOOP,color.map(x=>x*.7));const a=position(p,this.seconds,0),b=position(p,this.seconds,1);draw(new Float32Array([...a,0,0,...b,0,0]),gl.LINES,color);draw(new Float32Array([...a,0,0]),gl.POINTS,color,0,false,true);draw(new Float32Array([...b,0,0]),gl.POINTS,[.96*focus,.97*focus,focus],0,false,true)});
 }
}
const api={earthMatrix,temporalMap,R,MU,period,position,earthAngle,cameraBasis,sampleTrajectory,validate,palette,ramp,OrbitScene};if(typeof module!=='undefined')module.exports=api;root.OrbitMath=api;
})(typeof window!=='undefined'?window:globalThis);
