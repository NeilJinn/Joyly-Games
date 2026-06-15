# Phase 4 — Player Phone Pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port the phone-side player experience to React: enter a room code, pick a nickname, toggle ready, and wait for the game to start — matching the existing vanilla-JS UI exactly.

**Architecture:** Player pages are narrow "phone" views (max 440px centered column). They share a `PhoneLayout` wrapper. Player identity (playerId + nickname + avatar) persists in `localStorage` for re-join on refresh. Real-time room state comes from the same SSE hook used in LobbyPage.

**Tech Stack:** React 18, TypeScript, Tailwind CSS, Framer Motion, Zustand, Vite proxy `/api`.

---

## Critical reference — server API

### Join a room
`POST /api/rooms/:code/join`
Body: `{ playerId?: string, nickname: string, avatar: object | null }`
Returns: `{ player, room, resumed: boolean }`
- If `playerId` matches existing player → resume (200)
- Otherwise create new player (201)
- Error 409 if room is full or not waiting

### Toggle ready
`POST /api/rooms/:code/players/:playerId/ready`
Body: `{ ready: boolean }`
Returns: `{ player, room }`

### Ping (heartbeat)
`POST /api/rooms/:code/players/:playerId/ping`
Returns: `{ player, room }`

### Get room
`GET /api/rooms/:code`
Returns: `{ room }`

### SSE
`GET /api/events/:code` — same as LobbyPage, sends `{ type:"room", room }` on every change.

---

## URL routing

The original app used `/?room=CODE` (query param). Our React router uses path-based routes. We need to handle both:

| Incoming URL | Action |
|---|---|
| `/?room=CODE` | Redirect to `/join/CODE` (from QR codes, share links) |
| `/join` | Show room-code entry form |
| `/join/:code` | Fetch room → show join form or auto-resume |
| `/waiting/:code` | Show player status + ready toggle |
| `/play/:code` | In-game phone view (Phase 5 placeholder) |

---

## Player identity (localStorage)

Key: `"joylyPlayerIdentity"` — `{ playerId: string, nickname: string, avatar: object | null }`

On successful join: save `{ playerId, nickname, avatar }`.
On page load: load identity to attempt auto-resume.

---

## Phone UI layout reference

From `public/platform/styles.css`:
- `.phone-wrap`: `min-height: 100vh; display: grid; place-items: center; padding: 84px 20px 20px; background: linear-gradient(180deg, #111821, #090d12)`
- `.phone-flow`: `width: min(440px, 100%); display: grid; gap: 14px`
- `.phone-topbar`: `position: fixed; inset: 0 0 auto; height: 64px; z-index: 10; display: flex; align-items: center; justify-content: space-between; padding: 0 16px; border-bottom: 1px solid rgba(255,255,255,.08); background: rgba(14,22,35,.88); backdrop-filter: blur(14px)`
- `.join-card`: `max-width: 440px; padding: 24px; position: relative; z-index: 1`
- `.phone-status`: `display: grid; justify-items: center; gap: 14px; width: 100%; text-align: center`
- `.phone-status-copy h1`: player nickname, centered
- `.ready-chip`: status text ("Getting ready", "Ready", "Starting in Xs"), `font-weight: 900; color: var(--muted)`
- `.is-ready .ready-chip`: green color
- `.phone-status-panel`: `width: 100%; display: grid; gap: 8px`
- `.ready-button`: `width: 100%; margin-top: 8px`
- `.phone-mini`: room code + game name small display at bottom; `display: grid; gap: 5px; color: var(--muted)` with `strong { color: var(--ink) }`

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `src/types/player.ts` | **Create** | `PlayerIdentity` (localStorage), `PlayerPayload` (API body) |
| `src/stores/playerStore.ts` | **Replace** | Align with actual server Player shape and localStorage |
| `src/styles/globals.css` | **Modify** | Add `.phone-wrap`, `.phone-topbar`, `.phone-flow`, `.join-card` (phone context), `.phone-status` CSS |
| `src/App.tsx` | **Modify** | Add `?room=CODE` redirect logic |
| `src/components/player/PhoneLayout.tsx` | **Create** | Shared phone wrapper: topbar + gradient body |
| `src/pages/player/JoinPage.tsx` | **Replace** | Room code entry form (when navigated to `/join` directly) |
| `src/pages/player/AvatarPage.tsx` | **Replace** | Nickname + color picker → join room → save to localStorage |
| `src/pages/player/WaitingPage.tsx` | **Replace** | Player status card + ready toggle + SSE → navigate to `/play/:code` |
| `src/pages/player/InRoomPage.tsx` | **Replace** | "Game in progress" placeholder (full implementation Phase 5) |

