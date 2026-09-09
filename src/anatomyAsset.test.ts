import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import * as T from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { createBodyRig } from "./bodyRig";
import { attachAnatomyAsset } from "./anatomyAsset";
import { applyExercisePose, applyPushup } from "./movement";
import { exercises, muscles } from "./domain";
const b = fs.readFileSync(
  new URL("../public/models/anatomy-v4.glb", import.meta.url),
);
const asset = await new GLTFLoader().parseAsync(
  b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength),
  "",
);
function loaded() {
  const r = createBodyRig();
  attachAnatomyAsset(r, asset.scene);
  r.root.updateMatrixWorld(true);
  r.skeleton.update();
  return r;
}
test("真实腹直肌和背阔肌替代补充几何；全部肌肉网格绑定同一骨架", () => {
  const r = loaded();
  assert.deepEqual(
    new Set(r.mats.map((m) => m.id)),
    new Set(muscles.map((m) => m.id)),
  );
  for (const id of ["abs", "lats"]) {
    const ms = r.meshes.filter((m) => m.userData.muscleId === id);
    assert.ok(ms.length >= 2);
    assert.ok(ms.every((m) => m.userData.source === "Z-Anatomy / BodyParts3D"));
  }
  for (const m of r.meshes) {
    assert.ok(m instanceof T.SkinnedMesh);
    assert.equal(m.skeleton, r.skeleton);
    const w = m.geometry.getAttribute("skinWeight"),
      idx = m.geometry.getAttribute("skinIndex");
    for (let i = 0; i < w.count; i++) {
      const sum = w.getX(i) + w.getY(i) + w.getZ(i) + w.getW(i);
      assert.ok(Math.abs(sum - 1) < 1e-6);
      assert.ok(idx.getX(i) < r.bones.length);
    }
  }
});
test("真实肌腱跨肘关节分配权重，屈肘时末端跟随前臂", () => {
  const r = loaded();
  const ar = r.arms[1];
  const distal = [ar.lower, ...ar.twists].map(b => r.bones.indexOf(b));
  const candidates = r.meshes.filter(
    (m) => m.userData.muscleId === "biceps" && m.userData.bodySide === "left",
  );
  let found = 0;
  for (const mesh of candidates) {
    const m = mesh as T.SkinnedMesh,
      ids = m.geometry.getAttribute("skinIndex"),
      w = m.geometry.getAttribute("skinWeight");
    for (let i = 0; i < ids.count; i++) {
      if ([0, 1, 2, 3].reduce((sum, k) => sum + (distal.includes(ids.getComponent(i, k)) ? w.getComponent(i, k) : 0), 0) > .8) {
        const p = m.getVertexPosition(i, new T.Vector3());
        ar.lower.rotation.x = -1.6;
        r.root.updateMatrixWorld(true);
        r.skeleton.update();
        const after = m.getVertexPosition(i, new T.Vector3());
        assert.ok(after.distanceTo(p) > 0.025);
        found++;
        break;
      }
    }
    if (found) break;
  }
  assert.ok(found > 0, "肌腱末端必须绑定到肘部远端骨段");
});
test("俯卧撑完整周期：真实掌面、脚尖不穿地，胸部充分下放", () => {
  const r = loaded(),
    chest = r.meshes.filter(
      (m) => m.userData.muscleId === "chest",
    ) as T.SkinnedMesh[];
  const skin = r.meshes.filter((m) =>
    /hand|foot/.test(m.userData.sourceName),
  ) as T.SkinnedMesh[];
  let top = 0,
    bottom = 0;
  for (const a of [0, 0.25, 0.5, 0.75, 1, 0.75, 0.5, 0.25, 0]) {
    applyPushup(r, a);
    r.skeleton.update();
    let cmin = Infinity;
    for (const m of chest) {
      m.computeBoundingBox();
      cmin = Math.min(cmin, m.boundingBox!.min.y);
    }
    if (a === 0) top = cmin;
    if (a === 1) bottom = cmin;
    for (const m of skin) {
      m.computeBoundingBox();
      assert.ok(
        m.boundingBox!.min.y >= -0.003,
        `${m.name}: ${m.boundingBox!.min.y}`,
      );
      assert.ok(
        m.boundingBox!.min.y < 0.06,
        `${m.name} contact ${m.boundingBox!.min.y}`,
      );
    }
  }
  assert.ok(top - bottom > 0.55, `depth ${top - bottom}`);
  assert.ok(bottom > 0.01 && bottom < 0.18, `chest bottom ${bottom}`);
});
test("全动作采样：蒙皮顶点有限，肢体没有爆炸伸出整体包围范围", () => {
  const r = loaded();
  for (const e of exercises) {
    for (const a of [0, 0.5, 1]) {
      applyExercisePose(r, e, a);
      r.skeleton.update();
      for (const m of r.meshes as T.SkinnedMesh[]) {
        const pos = m.geometry.getAttribute("position");
        for (
          let i = 0;
          i < pos.count;
          i += Math.max(1, Math.floor(pos.count / 20))
        ) {
          const p = m.getVertexPosition(i, new T.Vector3());
          assert.ok(p.toArray().every(Number.isFinite));
          assert.ok(p.length() < 7, `${e.id} ${m.name}`);
        }
      }
    }
  }
});

