# Phase 6: Avatar Selection System

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the placeholder color picker in AvatarPage with a real avatar selector (character + hat + decoration + palette), display layered PNG avatars everywhere players appear.

**Architecture:** Add an `AvatarSelection` type that matches the server's `{ characterId, hatId, decorationId, paletteId }` shape. A reusable `AvatarStack` component renders three PNG layers (character / hat / decoration) inside a circular frame colored by palette. The picker in `AvatarPage` fetches `/api/avatar-catalog`, shows three tabs with a 4-column grid each, and a row of 6 palette chips. `WaitingPage`, `ScoreRow`, and `WinnerBoard` swap their initials bubbles for `AvatarStack`.

**Tech Stack:** React 18 + TypeScript + Tailwind CSS arbitrary values, CSS custom properties for `--avatar-fill` / `--avatar-ring`

---

## File Map

| Status | Path | Purpose |
|--------|------|---------|
| **Create** | `src/types/avatar.ts` | `AvatarSelection`, catalog types, palette constants |
| **Modify** | `src/types/player.ts` | `avatar: AvatarSelection \| null` (was `null` literal); remove `color?` |
| **Modify** | `src/types/room.ts` | `Player.avatar: AvatarSelection \| null` (was `Avatar \| null`) |
| **Create** | `src/components/player/AvatarStack.tsx` | Layered PNG display, accepts `avatar`, `size`, `ringColor` |
| **Modify** | `src/styles/globals.css` | Append `.avatar-stack`, `.avatar-core`, `.avatar-layer`, `.avatar-ring`, `.avatar-choice-*` CSS |
| **Modify** | `src/pages/player/AvatarPage.tsx` | Full avatar picker (replace color picker) |
| **Modify** | `src/pages/player/WaitingPage.tsx` | Use `AvatarStack` instead of initials bubble |
| **Modify** | `src/components/games/cosmic-trivia/ScoreRow.tsx` | Use `AvatarStack` instead of initials circle |
| **Modify** | `src/components/games/cosmic-trivia/WinnerBoard.tsx` | Use `AvatarStack` instead of initials circle |

---

## Context You Must Know

- **Branch:** `codex/frontend-architecture-plan`; dev server on port 5173, Node API on 4173.
- **Avatar catalog API:** `GET /api/avatar-catalog` → `{ characters: AvatarCatalogItem[], hats: AvatarCatalogItem[], decorations: AvatarCatalogItem[] }`. Each item: `{ id: string, category: string, src: string, nameEn: string, nameZh: string, aliases: string[] }`. Example ids: `"Charac-1-wave"`, `"Hat-1-firefighter"`, `"Dec-1-confetti"`.
- **Asset paths:** character PNGs at `/assets/avatars/characters/${id}.png`, hats at `/assets/avatars/hats/${id}.png`, decorations at `/assets/avatars/decorations/${id}.png`. (The `src` field in catalog items already contains the full path.)
- **Server `POST /api/rooms/:code/join` body:** `{ playerId, nickname, avatar: { characterId, hatId, decorationId, paletteId } }`. Sending `avatar: null` causes the server to assign a random one.
- **Palettes (6):** `teal / gold / violet / coral / sky / lime` with fill and ring colors (defined fully in Task 1).
- **Existing globals.css:** Already has `.phone-wrap`, `.phone-topbar`, `.phone-flow`, etc. Append avatar CSS at end of file. Do **not** change existing classes.
- **`Player.avatar`** in the room's SSE snapshots will have the shape `{ characterId, hatId, decorationId, paletteId }` (the server stores what was joined with).
- **Tests:** Run with `npm test`; build check with `npm run build`.

---

## Task 1: Avatar Type Definitions

**Files:**
- Create: `src/types/avatar.ts`
- Modify: `src/types/player.ts`
- Modify: `src/types/room.ts`
- Test: `src/__tests__/avatar.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/__tests__/avatar.test.ts
import { describe, it, expect } from "vitest";
import {
  paletteById,
  PALETTES,
  defaultAvatar,
  type AvatarSelection,
} from "../types/avatar";

describe("paletteById", () => {
  it("returns the matching palette", () => {
    const p = paletteById("gold");
    expect(p.id).toBe("gold");
    expect(p.fill).toBe("#ffd974");
    expect(p.ring).toBe("#fff9eb");
  });

  it("falls back to teal for unknown id", () => {
    const p = paletteById("nonexistent");
    expect(p.id).toBe("teal");
  });
});

describe("defaultAvatar", () => {
  it("builds a valid AvatarSelection with the given characterId", () => {
    const av: AvatarSelection = defaultAvatar("Charac-1-wave");
    expect(av.characterId).toBe("Charac-1-wave");
    expect(av.hatId).toBeNull();
    expect(av.decorationId).toBeNull();
    expect(PALETTES.map((p) => p.id)).toContain(av.paletteId);
  });
});
```

- [ ] **Step 2: Run to confirm it fails**

```bash
cd /Users/neil/Documents/派对游戏 && npm test -- --reporter=verbose 2>&1 | tail -20
```