---

## Task 1: Player types + playerStore rewrite

**Files:**
- Create: `src/types/player.ts`
- Replace: `src/stores/playerStore.ts`

### Context

The current `playerStore` uses `avatarKey: string` which doesn't match the server. The server Player has `avatar: object | null`. We also need a `PlayerIdentity` type for localStorage persistence.

Avatar system note: The full avatar catalog (sprites, hats, decorations) is a complex system not ported in this phase. For Phase 4, `avatar` is always `null`. The avatar picker (Task 3) will let players choose a display color for the UI only — stored in localStorage but not sent to the server as an avatar object yet.

- [ ] **Step 1: Create `src/types/player.ts`**

```ts
export interface PlayerIdentity {
  playerId: string;
  nickname: string;
  avatar: null;
}

export interface PlayerPayload {
  playerId: string;
  nickname: string;
  avatar: null;
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

- [ ] **Step 2: Replace `src/stores/playerStore.ts`**

```ts
import { create } from "zustand";
import type { PlayerIdentity } from "../types/player";
import { loadPlayerIdentity, savePlayerIdentity } from "../types/player";

interface PlayerState {
  playerId: string | null;
  nickname: string;
  joinStatus: "idle" | "joining" | "joined" | "error";
  joinError: string;
  setPlayer: (identity: PlayerIdentity) => void;
  setJoinStatus: (status: "idle" | "joining" | "joined" | "error", error?: string) => void;
  clearPlayer: () => void;
  loadFromStorage: () => PlayerIdentity | null;
}

export const usePlayerStore = create<PlayerState>()((set) => ({
  playerId: null,
  nickname: "",
  joinStatus: "idle",
  joinError: "",
  setPlayer: (identity) => {
    savePlayerIdentity(identity);
    set({ playerId: identity.playerId, nickname: identity.nickname, joinStatus: "joined", joinError: "" });
  },
  setJoinStatus: (status, error = "") =>
    set({ joinStatus: status, joinError: error }),
  clearPlayer: () =>
    set({ playerId: null, nickname: "", joinStatus: "idle", joinError: "" }),
  loadFromStorage: () => loadPlayerIdentity(),
}));
```

- [ ] **Step 3: TypeScript check**

```bash
cd /Users/neil/Documents/派对游戏
npx tsc --noEmit 2>&1 | head -40
```

Expected: zero errors.

- [ ] **Step 4: Commit**

```bash
cd /Users/neil/Documents/派对游戏
git add src/types/player.ts src/stores/playerStore.ts
git commit -m "feat(player): add PlayerIdentity types and rewrite playerStore"
```

---

## Task 2: Phone CSS + PhoneLayout component

**Files:**
- Modify: `src/styles/globals.css`
- Create: `src/components/player/PhoneLayout.tsx`

### Context

All player pages share the same phone chrome: a fixed topbar (Joyly brand + home button) and a centered dark gradient body. This is `phoneHeader()` + `.phone-wrap` in the vanilla JS.

The topbar `phoneHeader()` from app.js:
```js
function phoneHeader() {
  return html`
    <header class="phone-topbar">
      <button class="brand brand-button" type="button" data-phone-home aria-label="Home">
        <span class="brand-mark">J</span> Joyly Games
      </button>
      <div class="phone-topbar-actions">
        <button class="icon-button btn-tool" type="button" data-phone-logout aria-label="Log out">...</button>
      </div>
    </header>
  `;
}
```

For Phase 4, the topbar only needs the brand link (clicking goes to `/`). The logout button is for the paired host phone flow, which is Phase 5+.

- [ ] **Step 1: Add phone CSS to `src/styles/globals.css`**

Append this block at the end of the file:

```css
/* ── Phone / Player pages ─────────────────────────────────────── */
.phone-wrap {
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: 84px 20px 20px;
  background: linear-gradient(180deg, #111821, #090d12);
  overflow-x: hidden;
}

.phone-topbar {
  position: fixed;
  inset: 0 0 auto;
  height: 64px;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  border-bottom: 1px solid rgba(255, 255, 255, .08);
  background: rgba(14, 22, 35, .88);
  backdrop-filter: blur(14px);
}

.phone-flow {
  width: min(440px, 100%);
  display: grid;
  gap: 14px;
}

.phone-card {
  max-width: 440px;
  padding: 24px;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, .1);
  background: rgba(17, 24, 33, .92);
  box-shadow: var(--shadow);
  position: relative;
  z-index: 1;
}

