# Phase 3 — Setup + Lobby UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the host Setup page (`/room/setup`) and Lobby page (`/room/:code`) in React/TypeScript, matching the existing vanilla-JS UI in `public/platform/app.js` exactly — technical upgrade only, no redesign.

**Architecture:** Each page is composed of focused React components; shared state lives in Zustand stores. The lobby subscribes to real-time room state via SSE. Modals (game picker, payment) are rendered inside the page that owns them (not at app level).

**Tech Stack:** React 18, TypeScript, Tailwind CSS (arbitrary values), Framer Motion, Zustand, Vite 5 dev server on port 5173 proxying `/api` to Node.js on port 4173.

---

## Critical reference — server API shape

### `roomView()` return shape (from server.js)
```ts
{
  code: string;
  host: { name: string; email: string };
  players: Array<{
    id: string;
    nickname: string;
    avatar: object | null;
    online: boolean;
    ready: boolean;
    lastSeen?: number;
  }>;
  status: "waiting" | "playing" | "complete" | "closed";
  selectedGame: {
    id: string; title: string; genre: string; players: string;
    mood: string; status: "playable" | "coming-soon";
    minPlayers: number; maxPlayers: number;
    credits: number; description: string;
  } | null;
  paymentMode: string;
  entitlement: {
    type: string;
    minutes?: number;
    expiresAt?: number;
    purchased?: number;
    spent?: number;
    remaining?: number;
  };
  launchCountdown: number | null;
  gameSetup: unknown;
  gameState: unknown;
  createdAt: number;
}
```

### SSE format
- Endpoint: `GET /api/events/:code`
- Every message: `data: {"type":"room","room":{...roomView...}}\n\n`
- All events are full room snapshots (no partial updates)

### Create room
- `POST /api/rooms` body: `{ hostName, email, gameId, paymentMode, minutes?, credits? }`
- Returns: `{ room: roomView }`

### Other room actions
- `POST /api/rooms/:code/select-game` body: `{ gameId }`
- `POST /api/rooms/:code/start`
- `POST /api/rooms/:code/force-start`
- `POST /api/rooms/:code/test-players`
- `POST /api/rooms/:code/close`

### QR code URL
```
https://api.qrserver.com/v1/create-qr-code/?size=164x164&data=<encoded-join-url>
```

### Payment constants
```ts
const PASSES = [
  { minutes: 60, label: "1 hr", price: "29 kr" },
  { minutes: 120, label: "2 hrs", price: "39 kr" },
  { minutes: 240, label: "4 hrs", price: "59 kr" },
];
const CREDIT_PACKS = [
  { credits: 20, price: "29 kr" },
  { credits: 50, price: "59 kr" },
  { credits: 120, price: "99 kr" },
];
const HOST_POINTS = 120;
```

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `src/types/room.ts` | **Modify** | Update Player and Room to match actual server shape |
| `src/hooks/useSSE.ts` | **Modify** | Fix SSE URL (`/api/events/:code`) and event format (`{type:"room",room}`) |
| `src/stores/roomStore.ts` | **Modify** | Simplify to `setRoom` only (SSE sends full snapshots) |
| `src/components/ui/Icon.tsx` | **Modify** | Add `music`, `copy`, `game` icon paths |
| `src/components/platform/AccountMenu.tsx` | **Create** | Host chip + popover with stats and menu rows |
| `src/components/platform/NavBar.tsx` | **Modify** | Show AccountMenu when signed in (replace plain display name) |
| `src/components/platform/GamePickerModal.tsx` | **Create** | Modal with 2-col game grid for picking a game |
| `src/components/platform/PaymentModal.tsx` | **Create** | Payment modal with 3 tabs + create room API call |
| `src/pages/platform/SetupPage.tsx` | **Create** | `/room/setup` — host setup page (game card, payment/create CTA) |
| `src/App.tsx` | **Modify** | Add `/room/setup` route |
| `src/pages/platform/LobbyPage.tsx` | **Replace** | Sidebar (code + QR + link) + stage main with SSE |
| `src/components/platform/PlayerStage.tsx` | **Create** | Stage floor + spotlights + player ring + empty state |
| `src/components/platform/PlayerBubble.tsx` | **Create** | Single player avatar card in the stage |
| `src/components/platform/LobbyControls.tsx` | **Create** | Host controls bar (game picker, add tester, close, start) |

---

## Task 1: Update types and fix useSSE

**Files:**
- Modify: `src/types/room.ts`
- Modify: `src/hooks/useSSE.ts`
- Modify: `src/stores/roomStore.ts`

### Context
The current `src/types/room.ts` uses `avatarKey: string` for players but the server returns `avatar: object | null`. The server also returns `host: { name, email }` and `selectedGame: GameConfig | null` on the room, not separate fields. The current `useSSE` hook has the wrong endpoint (`/api/room/:code/events` instead of `/api/events/:code`) and wrong event routing (server sends one type: `{type:"room", room}` for everything). The `roomStore` has granular `addPlayer`/`removePlayer` actions that are no longer needed since SSE delivers full snapshots.

- [ ] **Step 1: Replace `src/types/room.ts`**

```ts
import type { GameConfig } from "./config";

export type RoomStatus = "waiting" | "playing" | "complete" | "closed";

export interface Avatar {
  [key: string]: unknown;
}

export interface Player {
  id: string;
  nickname: string;
  avatar: Avatar | null;
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
  launchCountdown: number | null;
  gameSetup: unknown;
  gameState: unknown;
  createdAt: number;
}
```

- [ ] **Step 2: Simplify `src/stores/roomStore.ts`**

Replace the entire file with:

```ts
import { create } from "zustand";
import type { Room } from "../types/room";

interface RoomState {
  room: Room | null;
  setRoom: (room: Room) => void;
  clearRoom: () => void;
}

export const useRoomStore = create<RoomState>()((set) => ({
  room: null,
  setRoom: (room) => set({ room }),
  clearRoom: () => set({ room: null }),
}));
```

- [ ] **Step 3: Fix `src/hooks/useSSE.ts`**

Replace the entire file with:

```ts
import { useEffect, useRef } from "react";
import { useSSEStore } from "../stores/sseStore";
import { useRoomStore } from "../stores/roomStore";
import type { Room } from "../types/room";

const RECONNECT_DELAYS = [1000, 2000, 4000, 8000, 16000];

export function useSSE(roomCode: string | null) {
  const setStatus = useSSEStore((s) => s.setStatus);
  const recordEvent = useSSEStore((s) => s.recordEvent);
  const setRoom = useRoomStore((s) => s.setRoom);

  const retryCount = useRef(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!roomCode) return;

    let es: EventSource | null = null;
    let cancelled = false;

    function connect() {
      if (cancelled) return;
      setStatus("connecting");
      es = new EventSource(`/api/events/${roomCode}`);

      es.onopen = () => {
        if (cancelled) return;
        setStatus("connected");
        retryCount.current = 0;
      };

      es.onmessage = (evt) => {
        if (cancelled) return;
        recordEvent();
        try {
          const msg = JSON.parse(evt.data) as { type: string; room?: Room };
          if (msg.type === "room" && msg.room) {
            setRoom(msg.room);
          }
        } catch {
          // malformed event — ignore
        }
      };

      es.onerror = () => {
        if (cancelled) return;
        es?.close();
        const delay =
          RECONNECT_DELAYS[
            Math.min(retryCount.current, RECONNECT_DELAYS.length - 1)
          ];
        retryCount.current += 1;
        setStatus("reconnecting");
        timeoutRef.current = setTimeout(connect, delay);
      };
    }

    connect();

    return () => {
      cancelled = true;
      es?.close();
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      setStatus("idle");
    };
  }, [roomCode]);
}
```

- [ ] **Step 4: Run TypeScript check — expect zero errors**

```bash
cd /Users/neil/Documents/派对游戏
npx tsc --noEmit 2>&1 | head -60
```

Expected: clean or only pre-existing errors in pages not yet updated (LobbyPage stub is fine).

- [ ] **Step 5: Commit**

```bash
cd /Users/neil/Documents/派对游戏
git add src/types/room.ts src/hooks/useSSE.ts src/stores/roomStore.ts
git commit -m "feat(types): update Room/Player types and SSE hook to match server shape"
```