Expected: FAIL — "Cannot find module '../types/avatar'"

- [ ] **Step 3: Create `src/types/avatar.ts`**

```ts
export interface AvatarSelection {
  characterId: string;
  hatId: string | null;
  decorationId: string | null;
  paletteId: string;
}

export interface AvatarCatalogItem {
  id: string;
  category: "character" | "hat" | "decoration";
  src: string;
  nameEn: string;
  nameZh: string;
  aliases: string[];
}

export interface AvatarCatalog {
  characters: AvatarCatalogItem[];
  hats: AvatarCatalogItem[];
  decorations: AvatarCatalogItem[];
}

export const PALETTES = [
  { id: "teal",   fill: "#8be0d1", ring: "#f8fffd" },
  { id: "gold",   fill: "#ffd974", ring: "#fff9eb" },
  { id: "violet", fill: "#c7a0ff", ring: "#faf4ff" },
  { id: "coral",  fill: "#ff9f91", ring: "#fff3f1" },
  { id: "sky",    fill: "#95d7ff", ring: "#f1fbff" },
  { id: "lime",   fill: "#b6e875", ring: "#f8ffef" },
] as const;

export type PaletteId = (typeof PALETTES)[number]["id"];

export function paletteById(id: string) {
  return PALETTES.find((p) => p.id === id) ?? PALETTES[0];
}

export function defaultAvatar(characterId: string): AvatarSelection {
  return { characterId, hatId: null, decorationId: null, paletteId: PALETTES[0].id };
}
```

- [ ] **Step 4: Update `src/types/player.ts`** — replace `avatar: null` with `AvatarSelection | null`, remove `color?`

```ts
import type { AvatarSelection } from "./avatar";

export interface PlayerIdentity {
  playerId: string;
  nickname: string;
  avatar: AvatarSelection | null;
}

export interface PlayerPayload {
  playerId: string;
  nickname: string;
  avatar: AvatarSelection | null;
}

export const PLAYER_IDENTITY_KEY = "joylyPlayerIdentity";

export function loadPlayerIdentity(): PlayerIdentity | null {
  try {
    const raw = localStorage.getItem(PLAYER_IDENTITY_KEY);
    return raw ? (JSON.parse(raw) as PlayerIdentity) : null;
  } catch {
    return null;
  }
}

export function savePlayerIdentity(identity: PlayerIdentity): void {
  localStorage.setItem(PLAYER_IDENTITY_KEY, JSON.stringify(identity));
}

export function makePlayerId(): string {
  return crypto.randomUUID();
}
```

- [ ] **Step 5: Update `src/types/room.ts`** — remove the `Avatar` stub and use `AvatarSelection`

Replace the existing `Avatar` interface and `Player.avatar: Avatar | null` lines:

```ts
import type { GameConfig } from "./config";
import type { AvatarSelection } from "./avatar";

export type RoomStatus = "waiting" | "playing" | "complete" | "closed";

export interface Player {
  id: string;
  nickname: string;
  avatar: AvatarSelection | null;
  online: boolean;
  ready: boolean;
  lastSeen?: number;
}

export interface RoomEntitlement {
  type: string;
  minutes?: number;
  expiresAt?: number;
  purchased?: number;
  spent?: number;
  remaining?: number;
}

export interface RoomHost {
  name: string;
  email: string;
}

export interface Room {
  code: string;
  host: RoomHost;
  players: Player[];
  status: RoomStatus;
  selectedGame: GameConfig | null;
  paymentMode: string;
  entitlement: RoomEntitlement;
  launchCountdown: { endsAt: number } | null;
  gameSetup: unknown;
  gameState: unknown;
  createdAt: number;
}
```

- [ ] **Step 6: Run tests**

```bash
cd /Users/neil/Documents/派对游戏 && npm test -- --reporter=verbose 2>&1 | tail -30
```

Expected: avatar tests PASS; all other tests still pass (TypeScript errors in AvatarPage/WaitingPage are OK at this stage — those files reference `color` which is now removed from `PlayerIdentity`).

If TypeScript build errors appear in tests, fix the test file only. Do not touch `AvatarPage.tsx` or `WaitingPage.tsx` yet — those are fixed in Tasks 4 and 3 respectively.

- [ ] **Step 7: Check if `WaitingPage.tsx` or `AvatarPage.tsx` reference `identity.color` — patch temporarily if needed**

Check for compile errors:
```bash
cd /Users/neil/Documents/派对游戏 && npx tsc --noEmit 2>&1 | head -40
```

If you see errors in `WaitingPage.tsx` referencing `identity?.color`, replace that usage temporarily:
```ts
// In WaitingPage.tsx, find:
const color = identity?.color ?? "#78d45e";
// Replace with:
const color = "#78d45e"; // temp; removed in Task 3
```

If you see errors in `AvatarPage.tsx` referencing `selectedColor` or `color`, replace temporarily:
```ts
// In AvatarPage.tsx — find the selectedColor state and color usage in savePlayerIdentity/setPlayer
// Replace any `color: selectedColor` in savePlayerIdentity/setPlayer calls with nothing (remove the field)
// e.g., savePlayerIdentity({ playerId: ..., nickname: ..., avatar: null }) — just remove color
```