.phone-status {
  display: grid;
  justify-items: center;
  gap: 14px;
  width: 100%;
  text-align: center;
}

.phone-status-avatar {
  width: 100%;
  display: grid;
  place-items: center;
}

.phone-status-copy {
  display: grid;
  gap: 6px;
  justify-items: center;
}

.phone-status-copy h1 {
  margin: 0;
  font-size: 28px;
}

.ready-chip {
  font-weight: 900;
  color: var(--muted);
  font-size: 14px;
}

.ready-chip.is-ready {
  color: #78d45e;
}

.phone-status-panel {
  width: 100%;
  display: grid;
  gap: 8px;
}

.phone-mini {
  margin-top: 8px;
  display: grid;
  gap: 5px;
  color: var(--muted);
  font-size: 13px;
  text-align: center;
}

.phone-mini strong {
  color: var(--ink);
  font-size: 14px;
}
```

- [ ] **Step 2: Create `src/components/player/PhoneLayout.tsx`**

```tsx
import type { ReactNode } from "react";
import { Link } from "react-router-dom";

interface PhoneLayoutProps {
  children: ReactNode;
}

export default function PhoneLayout({ children }: PhoneLayoutProps) {
  return (
    <div className="phone-wrap">
      <header className="phone-topbar">
        <Link
          to="/"
          className="flex items-center gap-[10px] text-[var(--ink)] font-[800] text-[16px] no-underline"
          aria-label="Home"
        >
          <span
            className="w-[36px] h-[36px] block flex-none overflow-hidden rounded-[9px] [background:var(--brand-mark)_center/contain_no-repeat] text-transparent [text-indent:-999px]"
            aria-hidden="true"
          >
            J
          </span>
          Joyly Games
        </Link>
      </header>
      <div className="phone-flow">{children}</div>
    </div>
  );
}
```

- [ ] **Step 3: TypeScript check**

```bash
cd /Users/neil/Documents/派对游戏
npx tsc --noEmit 2>&1 | head -40
```

Expected: zero errors.

- [ ] **Step 4: Commit**

```bash
cd /Users/neil/Documents/派对游戏
git add src/styles/globals.css src/components/player/PhoneLayout.tsx
git commit -m "feat(player): add phone layout CSS and PhoneLayout component"
```

---

## Task 3: URL redirect + JoinPage

**Files:**
- Modify: `src/App.tsx`
- Replace: `src/pages/player/JoinPage.tsx`

### Context

QR codes and share links generate `/?room=CODE`. The React router doesn't handle this automatically. We add a redirect component that catches `?room=` and sends the user to `/join/:code`.

`JoinPage` at `/join` (no code) shows a simple form: numeric input for the 6-digit room code, a "Join" button. On submit → navigate to `/join/:code`.

From the original styles, the join code input is numeric, max 6 digits.

- [ ] **Step 1: Add `RoomCodeRedirect` to `src/App.tsx`**

Read App.tsx. Add this component above `AnimatedRoutes` and add a route for `/`:

```tsx
import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";