---

## Task 2: Add missing Icon paths and SetupPage route

**Files:**
- Modify: `src/components/ui/Icon.tsx`
- Create: `src/pages/platform/SetupPage.tsx` (placeholder)
- Modify: `src/App.tsx`

### Context
`Icon.tsx` is missing `music`, `copy`, and `game` paths needed by Phase 3 components. `App.tsx` doesn't have a `/room/setup` route. We'll create a placeholder SetupPage now and flesh it out in Task 3.

- [ ] **Step 1: Add icon paths to `src/components/ui/Icon.tsx`**

Add three entries to the `PATHS` record (after the existing `coins` entry):

```ts
  music: "M9 18V5l12-2v13M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM21 16a3 3 0 1 1-6 0 3 3 0 0 1 6 0z",
  copy: "M20 9H11a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2v-9a2 2 0 0 0-2-2zM5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1",
  game: "M21 6H3a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h18a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2zM7 12H7M12 9v6M9 12h6",
```

- [ ] **Step 2: Create placeholder `src/pages/platform/SetupPage.tsx`**

```tsx
export default function SetupPage() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <p className="text-[var(--muted)]">Setup — coming soon</p>
    </div>
  );
}
```

- [ ] **Step 3: Add `/room/setup` route to `src/App.tsx`**

Add this import after the LobbyPage import:
```tsx
import SetupPage from "./pages/platform/SetupPage";
```

Add this route inside `<Routes>`, before the `/room/:code` route:
```tsx
<Route path="/room/setup" element={<SetupPage />} />
```

The final routes block in `AnimatedRoutes` should have:
```tsx
<Route path="/room/setup" element={<SetupPage />} />
<Route path="/room/:code" element={<LobbyPage />} />
```

- [ ] **Step 4: TypeScript check**

```bash
cd /Users/neil/Documents/派对游戏
npx tsc --noEmit 2>&1 | head -40
```

Expected: zero errors.

- [ ] **Step 5: Commit**

```bash
cd /Users/neil/Documents/派对游戏
git add src/components/ui/Icon.tsx src/pages/platform/SetupPage.tsx src/App.tsx
git commit -m "feat: add game/music/copy icons and /room/setup route"
```

---

## Task 3: AccountMenu component + NavBar update

**Files:**
- Create: `src/components/platform/AccountMenu.tsx`
- Modify: `src/components/platform/NavBar.tsx`

### Context
The NavBar currently shows a plain `displayName` span for signed-in hosts. We need to replace it with a `AccountMenu` component that shows:
- A "Host chip" button (trigger): icon + "Host" label + host name
- On hover/focus-within: a popover with account stats and action rows

From `public/platform/styles.css`:
- `.account-menu` has `position: relative`
- `.account-popover` is `width: 310px; position: absolute; top: calc(100% + 8px); right: 0; background: rgba(17,24,33,.98); border: 1px solid rgba(255,255,255,.12); border-radius: 8px; padding: 8px; box-shadow: var(--shadow)` — visible on `.account-menu:hover .account-popover, .account-menu:focus-within .account-popover`
- `.account-head` has `padding: 12px 14px 8px; border-bottom: 1px solid rgba(255,255,255,.08)`
- `.account-stats` is `display: grid; grid-template-columns: repeat(3, 1fr); padding: 12px 14px; border-bottom: 1px solid rgba(255,255,255,.08)` — each child div has `display: flex; flex-direction: column; gap: 4px` with `span` (label, muted, 11px) and `strong` (value, 18px font-weight 800)
- `.menu-row` is `display: flex; align-items: center; gap: 10px; width: 100%; min-height: 46px; padding: 0 14px; border-radius: 6px; font-weight: 700; font-size: 14px` — hover has subtle bg
- `.danger` / `.menu-row.danger` has `color: #f67272`
- `.host-chip` is the trigger button: `display: inline-flex; align-items: center; gap: 8px; padding: 0 14px; height: 40px; border-radius: 6px; border: 1px solid rgba(255,255,255,.12); background: rgba(17,24,33,.9); font-size: 14px` with `span` (muted "Host") and `strong` (display name)

The `remainingTime()` logic from app.js:
```js
function remainingTime(entitlement) {
  const expiresAt = entitlement?.expiresAt;
  if (!expiresAt || expiresAt <= Date.now()) return "--";
  const minutes = Math.max(0, Math.ceil((expiresAt - Date.now()) / 60_000));
  if (minutes >= 60) return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
  return `${minutes}m`;
}
```

- [ ] **Step 1: Create `src/components/platform/AccountMenu.tsx`**

```tsx
import Icon from "../ui/Icon";
import { useAuthStore } from "../../stores/authStore";
import { useRoomStore } from "../../stores/roomStore";

function remainingTime(expiresAt?: number): string {
  if (!expiresAt || expiresAt <= Date.now()) return "--";
  const minutes = Math.max(0, Math.ceil((expiresAt - Date.now()) / 60_000));
  if (minutes >= 60) return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
  return `${minutes}m`;
}

export default function AccountMenu() {
  const account = useAuthStore((s) => s.account);
  const entitlement = useAuthStore((s) => s.entitlement);
  const clearAccount = useAuthStore((s) => s.clearAccount);
  const clearRoom = useRoomStore((s) => s.clearRoom);
  const room = useRoomStore((s) => s.room);

  if (!account) return null;

  const timeLeft = remainingTime(entitlement.timePassExpiresAt);

  function handleLogout() {
    clearAccount();
    clearRoom();
    window.location.href = "/";
  }

  return (
    <div
      className={[
        "relative",
        "[&:hover_.account-popover]:opacity-100 [&:hover_.account-popover]:pointer-events-auto [&:hover_.account-popover]:translate-y-0",
        "[&:focus-within_.account-popover]:opacity-100 [&:focus-within_.account-popover]:pointer-events-auto [&:focus-within_.account-popover]:translate-y-0",
      ].join(" ")}
    >
      {/* Trigger chip */}
      <button
        className={[
          "host-chip inline-flex items-center gap-[8px] h-[40px] px-[14px]",
          "rounded-[6px] border border-white/[.12] bg-[rgba(17,24,33,.9)]",
          "text-[14px] cursor-pointer",
        ].join(" ")}
        type="button"
        aria-haspopup="true"
      >
        <Icon name="users" />
        <span className="text-[var(--muted)]">Host</span>
        <strong className="text-[var(--ink)]">{account.displayName}</strong>
      </button>

      {/* Popover */}
      <div
        className={[
          "account-popover absolute top-[calc(100%+8px)] right-0 z-50",
          "w-[310px] rounded-[8px] border border-white/[.12] bg-[rgba(17,24,33,.98)]",
          "p-[8px] [box-shadow:var(--shadow)]",
          "opacity-0 pointer-events-none translate-y-[-4px]",
          "transition-[opacity,transform] duration-[180ms]",
        ].join(" ")}
      >
        {/* Head */}
        <div className="px-[14px] pt-[12px] pb-[8px] border-b border-white/[.08]">
          <strong className="block text-[var(--ink)] text-[16px] font-[800]">
            {account.displayName}
          </strong>
          <span className="text-[var(--muted)] text-[13px]">{account.email}</span>
        </div>

        {/* Stats */}
        <div className="grid [grid-template-columns:repeat(3,1fr)] px-[14px] py-[12px] border-b border-white/[.08]">
          {[
            { label: "Points", value: String(entitlement.points) },
            { label: "Time", value: timeLeft },
            { label: "Balance", value: "–" },
          ].map(({ label, value }) => (
            <div key={label} className="flex flex-col gap-[4px]">
              <span className="text-[var(--muted)] text-[11px] font-[700] tracking-[.06em] uppercase">
                {label}
              </span>
              <strong className="text-[var(--ink)] text-[18px] font-[800]">
                {value}
              </strong>
            </div>
          ))}
        </div>

        {/* Menu rows */}
        <button
          className={[
            "flex items-center gap-[10px] w-full min-h-[46px] px-[14px]",
            "rounded-[6px] text-[var(--ink)] text-[14px] font-[700]",
            "border-0 bg-transparent cursor-pointer hover:bg-white/[.06] transition-colors",
          ].join(" ")}
          type="button"
        >
          <Icon name="settings" />
          <span>User settings</span>
        </button>

        {room && (
          <button
            className={[
              "flex items-center gap-[10px] w-full min-h-[46px] px-[14px]",
              "rounded-[6px] text-[var(--ink)] text-[14px] font-[700]",
              "border-0 bg-transparent cursor-pointer hover:bg-white/[.06] transition-colors",
            ].join(" ")}
            type="button"
          >
            <Icon name="door" />
            <span>Room {room.code} · {room.status}</span>
          </button>
        )}

        <button
          className={[
            "flex items-center gap-[10px] w-full min-h-[46px] px-[14px]",
            "rounded-[6px] text-[#f67272] text-[14px] font-[700]",
            "border-0 bg-transparent cursor-pointer hover:bg-white/[.06] transition-colors",
          ].join(" ")}
          type="button"
          onClick={handleLogout}
        >
          <Icon name="logout" />
          <span>Log out</span>
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Update `src/components/platform/NavBar.tsx`**

Read the current NavBar file and make these changes:
1. Add import: `import AccountMenu from "./AccountMenu";`
2. In the "signed in" branch of the right-side actions, replace the current `<span>{account.displayName}</span>` (or whatever the current signed-in view renders) with `<AccountMenu />`.

The signed-in branch should look like:
```tsx
{isSignedIn ? (
  <>
    {onPlay && (
      <Button variant="secondary" onClick={onPlay}>
        <Icon name="play" />
        <span>Play</span>
      </Button>
    )}
    <AccountMenu />
  </>
) : (
  /* ... sign-in button ... */
)}
```

Read the current NavBar first to find the exact sign-in branch and replace only that part.

- [ ] **Step 3: TypeScript check**

```bash
cd /Users/neil/Documents/派对游戏
npx tsc --noEmit 2>&1 | head -40
```

Expected: zero errors.

- [ ] **Step 4: Commit**

```bash
cd /Users/neil/Documents/派对游戏
git add src/components/platform/AccountMenu.tsx src/components/platform/NavBar.tsx
git commit -m "feat(platform): add AccountMenu component with host chip + popover"
```

---

## Task 4: GamePickerModal component

**Files:**
- Create: `src/components/platform/GamePickerModal.tsx`

### Context
The game picker modal shows all games in a 2-column grid. Each card has a game art div, title, player count, mood, status, and a "Select" button. The modal has a close button and a backdrop that closes on click. From `public/platform/styles.css`:

- `.game-picker`: `width: min(1120px, 94vw); max-height: min(840px, 90vh); overflow-y: auto; padding: 28px; border-radius: 12px; border: 1px solid rgba(255,255,255,.1); background: rgba(17,24,33,.98); box-shadow: var(--shadow)`
- `.picker-grid` (= `.store-grid`): `display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px`
- The select button uses `"btn-selected"` border when the game is the currently selected one.

- [ ] **Step 1: Create `src/components/platform/GamePickerModal.tsx`**

```tsx
import { AnimatePresence, motion } from "framer-motion";
import Tag from "../ui/Tag";
import Button from "../ui/Button";
import Icon from "../ui/Icon";
import type { GameConfig } from "../../types/config";

