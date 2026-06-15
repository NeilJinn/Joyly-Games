# Phase 5 — Cosmic Trivia Game UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port the Cosmic Trivia game UI to React — both the host big screen and the player phone. Vanilla JS files in `public/` remain untouched; this is a parallel React implementation.

**Architecture:**
- Big screen: `LobbyPage` already handles `/room/:code`. When `room.status === "playing"`, it renders `<CosmicTriviaHost />` instead of the lobby UI.
- Phone: `InRoomPage` handles `/play/:code`. It detects `room.selectedGame?.id === "cosmic-trivia"` and renders `<CosmicTriviaPhone />`.
- Game state: `room.gameState` (from SSE) IS the Cosmic Trivia `publicState` object — no extra fetch needed.
- Private state (personal score in hidden-score mode): fetched via `GET /api/rooms/:code/trivia/private/:playerId` when phase changes.

**Tech Stack:** React 18, TypeScript, Vite 5, Tailwind CSS, Zustand, Framer Motion.

---

## Critical reference — server API

### Game state (from SSE via room.gameState)
```ts
interface CosmicTriviaState {
  phase: CosmicTriviaPhase;
  phaseEndsAt: number | null;       // Unix ms timestamp, null if no timer
  questionIndex: number;            // 0-based
  questionCount: number;            // questions in this round
  questionCountOptions: number[];   // [5, 8, 10, 12]
  currentQuestion: CosmicQuestion | null;
  scores: Record<string, number>;   // playerId → points
  scoreVisibility: "visible" | "hidden";
  scoreboardVisible: boolean;
  answeredPlayerIds: string[];      // who answered current question
  expectedAnswerCount: number;      // total active players
  preferencePlayerIds: string[];    // who locked preferences
  expectedPreferenceCount: number;
  playerStates: Record<string, { preferences: { categories: string[]; tags: string[] }; preferencesLocked: boolean }>;
  questionOptions: { categories: string[]; tags: string[] } | null;
  lastResolution: { correctAnswerId: string; fact: string; rewards: Record<string, number> } | null;
  finalHype: { current: { text: string } | null } | null;
  isFinalQuestion: boolean;
}

interface CosmicQuestion {
  id: string;
  question: string;
  answers: { id: string; text: string }[];
  correctAnswer: string | null;  // null until reveal phase
  fact: string;                  // empty until reveal phase
  category: string;
}

type CosmicTriviaPhase =
  | "game-setup" | "preferences" | "round-prep"
  | "question-intro" | "question-read" | "answering" | "answer-lock"
  | "reveal" | "scoring" | "between-questions"
  | "final-hype" | "finale" | "post-game";
```

### Player answer
`POST /api/rooms/:code/trivia/answer`
Body: `{ playerId: string, choice: string }` — `choice` is the answer `id` (UUID, NOT "a"/"b"/"c"/"d")
Returns: `{ trivia: CosmicTriviaState, room: Room }`

### Player preferences
`POST /api/rooms/:code/trivia/preferences`
Body: `{ playerId: string, preferences: { categories: string[], tags: string[] } }`
Returns: `{ trivia: CosmicTriviaState, room: Room }`

### Host setup (question count)
`POST /api/rooms/:code/trivia/setup`
Body: `{ questionCount: number }` — one of [5, 8, 10, 12]
Returns: `{ trivia: CosmicTriviaState, room: Room }`

### Private state (per-player hidden score)
`GET /api/rooms/:code/trivia/private/:playerId`
Returns: `{ privateState: { personalScore: number, hiddenScoreMode: boolean, scoreVisibility: "visible"|"hidden" } }`

---

## Phase display logic

| Phase(s) | Big screen shows | Phone shows |
|----------|-----------------|-------------|
| `game-setup` | Question count picker (5/8/10/12) | "The host is setting up" |
| `preferences` | "Players are choosing categories" + countdown | Category/tag picker (interactive) |
| `round-prep`, `question-intro`, `question-read` | Prep card with phase label | "Choices locked — get ready!" |
| `answering` | Question + 2×2 answer grid + timer + sidebar | Question + 2×2 answer buttons (tappable) |
| `answer-lock` | "Answers locked" + question | "Your answer is locked" |
| `reveal`, `scoring`, `between-questions` | Question + correct answer highlighted + fact | "Correct answer: X" + fact |
| `final-hype`, `finale` | Suspense card + finalHype text | "Final results incoming…" |
| `post-game` | Winner board (ranked player list) | "Check the big screen for results" |

---

## Countdown timer hook

All phases with a timer use `phaseEndsAt`. Create a reusable hook:

```ts
// src/hooks/useCountdown.ts
import { useState, useEffect } from "react";

export function useCountdown(endsAt: number | null): number {
  const [secs, setSecs] = useState(() =>
    endsAt ? Math.max(0, Math.ceil((endsAt - Date.now()) / 1000)) : 0
  );
  useEffect(() => {
    if (!endsAt) { setSecs(0); return; }
    const tick = () => setSecs(Math.max(0, Math.ceil((endsAt - Date.now()) / 1000)));
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [endsAt]);
  return secs;
}
```

---

## Answer letter labels

The server uses UUID answer IDs. Display letters are derived from index position:

```ts
const ANSWER_LETTERS = ["A", "B", "C", "D"];
// answers[0].id → "A", answers[1].id → "B", etc.
```

---

## File map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/types/cosmic-trivia.ts` | **Create** | All Cosmic Trivia TypeScript types |
| `src/hooks/useCountdown.ts` | **Create** | Reusable countdown timer hook |
| `src/components/games/cosmic-trivia/AnswerGrid.tsx` | **Create** | 2×2 answer buttons (shared phone + big screen) |
| `src/components/games/cosmic-trivia/PreferencesPicker.tsx` | **Create** | Category + tag multi-select, phone preferences phase |
| `src/components/games/cosmic-trivia/ScoreRow.tsx` | **Create** | Single player score row with answer status |
| `src/components/games/cosmic-trivia/CountdownBar.tsx` | **Create** | Visual countdown timer bar |
| `src/components/games/cosmic-trivia/WinnerBoard.tsx` | **Create** | Post-game ranked player list |
| `src/pages/games/cosmic-trivia/PhonePage.tsx` | **Replace** | Phone root — routes to phone sub-views by phase |
| `src/pages/games/cosmic-trivia/BigScreenPage.tsx` | **Replace** | Host big screen root — routes by phase |
| `src/pages/platform/LobbyPage.tsx` | **Modify** | When `room.status === "playing"`, render BigScreenPage content |
| `src/pages/player/InRoomPage.tsx` | **Modify** | Detect game ID, render PhonePage for cosmic-trivia |

