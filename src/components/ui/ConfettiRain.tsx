/**
 * ConfettiRain
 *
 * 持续从屏幕顶端落下彩带，active=true 时持续生成，active=false 时停止生成
 * 但场景中已存在的彩带会自然落完再消失。
 */

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import gsap from 'gsap';

const COLORS = [
  0xE8392A, 0xF26522, 0xFFC107, 0x1B3D8F, 0xF9C0C0,
  0x00A99D, 0xFFFFFF, 0xE8795E, 0x78D45E, 0xFF6B6B,
  0x9B59B6, 0x3498DB, 0xFFD700, 0xFF69B4,
];
const BASE_SCALE   = 18;
const BATCH_SIZE   = 5;    // 每批生成数量
const BATCH_MS     = 320;  // 批次间隔（毫秒）

// ─── Three.js 状态 ─────────────────────────────────────────

interface ThreeState {
  renderer:    THREE.WebGLRenderer;
  scene:       THREE.Scene;
  camera:      THREE.PerspectiveCamera;
  templates:   THREE.Object3D[];
  activeCount: number;
  rafId:       number | null;
  intervalId:  ReturnType<typeof setInterval> | null;
}

// ─── 工具函数 ──────────────────────────────────────────────

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

function setOpacity(mats: THREE.MeshBasicMaterial[], v: number) {
  mats.forEach(m => { m.opacity = v; });
}

function applyColor(obj: THREE.Object3D) {
  const hex = COLORS[Math.floor(Math.random() * COLORS.length)];
  obj.traverse(n => {
    const mesh = n as THREE.Mesh;
    if (!mesh.isMesh) return;
    const mats = (Array.isArray(mesh.material) ? mesh.material : [mesh.material]) as THREE.MeshBasicMaterial[];
    mats.forEach(m => m.color.setHex(hex));
  });
}

function startRaf(state: ThreeState) {
  if (state.rafId !== null) return;
  const loop = () => {
    if (state.activeCount <= 0 && state.intervalId === null) {
      state.renderer.clear();
      state.rafId = null;
      return;
    }
    state.renderer.render(state.scene, state.camera);
    state.rafId = requestAnimationFrame(loop);
  };
  state.rafId = requestAnimationFrame(loop);
}

// ─── 单批生成 ──────────────────────────────────────────────

function spawnBatch(state: ThreeState) {
  const { scene, camera, templates } = state;
  if (!templates.length) return;

  const dist  = camera.position.z;
  const halfH = dist * Math.tan((camera.fov / 2) * Math.PI / 180);
  const halfW = halfH * camera.aspect;

  for (let i = 0; i < BATCH_SIZE; i++) {
    const tpl = templates[Math.floor(Math.random() * templates.length)];
    const obj = deepClone(tpl);
    applyColor(obj);
    const mats = collectMats(obj);

    const scale   = BASE_SCALE * (0.5 + Math.random() * 0.9);
    const startX  = (Math.random() - 0.5) * halfW * 1.9;
    const startY  = halfH + scale * 0.5;          // 屏幕顶端以上
    const endY    = -halfH - scale * 0.5;          // 屏幕底端以下
    const fallDur = 2.8 + Math.random() * 2.0;
    const delay   = i * 0.06 + Math.random() * 0.1;
    const driftX  = (Math.random() - 0.5) * halfW * 0.25;

    obj.position.set(startX, startY, 0);
    obj.rotation.x = Math.random() * Math.PI * 2;
    obj.rotation.y = Math.random() * Math.PI * 2;
    obj.rotation.z = Math.random() * Math.PI * 2;
    obj.scale.setScalar(scale);
    setOpacity(mats, 0);

    scene.add(obj);
    state.activeCount++;

    // 沿长轴（z）自旋，x/y 轻微摆动
    const spinDir = Math.random() > 0.5 ? 1 : -1;
    gsap.to(obj.rotation, {
      z: `+=${spinDir * Math.PI * (4 + Math.random() * 3)}`,   // 主轴：2-3.5 圈
      x: `+=${(Math.random() - 0.5) * Math.PI * 1.5}`,          // 轻微翻滚
      y: `+=${(Math.random() - 0.5) * Math.PI * 1.0}`,          // 轻微摆动
      duration: fallDur,
      delay,
      ease: 'none',
    });

    gsap.to(obj.position, {
      y: endY,
      x: startX + driftX,
      duration: fallDur,
      delay,
      ease: 'power1.in',
    });

    // 淡入
    const fp = { v: 0 };
    gsap.to(fp, {
      v: 1, duration: 0.25, delay, ease: 'power2.out',
      onUpdate: () => setOpacity(mats, fp.v),
    });

    // 淡出 + 移除
    gsap.to(fp, {
      v: 0, duration: 0.4,
      delay: delay + fallDur - 0.5,
      ease: 'power2.in',
      onUpdate: () => setOpacity(mats, fp.v),
      onComplete: () => { scene.remove(obj); state.activeCount--; },
    });
  }

  startRaf(state);
}

// ─── React 组件 ────────────────────────────────────────────

interface Props {
  active: boolean;
  zIndex?: number;
}

export default function ConfettiRain({ active, zIndex = 50 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef  = useRef<ThreeState | null>(null);
  const loadedRef = useRef(false);
  const activeRef = useRef(active);
  activeRef.current = active;

  // Three.js 初始化 + 加载模型
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
      templates: [], activeCount: 0,
      rafId: null, intervalId: null,
    };
    stateRef.current = state;

    const loader = new GLTFLoader();
    loader.load(
      '/assets/joyly01/confetti.glb',
      gltf => {
        const children = gltf.scene.children.filter(c => {
          let has = false;
          c.traverse(n => { if ((n as THREE.Mesh).isMesh) has = true; });
          return has;
        });
        const tpls = children.length > 1
          ? children.map(c => { const cl = deepClone(c); convertToFlat(cl); return cl; })
          : [gltf.scene];
        tpls.forEach(t => convertToFlat(t));
        state.templates = tpls;
        loadedRef.current = true;

        // 如果加载完成时 active 已经是 true，立即开始
        if (activeRef.current) startSpawning(state);
      },
      undefined,
      err => {
        console.warn('ConfettiRain: 无法加载 confetti.glb', err);
        loadedRef.current = true;
      },
    );

    const onResize = () => {
      renderer.setSize(window.innerWidth, window.innerHeight);
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
    };
    const onVisibilityChange = () => {
      if (!loadedRef.current) return;
      if (document.hidden) {
        stopSpawning(state);
      } else if (activeRef.current) {
        startSpawning(state);
      }
    };
    window.addEventListener('resize', onResize);
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      window.removeEventListener('resize', onResize);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      stopSpawning(state);
      if (state.rafId !== null) cancelAnimationFrame(state.rafId);
      renderer.dispose();
      stateRef.current = null;
    };
  }, []);

  // 响应 active 变化
  useEffect(() => {
    const state = stateRef.current;
    if (!state || !loadedRef.current) return;
    if (active) {
      startSpawning(state);
    } else {
      stopSpawning(state);
    }
  }, [active]);

  return (
    <canvas
      ref={canvasRef}
      style={{ position: 'fixed', inset: 0, zIndex, pointerEvents: 'none' }}
    />
  );
}

function startSpawning(state: ThreeState) {
  if (state.intervalId !== null) return;
  spawnBatch(state);
  state.intervalId = setInterval(() => spawnBatch(state), BATCH_MS);
}

function stopSpawning(state: ThreeState) {
  if (state.intervalId !== null) {
    clearInterval(state.intervalId);
    state.intervalId = null;
  }
}
