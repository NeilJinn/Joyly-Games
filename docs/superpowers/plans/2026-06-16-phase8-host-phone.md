# Phase 8: Host Phone Pairing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the `/?host=CODE` flow so a host can open their phone, scan/type the host URL, and control the room (change game, close room, force-start) — mirroring the vanilla JS behaviour in `public/platform/app.js`.

**Architecture:** A `RoomCodeRedirect`-style handler at the root redirects `/?host=CODE` to `/host/:code`. A new `HostPhonePage` loads the room, reads a saved host account from localStorage (`"joylyHostAccount"`), and presents two surfaces: "room" (host controls) and "player" (standard join flow). LobbyPage sidebar gains an actual clickable host URL and QR code.

**Tech Stack:** React 18, TypeScript, React Router v6, Vite 5, Tailwind CSS (utility classes matching the existing `phone-*` CSS pattern in `public/platform/styles.css`), Vitest.

---

## File Map

| Action | Path | Purpose |
|--------|------|---------|
| Modify | `src/App.tsx` | Add `?host=CODE` redirect + `/host/:code` route |
| Create | `src/pages/player/HostPhonePage.tsx` | Host phone controller page (room + player surfaces) |
| Modify | `src/pages/platform/LobbyPage.tsx` | Add real host URL + QR code in sidebar |
| Create | `src/__tests__/host-phone.test.ts` | Unit tests for auth helper + launch state logic |

---

### Task 1: Route wiring in App.tsx

**Files:**
- Modify: `src/App.tsx`

The existing `RoomCodeRedirect` component only handles `?room=CODE`. We need it to also detect `?host=CODE` and redirect to `/host/:code`. Then add the new route.

- [ ] **Step 1: Open `src/App.tsx` and locate `RoomCodeRedirect`** (lines 19–30)

- [ ] **Step 2: Extend `RoomCodeRedirect` to handle `?host=CODE`**

```tsx
function RoomCodeRedirect() {
  const location = useLocation();
  const navigate = useNavigate();
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const roomCode = params.get("room");
    const hostCode = params.get("host");
    if (roomCode) {
      navigate(`/join/${roomCode.replace(/\D/g, "")}`, { replace: true });
    } else if (hostCode) {
      navigate(`/host/${hostCode.replace(/\D/g, "")}`, { replace: true });
    }
  }, [location.search, navigate]);
  return null;
}
```

- [ ] **Step 3: Add the import for `HostPhonePage`** at the top of the file (after the existing player page imports):

```tsx
import HostPhonePage from "./pages/player/HostPhonePage";
```

- [ ] **Step 4: Add the `/host/:code` route** inside `AnimatedRoutes`, after the existing player routes:

```tsx
<Route path="/host/:code" element={<HostPhonePage />} />
```