function RoomCodeRedirect() {
  const location = useLocation();
  const navigate = useNavigate();
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const roomCode = params.get("room");
    if (roomCode) {
      navigate(`/join/${roomCode.replace(/\D/g, "")}`, { replace: true });
    }
  }, [location.search, navigate]);
  return null;
}
```

Then add the component inside `BrowserRouter`, before `AnimatedRoutes`:
```tsx
export default function App() {
  return (
    <BrowserRouter>
      <RoomCodeRedirect />
      <AnimatedRoutes />
    </BrowserRouter>
  );
}
```

Note: `RoomCodeRedirect` must be inside `BrowserRouter` to use hooks. Place it before `AnimatedRoutes`.

- [ ] **Step 2: Replace `src/pages/player/JoinPage.tsx`**

```tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import PhoneLayout from "../../components/player/PhoneLayout";
import Button from "../../components/ui/Button";
import Icon from "../../components/ui/Icon";

export default function JoinPage() {
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const cleaned = code.replace(/\D/g, "");
    if (cleaned.length !== 6) {
      setError("Enter the 6-digit room code");
      return;
    }
    navigate(`/join/${cleaned}`);
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
    >
      <PhoneLayout>
        <form className="phone-card grid gap-[16px]" onSubmit={handleSubmit}>
          <h1 className="text-[var(--ink)] text-[24px] font-[800] m-0">
            Join a room
          </h1>
          <p className="text-[var(--muted)] text-[14px] m-0">
            Enter the 6-digit code shown on the host screen.
          </p>
          <label className="grid gap-[8px]">
            <span className="text-[#c8d4de] text-[13px] font-[700]">Room code</span>
            <input
              className={[
                "w-full min-h-[48px] px-[14px] rounded-[6px]",
                "border border-white/[.12] bg-[rgba(23,29,37,.74)]",
                "text-[var(--ink)] text-[24px] font-[800] tracking-[.12em] text-center",
                "focus:outline-none focus:border-[rgba(120,212,94,.7)]",
              ].join(" ")}
              inputMode="numeric"
              maxLength={6}
              placeholder="000000"
              value={code}
              onChange={(e) => {
                setCode(e.target.value.replace(/\D/g, "").slice(0, 6));
                setError("");
              }}
              autoFocus
            />
          </label>
          {error && (
            <p className="text-[#f67272] text-[13px] m-0">{error}</p>
          )}
          <Button variant="primary" className="w-full" type="submit">
            <Icon name="login" />
            <span>Join room</span>
          </Button>
        </form>
      </PhoneLayout>
    </motion.div>
  );
}
```

- [ ] **Step 3: TypeScript check**

```bash
cd /Users/neil/Documents/派对游戏
npx tsc --noEmit 2>&1 | head -40
```

Expected: zero errors.

- [ ] **Step 4: Commit**

```bash
cd /Users/neil/Documents/派对游戏
git add src/App.tsx src/pages/player/JoinPage.tsx
git commit -m "feat(player): add room code redirect and JoinPage form"
```

---

## Task 4: AvatarPage — join form with auto-resume

**Files:**
- Replace: `src/pages/player/AvatarPage.tsx`

### Context

Route: `/join/:code`

Flow:
1. Fetch `GET /api/rooms/:code` to verify room exists and is waiting
2. Try auto-resume: if localStorage has a saved `playerIdentity`, attempt `POST /api/rooms/:code/join` with that identity
3. If auto-resume succeeds → navigate to `/waiting/:code`
4. If not → show join form (nickname + color picker for avatar placeholder)
5. On submit → `POST /api/rooms/:code/join` → navigate to `/waiting/:code`

**Color picker:** Since full avatar sprites aren't ported yet, show 8 color swatches. The selected color is stored as `{ color: "#hex" }` in localStorage as the `avatar` field display-only (we send `avatar: null` to server for now).

**Avatar placeholder** shown in WaitingPage uses the color if present.

The `POST /api/rooms/:code/join` body: `{ playerId, nickname, avatar: null }`.

If room is closed → show "Room closed" message.
If room not found → show "Room not found" message.

- [ ] **Step 1: Replace `src/pages/player/AvatarPage.tsx`**

```tsx
import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import PhoneLayout from "../../components/player/PhoneLayout";
import Button from "../../components/ui/Button";
import Icon from "../../components/ui/Icon";
import { usePlayerStore } from "../../stores/playerStore";
import { useRoomStore } from "../../stores/roomStore";
import {
  loadPlayerIdentity,
  makePlayerId,
  savePlayerIdentity,
} from "../../types/player";
import type { Room } from "../../types/room";

