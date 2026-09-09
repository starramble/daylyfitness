import * as THREE from "three";
import type { createBodyRig } from "../bodyRig";
import type { MuscleId } from "../domain";
export type BodyRig = ReturnType<typeof createBodyRig>;
const smooth = (a: number, b: number, v: number) => {
  const t = THREE.MathUtils.clamp((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
export function vertexWeights(
  rig: BodyRig,
  p: THREE.Vector3,
  family: string,
  kind: string,
  name: string,
): [number, number][] {
  const a = rig.arms.find((a) => a.s === (p.x >= 0 ? 1 : -1))!,
    l = rig.legs.find((l) => l.s === (p.x >= 0 ? 1 : -1))!;
  const index = (b: THREE.Bone) => rig.bones.indexOf(b);
  const mix = (a: THREE.Bone, b: THREE.Bone, t: number): [number, number][] => [
    [index(a), 1 - t],
    [index(b), t],
  ];
  const only = (b: THREE.Bone): [number, number][] => [[index(b), 1]];
  if (kind === "bone") {
    if (/humerus/i.test(name)) return only(a.upper);
    if (/radius|ulna/i.test(name)) return only(a.lower);
    if (/femur/i.test(name)) return only(l.thigh);
    if (/tibia|fibula|patella/i.test(name)) return only(l.shin);
  }
  if (family === "core" && p.y > 3.16 && Math.abs(p.x) < 0.23)
    return mix(rig.torso, rig.neck, smooth(3.16, 3.3, p.y));
  if (family === "arm") {
    if (p.y > 2.95)
      return mix(
        rig.torso,
        a.upper,
        smooth(0.29, 0.44, Math.abs(p.x)) * (1 - smooth(3.12, 3.29, p.y)),
      );
    if (p.y > 2.58) return only(a.upper);
    if (p.y > 2.26) return mix(a.lower, a.upper, smooth(2.26, 2.58, p.y));
    if (p.y > 1.94) return only(a.lower);
    if (p.y > 1.77) return mix(a.hand, a.lower, smooth(1.77, 1.94, p.y));
    // Anatomical hands and digital tendons share finger bones, including thumb opposition.
    const q = p.clone().sub(new THREE.Vector3(a.s * 0.425, 1.84, 0));
    if (q.y > -0.11) return only(a.hand);
    if (q.x * a.s < -0.082 && q.y > -0.25)
      return mix(a.hand, a.thumb, smooth(-0.085, -0.135, q.y));
    const f =
      a.fingers[THREE.MathUtils.clamp(Math.round(q.x / 0.045 + 1.5), 0, 3)];
    if (q.y > -0.2) return mix(a.hand, f.base, smooth(-0.12, -0.2, q.y));
    const d = -q.y - 0.17;
    if (d < f.length * 0.52)
      return mix(f.base, f.mid, smooth(f.length * 0.35, f.length * 0.65, d));
    return mix(f.mid, f.tip, smooth(f.length * 0.65, f.length * 0.86, d));
  }
  if (family === "leg") {
    if (p.y > 1.68) return mix(l.thigh, rig.pelvis, smooth(1.68, 2.08, p.y));
    if (p.y > 1.2) return only(l.thigh);
    if (p.y > 0.88) return mix(l.shin, l.thigh, smooth(0.88, 1.2, p.y));
    if (p.y > 0.28) return only(l.shin);
    return mix(l.foot, l.shin, smooth(0.12, 0.28, p.y));
  }
  if (Math.abs(p.x) > 0.29 && p.y > 2.78 && p.y < 3.29)
    return mix(
      rig.torso,
      a.upper,
      smooth(0.29, 0.44, Math.abs(p.x)) * (1 - smooth(3.12, 3.29, p.y)),
    );
  return mix(rig.pelvis, rig.torso, smooth(1.99, 2.45, p.y));
}
// Shape the shoulder cap with one continuous field shared by muscle, tendon and
// underlying bone surfaces. Keep the original weights and joint pivots so this
// contour adjustment cannot reassign tendon attachments or shorten the arm rig.
function refineShoulderContour(geometry: THREE.BufferGeometry) {
  const positions = geometry.getAttribute("position");
  let changed = false;
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i),
      y = positions.getY(i),
      z = positions.getZ(i);
    const lateral = smooth(0.25, 0.43, Math.abs(x));
    const cap = smooth(2.78, 3.045, y) * (1 - smooth(3.22, 3.34, y));
    const influence = lateral * cap;
    if (influence === 0) continue;
    positions.setXYZ(
      i,
      x - Math.sign(x) * Math.max(0, Math.abs(x) - 0.36) * 0.2 * influence,
      y - 0.085 * influence,
      -0.04 + (z + 0.04) * (1 - 0.12 * influence),
    );
    changed = true;
  }
  if (changed) {
    positions.needsUpdate = true;
    geometry.computeVertexNormals();
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
  }
}

function fibers(mat: THREE.MeshStandardMaterial, id: string) {
  // Fine directional surface shading, independent of muscle-role color; tendon geometry stays pale.
  mat.onBeforeCompile = (shader) => {
    shader.vertexShader =
      "varying vec3 anatomyPosition;\n" + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace(
      "#include <begin_vertex>",
      "#include <begin_vertex>\nanatomyPosition = position;",
    );
    shader.fragmentShader =
      "varying vec3 anatomyPosition;\n" + shader.fragmentShader;
    const direction =
      id === "chest"
        ? "(abs(anatomyPosition.x)*0.50 + anatomyPosition.y)"
        : id === "lats"
          ? "(abs(anatomyPosition.x)*0.62 + anatomyPosition.y*0.52)"
          : id === "obliques"
            ? "(abs(anatomyPosition.x) + anatomyPosition.y*.65)"
            : "(anatomyPosition.x + anatomyPosition.z*.55)";
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <color_fragment>",
      `#include <color_fragment>\nfloat fiberPhase=${direction}*330.0 + sin(anatomyPosition.y*19.0)*.4;\nfloat fiberLine=sin(fiberPhase)*.5+.5;\ndiffuseColor.rgb *= .91 + .09*fiberLine;`,
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <normal_fragment_begin>",
      `#include <normal_fragment_begin>\nvec3 q0=dFdx(vViewPosition), q1=dFdy(vViewPosition);\nvec3 r1=cross(q1,normal),r2=cross(normal,q0);\nfloat det=dot(q0,r1);\nvec3 surfgrad=sign(det)*(dFdx(fiberLine*.00065)*r1+dFdy(fiberLine*.00065)*r2);\nnormal=normalize(abs(det)*normal-surfgrad);`,
    );
  };
  mat.customProgramCacheKey = () => `fibers-${id}`;
}
export function attachAnatomyAsset(rig: BodyRig, asset: THREE.Group) {
  rig.meshes.forEach((m) => {
    m.removeFromParent();
    m.geometry.dispose();
  });
  rig.meshes.length = 0;
  rig.mats.length = 0;
  asset.updateMatrixWorld(true);
  asset.traverse((original) => {
    if (!(original instanceof THREE.Mesh)) return;
    const meta = original.userData.family
      ? original.userData
      : (original.parent?.userData ?? {});
    const geo = original.geometry.clone();
    geo.applyMatrix4(original.matrixWorld);
    const pos = geo.getAttribute("position"),
      indices: number[] = [],
      weights: number[] = [];
    if (meta.family === "arm") {
      for (let i = 0; i < pos.count; i++) {
        const y = pos.getY(i);
        if (y < 1.84) pos.setZ(i, pos.getZ(i) - 0.55 * (1.84 - y));
      }
      geo.computeVertexNormals();
    }
    if (meta.muscleId === "forearms" && geo.index) {
      const keep: number[] = [];
      const old = geo.index;
      for (let i = 0; i < old.count; i += 3) {
        const a = old.getX(i),
          b = old.getX(i + 1),
          c = old.getX(i + 2);
        if (Math.min(pos.getY(a), pos.getY(b), pos.getY(c)) >= 1.79)
          keep.push(a, b, c);
      }
      geo.setIndex(keep);
      geo.clearGroups();
    }
    for (let i = 0; i < pos.count; i++) {
      const ws = vertexWeights(
        rig,
        new THREE.Vector3().fromBufferAttribute(pos, i),
        meta.family,
        meta.kind,
        meta.sourceName || original.name,
      ).filter(([, w]) => w > 0);
      for (let k = 0; k < 4; k++) {
        indices.push(ws[k]?.[0] ?? 0);
        weights.push(ws[k]?.[1] ?? 0);
      }
    }
    geo.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(indices, 4));
    geo.setAttribute(
      "skinWeight",
      new THREE.Float32BufferAttribute(weights, 4),
    );
    refineShoulderContour(geo);
    const originals = Array.isArray(original.material)
      ? original.material
      : [original.material];
    const materials = originals.map((source) => {
      const tendon = /tendon/i.test(source.name),
        active = meta.muscleId && !tendon;
      const mat = new THREE.MeshStandardMaterial({
        color: active
          ? "#b9aaa0"
          : meta.kind === "skin"
            ? "#a5aaa8"
            : "#d0cbbf",
        roughness: active || meta.kind === "skin" ? 0.65 : 0.8,
      });
      mat.name = tendon ? "Tendon" : source.name;
      if (active) {
        fibers(mat, meta.muscleId);
        rig.mats.push({ mat, id: meta.muscleId as MuscleId });
      }
      return mat;
    });
    const mesh = new THREE.SkinnedMesh(
      geo,
      Array.isArray(original.material) ? materials : materials[0],
    );
    mesh.name = original.name;
    mesh.userData = { ...meta };
    mesh.frustumCulled = false;
    mesh.bind(rig.skeleton, new THREE.Matrix4());
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    rig.root.add(mesh);
    rig.meshes.push(mesh);
  });
  rig.root.userData.source =
    "Z-Anatomy CC BY-SA 4.0; BodyParts3D / DBCLS CC BY-SA 2.1 Japan";
  return {
    meshes: rig.meshes.length,
    muscleGroups: new Set(rig.mats.map((m) => m.id)).size,
  };
}
export function captureRestPose(rig: BodyRig) {
  rig.root.updateMatrixWorld(true);
  rig.skeleton.calculateInverses();
}
