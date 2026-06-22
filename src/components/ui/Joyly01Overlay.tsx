import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import gsap from 'gsap';

// ─── 色盘 ──────────────────────────────────────────────────
const PETAL_PAIRS = [
  { petal: 0xE8392A, stamen: 0xFFC107 },
  { petal: 0xF26522, stamen: 0xFFC107 },
  { petal: 0xFFC107, stamen: 0xE8392A },
  { petal: 0x1B3D8F, stamen: 0xF9C0C0 },
  { petal: 0xF9C0C0, stamen: 0x1B3D8F },
  { petal: 0xFFFFFF, stamen: 0xFFC107 },
  { petal: 0xF4A7A7, stamen: 0xFFC107 },
  { petal: 0xE8795E, stamen: 0x1B3D8F },
  { petal: 0xD95B43, stamen: 0x1B3D8F },
];
const LEAF_COLORS  = [0x00A99D, 0x00877D, 0x4ECDC4, 0x2D6A4F, 0x52B788];
const ALL_COLORS   = [
  ...PETAL_PAIRS.flatMap(p => [p.petal, p.stamen]),
  ...LEAF_COLORS,
];

// ─── 模型配置 ───────────────────────────────────────────────
type ModelKey = 'flower' | 'leaf' | 'confetti';

const MODEL_CFG: Record<ModelKey, {
  file: string;
  colorMode: 'flower' | 'leaf' | 'all';
  constrainRotation: boolean;
  bloomSpin: boolean;
  baseScale: number;
}> = {
  flower:   { file: 'flower.glb',   colorMode: 'flower', constrainRotation: true,  bloomSpin: true,  baseScale: 28 },
  leaf:     { file: 'leaf.glb',     colorMode: 'leaf',   constrainRotation: false, bloomSpin: false, baseScale: 28 },
  confetti: { file: 'confetti.glb', colorMode: 'all',    constrainRotation: false, bloomSpin: false, baseScale: 20 },
};

const PRESET_MODELS: Record<string, ModelKey[]> = {
  transition:  ['flower', 'leaf'],
  celebration: ['flower', 'leaf', 'confetti'],
};

const PRESET_COUNT: Record<string, number> = {
  transition:  24,
  celebration: 48,
};

// ─── Three.js 状态 ──────────────────────────────────────────
interface ThreeState {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  templates: Map<ModelKey, THREE.Object3D[]>;
  activeCount: number;
  rafId: number | null;
}

// ─── 工具函数 ───────────────────────────────────────────────

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

function extractTemplates(scene: THREE.Object3D): THREE.Object3D[] {
  const children = scene.children.filter(c => {
    let has = false;
    c.traverse(n => { if ((n as THREE.Mesh).isMesh) has = true; });
    return has;
  });
  return children.length > 1 ? children.map(c => deepClone(c)) : [scene];
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
      name: m.name,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 1,
    }));
    mesh.material = flat.length === 1 ? flat[0] : flat;
  });
}

function applyColor(obj: THREE.Object3D, key: ModelKey) {
  const cfg = MODEL_CFG[key];
  obj.traverse(node => {
    const mesh = node as THREE.Mesh;
    if (!mesh.isMesh) return;
    const mats = (Array.isArray(mesh.material) ? mesh.material : [mesh.material]) as THREE.MeshBasicMaterial[];
    mats.forEach(m => {
      if (cfg.colorMode === 'leaf') {
        m.color.setHex(LEAF_COLORS[Math.floor(Math.random() * LEAF_COLORS.length)]);
      } else if (cfg.colorMode === 'all') {
        m.color.setHex(ALL_COLORS[Math.floor(Math.random() * ALL_COLORS.length)]);
      } else {
        const pair = PETAL_PAIRS[Math.floor(Math.random() * PETAL_PAIRS.length)];
        if (/petal/i.test(m.name))       m.color.setHex(pair.petal);
        else if (/stamen/i.test(m.name)) m.color.setHex(pair.stamen);
        else if (/leaf/i.test(m.name))   m.color.setHex(pair.stamen);
        else                              m.color.setHex(pair.petal);
      }
    });
  });
}

function setOpacity(mats: THREE.MeshBasicMaterial[], v: number) {
  mats.forEach(m => { m.opacity = v; });
}

function collectMaterials(obj: THREE.Object3D): THREE.MeshBasicMaterial[] {
  const out: THREE.MeshBasicMaterial[] = [];
  obj.traverse(node => {
    const mesh = node as THREE.Mesh;
    if (!mesh.isMesh) return;
    const ms = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    (ms as THREE.MeshBasicMaterial[]).forEach(m => out.push(m));
  });
  return out;
}

// ─── 核心：burst 触发 ────────────────────────────────────────