---

## Task 1: Types + countdown hook

**Files:**
- Create: `src/types/cosmic-trivia.ts`
- Create: `src/hooks/useCountdown.ts`

- [ ] **Step 1: Create `src/types/cosmic-trivia.ts`**

```ts
export type CosmicTriviaPhase =
  | "game-setup"
  | "preferences"
  | "round-prep"
  | "question-intro"
  | "question-read"
  | "answering"
  | "answer-lock"
  | "reveal"
  | "scoring"
  | "between-questions"
  | "final-hype"
  | "finale"
  | "post-game";

export interface CosmicAnswer {
  id: string;
  text: string;
}

export interface CosmicQuestion {
  id: string;
  question: string;
  answers: CosmicAnswer[];
  correctAnswer: string | null;
  fact: string;
  category: string;
}

export interface CosmicPlayerState {
  preferences: { categories: string[]; tags: string[] };
  preferencesLocked: boolean;
}

export interface CosmicLastResolution {
  correctAnswerId: string;
  fact: string;
  rewards: Record<string, number>;
}

export interface CosmicFinalHype {
  current: { text: string } | null;
}

export interface CosmicTriviaState {
  phase: CosmicTriviaPhase;
  phaseEndsAt: number | null;
  questionIndex: number;
  questionCount: number;
  questionCountOptions: number[];
  currentQuestion: CosmicQuestion | null;
  scores: Record<string, number>;
  scoreVisibility: "visible" | "hidden";
  scoreboardVisible: boolean;
  answeredPlayerIds: string[];
  expectedAnswerCount: number;
  preferencePlayerIds: string[];
  expectedPreferenceCount: number;
  playerStates: Record<string, CosmicPlayerState>;
  questionOptions: { categories: string[]; tags: string[] } | null;
  lastResolution: CosmicLastResolution | null;
  finalHype: CosmicFinalHype | null;
  isFinalQuestion: boolean;
}

export interface CosmicPrivateState {
  personalScore: number;
  hiddenScoreMode: boolean;
  scoreVisibility: "visible" | "hidden";
}

export const ANSWER_LETTERS = ["A", "B", "C", "D"] as const;
```

- [ ] **Step 2: Create `src/hooks/useCountdown.ts`**

```ts
import { useState, useEffect } from "react";

export function useCountdown(endsAt: number | null): number {
  const [secs, setSecs] = useState(() =>
    endsAt ? Math.max(0, Math.ceil((endsAt - Date.now()) / 1000)) : 0
  );
  useEffect(() => {
    if (!endsAt) { setSecs(0); return; }
    const tick = () => setSecs(Math.max(0, Math.ceil((endsAt - Date.now()) / 1000)));
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [endsAt]);
  return secs;
}
```

- [ ] **Step 3: TypeScript check**

```bash
cd /Users/neil/Documents/派对游戏 && npx tsc --noEmit 2>&1 | head -20
```

Expected: zero errors.

- [ ] **Step 4: Commit**

```bash
cd /Users/neil/Documents/派对游戏
git add src/types/cosmic-trivia.ts src/hooks/useCountdown.ts
git commit -m "feat(trivia): add Cosmic Trivia types and useCountdown hook"
```

---

## Task 2: AnswerGrid + CountdownBar shared components

**Files:**
- Create: `src/components/games/cosmic-trivia/AnswerGrid.tsx`
- Create: `src/components/games/cosmic-trivia/CountdownBar.tsx`

### AnswerGrid

Used on both phone (tappable) and big screen (display-only or with correct highlight).

Props:
```ts
interface AnswerGridProps {
  answers: CosmicAnswer[];
  selectedId?: string | null;       // phone: player's selected answer
  correctId?: string | null;        // reveal phase: server-provided correct answer
  disabled?: boolean;               // phone: after submitting or phase ended
  onSelect?: (answerId: string) => void;
  variant: "phone" | "big-screen";  // sizing
}
```

Letter colors: A = `#5e82f4` (blue), B = `#f4b04a` (orange), C = `#e05eb4` (pink), D = `#5eb8d4` (cyan).
Correct answer: `border-[#78d45e] bg-[rgba(120,212,94,.15)]`
Selected (phone, not yet revealed): `border-[rgba(120,212,94,.6)] bg-[rgba(120,212,94,.08)]`
Default: `border-white/[.1] bg-[rgba(17,24,33,.8)]`

- [ ] **Step 1: Create `src/components/games/cosmic-trivia/AnswerGrid.tsx`**

