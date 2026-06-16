# Phase 8: Host Phone Pairing (Correct Implementation)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Desktop homepage shows a live pairing QR code + 5-char code. Host scans it on their phone, enters name/email, and both devices sync. The desktop then navigates to room setup (or directly to an existing room).

**Architecture:**
- Desktop calls `POST /api/pairings` on mount → gets a token → displays QR + code → polls `GET /api/pairings/:token` until phone claims it.
- Phone visits `/?pair=TOKEN` (redirected to `/pair/:token`) → shows a sign-in form → submits `POST /api/pairings/:token/claim` → navigates to room setup.
- After pairing: both sides call `authStore.setAccount(...)` → `isSignedIn = true` → `SetupPage` is accessible.

**Backend API (already exists, matches vanilla JS):**
- `POST /api/pairings` → `{ token: string }`
- `GET /api/pairings/:token` → `{ account?: { name, email }, room?: Room, paired?: boolean }`
- `POST /api/pairings/:token/claim` with body `{ name, email }` → `{ account: { name, email }, room?: Room }`

**Tech Stack:** React 18, TypeScript, Vite 5, Zustand (`useAuthStore`, `useRoomStore`), React Router v6, Tailwind CSS.

---

## File Map

| Action | Path | Purpose |
|--------|------|---------|
| Modify | `src/App.tsx` | Add `?pair=TOKEN` redirect + `/pair/:token` route |
| Create | `src/pages/player/PairPhonePage.tsx` | Phone-side: claim pairing form |
| Create | `src/hooks/usePairing.ts` | Desktop: create pairing + poll until claimed |
| Modify | `src/pages/platform/HomePage.tsx` | Wire live pairing card using `usePairing` |
| Create | `src/__tests__/pairing.test.ts` | Unit tests for pairing logic |

---

### Task 1: Route wiring in App.tsx

**Files:**
- Modify: `src/App.tsx`

Read the current `src/App.tsx`. The `RoomCodeRedirect` component handles `?room=CODE`. Extend it to also handle `?pair=TOKEN` → redirect to `/pair/:token`. Add the `/pair/:token` route.

- [ ] **Step 1: Read `src/App.tsx`** to see current state

- [ ] **Step 2: Extend `RoomCodeRedirect`** to handle `?pair=TOKEN`:

```tsx
function RoomCodeRedirect() {
  const location = useLocation();
  const navigate = useNavigate();
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const roomCode = params.get("room");
    const pairToken = params.get("pair");
    if (roomCode) {
      navigate(`/join/${roomCode.replace(/\D/g, "")}`, { replace: true });
    } else if (pairToken) {
      navigate(`/pair/${encodeURIComponent(pairToken.trim())}`, { replace: true });
    }
  }, [location.search, navigate]);
  return null;
}
```

- [ ] **Step 3: Add import for `PairPhonePage`** (after the other player page imports):

```tsx
import PairPhonePage from "./pages/player/PairPhonePage";
```

- [ ] **Step 4: Add route** inside `AnimatedRoutes`, after the `/waiting/:code` route:

```tsx
<Route path="/pair/:token" element={<PairPhonePage />} />
```

- [ ] **Step 5: TypeScript check** (will error only on missing `PairPhonePage` file — expected):

```bash
npx tsc --noEmit 2>&1 | head -10
```

- [ ] **Step 6: Commit**

```bash
git add src/App.tsx
git commit -m "feat(pairing): add ?pair=TOKEN redirect and /pair/:token route"
```

---

### Task 2: PairPhonePage

**Files:**
- Create: `src/pages/player/PairPhonePage.tsx`

This is the phone-side page. When the host scans the QR code, their phone loads this page. It shows a form (name + email), submits to the API, and on success navigates to room setup.

The `HostAccount` type in `src/types/auth.ts` has `{ email, displayName }`. The API returns `{ name, email }` — map `name → displayName`.

- [ ] **Step 1: Read `src/types/auth.ts`** to confirm `HostAccount` shape.

- [ ] **Step 2: Read `src/stores/authStore.ts`** to confirm `setAccount` signature.

- [ ] **Step 3: Create `src/pages/player/PairPhonePage.tsx`**:

