import { useEffect, useRef, type RefObject } from "react";
import gsap from "gsap";

// ── Emoji maps ────────────────────────────────────────────────

const CATEGORY_EMOJIS: Record<string, string> = {
  general:   "🎯",
  geography: "🌍",
  history:   "🏛️",
  movies:    "🎬",
  nature:    "🌿",
  science:   "🔬",
  space:     "🚀",
  sports:    "⚽",
};

const TAG_EMOJIS: Record<string, string> = {
  ai:         "🤖",
  animals:    "🦁",
  books:      "📚",
  cards:      "🃏",
  earth:      "🌎",
  food:       "🍕",
  games:      "🎮",
  geography:  "🗺️",
  history:    "📜",
  inventions: "💡",
  language:   "💬",
  light:      "✨",
  movies:     "🎥",
  music:      "🎵",
  oceans:     "🌊",
  planets:    "🪐",
  plants:     "🌱",
  sports:     "🏆",
  weather:    "⛈️",
};

const ALL_EMOJIS = [...Object.values(CATEGORY_EMOJIS), ...Object.values(TAG_EMOJIS)];

function buildPool(categories?: string[], tags?: string[]) {
  const pool: string[] = [];
  for (const c of categories ?? []) if (CATEGORY_EMOJIS[c]) pool.push(CATEGORY_EMOJIS[c]);
  for (const t of tags ?? [])       if (TAG_EMOJIS[t])      pool.push(TAG_EMOJIS[t]);
  return pool.length > 0 ? pool : ALL_EMOJIS;
}

// ── Animation config ──────────────────────────────────────────

const CONFIG = {
  count:       50,
  perspective: 700,
  zStart:      -2000,
  zEnd:        500,
  durationMin: 3.5,
  durationMax: 6.5,
  spreadX:     1.6,
  spreadY:     1.4,
};

// ── Hook ──────────────────────────────────────────────────────

/**
 * Spawns a fullscreen emoji particle fly-through while `active` is true.
 * Attach the returned ref to the content element whose bounding box should
 * be kept clear of particles.
 */
export function useEmojiParticles(
  active: boolean,
  options?: { categories?: string[]; tags?: string[] },
): RefObject<HTMLDivElement> {
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!active) return;

    // ── Overlay portal ──
    const overlay = document.createElement("div");
    Object.assign(overlay.style, {
      position: "fixed", inset: "0", zIndex: "1",
      pointerEvents: "none",
      perspective: `${CONFIG.perspective}px`,
      perspectiveOrigin: "50% 50%",
    });
    const stage = document.createElement("div");
    Object.assign(stage.style, {
      position: "absolute", inset: "0", transformStyle: "preserve-3d",
    });
    overlay.appendChild(stage);
    document.body.appendChild(overlay);

    // ── Avoidance zone (center-relative coords to match GSAP 3D origin) ──
    let avoid: { xMin: number; xMax: number; yMin: number; yMax: number } | null = null;
    if (contentRef.current) {
      const r   = contentRef.current.getBoundingClientRect();
      const pad = 24;
      avoid = {
        xMin: r.left   - window.innerWidth  / 2 - pad,
        xMax: r.right  - window.innerWidth  / 2 + pad,
        yMin: r.top    - window.innerHeight / 2 - pad,
        yMax: r.bottom - window.innerHeight / 2 + pad,
      };
    }

    // ── Particle elements ──
    const emojis = buildPool(options?.categories, options?.tags);
    const anims: gsap.core.Tween[] = [];
    const items: HTMLDivElement[]  = [];

    for (let i = 0; i < CONFIG.count; i++) {
      const el   = document.createElement("div");
      const size = 28 + Math.random() * 36;
      el.style.cssText = [
        "position:absolute", "left:50%", "top:50%",
        "transform-origin:center center",
        "will-change:transform,opacity",
        "pointer-events:none", "user-select:none", "line-height:1",
      ].join(";");
      el.style.fontSize   = `${size}px`;
      el.style.marginLeft = `-${size / 2}px`;
      el.style.marginTop  = `-${size / 2}px`;
      el.textContent = emojis[Math.floor(Math.random() * emojis.length)];
      stage.appendChild(el);
      items.push(el);
    }

    // ── Launch fn (recursive via onComplete) ──
    function launch(el: HTMLDivElement, delay: number) {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      let x: number, y: number, tries = 0;
      do {
        x = (Math.random() - 0.5) * vw * CONFIG.spreadX;
        y = (Math.random() - 0.5) * vh * CONFIG.spreadY;
      } while (
        ++tries < 12 && avoid !== null &&
        x > avoid.xMin && x < avoid.xMax &&
        y > avoid.yMin && y < avoid.yMax
      );

      const rotZ     = Math.random() * 360;
      const duration = CONFIG.durationMin + Math.random() * (CONFIG.durationMax - CONFIG.durationMin);

      gsap.set(el, { x, y, z: CONFIG.zStart - Math.random() * 800,
        rotationZ: rotZ, rotationX: (Math.random() - 0.5) * 20, opacity: 0, scale: 1 });

      anims.push(
        gsap.to(el, { z: CONFIG.zEnd, rotationZ: rotZ + (Math.random() - 0.5) * 120,
          duration, delay, ease: "power1.in", onComplete: () => launch(el, 0) }),
        gsap.to(el, { opacity: 0.9, duration: duration * 0.18, delay, ease: "power2.out" }),
        gsap.to(el, { opacity: 0,   duration: duration * 0.22, delay: delay + duration * 0.78, ease: "power2.in" }),
      );
    }

    items.forEach((el, i) => launch(el, (i / items.length) * 5.5));

    return () => {
      anims.forEach(t => t.kill());
      overlay.remove();
    };
  // options is read once on mount; re-running on object identity change isn't needed
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  return contentRef;
}