```tsx
import type { CosmicAnswer } from "../../../types/cosmic-trivia";
import { ANSWER_LETTERS } from "../../../types/cosmic-trivia";

const LETTER_COLORS = ["#5e82f4", "#f4b04a", "#e05eb4", "#5eb8d4"] as const;

interface AnswerGridProps {
  answers: CosmicAnswer[];
  selectedId?: string | null;
  correctId?: string | null;
  disabled?: boolean;
  onSelect?: (answerId: string) => void;
  variant?: "phone" | "big-screen";
}

export default function AnswerGrid({
  answers,
  selectedId,
  correctId,
  disabled,
  onSelect,
  variant = "phone",
}: AnswerGridProps) {
  const isBig = variant === "big-screen";

  return (
    <div className={[
      "grid grid-cols-2",
      isBig ? "gap-[12px]" : "gap-[10px]",
    ].join(" ")}>
      {answers.map((answer, i) => {
        const letter = ANSWER_LETTERS[i] ?? String.fromCharCode(65 + i);
        const color = LETTER_COLORS[i] ?? "#c8d4de";
        const isCorrect = correctId && answer.id === correctId;
        const isSelected = selectedId === answer.id;
        const isWrong = correctId && isSelected && !isCorrect;

        let borderColor = "rgba(255,255,255,.1)";
        let bgColor = "rgba(17,24,33,.8)";
        if (isCorrect) { borderColor = "#78d45e"; bgColor = "rgba(120,212,94,.15)"; }
        else if (isWrong) { borderColor = "rgba(246,114,114,.5)"; bgColor = "rgba(246,114,114,.08)"; }
        else if (isSelected) { borderColor = "rgba(120,212,94,.6)"; bgColor = "rgba(120,212,94,.08)"; }

        return (
          <button
            key={answer.id}
            type="button"
            disabled={disabled || !onSelect}
            onClick={() => onSelect?.(answer.id)}
            className={[
              "flex items-start gap-[10px] rounded-[10px] border text-left transition-colors",
              isBig ? "p-[16px] min-h-[80px]" : "p-[12px] min-h-[64px]",
              "disabled:cursor-default",
            ].join(" ")}
            style={{ borderColor, backgroundColor: bgColor }}
          >
            <span
              className={[
                "flex-none rounded-full font-[800] flex items-center justify-center",
                isBig ? "w-[32px] h-[32px] text-[14px]" : "w-[26px] h-[26px] text-[12px]",
              ].join(" ")}
              style={{ background: color, color: "#fff" }}
            >
              {letter}
            </span>
            <span className={[
              "text-[var(--ink)] font-[600] leading-snug",
              isBig ? "text-[16px]" : "text-[14px]",
            ].join(" ")}>
              {answer.text}
            </span>
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Create `src/components/games/cosmic-trivia/CountdownBar.tsx`**

```tsx
import { useCountdown } from "../../../hooks/useCountdown";

interface CountdownBarProps {
  endsAt: number | null;
  totalSecs: number;
}

export default function CountdownBar({ endsAt, totalSecs }: CountdownBarProps) {
  const secs = useCountdown(endsAt);
  const pct = totalSecs > 0 ? Math.min(100, (secs / totalSecs) * 100) : 0;
  const isDanger = secs <= 5;
  const isWarning = secs <= 10 && !isDanger;

  return (
    <div className="flex items-center gap-[12px]">
      <div className="flex-1 h-[6px] rounded-full bg-white/[.08] overflow-hidden">
        <div
          className={[
            "h-full rounded-full transition-all duration-500",
            isDanger ? "bg-[#f67272]" : isWarning ? "bg-[var(--sun)]" : "bg-[var(--green)]",
          ].join(" ")}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className={[
        "text-[20px] font-[800] w-[40px] text-right tabular-nums",
        isDanger ? "text-[#f67272]" : isWarning ? "text-[var(--sun)]" : "text-[var(--muted)]",
      ].join(" ")}>
        {secs}s
      </span>
    </div>
  );
}
```

- [ ] **Step 3: TypeScript check**

```bash
cd /Users/neil/Documents/派对游戏 && npx tsc --noEmit 2>&1 | head -20
```

Expected: zero errors.

- [ ] **Step 4: Commit**

```bash
cd /Users/neil/Documents/派对游戏
git add src/components/games/cosmic-trivia/AnswerGrid.tsx src/components/games/cosmic-trivia/CountdownBar.tsx
git commit -m "feat(trivia): add AnswerGrid and CountdownBar shared components"
```

---

## Task 3: PreferencesPicker + ScoreRow + WinnerBoard

**Files:**
- Create: `src/components/games/cosmic-trivia/PreferencesPicker.tsx`
- Create: `src/components/games/cosmic-trivia/ScoreRow.tsx`
- Create: `src/components/games/cosmic-trivia/WinnerBoard.tsx`

### PreferencesPicker

Phone component for the `preferences` phase. Lets players pick up to 3 categories and 5 tags.

Props:
```ts
interface PreferencesPickerProps {
  options: { categories: string[]; tags: string[] };
  onSubmit: (prefs: { categories: string[]; tags: string[] }) => void;
  submitting: boolean;
}
```

- [ ] **Step 1: Create `src/components/games/cosmic-trivia/PreferencesPicker.tsx`**

```tsx
import { useState } from "react";
import Button from "../../ui/Button";

interface PreferencesPickerProps {
  options: { categories: string[]; tags: string[] };
  onSubmit: (prefs: { categories: string[]; tags: string[] }) => void;
  submitting: boolean;
}

function toggle<T>(arr: T[], item: T, max: number): T[] {
  return arr.includes(item) ? arr.filter((x) => x !== item) : arr.length < max ? [...arr, item] : arr;
}