- [ ] **Step 8: Commit**

```bash
cd /Users/neil/Documents/派对游戏 && git add src/types/avatar.ts src/types/player.ts src/types/room.ts src/__tests__/avatar.test.ts src/pages/player/WaitingPage.tsx src/pages/player/AvatarPage.tsx
git commit -m "feat(avatar): add AvatarSelection types and palette constants"
```

---

## Task 2: AvatarStack Component + CSS

**Files:**
- Modify: `src/styles/globals.css` (append at end)
- Create: `src/components/player/AvatarStack.tsx`
- Test: `src/__tests__/AvatarStack.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// src/__tests__/AvatarStack.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import AvatarStack from "../components/player/AvatarStack";
import type { AvatarSelection } from "../types/avatar";

const mockAvatar: AvatarSelection = {
  characterId: "Charac-1-wave",
  hatId: "Hat-1-firefighter",
  decorationId: null,
  paletteId: "gold",
};

describe("AvatarStack", () => {
  it("renders character and hat images", () => {
    const { container } = render(<AvatarStack avatar={mockAvatar} />);
    const imgs = container.querySelectorAll("img");
    expect(imgs).toHaveLength(2); // character + hat; no decoration
    expect(imgs[0].src).toContain("Charac-1-wave.png");
    expect(imgs[1].src).toContain("Hat-1-firefighter.png");
  });

  it("applies large class for size=large", () => {
    const { container } = render(<AvatarStack avatar={mockAvatar} size="large" />);
    expect(container.firstChild).toHaveClass("large");
  });

  it("renders no images when avatar is null (just the ring and core)", () => {
    const { container } = render(<AvatarStack avatar={null} />);
    const imgs = container.querySelectorAll("img");
    expect(imgs).toHaveLength(0);
  });

  it("applies custom ringColor via CSS custom property", () => {
    const { container } = render(
      <AvatarStack avatar={mockAvatar} ringColor="#ff0000" />
    );
    const el = container.firstChild as HTMLElement;
    expect(el.style.getPropertyValue("--avatar-ring")).toBe("#ff0000");
  });
});
```

- [ ] **Step 2: Run to confirm it fails**

```bash
cd /Users/neil/Documents/派对游戏 && npm test -- --reporter=verbose 2>&1 | tail -20
```

Expected: FAIL — "Cannot find module '../components/player/AvatarStack'"

- [ ] **Step 3: Append avatar CSS to `src/styles/globals.css`**

Open `src/styles/globals.css` and append the following block at the very end of the file:

