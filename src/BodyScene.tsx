import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { attachAnatomyAsset, captureRestPose } from "./anatomyAsset";
import { applyExercisePose, muscleAppearance } from "./movement";
import { clone as cloneSkeleton } from "three/addons/utils/SkeletonUtils.js";
import { GLTFExporter } from "three/addons/exporters/GLTFExporter.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import type { Exercise, MuscleId } from "./domain";

type Props = {
  exercise: Exercise;
  targets: MuscleId[];
  mode: "explore" | "exercise";
  playing: boolean;
  speed: number;
  phase: number;
  view: "front" | "back" | "side";
  reset: number;
  onSelect: (id: MuscleId) => void;
  onPhase: (n: number) => void;
  exportCount: number;
  onExport: (message: string) => void;
  showGuides: boolean;
  controlledPhase?: number;
  mirrored?: boolean;
  onReady?: (ready: boolean) => void;
};
import { createBodyRig, PROPORTIONS } from "./bodyRig";
export default function BodyScene(props: Props) {
  const host = useRef<HTMLDivElement>(null),
    latest = useRef(props);
  latest.current = props;
  const pins = useRef<HTMLDivElement>(null);
  const [error, setError] = useState(false);
  const [assetStatus, setAssetStatus] = useState("loading");
  useEffect(() => {
    const el = host.current!;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      setError(true);
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.02;
    el.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(33, 1, 0.1, 100);
    camera.position.set(0, 2.6, 7.6);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 1.95, 0);
    controls.enableDamping = true;
    controls.minDistance = 5;
    controls.maxDistance = 12;
    controls.maxPolarAngle = Math.PI * 0.91;
    controls.enablePan = false;
    scene.add(new THREE.HemisphereLight("#fff9e9", "#a1a196", 1.4));
    const key = new THREE.DirectionalLight("#fff5e9", 2.8);
    key.position.set(-3, 7, 5);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    scene.add(key);
    const rim = new THREE.DirectionalLight("#ffffff", 1.5);
    rim.position.set(3, 4, -3);
    scene.add(rim);
    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(2.5, 80),
      new THREE.ShadowMaterial({ opacity: 0.12 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0.015;
    floor.receiveShadow = true;
    scene.add(floor);
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(1.1, 1.105, 96),
      new THREE.MeshBasicMaterial({ color: "#d8d4c8", side: THREE.DoubleSide }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.02;
    scene.add(ring);
    const rig = createBodyRig();
    const { root, pelvis, torso, arms, legs, meshes, mats } = rig;
    captureRestPose(rig);
    root.visible = false;
    let disposed = false;
    new GLTFLoader()
      .loadAsync("/models/anatomy-v4.glb?v=face-contour-2")
      .then((gltf) => {
        if (disposed) return;
        attachAnatomyAsset(rig, gltf.scene);
        root.visible = true;
        setAssetStatus("ready");
        latest.current.onReady?.(true);
      })
      .catch(() => {
        if (!disposed) setAssetStatus("error");
      });
    scene.add(root);
    const bar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.022, 0.022, 2.1, 16),
      new THREE.MeshStandardMaterial({
        color: "#54625b",
        metalness: 0.6,
        roughness: 0.3,
      }),
    );
    bar.rotation.z = Math.PI / 2;
    bar.position.set(0, 4.49, 0);
    scene.add(bar);
    const wall = new THREE.Mesh(
      new THREE.PlaneGeometry(1.7, 2.4),
      new THREE.MeshStandardMaterial({
        color: "#dedfd4",
        transparent: true,
        opacity: 0.45,
        side: THREE.DoubleSide,
      }),
    );
    wall.position.set(0, 1.25, -0.31);
    scene.add(wall);
    const guideGroup = new THREE.Group();
    scene.add(guideGroup);
    const guideMat = new THREE.LineDashedMaterial({
      color: "#697c51",
      dashSize: 0.035,
      gapSize: 0.025,
      transparent: true,
      opacity: 0.65,
      depthTest: false,
    });
    const toeLine = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(),
        new THREE.Vector3(),
      ]),
      guideMat,
    );
    guideGroup.add(toeLine);
    const chainLine = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(),
        new THREE.Vector3(),
        new THREE.Vector3(),
      ]),
      new THREE.LineBasicMaterial({
        color: "#70854a",
        transparent: true,
        opacity: 0.5,
        depthTest: false,
      }),
    );
    guideGroup.add(chainLine);
    const pads = legs.map(() => {
      const pad = new THREE.Mesh(
        new THREE.RingGeometry(0.03, 0.042, 32),
        new THREE.MeshBasicMaterial({
          color: "#537537",
          transparent: true,
          opacity: 0.8,
          side: THREE.DoubleSide,
          depthTest: false,
        }),
      );
      pad.rotation.x = -Math.PI / 2;
      guideGroup.add(pad);
      return pad;
    });
    const ray = new THREE.Raycaster(),
      pointer = new THREE.Vector2();
    let down = { x: 0, y: 0 };
    const onDown = (e: PointerEvent) => {
      down = { x: e.clientX, y: e.clientY };
    };
    const onClick = (e: PointerEvent) => {
      if (Math.hypot(e.clientX - down.x, e.clientY - down.y) > 5) return;
      const rect = el.getBoundingClientRect();
      pointer.set(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        (-(e.clientY - rect.top) / rect.height) * 2 + 1,
      );
      rig.meshes.forEach((m) => {
        if (m instanceof THREE.SkinnedMesh) m.computeBoundingSphere();
      });
      ray.setFromCamera(pointer, camera);
      const hit = ray.intersectObjects(meshes, false)[0];
      if (hit?.object.userData.muscleId)
        latest.current.onSelect(hit.object.userData.muscleId);
    };
    renderer.domElement.addEventListener("pointerdown", onDown);
    renderer.domElement.addEventListener("pointerup", onClick);
    const resize = () => {
      renderer.setSize(el.clientWidth, el.clientHeight);
      camera.aspect = el.clientWidth / el.clientHeight;
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(el);
    resize();
    let frame = 0,
      last = 0,
      t = 0,
      prevExercise = "",
      prevView = "",
      prevMode = "",
      prevAspect = 0,
      prevReset = -1,
      prevPhase = -1,
      reported = 0,
      prevExport = latest.current.exportCount;
    function animate(now: number) {
      frame = requestAnimationFrame(animate);
      const p = latest.current;
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      if (
        prevView !== p.view ||
        prevReset !== p.reset ||
        prevExercise !== p.exercise.id ||
        prevMode !== p.mode ||
        prevAspect !== camera.aspect
      ) {
        const framing = p.mode === "exercise" ? p.exercise.animation?.framing : undefined;
        const floorPose =
          p.mode === "exercise" &&
          (["pushup", "crunch", "bridge"].includes(p.exercise.motion ?? "") || framing === "bench" || framing === "floor");
        const overhead =
          p.mode === "exercise" &&
          (["press", "triceps", "pullup"].includes(p.exercise.motion ?? "") || framing === "overhead" || framing === "machine");
        const span = floorPose
          ? 5.3
          : (p.exercise.motion === "raise" || p.exercise.animation)
            ? 4.6
            : 1.6;
        const distance = Math.max(
          overhead ? 9.1 : 7.6,
          span /
            (2 *
              Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) *
              camera.aspect),
        );
        controls.maxDistance = Math.max(12, distance * 1.1);
        const v = p.view;
        camera.position.set(
          v === "side" ? distance : 0,
          floorPose ? (framing === "bench" ? 2.1 : 1.3) : overhead ? 3.0 : 2.6,
          v === "front" ? distance : v === "back" ? -distance : 0,
        );
        controls.target.set(0, floorPose ? (framing === "bench" ? 1.05 : 0.65) : overhead ? 2.15 : 1.95, 0);
        prevMode = p.mode;
        prevAspect = camera.aspect;
        prevView = v;
        prevReset = p.reset;
      }
      if (prevExercise !== p.exercise.id) {
        t = 0;
        prevPhase = -1;
        prevExercise = p.exercise.id;
      }
      if (p.phase !== prevPhase) {
        t = (p.phase / 100) * Math.PI * 2;
        prevPhase = p.phase;
      }
      if (p.controlledPhase !== undefined) t = p.controlledPhase / 100 * Math.PI * 2;
      else if (p.playing && p.mode === "exercise") t += dt * p.speed * 1.45;
      const a = (1 - Math.cos(t)) * 0.5;
      if (now - reported > 120) {
        p.onPhase(((t % (2 * Math.PI)) / (2 * Math.PI)) * 100);
        reported = now;
      }
      const primary = p.mode === "explore" ? p.targets : p.exercise.primary,
        secondary = p.mode === "explore" ? [] : p.exercise.secondary;
      mats.forEach(({ mat, id }) => {
        const appearance = muscleAppearance(
          id,
          primary,
          secondary,
          p.playing,
          t,
        );
        mat.color.set(appearance.color);
        mat.emissive.set(appearance.emissive);
        mat.emissiveIntensity = appearance.intensity;
      });
      root.scale.x = 1;
      root.updateMatrixWorld(true);
      const propsVisibility = applyExercisePose(rig, p.exercise, a, p.mode);
      root.scale.x = p.mirrored ? -1 : 1;
      bar.visible = propsVisibility.barVisible;
      wall.visible = propsVisibility.wallVisible;
      root.updateMatrixWorld(true);
      guideGroup.visible =
        root.visible &&
        p.showGuides &&
        p.mode === "exercise" &&
        ["squat", "pushup"].includes(p.exercise.motion ?? "");
      if (pins.current)
        pins.current.style.display = guideGroup.visible ? "block" : "none";
      if (guideGroup.visible) {
        let positions: THREE.Vector3[] = [];
        if (p.exercise.motion === "squat") {
          const chosen = legs.find(
            (l) => l.s === (camera.position.x >= 0 ? 1 : -1),
          )!;
          const box = new THREE.Box3().setFromCenterAndSize(
              chosen.foot.localToWorld(new THREE.Vector3(0, -0.09, 0.075)),
              new THREE.Vector3(0.2, 0.2, 0.43),
            ),
            footCenter = box.getCenter(new THREE.Vector3());
          const hip = chosen.thigh.getWorldPosition(new THREE.Vector3()),
            knee = chosen.shin.getWorldPosition(new THREE.Vector3()),
            ankle = chosen.foot.getWorldPosition(new THREE.Vector3());
          toeLine.geometry.setFromPoints([
            new THREE.Vector3(footCenter.x, 0.01, box.max.z),
            new THREE.Vector3(footCenter.x, 1.13, box.max.z),
          ]);
          toeLine.computeLineDistances();
          chainLine.geometry.setFromPoints([hip, knee, ankle]);
          legs.forEach((l, i) => {
            const b = new THREE.Box3().setFromCenterAndSize(
              l.foot.localToWorld(new THREE.Vector3(0, -0.09, 0.075)),
              new THREE.Vector3(0.2, 0.2, 0.43),
            );
            pads[i].position.set(
              (b.min.x + b.max.x) / 2,
              0.02,
              b.min.z + 0.045,
            );
          });
          positions = [
            new THREE.Vector3(footCenter.x, 0.85, box.max.z),
            knee,
            pads[legs.indexOf(chosen)].position.clone(),
          ];
        } else {
          const arm = arms.find(
            (a) => a.s === (camera.position.x >= 0 ? 1 : -1),
          )!;
          const shoulder = arm.upper.getWorldPosition(new THREE.Vector3()),
            hip = pelvis.getWorldPosition(new THREE.Vector3()),
            ankle = legs[0].foot.getWorldPosition(new THREE.Vector3());
          const chest = torso.localToWorld(new THREE.Vector3(0, 0.7, 0.25));
          const wrist = arm.hand.getWorldPosition(new THREE.Vector3());
          chainLine.geometry.setFromPoints([shoulder, hip, ankle]);
          toeLine.geometry.setFromPoints([
            chest,
            new THREE.Vector3(chest.x, 0.02, chest.z),
          ]);
          toeLine.computeLineDistances();
          arms.forEach((a, i) => {
            pads[i].position.copy(a.hand.getWorldPosition(new THREE.Vector3()));
            pads[i].position.y = 0.02;
          });
          positions = [chest, hip, wrist];
        }
        positions.forEach((pos, i) => {
          const n = pos.clone().project(camera);
          const label = pins.current?.children[i] as HTMLElement | undefined;
          if (label) {
            const x = (n.x * 0.5 + 0.5) * el.clientWidth,
              y = (-n.y * 0.5 + 0.5) * el.clientHeight;
            label.style.transform = `translate(${Math.min(el.clientWidth - 130, Math.max(5, x + 12))}px,${Math.min(el.clientHeight - 25, Math.max(10, y + (i === 0 ? 24 : i === 1 ? -32 : -12)))}px)`;
          }
        });
      }
      controls.update();
      renderer.render(scene, camera);
      if (p.exportCount !== prevExport) {
        prevExport = p.exportCount;
        const snapshot = cloneSkeleton(root);
        snapshot.traverse((obj) => {
          delete obj.userData.restWorld;
          if (obj instanceof THREE.Line && !obj.userData.apparatus) obj.visible = false;
        });
        new GLTFExporter()
          .parseAsync(snapshot, { binary: true, onlyVisible: true })
          .then((data) => {
            const url = URL.createObjectURL(
              new Blob([data as ArrayBuffer], { type: "model/gltf-binary" }),
            );
            const a = document.createElement("a");
            a.href = url;
            a.download = "dayly-muscles.glb";
            a.click();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
            latest.current.onExport("已导出当前姿态 GLB（不含动画）");
          })
          .catch(() => latest.current.onExport("模型导出失败，请稍后重试"));
      }
    }
    frame = requestAnimationFrame(animate);
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      controls.dispose();
      renderer.domElement.removeEventListener("pointerdown", onDown);
      renderer.domElement.removeEventListener("pointerup", onClick);
      scene.traverse((o) => {
        if (o instanceof THREE.Mesh || o instanceof THREE.Line) {
          o.geometry.dispose();
          const materials = Array.isArray(o.material)
            ? o.material
            : [o.material];
          materials.forEach((m) => m.dispose());
        }
      });
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);
  return (
    <div
      className="body-canvas"
      ref={host}
      aria-label="可旋转的三维肌群模型，拖动旋转，滚轮缩放，点击肌群选择"
    >
      <div className="coach-pins" ref={pins} style={{ display: "none" }}>
        <span className="coach-pin">
          {props.exercise.motion === "pushup"
            ? "胸部接近地面"
            : "脚尖参考线 · 非限制线"}
        </span>
        <span className="coach-pin">
          {props.exercise.motion === "pushup"
            ? "躯干与腿保持直线"
            : "膝盖沿脚尖方向"}
        </span>
        <span className="coach-pin">
          {props.exercise.motion === "pushup" ? "手掌固定推地" : "脚跟稳定着地"}
        </span>
      </div>
      {assetStatus !== "ready" && !error && (
        <div className="model-loading" role="status">
          {assetStatus === "loading"
            ? "正在载入精细解剖模型…"
            : "解剖模型加载失败，请刷新重试"}
        </div>
      )}
      {error && (
        <div className="canvas-error">
          无法初始化 3D 画面。请开启浏览器硬件加速；仍可通过右侧列表选择肌群。
        </div>
      )}
    </div>
  );
}