```tsx
import { useState, type FormEvent } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import PhoneLayout from "../../components/player/PhoneLayout";
import { useAuthStore } from "../../stores/authStore";
import { useRoomStore } from "../../stores/roomStore";
import type { Room } from "../../types/room";

export default function PairPhonePage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const setAccount = useAuthStore((s) => s.setAccount);
  const setRoom = useRoomStore((s) => s.setRoom);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!token || !name.trim() || !email.trim() || submitting) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(`/api/pairings/${encodeURIComponent(token)}/claim`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: name.trim(), email: email.trim() }),
      });
      const data = (await res.json()) as { account?: { name: string; email: string }; room?: Room; error?: string };
      if (!res.ok || !data.account) {
        setError(data.error ?? "Pairing failed. The code may have expired.");
        return;
      }
      setAccount({ displayName: data.account.name, email: data.account.email });
      if (data.room) {
        setRoom(data.room);
        navigate(`/room/${data.room.code}`, { replace: true });
      } else {
        navigate("/room/setup", { replace: true });
      }
    } catch {
      setError("Could not connect. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const inputClass = [
    "w-full h-[44px] px-[14px] rounded-[8px] text-[14px] text-[var(--ink)]",
    "bg-[rgba(17,24,33,.8)] border border-white/[.15]",
    "focus:outline-none focus:border-[var(--green)] transition-colors",
    "placeholder:text-[var(--muted)]",
  ].join(" ");

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
      <PhoneLayout>
        <form className="phone-card grid gap-[14px]" onSubmit={handleSubmit}>
          <div className="grid gap-[4px]">
            <h1 className="text-[var(--ink)] text-[20px] font-[800] m-0">Pair host phone</h1>
            <p className="text-[var(--muted)] text-[13px] m-0">
              Sign in here. The big screen will follow this host account.
            </p>
          </div>

          <div className="grid gap-[10px]">
            <input
              className={inputClass}
              type="text"
              placeholder="Display name"
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
            <input
              className={inputClass}
              type="email"
              placeholder="Email address"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          {error && (
            <p className="text-[rgba(240,100,100,1)] text-[13px] m-0">{error}</p>
          )}

          <button
            type="submit"
            disabled={submitting || !name.trim() || !email.trim()}
            className="w-full h-[44px] rounded-[8px] bg-[var(--brand,#78d45e)] text-[#0a0f14] text-[14px] font-[700] hover:opacity-90 transition-opacity disabled:opacity-50 cursor-pointer"
          >
            {submitting ? "Pairing…" : "Continue"}
          </button>
        </form>
      </PhoneLayout>
    </motion.div>
  );
}
```

- [ ] **Step 4: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/pages/player/PairPhonePage.tsx
git commit -m "feat(pairing): add PairPhonePage for host phone sign-in"
```

---

### Task 3: usePairing hook

**Files:**
- Create: `src/hooks/usePairing.ts`

This hook is used by the desktop homepage. It:
1. Calls `POST /api/pairings` once on mount (only if not already signed in)
2. Stores the token + URL
3. Polls `GET /api/pairings/:token` every 2 seconds
4. When `data.account` is returned (phone has claimed), calls `setAccount` and `setRoom` (if a room exists), then stops polling

```ts
import { useState, useEffect, useRef } from "react";
import { useAuthStore } from "../stores/authStore";
import { useRoomStore } from "../stores/roomStore";
import type { Room } from "../types/room";

export interface PairingState {
  token: string;
  url: string;
  code: string;   // uppercase 5-char display code
}

interface PairingApiResponse {
  account?: { name: string; email: string };
  room?: Room;
  paired?: boolean;
}

const POLL_INTERVAL_MS = 2_000;