function fireBurst(state: ThreeState, preset: string, origin: 'random' | 'bottom' = 'random') {
  const { scene, camera, templates } = state;
  const keys = PRESET_MODELS[preset] ?? ['flower'];
  const count = PRESET_COUNT[preset] ?? 24;

  // 摄像机在 z=800 处，fov=60，计算 z=0 平面的可见范围
  const dist = camera.position.z;
  const halfH = dist * Math.tan((camera.fov / 2) * Math.PI / 180);
  const halfW = halfH * camera.aspect;

  for (let i = 0; i < count; i++) {
    const key = keys[i % keys.length];
    const tplList = templates.get(key);
    if (!tplList?.length) continue;

    const tpl = tplList[i % tplList.length];
    const obj = deepClone(tpl);
    applyColor(obj, key);
    const mats = collectMaterials(obj);

    const cfg = MODEL_CFG[key];
    const targetScale = cfg.baseScale * (0.6 + Math.random() * 0.7);
    const delay = i * 0.055;

    // 位置和漂浮距离根据 origin 决定
    let spawnX: number, spawnY: number, floatDist: number, lifetime: number;
    if (origin === 'bottom') {
      // 从屏幕底端随机散布，向上漂过整个屏幕
      spawnX    = (Math.random() - 0.5) * halfW * 1.8;
      spawnY    = -halfH * (0.85 + Math.random() * 0.2);
      floatDist = halfH * 2.3;
      lifetime  = 4.8;
    } else {
      spawnX    = (Math.random() - 0.5) * halfW * 1.7;
      spawnY    = (Math.random() - 0.5) * halfH * 1.4;
      floatDist = halfH * 0.55;
      lifetime  = 3.8;
    }

    obj.position.set(spawnX, spawnY, 0);

    // 旋转
    if (cfg.constrainRotation) {
      const tilt = 25 * Math.PI / 180;
      obj.rotation.y = Math.random() * Math.PI * 2;
      obj.rotation.x = (Math.random() - 0.5) * 2 * tilt;
      obj.rotation.z = (Math.random() - 0.5) * 2 * tilt;
    } else {
      obj.rotation.x = Math.random() * Math.PI * 2;
      obj.rotation.y = Math.random() * Math.PI * 2;
      obj.rotation.z = Math.random() * Math.PI * 2;
    }

    // 初始状态：缩成小点，透明
    obj.scale.setScalar(targetScale * 0.05);
    setOpacity(mats, 0);

    // morph 初始为 Key 1（小球），若模型无 morph 则跳过
    obj.traverse(n => {
      const m = n as THREE.Mesh;
      if (m.isMesh && m.morphTargetInfluences?.length) m.morphTargetInfluences[0] = 1;
    });

    scene.add(obj);
    state.activeCount++;

    // ── 动画 ──
    // 放大绽放
    gsap.to(obj.scale, {
      x: targetScale, y: targetScale, z: targetScale,
      duration: 0.9, delay, ease: 'elastic.out(1, 0.55)',
    });

    // 花朵自旋
    if (cfg.bloomSpin) {
      const ty = obj.rotation.y;
      obj.rotation.y = ty - Math.PI * 3;
      gsap.to(obj.rotation, { y: ty, duration: 3.0, delay, ease: 'power2.out' });
    }

    // Morph 绽放
    obj.traverse(n => {
      const m = n as THREE.Mesh;
      if (m.isMesh && m.morphTargetInfluences?.length) {
        gsap.to(m.morphTargetInfluences, { 0: 0, duration: 0.7, delay, ease: 'power3.out' });
      }
    });

    // 淡入
    const fadeProxy = { v: 0 };
    gsap.to(fadeProxy, {
      v: 1, duration: 0.35, delay, ease: 'power2.out',
      onUpdate: () => setOpacity(mats, fadeProxy.v),
    });

    // 向上漂浮 + 淡出 + 移除
    gsap.to(obj.position, {
      y: obj.position.y + floatDist,
      duration: lifetime, delay, ease: 'power1.out',
    });
    gsap.to(fadeProxy, {
      v: 0, duration: 1.0,
      delay: delay + lifetime - 1.1,
      ease: 'power2.in',
      onUpdate: () => setOpacity(mats, fadeProxy.v),
      onComplete: () => {
        scene.remove(obj);
        state.activeCount--;
      },
    });
  }

  startRaf(state);
}

function startRaf(state: ThreeState) {
  if (state.rafId !== null) return;
  const loop = () => {
    if (state.activeCount <= 0) {
      state.renderer.clear();
      state.rafId = null;
      return;
    }
    state.renderer.render(state.scene, state.camera);
    state.rafId = requestAnimationFrame(loop);
  };
  state.rafId = requestAnimationFrame(loop);
}

// ─── React 组件 ─────────────────────────────────────────────

export interface Joyly01OverlayProps {
  preset?: 'transition' | 'celebration';
  trigger?: number;
  origin?: 'random' | 'bottom';
}

export default function Joyly01Overlay({ preset = 'transition', trigger, origin = 'random' }: Joyly01OverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef  = useRef<ThreeState | null>(null);
  const loadedRef = useRef(false);
  const pendingRef = useRef<{ preset: string; origin: 'random' | 'bottom' } | null>(null);

  // Three.js 初始化 + 模型预加载
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
      templates: new Map(),
      activeCount: 0,
      rafId: null,
    };
    stateRef.current = state;

    const loader = new GLTFLoader();
    const keys   = Object.keys(MODEL_CFG) as ModelKey[];
    let doneCount = 0;

    keys.forEach(key => {
      loader.load(
        `/assets/joyly01/${MODEL_CFG[key].file}`,
        gltf => {
          const tpls = extractTemplates(gltf.scene);
          tpls.forEach(t => convertToFlat(t));
          state.templates.set(key, tpls);
          doneCount++;
          if (doneCount === keys.length) {
            loadedRef.current = true;
            if (pendingRef.current) {
              fireBurst(state, pendingRef.current.preset, pendingRef.current.origin);
              pendingRef.current = null;
            }
          }
        },
        undefined,
        err => {
          console.warn(`Joyly01: 无法加载 ${MODEL_CFG[key].file}`, err);
          doneCount++;
          if (doneCount === keys.length) loadedRef.current = true;
        },
      );
    });

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

  // Trigger 变化时触发 burst
  useEffect(() => {
    if (!trigger) return;
    const state = stateRef.current;
    if (!state) return;

    if (!loadedRef.current) {
      pendingRef.current = { preset, origin };
      return;
    }
    fireBurst(state, preset, origin);
  }, [trigger]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <canvas
      ref={canvasRef}
      style={{ position: 'fixed', inset: 0, zIndex: 50, pointerEvents: 'none' }}
    />
  );
}
