import { applyExtendedPose } from "./extendedMovement";
import { extendedPhases } from "./animationProfiles";
import * as THREE from "three";
import type { BodyRig } from "./anatomyAsset";
import { PROPORTIONS as P, PROPORTIONS, setGrip, distributeForearmTwist } from "./bodyRig";
import type { Motion, Exercise } from "./domain";
const down = new THREE.Vector3(0, -1, 0);
export function applySquat(rig: BodyRig, amount: number) {
  const a = THREE.MathUtils.clamp(amount, 0, 1),
    shinLean = 0.4 * a,
    thighFlex = 1.2 * a,
    yaw = 0.12;
  const ankleY = P.pelvisY + P.hipOffset - P.thigh - P.shin;
  const kneeZ = P.shin * Math.sin(shinLean),
    hipZ = kneeZ - P.thigh * Math.sin(thighFlex);
  const ankleX = 0.265,
    hipX = 0.185,
    kneeX = hipX + (ankleX - hipX) * P.thigh / (P.thigh + P.shin) + kneeZ * Math.tan(yaw);
  const shinDY = Math.sqrt(P.shin ** 2 - kneeZ ** 2 - (kneeX - ankleX) ** 2);
  const thighDY = Math.sqrt(
    P.thigh ** 2 - (kneeZ - hipZ) ** 2 - (kneeX - hipX) ** 2,
  );
  const kneeY = ankleY + shinDY;
  rig.pelvis.position.set(0, kneeY + thighDY - P.hipOffset, hipZ);
  rig.torso.rotation.x = 0.43 * a;
  rig.pelvis.updateMatrixWorld(true);
  const landmarks = [];
  for (const l of rig.legs) {
    const hip = l.thigh.getWorldPosition(new THREE.Vector3()),
      knee = new THREE.Vector3(l.s * kneeX, kneeY, kneeZ),
      ankle = new THREE.Vector3(l.s * ankleX, ankleY, 0);
    const thighDirection = knee.clone().sub(hip).normalize();
    const shinDirection = ankle.clone().sub(knee).normalize();
    const axis = new THREE.Vector3().crossVectors(thighDirection, shinDirection);
    if (axis.lengthSq() < 1e-10) {
      axis.crossVectors(new THREE.Vector3(0, 0, 1), ankle.clone().sub(hip).normalize());
    }
    axis.normalize();
    const thighWorld = hingeFrame(thighDirection, axis);
    l.thigh.quaternion.copy(rig.pelvis.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(thighWorld));
    l.shin.rotation.set(thighDirection.angleTo(shinDirection), 0, 0);
    const shinWorld = thighWorld.clone().multiply(l.shin.quaternion);
    const footWorld = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(0, 1, 0),
      l.s * yaw,
    );
    l.foot.quaternion.copy(shinWorld.clone().invert().multiply(footWorld));
    landmarks.push({ hip, knee, ankle });
  }
  rig.arms.forEach((r) => {
    r.upper.rotation.x = -1.1;
    r.lower.rotation.x = -0.08;
  });
  rig.root.updateMatrixWorld(true);
  return { landmarks, amount: a };
}
export const MUSCLE_PALETTE = {
  primary: "#ee481d",
  secondary: "#dcaa26",
  inactive: "#a5aaa8",
};
export function muscleAppearance(
  id: string,
  primary: readonly string[],
  secondary: readonly string[],
  playing: boolean,
  phase: number,
) {
  const role = primary.includes(id)
    ? "primary"
    : secondary.includes(id)
      ? "secondary"
      : "inactive";
  return {
    role,
    color: MUSCLE_PALETTE[role],
    emissive:
      role === "primary"
        ? "#892000"
        : role === "secondary"
          ? "#593300"
          : "#000000",
    intensity:
      role === "inactive"
        ? 0
        : role === "primary"
          ? 0.35 + (playing ? 0.15 * (0.5 + 0.5 * Math.sin(phase * 2)) : 0)
          : 0.12,
  };
}
export function motionPhase(motion: Motion | null, progress: number) {
  if (!motion) return { index: 0, label: "静态肌群参考", all: ["准备", "执行", "纠错"] };
  const names: Record<Motion, [string, string, string]> = {
    ...extendedPhases,
    squat: ["吸气下蹲", "底部控制", "呼气站起"],
    curl: ["屈肘举起", "顶部控制", "缓慢下放"],
    raise: ["向侧方抬起", "肩高控制", "缓慢下放"],
    press: ["向上推举", "顶部控制", "缓慢回落"],
    row: ["手肘向后拉", "背部收缩", "缓慢还原"],
    hinge: ["屈髋下放", "后侧拉长", "伸髋站起"],
    calf: ["抬起脚跟", "顶部控制", "缓慢落下"],
    crunch: ["呼气卷起", "收缩控制", "缓慢回落"],
    pushup: ["屈肘下放", "底部控制", "推地撑起"],
    lunge: ["屈膝下蹲", "底部控制", "推地站起"],
    pullup: ["向上拉起", "顶部控制", "控制下降"],
    bridge: ["抬起髋部", "顶部控制", "缓慢回落"],
    triceps: ["屈肘下放", "底部控制", "伸肘举起"],
    toe: ["抬起脚尖", "顶部控制", "缓慢还原"],
  };
  const index = progress < 43 ? 0 : progress < 57 ? 1 : 2;
  return { index, label: names[motion][index], all: names[motion] };
}