export function usePairing(): PairingState | null {
  const isSignedIn = useAuthStore((s) => s.isSignedIn);
  const setAccount = useAuthStore((s) => s.setAccount);
  const setRoom = useRoomStore((s) => s.setRoom);

  const [pairing, setPairing] = useState<PairingState | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const claimedRef = useRef(false);

  useEffect(() => {
    if (isSignedIn) return;

    let cancelled = false;

    async function createPairing() {
      try {
        const res = await fetch("/api/pairings", { method: "POST" });
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as { token: string };
        if (!data.token || cancelled) return;
        const token = data.token;
        const url = `${window.location.origin}/?pair=${token}`;
        setPairing({ token, url, code: token.toUpperCase() });
      } catch {
        // Silently ignore — desktop pairing is best-effort
      }
    }

    void createPairing();
    return () => { cancelled = true; };
  }, [isSignedIn]);

  useEffect(() => {
    if (!pairing?.token || isSignedIn) return;

    pollingRef.current = setInterval(async () => {
      if (claimedRef.current) return;
      try {
        const res = await fetch(`/api/pairings/${encodeURIComponent(pairing.token)}`);
        if (!res.ok) return;
        const data = (await res.json()) as PairingApiResponse;
        if (!data.account) return;
        claimedRef.current = true;
        if (pollingRef.current) {
          clearInterval(pollingRef.current);
          pollingRef.current = null;
        }
        setAccount({ displayName: data.account.name, email: data.account.email });
        if (data.room) setRoom(data.room);
        setPairing(null);
      } catch {
        // Polling errors are silent — will retry on next interval
      }
    }, POLL_INTERVAL_MS);

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [pairing?.token, isSignedIn, setAccount, setRoom]);

  return pairing;
}
```

- [ ] **Step 1: Create `src/hooks/usePairing.ts`** with the content above

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/usePairing.ts
git commit -m "feat(pairing): add usePairing hook for desktop pairing creation and polling"
```

---

### Task 4: Wire live pairing card into HomePage

**Files:**
- Modify: `src/pages/platform/HomePage.tsx`

The current `HomePage.tsx` has a static placeholder card at lines ~60-85 that says "Enter the desktop pair code" but does nothing. Replace it with a live pairing card that uses the `usePairing` hook.

The card shows different states:
- **Loading** (pairing is null, not yet signed in): small spinner/loading text
- **QR code ready**: QR image + 5-char code + instructions  
- **Signed in**: not shown (hook returns null → hide the card entirely, `SetupPage` redirect handled by `handlePlay`)

After pairing completes, `isSignedIn` becomes true → `handlePlay()` should immediately navigate to `/room/setup` without needing a button press. Add a `useEffect` to do this.

- [ ] **Step 1: Read `src/pages/platform/HomePage.tsx`** to understand the current structure

- [ ] **Step 2: Add imports** at the top:

```tsx
import { usePairing } from "../../hooks/usePairing";
```

- [ ] **Step 3: Inside `HomePage`, add the `usePairing` call** right after the existing state declarations:

```tsx
const pairing = usePairing();
```

- [ ] **Step 4: Add effect to auto-navigate after pairing** (place after the existing hooks):

```tsx
useEffect(() => {
  if (isSignedIn) navigate("/room/setup");
}, [isSignedIn, navigate]);
```

- [ ] **Step 5: Replace the static pairing card** (the `<div className="hidden lg:block ...">` block, approximately lines 60-85) with:

```tsx
{/* Pair device — hidden on mobile */}
<div className="hidden lg:block relative pl-[28px] before:absolute before:left-0 before:top-[8px] before:bottom-[8px] before:w-[1px] before:bg-white/[.14]">
  {pairing ? (
    <aside
      className={[
        "grid [grid-template-columns:auto_1fr] items-center gap-[14px] p-[14px]",
        "rounded-[8px] border border-white/[.12] bg-[rgba(17,24,33,.92)] [box-shadow:var(--shadow)]",
      ].join(" ")}
    >
      <div className="p-[6px] bg-white rounded-[6px] flex-none">
        <img
          src={`https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(pairing.url)}`}
          alt="Pair phone QR code"
          width={80}
          height={80}
          className="block"
        />
      </div>
      <div className="grid gap-[4px]">
        <span className="block text-[var(--green)] text-[11px] font-[950] tracking-[.08em] uppercase">
          Pair phone and screen
        </span>
        <strong className="block text-[var(--ink)] text-[22px] font-[800] tracking-[4px] leading-[1]">
          {pairing.code}
        </strong>
        <span className="block text-[var(--muted)] text-[12px] leading-snug">
          Scan or go to joyly.gg/?pair=<wbr />{pairing.code.toLowerCase()}
        </span>
      </div>
    </aside>
  ) : (
    <aside
      className={[
        "grid [grid-template-columns:46px_1fr] items-center gap-[12px] p-[12px] min-h-[92px]",
        "rounded-[8px] border border-white/[.07] bg-[rgba(17,24,33,.6)]",
      ].join(" ")}
    >
      <div className="w-[46px] h-[46px] grid place-items-center rounded-[8px] bg-[var(--panel-2)] text-[var(--muted)]">
        <svg className="w-[20px] h-[20px] fill-none stroke-current [stroke-width:2]" viewBox="0 0 24 24" aria-hidden="true">
          <rect x="5" y="2" width="14" height="20" rx="2" />
          <circle cx="12" cy="17" r="1" fill="currentColor" />
        </svg>
      </div>
      <div>
        <span className="block text-[var(--muted)] text-[11px] font-[700] tracking-[.06em] uppercase mb-[2px]">
          Pair phone and screen
        </span>
        <span className="block text-[var(--muted)] text-[13px]">Loading pair code…</span>
      </div>
    </aside>
  )}
</div>
```

