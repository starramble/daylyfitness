import test from "node:test";
import assert from "node:assert/strict";
import * as T from "three";
import { createBodyRig, setGrip, PROPORTIONS as P } from "./bodyRig";
test("全身共享骨架，手腕、指节和握持点具有独立层级", () => {
  const r = createBodyRig();
  assert.ok(r.bones.every((b) => b instanceof T.Bone));
  assert.equal(r.skeleton.bones.length, r.bones.length);
  for (const a of r.arms) {
    assert.equal(a.twists[0].parent, a.lower);
    assert.equal(a.hand.parent, a.twists[2]);
    assert.equal(a.grip.parent, a.hand);
    assert.equal(a.weight.parent, a.grip);
    assert.equal(a.fingers.length, 4);
    const sh = a.upper.getWorldPosition(new T.Vector3()),
      el = a.lower.getWorldPosition(new T.Vector3()),
      wr = a.hand.getWorldPosition(new T.Vector3());
    assert.ok(Math.abs(sh.distanceTo(el) - P.upperArm) < 1e-8);
    assert.ok(Math.abs(wr.distanceTo(el) - P.forearm) < 1e-8);
  }
});
test("握持仅弯曲指节，器械位于掌心握持点，不改变肢体长度", () => {
  const r = createBodyRig();
  const a = r.arms[0];
  const before = a.grip.position.clone();
  setGrip(r, 1);
  assert.ok(
    a.fingers.every((f) => f.base.rotation.x < -0.9 && f.mid.rotation.x < -1),
  );
  assert.equal(before.distanceTo(a.grip.position), 0);
  const b = new T.Box3().setFromObject(a.weight);
  assert.ok(
    b.getSize(new T.Vector3()).x > 0.5 && b.getSize(new T.Vector3()).x < 0.57,
  );
  setGrip(r, 0);
  assert.ok(Math.abs(a.fingers[0].base.rotation.x) < 1e-9);
});