// A pole defines the bending plane even at full extension. The deterministic
// fallback also works when scrubbing directly to a pose, without frame history.
function bendNormal(direction: THREE.Vector3, pole: THREE.Vector3) {
  pole.addScaledVector(direction, -pole.dot(direction));
  if (pole.lengthSq() < 1e-10) {
    pole.set(Math.abs(direction.z) < .9 ? 0 : 1, 0, Math.abs(direction.z) < .9 ? 1 : 0);
    pole.addScaledVector(direction, -pole.dot(direction));
  }
  return pole.normalize();
}
function hingeFrame(direction: THREE.Vector3, hinge: THREE.Vector3) {
  const y = direction.clone().negate();
  const z = new THREE.Vector3().crossVectors(hinge, y).normalize();
  return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(hinge, y, z));
}

/** Two-bone analytic IK. Pole selects the elbow side, while wrist target is fixed in world space. */
export function solveArm(
  rig: BodyRig,
  arm: BodyRig["arms"][number],
  wrist: THREE.Vector3,
  pole: THREE.Vector3,
) {
  rig.root.updateMatrixWorld(true);
  const shoulder = arm.upper.getWorldPosition(new THREE.Vector3()),
    v = wrist.clone().sub(shoulder);
  if (v.lengthSq() < 1e-12) v.copy(down).applyQuaternion(rig.torso.getWorldQuaternion(new THREE.Quaternion())).multiplyScalar(1e-6);
  const d = THREE.MathUtils.clamp(
      v.length(),
      Math.abs(P.upperArm - P.forearm) + 0.00001,
      P.upperArm + P.forearm - 0.00001,
    ),
    dir = v.normalize();
  const along = (P.upperArm ** 2 - P.forearm ** 2 + d * d) / (2 * d),
    height = Math.sqrt(Math.max(0, P.upperArm ** 2 - along ** 2));
  const normal = bendNormal(dir, pole.clone().sub(shoulder));
  // Reachable target and a shared hinge frame: never choose two independent
  // shortest-arc rotations (their unrelated axial rolls make the elbow flip).
  wrist = shoulder.clone().addScaledVector(dir, d);
  const elbow = shoulder
    .clone()
    .addScaledVector(dir, along)
    .addScaledVector(normal, height);
  const upperDirection = elbow.clone().sub(shoulder).normalize();
  const lowerDirection = wrist.clone().sub(elbow).normalize();
  const hinge = new THREE.Vector3().crossVectors(dir, normal).normalize();
  const upperQ = hingeFrame(upperDirection, hinge);
  arm.upper.quaternion.copy(
    arm.upper.parent!.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(upperQ),
  );
  arm.lower.rotation.set(-upperDirection.angleTo(lowerDirection), 0, 0);
  const lowerQ = upperQ.clone().multiply(arm.lower.quaternion);
  return { shoulder, elbow, wrist, lowerQ };
}
export function applyPushup(rig: BodyRig, amount: number, supportHeight = 0) {
  const a = THREE.MathUtils.clamp(amount, 0, 1);
  const ankle = new THREE.Vector3(0, 0.314, -1.65),
    wristY = 0.114 + supportHeight,
    bottom = Math.asin((wristY + .35 - ankle.y) / (P.thigh + P.shin - P.hipOffset + P.torsoOffset + P.shoulderY)),
    wristZ = ankle.z + (P.thigh + P.shin - P.hipOffset + P.torsoOffset + P.shoulderY) * Math.cos(bottom) - .10;
  const length = P.thigh + P.shin - P.hipOffset + P.torsoOffset + P.shoulderY;
  // Solve the top plank height from full arm extension rather than unrelated joint angles.
  let lo = 0.05,
    hi = supportHeight ? 1.2 : 0.6;
  for (let i = 0; i < 30; i++) {
    const alpha = (lo + hi) / 2;
    const d = Math.hypot(
      ankle.y + length * Math.sin(alpha) - wristY,
      ankle.z + length * Math.cos(alpha) - wristZ,
      0.65 - P.shoulderX,
    );
    if (d > P.upperArm + P.forearm - 0.006) hi = alpha;
    else lo = alpha;
  }
  const alpha = lo * (1 - a) + bottom * a,
    tilt = Math.PI / 2 - alpha;
  rig.pelvis.rotation.set(tilt, 0, 0);
  rig.torso.rotation.set(0, 0, 0);
  const axis = new THREE.Vector3(0, Math.sin(alpha), Math.cos(alpha));
  rig.pelvis.position
    .copy(ankle)
    .addScaledVector(axis, P.thigh + P.shin - P.hipOffset);
  rig.legs.forEach((l) => {
    l.thigh.rotation.set(0, 0, 0);
    l.shin.rotation.set(0, 0, 0);
    l.foot.rotation.set(0.35 - tilt, 0, 0);
  });
  rig.root.updateMatrixWorld(true);
  const results = rig.arms.map((arm) => {
    const wrist = new THREE.Vector3(arm.s * 0.65, wristY, wristZ);
    const result = solveArm(
      rig,
      arm,
      wrist,
      arm.upper.getWorldPosition(new THREE.Vector3()).addScaledVector(axis, -.65).add(new THREE.Vector3(arm.s * .25, 0, 0)),
    );
    const palm = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(Math.PI / 2, 0, Math.PI),
    );
    arm.hand.quaternion.copy(result.lowerQ.clone().invert().multiply(palm));
    return result;
  });
  rig.root.updateMatrixWorld(true);
  return { alpha, arms: results, ankle };
}

