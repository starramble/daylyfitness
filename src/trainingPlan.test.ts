import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTrainingPlan, trainingPlanPayload, trainingGoals, isEquipmentFree, type PlanOptions } from './trainingPlan';
import { equipmentOptions, recommend } from './domain';
import { guideFor } from './catalog';
const defaults: PlanOptions = { goal: 'muscle', targets: ['quads', 'glutes'], equipment: '全部', level: '不限' };

test('腹肌目标只选直接训练核心的动作，等长保持使用秒数', () => {
  const plan = buildTrainingPlan({ ...defaults, goal: 'core' });
  assert.deepEqual(new Set(plan.exercises.map(i => i.exercise.id)), new Set(['crunch', 'Plank']));
  assert.match(plan.exercises.find(i => i.exercise.id === 'Plank')!.dose, /秒/);
  assert.ok(plan.exercises.every(i => i.exercise.primary.includes('abs')));
  assert.equal(plan.aerobic, null);
});

test('减脂包含力量与有氧，心肺独立于此前肌群和器械筛选', () => {
  const fat = buildTrainingPlan({ ...defaults, goal: 'fatLoss' });
  assert.equal(fat.exercises.length, 4);
  assert.ok(fat.aerobic);
  assert.equal(new Set(fat.exercises.map(i => i.exercise.motion)).size, 4);
  const cardio = buildTrainingPlan({ goal: 'cardio', targets: [], equipment: '杠铃', level: '入门' });
  assert.equal(cardio.exercises.length, 0);
  assert.equal(cardio.aerobic?.duration, '10–15 分钟');
  assert.equal(cardio.aerobic?.has3D, false);
  assert.match(cardio.aerobic!.intensity, /完整句子/);
  assert.notEqual(cardio.aerobic?.duration, buildTrainingPlan({ ...defaults, goal: 'cardio' }).aerobic?.duration);
});

test('每个目标都遵守器械难度且仅使用已有动画和中文指导', () => {
  for (const goal of trainingGoals) for (const equipment of equipmentOptions) for (const level of ['入门', '不限'] as const) {
    const plan = buildTrainingPlan({ ...defaults, goal: goal.id, equipment, level });
    assert.equal(new Set(plan.exercises.map(i => i.exercise.id)).size, plan.exercises.length);
    for (const { exercise: e } of plan.exercises) {
      assert.equal(e.equipment, equipment);
      assert.ok(e.motion && guideFor(e.id));
      if (level === '入门') assert.equal(e.difficulty, '入门');
    }
  }
  const unavailable = buildTrainingPlan({ ...defaults, goal: 'core', equipment: '杠铃' });
  assert.equal(unavailable.exercises.length, 0);
  assert.ok(unavailable.notes.some(n => n.includes('没有合适')));
  const partial = buildTrainingPlan({ ...defaults, goal: 'strength', equipment: '徒手', level: '入门' });
  assert.ok(partial.notes.some(n => n.includes('上肢拉')));
});

test('原肌群推荐保持兼容，目标导出与页面剂量休息一致', () => {
  const custom = buildTrainingPlan(defaults);
  assert.deepEqual(custom.exercises.map(i => i.exercise.id), recommend(defaults.targets, defaults.equipment ?? "徒手", defaults.level).map(e => e.id));
  assert.equal(buildTrainingPlan({ ...defaults, targets: [] }).exercises.length, 0);
  const options: PlanOptions = { ...defaults, goal: 'fatLoss', level: '入门' };
  const plan = buildTrainingPlan(options);
  const payload = trainingPlanPayload(plan, options);
  assert.equal(payload.goal.id, 'fatLoss');
  assert.deepEqual(payload.targets, []);
  assert.deepEqual(payload.exercises.map(e => [e.setsAndReps, e.rest]), plan.exercises.map(e => [e.dose, e.rest]));
  assert.deepEqual(payload.aerobic, plan.aerobic);
  assert.ok(payload.exercises.every(e => e.guidance && e.has3D));
});


test('未指定器械时所有目标只安排无需支撑器械的动作，明确选择器械才启用', () => {
  for (const goal of trainingGoals) for (const level of ['不限', '入门'] as const) {
    const plan = buildTrainingPlan({goal:goal.id, targets:['quads','chest','lats'], level});
    assert.ok(plan.exercises.every(item => isEquipmentFree(item.exercise)));
    assert.ok(!plan.exercises.some(item => item.exercise.id === 'Incline_Push-Up'));
  }
  const free = buildTrainingPlan({goal:'strength',targets:[],level:'入门'});
  assert.ok(free.exercises.length > 0);
  assert.ok(free.notes.some(note => note.includes('上肢拉')));
  const weighted = buildTrainingPlan({goal:'strength',targets:[],level:'入门',equipment:'哑铃'});
  assert.ok(weighted.exercises.length > 0);
  assert.ok(weighted.exercises.every(item => item.exercise.equipment === '哑铃'));
  assert.equal(trainingPlanPayload(free,{goal:'strength',targets:[],level:'入门'}).equipment,'徒手');
});
