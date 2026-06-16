/**
 * ScoreBurstOverlay
 *
 * 流程：
 *  1. trigger 变化 → 在主屏幕中央附近散布花朵（1 per 答对玩家）+ 叶子（2x）
 *  2. 短暂停留后，每朵花飞向对应玩家的 ScoreRow（通过 data-player-id 定位）
 *  3. 落地时调用 onPlayerHit(playerId) → 外部触发分数条弹性动画
 *  4. 停留 REST_SECS 秒后，花朵用 shape key 缩回球形消失
 *  5. 全部消失后调用 onComplete()
 */

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import gsap from 'gsap';

// ─── 色盘 ────────────────────────────────────────────────────
const PETAL_PAIRS = [
  { petal: 0xE8392A, stamen: 0xFFC107 },
  { petal: 0xF26522, stamen: 0xFFC107 },
  { petal: 0xFFC107, stamen: 0xE8392A },
  { petal: 0x1B3D8F, stamen: 0xF9C0C0 },
  { petal: 0xF9C0C0, stamen: 0x1B3D8F },
  { petal: 0xFFFFFF, stamen: 0xFFC107 },
  { petal: 0xE8795E, stamen: 0x1B3D8F },
];
const LEAF_COLORS = [0x00A99D, 0x00877D, 0x4ECDC4, 0x2D6A4F, 0x52B788];

const BASE_SCALE   = 22;
const SPAWN_DELAY  = 0.9;   // 秒：出现到开始飞行的间隔
const FLIGHT_DUR   = 1.1;   // 秒：飞向分数条的时长
const REST_SECS    = 3.0;   // 秒：在分数条停留时长
const SHRINK_DUR   = 0.7;   // 秒：缩回球形时长

// ─── Three.js 状态 ───────────────────────────────────────────
interface ThreeState {
  renderer: THREE.WebGLRenderer;
  scene:    THREE.Scene;
  camera:   THREE.PerspectiveCamera;
  flowers:  THREE.Object3D[];   // 模板
  leaves:   THREE.Object3D[];   // 模板
  active:   number;
  rafId:    number | null;
}

// ─── 工具函数 ────────────────────────────────────────────────

function deepClone(src: THREE.Object3D): THREE.Object3D {
  const clone = src.clone(true);
  clone.traverse(node => {
    const mesh = node as THREE.Mesh;
    if (!mesh.isMesh || !mesh.material) return;
    mesh.material = Array.isArray(mesh.material)
      ? (mesh.material as THREE.Material[]).map(m => m.clone())
      : (mesh.material as THREE.Material).clone();
  });
  return clone;
}

function convertToFlat(model: THREE.Object3D) {
  model.traverse(node => {
    const mesh = node as THREE.Mesh;
    if (!mesh.isMesh) return;
    const src = Array.isArray(mesh.material)
      ? mesh.material as THREE.Material[]
      : [mesh.material as THREE.Material];
    const flat = src.map(m => new THREE.MeshBasicMaterial({
      color: (m as THREE.MeshStandardMaterial).color?.clone() ?? new THREE.Color(0xffffff),
      name:  m.name,
      side:  THREE.DoubleSide,
      transparent: true,
      opacity: 1,
    }));
    mesh.material = flat.length === 1 ? flat[0] : flat;
  });
}

function extractTemplates(scene: THREE.Object3D): THREE.Object3D[] {
  const children = scene.children.filter(c => {
    let has = false;
    c.traverse(n => { if ((n as THREE.Mesh).isMesh) has = true; });
    return has;
  });
  return children.length > 1 ? children.map(c => deepClone(c)) : [scene];
}

function setAllOpacity(mats: THREE.MeshBasicMaterial[], v: number) {
  mats.forEach(m => { m.opacity = v; });
}

function collectMats(obj: THREE.Object3D): THREE.MeshBasicMaterial[] {
  const out: THREE.MeshBasicMaterial[] = [];
  obj.traverse(n => {
    const mesh = n as THREE.Mesh;
    if (!mesh.isMesh) return;
    const ms = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    (ms as THREE.MeshBasicMaterial[]).forEach(m => out.push(m));
  });
  return out;
}