export function applyExercisePose(
  rig: BodyRig,
  exercise: Exercise,
  a: number,
  mode: "exercise" | "explore" = "exercise",
) {
  const { pelvis, torso, arms, legs } = rig;
  rig.equipment.reset();
  let barVisible = false,
    wallVisible = false;
  pelvis.position.set(0, PROPORTIONS.pelvisY, 0);
  pelvis.rotation.set(0, 0, 0);
  torso.rotation.set(0, 0, 0);
  rig.neck.rotation.set(0, 0, 0);
  setGrip(rig, mode === "exercise" && !!exercise.motion && exercise.equipment === "哑铃" ? 1 : 0);
  arms.forEach(({ upper, lower, twists, hand, weight, s }) => {
    twists.forEach(b => b.rotation.set(0, 0, 0));
    hand.rotation.set(0, 0, 0);
    upper.rotation.set(0, 0, s * 0.12, "XYZ");
    lower.rotation.set(-0.07, 0, 0);
    weight.visible = mode === "exercise" && !!exercise.motion && exercise.equipment === "哑铃";
  });
  legs.forEach(({ thigh, shin, foot, s }) => {
    thigh.rotation.set(0, 0, s * 0.018);
    shin.rotation.set(0, 0, 0);
    foot.rotation.set(0, 0, 0);
  });
  barVisible = false;
  wallVisible = false;
  if (mode === "exercise") {
    if (exercise.animation) applyExtendedPose(rig, exercise, a);
    else switch (exercise.motion) {
      case "squat": {
        applySquat(rig, a);
        break;
      }
      case "curl":
        arms.forEach((r) => (r.lower.rotation.x = -0.08 - a * 2.2));
        break;
      case "raise":
        arms.forEach((r) => {
          r.upper.rotation.z = r.s * (0.12 + a * 1.35);
          r.lower.rotation.x = -0.18;
          r.hand.rotation.y = -r.s * Math.PI / 2;
        });
        break;
      case "press":
        arms.forEach((r) => {
          // Shoulder abduction + external rotation; elbow remains an X hinge.
          r.upper.rotation.set(0, r.s * Math.PI / 2, r.s * (1.6 + a * 1.35), "ZXY");
          r.lower.rotation.set(-1.5 + a * 1.45, 0, 0);
          r.hand.rotation.y = -r.s * Math.PI / 2;
        });
        break;
      case "row": {
        applySquat(rig, 0.2);
        torso.rotation.x = 0.95;
        rig.root.updateMatrixWorld(true);
        arms.forEach((r) => {
          const sh = r.upper.getWorldPosition(new THREE.Vector3());
          const wrist = sh
            .clone()
            .add(new THREE.Vector3(r.s * 0.035, -1.255 + 0.79 * a, -0.6 * a));
          solveArm(
            rig,
            r,
            wrist,
            sh.clone().add(new THREE.Vector3(r.s * 0.6, -0.4, -0.8)),
          );
          r.hand.rotation.y = (-r.s * Math.PI) / 2;
        });
        break;
      }
      case "hinge":
        applySquat(rig, a * 0.35);
        torso.rotation.x = a;
        arms.forEach((r) => {
          r.upper.rotation.set(-a, 0, r.s * 0.06);
          r.lower.rotation.x = -0.05;
          r.hand.rotation.y = (-r.s * Math.PI) / 2;
        });
        break;
      case "calf": {
        const toe = new THREE.Vector3(0, -0.17, 0.34),
          turned = toe
            .clone()
            .applyAxisAngle(new THREE.Vector3(1, 0, 0), a * 0.4);
        pelvis.position.add(toe.sub(turned));
        legs.forEach((l) => (l.foot.rotation.x = a * 0.4));
        break;
      }
      case "toe":
        wallVisible = true;
        legs.forEach((l) => (l.foot.rotation.x = -a * 0.4));
        break;
      case "triceps":
        arms.forEach((r) => {
          r.upper.rotation.set(-2.95, 0, r.s * .10);
          r.lower.rotation.x = -0.25 - a * 1.8;
          r.hand.rotation.y = -r.s * Math.PI / 2;
        });
        break;
      case "lunge":
        pelvis.position.y = 1.9 - 0.55 * a;
        legs.forEach((l) =>
          solveLeg(
            rig,
            l,
            new THREE.Vector3(
              l.s * 0.24,
              l.s < 0 ? 0.205 : 0.374,
              l.s < 0 ? 0.45 : -0.6,
            ),
            new THREE.Vector3(l.s * 0.24, 0.8, 1.4),
            l.s < 0 ? 0 : 0.6,
          ),
        );
        break;
      case "pullup":
        barVisible = true;
        pelvis.position.y = 1.92 + 1.16 * a;
        pelvis.position.z = -0.06 * a;
        torso.rotation.x = -0.16 * a;
        setGrip(rig, 1);
        arms.forEach((r) => {
          const solved = solveArm(
            rig,
            r,
            new THREE.Vector3(r.s * 0.59, 4.29, 0.083),
            new THREE.Vector3(r.s * 1.3, 3.1, 0),
          );
          const q = new THREE.Quaternion().setFromEuler(
            new THREE.Euler(0, 0, Math.PI),
          );
          r.hand.quaternion.copy(solved.lowerQ.clone().invert().multiply(q));
        });
        break;
      case "pushup": {
        applyPushup(rig, a);
        break;
      }
      case "crunch": {
        pelvis.rotation.x = -Math.PI / 2;
        pelvis.position.set(0, 0.34, 0);
        torso.rotation.x = a * 0.38;
        legs.forEach((l) =>
          solveLeg(
            rig,
            l,
            new THREE.Vector3(l.s * 0.23, 0.205, 1.1),
            new THREE.Vector3(l.s * 0.23, 1.5, 0.65),
          ),
        );
        rig.root.updateMatrixWorld(true);
        arms.forEach((r) => {
          const wrist = torso.localToWorld(
            new THREE.Vector3(-r.s * 0.11, 0.68, 0.29),
          );
          solveArm(
            rig,
            r,
            wrist,
            torso.localToWorld(new THREE.Vector3(r.s * 0.65, 0.4, 0.2)),
          );
        });
        break;
      }
      case "bridge": {
        const hipY = 0.34 + 0.42 * a,
          drop = hipY - 0.34,
          angle = Math.asin(drop / 1.13);
        pelvis.rotation.x = -Math.PI / 2 - angle;
        pelvis.position.set(0, hipY, -1 + Math.sqrt(1.13 ** 2 - drop ** 2));
        legs.forEach((l) =>
          solveLeg(
            rig,
            l,
            new THREE.Vector3(l.s * 0.23, 0.205, 1.1),
            new THREE.Vector3(l.s * 0.23, 1.5, 0.65),
          ),
        );
        rig.root.updateMatrixWorld(true);
        rig.neck.quaternion.copy(
          torso
            .getWorldQuaternion(new THREE.Quaternion())
            .invert()
            .multiply(
              new THREE.Quaternion().setFromAxisAngle(
                new THREE.Vector3(1, 0, 0),
                -Math.PI / 2,
              ),
            ),
        );
        arms.forEach((r) => {
          const result = solveArm(
            rig,
            r,
            new THREE.Vector3(r.s * 0.52, 0.12, 0.38),
            new THREE.Vector3(r.s * 0.65, 0.16, -0.2),
          );
          const palm = new THREE.Quaternion().setFromEuler(
            new THREE.Euler(Math.PI / 2, 0, Math.PI),
          );
          r.hand.quaternion.copy(result.lowerQ.clone().invert().multiply(palm));
        });
        break;
      }
    }
  }


  distributeForearmTwist(rig);
  rig.root.updateMatrixWorld(true);
  return { barVisible, wallVisible };
}

