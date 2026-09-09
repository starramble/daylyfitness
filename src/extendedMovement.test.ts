import test from 'node:test';import assert from 'node:assert/strict';import * as T from 'three';
import {exercises} from './domain';import {createBodyRig,PROPORTIONS as P} from './bodyRig';import {applyExercisePose} from './movement';import {animationProfiles} from './animationProfiles';
const point=(o:T.Object3D)=>o.getWorldPosition(new T.Vector3());
const exercise=(id:string)=>exercises.find(e=>e.id===id)!;
function elbow(r:ReturnType<typeof createBodyRig>){const a=r.arms[0];return point(a.upper).sub(point(a.lower)).angleTo(point(a.hand).sub(point(a.lower)));}
function snapshot(r:ReturnType<typeof createBodyRig>){return r.bones.flatMap(b=>[...b.position.toArray(),...b.quaternion.toArray()]);}
test('新增26个完整循环均能回到起点，动态动作确有位移，切换后器械不残留',()=>{
 const r=createBodyRig();assert.equal(Object.keys(animationProfiles).length,26);
 for(const id of Object.keys(animationProfiles)){
  const e=exercise(id);applyExercisePose(r,e,0);const initial=snapshot(r);let amplitude=0;
  for(const a of [.1,.25,.5,.75,1,.75,.5,.25,0]){applyExercisePose(r,e,a);const pose=snapshot(r);assert.ok(pose.every(Number.isFinite));amplitude=Math.max(amplitude,...pose.map((x,i)=>Math.abs(x-initial[i])));
   for(const arm of r.arms){assert.ok(Math.abs(point(arm.upper).distanceTo(point(arm.lower))-P.upperArm)<1e-6);assert.ok(Math.abs(point(arm.lower).distanceTo(point(arm.hand))-P.forearm)<1e-6);}
  }
  assert.ok(snapshot(r).every((n,i)=>Math.abs(n-initial[i])<1e-8),id+'没有闭合');
  if(e.motion!=='plank')assert.ok(amplitude>.15,id+'未发生有效运动');else assert.ok(amplitude<1e-8,'等长支撑不应虚构反复屈伸');
  applyExercisePose(r,e,.5,'explore');assert.ok(r.equipment.group.children.every(o=>!o.visible));assert.ok(r.arms.every(a=>!a.weight.visible));
 }
});
test('负重深蹲足部固定，杠铃始终落在设定架位，双手不滑离杠轴',()=>{
 for(const id of ['Barbell_Squat','Front_Barbell_Squat','Goblet_Squat','Dumbbell_Squat']){
  const r=createBodyRig(),e=exercise(id);applyExercisePose(r,e,0);const feet=r.legs.map(l=>point(l.foot));
  for(const a of [0,.25,.5,.75,1]){applyExercisePose(r,e,a);r.legs.forEach((l,i)=>assert.ok(point(l.foot).distanceTo(feet[i])<1e-6));
   if(e.animation?.prop==='barbell'){const target=r.torso.localToWorld(new T.Vector3(0,e.animation.stance==='front'?.88:.96,e.animation.stance==='front'?.19:-.16));assert.ok(point(r.equipment.barbell).distanceTo(target)<1e-5,id+'杠位偏离');for(const arm of r.arms){const p=r.equipment.barbell.worldToLocal(point(arm.grip));assert.ok(Math.hypot(p.y,p.z)<1e-6);}}
  }
 }
});
test('硬拉全程肘接近伸直，足部稳定，负重靠近腿部且不穿地',()=>{
 for(const id of ['Barbell_Deadlift','Romanian_Deadlift']){const r=createBodyRig(),e=exercise(id);applyExercisePose(r,e,0);const feet=r.legs.map(l=>point(l.foot));for(const a of [0,.1,.25,.5,.75,1]){applyExercisePose(r,e,a);assert.ok(elbow(r)>T.MathUtils.degToRad(170),id+'不应弯举杠铃');assert.ok(r.equipment.barbell.position.y>=.32);assert.ok(Math.abs(r.equipment.barbell.position.z-.22)<1e-5);r.legs.forEach((l,i)=>assert.ok(point(l.foot).distanceTo(feet[i])<1e-6));}}
});
test('卧推与飞鸟具有受控幅度，足部固定，卧推顶端伸肘而底端不过度折叠',()=>{
 for(const id of ['Barbell_Bench_Press_-_Medium_Grip','Dumbbell_Bench_Press','Barbell_Incline_Bench_Press_-_Medium_Grip','Close-Grip_Barbell_Bench_Press']){const r=createBodyRig(),e=exercise(id);applyExercisePose(r,e,0);const feet=r.legs.map(l=>point(l.foot)),top=point(r.arms[0].grip).y;assert.ok(elbow(r)>T.MathUtils.degToRad(160),id+'顶部应接近伸肘');applyExercisePose(r,e,1);assert.ok(elbow(r)>T.MathUtils.degToRad(65)&&elbow(r)<T.MathUtils.degToRad(115),id+'底部屈肘不合理');assert.ok(top-point(r.arms[0].grip).y>.45);r.legs.forEach((l,i)=>assert.ok(point(l.foot).distanceTo(feet[i])<1e-6));}
 const r=createBodyRig();applyExercisePose(r,exercise('Dumbbell_Flyes'),0);const closed=point(r.arms[0].hand).distanceTo(point(r.arms[1].hand));applyExercisePose(r,exercise('Dumbbell_Flyes'),1);assert.ok(point(r.arms[0].hand).distanceTo(point(r.arms[1].hand))>closed+2);
});
test('上斜俯卧撑双手固定在支撑面，平板支撑肘腕稳定落地',()=>{
 const r=createBodyRig(),e=exercise('Incline_Push-Up');applyExercisePose(r,e,0);const hands=r.arms.map(a=>point(a.hand)),feet=r.legs.map(l=>point(l.foot));let top=0;
 for(const a of [0,.25,.5,.75,1]){applyExercisePose(r,e,a);if(!a)top=point(r.arms[0].upper).y;else if(a===1)assert.ok(top-point(r.arms[0].upper).y>.4);r.arms.forEach((arm,i)=>assert.ok(point(arm.hand).distanceTo(hands[i])<1e-6));r.legs.forEach((l,i)=>assert.ok(point(l.foot).distanceTo(feet[i])<1e-6));assert.equal(r.equipment.platform.position.y,1.2);}
 applyExercisePose(r,exercise('Plank'),.5);for(const arm of r.arms){assert.ok(Math.abs(point(arm.lower).y-.115)<1e-5);assert.ok(Math.abs(point(arm.hand).y-.115)<1e-5);}assert.ok(Math.abs(elbow(r)-Math.PI/2)<1e-5);
});
test('坐姿腿部器械保持骨盆与膝轴，脚踏板跟随足底而非悬空',()=>{
 for(const id of ['Leg_Extensions','Seated_Leg_Curl']){const r=createBodyRig(),e=exercise(id);applyExercisePose(r,e,0);const hip=point(r.pelvis),knees=r.legs.map(l=>point(l.shin));for(const a of [0,.25,.5,.75,1]){applyExercisePose(r,e,a);assert.ok(point(r.pelvis).distanceTo(hip)<1e-8);r.legs.forEach((l,i)=>assert.ok(point(l.shin).distanceTo(knees[i])<1e-8));}}
 const r=createBodyRig();for(const a of [0,.25,.5,.75,1]){applyExercisePose(r,exercise('Leg_Press'),a);const planeNormal=new T.Vector3(0,1,0).applyQuaternion(r.equipment.footPlate.quaternion);for(const leg of r.legs){const sole=leg.foot.localToWorld(new T.Vector3(0,-.175,.1));const d=sole.sub(r.equipment.footPlate.position).dot(planeNormal);assert.ok(Math.abs(d-.05)<1e-6);}}
});