```css
/* ── Avatar Stack ─────────────────────────────────────────── */
.avatar-stack {
  width: 44px; height: 44px;
  position: relative; display: block;
  flex-shrink: 0;
  filter: drop-shadow(0 10px 18px rgba(0,0,0,.22));
}
.avatar-stack.large { width: 68px; height: 68px; }
.avatar-stack.hero  { width: 144px; height: 144px; margin: 0 auto 14px; }

.avatar-core {
  position: absolute; inset: 9%;
  overflow: hidden; border-radius: 50%; z-index: 1;
}
.avatar-core-fill {
  position: absolute; inset: 0; border-radius: 50%;
  background:
    radial-gradient(circle at 32% 24%, rgba(255,255,255,.55), transparent 24%),
    linear-gradient(180deg, rgba(255,255,255,.18), transparent 32%),
    var(--avatar-fill, #8be0d1);
}
.avatar-layer {
  position: absolute; inset: 0;
  width: 100%; height: 100%;
  object-fit: contain; object-position: center;
  pointer-events: none;
}
.avatar-character { transform: scale(1.18); transform-origin: center; z-index: 1; }
.avatar-hat        { z-index: 2; }
.avatar-decoration { z-index: 3; }
.avatar-ring {
  position: absolute; inset: 8%; border-radius: 50%;
  border: 4px solid var(--avatar-ring, rgba(255,255,255,.86));
  box-shadow: inset 0 0 0 1px rgba(15,23,30,.18);
  z-index: 0; pointer-events: none;
}
.avatar-stack.large .avatar-ring { border-width: 5px; }
.avatar-stack.hero  .avatar-ring { border-width: 6px; }

/* ── Avatar Picker (AvatarPage) ───────────────────────────── */
.avatar-composer { display: grid; gap: 12px; margin: 16px 0; }

.avatar-preview-card {
  padding: 12px; border-radius: 12px;
  border: 1px solid rgba(255,255,255,.08);
  background: linear-gradient(145deg, rgba(255,248,232,.08), transparent 36%), rgba(11,18,26,.92);
  box-shadow: 0 10px 24px rgba(0,0,0,.18);
  display: grid; gap: 8px; justify-items: center; text-align: center;
}
.avatar-preview-stage {
  width: 100%; min-height: 132px;
  display: grid; place-items: center; border-radius: 16px;
  background:
    radial-gradient(circle at 50% 30%, rgba(255,255,255,.12), transparent 36%),
    linear-gradient(180deg, rgba(116,213,232,.12), rgba(247,184,74,.08)),
    rgba(255,255,255,.04);
}

.avatar-step-tabs {
  display: grid; grid-template-columns: repeat(3, minmax(0,1fr)); gap: 8px;
}
.avatar-step-tab {
  min-height: 46px; padding: 0 10px; border-radius: 14px;
  border: 1px solid rgba(255,255,255,.08);
  color: rgba(248,244,238,.76);
  background: linear-gradient(135deg, rgba(255,248,232,.08), transparent 38%), #10161f;
  box-shadow: 0 5px 0 rgba(3,8,14,.22);
  font-size: 14px; font-weight: 800; letter-spacing: .01em;
  cursor: pointer;
}
.avatar-step-tab.active {
  border-color: rgba(120,212,94,.86); color: var(--ink);
  background: linear-gradient(135deg, rgba(255,248,232,.18), transparent 38%), rgba(120,212,94,.14);
  box-shadow: 0 5px 0 rgba(3,8,14,.22), inset 0 0 0 1px rgba(120,212,94,.42);
}

.avatar-choice-group {
  padding: 12px; border-radius: 12px;
  border: 1px solid rgba(255,255,255,.08);
  background: linear-gradient(145deg, rgba(255,248,232,.08), transparent 36%), rgba(11,18,26,.92);
  box-shadow: 0 10px 24px rgba(0,0,0,.18);
}
.avatar-choice-head {
  display: flex; align-items: baseline; justify-content: space-between;
  gap: 8px; margin-bottom: 10px;
}
.avatar-choice-head h2 { margin: 0; font-size: 14px; }
.avatar-choice-head span { color: var(--muted); font-size: 11px; }

.avatar-choice-grid {
  display: grid; grid-template-columns: repeat(4, minmax(0,1fr)); gap: 8px;
}
.avatar-choice-card {
  border: 1px solid rgba(255,255,255,.08); border-radius: 10px;
  color: var(--ink); min-height: 76px; padding: 6px;
  display: grid; gap: 0; justify-items: center; align-content: center; text-align: center;
  background: linear-gradient(135deg, rgba(255,248,232,.08), transparent 38%), #10161f;
  box-shadow: 0 5px 0 rgba(3,8,14,.22);
  cursor: pointer;
}
.avatar-choice-card.active {
  border-color: rgba(120,212,94,.86);
  background: linear-gradient(135deg, rgba(255,248,232,.16), transparent 38%), rgba(120,212,94,.1);
  box-shadow: 0 5px 0 rgba(3,8,14,.22), inset 0 0 0 1px rgba(120,212,94,.42);
}
.avatar-choice-card.none-card {
  border: 1px dashed rgba(255,255,255,.16);
}
.avatar-choice-art {
  width: 58px; height: 58px;
  display: grid; place-items: center; overflow: hidden; border-radius: 12px;
  background: radial-gradient(circle at 50% 32%, rgba(255,255,255,.18), transparent 36%), rgba(255,255,255,.04);
}
.avatar-choice-art img { width: 100%; height: 100%; object-fit: contain; transform-origin: center; }
.avatar-choice-art.characterId img  { transform: scale(1.55); }
.avatar-choice-art.hatId img        { transform: scale(2.45); transform-origin: center 24%; }
.avatar-choice-art.decorationId img { transform: scale(2.2);  transform-origin: 34% 70%; }
```

- [ ] **Step 4: Create `src/components/player/AvatarStack.tsx`**

```tsx
import type { AvatarSelection } from "../../types/avatar";
import { paletteById } from "../../types/avatar";

interface AvatarStackProps {
  avatar: AvatarSelection | null;
  size?: "normal" | "large" | "hero";
  ringColor?: string;
  className?: string;
}

export default function AvatarStack({
  avatar,
  size = "normal",
  ringColor,
  className,
}: AvatarStackProps) {
  const palette = paletteById(avatar?.paletteId ?? "teal");

  const style = {
    "--avatar-fill": palette.fill,
    "--avatar-ring": ringColor ?? palette.ring,
  } as React.CSSProperties;

  const sizeClass = size === "normal" ? "" : size;

  return (
    <div
      className={["avatar-stack", sizeClass, className].filter(Boolean).join(" ")}
      style={style}
    >
      <div className="avatar-core">
        <div className="avatar-core-fill" />
        {avatar?.characterId && (
          <img
            className="avatar-layer avatar-character"
            src={`/assets/avatars/characters/${avatar.characterId}.png`}
            alt=""
            draggable={false}
          />
        )}
      </div>
      {avatar?.hatId && (
        <img
          className="avatar-layer avatar-hat"
          src={`/assets/avatars/hats/${avatar.hatId}.png`}
          alt=""
          draggable={false}
        />
      )}
      {avatar?.decorationId && (
        <img
          className="avatar-layer avatar-decoration"
          src={`/assets/avatars/decorations/${avatar.decorationId}.png`}
          alt=""
          draggable={false}
        />
      )}
      <div className="avatar-ring" />
    </div>
  );
}
```

