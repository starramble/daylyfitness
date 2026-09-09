import test from 'node:test';import assert from 'node:assert/strict';
import {exercises,animationCount,guidedCount,recommend} from './domain';
import {guideFor,sourceMatches,searchCatalog,upstreamCount} from './catalog';
import {createBodyRig} from './bodyRig';import {applyExercisePose,motionPhase} from './movement';
import raw from './data/free-exercises.json';
test('876 条来源覆盖且合并等价动作，42 份中文指导有完整执行与纠错',()=>{
 assert.equal(upstreamCount,876);assert.equal(exercises.length,882);assert.equal(animationCount,40);assert.equal(guidedCount,42);
 const ids=exercises.map(e=>e.sourceId).filter(Boolean);assert.equal(new Set(ids).size,876);
 for(const e of raw)assert.ok(ids.includes(e.id),e.id);
 for(const [id,source] of Object.entries(sourceMatches)){assert.equal(exercises.find(e=>e.id===id)?.sourceId,source);assert.ok(!exercises.some(e=>e.id===source));}
 for(const e of exercises){const g=guideFor(e.id);if(!g)continue;assert.ok(g.steps.length>=3);for(const field of ['setup','breathing','mistake','correction','easier','harder','dosage'] as const)assert.ok(g[field].trim().length>0,`${e.id}: ${field}`);}
});
test('未知器械与未覆盖肌群如实保留，不把外展肌误标为内收肌',()=>{
 for(const source of raw.filter(e=>!Object.values(sourceMatches).includes(e.id))){const e=exercises.find(e=>e.id===source.id)!;
  if(source.equipment===null)assert.equal(e.equipment,'未标注');
  for(const m of ['abductors','middle back','neck'])if([...source.primaryMuscles,...source.secondaryMuscles].includes(m))assert.ok(e.unmapped?.includes(m));
  if(source.primaryMuscles.includes('abductors'))assert.ok(!e.primary.includes('adductors'));
 }
});
test('中英检索、组合过滤与推荐均符合可用内容',()=>{
 assert.ok(searchCatalog(exercises,'卧推','哑铃','chest','中文详解').some(e=>e.id==='Dumbbell_Bench_Press'));
 assert.ok(searchCatalog(exercises,'bench press','杠铃').length>3);
 assert.equal(searchCatalog(exercises,'','全部','全部','3D演示').length,40);
 assert.equal(searchCatalog(exercises,'','全部','全部','中文详解').length,42);
 assert.deepEqual(searchCatalog(exercises,'不存在的动作'),[]);
 assert.ok(recommend(['chest'],'杠铃','不限').every(e=>guideFor(e.id)));
});
test('文字动作保持静态，不播放相似动画、不显示哑铃道具',()=>{
 const e=exercises.find(e=>e.id==='Decline_Dumbbell_Bench_Press')!,r=createBodyRig();
 assert.equal(e.motion,null);const first=applyExercisePose(r,e,0);
 const poses=r.bones.map(b=>b.quaternion.toArray());applyExercisePose(r,e,1);
 assert.deepEqual(r.bones.map(b=>b.quaternion.toArray()),poses);
 assert.ok(r.arms.every(a=>!a.weight.visible));assert.equal(first.barVisible,false);
 assert.equal(motionPhase(e.motion,50).label,'静态肌群参考');
});