const COLORS = [
  "#78d45e", "#5eb8d4", "#f4b04a", "#e05eb4",
  "#5e82f4", "#f45e5e", "#5ef4d4", "#d4d45e",
];

export default function AvatarPage() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const setPlayer = usePlayerStore((s) => s.setPlayer);
  const setRoom = useRoomStore((s) => s.setRoom);

  const [room, setLocalRoom] = useState<Room | null>(null);
  const [roomError, setRoomError] = useState("");
  const [nickname, setNickname] = useState("");
  const [selectedColor, setSelectedColor] = useState(COLORS[0]);
  const [submitting, setSubmitting] = useState(false);
  const [joinError, setJoinError] = useState("");

  // Fetch room and try auto-resume
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

        // Try auto-resume
        const identity = loadPlayerIdentity();
        if (identity?.playerId && identity.nickname) {
          const joinRes = await fetch(`/api/rooms/${code}/join`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ playerId: identity.playerId, nickname: identity.nickname, avatar: null }),
          });
          if (joinRes.ok) {
            const joinData = (await joinRes.json()) as { player: { id: string; nickname: string }; room: Room };
            setRoom(joinData.room);
            setPlayer({ playerId: joinData.player.id, nickname: joinData.player.nickname, avatar: null });
            navigate(`/waiting/${code}`, { replace: true });
            return;
          }
        }
        // Pre-fill nickname from saved identity
        if (identity?.nickname) setNickname(identity.nickname);
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
    setSubmitting(true);
    setJoinError("");
    try {
      const playerId = loadPlayerIdentity()?.playerId ?? makePlayerId();
      const res = await fetch(`/api/rooms/${code}/join`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ playerId, nickname: trimmed, avatar: null }),
      });
      if (!res.ok) {
        const err = (await res.json()) as { error?: string };
        throw new Error(err.error ?? "Failed to join");
      }
      const data = (await res.json()) as { player: { id: string; nickname: string }; room: Room };
      savePlayerIdentity({ playerId: data.player.id, nickname: data.player.nickname, avatar: null });
      setPlayer({ playerId: data.player.id, nickname: data.player.nickname, avatar: null });
      setRoom(data.room);
      navigate(`/waiting/${code}`);
    } catch (err) {
      setJoinError(err instanceof Error ? err.message : "Failed to join");
    } finally {
      setSubmitting(false);
    }
  }

  if (roomError) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
        <PhoneLayout>
          <div className="phone-card grid gap-[12px] text-center">
            <div className="text-[48px]">✕</div>
            <h1 className="text-[var(--ink)] text-[22px] font-[800] m-0">{roomError.includes("closed") ? "Room closed" : "Room not found"}</h1>
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

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
      <PhoneLayout>
        <form className="phone-card grid gap-[18px]" onSubmit={handleSubmit}>
          <div>
            <h1 className="text-[var(--ink)] text-[22px] font-[800] m-0 mb-[6px]">
              Join {code}
            </h1>
            <p className="text-[var(--muted)] text-[14px] m-0">
              Choose your player name for this room.
            </p>
          </div>

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
              autoFocus
              autoComplete="nickname"
            />
          </label>

          {/* Color picker — avatar placeholder */}
          <div className="grid gap-[8px]">
            <span className="text-[#c8d4de] text-[13px] font-[700]">Pick a color</span>
            <div className="flex flex-wrap gap-[10px]">
              {COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  className={[
                    "w-[36px] h-[36px] rounded-full border-[3px] cursor-pointer transition-[box-shadow]",
                    selectedColor === color
                      ? "border-white [box-shadow:0_0_0_2px_rgba(255,255,255,.4)]"
                      : "border-transparent",
                  ].join(" ")}
                  style={{ background: color }}
                  onClick={() => setSelectedColor(color)}
                  aria-label={`Color ${color}`}
                />
              ))}
            </div>
          </div>

          {joinError && (
            <p className="text-[#f67272] text-[13px] m-0">{joinError}</p>
          )}

          <Button variant="primary" className="w-full" type="submit" disabled={submitting}>
            <Icon name="login" />
            <span>{submitting ? "Joining…" : "Join room"}</span>
          </Button>
        </form>
      </PhoneLayout>
    </motion.div>
  );
}
```

- [ ] **Step 2: TypeScript check**

```bash
cd /Users/neil/Documents/派对游戏
npx tsc --noEmit 2>&1 | head -40
```

Expected: zero errors.

- [ ] **Step 3: Commit**

```bash
cd /Users/neil/Documents/派对游戏
git add src/pages/player/AvatarPage.tsx
git commit -m "feat(player): implement AvatarPage with nickname form and auto-resume"
```

---

## Task 5: WaitingPage — player status + ready toggle + SSE

**Files:**
- Replace: `src/pages/player/WaitingPage.tsx`

### Context

Route: `/waiting/:code`

This page shows the player's status card (avatar placeholder with glow ring, nickname, status text) and a "Tap when ready" button. When the player taps it, it calls `POST /api/rooms/:code/players/:playerId/ready { ready: true }`. Tapping again toggles back to not ready.

State management:
- Load `playerId` from localStorage (via `loadPlayerIdentity()`)
- If no identity → redirect to `/join/:code`
- Subscribe to SSE with `useSSE(code)` — room updates come in via roomStore
- When `room.status === "playing"` → navigate to `/play/:code`
- When `room.status === "closed"` → show closed message

Status text logic (from `shared/player-status.js`):
- `room.launchCountdown?.endsAt` → "Starting in Xs"
- `player.ready` → "Ready"
- else → "Getting ready"

Ring colors: pending = `#f4b04a`, ready = `#78d45e`, disconnected = `#8f99a6`

