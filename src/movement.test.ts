import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { createBodyRig, PROPORTIONS } from "./bodyRig";
import { applySquat, muscleAppearance, motionPhase } from "./movement";

test("整个深蹲周期中脚部固定，足底朝向稳定，骨段不伸缩", () => {
  const rig = createBodyRig();
  let first: THREE.Vector3[] = [];
  for (let i = 0; i <= 100; i++) {
    const amount = (1 - Math.cos((i / 100) * Math.PI * 2)) / 2;
    applySquat(rig, amount);
    const anchors = rig.legs.map((l) =>
      l.foot.getWorldPosition(new THREE.Vector3()),
    );
    if (i === 0) first = anchors.map((a) => a.clone());
    rig.legs.forEach((l, j) => {
      const hip = l.thigh.getWorldPosition(new THREE.Vector3()),
        knee = l.shin.getWorldPosition(new THREE.Vector3()),
        ankle = anchors[j];
      assert.ok(ankle.distanceTo(first[j]) < 1e-6, "踝点不得随深蹲滑动或离地");
      assert.ok(Math.abs(hip.distanceTo(knee) - PROPORTIONS.thigh) < 1e-6);
      assert.ok(Math.abs(knee.distanceTo(ankle) - PROPORTIONS.shin) < 1e-6);
      const up = new THREE.Vector3(0, 1, 0).applyQuaternion(
        l.foot.getWorldQuaternion(new THREE.Quaternion()),
      );
      assert.ok(
        up.distanceTo(new THREE.Vector3(0, 1, 0)) < 1e-6,
        "脚底不得抬起或翻转",
      );
      const hipAnkleLine = hip.x + (ankle.x - hip.x) * (hip.y - knee.y) / (hip.y - ankle.y);
      assert.ok((knee.x - hipAnkleLine) * l.s >= -0.006, "膝盖不向髋踝连线内侧塌陷");
    });
  }
});
test("肌群高亮在暂停和全过程保持可见，辅助与未参与肌群区分", () => {
  for (const playing of [false, true])
    for (const phase of [0, 1, 2, 3, 4, 5, 6]) {
      const primary = muscleAppearance(
        "quads",
        ["quads", "glutes"],
        ["abs"],
        playing,
        phase,
      );
      const secondary = muscleAppearance(
        "abs",
        ["quads", "glutes"],
        ["abs"],
        playing,
        phase,
      );
      const inactive = muscleAppearance(
        "biceps",
        ["quads", "glutes"],
        ["abs"],
        playing,
        phase,
      );
      assert.equal(primary.role, "primary");
      assert.ok(primary.intensity >= 0.35);
      assert.notEqual(primary.color, secondary.color);
      assert.notEqual(primary.color, inactive.color);
      assert.equal(inactive.intensity, 0);
    }
  assert.equal(
    muscleAppearance("quads", ["biceps"], ["forearms"], true, 1).role,
    "inactive",
  );
});
test("指导阶段与下蹲、底部、站起顺序一致", () => {
  assert.equal(motionPhase("squat", 10).label, "吸气下蹲");
  assert.equal(motionPhase("squat", 50).label, "底部控制");
  assert.equal(motionPhase("squat", 85).label, "呼气站起");
});

test("俯卧撑双手固定、腕部朝向固定，顶部伸肘、底部充分屈肘", async () => {
  const { applyPushup } = await import("./movement");
  const rig = createBodyRig();
  let wrists: THREE.Vector3[] = [];
  for (const amount of [0, 0.25, 0.5, 0.75, 1, 0.75, 0.5, 0.25, 0]) {
    const result = applyPushup(rig, amount);
    for (const [i, arm] of rig.arms.entries()) {
      const p = arm.hand.getWorldPosition(new THREE.Vector3());
      if (!wrists[i]) wrists[i] = p.clone();
      assert.ok(p.distanceTo(wrists[i]) < 1e-6);
      const angle = result.arms[i].shoulder
        .clone()
        .sub(result.arms[i].elbow)
        .angleTo(result.arms[i].wrist.clone().sub(result.arms[i].elbow));
      if (amount === 0) assert.ok(angle > 2.9);
      if (amount === 1) assert.ok(angle < 1.55);
    }
  }
});
