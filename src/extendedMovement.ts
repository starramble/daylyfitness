import * as T from 'three';
import type { BodyRig } from './anatomyAsset';
import type { Exercise } from './domain';
import { setGrip, PROPORTIONS as P } from './bodyRig';
import { solveArm, solveLeg, applySquat, applyPushup } from './movement';
const v=(x:number,y:number,z:number)=>new T.Vector3(x,y,z);
const q=(x=0,y=0,z=0)=>new T.Quaternion().setFromEuler(new T.Euler(x,y,z));
function local(r:BodyRig,x:number,y:number,z:number){r.root.updateMatrixWorld(true);return r.torso.localToWorld(v(x,y,z));}
function gripAt(r:BodyRig,arm:BodyRig['arms'][number],point:T.Vector3,pole:T.Vector3,orientation:T.Quaternion){
 const wrist=point.clone().sub(arm.grip.position.clone().applyQuaternion(orientation));
 const solved=solveArm(r,arm,wrist,pole);arm.hand.quaternion.copy(solved.lowerQ.clone().invert().multiply(orientation));r.root.updateMatrixWorld(true);
 return arm.grip.getWorldPosition(new T.Vector3());
}
// Flexible handles and free weights follow a neutral wrist. Solve the grip
// offset together with the arm, so orientation changes cannot detach the load.
function neutralGripAt(r:BodyRig,arm:BodyRig['arms'][number],point:T.Vector3,pole:T.Vector3){
 let wrist=point.clone().add(v(0,.20,-.083));
 const palmTurn=q(0,-arm.s*Math.PI/2,0);
 for(let i=0;i<40;i++){
  const solved=solveArm(r,arm,wrist,pole);
  const orientation=solved.lowerQ.clone().multiply(palmTurn);
  const next=point.clone().sub(arm.grip.position.clone().applyQuaternion(orientation));
  if (next.distanceToSquared(wrist)<1e-16) { wrist.copy(next); break; }
  wrist.lerp(next,.65);
 }
 solveArm(r,arm,wrist,pole);arm.hand.quaternion.copy(palmTurn);r.root.updateMatrixWorld(true);
 return arm.grip.getWorldPosition(new T.Vector3());
}
function barAtHands(r:BodyRig){r.root.updateMatrixWorld(true);const pts=r.arms.map(a=>a.grip.getWorldPosition(new T.Vector3()));const bar=r.equipment.barbell;bar.visible=true;bar.position.copy(pts[0]).add(pts[1]).multiplyScalar(.5);bar.quaternion.setFromUnitVectors(v(1,0,0),pts[1].clone().sub(pts[0]).normalize());}
function benchPose(r:BodyRig,incline=0){
 const e=r.equipment;e.bench.visible=true;e.bench.position.set(0,.78,.60);e.back.rotation.x=incline;
 r.pelvis.position.set(0,1.04,.60);r.pelvis.rotation.x=-Math.PI/2+incline;r.torso.rotation.set(0,0,0);
 for(const l of r.legs)solveLeg(r,l,v(l.s*.29,.205,1.53),v(l.s*.31,1.22,1.8));
}
function seatedPose(r:BodyRig,height=1.20){
 r.pelvis.position.set(0,height,0);r.torso.rotation.x=-.06;
 const e=r.equipment;e.bench.visible=true;e.bench.position.set(0,height-.28,0);e.back.rotation.x=1.47;
 for(const l of r.legs){l.thigh.rotation.set(-Math.PI/2,0,0);l.shin.rotation.set(Math.PI/2,0,0);l.foot.rotation.set(0,0,0);}
}
function restHands(r:BodyRig){for(const arm of r.arms){const target=local(r,arm.s*.48,.03,.16);neutralGripAt(r,arm,target,local(r,arm.s*.64,.30,.12));}}
function standingHinge(r:BodyRig,a:number){
 r.pelvis.position.set(0,1.984-.354*a,-.7*a);r.torso.rotation.x=1.1*a;
 for(const l of r.legs)solveLeg(r,l,v(l.s*.25,.19,0),v(l.s*.25,.9,.8));
}
export function applyExtendedPose(r:BodyRig,exercise:Exercise,amount:number){
 const spec=exercise.animation!;const a=T.MathUtils.clamp(amount,0,1);const e=r.equipment;
 setGrip(r,spec.prop || spec.motion==='machinePress'?1:0);
 r.arms.forEach(arm=>arm.weight.visible=spec.prop==='dumbbell');
 switch(spec.motion){
 case 'benchPress':{
  benchPose(r,spec.incline);const handQ=r.torso.getWorldQuaternion(new T.Quaternion()).multiply(q(Math.PI/2,0,Math.PI));
  for(const arm of r.arms){const width=spec.grip ?? .90;const x=arm.s*(width*a+(spec.prop==='barbell'?width:.38)*(1-a));
   const topReach=spec.prop==='barbell'?Math.sqrt(1.275**2-(width-P.shoulderX)**2):1.27;
   const wrist=local(r,x,.99-(spec.grip?.51:.55)*a,topReach*(1-a)+(spec.grip?.59:.25)*a);
   const solved=solveArm(r,arm,wrist,local(r,arm.s*(spec.grip?.8:1.0),.50,-.15));arm.hand.quaternion.copy(solved.lowerQ.clone().invert().multiply(handQ));
  }
  if(spec.prop==='barbell')barAtHands(r);break;
 }
 case 'benchFly':{
  benchPose(r);const theta=-.10+a*(Math.PI/2+.03);
  for(const arm of r.arms){const wrist=local(r,arm.s*(P.shoulderX+1.235*Math.sin(theta)),.90,1.235*Math.cos(theta));solveArm(r,arm,wrist,local(r,arm.s*.95,.6,.2));arm.hand.rotation.set(0,-arm.s*Math.PI/2,0);}break;
 }
 case 'lyingExtension':{
  benchPose(r);for(const arm of r.arms){arm.upper.rotation.set(-Math.PI/2,0,arm.s*.07);arm.lower.rotation.set(-1.65*a,0,0);arm.hand.rotation.set(0,-arm.s*Math.PI/2,0);}break;
 }
 case 'machinePress':{
  seatedPose(r);for(const [i,arm] of r.arms.entries()){
   const target=local(r,arm.s*(.60-.12*a),.73+.15*a,.37+1.05*a);const handQ=q(0,0,Math.PI);
   const point=neutralGripAt(r,arm,target,local(r,arm.s*.86,.42,.12));arm.hand.getWorldQuaternion(handQ);const h=e.handles[i];h.visible=true;h.position.copy(point);h.quaternion.copy(handQ);
   e.link(i,v(arm.s*.8,.40,-.13),point);
  }break;
 }
 case 'loadedSquat':{
  applySquat(r,a);
  if(spec.prop==='dumbbell'){
   const inverse=r.torso.getWorldQuaternion(new T.Quaternion()).invert();for(const arm of r.arms){arm.upper.quaternion.copy(inverse);arm.lower.rotation.x=-.05;arm.hand.rotation.y=-arm.s*Math.PI/2;}
  }else if(spec.prop==='kettlebell'){
   for(const arm of r.arms)neutralGripAt(r,arm,local(r,arm.s*.11,.67,.46),local(r,arm.s*.57,.33,.25));
   const pts=r.arms.map(arm=>arm.grip.getWorldPosition(new T.Vector3()));e.kettle.visible=true;e.kettle.position.copy(pts[0]).add(pts[1]).multiplyScalar(.5);e.kettle.quaternion.identity();
  }else{
   const front=spec.stance==='front';const handQ=r.torso.getWorldQuaternion(new T.Quaternion()).multiply(front?q(2*Math.PI/3,Math.PI):q(0,0,Math.PI));
   for(const arm of r.arms)gripAt(r,arm,local(r,arm.s*(front?.70:.72),front?.88:.96,front?.19:-.16),local(r,arm.s*(front?.50:.80),front?.90:.40,front?.90:-.20),handQ);
   barAtHands(r);
  }break;
 }
 case 'barDeadlift':case 'barHinge':{
  if(spec.motion==='barHinge')standingHinge(r,a);else{
   r.pelvis.position.set(0,1.10+.884*a,-.42*(1-a));r.torso.rotation.x=.95*(1-a);
   for(const l of r.legs)solveLeg(r,l,v(l.s*.26,.19,0),v(l.s*.29,.8,.85));
  }
  for(const arm of r.arms){const sh=arm.upper.getWorldPosition(new T.Vector3());const dx=arm.s*.51-sh.x,dz=.22+.083-sh.z;const y=sh.y-Math.sqrt(1.278**2-dx*dx-dz*dz)-.20;
   gripAt(r,arm,v(arm.s*.51,y,.22),v(arm.s*.62,y+.66,.12),q(0,Math.PI));}
  barAtHands(r);break;
 }
 case 'hammerCurl':{
  for(const arm of r.arms){arm.upper.rotation.set(0,0,arm.s*.07);arm.lower.rotation.x=-.07-2.12*a;arm.hand.rotation.y=-arm.s*Math.PI/2;}break;
 }
 case 'reverseFly':{
  standingHinge(r,.80);for(const arm of r.arms){const sh=arm.upper.getWorldPosition(new T.Vector3());const angle=a*Math.PI/2;const target=sh.clone().add(v(arm.s*1.24*Math.sin(angle),-1.24*Math.cos(angle),-.04));solveArm(r,arm,target,sh.clone().add(v(0,0,-.8)));arm.hand.rotation.set(0,-arm.s*Math.PI/2,0);}break;
 }
 case 'facePull':{
  e.frame.visible=true;e.frame.position.set(0,0,2.1);
  for(const [i,arm] of r.arms.entries()){const handQ=q(0,0,Math.PI);const point=neutralGripAt(r,arm,v(arm.s*(.13+.36*a),3.36,1.38-1.04*a),v(arm.s*1.0,3.20,.05));arm.hand.getWorldQuaternion(handQ);e.cable(i,v(0,3.45,2.1),point,handQ);}break;
 }
 case 'latPulldown':{
  seatedPose(r,1.20);e.frame.visible=true;e.frame.position.set(0,0,.80);e.thighPad.visible=true;e.thighPad.position.set(0,1.31,.46);
  for(const [i,arm] of r.arms.entries()){const handQ=q(0,0,Math.PI);const width=spec.crossed?-.22*(1-a)+.45*a:spec.grip!;const point=neutralGripAt(r,arm,v(arm.s*width,3.62-1.20*a,.18+.20*a),v(arm.s*.85,1.65,.08));arm.hand.getWorldQuaternion(handQ);e.cable(i,v(spec.crossed?-arm.s*.80:0,4.10,.80),point,handQ);}break;
 }
 case 'cableExtension':{
  e.frame.visible=true;e.frame.position.set(0,0,-1.3);
  for(const [i,arm] of r.arms.entries()){const handQ=q(0,0,Math.PI);const point=neutralGripAt(r,arm,v(arm.s*.17,3.4+1.06*a,-.43+.48*a),v(arm.s*.48,3.86,.30));arm.hand.getWorldQuaternion(handQ);e.cable(i,v(0,.3,-1.3),point,handQ);}break;
 }
 case 'legExtension':case 'seatedLegCurl':{
  seatedPose(r);const extension=spec.motion==='legExtension'?a:1-a;
  for(const l of r.legs){l.thigh.rotation.set(-Math.PI/2,0,0);l.shin.rotation.x=(1-extension)*Math.PI/2;l.foot.rotation.set(0,0,0);}
  restHands(r);r.root.updateMatrixWorld(true);const foot=r.legs[0].foot.getWorldPosition(new T.Vector3());const shinQ=r.legs[0].shin.getWorldQuaternion(new T.Quaternion());
  e.roller.visible=true;e.roller.position.copy(foot).add(v(0,.12,spec.motion==='legExtension'?.08:-.08).applyQuaternion(shinQ));e.roller.position.x=0;
  e.thighPad.visible=true;e.thighPad.position.set(0,1.24,.47);e.link(0,v(-.65,.52,.84),e.roller.position.clone().add(v(-.48,0,0)));break;
 }
 case 'lyingLegCurl':{
  r.pelvis.position.set(0,1.10,0);r.pelvis.rotation.x=Math.PI/2;e.bench.visible=true;e.bench.position.set(0,.83,-.48);e.bench.rotation.y=Math.PI;
  for(const l of r.legs){l.thigh.rotation.set(0,0,0);l.shin.rotation.x=1.85*a;l.foot.rotation.set(0,0,0);}
  for(const arm of r.arms)neutralGripAt(r,arm,local(r,arm.s*.54,.68,.20),local(r,arm.s*.68,.30,.10));
  r.root.updateMatrixWorld(true);const foot=r.legs[0].foot.getWorldPosition(new T.Vector3());const shinQ=r.legs[0].shin.getWorldQuaternion(new T.Quaternion());e.roller.visible=true;e.roller.position.copy(foot).add(v(0,.12,-.09).applyQuaternion(shinQ));e.roller.position.x=0;break;
 }
 case 'legPress':{
  r.pelvis.position.set(0,.78,-.65);r.pelvis.rotation.x=-Math.PI/4;e.bench.visible=true;e.bench.position.set(0,.51,-.65);e.back.rotation.x=Math.PI/4;
  const direction=v(0,Math.SQRT1_2,Math.SQRT1_2);const distance=1.62-.64*a;
  const hipMid=v(0,.78-.11*Math.SQRT1_2,-.65+.11*Math.SQRT1_2);
  for(const l of r.legs)solveLeg(r,l,hipMid.clone().addScaledVector(direction,distance).add(v(l.s*.27,0,0)),v(l.s*.46,1.9,-.1),-3*Math.PI/4);
  restHands(r);r.root.updateMatrixWorld(true);const soles=r.legs.map(l=>l.foot.localToWorld(v(0,-.175,.10)));e.footPlate.visible=true;e.footPlate.position.copy(soles[0]).add(soles[1]).multiplyScalar(.5).addScaledVector(direction,.05);e.footPlate.rotation.x=-3*Math.PI/4;
  e.rails.visible=true;e.rails.position.set(0,1.05,.35);break;
 }
 case 'loadedLunge':{
  // One complete forward-lunge repetition: step out, descend, rise, step back.
  const stride=T.MathUtils.smoothstep(a,0,.28);const depth=T.MathUtils.smoothstep(a,.28,1);
  r.pelvis.position.set(0,1.984-.18*stride-.40*depth,.20*stride);
  for(const l of r.legs){const lead=l.s<0;const lift=lead?.20*Math.sin(Math.PI*stride):0;
   solveLeg(r,l,v(l.s*.25,.19+(lead?lift:.17*Math.cos(.6*stride)+.34*Math.sin(.6*stride)-.17),lead?.95*stride:0),v(l.s*.28,.8,1.6),lead?0:.6*stride);}
  for(const arm of r.arms){arm.upper.rotation.set(0,0,arm.s*.08);arm.lower.rotation.x=-.06;arm.hand.rotation.y=-arm.s*Math.PI/2;}break;
 }
 case 'inclinePushup':{
  applyPushup(r,a,1.20);e.platform.visible=true;e.platform.position.set(0,1.20,r.arms[0].hand.getWorldPosition(new T.Vector3()).z+.24);break;
 }
 case 'plank':{
  const ankle=v(0,.314,-1.65);const length=P.thigh+P.shin-P.hipOffset+P.torsoOffset+P.shoulderY;const alpha=Math.asin((.815-ankle.y)/length);const tilt=Math.PI/2-alpha;
  r.pelvis.rotation.x=tilt;r.pelvis.position.copy(ankle).addScaledVector(v(0,Math.sin(alpha),Math.cos(alpha)),P.thigh+P.shin-P.hipOffset);
  for(const l of r.legs){l.thigh.rotation.set(0,0,0);l.shin.rotation.set(0,0,0);l.foot.rotation.x=.35-tilt;}
  r.root.updateMatrixWorld(true);
  for(const arm of r.arms){const sh=arm.upper.getWorldPosition(new T.Vector3());const result=solveArm(r,arm,v(sh.x,.115,sh.z+.58),v(sh.x,.115,sh.z));arm.hand.quaternion.copy(result.lowerQ.clone().invert().multiply(q(Math.PI/2,0,Math.PI)));}
  break;
 }
 }
 if(e.bench.visible)e.updateSupport();
 r.root.updateMatrixWorld(true);
}