test("颈部修形不改变原始面部顶点，下颌和面部轮廓完整保留", async () => {
  const reference = fs.readFileSync(new URL('./test-fixtures/anatomy-v4-before-transitions.glb', import.meta.url));
  const original = await new GLTFLoader().parseAsync(reference.buffer.slice(reference.byteOffset, reference.byteOffset + reference.byteLength), '');
  const source = original.scene.getObjectByName('head') as T.Mesh;
  const current = asset.scene.getObjectByName('head') as T.Mesh;
  const a = source.geometry.getAttribute('position'), b = current.geometry.getAttribute('position');
  const key = (p: T.BufferAttribute | T.InterleavedBufferAttribute, i: number) => [p.getX(i),p.getY(i),p.getZ(i)].map(n=>n.toFixed(6)).join(',');
  const actual = new Set(Array.from({length:b.count},(_,i)=>key(b,i)));
  for(let i=0;i<a.count;i++) if(a.getY(i)>=3.215 || a.getZ(i)>=.13) assert.ok(actual.has(key(a,i)), `原始面部顶点 ${i} 被修形移动`);
  assert.ok(b.count>a.count, '过渡应通过新增颈部顶点完成');
  // Every original triangle is retained, rather than replacing facial topology.
  const triangles = (m:T.Mesh) => { const idx=m.geometry.index!, p=m.geometry.getAttribute('position'); const out=new Set<string>();for(let i=0;i<idx.count;i+=3)if([0,1,2].every(j=>p.getY(idx.getX(i+j))>=3.215||p.getZ(idx.getX(i+j))>=.13))out.add([0,1,2].map(j=>key(p,idx.getX(i+j))).sort().join('|'));return out; };
  const faces = triangles(current);
  for(const f of triangles(source)) assert.ok(faces.has(f),'原始面部三角面被删除或改写');
});

test('推举与架杠：真实臂骨和上臂肌腹保持刚性，避免软管式弯曲', () => {
  const r=loaded();
  const targets=r.meshes.filter(m=>/^(Humerus|Radius|Ulna)[. ]/i.test(m.userData.sourceName)||(['biceps','triceps'].includes(m.userData.muscleId)&&!(Array.isArray(m.material)?m.material:[m.material]).every(mat=>/tendon/i.test(mat.name))));
  const samples=targets.map(mesh=>{
    const m=mesh as T.SkinnedMesh,p=m.geometry.getAttribute('position');
    const rigidBone=/^(Humerus|Radius|Ulna)[. ]/i.test(m.userData.sourceName);
    const indices=Array.from({length:p.count},(_,i)=>i).filter(i=>rigidBone||(p.getY(i)>2.50 && p.getY(i)<2.90));
    return {m,indices:indices.filter((_,i)=>i%Math.max(1,Math.floor(indices.length/16))===0),p};
  }).filter(x=>x.indices.length>1);
  assert.ok(samples.length>10);
  for(const id of ['press','Barbell_Squat','Front_Barbell_Squat'])for(const phase of [0,.25,.5,.75,1]){
    applyExercisePose(r,exercises.find(e=>e.id===id)!,phase);r.skeleton.update();
    for(const {m,indices,p} of samples){
      const first=indices[0],anchor=m.getVertexPosition(first,new T.Vector3()),rest=new T.Vector3().fromBufferAttribute(p,first);
      for(const i of indices.slice(1)){
        const expected=rest.distanceTo(new T.Vector3().fromBufferAttribute(p,i));
        assert.ok(Math.abs(anchor.distanceTo(m.getVertexPosition(i,new T.Vector3()))-expected)<1e-6,id+' '+m.name+'不应弯曲或伸缩');
      }
    }
  }
});
test('推举与架杠的肩部短边不再被拉成长裂片', () => {
  const r=loaded();
  const targets=r.meshes.filter(m=>m.userData.bodySide==='left'&&(m.userData.family==='arm'||/pectoralis|teres|infraspinatus/.test(m.userData.sourceName)));
  let checked=0;
  for(const id of ['press','Barbell_Squat','Front_Barbell_Squat'])for(const phase of [0,.25,.5,.75,1]){
    applyExercisePose(r,exercises.find(e=>e.id===id)!,phase);r.skeleton.update();
    for(const mesh of targets){
      const m=mesh as T.SkinnedMesh,p=m.geometry.getAttribute('position'),idx=m.geometry.index;if(!idx)continue;
      const posed=Array.from({length:p.count},(_,i)=>m.getVertexPosition(i,new T.Vector3()));
      const v=new T.Vector3(),w=new T.Vector3();
      for(let k=0;k<idx.count;k+=3)for(let j=0;j<3;j++){
        const a=idx.getX(k+j),b=idx.getX(k+(j+1)%3);
        if(Math.min(p.getY(a),p.getY(b))<2.26)continue;
        const rest=v.fromBufferAttribute(p,a).distanceTo(w.fromBufferAttribute(p,b));if(rest<1e-5)continue;
        // Rendering regression guard, not a physiological tissue-strain limit.
        // The former y-band discontinuity stretched these edges up to 302x.
        assert.ok(posed[a].distanceTo(posed[b])<rest*6,id+' '+m.name+'局部裂片');checked++;
      }
    }
  }
  assert.ok(checked>100000);
});
