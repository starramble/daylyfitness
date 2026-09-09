import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import { createBodyRig, distributeForearmTwist } from './bodyRig';
import { applyExercisePose, solveArm } from './movement';
import { exercises } from './domain';
const down=new T.Vector3(0,-1,0);
const world=(b:T.Object3D)=>b.getWorldQuaternion(new T.Quaternion());
const pose=(id:string)=>exercises.find(e=>e.id===id)!;
test('40 个动作完整循环：肘膝按同一弯曲轴运动，腕部不反折，分段转掌无突跳',()=>{
 const r=createBodyRig();
 for(const e of exercises.filter(e=>e.motion)){
  let previous:T.Quaternion[]=[];
  for(let frame=0;frame<=200;frame++){
   applyExercisePose(r,e,(1-Math.cos(frame/200*Math.PI*2))/2);
   for(const arm of r.arms){
    assert.ok(Math.hypot(arm.lower.quaternion.y,arm.lower.quaternion.z)<1e-8,e.id+'肘关节外翻');
    assert.ok(arm.lower.rotation.x<=1e-8 && arm.lower.rotation.x>=-T.MathUtils.degToRad(150),e.id+'肘关节反伸或过屈');
    assert.ok(down.angleTo(down.clone().applyQuaternion(arm.hand.quaternion))<=T.MathUtils.degToRad(85),e.id+'手腕反折');
    assert.ok(Math.abs(arm.hand.quaternion.y)<1e-8,e.id+'转掌不应集中在腕部');
    const axial=arm.twists.reduce((sum,b)=>sum+b.rotation.y,0)*arm.s;
    // Bind pose has palms forward (supinated), rather than a neutral handshake.
    assert.ok(axial<=1e-8 && axial>=-Math.PI-1e-8,e.id+'前臂旋转超出绑定姿势至旋前的范围');
   }
   for(const leg of r.legs)assert.ok(Math.hypot(leg.shin.quaternion.y,leg.shin.quaternion.z)<1e-8,e.id+'膝关节轴外翻');
   const current=r.bones.map(world);
   if(previous.length)current.forEach((q,i)=>assert.ok(q.angleTo(previous[i])<T.MathUtils.degToRad(8),e.id+' '+r.bones[i].name+'逐帧突跳'));
   previous=current;
  }
 }
});
test('握姿：推举掌心朝前、锤式弯举掌心相对、侧平举顶部掌心朝下',()=>{
 const r=createBodyRig();
 for(const amount of [0,.25,.5,.75,1]){
  for(const id of ['press','Dumbbell_Bench_Press']){
   applyExercisePose(r,pose(id),amount);
   for(const arm of r.arms)assert.ok(new T.Vector3(0,0,1).applyQuaternion(world(arm.hand)).z>.99,id+'掌心应朝前');
  }
  applyExercisePose(r,pose('Hammer_Curls'),amount);
  for(const arm of r.arms)assert.ok(new T.Vector3(0,0,1).applyQuaternion(world(arm.hand)).x*arm.s<-.99);
 }
 applyExercisePose(r,pose('raise'),1);
 for(const arm of r.arms)assert.ok(new T.Vector3(0,0,1).applyQuaternion(world(arm.hand)).y<-.98);
});
test('前臂分段旋转不改变腕点、掌面和握持点，不传给肱骨或尺骨',()=>{
 const r=createBodyRig(),a=r.arms[1];a.lower.rotation.x=-1.2;a.hand.rotation.set(.25,-1.6,.10);r.root.updateMatrixWorld(true);
 const wrist=a.hand.getWorldPosition(new T.Vector3()),grip=a.grip.getWorldPosition(new T.Vector3()),palm=world(a.hand),upper=world(a.upper),ulna=world(a.lower);
 distributeForearmTwist(r);r.root.updateMatrixWorld(true);
 assert.ok(wrist.distanceTo(a.hand.getWorldPosition(new T.Vector3()))<1e-8);
 assert.ok(grip.distanceTo(a.grip.getWorldPosition(new T.Vector3()))<1e-8);
 for(const [before,after] of [[palm,world(a.hand)],[upper,world(a.upper)],[ulna,world(a.lower)]])assert.ok(before.angleTo(after)<1e-7);
});
test('IK 对共线肘部方向与不可达目标返回有限、等长的姿势',()=>{
 const r=createBodyRig(),arm=r.arms[1],shoulder=arm.upper.getWorldPosition(new T.Vector3());
 for(const offset of [new T.Vector3(0,-3,0),new T.Vector3(0,-.001,0),new T.Vector3()]){
  const target=shoulder.clone().add(offset);solveArm(r,arm,target,target);r.root.updateMatrixWorld(true);
  assert.ok(r.bones.every(b=>b.quaternion.toArray().every(Number.isFinite)));
  assert.ok(Math.abs(arm.lower.getWorldPosition(new T.Vector3()).distanceTo(arm.hand.getWorldPosition(new T.Vector3()))-.58)<1e-8);
 }
});

test('从推举切换到其他动作不会遗留旋转顺序或前臂扭转',()=>{
 const reused=createBodyRig(),fresh=createBodyRig();
 for(const e of exercises.filter(e=>e.motion)){
  applyExercisePose(reused,pose('press'),.8);
  applyExercisePose(reused,e,.4);
  applyExercisePose(fresh,e,.4);
  reused.bones.forEach((b,i)=>assert.ok(world(b).angleTo(world(fresh.bones[i]))<1e-7,e.id+'切换后姿势与直接进入不一致'));
 }
});