interface GamePickerModalProps {
  open: boolean;
  games: GameConfig[];
  selectedGameId: string | null;
  onSelect: (gameId: string) => void;
  onClose: () => void;
}

export default function GamePickerModal({
  open,
  games,
  selectedGameId,
  onSelect,
  onClose,
}: GamePickerModalProps) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/[.72] backdrop-blur-[4px]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onClick={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
        >
          <motion.section
            className={[
              "relative w-[min(1120px,94vw)] max-h-[min(840px,90vh)] overflow-y-auto",
              "rounded-[12px] border border-white/[.1] bg-[rgba(17,24,33,.98)] p-[28px]",
              "[box-shadow:var(--shadow)]",
            ].join(" ")}
            initial={{ opacity: 0, y: -12, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ duration: 0.18 }}
          >
            {/* Close button */}
            <button
              className={[
                "absolute top-[14px] right-[14px] w-[36px] h-[36px] grid place-items-center",
                "rounded-[6px] border border-white/[.1] bg-[rgba(17,24,33,.9)]",
                "text-[var(--muted)] cursor-pointer hover:text-[var(--ink)] transition-colors",
              ].join(" ")}
              type="button"
              onClick={onClose}
              aria-label="Close"
            >
              ✕
            </button>

            <div className="mb-[24px]">
              <h2 className="text-[22px] font-[800] text-[var(--ink)] m-0 mb-[4px]">
                Choose Game
              </h2>
              <p className="text-[var(--muted)] text-[14px] m-0">
                Pick one for this room.
              </p>
            </div>

            <div className="grid [grid-template-columns:repeat(2,1fr)] gap-[16px]">
              {games.map((game) => {
                const playable = game.status === "playable";
                const isSelected = game.id === selectedGameId;
                return (
                  <article
                    key={game.id}
                    className={[
                      "overflow-hidden rounded-[8px] border bg-[rgba(17,24,33,.92)]",
                      isSelected
                        ? "border-[rgba(120,212,94,.7)] [box-shadow:0_0_0_2px_rgba(120,212,94,.18),var(--shadow)]"
                        : "border-white/[.12]",
                    ].join(" ")}
                  >
                    <div className={`game-art game-art-${game.id}`}>
                      <Tag>{game.genre}</Tag>
                    </div>
                    <div className="p-[14px] grid gap-[12px]">
                      <div>
                        <h3 className="text-[18px] font-[800] text-[var(--ink)] m-0">
                          {game.title}
                        </h3>
                        <p className="text-[var(--muted)] text-[13px] mt-[6px] mb-0 leading-[1.4]">
                          {game.description}
                        </p>
                      </div>
                      <div className="flex gap-[8px] flex-wrap text-[var(--muted)] text-[12px]">
                        <span>{game.players}</span>
                        <span>{game.mood}</span>
                        <span>{playable ? "Playable" : "Coming soon"}</span>
                      </div>
                      <Button
                        variant={isSelected ? "primary" : "secondary"}
                        disabled={!playable}
                        onClick={() => {
                          if (playable) onSelect(game.id);
                        }}
                        className="w-full"
                      >
                        {isSelected ? (
                          <>
                            <Icon name="check" />
                            <span>Selected</span>
                          </>
                        ) : playable ? (
                          <>
                            <Icon name="check" />
                            <span>Select</span>
                          </>
                        ) : (
                          <>
                            <Icon name="star" />
                            <span>Coming soon</span>
                          </>
                        )}
                      </Button>
                    </div>
                  </article>
                );
              })}
            </div>
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>
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
git add src/components/platform/GamePickerModal.tsx
git commit -m "feat(platform): add GamePickerModal component"
```

---

## Task 5: PaymentModal component

**Files:**
- Create: `src/components/platform/PaymentModal.tsx`

### Context
The payment modal has 3 tabs: Time pass, Use points, Buy points. Based on selected tab, different options are shown. The CTA creates a room via `POST /api/rooms`. After room creation the caller receives the room and navigates to `/room/:code`.

Payment constants (copy exactly):
```ts
const PASSES = [
  { minutes: 60, label: "1 hr", price: "29 kr" },
  { minutes: 120, label: "2 hrs", price: "39 kr" },
  { minutes: 240, label: "4 hrs", price: "59 kr" },
];
const CREDIT_PACKS = [
  { credits: 20, price: "29 kr" },
  { credits: 50, price: "59 kr" },
  { credits: 120, price: "99 kr" },
];
```

From `public/platform/styles.css`:
- `.payment-card`: `width: min(780px, 94vw); max-height: min(760px, 90vh); padding: 28px`
- `.payment-tabs`: `display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin: 18px 0`
- `.payment-tab`: `display: flex; align-items: center; justify-content: center; gap: 8px; min-height: 52px; border-radius: 8px; border: 1px solid rgba(255,255,255,.12); background: rgba(23,29,37,.74); font-weight: 800; font-size: 14px`
- `.payment-tab.active`: `border-color: rgba(120,212,94,.7)`
- `.payment-summary-strip`: `display: grid; grid-template-columns: repeat(3, 1fr); padding: 12px 14px; border-radius: 8px; background: rgba(23,29,37,.74); border: 1px solid rgba(255,255,255,.08); margin: 14px 0` — each child like account stats
- `.price-grid.payment-options`: `display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin: 14px 0`
- `.price-card`: `display: flex; flex-direction: column; align-items: center; gap: 6px; min-height: 90px; padding: 14px; border-radius: 8px; border: 1px solid rgba(255,255,255,.12); background: rgba(23,29,37,.74); font-size: 14px`
- `.price-card.active`: `border-color: rgba(120,212,94,.7)`
- `.points-panel`: `display: grid; grid-template-columns: repeat(3, 1fr); padding: 14px; border-radius: 8px; background: rgba(23,29,37,.74); border: 1px solid rgba(255,255,255,.08); margin: 14px 0`

- [ ] **Step 1: Create `src/components/platform/PaymentModal.tsx`**

```tsx
import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Icon from "../ui/Icon";
import Button from "../ui/Button";
import { useAuthStore } from "../../stores/authStore";
import { useRoomStore } from "../../stores/roomStore";
import type { GameConfig } from "../../types/config";
import type { Room } from "../../types/room";

const PASSES = [
  { minutes: 60, label: "1 hr", price: "29 kr" },
  { minutes: 120, label: "2 hrs", price: "39 kr" },
  { minutes: 240, label: "4 hrs", price: "59 kr" },
] as const;

const CREDIT_PACKS = [
  { credits: 20, price: "29 kr" },
  { credits: 50, price: "59 kr" },
  { credits: 120, price: "99 kr" },
] as const;

type PaymentMode = "time" | "useCredits" | "buyCredits";

interface PaymentModalProps {
  open: boolean;
  game: GameConfig | null;
  onClose: () => void;
  onRoomCreated: (room: Room) => void;
}

export default function PaymentModal({
  open,
  game,
  onClose,
  onRoomCreated,
}: PaymentModalProps) {
  const account = useAuthStore((s) => s.account);
  const entitlement = useAuthStore((s) => s.entitlement);
  const setEntitlement = useAuthStore((s) => s.setEntitlement);
  const setRoom = useRoomStore((s) => s.setRoom);

  const [mode, setMode] = useState<PaymentMode>("time");
  const [selectedMinutes, setSelectedMinutes] = useState(60);
  const [selectedCredits, setSelectedCredits] = useState(20);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  if (!game || !account) return null;

  const availablePoints = entitlement.points;
  const canUsePoints = availablePoints >= (game.credits ?? Infinity);

  const pass = PASSES.find((p) => p.minutes === selectedMinutes) ?? PASSES[0];
  const creditPack =
    CREDIT_PACKS.find((p) => p.credits === selectedCredits) ?? CREDIT_PACKS[0];

  const ctaLabel =
    mode === "time"
      ? `Pay ${pass.price} · Create room`
      : mode === "useCredits"
      ? "Use points · Create room"
      : `Buy ${creditPack.credits} points · Create room`;

  const ctaDisabled = (mode === "useCredits" && !canUsePoints) || creating;

  async function handleCreate() {
    if (!account || !game) return;
    setCreating(true);
    setError("");
    try {
      const body: Record<string, unknown> = {
        hostName: account.displayName,
        email: account.email,
        gameId: game.id,
        paymentMode: mode,
      };
      if (mode === "time") body.minutes = selectedMinutes;
      if (mode === "buyCredits") body.credits = selectedCredits;

      const res = await fetch("/api/rooms", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error ?? "Failed to create room");
      }
      const data = (await res.json()) as { room: Room; entitlement?: typeof entitlement };
      setRoom(data.room);
      if (data.entitlement) setEntitlement(data.entitlement);
      onRoomCreated(data.room);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setCreating(false);
    }
  }

  const tabClass = (active: boolean) =>
    [
      "flex items-center justify-center gap-[8px] min-h-[52px] rounded-[8px]",
      "border font-[800] text-[14px] cursor-pointer transition-colors",
      active
        ? "border-[rgba(120,212,94,.7)] text-[var(--ink)] bg-[rgba(23,29,37,.74)]"
        : "border-white/[.12] text-[var(--muted)] bg-[rgba(23,29,37,.74)] hover:text-[var(--ink)]",
    ].join(" ");

  const priceCardClass = (active: boolean) =>
    [
      "flex flex-col items-center gap-[6px] min-h-[90px] p-[14px] rounded-[8px]",
      "border cursor-pointer transition-colors text-[14px]",
      active
        ? "border-[rgba(120,212,94,.7)] text-[var(--ink)] bg-[rgba(23,29,37,.74)]"
        : "border-white/[.12] text-[var(--muted)] bg-[rgba(23,29,37,.74)] hover:text-[var(--ink)]",
    ].join(" ");

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/[.72] backdrop-blur-[4px]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onClick={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
        >
          <motion.section
            className={[
              "relative w-[min(780px,94vw)] max-h-[min(760px,90vh)] overflow-y-auto",
              "rounded-[12px] border border-white/[.1] bg-[rgba(17,24,33,.98)] p-[28px]",
              "[box-shadow:var(--shadow)]",
            ].join(" ")}
            initial={{ opacity: 0, y: -12, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ duration: 0.18 }}
          >
            {/* Close */}
            <button
              className={[
                "absolute top-[14px] right-[14px] w-[36px] h-[36px] grid place-items-center",
                "rounded-[6px] border border-white/[.1] bg-[rgba(17,24,33,.9)]",
                "text-[var(--muted)] cursor-pointer hover:text-[var(--ink)] transition-colors",
              ].join(" ")}
              type="button"
              onClick={onClose}
              aria-label="Close"
            >
              ✕
            </button>

            <h2 className="text-[22px] font-[800] text-[var(--ink)] m-0 mb-[4px]">
              Payment
            </h2>
            <p className="text-[var(--muted)] text-[14px] m-0 mb-[2px]">
              {game.title} · {game.players} players
            </p>

            {/* Summary strip */}
            <div className="grid [grid-template-columns:repeat(3,1fr)] px-[14px] py-[12px] rounded-[8px] bg-[rgba(23,29,37,.74)] border border-white/[.08] my-[14px]">
              {[
                { label: "Game", value: game.title },
                { label: "Points", value: String(availablePoints) },
                { label: "Time left", value: "--" },
              ].map(({ label, value }) => (
                <div key={label} className="flex flex-col gap-[4px]">
                  <span className="text-[var(--muted)] text-[11px] font-[700] tracking-[.06em] uppercase">
                    {label}
                  </span>
                  <strong className="text-[var(--ink)] text-[16px] font-[800]">
                    {value}
                  </strong>
                </div>
              ))}
            </div>

            {/* Tabs */}
            <div className="grid [grid-template-columns:repeat(3,1fr)] gap-[10px] my-[18px]">
              <button
                className={tabClass(mode === "time")}
                type="button"
                onClick={() => setMode("time")}
              >
                <Icon name="card" />
                Time pass
              </button>
              <button
                className={tabClass(mode === "useCredits")}
                type="button"
                onClick={() => setMode("useCredits")}
              >
                <Icon name="coins" />
                Use points
              </button>
              <button
                className={tabClass(mode === "buyCredits")}
                type="button"
                onClick={() => setMode("buyCredits")}
              >
                <Icon name="coins" />
                Buy points
              </button>
            </div>

            {/* Time pass options */}
            {mode === "time" && (
              <div className="grid [grid-template-columns:repeat(3,1fr)] gap-[10px] my-[14px]">
                {PASSES.map((item) => (
                  <button
                    key={item.minutes}
                    className={priceCardClass(item.minutes === selectedMinutes)}
                    type="button"
                    onClick={() => setSelectedMinutes(item.minutes)}
                  >
                    <Icon name="card" />
                    <strong>{item.label}</strong>
                    <span>{item.price}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Use points */}
            {mode === "useCredits" && (
              <div className="grid [grid-template-columns:repeat(3,1fr)] px-[14px] py-[14px] rounded-[8px] bg-[rgba(23,29,37,.74)] border border-white/[.08] my-[14px]">
                {[
                  { label: "Current points", value: String(availablePoints) },
                  { label: "This game costs", value: String(game.credits ?? "?") },
                  {
                    label: "After purchase",
                    value: String(Math.max(0, availablePoints - (game.credits ?? 0))),
                  },
                ].map(({ label, value }) => (
                  <div key={label} className="flex flex-col gap-[4px]">
                    <span className="text-[var(--muted)] text-[11px] font-[700] tracking-[.06em] uppercase">
                      {label}
                    </span>
                    <strong className="text-[var(--ink)] text-[18px] font-[800]">
                      {value}
                    </strong>
                  </div>
                ))}
              </div>
            )}
            {mode === "useCredits" && !canUsePoints && (
              <p className="text-[#f67272] text-[14px] mt-[4px]">
                Not enough points for this game.
              </p>
            )}

            {/* Buy credits */}
            {mode === "buyCredits" && (
              <div className="grid [grid-template-columns:repeat(3,1fr)] gap-[10px] my-[14px]">
                {CREDIT_PACKS.map((item) => (
                  <button
                    key={item.credits}
                    className={priceCardClass(item.credits === selectedCredits)}
                    type="button"
                    onClick={() => setSelectedCredits(item.credits)}
                  >
                    <Icon name="coins" />
                    <strong>{item.credits}</strong>
                    <span>{item.price}</span>
                  </button>
                ))}
              </div>
            )}

            {error && (
              <p className="text-[#f67272] text-[14px] mt-[8px]">{error}</p>
            )}

            <Button
              variant="primary"
              className="w-full mt-[8px]"
              disabled={ctaDisabled}
              onClick={handleCreate}
            >
              <Icon name={mode === "time" ? "card" : "coins"} />
              <span>{creating ? "Creating…" : ctaLabel}</span>
            </Button>
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>
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
git add src/components/platform/PaymentModal.tsx
git commit -m "feat(platform): add PaymentModal with 3-tab payment flow and create room"
```

---

## Task 6: SetupPage full implementation

**Files:**
- Modify: `src/pages/platform/SetupPage.tsx`

### Context
The SetupPage at `/room/setup` shows:
1. NavBar (with AccountMenu shown to signed-in hosts)
2. A full-screen centered setup area (`.setup-page`, `.setup-main`)
3. A "selected-game-card" button that opens the game picker
4. A setup summary (2 bullet-point lines)
5. A "Payment · Create room" or "Create room with active pass" CTA button

After successful room creation (via PaymentModal), navigate to `/room/:code`.

If not signed in, redirect to `/` (auth must have happened on HomePage before getting here).

From `public/platform/styles.css`:
- `.setup-page`: `min-height: calc(100vh - 64px); display: grid; place-items: center; padding: 34px`
- `.setup-main`: `width: min(980px, 100%); display: grid; gap: 24px`
- `.section-title`: `display: flex; align-items: flex-start; justify-content: space-between; gap: 20px; margin-bottom: 20px`
- `.selected-game-card`: `display: grid; grid-template-columns: 340px 1fr; min-height: 230px; padding: 18px; gap: 18px; border-radius: 8px; border: 1px solid rgba(255,255,255,.12); background: rgba(17,24,33,.92); box-shadow: var(--shadow); cursor: pointer; text-align: left; width: 100%`
- `.button-kicker`: `display: flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 950; letter-spacing: .08em; text-transform: uppercase; color: var(--green); margin-bottom: 8px`
- `.setup-summary`: `display: grid; gap: 10px; padding: 14px; border-radius: 8px; background: rgba(23,29,37,.6); border: 1px solid rgba(255,255,255,.07)` — each child: `display: flex; align-items: center; gap: 10px; font-size: 14px; color: var(--muted)`
- `.pay-create`: this is just the CTA primary button, width: 100%; min-height: 52px

- [ ] **Step 1: Replace `src/pages/platform/SetupPage.tsx`**

```tsx
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import NavBar from "../../components/platform/NavBar";
import GamePickerModal from "../../components/platform/GamePickerModal";
import PaymentModal from "../../components/platform/PaymentModal";
import Button from "../../components/ui/Button";
import Icon from "../../components/ui/Icon";
import Tag from "../../components/ui/Tag";
import { useConfig } from "../../hooks/useConfig";
import { useAuthStore } from "../../stores/authStore";
import type { Room } from "../../types/room";
import type { GameConfig } from "../../types/config";

export default function SetupPage() {
  const navigate = useNavigate();
  const { config } = useConfig();
  const isSignedIn = useAuthStore((s) => s.isSignedIn);

  const [selectedGame, setSelectedGame] = useState<GameConfig | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);

  // Default to first playable game
  useEffect(() => {
    if (!selectedGame && config.games.length > 0) {
      const first = config.games.find((g) => g.status === "playable") ?? config.games[0];
      setSelectedGame(first);
    }
  }, [config.games, selectedGame]);

  // Redirect unauthenticated users
  useEffect(() => {
    if (!isSignedIn) {
      navigate("/", { replace: true });
    }
  }, [isSignedIn, navigate]);

  function handleRoomCreated(room: Room) {
    navigate(`/room/${room.code}`);
  }

  function handleSelectGame(gameId: string) {
    const game = config.games.find((g) => g.id === gameId) ?? null;
    setSelectedGame(game);
    setPickerOpen(false);
  }

  if (!isSignedIn) return null;

  return (
    <motion.div
      className="min-h-screen pt-[64px]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.22 }}
    >
      <NavBar floating={false} />

      {/* Setup area */}
      <section
        className="grid place-items-center p-[34px]"
        style={{ minHeight: "calc(100vh - 64px)" }}
      >
        <div className="w-[min(980px,100%)] grid gap-[24px]">
          <div className="flex items-start justify-between gap-[20px] mb-[4px]">
            <div>
              <h2 className="m-0 text-[24px] font-[800] text-[var(--ink)]">
                Set Up Room
              </h2>
              <p className="text-[var(--muted)] text-[14px] mt-[6px] mb-0">
                Choose a game, then open a 2–8 player room.
              </p>
            </div>
          </div>

          {/* Selected game card */}
          <button
            className={[
              "grid [grid-template-columns:340px_1fr] min-h-[230px] p-[18px] gap-[18px]",
              "rounded-[8px] border border-white/[.12] bg-[rgba(17,24,33,.92)] [box-shadow:var(--shadow)]",
              "cursor-pointer text-left w-full",
              "hover:border-white/[.2] transition-colors",
            ].join(" ")}
            type="button"
            onClick={() => setPickerOpen(true)}
          >
            <div
              className={`game-art rounded-[6px] ${selectedGame ? `game-art-${selectedGame.id}` : ""}`}
            />
            <div className="flex flex-col justify-center gap-[10px]">
              <span className="flex items-center gap-[6px] text-[11px] font-[950] tracking-[.08em] uppercase text-[var(--green)]">
                <Icon name="game" />
                Choose game
              </span>
              {selectedGame && (
                <>
                  <Tag>{selectedGame.genre}</Tag>
                  <h3 className="m-0 text-[22px] font-[800] text-[var(--ink)]">
                    {selectedGame.title}
                  </h3>
                  <p className="text-[var(--muted)] text-[14px] m-0">
                    {selectedGame.players} players · {selectedGame.mood}
                  </p>
                </>
              )}
              {!selectedGame && (
                <p className="text-[var(--muted)] text-[14px] m-0">
                  Tap to choose a game
                </p>
              )}
            </div>
          </button>

          {/* Setup summary */}
          <div className="grid gap-[10px] p-[14px] rounded-[8px] bg-[rgba(23,29,37,.6)] border border-white/[.07]">
            <div className="flex items-center gap-[10px] text-[14px] text-[var(--muted)]">
              <Icon name="users" />
              <span>Players choose their characters on their phones.</span>
            </div>
            <div className="flex items-center gap-[10px] text-[14px] text-[var(--muted)]">
              <Icon name="music" />
              <span>Bright stage colors are ready for an upbeat music loop.</span>
            </div>
          </div>

          {/* CTA */}
          <Button
            variant="primary"
            className="w-full min-h-[52px] text-[16px]"
            disabled={!selectedGame || selectedGame.status !== "playable"}
            onClick={() => setPaymentOpen(true)}
          >
            <Icon name="card" />
            <span>Payment · Create room</span>
          </Button>
        </div>
      </section>

      {/* Modals */}
      <GamePickerModal
        open={pickerOpen}
        games={config.games}
        selectedGameId={selectedGame?.id ?? null}
        onSelect={handleSelectGame}
        onClose={() => setPickerOpen(false)}
      />
      <PaymentModal
        open={paymentOpen}
        game={selectedGame}
        onClose={() => setPaymentOpen(false)}
        onRoomCreated={handleRoomCreated}
      />
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
git add src/pages/platform/SetupPage.tsx
git commit -m "feat(platform): implement SetupPage with game picker and payment flow"
```

---

## Task 7: PlayerBubble + PlayerStage components

**Files:**
- Create: `src/components/platform/PlayerBubble.tsx`
- Create: `src/components/platform/PlayerStage.tsx`

### Context
The stage area shows:
1. Stage floor section (`.stage-floor`) with a gradient background, grid lines, and radial green glow
2. Two animated spotlight beams (`.stage-light.one` and `.stage-light.two`)
3. A ring area (`.stage-ring`) containing player bubbles or an empty-state card

Player bubbles (`.player-bubble`):
- 168×172px card, centered content
- Shows avatar placeholder (colored ring), nickname, and status text
- Three states: pending (orange ring, "Getting ready"), ready (green ring, "Ready"), disconnected (gray, "Disconnected")

Avatar placeholder: simple colored div with initials for now (we don't have the avatar catalog in React yet)

From `public/platform/styles.css`:
- `.stage-floor`: `position: relative; overflow: hidden; min-height: 560px; border-radius: 10px; background: linear-gradient(180deg, #0a1520 0%, #081018 100%); border: 1px solid rgba(255,255,255,.07); display: flex; flex-direction: column; padding: 24px`
- The stage floor also has pseudo-elements for grid lines — replicate with a CSS class in globals.css or with inline styles
- `.stage-ring`: `width: min(820px, 92%); min-height: 360px; display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 18px; margin: auto; z-index: 2`
- `.stage-light.one/.two`: `position: absolute; width: 360px; height: 600px; opacity: .14; transform-origin: top center` with keyframe sweep animation — use CSS in globals.css
- `.player-bubble`: `width: 168px; min-height: 172px; display: grid; place-items: center; gap: 8px; padding: 18px; border-radius: 10px; border: 1px solid rgba(255,255,255,.12); background: rgba(17,24,33,.9); text-align: center; font-size: 13px`
- `.player-bubble.ready`: `border-color: rgba(120,212,94,.4)`
- `.player-bubble.disconnected`: `opacity: .6`
- `.empty-stage`: `display: flex; flex-direction: column; align-items: center; gap: 8px; text-align: center; color: var(--muted)`

The stage CSS animations need to be added to `src/styles/globals.css`:
```css
.stage-floor {
  position: relative;
  overflow: hidden;
  min-height: 560px;
  border-radius: 10px;
  background: linear-gradient(180deg, #0a1520 0%, #081018 100%);
  border: 1px solid rgba(255,255,255,.07);
  display: flex;
  flex-direction: column;
  padding: 24px;
}

.stage-floor::before {
  content: '';
  position: absolute;
  inset: 0;
  background-image: linear-gradient(rgba(255,255,255,.03) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255,255,255,.03) 1px, transparent 1px);
  background-size: 40px 40px;
  pointer-events: none;
}

.stage-floor::after {
  content: '';
  position: absolute;
  bottom: -60px;
  left: 50%;
  transform: translateX(-50%);
  width: 600px;
  height: 300px;
  background: radial-gradient(ellipse, rgba(120,212,94,.12) 0%, transparent 70%);
  pointer-events: none;
}

.stage-light {
  position: absolute;
  width: 360px;
  height: 600px;
  opacity: .14;
  transform-origin: top center;
  background: linear-gradient(180deg, rgba(255,255,255,.6) 0%, transparent 100%);
  clip-path: polygon(40% 0%, 60% 0%, 100% 100%, 0% 100%);
}

.stage-light.one {
  top: -80px;
  left: -60px;
  animation: sweep-one 8s ease-in-out infinite;
}

.stage-light.two {
  top: -80px;
  right: -60px;
  animation: sweep-two 9s ease-in-out infinite 1.5s;
}

@keyframes sweep-one {
  0%, 100% { transform: rotate(-15deg); }
  50% { transform: rotate(15deg); }
}

@keyframes sweep-two {
  0%, 100% { transform: rotate(15deg); }
  50% { transform: rotate(-15deg); }
}
```

- [ ] **Step 1: Add stage CSS to `src/styles/globals.css`**

Append the CSS block above to the end of `src/styles/globals.css`.

- [ ] **Step 2: Create `src/components/platform/PlayerBubble.tsx`**

```tsx
import type { Player } from "../../types/room";

interface PlayerBubbleProps {
  player: Player;
}

function getInitials(nickname: string): string {
  return nickname.slice(0, 2).toUpperCase();
}

export default function PlayerBubble({ player }: PlayerBubbleProps) {
  const state = player.online === false ? "disconnected" : player.ready ? "ready" : "pending";
  const ringColor =
    state === "disconnected" ? "#8f99a6" : state === "ready" ? "#78d45e" : "#f4b04a";
  const statusText =
    state === "disconnected"
      ? "Disconnected"
      : state === "ready"
      ? "Ready"
      : "Getting ready";

  return (
    <article
      className={[
        "w-[168px] min-h-[172px] grid place-items-center gap-[8px] p-[18px]",
        "rounded-[10px] border bg-[rgba(17,24,33,.9)] text-center text-[13px]",
        state === "ready"
          ? "border-[rgba(120,212,94,.4)]"
          : state === "disconnected"
          ? "border-white/[.12] opacity-[.6]"
          : "border-white/[.12]",
      ].join(" ")}
    >
      {/* Avatar placeholder — colored ring with initials */}
      <div
        className="w-[64px] h-[64px] rounded-full flex items-center justify-center text-[20px] font-[800] text-white"
        style={{
          background: `radial-gradient(circle, rgba(17,24,33,.9), rgba(17,24,33,.9))`,
          boxShadow: `0 0 0 3px ${ringColor}, 0 0 12px ${ringColor}66`,
        }}
      >
        {getInitials(player.nickname)}
      </div>
      <strong className="text-[var(--ink)] text-[14px] font-[800] leading-[1.2]">
        {player.nickname}
      </strong>
      <span
        className="text-[12px] font-[600]"
        style={{ color: ringColor }}
      >
        {statusText}
      </span>
    </article>
  );
}
```

- [ ] **Step 3: Create `src/components/platform/PlayerStage.tsx`**

```tsx
import PlayerBubble from "./PlayerBubble";
import type { Player } from "../../types/room";

interface PlayerStageProps {
  players: Player[];
  minPlayers: number;
  maxPlayers: number;
}

export default function PlayerStage({ players, minPlayers, maxPlayers }: PlayerStageProps) {
  return (
    <section className="stage-floor">
      <div className="stage-light one" aria-hidden="true" />
      <div className="stage-light two" aria-hidden="true" />
      <div
        className={[
          "stage-ring flex flex-wrap items-center justify-center gap-[18px]",
          "w-[min(820px,92%)] min-h-[360px] mx-auto z-[2] relative",
        ].join(" ")}
      >
        {players.length > 0 ? (
          players.map((player) => (
            <PlayerBubble key={player.id} player={player} />
          ))
        ) : (
          <div className="flex flex-col items-center gap-[8px] text-center text-[var(--muted)]">
            <strong className="text-[var(--ink)] text-[18px]">Scan to join</strong>
            <span className="text-[14px]">
              {minPlayers}–{maxPlayers} players
            </span>
          </div>
        )}
      </div>
    </section>
  );
}
```

- [ ] **Step 4: TypeScript check**

```bash
cd /Users/neil/Documents/派对游戏
npx tsc --noEmit 2>&1 | head -40
```

Expected: zero errors.

- [ ] **Step 5: Commit**

```bash
cd /Users/neil/Documents/派对游戏
git add src/styles/globals.css src/components/platform/PlayerBubble.tsx src/components/platform/PlayerStage.tsx
git commit -m "feat(platform): add PlayerBubble and PlayerStage with spotlight animations"
```

---

## Task 8: LobbyControls component

**Files:**
- Create: `src/components/platform/LobbyControls.tsx`

### Context
The lobby controls bar shows (right-aligned flex row):
- "Change game" button (opens game picker) — always shown
- "Add tester" button — calls `POST /api/rooms/:code/test-players`
- "Close" danger button — calls `POST /api/rooms/:code/close`  
- "Launch" / "Force start" / "Need X players" button — primary, disabled when not enough players

Launch logic from `lobbyViewModel()`:
- `canStart = onlinePlayers >= minPlayers && onlinePlayers <= maxPlayers`
- `canForceStart = totalPlayers >= minPlayers && totalPlayers <= maxPlayers`
- `allReady = canStart && readyCount === onlineCount`
- Button label:
  - Countdown active: `Starting in ${seconds}s`
  - `allReady`: `"Launch now"`
  - `canForceStart`: `"Force start · 5s"`
  - else: `"Need ${minPlayers} players"`
- Button enabled only when `allReady || canForceStart`

Start action: if allReady → `POST /api/rooms/:code/start`; else → `POST /api/rooms/:code/force-start`

The section title + controls layout:
```
[h2 "Party Stage"  p summary text]       [secondary: game]  [secondary: add tester]  [danger: Close]  [primary: Launch]
```

From CSS:
- `.host-controls`: `display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 10px`
- `.stage-title`: is `.section-title` with `align-items: flex-end`

- [ ] **Step 1: Create `src/components/platform/LobbyControls.tsx`**

```tsx
import { useState } from "react";
import Button from "../ui/Button";
import Icon from "../ui/Icon";
import type { Room } from "../../types/room";

interface LobbyControlsProps {
  room: Room;
  onOpenGamePicker: () => void;
}

function lobbySummary(
  onlineCount: number,
  readyCount: number,
  disconnectedCount: number,
  maxPlayers: number
): string {
  if (onlineCount === 0) return "Waiting for players to join…";
  const parts: string[] = [`${onlineCount} online`];
  if (readyCount > 0) parts.push(`${readyCount} ready`);
  if (disconnectedCount > 0) parts.push(`${disconnectedCount} disconnected`);
  parts.push(`max ${maxPlayers}`);
  return parts.join(" · ");
}

export default function LobbyControls({ room, onOpenGamePicker }: LobbyControlsProps) {
  const [starting, setStarting] = useState(false);
  const [closing, setClosing] = useState(false);
  const [addingTester, setAddingTester] = useState(false);
  const [error, setError] = useState("");

  const minPlayers = room.selectedGame?.minPlayers ?? 2;
  const maxPlayers = room.selectedGame?.maxPlayers ?? 8;

  const onlinePlayers = room.players.filter((p) => p.online !== false);
  const readyPlayers = onlinePlayers.filter((p) => p.ready);
  const disconnectedPlayers = room.players.filter((p) => p.online === false);

  const onlineCount = onlinePlayers.length;
  const readyCount = readyPlayers.length;
  const disconnectedCount = disconnectedPlayers.length;
  const totalCount = room.players.length;

  const canStart = onlineCount >= minPlayers && onlineCount <= maxPlayers;
  const canForceStart = totalCount >= minPlayers && totalCount <= maxPlayers;
  const allReady = canStart && readyCount === onlineCount;
  const countdownSeconds = room.launchCountdown ?? 0;
  const countdownActive = countdownSeconds > 0;

  const startLabel = countdownActive
    ? `Starting in ${countdownSeconds}s`
    : allReady
    ? "Launch now"
    : canForceStart
    ? "Force start · 5s"
    : `Need ${minPlayers} players`;

  const startEnabled = (allReady || canForceStart) && !countdownActive;

  async function handleStart() {
    if (!startEnabled || starting) return;
    setStarting(true);
    setError("");
    try {
      const endpoint = allReady ? "start" : "force-start";
      const res = await fetch(`/api/rooms/${room.code}/${endpoint}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error ?? "Failed to start");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start");
    } finally {
      setStarting(false);
    }
  }

  async function handleClose() {
    if (closing) return;
    setClosing(true);
    setError("");
    try {
      await fetch(`/api/rooms/${room.code}/close`, {
        method: "POST",
        headers: { "content-type": "application/json" },
      });
    } catch {
      // ignore — room may already be closed
    } finally {
      setClosing(false);
    }
  }

  async function handleAddTester() {
    if (addingTester) return;
    setAddingTester(true);
    setError("");
    try {
      const res = await fetch(`/api/rooms/${room.code}/test-players`, {
        method: "POST",
        headers: { "content-type": "application/json" },
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error ?? "Failed to add tester");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add tester");
    } finally {
      setAddingTester(false);
    }
  }

  return (
    <div>
      <div className="flex items-end justify-between gap-[20px] mb-[16px]">
        <div>
          <h2 className="m-0 text-[24px] font-[800] text-[var(--ink)]">
            Party Stage
          </h2>
          <p className="text-[var(--muted)] text-[14px] mt-[6px] mb-0">
            {lobbySummary(onlineCount, readyCount, disconnectedCount, maxPlayers)}
          </p>
        </div>
        <div className="flex flex-wrap justify-end gap-[10px]">
          <Button variant="secondary" onClick={onOpenGamePicker}>
            <Icon name="game" />
            <span>{room.selectedGame?.title ?? "Choose game"}</span>
          </Button>
          <Button
            variant="secondary"
            disabled={addingTester}
            onClick={handleAddTester}
          >
            <Icon name="users" />
            <span>Add tester</span>
          </Button>
          <button
            className={[
              "inline-flex items-center justify-center gap-[8px] min-h-[44px] px-[16px]",
              "rounded-[6px] border border-[#f67272]/[.4] text-[#f67272] bg-transparent",
              "font-[950] text-[14px] cursor-pointer hover:bg-[#f67272]/[.08] transition-colors",
              "disabled:opacity-[.48] disabled:cursor-not-allowed",
            ].join(" ")}
            type="button"
            disabled={closing}
            onClick={handleClose}
          >
            <Icon name="power" />
            <span>Close</span>
          </button>
          <Button
            variant="primary"
            disabled={!startEnabled || starting}
            onClick={handleStart}
            className={countdownActive ? "ring-2 ring-[var(--green)]" : ""}
          >
            <Icon name="play" />
            <span>{starting ? "Starting…" : startLabel}</span>
          </Button>
        </div>
      </div>
      {error && (
        <p className="text-[#f67272] text-[13px] mt-[4px]">{error}</p>
      )}
    </div>
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
git add src/components/platform/LobbyControls.tsx
git commit -m "feat(platform): add LobbyControls with start/close/add-tester actions"
```

---

## Task 9: Full LobbyPage with sidebar, stage, and SSE

**Files:**
- Modify: `src/pages/platform/LobbyPage.tsx`

### Context
The LobbyPage uses a 2-column grid layout:
- Left sidebar (320px): room code, QR code image, join link, host phone instructions
- Right main: LobbyControls + PlayerStage

The page connects to SSE via `useSSE(room.code)` to get real-time updates. On mount, it fetches the room from `GET /api/rooms/:code`. When `room.status === "closed"`, navigate back to `/`.

QR code URL: `https://api.qrserver.com/v1/create-qr-code/?size=164x164&data=${encodeURIComponent(joinUrl)}`
Join URL: `${window.location.origin}/?room=${room.code}`

From `public/platform/styles.css`:
- `.layout`: `display: grid; grid-template-columns: 320px 1fr; min-height: calc(100vh - 64px)`
- `.sidebar`: `border-right: 1px solid rgba(255,255,255,.07); background: rgba(23,29,37,.74); padding: 24px; display: flex; flex-direction: column; gap: 20px`
- `.room-code span` (label): `font-size: 11px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: var(--muted); display: block; margin-bottom: 6px`
- `.room-code strong`: `font-size: 48px; letter-spacing: 4px; font-weight: 800; color: var(--ink); line-height: 1`
- `.qr-box`: `margin: 0; padding: 14px; background: #fff; border-radius: 8px; max-width: 290px`
- `.join-link`: `font-size: 13px; color: var(--muted); word-break: break-all`
- `.main.lobby-stage`: `padding: 28px; display: flex; flex-direction: column; gap: 20px`

Also: when room is null (loading), show a centered spinner/loading state. When room.status === "closed", navigate to `/`.

- [ ] **Step 1: Replace `src/pages/platform/LobbyPage.tsx`**

```tsx
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useParams, useNavigate } from "react-router-dom";
import NavBar from "../../components/platform/NavBar";
import LobbyControls from "../../components/platform/LobbyControls";
import PlayerStage from "../../components/platform/PlayerStage";
import GamePickerModal from "../../components/platform/GamePickerModal";
import { useSSE } from "../../hooks/useSSE";
import { useRoomStore } from "../../stores/roomStore";
import { useConfig } from "../../hooks/useConfig";
import type { Room } from "../../types/room";

export default function LobbyPage() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const { config } = useConfig();

  const room = useRoomStore((s) => s.room);
  const setRoom = useRoomStore((s) => s.setRoom);
  const clearRoom = useRoomStore((s) => s.clearRoom);

  const [loading, setLoading] = useState(true);
  const [pickerOpen, setPickerOpen] = useState(false);

  // Fetch room on mount
  useEffect(() => {
    if (!code) return;
    fetch(`/api/rooms/${code}`)
      .then((r) => r.json())
      .then((data: { room: Room }) => {
        if (data.room) setRoom(data.room);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [code, setRoom]);

  // SSE for real-time updates
  useSSE(code ?? null);

  // Navigate away when room is closed
  useEffect(() => {
    if (room?.status === "closed") {
      clearRoom();
      navigate("/");
    }
  }, [room?.status, clearRoom, navigate]);

  async function handleSelectGame(gameId: string) {
    if (!code) return;
    setPickerOpen(false);
    try {
      const res = await fetch(`/api/rooms/${code}/select-game`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ gameId }),
      });
      if (res.ok) {
        const data = (await res.json()) as { room: Room };
        if (data.room) setRoom(data.room);
      }
    } catch {
      // SSE will sync anyway
    }
  }

  const joinUrl = `${window.location.origin}/?room=${code ?? ""}`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=164x164&data=${encodeURIComponent(joinUrl)}`;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-[var(--muted)]">Loading room…</p>
      </div>
    );
  }

  if (!room) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-[var(--muted)]">Room not found.</p>
      </div>
    );
  }

  const minPlayers = room.selectedGame?.minPlayers ?? 2;
  const maxPlayers = room.selectedGame?.maxPlayers ?? 8;

  return (
    <motion.div
      className="min-h-screen pt-[64px]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.22 }}
    >
      <NavBar floating={false} />

      <div
        className="grid"
        style={{
          gridTemplateColumns: "320px 1fr",
          minHeight: "calc(100vh - 64px)",
        }}
      >
        {/* Sidebar */}
        <aside
          className={[
            "flex flex-col gap-[20px] p-[24px]",
            "border-r border-white/[.07] bg-[rgba(23,29,37,.74)]",
          ].join(" ")}
        >
          <div>
            <span className="block text-[11px] font-[700] tracking-[.06em] uppercase text-[var(--muted)] mb-[6px]">
              Room code
            </span>
            <strong className="block text-[48px] font-[800] text-[var(--ink)] leading-[1] tracking-[4px]">
              {room.code}
            </strong>
          </div>

          <div className="p-[14px] bg-white rounded-[8px] max-w-[290px]">
            <img
              src={qrUrl}
              alt="Scan to join room"
              className="w-full h-auto block"
              width={164}
              height={164}
            />
          </div>

          <a
            href={joinUrl}
            className="text-[13px] text-[var(--muted)] break-all hover:text-[var(--ink)] transition-colors"
          >
            {joinUrl}
          </a>

          <div className="mt-auto p-[12px] rounded-[8px] border border-white/[.07] bg-[rgba(17,24,33,.6)]">
            <span className="block text-[11px] font-[700] tracking-[.06em] uppercase text-[var(--muted)] mb-[4px]">
              Host phone control
            </span>
            <p className="text-[var(--muted)] text-[13px] m-0">
              Sign in with {room.host.email} on your phone.
            </p>
          </div>
        </aside>

        {/* Main stage */}
        <main className="flex flex-col gap-[20px] p-[28px]">
          <LobbyControls
            room={room}
            onOpenGamePicker={() => setPickerOpen(true)}
          />
          <PlayerStage
            players={room.players}
            minPlayers={minPlayers}
            maxPlayers={maxPlayers}
          />
          <button
            className={[
              "self-start inline-flex items-center gap-[8px]",
              "min-h-[36px] px-[14px] rounded-[6px]",
              "border border-white/[.12] bg-[rgba(17,24,33,.9)]",
              "text-[var(--muted)] text-[13px] font-[700] cursor-pointer",
              "hover:text-[var(--ink)] transition-colors",
            ].join(" ")}
            type="button"
            onClick={async () => {
              await navigator.clipboard?.writeText(joinUrl).catch(() => {});
            }}
          >
            <svg className="w-[14px] h-[14px] fill-none stroke-current [stroke-width:2] flex-none" viewBox="0 0 24 24">
              <path d="M20 9H11a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2v-9a2 2 0 0 0-2-2zM5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
            Copy link
          </button>
        </main>
      </div>

      <GamePickerModal
        open={pickerOpen}
        games={config.games}
        selectedGameId={room.selectedGame?.id ?? null}
        onSelect={handleSelectGame}
        onClose={() => setPickerOpen(false)}
      />
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

- [ ] **Step 3: Run existing tests**

```bash
cd /Users/neil/Documents/派对游戏
npx vitest run 2>&1 | tail -20
```

Expected: all existing tests pass (stores.test.ts etc.)

- [ ] **Step 4: Commit**

```bash
cd /Users/neil/Documents/派对游戏
git add src/pages/platform/LobbyPage.tsx
git commit -m "feat(platform): implement LobbyPage with sidebar, stage, and SSE"
```

---

## Self-Review

### Spec coverage
- [x] T1: Types updated to match server shape, SSE hook fixed to `/api/events/:code`
- [x] T2: Icons added, SetupPage route added
- [x] T3: AccountMenu + NavBar signed-in state
- [x] T4: GamePickerModal (2-col grid)
- [x] T5: PaymentModal (3 tabs, create room API)
- [x] T6: SetupPage (game card, picker, payment CTA)
- [x] T7: PlayerBubble + PlayerStage (spotlights, ring)
- [x] T8: LobbyControls (launch/force-start/close/add-tester)
- [x] T9: LobbyPage (sidebar + stage + SSE + game picker)

### Type consistency check
- `Room.host` is `{ name: string; email: string }` — used correctly in LobbyPage (`room.host.email`)
- `Room.selectedGame` is `GameConfig | null` — properly guarded everywhere with `?.`
- `Room.players` is `Player[]` where Player has `online: boolean` — LobbyControls uses `p.online !== false` which is correct
- `Room.launchCountdown` is `number | null` — LobbyControls uses `room.launchCountdown ?? 0`
- `Player.avatar` is `Avatar | null` — PlayerBubble doesn't use it yet (initials placeholder is correct for now)
- `GamePickerModal` accepts `selectedGameId: string | null` — LobbyPage passes `room.selectedGame?.id ?? null` ✓
- PaymentModal's `onRoomCreated` receives `Room` — SetupPage navigates to `/room/${room.code}` ✓

### Placeholder scan
- No TBDs
- `Balance: "–"` in AccountMenu — intentional placeholder, same as the vanilla JS version (which hardcodes `"88 kr"`)
- Avatar initials placeholder — acceptable, the full avatar catalog fetch is a separate feature not in this plan

All tasks produce working, testable code. No gaps found.
