import * as T from 'three';
import {createBodyRig} from '../src/bodyRig';
import {exercises} from '../src/domain';
import {applyExercisePose} from '../src/movement';
const r=createBodyRig(), down=new T.Vector3(0,-1,0);
const report=[];
for(const e of exercises.filter(e=>e.motion)){
 let elbowOff=0,wristBend=0,upperJump=0,handJump=0,twist=0;let prev:T.Quaternion[][]=[];
 for(let k=0;k<=200;k++){
  applyExercisePose(r,e,(1-Math.cos(k/200*Math.PI*2))/2);
  r.arms.forEach((a,i)=>{elbowOff=Math.max(elbowOff,Math.hypot(a.lower.quaternion.y,a.lower.quaternion.z));twist=Math.max(twist,Math.abs(a.twists.reduce((sum,b)=>sum+b.rotation.y,0))*180/Math.PI);wristBend=Math.max(wristBend,down.angleTo(down.clone().applyQuaternion(a.hand.quaternion))*180/Math.PI);const qs=[a.upper.quaternion.clone(),a.hand.getWorldQuaternion(new T.Quaternion())];if(prev[i]){upperJump=Math.max(upperJump,prev[i][0].angleTo(qs[0])*180/Math.PI);handJump=Math.max(handJump,prev[i][1].angleTo(qs[1])*180/Math.PI);}prev[i]=qs;});
 }
 report.push({id:e.id,twist:+twist.toFixed(1),elbowOff:+elbowOff.toFixed(4),wristBend:+wristBend.toFixed(1),upperJump:+upperJump.toFixed(1),handJump:+handJump.toFixed(1)});
}
console.log(JSON.stringify(report,null,2));
