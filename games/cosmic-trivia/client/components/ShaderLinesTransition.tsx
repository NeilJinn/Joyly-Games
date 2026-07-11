import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

export interface ShaderLinesTransitionProps {
  active: boolean;
  runKey: string | null;
  readyToReveal: boolean;
  onComplete: () => void;
  durationMs?: number;
  fadeOutMs?: number;
  reducedMotion?: boolean;
}

interface Runtime {
  renderer: THREE.WebGLRenderer;
  geometry: THREE.BufferGeometry;
  material: THREE.ShaderMaterial;
  animationId: number | null;
  resize: () => void;
}

const ORIGINAL_VERTEX_SHADER = `
  void main() {
    gl_Position = vec4( position, 1.0 );
  }
`;

const ORIGINAL_FRAGMENT_SHADER = `
  #define TWO_PI 6.2831853072
  #define PI 3.14159265359

  precision highp float;
  uniform vec2 resolution;
  uniform float time;

  float random (in float x) {
      return fract(sin(x)*1e4);
  }
  float random (vec2 st) {
      return fract(sin(dot(st.xy,
                           vec2(12.9898,78.233)))*
          43758.5453123);
  }

  varying vec2 vUv;

  void main(void) {
    vec2 uv = (gl_FragCoord.xy * 2.0 - resolution.xy) / min(resolution.x, resolution.y);

    vec2 fMosaicScal = vec2(4.0, 2.0);
    vec2 vScreenSize = vec2(256,256);
    uv.x = floor(uv.x * vScreenSize.x / fMosaicScal.x) / (vScreenSize.x / fMosaicScal.x);
    uv.y = floor(uv.y * vScreenSize.y / fMosaicScal.y) / (vScreenSize.y / fMosaicScal.y);

    float t = time*0.06+random(uv.x)*0.4;
    float lineWidth = 0.0008;

    vec3 color = vec3(0.0);
    for(int j = 0; j < 3; j++){
      for(int i=0; i < 5; i++){
        color[j] += lineWidth*float(i*i) / abs(fract(t - 0.01*float(j)+float(i)*0.01)*1.0 - length(uv));
      }
    }

    gl_FragColor = vec4(color[2],color[1],color[0],1.0);
  }
`;

function isReducedMotion(): boolean {
  return typeof window !== "undefined"
    && typeof window.matchMedia === "function"
    && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function disposeRuntime(runtime: Runtime | null): void {
  if (!runtime) return;
  if (runtime.animationId !== null) cancelAnimationFrame(runtime.animationId);
  window.removeEventListener("resize", runtime.resize);
  runtime.renderer.dispose();
  runtime.geometry.dispose();
  runtime.material.dispose();
  runtime.renderer.domElement.remove();
}

function createRuntime(container: HTMLDivElement): Runtime {
  const camera = new THREE.Camera();
  camera.position.z = 1;
  const scene = new THREE.Scene();
  const geometry = new THREE.PlaneGeometry(2, 2);
  const uniforms = {
    time: { type: "f", value: 1.0 },
    resolution: { type: "v2", value: new THREE.Vector2() },
  };
  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: ORIGINAL_VERTEX_SHADER,
    fragmentShader: ORIGINAL_FRAGMENT_SHADER,
  });
  scene.add(new THREE.Mesh(geometry, material));

  const renderer = new THREE.WebGLRenderer();
  renderer.setPixelRatio(window.devicePixelRatio);
  container.appendChild(renderer.domElement);
  const resize = () => {
    const rect = container.getBoundingClientRect();
    renderer.setSize(rect.width, rect.height);
    uniforms.resolution.value.x = renderer.domElement.width;
    uniforms.resolution.value.y = renderer.domElement.height;
  };
  resize();
  window.addEventListener("resize", resize, false);

  const runtime: Runtime = { renderer, geometry, material, animationId: null, resize };
  const animate = () => {
    uniforms.time.value += 0.05;
    renderer.render(scene, camera);
    runtime.animationId = requestAnimationFrame(animate);
  };
  runtime.animationId = requestAnimationFrame(animate);
  return runtime;
}

export default function ShaderLinesTransition({
  active,
  runKey,
  readyToReveal,
  onComplete,
  durationMs = 2_400,
  fadeOutMs = 700,
  reducedMotion = false,
}: ShaderLinesTransitionProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const runtimeRef = useRef<Runtime | null>(null);
  const onCompleteRef = useRef(onComplete);
  const completedKeyRef = useRef<string | null>(null);
  const readyToRevealRef = useRef(readyToReveal);
  const [leavingKey, setLeavingKey] = useState<string | null>(null);
  const [enteredKey, setEnteredKey] = useState<string | null>(null);

  onCompleteRef.current = onComplete;
  readyToRevealRef.current = readyToReveal;
  const motionReduced = reducedMotion || isReducedMotion();
  const effectiveDurationMs = motionReduced ? Math.min(durationMs, 220) : durationMs;
  const effectiveFadeOutMs = motionReduced ? Math.min(fadeOutMs, 120) : fadeOutMs;

  useEffect(() => {
    if (!active || !runKey || completedKeyRef.current === runKey) return;
    let cancelled = false;
    let completionTimer: number | null = null;
    let revealTimer: number | null = null;
    let enterFrame: number | null = null;
    let fadeStarted = false;

    setLeavingKey(null);
    setEnteredKey(null);

    const finishWhenReady = () => {
      if (cancelled || fadeStarted) return;
      if (!readyToRevealRef.current) {
        completionTimer = window.setTimeout(finishWhenReady, 50);
        return;
      }
      fadeStarted = true;
      setLeavingKey(runKey);
      revealTimer = window.setTimeout(() => {
        if (cancelled) return;
        completedKeyRef.current = runKey;
        disposeRuntime(runtimeRef.current);
        runtimeRef.current = null;
        onCompleteRef.current();
      }, effectiveFadeOutMs);
    };

    completionTimer = window.setTimeout(finishWhenReady, effectiveDurationMs);
    enterFrame = requestAnimationFrame(() => {
      if (!cancelled) setEnteredKey(runKey);
    });

    if (!motionReduced && containerRef.current) {
      try {
        runtimeRef.current = createRuntime(containerRef.current);
      } catch {
        runtimeRef.current = null;
      }
    }

    return () => {
      cancelled = true;
      if (completionTimer !== null) window.clearTimeout(completionTimer);
      if (revealTimer !== null) window.clearTimeout(revealTimer);
      if (enterFrame !== null) cancelAnimationFrame(enterFrame);
      disposeRuntime(runtimeRef.current);
      runtimeRef.current = null;
    };
  }, [active, runKey, effectiveDurationMs, effectiveFadeOutMs, motionReduced]);

  if (!active || !runKey || completedKeyRef.current === runKey) return null;

  return (
    <div
      data-testid="shader-lines-transition"
      aria-hidden="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 60,
        overflow: "hidden",
        pointerEvents: "none",
        background: "#000",
        opacity: leavingKey === runKey ? 0 : enteredKey === runKey ? 1 : 0,
        transition: `opacity ${effectiveFadeOutMs}ms ease-out`,
      }}
    >
      <div ref={containerRef} style={{ position: "absolute", inset: 0 }} />
    </div>
  );
}