- [ ] **Step 5: Run tests**

```bash
cd /Users/neil/Documents/派对游戏 && npm test -- --reporter=verbose 2>&1 | tail -30
```

Expected: AvatarStack tests PASS; all other tests still pass.

- [ ] **Step 6: Commit**

```bash
cd /Users/neil/Documents/派对游戏 && git add src/styles/globals.css src/components/player/AvatarStack.tsx src/__tests__/AvatarStack.test.tsx
git commit -m "feat(avatar): add AvatarStack component and avatar CSS"
```

---

## Task 3: Wire AvatarStack into Display Sites

**Files:**
- Modify: `src/pages/player/WaitingPage.tsx`
- Modify: `src/components/games/cosmic-trivia/ScoreRow.tsx`
- Modify: `src/components/games/cosmic-trivia/WinnerBoard.tsx`

No new tests needed — existing tests cover these components; TypeScript will enforce correctness.

- [ ] **Step 1: Update `src/pages/player/WaitingPage.tsx`**

Replace the full file with this content:

```tsx
import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import PhoneLayout from "../../components/player/PhoneLayout";
import AvatarStack from "../../components/player/AvatarStack";
import Button from "../../components/ui/Button";
import Icon from "../../components/ui/Icon";
import { useSSE } from "../../hooks/useSSE";
import { useRoomStore } from "../../stores/roomStore";
import { loadPlayerIdentity } from "../../types/player";
import type { Player } from "../../types/room";

function launchCountdownSeconds(endsAt?: number): number {
  if (!endsAt) return 0;
  return Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
}

export default function WaitingPage() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const room = useRoomStore((s) => s.room);
  const setRoom = useRoomStore((s) => s.setRoom);

  const identity = loadPlayerIdentity();
  const playerId = identity?.playerId ?? null;

  const [toggling, setToggling] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!playerId) navigate(`/join/${code ?? ""}`, { replace: true });
  }, [playerId, code, navigate]);

  useEffect(() => {
    if (!code || room?.code === code) return;
    fetch(`/api/rooms/${code}`)
      .then((r) => r.json())
      .then((data: { room: typeof room }) => { if (data.room) setRoom(data.room); })
      .catch(() => {});
  }, [code, room?.code, setRoom]);

  useSSE(code ?? null);

  useEffect(() => {
    if (room?.status === "playing") navigate(`/play/${code}`, { replace: true });
  }, [room?.status, code, navigate]);

  if (!playerId) return null;

  const currentPlayer: Player | undefined = room?.players.find((p) => p.id === playerId);

  const countdownEndsAt = room?.launchCountdown?.endsAt;
  const countdownSecs = launchCountdownSeconds(countdownEndsAt);
  const countdownActive = countdownSecs > 0;

  const statusText = countdownActive
    ? `Starting in ${countdownSecs}s`
    : currentPlayer?.ready
    ? "Ready"
    : "Getting ready";

  const ringColor = !currentPlayer || currentPlayer.online === false
    ? "#8f99a6"
    : currentPlayer.ready
    ? "#78d45e"
    : "#f4b04a";

  const isReady = Boolean(currentPlayer?.ready);
  const avatarToShow = currentPlayer?.avatar ?? identity?.avatar ?? null;

  async function handleToggleReady() {
    if (!code || !playerId || toggling || countdownActive) return;
    setToggling(true);
    setError("");
    try {
      const res = await fetch(`/api/rooms/${code}/players/${playerId}/ready`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ready: !isReady }),
      });
      if (!res.ok) throw new Error("Failed to update ready status");
      const data = (await res.json()) as { room: typeof room };
      if (data.room) setRoom(data.room);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setToggling(false);
    }
  }

  if (room?.status === "closed") {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
        <PhoneLayout>
          <div className="phone-card grid gap-[12px] text-center">
            <div className="text-[48px]">✕</div>
            <h1 className="text-[var(--ink)] text-[22px] font-[800] m-0">Room closed</h1>
            <p className="text-[var(--muted)] text-[14px] m-0">Ask the host to create a new room.</p>
          </div>
        </PhoneLayout>
      </motion.div>
    );
  }

  const nickname = currentPlayer?.nickname ?? identity?.nickname ?? "Player";

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
    >
      <PhoneLayout>
        <div className="phone-status">
          <div className="phone-status-avatar">
            <AvatarStack
              avatar={avatarToShow}
              size="hero"
              ringColor={ringColor}
              className={currentPlayer?.online === false ? "[filter:grayscale(1)]" : undefined}
            />
          </div>

          <div className="phone-status-copy">
            <h1 className="text-[var(--ink)]">{nickname}</h1>
            <span className={["ready-chip", isReady ? "is-ready" : ""].join(" ")}>
              {statusText}
            </span>
          </div>

          <div className="phone-status-panel">
            {room?.status === "waiting" && (
              <Button
                variant="primary"
                className="w-full"
                disabled={toggling || countdownActive}
                onClick={handleToggleReady}
              >
                <Icon name="check" />
                <span>
                  {countdownActive
                    ? "Starting soon"
                    : isReady
                    ? "Ready"
                    : "Tap when ready"}
                </span>
              </Button>
            )}

            {error && (
              <p className="text-[#f67272] text-[13px] text-center m-0">{error}</p>
            )}

            <div className="phone-mini">
              <span>{code}</span>
              <strong>{room?.selectedGame?.title ?? "Lobby"}</strong>
            </div>
          </div>
        </div>
      </PhoneLayout>
    </motion.div>
  );
}
```

