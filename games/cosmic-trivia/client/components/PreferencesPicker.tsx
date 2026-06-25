import { useState } from "react";
import Button from "../../ui/Button";

interface PreferencesPickerProps {
  options: { categories: string[]; tags: string[] };
  onSubmit: (prefs: { categories: string[]; tags: string[] }) => void;
  submitting: boolean;
}

// Emoji map for known category/tag names
const EMOJI: Record<string, string> = {
  space: "🚀", science: "🔬", general: "🌍", history: "📜",
  geography: "🗺️", nature: "🌿", movies: "🎬", sports: "⚽",
  planets: "🪐", ai: "🤖", light: "💡", inventions: "⚙️",
  cards: "🃏", language: "💬", oceans: "🌊", animals: "🐾",
  books: "📚", games: "🎮", earth: "🌎", food: "🍕",
  music: "🎵", plants: "🌱", weather: "⛅", art: "🎨",
  tech: "💻", film: "🎬", pop: "🎤", ancient: "🏛️",
};

const FALLBACK_EMOJI = "✦";

// Color palette cycled by index
const PALETTE = [
  { border: "rgba(99,102,241,.55)",  bg: "rgba(99,102,241,.1)",  text: "#818cf8", glow: "rgba(99,102,241,.18)"  },
  { border: "rgba(245,158,11,.5)",   bg: "rgba(245,158,11,.08)", text: "#fbbf24", glow: "rgba(245,158,11,.15)"  },
  { border: "rgba(16,185,129,.5)",   bg: "rgba(16,185,129,.08)", text: "#34d399", glow: "rgba(16,185,129,.15)"  },
  { border: "rgba(244,63,94,.5)",    bg: "rgba(244,63,94,.08)",  text: "#fb7185", glow: "rgba(244,63,94,.15)"   },
  { border: "rgba(6,182,212,.5)",    bg: "rgba(6,182,212,.08)",  text: "#22d3ee", glow: "rgba(6,182,212,.15)"   },
  { border: "rgba(249,115,22,.5)",   bg: "rgba(249,115,22,.08)", text: "#fb923c", glow: "rgba(249,115,22,.15)"  },
  { border: "rgba(236,72,153,.5)",   bg: "rgba(236,72,153,.08)", text: "#f472b6", glow: "rgba(236,72,153,.15)"  },
  { border: "rgba(139,92,246,.55)",  bg: "rgba(139,92,246,.1)",  text: "#a78bfa", glow: "rgba(139,92,246,.18)"  },
  { border: "rgba(20,184,166,.5)",   bg: "rgba(20,184,166,.08)", text: "#2dd4bf", glow: "rgba(20,184,166,.15)"  },
  { border: "rgba(120,212,94,.5)",   bg: "rgba(120,212,94,.08)", text: "#85d95f", glow: "rgba(120,212,94,.15)"  },
];

function toggle<T>(arr: T[], item: T, max: number): T[] {
  return arr.includes(item)
    ? arr.filter((x) => x !== item)
    : arr.length < max ? [...arr, item] : arr;
}

interface TileProps {
  label: string;
  active: boolean;
  colorIndex: number;
  onClick: () => void;
}

function Tile({ label, active, colorIndex, onClick }: TileProps) {
  const c = PALETTE[colorIndex % PALETTE.length];
  const emoji = EMOJI[label.toLowerCase()] ?? FALLBACK_EMOJI;

  return (
    <button
      type="button"
      onClick={onClick}
      className="relative flex flex-col items-center justify-center gap-[6px] rounded-[12px] border py-[12px] px-[4px] transition-all duration-200 cursor-pointer"
      style={active ? {
        borderColor: c.border,
        background: c.bg,
        boxShadow: `0 0 16px ${c.glow}, inset 0 1px 0 rgba(255,255,255,.06)`,
        transform: "scale(1.03)",
      } : {
        borderColor: "rgba(255,255,255,.07)",
        background: "rgba(255,255,255,.04)",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,.04)",
      }}
    >
      {/* checkmark */}
      <span
        className="absolute top-[6px] right-[6px] w-[14px] h-[14px] rounded-full flex items-center justify-center transition-all duration-200"
        style={active ? {
          background: c.border,
        } : {
          border: "1.5px solid rgba(255,255,255,.15)",
        }}
      >
        {active && (
          <svg width="8" height="7" viewBox="0 0 8 7" fill="none">
            <path d="M1 3.5l2 2 4-4" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        )}
      </span>

      {/* emoji */}
      <span className="text-[22px] leading-none" style={{ filter: "drop-shadow(0 1px 3px rgba(0,0,0,.35))" }}>
        {emoji}
      </span>

      {/* label */}
      <span
        className="text-[8px] font-[700] uppercase tracking-[.09em] leading-none transition-colors duration-200"
        style={{ color: active ? c.text : "rgba(200,212,222,.5)" }}
      >
        {label}
      </span>
    </button>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-[8px]">
      <span className="text-[9px] font-[700] uppercase tracking-[.12em] text-white/[.25] whitespace-nowrap">
        {children}
      </span>
      <div className="flex-1 h-px bg-white/[.06]" />
    </div>
  );
}

export default function PreferencesPicker({ options, onSubmit, submitting }: PreferencesPickerProps) {
  const [cats, setCats] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);

  const canSubmit = cats.length > 0 || tags.length > 0;

  return (
    <div className="grid gap-[14px]">
      <div className="grid gap-[8px]">
        <SectionLabel>Categories · up to 3</SectionLabel>
        <div className="grid grid-cols-3 gap-[6px]">
          {options.categories.map((cat, i) => (
            <Tile
              key={cat}
              label={cat}
              active={cats.includes(cat)}
              colorIndex={i}
              onClick={() => setCats(toggle(cats, cat, 3))}
            />
          ))}
        </div>
      </div>

      {options.tags.length > 0 && (
        <div className="grid gap-[8px]">
          <SectionLabel>Keywords · up to 5</SectionLabel>
          <div className="grid grid-cols-3 gap-[6px]">
            {options.tags.map((tag, i) => (
              <Tile
                key={tag}
                label={tag}
                active={tags.includes(tag)}
                colorIndex={i + 3}
                onClick={() => setTags(toggle(tags, tag, 5))}
              />
            ))}
          </div>
        </div>
      )}

      <Button
        variant="primary"
        className="w-full mt-[2px]"
        disabled={submitting || !canSubmit}
        onClick={() => onSubmit({ categories: cats, tags })}
      >
        <span>{submitting ? "Locking in…" : "Lock in choices"}</span>
      </Button>
    </div>
  );
}