function applyFlowerColor(obj: THREE.Object3D) {
  const pair = PETAL_PAIRS[Math.floor(Math.random() * PETAL_PAIRS.length)];
  obj.traverse(n => {
    const mesh = n as THREE.Mesh;
    if (!mesh.isMesh) return;
    const mats = (Array.isArray(mesh.material) ? mesh.material : [mesh.material]) as THREE.MeshBasicMaterial[];
    mats.forEach(m => {
      if (/petal/i.test(m.name))       m.color.setHex(pair.petal);
      else if (/stamen/i.test(m.name)) m.color.setHex(pair.stamen);
      else if (/leaf/i.test(m.name))   m.color.setHex(pair.stamen);
      else                              m.color.setHex(pair.petal);
    });
  });
}

function applyLeafColor(obj: THREE.Object3D) {
  const hex = LEAF_COLORS[Math.floor(Math.random() * LEAF_COLORS.length)];
  obj.traverse(n => {
    const mesh = n as THREE.Mesh;
    if (!mesh.isMesh) return;
    const mats = (Array.isArray(mesh.material) ? mesh.material : [mesh.material]) as THREE.MeshBasicMaterial[];
    mats.forEach(m => m.color.setHex(hex));
  });
}

/** 屏幕像素坐标 → Three.js 世界坐标（z=0 平面） */
function screenToWorld(sx: number, sy: number, cam: THREE.PerspectiveCamera): THREE.Vector3 {
  const dist  = cam.position.z;
  const halfH = dist * Math.tan((cam.fov / 2) * Math.PI / 180);
  const halfW = halfH * cam.aspect;
  return new THREE.Vector3(
    (sx / window.innerWidth  - 0.5) * 2 * halfW,
    -(sy / window.innerHeight - 0.5) * 2 * halfH,
    0,
  );
}

