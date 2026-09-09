import test from 'node:test';
import assert from 'node:assert/strict';
import { parsePreferences } from './preferences';
test('恢复设置时忽略损坏数据和已删除的动作，保持最近查看去重', () => {
  assert.equal(parsePreferences('{broken').goal,'strength');
  assert.equal(parsePreferences('null').tab,'target');
  const p=parsePreferences(JSON.stringify({goal:'core',equipment:'杠铃',level:'入门',targets:['abs','bogus'],exerciseId:'gone',recent:['crunch','crunch','gone','Plank'],hasPlan:true}));
  assert.equal(p.goal,'core'); assert.equal(p.equipment,'杠铃'); assert.equal(p.hasPlan,true);
  assert.equal(p.exerciseId,'squat'); assert.deepEqual(p.recent,['crunch','Plank']); assert.deepEqual(p.targets,['abs']);
});


test('默认和旧版全部器械回到徒手；保留明确指定的器械与新选择', () => {
  assert.equal(parsePreferences(null).equipment, '徒手');
  assert.equal(parsePreferences(JSON.stringify({equipment:'全部',hasPlan:true})).equipment, '徒手');
  assert.equal(parsePreferences(JSON.stringify({equipment:'哑铃'})).equipment, '哑铃');
  assert.equal(parsePreferences(JSON.stringify({equipment:'全部',equipmentChosen:true})).equipment, '全部');
  const saved = parsePreferences(JSON.stringify({equipment:'徒手',equipmentChosen:false}));
  assert.equal(parsePreferences(JSON.stringify(saved)).equipment,'徒手');
});