- [ ] **Step 2: Update `src/components/games/cosmic-trivia/ScoreRow.tsx`**

Replace the full file:

```tsx
import AvatarStack from "../../player/AvatarStack";
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
      <AvatarStack
        avatar={player.avatar}
        size="normal"
        ringColor={player.online === false ? "#8f99a6" : undefined}
      />
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

- [ ] **Step 3: Update `src/components/games/cosmic-trivia/WinnerBoard.tsx`**

Replace the initials circle with `AvatarStack`. Replace the full file:

```tsx
import AvatarStack from "../../player/AvatarStack";
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
          <AvatarStack avatar={player.avatar} size="normal" />
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

- [ ] **Step 4: Run TypeScript check**

```bash
cd /Users/neil/Documents/派对游戏 && npx tsc --noEmit 2>&1 | head -40
```

Fix any type errors before continuing. Common issues:
- If `AvatarStack` is not found: verify file path is `src/components/player/AvatarStack.tsx`
- If `player.avatar` type mismatch: confirm `src/types/room.ts` was updated in Task 1

- [ ] **Step 5: Run all tests**

```bash
cd /Users/neil/Documents/派对游戏 && npm test -- --reporter=verbose 2>&1 | tail -30
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
cd /Users/neil/Documents/派对游戏 && git add src/pages/player/WaitingPage.tsx src/components/games/cosmic-trivia/ScoreRow.tsx src/components/games/cosmic-trivia/WinnerBoard.tsx
git commit -m "feat(avatar): use AvatarStack in WaitingPage, ScoreRow, WinnerBoard"
```

---

## Task 4: AvatarPage Full Picker UI

**Files:**
- Modify: `src/pages/player/AvatarPage.tsx`

This is the main user-facing change. The old color picker is replaced with:
1. **Preview card** — hero `AvatarStack` + nickname display
2. **Nickname input**
3. **Category tabs** — Character / Hat / Decoration (3 buttons)
4. **Item grid** — 4-column grid of cards for the active tab; Hat and Decoration tabs get a "None" card first
5. **Palette picker** — 6 colored circles

On mount: fetch `/api/avatar-catalog`. Default selection: first character, no hat, no decoration, palette "teal". If returning player (has localStorage avatar), pre-select their saved avatar.

On auto-resume (has saved identity with nickname): send saved avatar (not null).

- [ ] **Step 1: Replace `src/pages/player/AvatarPage.tsx`** with the following complete file