/** 通过 data-player-id 找到分数条中心的屏幕坐标 */
function getPlayerBarScreen(playerId: string): { x: number; y: number } | null {
  const el = document.querySelector<HTMLElement>(`[data-player-id="${playerId}"]`);
  if (!el) return null;
  const rect = el.getBoundingClientRect();
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

// ─── RAF ────────────────────────────────────────────────────

function startRaf(state: ThreeState) {
  if (state.rafId !== null) return;
  const loop = () => {
    if (state.active <= 0) {
      state.renderer.clear();
      state.rafId = null;
      return;
    }
    state.renderer.render(state.scene, state.camera);
    state.rafId = requestAnimationFrame(loop);
  };
  state.rafId = requestAnimationFrame(loop);
}

// ─── 核心 burst ──────────────────────────────────────────────

function fireBurst(
  state:            ThreeState,
  correctPlayerIds: string[],
  onBurstReady:     (ids: string[]) => void,
  onPlayerHit:      (id: string) => void,
  onPlayerLeave:    (id: string) => void,
  onComplete:       () => void,
) {
  const { scene, camera } = state;
  const dist  = camera.position.z;
  const halfH = dist * Math.tan((camera.fov / 2) * Math.PI / 180);
  const halfW = halfH * camera.aspect;

  // 生成范围：靠近屏幕中心偏左（主内容区）
  const spawnCx = -halfW * 0.15;
  const spawnCy =  halfH * 0.05;

  let remaining = correctPlayerIds.length; // 需要全部落地+消失才算 complete

  // 花朵绽放后（约0.75s）通知外部：行可以开始高亮了
  gsap.delayedCall(0.75, () => { onBurstReady(correctPlayerIds); });

  correctPlayerIds.forEach((playerId, fi) => {
    // ── 花朵 ─────────────────────────────────────
    const flowerTpl = state.flowers[fi % state.flowers.length];
    if (flowerTpl) {
      const flower = deepClone(flowerTpl);
      applyFlowerColor(flower);
      const mats = collectMats(flower);

      const targetScale = BASE_SCALE * (0.7 + Math.random() * 0.5);
      const spawnDelay  = fi * 0.12;

      // 初始位置：主内容区随机散布
      flower.position.set(
        spawnCx + (Math.random() - 0.5) * halfW * 0.55,
        spawnCy + (Math.random() - 0.5) * halfH * 0.55,
        0,
      );

      // 旋转：花蕊朝上（constrainRotation=true）
      const tilt = 25 * Math.PI / 180;
      const finalRotY = Math.random() * Math.PI * 2;
      flower.rotation.x = (Math.random() - 0.5) * 2 * tilt;
      flower.rotation.z = (Math.random() - 0.5) * 2 * tilt;

      // 初始：缩很小、透明、morph=1（球形）
      flower.scale.setScalar(targetScale * 0.05);
      setAllOpacity(mats, 0);
      flower.traverse(n => {
        const m = n as THREE.Mesh;
        if (m.isMesh && m.morphTargetInfluences?.length) m.morphTargetInfluences[0] = 1;
      });

      // 自旋
      flower.rotation.y = finalRotY - Math.PI * 2;

      scene.add(flower);
      state.active++;

      // 绽放动画
      gsap.to(flower.scale, { x: targetScale, y: targetScale, z: targetScale, duration: 0.8, delay: spawnDelay, ease: 'elastic.out(1,0.55)' });
      gsap.to(flower.rotation, { y: finalRotY, duration: 2.5, delay: spawnDelay, ease: 'power2.out' });

      const fadeIn = { v: 0 };
      gsap.to(fadeIn, { v: 1, duration: 0.3, delay: spawnDelay, ease: 'power2.out', onUpdate: () => setAllOpacity(mats, fadeIn.v) });

      flower.traverse(n => {
        const m = n as THREE.Mesh;
        if (m.isMesh && m.morphTargetInfluences?.length) {
          gsap.to(m.morphTargetInfluences, { 0: 0, duration: 0.65, delay: spawnDelay, ease: 'power3.out' });
        }
      });

      // 飞向分数条
      const flyDelay = spawnDelay + SPAWN_DELAY;
      gsap.delayedCall(flyDelay, () => {
        const screen = getPlayerBarScreen(playerId);
        if (!screen) return;
        const target = screenToWorld(screen.x, screen.y, camera);

        gsap.to(flower.position, {
          x: target.x, y: target.y,
          duration: FLIGHT_DUR,
          ease: 'power2.inOut',
          onComplete: () => {
            // 花朵落地
            onPlayerHit(playerId);

            // REST_SECS 后缩回球形消失
            gsap.delayedCall(REST_SECS, () => {
              // 通知外部：花朵离开了
              onPlayerLeave(playerId);

              // shape key 回球
              flower.traverse(n => {
                const m = n as THREE.Mesh;
                if (m.isMesh && m.morphTargetInfluences?.length) {
                  gsap.to(m.morphTargetInfluences, { 0: 1, duration: SHRINK_DUR, ease: 'power2.in' });
                }
              });
              // 缩小 + 淡出
              gsap.to(flower.scale, { x: 0, y: 0, z: 0, duration: SHRINK_DUR + 0.2, delay: SHRINK_DUR * 0.4, ease: 'power2.in' });
              const fadeOut = { v: 1 };
              gsap.to(fadeOut, {
                v: 0, duration: 0.5, delay: SHRINK_DUR,
                ease: 'power2.in',
                onUpdate: () => setAllOpacity(mats, fadeOut.v),
                onComplete: () => {
                  scene.remove(flower);
                  state.active--;
                  remaining--;
                  if (remaining <= 0) onComplete();
                },
              });
            });
          },
        });
      });
    }

    // ── 叶子（2 片 per 玩家）────────────────────────
    for (let li = 0; li < 2; li++) {
      const leafTpl = state.leaves[li % Math.max(state.leaves.length, 1)];
      if (!leafTpl) continue;

      const leaf = deepClone(leafTpl);
      applyLeafColor(leaf);
      const leafMats = collectMats(leaf);

      const ls = BASE_SCALE * 0.9 * (0.7 + Math.random() * 0.5);
      const leafDelay = fi * 0.12 + li * 0.08;

      leaf.position.set(
        spawnCx + (Math.random() - 0.5) * halfW * 0.6,
        spawnCy + (Math.random() - 0.5) * halfH * 0.6,
        0,
      );
      leaf.rotation.x = Math.random() * Math.PI * 2;
      leaf.rotation.y = Math.random() * Math.PI * 2;
      leaf.rotation.z = Math.random() * Math.PI * 2;
      leaf.scale.setScalar(ls * 0.05);
      setAllOpacity(leafMats, 0);

      scene.add(leaf);
      state.active++;

      gsap.to(leaf.scale, { x: ls, y: ls, z: ls, duration: 0.8, delay: leafDelay, ease: 'elastic.out(1,0.55)' });

      const leafFadeIn = { v: 0 };
      gsap.to(leafFadeIn, { v: 1, duration: 0.3, delay: leafDelay, ease: 'power2.out', onUpdate: () => setAllOpacity(leafMats, leafFadeIn.v) });

      // 叶子漂上去消失（不飞向分数条）
      const floatDur = 3.5 + Math.random();
      gsap.to(leaf.position, { y: leaf.position.y + halfH * 0.45, duration: floatDur, delay: leafDelay, ease: 'power1.out' });

      const leafFadeOut = { v: 1 };
      gsap.to(leafFadeOut, {
        v: 0, duration: 0.9,
        delay: leafDelay + floatDur - 1.0,
        ease: 'power2.in',
        onUpdate: () => setAllOpacity(leafMats, leafFadeOut.v),
        onComplete: () => { scene.remove(leaf); state.active--; },
      });
    }
  });

  startRaf(state);
}

// ─── React 组件 ──────────────────────────────────────────────

export interface ScoreBurstProps {
  correctPlayerIds:  string[];
  trigger:           number;
  onBurstReady?:     (playerIds: string[]) => void;  // 花朵绽放完毕、行高亮开始
  onPlayerHit?:      (playerId: string) => void;
  onPlayerLeave?:    (playerId: string) => void;
  onComplete?:       () => void;
}

export default function ScoreBurstOverlay({
  correctPlayerIds,
  trigger,
  onBurstReady,
  onPlayerHit,
  onPlayerLeave,
  onComplete,
}: ScoreBurstProps) {
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const stateRef   = useRef<ThreeState | null>(null);
  const loadedRef  = useRef(false);
  const pendingRef = useRef<string[] | null>(null);

  // 把 callback refs 存起来，避免 stale closure
  const onBurstReadyRef = useRef(onBurstReady);
  const onHitRef        = useRef(onPlayerHit);
  const onLeaveRef      = useRef(onPlayerLeave);
  const onCompleteRef   = useRef(onComplete);
  onBurstReadyRef.current = onBurstReady;
  onHitRef.current        = onPlayerHit;
  onLeaveRef.current      = onPlayerLeave;
  onCompleteRef.current   = onComplete;

  useEffect(() => {
    const canvas = canvasRef.current!;
    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NoToneMapping;

    const scene  = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 1, 5000);
    camera.position.set(0, 0, 800);

    const state: ThreeState = {
      renderer, scene, camera,
      flowers: [], leaves: [],
      active: 0, rafId: null,
    };
    stateRef.current = state;

    const loader = new GLTFLoader();
    let done = 0;
    const tryReady = () => {
      done++;
      if (done < 2) return;
      loadedRef.current = true;
      if (pendingRef.current) {
        const ids = pendingRef.current;
        pendingRef.current = null;
        fire(state, ids);
      }
    };

    loader.load('/assets/joyly01/flower.glb', gltf => {
      state.flowers = extractTemplates(gltf.scene);
      state.flowers.forEach(t => convertToFlat(t));
      tryReady();
    }, undefined, err => { console.warn('ScoreBurst: flower.glb 加载失败', err); tryReady(); });

    loader.load('/assets/joyly01/leaf.glb', gltf => {
      state.leaves = extractTemplates(gltf.scene);
      state.leaves.forEach(t => convertToFlat(t));
      tryReady();
    }, undefined, err => { console.warn('ScoreBurst: leaf.glb 加载失败', err); tryReady(); });

    const onResize = () => {
      renderer.setSize(window.innerWidth, window.innerHeight);
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
    };
    window.addEventListener('resize', onResize);

    return () => {
      window.removeEventListener('resize', onResize);
      if (state.rafId !== null) cancelAnimationFrame(state.rafId);
      renderer.dispose();
      stateRef.current = null;
    };
  }, []);

  function fire(state: ThreeState, ids: string[]) {
    if (!ids.length) return;
    fireBurst(
      state, ids,
      ids => onBurstReadyRef.current?.(ids),
      id  => onHitRef.current?.(id),
      id  => onLeaveRef.current?.(id),
      ()  => onCompleteRef.current?.(),
    );
  }

  useEffect(() => {
    if (!trigger) return;
    const state = stateRef.current;
    if (!state) return;
    if (!loadedRef.current) { pendingRef.current = correctPlayerIds; return; }
    fire(state, correctPlayerIds);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trigger]);

  return (
    <canvas
      ref={canvasRef}
      style={{ position: 'fixed', inset: 0, zIndex: 48, pointerEvents: 'none' }}
    />
  );
}