Note: The `room` from `useRoomStore` is updated by SSE. Find the current player in `room.players` by `playerId`.

The avatar placeholder: a large colored circle (using `selectedColor` saved in localStorage — we stored the color there in AvatarPage). For now, show initials in the circle.

There's no persistent storage for selectedColor yet — add it to `PlayerIdentity` or just use a default. Simplest: add `color?: string` to `PlayerIdentity` and store it in AvatarPage.

> **Update Task 1's Step 1** to add `color?: string` to `PlayerIdentity`:
```ts
export interface PlayerIdentity {
  playerId: string;
  nickname: string;
  avatar: null;
  color?: string;
}
```
And update `savePlayerIdentity` call in AvatarPage to include `color: selectedColor`.

- [ ] **Step 1: Update `src/types/player.ts` to add `color?: string` to `PlayerIdentity`**

Add `color?: string` to the `PlayerIdentity` interface:
```ts
export interface PlayerIdentity {
  playerId: string;
  nickname: string;
  avatar: null;
  color?: string;
}
```

- [ ] **Step 2: Update `src/pages/player/AvatarPage.tsx` to save color**

In `handleSubmit`, change the `savePlayerIdentity` call and `setPlayer` call to include color:
```ts
savePlayerIdentity({ playerId: data.player.id, nickname: data.player.nickname, avatar: null, color: selectedColor });
setPlayer({ playerId: data.player.id, nickname: data.player.nickname, avatar: null, color: selectedColor });
```