```tsx
import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import PhoneLayout from "../../components/player/PhoneLayout";
import AvatarStack from "../../components/player/AvatarStack";
import Button from "../../components/ui/Button";
import Icon from "../../components/ui/Icon";
import { usePlayerStore } from "../../stores/playerStore";
import { useRoomStore } from "../../stores/roomStore";
import {
  loadPlayerIdentity,
  makePlayerId,
  savePlayerIdentity,
} from "../../types/player";
import {
  PALETTES,
  defaultAvatar,
  type AvatarCatalog,
  type AvatarCatalogItem,
  type AvatarSelection,
} from "../../types/avatar";
import type { Room } from "../../types/room";

type Tab = "characterId" | "hatId" | "decorationId";

const TAB_LABELS: Record<Tab, string> = {
  characterId: "Character",
  hatId: "Hat",
  decorationId: "Decoration",
};

export default function AvatarPage() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const setPlayer = usePlayerStore((s) => s.setPlayer);
  const setRoom = useRoomStore((s) => s.setRoom);

  const [room, setLocalRoom] = useState<Room | null>(null);
  const [roomError, setRoomError] = useState("");
  const [nickname, setNickname] = useState("");
  const [catalog, setCatalog] = useState<AvatarCatalog | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("characterId");
  const [avatar, setAvatar] = useState<AvatarSelection>({
    characterId: "",
    hatId: null,
    decorationId: null,
    paletteId: PALETTES[0].id,
  });
  const [submitting, setSubmitting] = useState(false);
  const [joinError, setJoinError] = useState("");

  useEffect(() => {
    fetch("/api/avatar-catalog")
      .then((r) => r.json())
      .then((data: AvatarCatalog) => {
        setCatalog(data);
        const savedIdentity = loadPlayerIdentity();
        if (savedIdentity?.avatar?.characterId) {
          setAvatar(savedIdentity.avatar);
        } else if (data.characters[0]) {
          setAvatar(defaultAvatar(data.characters[0].id));
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!code) return;
    (async () => {
      try {
        const res = await fetch(`/api/rooms/${code}`);
        const data = (await res.json()) as { room: Room };
        if (!data.room) { setRoomError("Room not found."); return; }
        if (data.room.status === "closed") { setRoomError("This room is closed."); return; }
        setLocalRoom(data.room);
        setRoom(data.room);

        const identity = loadPlayerIdentity();
        if (identity?.playerId && identity.nickname) {
          const savedAvatar = identity.avatar ?? avatar;
          const joinRes = await fetch(`/api/rooms/${code}/join`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              playerId: identity.playerId,
              nickname: identity.nickname,
              avatar: savedAvatar,
            }),
          });
          if (joinRes.ok) {
            const joinData = (await joinRes.json()) as { player: { id: string; nickname: string }; room: Room };
            setRoom(joinData.room);
            setPlayer({ playerId: joinData.player.id, nickname: joinData.player.nickname, avatar: savedAvatar });
            navigate(`/waiting/${code}`, { replace: true });
            return;
          }
        }
        if (identity?.nickname) setNickname(identity.nickname);
        if (identity?.avatar) setAvatar(identity.avatar);
      } catch {
        setRoomError("Could not load room. Check your connection.");
      }
    })();
  }, [code]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!code || !room) return;
    const trimmed = nickname.trim();
    if (!trimmed) { setJoinError("Enter a nickname"); return; }
    if (!avatar.characterId) { setJoinError("Pick a character"); return; }
    setSubmitting(true);
    setJoinError("");
    try {
      const playerId = loadPlayerIdentity()?.playerId ?? makePlayerId();
      const res = await fetch(`/api/rooms/${code}/join`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ playerId, nickname: trimmed, avatar }),
      });
      if (!res.ok) {
        const err = (await res.json()) as { error?: string };
        throw new Error(err.error ?? "Failed to join");
      }
      const data = (await res.json()) as { player: { id: string; nickname: string }; room: Room };
      savePlayerIdentity({ playerId: data.player.id, nickname: data.player.nickname, avatar });
      setPlayer({ playerId: data.player.id, nickname: data.player.nickname, avatar });
      setRoom(data.room);
      navigate(`/waiting/${code}`);
    } catch (err) {
      setJoinError(err instanceof Error ? err.message : "Failed to join");
    } finally {
      setSubmitting(false);
    }
  }

  function selectItem(tab: Tab, id: string | null) {
    setAvatar((prev) => ({ ...prev, [tab]: id }));
  }

  function renderGrid(tab: Tab, items: AvatarCatalogItem[]) {
    const isOptional = tab !== "characterId";
    const currentVal = avatar[tab];
    return (
      <div className="avatar-choice-group">
        <div className="avatar-choice-head">
          <h2>{TAB_LABELS[tab]}</h2>
          {isOptional && <span>Optional</span>}
        </div>
        <div className="avatar-choice-grid">
          {isOptional && (
            <button
              type="button"
              className={["avatar-choice-card none-card", currentVal === null ? "active" : ""].join(" ")}
              onClick={() => selectItem(tab, null)}
              aria-label="None"
            />
          )}
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              className={["avatar-choice-card", currentVal === item.id ? "active" : ""].join(" ")}
              onClick={() => selectItem(tab, item.id)}
              aria-label={item.nameEn}
            >
              <div className={`avatar-choice-art ${tab}`}>
                <img src={item.src} alt={item.nameEn} />
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (roomError) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
        <PhoneLayout>
          <div className="phone-card grid gap-[12px] text-center">
            <div className="text-[48px]">✕</div>
            <h1 className="text-[var(--ink)] text-[22px] font-[800] m-0">
              {roomError.includes("closed") ? "Room closed" : "Room not found"}
            </h1>
            <p className="text-[var(--muted)] text-[14px] m-0">Ask the host for a new code.</p>
          </div>
        </PhoneLayout>
      </motion.div>
    );
  }

  if (!room) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
        <PhoneLayout>
          <div className="phone-card text-center">
            <p className="text-[var(--muted)] text-[14px] m-0">Loading room…</p>
          </div>
        </PhoneLayout>
      </motion.div>
    );
  }

  const tabItems: AvatarCatalogItem[] =
    activeTab === "characterId"
      ? (catalog?.characters ?? [])
      : activeTab === "hatId"
      ? (catalog?.hats ?? [])
      : (catalog?.decorations ?? []);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
      <PhoneLayout>
        <form className="phone-card grid gap-[18px]" onSubmit={handleSubmit}>
          <div>
            <h1 className="text-[var(--ink)] text-[22px] font-[800] m-0 mb-[6px]">
              Join {code}
            </h1>
            <p className="text-[var(--muted)] text-[14px] m-0">
              Build your player and enter a nickname.
            </p>
          </div>

          {/* Avatar composer */}
          <div className="avatar-composer">
            {/* Preview */}
            <div className="avatar-preview-card">
              <div className="avatar-preview-stage">
                <AvatarStack avatar={avatar.characterId ? avatar : null} size="hero" />
              </div>
            </div>

            {/* Category tabs */}
            <div className="avatar-step-tabs">
              {(["characterId", "hatId", "decorationId"] as Tab[]).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  className={["avatar-step-tab", activeTab === tab ? "active" : ""].join(" ")}
                  onClick={() => setActiveTab(tab)}
                >
                  {TAB_LABELS[tab]}
                </button>
              ))}
            </div>

            {/* Item grid for active tab */}
            {catalog ? renderGrid(activeTab, tabItems) : (
              <div className="avatar-choice-group">
                <p className="text-[var(--muted)] text-[13px] text-center py-[16px] m-0">Loading…</p>
              </div>
            )}

            {/* Palette picker */}
            <div className="grid gap-[8px]">
              <span className="text-[#c8d4de] text-[13px] font-[700]">Color</span>
              <div className="flex flex-wrap gap-[8px]">
                {PALETTES.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className={[
                      "w-[34px] h-[34px] rounded-full border-[3px] cursor-pointer transition-[box-shadow]",
                      avatar.paletteId === p.id
                        ? "border-white [box-shadow:0_0_0_2px_rgba(255,255,255,.4)]"
                        : "border-transparent",
                    ].join(" ")}
                    style={{ background: p.fill }}
                    onClick={() => setAvatar((prev) => ({ ...prev, paletteId: p.id }))}
                    aria-label={p.id}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Nickname */}
          <label className="grid gap-[8px]">
            <span className="text-[#c8d4de] text-[13px] font-[700]">Nickname</span>
            <input
              className={[
                "w-full min-h-[48px] px-[14px] rounded-[6px]",
                "border border-white/[.12] bg-[rgba(23,29,37,.74)]",
                "text-[var(--ink)] text-[16px]",
                "focus:outline-none focus:border-[rgba(120,212,94,.7)]",
              ].join(" ")}
              name="nickname"
              maxLength={24}
              placeholder="Alex"
              value={nickname}
              onChange={(e) => { setNickname(e.target.value); setJoinError(""); }}
              autoComplete="nickname"
            />
          </label>

          {joinError && (
            <p className="text-[#f67272] text-[13px] m-0">{joinError}</p>
          )}

          <Button variant="primary" className="w-full" type="submit" disabled={submitting || !avatar.characterId}>
            <Icon name="login" />
            <span>{submitting ? "Joining…" : "Join room"}</span>
          </Button>
        </form>
      </PhoneLayout>
    </motion.div>
  );
}
```