export function solveLeg(
  rig: BodyRig,
  leg: BodyRig["legs"][number],
  ankle: THREE.Vector3,
  pole: THREE.Vector3,
  footAngle = 0,
) {
  rig.root.updateMatrixWorld(true);
  const hip = leg.thigh.getWorldPosition(new THREE.Vector3()),
    delta = ankle.clone().sub(hip);
  if (delta.lengthSq() < 1e-12) delta.copy(down).applyQuaternion(rig.pelvis.getWorldQuaternion(new THREE.Quaternion())).multiplyScalar(1e-6);
  const d = THREE.MathUtils.clamp(
      delta.length(),
      Math.abs(P.thigh - P.shin) + 0.00001,
      P.thigh + P.shin - 0.00001,
    ),
    dir = delta.normalize();
  const along = (P.thigh ** 2 - P.shin ** 2 + d * d) / (2 * d),
    h = Math.sqrt(Math.max(0, P.thigh ** 2 - along ** 2));
  const normal = bendNormal(dir, pole.clone().sub(hip));
  ankle = hip.clone().addScaledVector(dir, d);
  const knee = hip
    .clone()
    .addScaledVector(dir, along)
    .addScaledVector(normal, h);
  const thighDirection = knee.clone().sub(hip).normalize();
  const shinDirection = ankle.clone().sub(knee).normalize();
  const hinge = new THREE.Vector3().crossVectors(normal, dir).normalize();
  const tq = hingeFrame(thighDirection, hinge);
  leg.thigh.quaternion.copy(rig.pelvis.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(tq));
  leg.shin.rotation.set(thighDirection.angleTo(shinDirection), 0, 0);
  const sq = tq.clone().multiply(leg.shin.quaternion);
  leg.foot.quaternion.copy(
    sq
      .clone()
      .invert()
      .multiply(
        new THREE.Quaternion().setFromAxisAngle(
          new THREE.Vector3(1, 0, 0),
          footAngle,
        ),
      ),
  );
  return { hip, knee, ankle };
}