Also update the auto-resume block to pass `color`:
```ts
setPlayer({ playerId: joinData.player.id, nickname: joinData.player.nickname, avatar: null, color: identity.color });
```

Read AvatarPage first, then apply these minimal edits.

- [ ] **Step 3: Replace `src/pages/player/WaitingPage.tsx`**

```tsx
import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import PhoneLayout from "../../components/player/PhoneLayout";
import Button from "../../components/ui/Button";
import Icon from "../../components/ui/Icon";
import { useSSE } from "../../hooks/useSSE";
import { useRoomStore } from "../../stores/roomStore";
import { loadPlayerIdentity } from "../../types/player";
import type { Player } from "../../types/room";

function getInitials(nickname: string): string {
  return nickname.slice(0, 2).toUpperCase();
}

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
  const color = identity?.color ?? "#78d45e";

  const [toggling, setToggling] = useState(false);
  const [error, setError] = useState("");

  // Redirect if no identity
  useEffect(() => {
    if (!playerId) navigate(`/join/${code ?? ""}`, { replace: true });
  }, [playerId, code, navigate]);

  // Fetch room on mount if not already loaded
  useEffect(() => {
    if (!code || room?.code === code) return;
    fetch(`/api/rooms/${code}`)
      .then((r) => r.json())
      .then((data: { room: typeof room }) => { if (data.room) setRoom(data.room); })
      .catch(() => {});
  }, [code, room?.code, setRoom]);

  // SSE for real-time updates
  useSSE(code ?? null);

  // Navigate when game starts
  useEffect(() => {
    if (room?.status === "playing") navigate(`/play/${code}`, { replace: true });
  }, [room?.status, code, navigate]);

  if (!playerId) return null;

  // Find this player in room
  const currentPlayer: Player | undefined = room?.players.find((p) => p.id === playerId);

  const countdownEndsAt = (room?.launchCountdown as { endsAt?: number } | null)?.endsAt;
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
          {/* Avatar placeholder */}
          <div className="phone-status-avatar">
            <div
              className="w-[min(240px,60vw)] h-[min(240px,60vw)] rounded-full flex items-center justify-center text-[56px] font-[800] text-white"
              style={{
                background: "rgba(17,24,33,.9)",
                boxShadow: `0 0 0 4px ${ringColor}, 0 0 24px ${ringColor}66`,
                filter: currentPlayer?.online === false ? "grayscale(1)" : undefined,
              }}
            >
              {getInitials(nickname)}
            </div>
          </div>

          {/* Name + status */}
          <div className="phone-status-copy">
            <h1 className="text-[var(--ink)] text-[28px] font-[800]">{nickname}</h1>
            <span
              className={[
                "ready-chip",
                isReady ? "is-ready" : "",
              ].join(" ")}
              style={isReady ? { color: "#78d45e" } : undefined}
            >
              {statusText}
            </span>
          </div>

          {/* Actions */}
          <div className="phone-status-panel">
            {room?.status === "waiting" && (
              <Button
                variant="primary"
                className={[
                  "w-full ready-button",
                  isReady ? "ring-1 ring-[#78d45e]" : "",
                ].join(" ")}
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

            {/* Room mini info */}
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

- [ ] **Step 4: TypeScript check**

```bash
cd /Users/neil/Documents/派对游戏
npx tsc --noEmit 2>&1 | head -40
```

Expected: zero errors.

- [ ] **Step 5: Run tests**

```bash
cd /Users/neil/Documents/派对游戏
npx vitest run 2>&1 | tail -15
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
cd /Users/neil/Documents/派对游戏
git add src/types/player.ts src/pages/player/AvatarPage.tsx src/pages/player/WaitingPage.tsx
git commit -m "feat(player): implement WaitingPage with ready toggle and SSE"
```

---

## Task 6: InRoomPage — game-started placeholder

**Files:**
- Replace: `src/pages/player/InRoomPage.tsx`

### Context

Route: `/play/:code`

When a game starts, the player is navigated here. Full game-specific phone UI (e.g. Cosmic Trivia answer buttons) will be implemented in Phase 5. For Phase 4, show a clear "Game in progress" card with the game name and an option to go back to waiting if something goes wrong.

Also subscribe to SSE here so if the room goes back to `waiting` (e.g. game ends), we can navigate back. If `room.status === "closed"` → show closed card.

- [ ] **Step 1: Replace `src/pages/player/InRoomPage.tsx`**

```tsx
import { useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import PhoneLayout from "../../components/player/PhoneLayout";
import { useSSE } from "../../hooks/useSSE";
import { useRoomStore } from "../../stores/roomStore";

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

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
    >
      <PhoneLayout>
        <div className="phone-card grid gap-[12px] text-center">
          <div className="text-[48px]">🎮</div>
          <h1 className="text-[var(--ink)] text-[22px] font-[800] m-0">
            {room?.selectedGame?.title ?? "Game"} is live
          </h1>
          <p className="text-[var(--muted)] text-[14px] m-0">
            Follow along on the big screen.
          </p>
        </div>
      </PhoneLayout>
    </motion.div>
  );
}
```

- [ ] **Step 2: TypeScript check**

```bash
cd /Users/neil/Documents/派对游戏
npx tsc --noEmit 2>&1 | head -40
```

Expected: zero errors.

- [ ] **Step 3: Commit**

```bash
cd /Users/neil/Documents/派对游戏
git add src/pages/player/InRoomPage.tsx
git commit -m "feat(player): implement InRoomPage placeholder for game-started state"
```

---

## Self-Review

### Spec coverage
- [x] `/?room=CODE` → `/join/CODE` redirect via `RoomCodeRedirect`
- [x] `/join` — room code entry form
- [x] `/join/:code` — nickname + color + auto-resume + join API
- [x] `/waiting/:code` — player status card, ready toggle, SSE, navigate to `/play/:code`
- [x] `/play/:code` — game-started placeholder, SSE, navigate back on room state changes
- [x] Phone CSS (`phone-wrap`, `phone-topbar`, `phone-flow`, `phone-card`, `phone-status`, etc.)
- [x] `PhoneLayout` wrapper shared across all player pages
- [x] Player identity persisted to localStorage for re-join

### Type consistency
- `PlayerIdentity { playerId, nickname, avatar: null, color? }` — used consistently across player.ts, AvatarPage, WaitingPage
- `loadPlayerIdentity()` returns `PlayerIdentity | null` — null-checked everywhere
- `room.launchCountdown` typed as `number | null` in `Room` but cast as `{ endsAt?: number } | null` in WaitingPage for forward compat with the server's actual shape (server sends `{ endsAt: timestamp }` not a raw number)

### Note on launchCountdown type
The current `Room` type has `launchCountdown: number | null`. But the server actually sends `{ endsAt: number }` (an object). WaitingPage casts it correctly. Update `src/types/room.ts` in this task:
- Change `launchCountdown: number | null` → `launchCountdown: { endsAt: number } | null`
- Also update `LobbyControls.tsx` which uses `room.launchCountdown ?? 0` — change to `room.launchCountdown?.endsAt ? Math.max(0, Math.ceil((room.launchCountdown.endsAt - Date.now()) / 1000)) : 0`

Add this type fix to **Task 1, Step 1** as well — update `Room.launchCountdown` in `src/types/room.ts`.

### Placeholder scan
- InRoomPage uses 🎮 emoji — acceptable as placeholder since this page's full content is Phase 5
- No TBDs or incomplete logic
