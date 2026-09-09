import test from "node:test";
import assert from "node:assert/strict";
import { identifyExercise, recommend, exercises, muscles } from "./domain";

test("识别中文动作描述，并保留命中依据", () => {
  const r = identifyExercise("双脚与肩同宽，臀部向后坐，屈膝下蹲，然后站起。");
  assert.equal(r[0].exercise.id, "squat");
  assert.ok(r[0].evidence.length);
  assert.equal(
    identifyExercise("手持哑铃，屈肘举起哑铃，然后慢慢放下")[0].exercise.id,
    "curl",
  );
  assert.equal(
    identifyExercise("双手撑地，屈肘降低身体再推起")[0].exercise.id,
    "pushup",
  );
});
test("空白或未知描述不猜测，多动作保留候选，忽略否定名称", () => {
  assert.deepEqual(identifyExercise("  "), []);
  assert.deepEqual(identifyExercise("做一个我新发明的动作"), []);
  assert.deepEqual(
    new Set(identifyExercise("深蹲和俯卧撑").map((r) => r.exercise.id)),
    new Set(["squat", "pushup"]),
  );
  assert.deepEqual(
    identifyExercise("不是深蹲，是哑铃弯举").map((r) => r.exercise.id),
    ["curl"],
  );
  assert.equal(identifyExercise("PUSH-UP")[0].exercise.id, "pushup");
});
test("推荐严格执行器械和难度过滤", () => {
  assert.ok(
    recommend(["quads", "glutes"], "徒手", "入门").every(
      (e) => e.equipment === "徒手" && e.difficulty === "入门",
    ),
  );
  assert.deepEqual(recommend(["biceps"], "徒手", "不限"), []);
  assert.deepEqual(recommend([], "全部", "不限"), []);
  assert.equal(recommend(["biceps"], "哑铃", "不限")[0].id, "curl");
});
test("每个动作的肌群与动画映射完整，主练和辅助不冲突", () => {
  const ids = new Set(muscles.map((m) => m.id));
  assert.equal(new Set(exercises.map((e) => e.id)).size, exercises.length);
  for (const e of exercises) {
    assert.ok(e.primary.length || e.unmapped?.length);
    for (const id of [...e.primary, ...e.secondary]) assert.ok(ids.has(id));
    assert.ok(!e.primary.some((id) => e.secondary.includes(id)));
    if (e.motion) assert.equal(e.cues.length, 3);
  }
  for (const m of muscles)
    assert.ok(
      exercises.some((e) => [...e.primary, ...e.secondary].includes(m.id)),
    );
});
test("组合语义支持改写，器械不一致须作为相近候选", () => {
  assert.equal(
    identifyExercise("拿着哑铃，手臂往两边举到肩膀高度")[0].exercise.id,
    "raise",
  );
  assert.equal(identifyExercise("我做的是杠铃深蹲")[0].exercise.id, "Barbell_Squat");
  assert.equal(identifyExercise("我做的是杠铃深蹲")[0].exercise.motion, "loadedSquat");
  assert.equal(identifyExercise("我想做哑铃深蹲")[0].exercise.id, "Dumbbell_Squat");
  assert.equal(identifyExercise("我想做壶铃深蹲")[0].level, "相近动作");
});