- [ ] **Step 6: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/pages/platform/HomePage.tsx
git commit -m "feat(pairing): wire live pairing QR card into HomePage"
```

---

### Task 5: Unit tests

**Files:**
- Create: `src/__tests__/pairing.test.ts`

Test the pure logic inside `usePairing` that can be extracted: the URL/code building, and the `PairPhonePage` response mapping.

- [ ] **Step 1: Create `src/__tests__/pairing.test.ts`**:

```ts
import { describe, it, expect } from "vitest";

// Logic mirrors usePairing hook: build pairing URL and display code
function buildPairingState(origin: string, token: string) {
  return {
    token,
    url: `${origin}/?pair=${token}`,
    code: token.toUpperCase(),
  };
}

// Logic mirrors PairPhonePage: map API response to auth store shape
function mapAccountToAuth(apiAccount: { name: string; email: string }) {
  return { displayName: apiAccount.name, email: apiAccount.email };
}

describe("buildPairingState", () => {
  it("builds correct URL from origin and token", () => {
    const state = buildPairingState("https://joyly.gg", "abc12");
    expect(state.url).toBe("https://joyly.gg/?pair=abc12");
  });

  it("uppercases token as display code", () => {
    const state = buildPairingState("https://joyly.gg", "abc12");
    expect(state.code).toBe("ABC12");
  });

  it("preserves original token (case-sensitive for API)", () => {
    const state = buildPairingState("https://joyly.gg", "abc12");
    expect(state.token).toBe("abc12");
  });
});

describe("mapAccountToAuth", () => {
  it("maps name to displayName", () => {
    const auth = mapAccountToAuth({ name: "Neil", email: "neil@example.com" });
    expect(auth.displayName).toBe("Neil");
    expect(auth.email).toBe("neil@example.com");
  });

  it("preserves email exactly", () => {
    const auth = mapAccountToAuth({ name: "Host", email: "HOST@EXAMPLE.COM" });
    expect(auth.email).toBe("HOST@EXAMPLE.COM");
  });
});
```

- [ ] **Step 2: Run new tests**

```bash
npx vitest run src/__tests__/pairing.test.ts 2>&1 | tail -10
```

Expected: 5 tests pass.

- [ ] **Step 3: Run full Vitest suite**

```bash
npx vitest run 2>&1 | tail -10
```

Expected: all Vitest tests pass (previously passing tests still pass).

- [ ] **Step 4: Commit**

```bash
git add src/__tests__/pairing.test.ts
git commit -m "test(pairing): add unit tests for pairing URL building and account mapping"
```

---

### Task 6: Build verification

**Files:** none (verification only)

- [ ] **Step 1: Full TypeScript check**

```bash
npx tsc --noEmit 2>&1
```

Expected: no errors.

- [ ] **Step 2: Production build**

```bash
npm run build 2>&1 | tail -10
```

Expected: build succeeds.

- [ ] **Step 3: Commit any fixes if needed**

```bash
git add -p
git commit -m "fix(pairing): TypeScript and build fixes"
```
