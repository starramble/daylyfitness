import { createTrainingEquipment } from "./trainingEquipment";
import * as THREE from "three";
import type { MuscleId } from "./domain";
export const PROPORTIONS = {
  pelvisY: 1.99,
  torsoOffset: 0.14,
  shoulderY: 0.99,
  shoulderX: 0.425,
  upperArm: 0.7,
  forearm: 0.58,
  hand: 0.36,
  thigh: 0.84,
  shin: 0.85,
  headCenter: 1.4,
  headHeight: 0.5,
  hipOffset: -0.11,
} as const;
export const MUSCLE_COLOR = "#a87968";
export function createBodyRig() {
  const root = new THREE.Group();
  root.name = "Dayly_Anatomy_Skinned_v4";
  const bones: THREE.Bone[] = [];
  function joint(
    name: string,
    parent: THREE.Object3D,
    pos: [number, number, number],
  ) {
    const b = new THREE.Bone();
    b.name = name;
    b.position.set(...pos);
    parent.add(b);
    bones.push(b);
    return b;
  }
  const pelvis = joint("Pelvis", root, [0, 1.99, 0]),
    torso = joint("Spine", pelvis, [0, 0.14, 0]);
  const neck = joint("Neck", torso, [0, 1.12, 0]);
  const meshes: THREE.Mesh[] = [],
    mats: { mat: THREE.MeshStandardMaterial; id: MuscleId }[] = [];
  const arms = [-1, 1].map((s) => {
    const side = s < 0 ? "Right" : "Left";
    const upper = joint(side + "_Shoulder", torso, [s * 0.425, 0.99, 0]);
    const lower = joint(side + "_Elbow", upper, [0, -0.7, 0]);
    // Three serial axial joints spread forearm rotation without twisting the
    // humerus or concentrating an entire palm turn at the wrist seam.
    const twist1 = joint(side + "_ForearmTwist1", lower, [0, 0, 0]);
    const twist2 = joint(side + "_ForearmTwist2", twist1, [0, 0, 0]);
    const twist3 = joint(side + "_ForearmTwist3", twist2, [0, 0, 0]);
    const twists = [twist1, twist2, twist3];
    const hand = joint(side + "_Wrist", twist3, [0, -0.58, 0]);
    const fingers = [0, 1, 2, 3].map((f) => {
      const lengths = [0.17, 0.19, 0.18, 0.14];
      const base = joint(side + "_Finger" + f, hand, [
        (f - 1.5) * 0.045,
        -0.17,
        0.014,
      ]);
      const mid = joint(side + "_Finger" + f + "_Mid", base, [
        0,
        -lengths[f] * 0.52,
        0,
      ]);
      const tip = joint(side + "_Finger" + f + "_Tip", mid, [
        0,
        -lengths[f] * 0.29,
        0,
      ]);
      return { base, mid, tip, length: lengths[f] };
    });
    const thumb = joint(side + "_Thumb", hand, [-s * 0.093, -0.065, 0.01]);
    const thumbTip = joint(side + "_Thumb_Tip", thumb, [-s * 0.035, -0.055, 0]);
    const grip = new THREE.Group();
    grip.name = side + "_GripSocket";
    grip.position.set(0, -0.2, 0.083);
    hand.add(grip);
    const weight = new THREE.Group();
    weight.name = side + "_Dumbbell";
    grip.add(weight);
    const steel = new THREE.MeshStandardMaterial({
      color: "#a5acae",
      metalness: 0.8,
      roughness: 0.3,
    });
    const rubber = new THREE.MeshStandardMaterial({
      color: "#313733",
      metalness: 0.06,
      roughness: 0.78,
    });
    const handle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.024, 0.024, 0.31, 20),
      steel,
    );
    handle.rotation.z = Math.PI / 2;
    weight.add(handle);
    for (const sign of [-1, 1]) {
      const head = new THREE.Mesh(
        new THREE.CylinderGeometry(0.125, 0.125, 0.115, 6),
        rubber,
      );
      head.rotation.z = Math.PI / 2;
      head.position.x = sign * 0.2025;
      weight.add(head);
      const cap = new THREE.Mesh(
        new THREE.CylinderGeometry(0.063, 0.063, 0.008, 24),
        steel,
      );
      cap.rotation.z = Math.PI / 2;
      cap.position.x = sign * 0.263;
      weight.add(cap);
    }
    weight.traverse((o) => {
      if (o instanceof THREE.Mesh) o.castShadow = true;
    });
    return { upper, lower, twists, hand, fingers, thumb, thumbTip, grip, weight, s };
  });
  const legs = [-1, 1].map((s) => {
    const side = s < 0 ? "Right" : "Left";
    const thigh = joint(side + "_Hip", pelvis, [s * 0.185, -0.11, 0]);
    const shin = joint(side + "_Knee", thigh, [0, -0.84, 0]);
    const foot = joint(side + "_Ankle", shin, [0, -0.85, 0]);
    return { thigh, shin, foot, s };
  });
  root.updateMatrixWorld(true);
  const skeleton = new THREE.Skeleton(bones);
  skeleton.calculateInverses();
  const equipment = createTrainingEquipment(root);
  return {
    equipment,
    root,
    pelvis,
    torso,
    neck,
    arms,
    legs,
    meshes,
    mats,
    bones,
    skeleton,
  };
}
export function setGrip(rig: ReturnType<typeof createBodyRig>, amount: number) {
  for (const a of rig.arms) {
    for (const f of a.fingers) {
      f.base.rotation.x = -1.05 * amount;
      f.mid.rotation.x = -1.45 * amount;
      f.tip.rotation.x = -0.75 * amount;
    }
    a.thumb.rotation.set(
      -0.65 * amount,
      a.s * 0.6 * amount,
      a.s * 0.2 * amount,
    );
    a.thumbTip.rotation.x = -0.8 * amount;
  }
}

/** Factor an authored wrist orientation into forearm axial turn and wrist swing.
 * World palm/grip pose is preserved exactly; this is not a post-pose clamp. */
export function distributeForearmTwist(rig: ReturnType<typeof createBodyRig>) {
  for (const arm of rig.arms) {
    const q = arm.hand.quaternion;
    const norm = Math.hypot(q.y, q.w);
    if (norm < 1e-8) continue;
    let angle = 2 * Math.atan2(q.y / norm, q.w / norm);
    angle = Math.atan2(Math.sin(angle), Math.cos(angle));
    // At exactly 180°, both quaternions describe the same palm; choose the
    // anatomical pronation direction separately for the two forearms.
    if (Math.abs(Math.abs(angle) - Math.PI) < 1e-8) angle = -arm.s * Math.PI;
    const twist = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), angle);
    q.premultiply(twist.invert());
    arm.twists.forEach(b => b.rotation.set(0, angle / 3, 0));
  }
}