export default function PreferencesPicker({ options, onSubmit, submitting }: PreferencesPickerProps) {
  const [cats, setCats] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);

  return (
    <div className="grid gap-[20px]">
      <div>
        <p className="text-[#c8d4de] text-[13px] font-[700] m-0 mb-[10px]">
          Categories <span className="text-[var(--muted)] font-[400]">(pick up to 3)</span>
        </p>
        <div className="flex flex-wrap gap-[8px]">
          {options.categories.map((cat) => {
            const active = cats.includes(cat);
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setCats(toggle(cats, cat, 3))}
                className={[
                  "px-[12px] h-[34px] rounded-full text-[13px] font-[600] border transition-colors",
                  active
                    ? "border-[#78d45e] bg-[rgba(120,212,94,.15)] text-[#78d45e]"
                    : "border-white/[.15] bg-transparent text-[var(--muted)] hover:border-white/[.3]",
                ].join(" ")}
              >
                {cat}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <p className="text-[#c8d4de] text-[13px] font-[700] m-0 mb-[10px]">
          Keywords <span className="text-[var(--muted)] font-[400]">(pick up to 5)</span>
        </p>
        <div className="flex flex-wrap gap-[8px]">
          {options.tags.map((tag) => {
            const active = tags.includes(tag);
            return (
              <button
                key={tag}
                type="button"
                onClick={() => setTags(toggle(tags, tag, 5))}
                className={[
                  "px-[12px] h-[34px] rounded-full text-[13px] font-[600] border transition-colors",
                  active
                    ? "border-[var(--cyan)] bg-[rgba(94,184,212,.15)] text-[var(--cyan)]"
                    : "border-white/[.15] bg-transparent text-[var(--muted)] hover:border-white/[.3]",
                ].join(" ")}
              >
                {tag}
              </button>
            );
          })}
        </div>
      </div>

      <Button
        variant="primary"
        className="w-full"
        disabled={submitting}
        onClick={() => onSubmit({ categories: cats, tags })}
      >
        <span>{submitting ? "Locking in…" : "Lock in choices"}</span>
      </Button>
    </div>
  );
}
```

- [ ] **Step 2: Create `src/components/games/cosmic-trivia/ScoreRow.tsx`**

Used on the big screen sidebar to show each player's status and score.

```tsx
import type { Player } from "../../../types/room";

interface ScoreRowProps {
  player: Player;
  score: number | undefined;
  rank: number;
  hasAnswered: boolean;
  showScore: boolean;
  isRevealPhase: boolean;
}

export default function ScoreRow({
  player,
  score,
  rank,
  hasAnswered,
  showScore,
  isRevealPhase,
}: ScoreRowProps) {
  const initials = player.nickname.slice(0, 2).toUpperCase();

  let statusColor = "rgba(255,255,255,.08)";
  if (isRevealPhase) statusColor = "rgba(255,255,255,.12)";
  else if (hasAnswered) statusColor = "rgba(120,212,94,.25)";

  return (
    <div
      className="flex items-center gap-[10px] px-[12px] py-[8px] rounded-[8px] transition-colors"
      style={{ background: statusColor }}
    >
      <span className="text-[var(--muted)] text-[12px] font-[700] w-[18px] text-center tabular-nums">
        {rank}
      </span>
      <div
        className="w-[30px] h-[30px] rounded-full flex-none flex items-center justify-center text-[11px] font-[800] text-white"
        style={{ background: player.online === false ? "#333c46" : "#1e2d3d" }}
      >
        {initials}
      </div>
      <span className="flex-1 text-[var(--ink)] text-[13px] font-[600] truncate">
        {player.nickname}
      </span>
      {hasAnswered && !isRevealPhase && (
        <span className="text-[#78d45e] text-[11px]">✓</span>
      )}
      {showScore && score !== undefined && (
        <span className="text-[var(--muted)] text-[12px] font-[700] tabular-nums">
          {score}
        </span>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Create `src/components/games/cosmic-trivia/WinnerBoard.tsx`**

```tsx
import type { Player } from "../../../types/room";

interface WinnerBoardProps {
  players: Player[];
  scores: Record<string, number>;
  onPlayAgain?: () => void;
}

export default function WinnerBoard({ players, scores, onPlayAgain }: WinnerBoardProps) {
  const ranked = [...players]
    .filter((p) => scores[p.id] !== undefined)
    .sort((a, b) => (scores[b.id] ?? 0) - (scores[a.id] ?? 0));

  return (
    <div className="flex flex-col gap-[8px] w-full max-w-[560px] mx-auto">
      <h2 className="text-[var(--ink)] text-[28px] font-[800] text-center mb-[8px]">
        Final Results
      </h2>
      {ranked.map((player, i) => (
        <div
          key={player.id}
          className={[
            "flex items-center gap-[14px] px-[20px] py-[14px] rounded-[10px] border",
            i === 0
              ? "border-[var(--sun)] bg-[rgba(244,176,74,.12)]"
              : "border-white/[.08] bg-[rgba(17,24,33,.6)]",
          ].join(" ")}
        >
          <span
            className={[
              "w-[36px] h-[36px] rounded-full flex items-center justify-center font-[800] text-[15px] flex-none",
              i === 0 ? "bg-[var(--sun)] text-black" : "bg-white/[.08] text-[var(--muted)]",
            ].join(" ")}
          >
            {i + 1}
          </span>
          <div
            className="w-[38px] h-[38px] rounded-full flex-none flex items-center justify-center text-[13px] font-[800] text-white bg-[#1e2d3d]"
          >
            {player.nickname.slice(0, 2).toUpperCase()}
          </div>
          <span className="flex-1 text-[var(--ink)] text-[18px] font-[700]">
            {player.nickname}
          </span>
          <span className={[
            "text-[20px] font-[800] tabular-nums",
            i === 0 ? "text-[var(--sun)]" : "text-[var(--muted)]",
          ].join(" ")}>
            {scores[player.id] ?? 0}
          </span>
        </div>
      ))}
      {onPlayAgain && (
        <button
          type="button"
          onClick={onPlayAgain}
          className="mt-[16px] mx-auto px-[28px] h-[44px] rounded-[8px] border border-white/[.2] bg-transparent text-[var(--ink)] font-[700] hover:border-white/[.4] transition-colors"
        >
          Play again
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 4: TypeScript check**

```bash
cd /Users/neil/Documents/派对游戏 && npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 5: Commit**

```bash
cd /Users/neil/Documents/派对游戏
git add src/components/games/cosmic-trivia/
git commit -m "feat(trivia): add PreferencesPicker, ScoreRow, WinnerBoard components"
```

---

## Task 4: CosmicTriviaPhone — phone game root

**Files:**
- Replace: `src/pages/games/cosmic-trivia/PhonePage.tsx`

### Context

Route: `/play/:code` renders `InRoomPage`, which will detect the game and render this component.

This component:
1. Reads `room.gameState` as `CosmicTriviaState`
2. Fetches private state from `/api/rooms/:code/trivia/private/:playerId` on phase change (for hidden-score mode)
3. Routes to sub-views by `trivia.phase`

The `playerId` comes from `loadPlayerIdentity()`.

Sub-view rendering by phase:

- `game-setup`: "The host is choosing the round length"
- `preferences`: `<PreferencesPicker />` if player hasn't locked yet, else "Waiting for other players…"
- `round-prep`, `question-intro`, `question-read`: "Get ready!"
- `answering`: Question text + `<AnswerGrid />` (tappable)
- `answer-lock`: "Your answer is locked in"
- `reveal`, `scoring`, `between-questions`: Correct answer + fact line
- `final-hype`, `finale`: "Final results are on their way…"
- `post-game`: "Check the big screen for results!"

- [ ] **Step 1: Read `src/pages/games/cosmic-trivia/PhonePage.tsx` current content**

- [ ] **Step 2: Write `src/pages/games/cosmic-trivia/PhonePage.tsx`**

```tsx
import { useState, useEffect, useCallback } from "react";
import type { Room } from "../../../types/room";
import type { CosmicTriviaState, CosmicPrivateState } from "../../../types/cosmic-trivia";
import { loadPlayerIdentity } from "../../../types/player";
import PhoneLayout from "../../../components/player/PhoneLayout";
import AnswerGrid from "../../../components/games/cosmic-trivia/AnswerGrid";
import PreferencesPicker from "../../../components/games/cosmic-trivia/PreferencesPicker";

interface CosmicTriviaPhoneProps {
  room: Room;
  code: string;
}

export default function CosmicTriviaPhone({ room, code }: CosmicTriviaPhoneProps) {
  const trivia = room.gameState as CosmicTriviaState | null;
  const identity = loadPlayerIdentity();
  const playerId = identity?.playerId ?? null;

  const [selectedAnswerId, setSelectedAnswerId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [prefSubmitting, setPrefSubmitting] = useState(false);
  const [privateState, setPrivateState] = useState<CosmicPrivateState | null>(null);

  // Reset selected answer when phase changes to answering (new question)
  useEffect(() => {
    if (trivia?.phase === "answering") setSelectedAnswerId(null);
  }, [trivia?.questionIndex, trivia?.phase]);

  // Fetch private state on phase change
  useEffect(() => {
    if (!playerId || !trivia) return;
    fetch(`/api/rooms/${code}/trivia/private/${playerId}`)
      .then((r) => r.json())
      .then((d: { privateState?: CosmicPrivateState }) => {
        if (d.privateState) setPrivateState(d.privateState);
      })
      .catch(() => {});
  }, [trivia?.phase, code, playerId]);

  const submitAnswer = useCallback(async (answerId: string) => {
    if (!playerId || submitting || selectedAnswerId) return;
    setSelectedAnswerId(answerId);
    setSubmitting(true);
    try {
      await fetch(`/api/rooms/${code}/trivia/answer`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ playerId, choice: answerId }),
      });
    } catch {
      // SSE will update state; ignore error here
    } finally {
      setSubmitting(false);
    }
  }, [playerId, code, submitting, selectedAnswerId]);

  const submitPreferences = useCallback(async (prefs: { categories: string[]; tags: string[] }) => {
    if (!playerId || prefSubmitting) return;
    setPrefSubmitting(true);
    try {
      await fetch(`/api/rooms/${code}/trivia/preferences`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ playerId, preferences: prefs }),
      });
    } catch {
      // ignore
    } finally {
      setPrefSubmitting(false);
    }
  }, [playerId, code, prefSubmitting]);

  if (!trivia) {
    return (
      <PhoneLayout>
        <div className="phone-card text-center">
          <p className="text-[var(--muted)] text-[14px] m-0">Loading…</p>
        </div>
      </PhoneLayout>
    );
  }

  const phase = trivia.phase;
  const q = trivia.currentQuestion;
  const myPlayerState = playerId ? trivia.playerStates[playerId] : null;
  const hasLockedPrefs = myPlayerState?.preferencesLocked ?? false;
  const hasAnswered = playerId ? trivia.answeredPlayerIds.includes(playerId) : false;
  const score = playerId && privateState
    ? privateState.personalScore
    : playerId
    ? trivia.scores[playerId]
    : undefined;

  const questionLabel = `Question ${trivia.questionIndex + 1} / ${trivia.questionCount}`;

  // Score chip shown in most phases
  const scoreChip = score !== undefined && (
    <div className="flex justify-between items-center text-[13px] text-[var(--muted)]">
      <span>{questionLabel}</span>
      <span className="font-[700] text-[var(--ink)]">{score} pts</span>
    </div>
  );

  // ── game-setup ──
  if (phase === "game-setup") {
    return (
      <PhoneLayout>
        <div className="phone-card grid gap-[10px]">
          <p className="text-[var(--muted)] text-[13px] m-0">Setting up</p>
          <h2 className="text-[var(--ink)] text-[20px] font-[800] m-0">
            The host is choosing the round length
          </h2>
          <p className="text-[var(--muted)] text-[13px] m-0">
            Once set, you'll choose categories here.
          </p>
        </div>
      </PhoneLayout>
    );
  }

  // ── preferences ──
  if (phase === "preferences") {
    if (hasLockedPrefs) {
      return (
        <PhoneLayout>
          <div className="phone-card grid gap-[10px]">
            <p className="text-[#78d45e] text-[13px] font-[700] m-0">Choices locked ✓</p>
            <p className="text-[var(--muted)] text-[13px] m-0">
              Waiting for other players…
            </p>
          </div>
        </PhoneLayout>
      );
    }
    return (
      <PhoneLayout>
        <div className="phone-card grid gap-[4px]">
          <h2 className="text-[var(--ink)] text-[20px] font-[800] m-0 mb-[4px]">Pick your choices</h2>
          {trivia.questionOptions && (
            <PreferencesPicker
              options={trivia.questionOptions}
              onSubmit={submitPreferences}
              submitting={prefSubmitting}
            />
          )}
        </div>
      </PhoneLayout>
    );
  }

  // ── waiting phases (round-prep, question-intro, question-read) ──
  if (phase === "round-prep" || phase === "question-intro" || phase === "question-read") {
    return (
      <PhoneLayout>
        <div className="phone-card grid gap-[10px]">
          <p className="text-[var(--muted)] text-[13px] m-0">Get ready</p>
          <h2 className="text-[var(--ink)] text-[20px] font-[800] m-0">
            {phase === "question-read" ? "Listen closely…" : "Round starting!"}
          </h2>
        </div>
      </PhoneLayout>
    );
  }

  // ── answering ──
  if (phase === "answering" && q) {
    return (
      <PhoneLayout>
        <div className="phone-card grid gap-[14px]">
          {scoreChip}
          <p className="text-[var(--ink)] text-[16px] font-[700] m-0 leading-snug">{q.question}</p>
          <AnswerGrid
            answers={q.answers}
            selectedId={selectedAnswerId ?? (hasAnswered ? selectedAnswerId : null)}
            disabled={hasAnswered || submitting}
            onSelect={submitAnswer}
            variant="phone"
          />
          {hasAnswered && (
            <p className="text-[#78d45e] text-[13px] text-center m-0 font-[700]">
              Answer locked in ✓
            </p>
          )}
        </div>
      </PhoneLayout>
    );
  }

  // ── answer-lock ──
  if (phase === "answer-lock") {
    return (
      <PhoneLayout>
        <div className="phone-card grid gap-[10px] text-center">
          <p className="text-[var(--sun)] text-[13px] font-[700] m-0">Locked</p>
          <h2 className="text-[var(--ink)] text-[20px] font-[800] m-0">Answers are closed</h2>
          <p className="text-[var(--muted)] text-[13px] m-0">Revealing the answer now…</p>
        </div>
      </PhoneLayout>
    );
  }

  // ── reveal / scoring / between-questions ──
  if ((phase === "reveal" || phase === "scoring" || phase === "between-questions") && q) {
    const correctAnswer = q.answers.find((a) => a.id === q.correctAnswer);
    return (
      <PhoneLayout>
        <div className="phone-card grid gap-[14px]">
          {scoreChip}
          <AnswerGrid
            answers={q.answers}
            selectedId={selectedAnswerId}
            correctId={q.correctAnswer}
            disabled
            variant="phone"
          />
          {correctAnswer && (
            <div className="grid gap-[4px]">
              <p className="text-[#78d45e] text-[13px] font-[700] m-0">
                Correct: {correctAnswer.text}
              </p>
              {q.fact && <p className="text-[var(--muted)] text-[12px] m-0">{q.fact}</p>}
            </div>
          )}
        </div>
      </PhoneLayout>
    );
  }

  // ── final-hype / finale ──
  if (phase === "final-hype" || phase === "finale") {
    return (
      <PhoneLayout>
        <div className="phone-card text-center grid gap-[10px]">
          <p className="text-[var(--sun)] text-[13px] font-[700] m-0">Final results</p>
          <h2 className="text-[var(--ink)] text-[20px] font-[800] m-0">
            {trivia.finalHype?.current?.text ?? "Final results are on their way…"}
          </h2>
        </div>
      </PhoneLayout>
    );
  }

  // ── post-game ──
  return (
    <PhoneLayout>
      <div className="phone-card text-center grid gap-[10px]">
        <div className="text-[48px]" aria-hidden="true">🏆</div>
        <h2 className="text-[var(--ink)] text-[20px] font-[800] m-0">Game over!</h2>
        <p className="text-[var(--muted)] text-[13px] m-0">Check the big screen for results.</p>
        {score !== undefined && (
          <p className="text-[var(--ink)] text-[24px] font-[800]">{score} pts</p>
        )}
      </div>
    </PhoneLayout>
  );
}
```

- [ ] **Step 3: TypeScript check**

```bash
cd /Users/neil/Documents/派对游戏 && npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 4: Update `src/pages/player/InRoomPage.tsx`**

Read the current file, then replace the placeholder content with game detection. The component should check `room.selectedGame?.id` and render the right game component.

```tsx
import { useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import PhoneLayout from "../../components/player/PhoneLayout";
import { useSSE } from "../../hooks/useSSE";
import { useRoomStore } from "../../stores/roomStore";
import CosmicTriviaPhone from "../games/cosmic-trivia/PhonePage";

export default function InRoomPage() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const room = useRoomStore((s) => s.room);
  const setRoom = useRoomStore((s) => s.setRoom);

  useEffect(() => {
    if (!code || room?.code === code) return;
    fetch(`/api/rooms/${code}`)
      .then((r) => r.json())
      .then((data: { room: typeof room }) => { if (data.room) setRoom(data.room); })
      .catch(() => {});
  }, [code, room?.code, setRoom]);

  useSSE(code ?? null);

  useEffect(() => {
    if (room?.status === "waiting") navigate(`/waiting/${code}`, { replace: true });
    if (room?.status === "closed") navigate("/", { replace: true });
  }, [room?.status, code, navigate]);

  if (!room || !code) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
        <PhoneLayout>
          <div className="phone-card text-center">
            <p className="text-[var(--muted)] text-[14px] m-0">Loading…</p>
          </div>
        </PhoneLayout>
      </motion.div>
    );
  }

  if (room.selectedGame?.id === "cosmic-trivia") {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
        <CosmicTriviaPhone room={room} code={code} />
      </motion.div>
    );
  }

  // Fallback for other games (Phase 6+)
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
      <PhoneLayout>
        <div className="phone-card grid gap-[12px] text-center">
          <div className="text-[48px]" aria-hidden="true">🎮</div>
          <h1 className="text-[var(--ink)] text-[22px] font-[800] m-0">
            {room.selectedGame?.title ?? "Game"} is live
          </h1>
          <p className="text-[var(--muted)] text-[14px] m-0">Follow along on the big screen.</p>
        </div>
      </PhoneLayout>
    </motion.div>
  );
}
```

- [ ] **Step 5: TypeScript check**

```bash
cd /Users/neil/Documents/派对游戏 && npx tsc --noEmit 2>&1 | head -30
```

Expected: zero errors.

- [ ] **Step 6: Commit**

```bash
cd /Users/neil/Documents/派对游戏
git add src/pages/games/cosmic-trivia/PhonePage.tsx src/pages/player/InRoomPage.tsx
git commit -m "feat(trivia): implement Cosmic Trivia phone UI by phase"
```

---

## Task 5: CosmicTriviaHost — big screen game root

**Files:**
- Replace: `src/pages/games/cosmic-trivia/BigScreenPage.tsx`
- Modify: `src/pages/platform/LobbyPage.tsx`

### Context

The big screen lives at `/room/:code` (LobbyPage). When `room.status === "playing"`, LobbyPage renders `<CosmicTriviaHost />` instead of the lobby layout.

`CosmicTriviaHost` reads `room.gameState as CosmicTriviaState` and routes by phase.

Big screen layout is a 2-column grid: left main content (question card or setup), right sidebar (scoreboard).

Layout:
```
[ main content (flex-1) ] [ scoreboard sidebar (280px) ]
```

**Game-setup phase:** Host sees question count picker (5/8/10/12 buttons). Calls `POST /api/rooms/:code/trivia/setup { questionCount }`.

**Preferences phase:** "Players are choosing categories" message + how many have locked.

**Answering phase:** Question card with 2×2 answer grid (not interactive on host) + countdown timer.

**Reveal/scoring:** Same question card, correct answer highlighted + fact line. Sidebar shows rank changes (simple re-sort).

**Post-game:** WinnerBoard centered.

- [ ] **Step 1: Read `src/pages/games/cosmic-trivia/BigScreenPage.tsx` current content**

Also read the last ~60 lines of `src/pages/platform/LobbyPage.tsx` to understand the current layout.

- [ ] **Step 2: Write `src/pages/games/cosmic-trivia/BigScreenPage.tsx`**

```tsx
import { useState } from "react";
import type { Room, Player } from "../../../types/room";
import type { CosmicTriviaState } from "../../../types/cosmic-trivia";
import AnswerGrid from "../../../components/games/cosmic-trivia/AnswerGrid";
import CountdownBar from "../../../components/games/cosmic-trivia/CountdownBar";
import ScoreRow from "../../../components/games/cosmic-trivia/ScoreRow";
import WinnerBoard from "../../../components/games/cosmic-trivia/WinnerBoard";

interface CosmicTriviaHostProps {
  room: Room;
  code: string;
}

function Sidebar({ room, trivia }: { room: Room; trivia: CosmicTriviaState }) {
  const isReveal = trivia.phase === "reveal" || trivia.phase === "scoring";
  const players = [...room.players].sort(
    (a, b) => (trivia.scores[b.id] ?? 0) - (trivia.scores[a.id] ?? 0)
  );

  return (
    <aside className="w-[260px] flex-none flex flex-col gap-[8px] overflow-y-auto">
      <p className="text-[var(--muted)] text-[12px] font-[700] uppercase tracking-[2px] m-0 px-[4px]">
        Players
      </p>
      {players.map((player: Player, i) => (
        <ScoreRow
          key={player.id}
          player={player}
          score={trivia.scores[player.id]}
          rank={i + 1}
          hasAnswered={trivia.answeredPlayerIds.includes(player.id)}
          showScore={trivia.scoreboardVisible}
          isRevealPhase={isReveal}
        />
      ))}
    </aside>
  );
}

export default function CosmicTriviaHost({ room, code }: CosmicTriviaHostProps) {
  const trivia = room.gameState as CosmicTriviaState | null;
  const [settingUp, setSettingUp] = useState(false);
  const [restartingGame, setRestartingGame] = useState(false);

  if (!trivia) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-[var(--muted)]">Loading game…</p>
      </div>
    );
  }

  const phase = trivia.phase;
  const q = trivia.currentQuestion;

  async function handleSetup(questionCount: number) {
    if (settingUp) return;
    setSettingUp(true);
    try {
      await fetch(`/api/rooms/${code}/trivia/setup`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ questionCount }),
      });
    } finally {
      setSettingUp(false);
    }
  }

  async function handleRestart() {
    if (restartingGame) return;
    setRestartingGame(true);
    try {
      await fetch(`/api/rooms/${code}/trivia/restart`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      });
    } finally {
      setRestartingGame(false);
    }
  }

  // ── post-game ──
  if (phase === "post-game") {
    return (
      <div className="flex flex-col items-center justify-center gap-[24px] p-[32px] min-h-full">
        <WinnerBoard
          players={room.players}
          scores={trivia.scores}
          onPlayAgain={handleRestart}
        />
      </div>
    );
  }

  // ── game-setup ──
  if (phase === "game-setup") {
    return (
      <div className="flex flex-col items-center justify-center gap-[24px] p-[32px] min-h-full">
        <div className="w-full max-w-[560px] grid gap-[20px]">
          <div>
            <h2 className="text-[var(--ink)] text-[28px] font-[800] m-0 mb-[8px]">
              How many questions?
            </h2>
            <p className="text-[var(--muted)] text-[15px] m-0">
              {room.players.length} players · choose the round length
            </p>
          </div>
          <div className="grid grid-cols-4 gap-[12px]">
            {(trivia.questionCountOptions ?? [5, 8, 10, 12]).map((n) => (
              <button
                key={n}
                type="button"
                disabled={settingUp}
                onClick={() => handleSetup(n)}
                className="h-[72px] rounded-[10px] border border-white/[.15] bg-[rgba(17,24,33,.8)] text-[var(--ink)] text-[28px] font-[800] hover:border-[rgba(120,212,94,.5)] hover:bg-[rgba(120,212,94,.08)] transition-colors disabled:opacity-50"
              >
                {n}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── preferences ──
  if (phase === "preferences") {
    return (
      <div className="flex items-center justify-center gap-[32px] p-[32px] min-h-full">
        <div className="flex-1 max-w-[560px] grid gap-[16px]">
          <h2 className="text-[var(--ink)] text-[28px] font-[800] m-0">
            Players are choosing their categories
          </h2>
          <p className="text-[var(--muted)] text-[15px] m-0">
            {trivia.preferencePlayerIds.length} / {trivia.expectedPreferenceCount} locked in
          </p>
          {trivia.phaseEndsAt && (
            <CountdownBar
              endsAt={trivia.phaseEndsAt}
              totalSecs={Math.ceil(((trivia.phaseEndsAt ?? 0) - Date.now()) / 1000)}
            />
          )}
        </div>
        <Sidebar room={room} trivia={trivia} />
      </div>
    );
  }

  // ── waiting phases ──
  if (phase === "round-prep" || phase === "question-intro" || phase === "question-read" || phase === "final-hype" || phase === "finale") {
    const label =
      phase === "round-prep" ? "Building your round…" :
      phase === "question-intro" ? "Next question coming up" :
      phase === "question-read" ? "Listen to the question" :
      phase === "final-hype" ? (trivia.finalHype?.current?.text ?? "Final results coming up…") :
      "And the results are…";

    return (
      <div className="flex items-center gap-[32px] p-[32px] min-h-full">
        <div className="flex-1 flex items-center justify-center">
          <div className="max-w-[500px] text-center grid gap-[12px]">
            {(phase === "question-intro" || phase === "question-read") && (
              <p className="text-[var(--muted)] text-[14px] m-0">
                Question {trivia.questionIndex + 1} / {trivia.questionCount}
              </p>
            )}
            <h2 className="text-[var(--ink)] text-[32px] font-[800] m-0">{label}</h2>
          </div>
        </div>
        <Sidebar room={room} trivia={trivia} />
      </div>
    );
  }

  // ── answering / answer-lock / reveal / scoring / between-questions ──
  const isRevealPhase = phase === "reveal" || phase === "scoring" || phase === "between-questions";
  const phaseDurationSecs = trivia.phaseEndsAt
    ? Math.ceil((trivia.phaseEndsAt - Date.now()) / 1000) + (isRevealPhase ? 0 : 5)
    : 20;

  return (
    <div className="flex items-start gap-[24px] p-[32px] min-h-full">
      <div className="flex-1 grid gap-[16px]">
        <div className="flex items-center justify-between">
          <p className="text-[var(--muted)] text-[13px] m-0">
            Question {trivia.questionIndex + 1} / {trivia.questionCount}
          </p>
          <span className="text-[var(--muted)] text-[13px]">
            {trivia.answeredPlayerIds.length} / {trivia.expectedAnswerCount} answered
          </span>
        </div>

        {q && (
          <>
            <h2 className="text-[var(--ink)] text-[24px] font-[800] m-0 leading-snug">
              {q.question}
            </h2>
            <AnswerGrid
              answers={q.answers}
              correctId={isRevealPhase ? q.correctAnswer : null}
              variant="big-screen"
            />
            {isRevealPhase && q.fact && (
              <p className="text-[var(--muted)] text-[14px] m-0 border-l-[3px] border-[rgba(120,212,94,.4)] pl-[12px]">
                {q.fact}
              </p>
            )}
          </>
        )}

        {phase === "answering" && (
          <CountdownBar endsAt={trivia.phaseEndsAt} totalSecs={phaseDurationSecs} />
        )}
        {phase === "answer-lock" && (
          <p className="text-[var(--sun)] text-[15px] font-[700] m-0">Answers are closed — revealing now…</p>
        )}
      </div>
      <Sidebar room={room} trivia={trivia} />
    </div>
  );
}
```

- [ ] **Step 3: Modify `src/pages/platform/LobbyPage.tsx`**

Read the file, then add the following:
- Import: `import CosmicTriviaHost from "../games/cosmic-trivia/BigScreenPage";`
- In the return JSX, find where the lobby main content is rendered. Add a condition: if `room.status === "playing"`, render `<CosmicTriviaHost room={room} code={code} />` instead of the normal lobby layout.

The exact placement depends on the current LobbyPage structure. Read the file first. The condition should wrap or replace the section after the NavBar, like:

```tsx
{room.status === "playing" ? (
  <div className="pt-[64px] min-h-screen">
    <CosmicTriviaHost room={room} code={code!} />
  </div>
) : (
  /* existing lobby layout */
)}
```

- [ ] **Step 4: TypeScript check**

```bash
cd /Users/neil/Documents/派对游戏 && npx tsc --noEmit 2>&1 | head -30
```

Expected: zero errors. Fix any type errors found.

- [ ] **Step 5: Run tests**

```bash
cd /Users/neil/Documents/派对游戏 && npx vitest run 2>&1 | tail -10
```

Expected: all pass.

- [ ] **Step 6: Commit**

```bash
cd /Users/neil/Documents/派对游戏
git add src/pages/games/cosmic-trivia/BigScreenPage.tsx src/pages/platform/LobbyPage.tsx
git commit -m "feat(trivia): implement Cosmic Trivia host big screen and wire into LobbyPage"
```

---

## Self-Review

### Spec coverage
- [x] All 13 game phases covered on phone and big screen
- [x] Answer submission: `POST /trivia/answer { playerId, choice: answerId }`
- [x] Preferences: `POST /trivia/preferences { playerId, preferences }`
- [x] Setup: `POST /trivia/setup { questionCount }`
- [x] Private state: `GET /trivia/private/:playerId` (fetched on phase change)
- [x] Countdown timer via `useCountdown(phaseEndsAt)` hook
- [x] Correct answer highlighted on reveal phase (correctId prop)
- [x] Score hidden when `scoreboardVisible === false`
- [x] WinnerBoard shows ranked players with "Play again" button
- [x] InRoomPage detects game ID and routes to CosmicTriviaPhone
- [x] LobbyPage routes to CosmicTriviaHost when `room.status === "playing"`

### Type consistency
- `room.gameState` cast as `CosmicTriviaState | null` in both phone and host — consistent
- `ANSWER_LETTERS` exported from types file, used in AnswerGrid
- `Player` imported from `types/room`, not redefined

### Placeholder scan
- No TBDs, no incomplete logic
- `handleRestart()` is wired but Fate Werewolf uses same endpoint — fine
- `CountdownBar`'s `totalSecs` prop in preferences phase uses a rough estimate — acceptable for a progress bar