- [ ] **Step 2: Run TypeScript check**

```bash
cd /Users/neil/Documents/派对游戏 && npx tsc --noEmit 2>&1 | head -40
```

Expected: no errors. Fix any type errors before continuing.

- [ ] **Step 3: Run all tests**

```bash
cd /Users/neil/Documents/派对游戏 && npm test -- --reporter=verbose 2>&1 | tail -30
```

Expected: all tests pass.

- [ ] **Step 4: Production build**

```bash
cd /Users/neil/Documents/派对游戏 && npm run build 2>&1 | tail -30
```

Expected: build succeeds with no TypeScript errors. Ignore bundle size warnings.

- [ ] **Step 5: Commit**

```bash
cd /Users/neil/Documents/派对游戏 && git add src/pages/player/AvatarPage.tsx
git commit -m "feat(avatar): full avatar picker UI in AvatarPage"
```

---

## Self-Review

**Spec coverage:**
- ✅ `AvatarSelection` type matching server shape `{ characterId, hatId, decorationId, paletteId }` — Task 1
- ✅ Fetch avatar catalog from `/api/avatar-catalog` — Task 4
- ✅ Character / Hat / Decoration tab picker with 4-column grid — Task 4
- ✅ "None" option for hat and decoration — Task 4
- ✅ Palette color picker (6 palettes) — Task 4
- ✅ Live preview in hero AvatarStack — Task 4
- ✅ Auto-resume sends saved avatar (not null) — Task 4
- ✅ Saved avatar stored in localStorage — Task 4
- ✅ AvatarStack renders character + hat + decoration as layered PNGs — Task 2
- ✅ AvatarStack palette ring color for status override (ringColor prop) — Task 2
- ✅ WaitingPage uses AvatarStack with game-state ringColor — Task 3
- ✅ ScoreRow uses AvatarStack — Task 3
- ✅ WinnerBoard uses AvatarStack — Task 3
- ✅ CSS classes matching vanilla app structure — Task 2

**Type consistency check:**
- `AvatarSelection.characterId` used consistently in Task 1, 2, 3, 4 ✅
- `paletteById()` defined in Task 1, used in Task 2 ✅
- `defaultAvatar(characterId)` defined in Task 1, used in Task 4 ✅
- `AvatarCatalog.characters / .hats / .decorations` defined in Task 1, used in Task 4 ✅
- `Player.avatar: AvatarSelection | null` updated in Task 1, used in Task 3 ✅
- `PlayerIdentity.avatar: AvatarSelection | null` updated in Task 1, used in Task 4 ✅