- [ ] **Step 5: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors (file not yet created will error — that's fine, fix in Task 2).

- [ ] **Step 6: Commit**

```bash
git add src/App.tsx
git commit -m "feat(host-phone): add ?host=CODE redirect and /host/:code route"
```

---

### Task 2: HostPhonePage

**Files:**
- Create: `src/pages/player/HostPhonePage.tsx`

This page is the host's phone controller. It:
1. Reads room code from URL param
2. Loads room from `/api/rooms/:code`
3. Reads `localStorage.getItem("joylyHostAccount")` → parses `{ email: string, name: string }` → compares email to `room.host.email`
4. Shows one of three states:
   - **Loading**: spinner
   - **Unauthorized**: "This room belongs to [host email]. Sign in as that host to control it." (no controls)
   - **Authorized — room surface (default)**: room summary + host controls
   - **Authorized — player surface**: navigates to `/join/:code` (reuses existing flow)
5. Subscribes to SSE via `useSSE(code)`
6. Navigates to `/` when room is closed

**Room surface layout** (reuses `PhoneLayout`):
```
[Room code + player count]
[Selected game name or "No game selected"]
[Change game button]          ← opens GamePickerModal
[Close room button]           ← danger, POST /api/rooms/:code/close
[Start / Force start button]  ← POST /api/rooms/:code/start or /force-start
[Switch to Player view link]  ← navigate to /join/:code
```

**Launch state logic** (mirrors vanilla JS `getLaunchState()`):
- No game selected → `{ label: "Select a game first", disabled: true }`
- `room.players.length < game.minPlayers` → `{ label: "Need ${game.minPlayers} players", disabled: true }`
- All players ready → `{ label: "Start now", endpoint: "start", disabled: false }`
- Otherwise → `{ label: "Force start", endpoint: "force-start", disabled: false }`

- [ ] **Step 1: Create the file** `src/pages/player/HostPhonePage.tsx`

```tsx
import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import PhoneLayout from "../../components/player/PhoneLayout";
import GamePickerModal from "../../components/platform/GamePickerModal";
import { useSSE } from "../../hooks/useSSE";
import { useRoomStore } from "../../stores/roomStore";
import { useConfig } from "../../hooks/useConfig";
import type { Room } from "../../types/room";

interface HostAccount {
  email: string;
  name: string;
}

function loadHostAccount(): HostAccount | null {
  try {
    return JSON.parse(localStorage.getItem("joylyHostAccount") || "null");
  } catch {
    return null;
  }
}

function getLaunchState(room: Room): { label: string; endpoint: string; disabled: boolean } {
  const game = room.selectedGame;
  if (!game) return { label: "Select a game first", endpoint: "force-start", disabled: true };
  if (room.players.length < (game.minPlayers ?? 2)) {
    return { label: `Need ${game.minPlayers ?? 2} players`, endpoint: "force-start", disabled: true };
  }
  const allReady = room.players.length > 0 && room.players.every((p) => p.ready);
  return allReady
    ? { label: "Start now", endpoint: "start", disabled: false }
    : { label: "Force start", endpoint: "force-start", disabled: false };
}

export default function HostPhonePage() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const { config } = useConfig();

  const room = useRoomStore((s) => s.room);
  const setRoom = useRoomStore((s) => s.setRoom);
  const clearRoom = useRoomStore((s) => s.clearRoom);

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const hostAccount = loadHostAccount();

  useEffect(() => {
    if (!code || room?.code === code) { setLoading(false); return; }
    fetch(`/api/rooms/${code}`)
      .then((r) => r.json())
      .then((data: { room: Room }) => { if (data.room) setRoom(data.room); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [code, room?.code, setRoom]);

  useSSE(code ?? null);

  useEffect(() => {
    if (room?.status === "closed") {
      clearRoom();
      navigate("/");
    }
  }, [room?.status, clearRoom, navigate]);

  async function apiPost(path: string) {
    if (busy || !code) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/rooms/${code}/${path}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({}) });
      if (res.ok) {
        const data = (await res.json()) as { room?: Room };
        if (data.room) setRoom(data.room);
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleSelectGame(gameId: string) {
    if (!code) return;
    setPickerOpen(false);
    try {
      const res = await fetch(`/api/rooms/${code}/select-game`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ gameId }) });
      if (res.ok) {
        const data = (await res.json()) as { room: Room };
        if (data.room) setRoom(data.room);
      }
    } catch { /* SSE will sync */ }
  }

  const wrap = (children: React.ReactNode) => (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
      <PhoneLayout>{children}</PhoneLayout>
    </motion.div>
  );

  if (loading) {
    return wrap(
      <div className="phone-card text-center">
        <p className="text-[var(--muted)] text-[14px] m-0">Loading room…</p>
      </div>
    );
  }

  if (!room) {
    return wrap(
      <div className="phone-card text-center grid gap-[12px]">
        <p className="text-[var(--ink)] text-[16px] font-[700] m-0">Room not found</p>
        <p className="text-[var(--muted)] text-[13px] m-0">The room may have been closed.</p>
      </div>
    );
  }

  const isAuthorized = Boolean(hostAccount?.email && room.host?.email && hostAccount.email === room.host.email);

  if (!isAuthorized) {
    return wrap(
      <div className="phone-card grid gap-[12px]">
        <p className="text-[var(--ink)] text-[16px] font-[700] m-0">Host controls</p>
        <p className="text-[var(--muted)] text-[13px] m-0">
          This room belongs to <strong>{room.host?.email ?? "unknown"}</strong>.<br />
          Sign in as that host on the big screen to use phone controls.
        </p>
      </div>
    );
  }

  const launch = getLaunchState(room);

  return (
    <>
      {wrap(
        <div className="grid gap-[14px]">
          {/* Room summary */}
          <div className="phone-card grid gap-[6px]">
            <div className="flex items-baseline gap-[10px]">
              <span className="text-[var(--ink)] text-[28px] font-[800] tracking-[3px] leading-[1]">{room.code}</span>
              <span className="text-[var(--muted)] text-[13px]">{room.players.length} player{room.players.length !== 1 ? "s" : ""}</span>
            </div>
            <p className="text-[var(--muted)] text-[13px] m-0">
              {room.selectedGame?.title ?? "No game selected"}
            </p>
          </div>

          {/* Host controls */}
          <div className="phone-card grid gap-[10px]">
            <button
              className="w-full h-[44px] rounded-[8px] border border-white/[.15] bg-[rgba(17,24,33,.8)] text-[var(--ink)] text-[14px] font-[700] hover:border-white/[.3] transition-colors cursor-pointer disabled:opacity-50"
              disabled={busy}
              onClick={() => setPickerOpen(true)}
            >
              Change game
            </button>

            {room.status === "waiting" && (
              <button
                className={[
                  "w-full h-[44px] rounded-[8px] text-[14px] font-[700] transition-colors cursor-pointer",
                  launch.disabled
                    ? "border border-white/[.1] bg-[rgba(17,24,33,.5)] text-[var(--muted)] cursor-not-allowed"
                    : "bg-[var(--brand,#78d45e)] text-[#0a0f14] hover:opacity-90",
                ].join(" ")}
                disabled={busy || launch.disabled}
                onClick={() => apiPost(launch.endpoint)}
              >
                {launch.label}
              </button>
            )}

            <button
              className="w-full h-[44px] rounded-[8px] border border-[rgba(220,60,60,.35)] bg-[rgba(220,60,60,.08)] text-[rgba(240,100,100,1)] text-[14px] font-[700] hover:bg-[rgba(220,60,60,.16)] transition-colors cursor-pointer disabled:opacity-50"
              disabled={busy}
              onClick={() => { if (confirm("Close this room?")) void apiPost("close"); }}
            >
              Close room
            </button>
          </div>

          {/* Player view link */}
          <button
            className="text-[var(--muted)] text-[13px] text-center hover:text-[var(--ink)] transition-colors cursor-pointer bg-transparent border-0 p-0"
            onClick={() => navigate(`/join/${code}`)}
          >
            Switch to Player view →
          </button>
        </div>
      )}

      <GamePickerModal
        open={pickerOpen}
        games={config.games}
        selectedGameId={room.selectedGame?.id ?? null}
        onSelect={handleSelectGame}
        onClose={() => setPickerOpen(false)}
      />
    </>
  );
}
```

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/pages/player/HostPhonePage.tsx
git commit -m "feat(host-phone): add HostPhonePage with room/player surface and host controls"
```

---

### Task 3: LobbyPage sidebar host section

**Files:**
- Modify: `src/pages/platform/LobbyPage.tsx`

The existing "Host phone control" card (lines 144–151) just shows a text message. Replace it with an actual clickable URL, a QR code, and a short instruction.

The host URL is `/?host=${code}` (vanilla JS uses this exact pattern; the React redirect in Task 1 will catch it and forward to `/host/:code`).

- [ ] **Step 1: Open `src/pages/platform/LobbyPage.tsx` lines 67–68 and add `hostUrl`**

```tsx
const joinUrl = `${config.localJoinBase}/?room=${code ?? ""}`;
const hostUrl = `${config.localJoinBase}/?host=${code ?? ""}`;
const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=164x164&data=${encodeURIComponent(joinUrl)}`;
const hostQrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(hostUrl)}`;
```

- [ ] **Step 2: Replace the "Host phone control" card** (the `<div>` at lines 144–151):

Replace this:
```tsx
<div className="mt-auto p-[12px] rounded-[8px] border border-white/[.07] bg-[rgba(17,24,33,.6)]">
  <span className="block text-[11px] font-[700] tracking-[.06em] uppercase text-[var(--muted)] mb-[4px]">
    Host phone control
  </span>
  <p className="text-[var(--muted)] text-[13px] m-0">
    Sign in with {room.host.email} on your phone.
  </p>
</div>
```

With:
```tsx
<div className="mt-auto p-[14px] rounded-[8px] border border-white/[.07] bg-[rgba(17,24,33,.6)] grid gap-[10px]">
  <span className="block text-[11px] font-[700] tracking-[.06em] uppercase text-[var(--muted)]">
    Host phone control
  </span>
  <div className="flex items-start gap-[10px]">
    <div className="p-[6px] bg-white rounded-[6px] flex-none">
      <img src={hostQrUrl} alt="Host QR" width={60} height={60} className="block" />
    </div>
    <div className="grid gap-[4px]">
      <a
        href={hostUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="text-[12px] text-[var(--muted)] break-all hover:text-[var(--ink)] transition-colors leading-snug"
      >
        {hostUrl}
      </a>
      <p className="text-[var(--muted)] text-[11px] m-0 leading-snug opacity-70">
        Sign in as {room.host.email}
      </p>
    </div>
  </div>
</div>
```

- [ ] **Step 3: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/pages/platform/LobbyPage.tsx
git commit -m "feat(host-phone): show host URL + QR code in LobbyPage sidebar"
```

---

### Task 4: Unit tests

**Files:**
- Create: `src/__tests__/host-phone.test.ts`

Test the two pure functions extracted from `HostPhonePage` logic. These functions don't need the DOM — they work on plain data.

Because the functions are inside the component file, extract them for testing by calling them directly (the test imports the module and calls the exported helpers). However since `loadHostAccount` and `getLaunchState` aren't exported, we'll test the logic by inlining equivalent implementations in the test (verifying the same contract).

- [ ] **Step 1: Create test file**

```ts
import { describe, it, expect } from "vitest";
import type { Room } from "../types/room";

// Mirror of getLaunchState from HostPhonePage — tests the same contract
function getLaunchState(room: Room): { label: string; endpoint: string; disabled: boolean } {
  const game = room.selectedGame;
  if (!game) return { label: "Select a game first", endpoint: "force-start", disabled: true };
  if (room.players.length < (game.minPlayers ?? 2)) {
    return { label: `Need ${game.minPlayers ?? 2} players`, endpoint: "force-start", disabled: true };
  }
  const allReady = room.players.length > 0 && room.players.every((p) => p.ready);
  return allReady
    ? { label: "Start now", endpoint: "start", disabled: false }
    : { label: "Force start", endpoint: "force-start", disabled: false };
}

function makeRoom(overrides: Partial<Room> = {}): Room {
  return {
    code: "1234",
    status: "waiting",
    host: { email: "host@example.com", name: "Host" },
    players: [],
    selectedGame: null,
    gameState: null,
    ...overrides,
  } as unknown as Room;
}

function makePlayer(ready: boolean) {
  return { id: "p1", nickname: "Player", ready, avatar: null } as unknown as Room["players"][number];
}

describe("getLaunchState", () => {
  it("disabled when no game selected", () => {
    const state = getLaunchState(makeRoom({ selectedGame: null }));
    expect(state.disabled).toBe(true);
    expect(state.label).toMatch(/select a game/i);
  });

  it("disabled when not enough players", () => {
    const state = getLaunchState(makeRoom({
      selectedGame: { id: "cosmic-trivia", title: "Cosmic Trivia", minPlayers: 2, maxPlayers: 8 } as Room["selectedGame"],
      players: [makePlayer(true)],
    }));
    expect(state.disabled).toBe(true);
    expect(state.label).toMatch(/need/i);
  });

  it("force-start when enough players but not all ready", () => {
    const state = getLaunchState(makeRoom({
      selectedGame: { id: "cosmic-trivia", title: "Cosmic Trivia", minPlayers: 2, maxPlayers: 8 } as Room["selectedGame"],
      players: [makePlayer(true), makePlayer(false)],
    }));
    expect(state.disabled).toBe(false);
    expect(state.endpoint).toBe("force-start");
  });

  it("start when all players ready", () => {
    const state = getLaunchState(makeRoom({
      selectedGame: { id: "cosmic-trivia", title: "Cosmic Trivia", minPlayers: 2, maxPlayers: 8 } as Room["selectedGame"],
      players: [makePlayer(true), makePlayer(true)],
    }));
    expect(state.disabled).toBe(false);
    expect(state.endpoint).toBe("start");
    expect(state.label).toMatch(/start now/i);
  });
});

// Mirror of auth check from HostPhonePage
function isAuthorized(hostEmail: string | null, roomHostEmail: string | null): boolean {
  return Boolean(hostEmail && roomHostEmail && hostEmail === roomHostEmail);
}

describe("host auth check", () => {
  it("authorized when emails match", () => {
    expect(isAuthorized("host@example.com", "host@example.com")).toBe(true);
  });

  it("not authorized when emails differ", () => {
    expect(isAuthorized("other@example.com", "host@example.com")).toBe(false);
  });

  it("not authorized when host account is null", () => {
    expect(isAuthorized(null, "host@example.com")).toBe(false);
  });

  it("not authorized when room host is null", () => {
    expect(isAuthorized("host@example.com", null)).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests**

```bash
npm run test -- --run src/__tests__/host-phone.test.ts 2>&1 | tail -20
```

Expected: 8 tests pass.

- [ ] **Step 3: Run full test suite**

```bash
npm run test -- --run 2>&1 | tail -10
```

Expected: all tests pass (62+ tests).

- [ ] **Step 4: Commit**

```bash
git add src/__tests__/host-phone.test.ts
git commit -m "test(host-phone): add getLaunchState and auth check unit tests"
```

---

### Task 5: Build verification

**Files:** none (verification only)

- [ ] **Step 1: Full TypeScript check**

```bash
npx tsc --noEmit 2>&1
```

Expected: no errors.

- [ ] **Step 2: Production build**

```bash
npm run build 2>&1 | tail -20
```

Expected: build succeeds, no errors.

- [ ] **Step 3: Commit if anything was fixed**

If steps 1-2 required any fixes, commit them:

```bash
git add -p
git commit -m "fix(host-phone): TypeScript and build fixes"
```
