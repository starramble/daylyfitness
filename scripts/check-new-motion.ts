import {createBodyRig} from '../src/bodyRig';import {exercises} from '../src/domain';import {applyExercisePose} from '../src/movement';import * as T from 'three';
for(const id of ['Romanian_Deadlift','Barbell_Deadlift','Dumbbell_Bench_Press','Plank']){
 const r=createBodyRig(),e=exercises.find(e=>e.id===id)!;
 for(const amount of [0,.5,1]){applyExercisePose(r,e,amount);const a=r.arms[0];const sh=a.upper.getWorldPosition(new T.Vector3()),el=a.lower.getWorldPosition(new T.Vector3()),wr=a.hand.getWorldPosition(new T.Vector3());console.log(id,amount,'elbow',T.MathUtils.radToDeg(sh.clone().sub(el).angleTo(wr.clone().sub(el))).toFixed(1),'hand',wr.toArray().map(n=>n.toFixed(2)),'shoulder',sh.toArray().map(n=>n.toFixed(2)));}
}
