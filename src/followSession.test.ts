import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTrainingPlan } from './trainingPlan';
import { buildSession, advanceSession, doseValues, sessionSample } from './followSession';
import { exercises } from './domain';
const plan = buildTrainingPlan({ goal:'core', targets:[], equipment:'徒手', level:'入门' });

test('按计划下限编排组次，平板计时，组间与换动作休息完整', () => {
  const stages = buildSession(plan, { cycleSeconds:6, warmup:true });
  assert.equal(stages[0].duration, 60);
  const work = stages.filter(s => s.kind === 'work');
  assert.equal(work.length, 4);
  assert.deepEqual(work.map(s => [s.exercise!.id, s.duration]), [['crunch',48],['crunch',48],['Plank',15],['Plank',15]]);
  assert.equal(stages.filter(s => s.kind === 'rest').length,3);
  assert.ok(stages.filter(s => s.kind === 'rest').every(s => s.duration === 45));
  assert.equal(stages.at(-1)?.kind,'cooldown');
  assert.deepEqual(doseValues('2–3 组 × 每侧 8–12 次'), { sets:2, work:8, hold:false });
});

test('次数与模型相位来自同一时间，暂停不消耗时间，末次结束才进入休息', () => {
  const stages = buildSession(plan, { cycleSeconds:4, warmup:false });
  const initial = { index:0, elapsed:0, done:false };
  const work = advanceSession(stages,initial,15);
  assert.equal(stages[work.index].kind,'work');
  assert.equal(sessionSample(stages[work.index],2,4).phase,50);
  assert.equal(sessionSample(stages[work.index],3.99,4).completed,0);
  assert.equal(sessionSample(stages[work.index],4,4).completed,1);
  assert.deepEqual(advanceSession(stages,work,0),work);
  const nearEnd=advanceSession(stages,work,31.99);
  assert.equal(stages[nearEnd.index].kind,'work');
  assert.equal(sessionSample(stages[nearEnd.index],nearEnd.elapsed,4).rep,8);
  const rest=advanceSession(stages,work,32);
  assert.equal(stages[rest.index].kind,'rest');
  assert.equal(rest.elapsed,0);
});

test('单侧动作每组两侧各计次数，第二侧有独立换侧环节', () => {
  const lunge = { ...plan, exercises:[{exercise:exercises.find(e=>e.id==='lunge')!,dose:'2 组 × 每侧 8–12 次',rest:'组间休息 60–90 秒'}],aerobic:null };
  const stages = buildSession(lunge,{cycleSeconds:4,warmup:false});
  assert.deepEqual(stages.filter(s=>s.kind==='work').map(s=>[s.set,s.side,s.duration]),[[1,1,32],[1,2,32],[2,1,32],[2,2,32]]);
  assert.equal(stages.filter(s=>s.kind==='switch').length,2);
});

test('心肺走完有氧与放松后结束；不同计时步长不会增加或丢失组数', () => {
  const cardio = buildTrainingPlan({goal:'cardio',targets:[],equipment:'全部',level:'入门'});
  const stages = buildSession(cardio,{cycleSeconds:6,warmup:false});
  assert.deepEqual(stages.map(s=>[s.kind,s.duration]),[['aerobic',600],['cooldown',180]]);
  let clock={index:0,elapsed:0,done:false};
  for(let n=0;n<7800;n++) clock=advanceSession(stages,clock,.1);
  assert.ok(clock.done || (clock.index===1 && clock.elapsed>179.99));
  assert.equal(advanceSession(stages,clock,.01).done,true);
  assert.deepEqual(advanceSession(stages,{index:0,elapsed:0,done:false},780),{index:2,elapsed:0,done:true});
});


test('默认热身一分钟并使用匹配口令，跳过后直接进入动作准备', () => {
  const short = buildSession(plan, { cycleSeconds:6, warmup:true });
  assert.equal(short[0].duration, 60);
  assert.equal(short[0].voice, 'warmup-short');
  assert.match(short[0].cue, /1 分钟/);
  const after = advanceSession(short, {index:0,elapsed:0,done:false}, 60);
  assert.equal(short[after.index].kind, 'prepare');
  const direct = buildSession(plan, { cycleSeconds:6, warmup:false });
  assert.equal(direct[0].kind, 'prepare');
  assert.equal(short.reduce((s,item)=>s+item.duration,0) - direct.reduce((s,item)=>s+item.duration,0),60);
});
