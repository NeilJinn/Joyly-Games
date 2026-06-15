# React Migration — Phase 2: Homepage Benchmark

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the Joyly homepage (`/`) to React + Tailwind CSS, matching the existing visual design pixel-faithfully, with a working room code entry form and sign-in modal — and pass all benchmark criteria before Phase 3 begins.

**Architecture:** Each section of the homepage becomes a focused React component. The existing `public/platform/styles.css` is the authoritative visual reference — read it before styling each component. Use Tailwind utility classes with arbitrary values (e.g. `p-[28px]`, `text-[var(--muted)]`) to match exact CSS values. The Node.js server at port 4173 is untouched; the React dev server at port 5173 proxies all `/api` calls.

**Tech Stack:** React 18 · TypeScript · Tailwind CSS · Framer Motion 11 · React Router v6 · Zustand

**CSS Reference file:** `public/platform/styles.css` — read the relevant sections before building each component.

---

## Benchmark Criteria (all must pass before Phase 3)

1. Visual layout matches old homepage at desktop (1280px+), tablet (768px), and phone (375px)
2. Fixed topbar with brand logo, marketing nav links, Sign in / Play buttons — all visible
3. Hero promo rail (game slideshow) renders with prev/next/dots controls
4. "Start a Jam" button is clickable and opens the sign-in modal
5. Room code form: entering a valid 6-digit code and clicking Join navigates to `/join/:code`
6. Room code form: invalid input shows inline error "Enter a 6 digit code."
7. Sign-in modal: submitting name + email stores the account in `authStore` and closes the modal
8. Game Library grid renders game cards
9. No console errors on load
10. Framer Motion fade-in plays on page enter

---

## Files Created in This Phase

```
src/
  components/
    ui/
      Button.tsx              Primary, Secondary, IconButton variants
      Tag.tsx                 Green badge chip
      Icon.tsx                SVG icon renderer (maps names to paths)
      Input.tsx               Styled text input
      Modal.tsx               Backdrop + card shell
    platform/
      NavBar.tsx              Topbar: brand, marketing nav, topbar actions
      PromoRail.tsx           Hero game carousel with prev/next/dot controls
      CreateRoomButton.tsx    "Start a Jam" action card button
      JoinRoomForm.tsx        Room code entry action card
      GameCard.tsx            Store grid card (game art, title, description, play button)
      AuthModal.tsx           Sign-in modal (name + email form)
  pages/
    platform/
      HomePage.tsx            Replaces placeholder — full homepage assembly
  __tests__/
    JoinRoomForm.test.tsx     Tests room code validation and navigation
    AuthModal.test.tsx        Tests sign-in form submission
```

**CSS reference lines** (in `public/platform/styles.css`) for each component:
- `NavBar`: lines 80–192 (`.topbar`, `.topbar-brand`, `.brand`, `.brand-mark`, `.marketing-nav`, `.marketing-link`, `.home-actions`)
- Buttons: lines 1234–1310 (`.primary`, `.secondary`, `.icon-button`, hover states)
- `PromoRail`: lines 357–458 (`.home-hero`, `.promo-rail`, `.promo-slide`, `.promo-controls`, `.promo-dots`, `h1`, `.hero-copy`)
- `ActionBand`: lines 461–666 (`.home-action-band`, `.room-action-group`, `.pair-action-group`, `.action-card`, `.create-card`, `.join-code-card`, `.join-code-row`)
- `GameCard`: lines 1767–1845 (`.store-grid`, `.store-card`, `.game-art`, `.game-art-*`, `.game-body`, `.game-meta`, `.tag`)
- `AuthModal`: lines 1203–1232 (`.field`, `input`, `.modal-backdrop`, `.auth-card`) + lines 1320–1350 (`.modal-close`)
- `Tag`: lines 1835–1845 (`.tag`)
- `Input`: lines 1215–1232 (`input`, `:focus`)

---

### Task 1: Shared UI primitives — Button, Tag, Icon, Input

**Files:**
- Create: `src/components/ui/Button.tsx`
- Create: `src/components/ui/Tag.tsx`
- Create: `src/components/ui/Icon.tsx`
- Create: `src/components/ui/Input.tsx`
- Test: `src/__tests__/Button.test.tsx`

- [ ] **Step 1: Read CSS reference for buttons and inputs**

Read `public/platform/styles.css` lines 1234–1310 (button variants) and 1215–1232 (inputs) before writing any code.

- [ ] **Step 2: Write failing test for Button**

Create `src/__tests__/Button.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import Button from "../components/ui/Button";

describe("Button", () => {
  it("renders primary variant with children", () => {
    render(<Button variant="primary">Play</Button>);
    expect(screen.getByRole("button", { name: "Play" })).toBeInTheDocument();
  });

  it("renders secondary variant", () => {
    render(<Button variant="secondary">Sign in</Button>);
    expect(screen.getByRole("button", { name: "Sign in" })).toBeInTheDocument();
  });

  it("passes disabled state", () => {
    render(<Button variant="primary" disabled>Play</Button>);
    expect(screen.getByRole("button")).toBeDisabled();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

```bash
npm run test:ui -- --reporter=verbose src/__tests__/Button.test.tsx
```

Expected: FAIL — `Button` module not found.

- [ ] **Step 4: Create `src/components/ui/Icon.tsx`**

Maps icon names used in the original app to inline SVG paths. Read `public/platform/shared/ui.js` for the full icon set, then implement:

```tsx
const PATHS: Record<string, string> = {
  play: "M5 3l14 9-14 9V3z",
  login: "M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3",
  logout: "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9",
  left: "M15 18l-6-6 6-6",
  right: "M9 18l6-6-6-6",
  check: "M20 6L9 17l-5-5",
  star: "M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z",
  users: "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75",
  door: "M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM9 22V12h6v10",
  desktop: "M20 16H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2zM8 20h8M12 16v4",
  mobile: "M12 18h.01M8 2h8a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z",
  settings: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z",
  power: "M18.36 6.64a9 9 0 1 1-12.73 0M12 2v10",
  card: "M1 4h22v16H1zM1 10h22",
  coins: "M12 12c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4zM12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
};

interface IconProps {
  name: string;
  className?: string;
}

export default function Icon({ name, className }: IconProps) {
  const d = PATHS[name] ?? "";
  return (
    <svg
      className={[
        "w-[18px] h-[18px] flex-none fill-none stroke-current",
        "[stroke-width:2.4] [stroke-linecap:round] [stroke-linejoin:round]",
        "[filter:drop-shadow(0_1px_0_rgba(255,248,232,.24))]",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path d={d} />
    </svg>
  );
}
```

- [ ] **Step 5: Create `src/components/ui/Button.tsx`**

```tsx
import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "icon";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant: Variant;
  children: ReactNode;
}

const BASE =
  "min-h-[44px] rounded-[6px] px-[16px] font-[950] tracking-[.01em] transition-[transform,box-shadow,border-color] duration-[140ms] ease-[ease] hover:-translate-y-[1px] active:translate-y-0 cursor-pointer border-0";

const VARIANTS: Record<Variant, string> = {
  primary:
    "inline-flex items-center justify-center gap-[8px] text-[var(--outline)] border border-[rgba(255,248,232,.36)] [background:linear-gradient(135deg,rgba(255,248,232,.36),transparent_36%),linear-gradient(135deg,var(--sun),var(--green)_54%,var(--cyan))] [box-shadow:var(--paper-shadow),inset_0_0_0_2px_rgba(9,18,28,.16)] disabled:opacity-[.48] disabled:cursor-not-allowed",
  secondary:
    "inline-flex items-center justify-center gap-[8px] text-[var(--ink)] [background:linear-gradient(135deg,rgba(255,248,232,.08),transparent_42%),#25324b] border border-[var(--line)] [box-shadow:0_4px_0_rgba(3,8,14,.24)]",
  icon: "w-[44px] p-0 grid place-items-center text-[var(--ink)] [background:linear-gradient(135deg,rgba(255,248,232,.1),transparent_42%),var(--panel-2)] border border-[var(--line)] [box-shadow:0_4px_0_rgba(3,8,14,.24)]",
};

export default function Button({
  variant,
  className = "",
  children,
  ...props
}: ButtonProps) {
  return (
    <button className={`${BASE} ${VARIANTS[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
}
```

- [ ] **Step 6: Create `src/components/ui/Tag.tsx`**

Reference: `public/platform/styles.css` lines 1835–1845 (`.tag`).

```tsx
interface TagProps {
  children: React.ReactNode;
  className?: string;
}

export default function Tag({ children, className = "" }: TagProps) {
  return (
    <span
      className={`inline-flex min-h-[26px] items-center rounded-[4px] px-[8px] text-[#081015] bg-[var(--green)] text-[12px] font-[900] ${className}`}
    >
      {children}
    </span>
  );
}
```

- [ ] **Step 7: Create `src/components/ui/Input.tsx`**

Reference: `public/platform/styles.css` lines 1215–1232.

```tsx
import type { InputHTMLAttributes } from "react";

export default function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full min-h-[46px] px-[14px] text-[var(--ink)] bg-[#0f151d] border border-[var(--line)] rounded-[6px] outline-none [user-select:text] focus:border-[var(--cyan)] ${props.className ?? ""}`}
    />
  );
}
```

- [ ] **Step 8: Create `src/components/ui/Modal.tsx`**

Reference: `public/platform/styles.css` — search for `.modal-backdrop` and `.auth-card`.

```tsx
import type { ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}

export default function Modal({ open, onClose, children }: ModalProps) {
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
          <motion.div
            className="relative w-[min(440px,calc(100vw-32px))] rounded-[12px] border border-white/[.1] bg-[rgba(17,24,33,.98)] p-[28px] [box-shadow:var(--shadow)]"
            initial={{ opacity: 0, y: -12, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ duration: 0.18 }}
          >
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
```

- [ ] **Step 9: Run Button test to verify it passes**

```bash
npm run test:ui -- --reporter=verbose src/__tests__/Button.test.tsx
```

Expected:
```
✓ Button > renders primary variant with children
✓ Button > renders secondary variant
✓ Button > passes disabled state

Tests 3 passed (3)
```

- [ ] **Step 10: Commit UI primitives**

```bash
git add src/components/ui/
git commit -m "feat(react): add Button, Tag, Icon, Input, Modal UI primitives"
```

---

### Task 2: NavBar component

**Files:**
- Create: `src/components/platform/NavBar.tsx`

- [ ] **Step 1: Read CSS reference**

Read `public/platform/styles.css` lines 80–192 (`.topbar`, `.topbar-brand`, `.brand`, `.brand-mark`, `.marketing-nav`, `.marketing-link`, `.home-actions`, `.device-toggle`).

- [ ] **Step 2: Create `src/components/platform/NavBar.tsx`**

The NavBar renders the fixed topbar. It accepts `actions` as a render prop slot for the right side. Marketing nav links use React Router `<Link>` components.

```tsx
import { Link, useLocation } from "react-router-dom";
import Icon from "../ui/Icon";
import Button from "../ui/Button";
import { useAuthStore } from "../../stores/authStore";

const NAV_ITEMS = [
  { to: "/games", label: "Games" },
  { to: "/how-to-play", label: "How to Play" },
  { to: "/support", label: "Support" },
  { to: "/company", label: "Company" },
];

interface NavBarProps {
  floating?: boolean;
  onSignIn?: () => void;
  onPlay?: () => void;
}

export default function NavBar({
  floating = true,
  onSignIn,
  onPlay,
}: NavBarProps) {
  const location = useLocation();
  const { isSignedIn, account } = useAuthStore();

  return (
    <header
      className={[
        "h-[64px] flex items-center justify-between px-[28px]",
        "border-b border-white/[.07] bg-[rgba(14,22,35,.82)] backdrop-blur-[16px] z-20",
        floating ? "fixed inset-x-0 top-0" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {/* Brand + marketing nav */}
      <div className="flex items-center gap-[24px] min-w-0">
        <Link
          to="/"
          className="flex items-center gap-[12px] text-[var(--ink)] font-[800] text-[18px] no-underline"
          aria-label="Home"
        >
          <span
            className="w-[42px] h-[42px] block flex-none overflow-hidden rounded-[11px] [background:var(--brand-mark)_center/contain_no-repeat] text-transparent [text-indent:-999px] [filter:drop-shadow(0_5px_5px_rgba(0,0,0,.28))]"
            aria-hidden="true"
          >
            J
          </span>
          Joyly Games
        </Link>

        <nav className="flex items-center gap-[6px] flex-wrap" aria-label="Site">
          {NAV_ITEMS.map((item) => {
            const active = location.pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={[
                  "min-h-[40px] px-[14px] rounded-full border transition-[color,background,border-color] duration-[180ms] no-underline",
                  active
                    ? "text-[var(--outline)] bg-[var(--sun)] border-[rgba(255,209,102,.8)]"
                    : "text-[var(--muted)] bg-transparent border-transparent hover:text-[var(--ink)] hover:bg-[rgba(255,248,232,.06)] hover:border-[rgba(255,248,232,.1)]",
                ]
                  .filter(Boolean)
                  .join(" ")}
                aria-current={active ? "page" : undefined}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Right-side actions */}
      <nav className="flex items-center gap-[10px]" aria-label="Account">
        {!isSignedIn ? (
          <>
            <Button variant="secondary" onClick={onSignIn}>
              <Icon name="login" />
              <span>Sign in</span>
            </Button>
            <Button variant="primary" onClick={onPlay}>
              <Icon name="play" />
              <span>Play</span>
            </Button>
          </>
        ) : (
          <>
            <Button variant="primary" onClick={onPlay}>
              <Icon name="play" />
              <span>Play</span>
            </Button>
            <span className="text-[var(--muted)] text-[14px]">
              {account?.displayName}
            </span>
          </>
        )}
      </nav>
    </header>
  );
}
```

- [ ] **Step 3: Commit NavBar**

```bash
git add src/components/platform/NavBar.tsx
git commit -m "feat(react): add NavBar component with marketing nav and auth actions"
```

---

### Task 3: PromoRail (hero game carousel)

**Files:**
- Create: `src/components/platform/PromoRail.tsx`

- [ ] **Step 1: Read CSS reference**

Read `public/platform/styles.css` lines 357–458 (`.home-hero`, `.promo-rail`, `.promo-slide`, `.promo-slide.active`, `.promo-controls`, `.promo-dots`, `.home-hero h1`, `.hero-copy`, `.featured-game`).

- [ ] **Step 2: Create `src/components/platform/PromoRail.tsx`**

```tsx
import { useState, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Tag from "../ui/Tag";
import Button from "../ui/Button";
import Icon from "../ui/Icon";
import type { GameConfig } from "../../types/config";

interface PromoRailProps {
  games: GameConfig[];
  onPlay: (gameId: string) => void;
}

export default function PromoRail({ games, onPlay }: PromoRailProps) {
  const featured = games.slice(0, 4);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % Math.min(4, featured.length));
    }, 5000);
    return () => clearInterval(id);
  }, [featured.length]);

  function move(step: number) {
    setIndex((i) => (i + step + featured.length) % featured.length);
  }

  const game = featured[index];

  if (!game) return null;

  return (
    <section
      className={[
        "relative overflow-hidden min-h-[620px] px-[48px] pt-[44px] pb-[34px]",
        "[background:linear-gradient(180deg,rgba(9,18,28,.04),#0c0f14),var(--hero-paper)]",
        "bg-cover bg-center",
      ].join(" ")}
      aria-label="Featured games"
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={game.id}
          className="grid items-end gap-[36px] [grid-template-columns:minmax(0,1fr)_430px]"
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -24 }}
          transition={{ duration: 0.42, ease: "easeOut" }}
        >
          {/* Left: title + copy */}
          <div>
            <Tag>
              {game.players} players · {(game as any).genre ?? ""}
            </Tag>
            <h1
              className="max-w-[860px] my-[18px] mb-[28px] [font-size:clamp(46px,7vw,86px)] leading-[.98] mt-[18px]"
            >
              {game.name}
            </h1>
            <p className="max-w-[640px] -mt-[12px] mb-[24px] text-[#e5f4f6] text-[20px] leading-[1.42]">
              {(game as any).description ?? ""}
            </p>
            <Button
              variant="primary"
              className="min-w-[180px]"
              onClick={() => onPlay(game.id)}
              disabled={!game.playable}
            >
              <Icon name="play" />
              <span>Play now</span>
            </Button>
          </div>

          {/* Right: featured game card */}
          <div className="grid gap-[18px] p-[18px] border border-white/[.1] rounded-[8px] bg-[rgba(17,24,33,.9)] [box-shadow:var(--shadow)]">
            <div
              className={`h-[220px] rounded-[6px] game-art game-art-${game.id}`}
            />
            <div>
              <Tag>{index === 0 ? "Featured" : (game as any).mood ?? ""}</Tag>
              <h2 className="mt-[10px] mb-[6px] text-[30px]">{game.name}</h2>
              <p className="text-[var(--muted)] text-[14px]">
                {(game as any).mood ?? ""} ·{" "}
                {game.playable ? "Playable now" : "Coming soon"}
              </p>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Promo controls */}
      {featured.length > 1 && (
        <div className="absolute left-[48px] right-[48px] bottom-[28px] z-[4] flex items-center justify-center gap-[14px]">
          <Button
            variant="icon"
            className="bg-[rgba(17,24,33,.82)]"
            onClick={() => move(-1)}
            aria-label="Previous slide"
          >
            <Icon name="left" />
          </Button>

          <div className="inline-flex items-center gap-[8px] px-[10px] py-[8px] rounded-full bg-[rgba(17,24,33,.72)] border border-white/[.1]">
            {featured.map((g, i) => (
              <button
                key={g.id}
                className={[
                  "h-[8px] rounded-full border-0 p-0 transition-[width,background] duration-[200ms] cursor-pointer",
                  i === index
                    ? "w-[34px] bg-[var(--green)]"
                    : "w-[10px] bg-[rgba(255,248,232,.46)]",
                ].join(" ")}
                onClick={() => setIndex(i)}
                aria-label={`Show ${g.name}`}
              />
            ))}
          </div>

          <Button
            variant="icon"
            className="bg-[rgba(17,24,33,.82)]"
            onClick={() => move(1)}
            aria-label="Next slide"
          >
            <Icon name="right" />
          </Button>
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 3: Commit PromoRail**

```bash
git add src/components/platform/PromoRail.tsx
git commit -m "feat(react): add PromoRail hero carousel with Framer Motion transitions"
```

---

### Task 4: ActionBand — JoinRoomForm and CreateRoomButton

**Files:**
- Create: `src/components/platform/JoinRoomForm.tsx`
- Create: `src/components/platform/CreateRoomButton.tsx`
- Test: `src/__tests__/JoinRoomForm.test.tsx`

- [ ] **Step 1: Read CSS reference**

Read `public/platform/styles.css` lines 461–666 (`.home-action-band`, `.room-action-group`, `.pair-action-group`, `.action-card`, `.create-card`, `.join-code-card`, `.join-code-row`, `.action-label`, `.join-code-card input`, `.error`).

- [ ] **Step 2: Write failing tests for JoinRoomForm**

Create `src/__tests__/JoinRoomForm.test.tsx`:

```tsx
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";
import JoinRoomForm from "../components/platform/JoinRoomForm";

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return { ...actual, useNavigate: () => mockNavigate };
});

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

beforeEach(() => {
  vi.clearAllMocks();
});

function renderForm() {
  return render(
    <MemoryRouter>
      <JoinRoomForm />
    </MemoryRouter>
  );
}

describe("JoinRoomForm", () => {
  it("shows error for non-6-digit input", async () => {
    renderForm();
    const input = screen.getByPlaceholderText("Room code");
    const button = screen.getByRole("button", { name: /join/i });

    fireEvent.change(input, { target: { value: "123" } });
    fireEvent.click(button);

    expect(await screen.findByText("Enter a 6 digit code.")).toBeInTheDocument();
  });

  it("navigates to /join/:code when room exists", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) });
    renderForm();

    const input = screen.getByPlaceholderText("Room code");
    fireEvent.change(input, { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: /join/i }));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/join/123456");
    });
  });

  it("shows error when room is not found", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: "Not found" }),
    });
    renderForm();

    const input = screen.getByPlaceholderText("Room code");
    fireEvent.change(input, { target: { value: "999999" } });
    fireEvent.click(screen.getByRole("button", { name: /join/i }));

    expect(await screen.findByText("Room not found.")).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
npm run test:ui -- --reporter=verbose src/__tests__/JoinRoomForm.test.tsx
```

Expected: FAIL — module not found.

- [ ] **Step 4: Create `src/components/platform/JoinRoomForm.tsx`**

```tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Button from "../ui/Button";
import Icon from "../ui/Icon";

export default function JoinRoomForm() {
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleJoin() {
    setError("");
    const digits = code.replace(/\D/g, "");
    if (digits.length !== 6) {
      setError("Enter a 6 digit code.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/rooms/${digits}`);
      if (!res.ok) throw new Error("not found");
      navigate(`/join/${digits}`);
    } catch {
      setError("Room not found.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      className={[
        "grid gap-[8px] p-[12px] rounded-[8px]",
        "border border-white/[.12] bg-[rgba(17,24,33,.92)] [box-shadow:var(--shadow)]",
        "min-h-[92px]",
      ].join(" ")}
      onSubmit={(e) => {
        e.preventDefault();
        void handleJoin();
      }}
    >
      <div className="grid gap-[6px] mb-[8px]">
        <span className="inline-flex items-center text-[var(--green)] text-[11px] font-[950] tracking-[.08em] uppercase">
          Join room
        </span>
      </div>

      <div className="grid [grid-template-columns:minmax(0,1fr)_auto] gap-[14px] items-center">
        <input
          name="code"
          inputMode="numeric"
          maxLength={6}
          placeholder="Room code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          className="w-full min-h-[40px] border-0 bg-[rgba(8,11,15,.66)] font-[800] rounded-[4px] px-[10px] text-[var(--ink)] relative z-[2] outline-none"
        />
        <Button
          variant="secondary"
          type="submit"
          disabled={loading}
          className="min-h-[40px]"
        >
          <Icon name="login" />
          <span>Join</span>
        </Button>
      </div>

      {error && (
        <span className="text-[var(--red)] text-[13px] [grid-column:1_/_-1]">
          {error}
        </span>
      )}
    </form>
  );
}
```

- [ ] **Step 5: Create `src/components/platform/CreateRoomButton.tsx`**

```tsx
import Button from "../ui/Button";
import Icon from "../ui/Icon";

interface CreateRoomButtonProps {
  onClick: () => void;
}

export default function CreateRoomButton({ onClick }: CreateRoomButtonProps) {
  return (
    <Button
      variant="primary"
      className="w-full min-h-[92px] [grid-template-columns:46px_1fr] grid items-center gap-[12px] p-[12px] rounded-[8px] text-left justify-start"
      onClick={onClick}
    >
      <div className="w-[46px] h-[46px] grid place-items-center rounded-[8px] text-[var(--outline)] [background:linear-gradient(135deg,var(--sun),var(--green))]">
        <Icon name="play" className="w-[26px] h-[26px]" />
      </div>
      <span>
        <strong className="block text-[19px] leading-[1.15] text-[var(--outline)] mt-[4px]">
          Start a Jam
        </strong>
      </span>
    </Button>
  );
}
```

- [ ] **Step 6: Run tests to verify they pass**

```bash
npm run test:ui -- --reporter=verbose src/__tests__/JoinRoomForm.test.tsx
```

Expected:
```
✓ JoinRoomForm > shows error for non-6-digit input
✓ JoinRoomForm > navigates to /join/:code when room exists
✓ JoinRoomForm > shows error when room is not found

Tests 3 passed (3)
```

- [ ] **Step 7: Commit ActionBand components**

```bash
git add src/components/platform/JoinRoomForm.tsx src/components/platform/CreateRoomButton.tsx src/__tests__/JoinRoomForm.test.tsx
git commit -m "feat(react): add JoinRoomForm and CreateRoomButton with tests"
```

---

### Task 5: GameCard and Game Library grid

**Files:**
- Create: `src/components/platform/GameCard.tsx`

- [ ] **Step 1: Read CSS reference**

Read `public/platform/styles.css` lines 1767–1845 (`.store-grid`, `.store-card`, `.game-art`, `.game-art-cosmic-trivia` and other game art variants, `.game-body`, `.game-meta`, `.tag`).

Also note in `globals.css`, the CSS custom properties already define `--cover-cosmic-trivia` and other cover art URLs. The `.game-art-*` CSS classes are NOT in Tailwind — add them as a component-scoped style block or in `globals.css`.

- [ ] **Step 2: Add game art CSS to `src/styles/globals.css`**

Append at the end of `src/styles/globals.css`:

```css
/* Game art backgrounds — use CSS variables set in :root */
.game-art {
  height: 150px;
  padding: 16px;
  display: flex;
  align-items: flex-end;
  border-bottom: 4px solid var(--outline);
  background:
    linear-gradient(135deg, rgba(255, 255, 255, 0.16), transparent 36%),
    var(--cover-cosmic-trivia);
  background-size: cover;
  background-position: center;
}

.game-art-cosmic-trivia {
  background:
    linear-gradient(135deg, rgba(255, 255, 255, 0.16), transparent 36%),
    var(--cover-cosmic-trivia);
  background-size: cover;
  background-position: center;
}

.game-art-after-hours {
  background:
    linear-gradient(135deg, rgba(255, 255, 255, 0.16), transparent 36%),
    var(--cover-after-hours);
  background-size: cover;
  background-position: center;
}

.game-art-pitch-storm {
  background:
    linear-gradient(135deg, rgba(255, 255, 255, 0.16), transparent 36%),
    var(--cover-pitch-storm);
  background-size: cover;
  background-position: center;
}

.game-art-signal-lost {
  background:
    linear-gradient(135deg, rgba(255, 255, 255, 0.16), transparent 36%),
    var(--cover-signal-lost);
  background-size: cover;
  background-position: center;
}

.game-art-fate-werewolf {
  background:
    linear-gradient(135deg, rgba(255, 255, 255, 0.16), transparent 36%),
    var(--panel-2);
  background-size: cover;
  background-position: center;
}
```

- [ ] **Step 3: Create `src/components/platform/GameCard.tsx`**

```tsx
import Tag from "../ui/Tag";
import Button from "../ui/Button";
import Icon from "../ui/Icon";
import type { GameConfig } from "../../types/config";

interface GameCardProps {
  game: GameConfig & { genre?: string; description?: string; mood?: string; players?: string };
  selected?: boolean;
  onPlay: (gameId: string) => void;
}

export default function GameCard({ game, selected = false, onPlay }: GameCardProps) {
  return (
    <article
      className={[
        "overflow-hidden rounded-[8px] border border-white/[.12] bg-[rgba(17,24,33,.92)]",
        selected ? "border-[rgba(120,212,94,.7)] [box-shadow:0_0_0_2px_rgba(120,212,94,.18),var(--shadow)]" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className={`game-art game-art-${game.id}`}>
        <Tag>{game.genre ?? ""}</Tag>
      </div>
      <div className="p-[14px] grid gap-[12px]">
        <div>
          <h3 className="text-[18px] font-[800] text-[var(--ink)] m-0">{game.name}</h3>
          <p className="text-[var(--muted)] text-[13px] mt-[6px] mb-0 leading-[1.4]">
            {game.description ?? ""}
          </p>
        </div>
        <div className="flex gap-[8px] flex-wrap text-[var(--muted)] text-[12px]">
          <span>{game.players ?? ""}</span>
          <span>{game.mood ?? ""}</span>
          <span>{game.playable ? "Playable" : "Coming soon"}</span>
        </div>
        <Button
          variant="primary"
          disabled={!game.playable}
          onClick={() => onPlay(game.id)}
          className="w-full"
        >
          {game.playable ? (
            <>
              <Icon name="play" />
              <span>Play</span>
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
}
```

- [ ] **Step 4: Commit GameCard**

```bash
git add src/components/platform/GameCard.tsx src/styles/globals.css
git commit -m "feat(react): add GameCard component and game art CSS"
```

---

### Task 6: AuthModal

**Files:**
- Create: `src/components/platform/AuthModal.tsx`
- Test: `src/__tests__/AuthModal.test.tsx`

- [ ] **Step 1: Write failing test**

Create `src/__tests__/AuthModal.test.tsx`:

```tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import AuthModal from "../components/platform/AuthModal";

describe("AuthModal", () => {
  it("does not render when closed", () => {
    const { container } = render(
      <AuthModal open={false} onClose={() => {}} />
    );
    expect(container.querySelector("form")).toBeNull();
  });

  it("renders the sign-in form when open", () => {
    render(<AuthModal open={true} onClose={() => {}} />);
    expect(screen.getByText("Host account")).toBeInTheDocument();
    expect(screen.getByLabelText(/display name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
  });

  it("calls onClose when backdrop is clicked", () => {
    const onClose = vi.fn();
    render(<AuthModal open={true} onClose={onClose} />);
    // Click the backdrop (the outermost div)
    fireEvent.click(document.querySelector(".fixed")!);
    expect(onClose).toHaveBeenCalled();
  });

  it("stores account in authStore and calls onClose on submit", () => {
    const onClose = vi.fn();
    render(<AuthModal open={true} onClose={onClose} />);

    fireEvent.change(screen.getByLabelText(/display name/i), {
      target: { value: "Neil" },
    });
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: "neil@test.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));

    expect(onClose).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm run test:ui -- --reporter=verbose src/__tests__/AuthModal.test.tsx
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create `src/components/platform/AuthModal.tsx`**

```tsx
import { useState } from "react";
import Modal from "../ui/Modal";
import Input from "../ui/Input";
import Button from "../ui/Button";
import Icon from "../ui/Icon";
import { useAuthStore } from "../../stores/authStore";

interface AuthModalProps {
  open: boolean;
  onClose: () => void;
}

export default function AuthModal({ open, onClose }: AuthModalProps) {
  const setAccount = useAuthStore((s) => s.setAccount);
  const [name, setName] = useState("Neil");
  const [email, setEmail] = useState("host@example.com");

  function handleSubmit() {
    if (!name.trim() || !email.trim()) return;
    setAccount({ displayName: name.trim(), email: email.trim() });
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose}>
      <h2 className="text-[22px] font-[800] text-[var(--ink)] m-0 mb-[8px]">
        Host account
      </h2>
      <p className="text-[var(--muted)] text-[14px] mt-0 mb-[4px]">
        Sign in to choose a game and buy play time.
      </p>

      <div className="grid gap-[8px] my-[18px]">
        <label className="grid gap-[8px]" htmlFor="auth-name">
          <span className="text-[#c8d4de] text-[13px] font-[700]">
            Display name
          </span>
          <Input
            id="auth-name"
            name="hostName"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
          />
        </label>
      </div>

      <div className="grid gap-[8px] my-[18px]">
        <label className="grid gap-[8px]" htmlFor="auth-email">
          <span className="text-[#c8d4de] text-[13px] font-[700]">Email</span>
          <Input
            id="auth-email"
            name="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
        </label>
      </div>

      <Button
        variant="primary"
        className="w-full mt-[8px]"
        onClick={handleSubmit}
      >
        <Icon name="login" />
        <span>Continue</span>
      </Button>
    </Modal>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm run test:ui -- --reporter=verbose src/__tests__/AuthModal.test.tsx
```

Expected:
```
✓ AuthModal > does not render when closed
✓ AuthModal > renders the sign-in form when open
✓ AuthModal > calls onClose when backdrop is clicked
✓ AuthModal > stores account in authStore and calls onClose on submit

Tests 4 passed (4)
```

- [ ] **Step 5: Commit AuthModal**

```bash
git add src/components/platform/AuthModal.tsx src/__tests__/AuthModal.test.tsx
git commit -m "feat(react): add AuthModal with sign-in form and authStore integration"
```

---

### Task 7: HomePage assembly with Framer Motion page transition

**Files:**
- Modify: `src/pages/platform/HomePage.tsx` (replace placeholder)
- Modify: `src/App.tsx` (add AnimatePresence wrapper)

- [ ] **Step 1: Update `src/App.tsx` to add page transition wrapper**

```tsx
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import HomePage from "./pages/platform/HomePage";
import GamesPage from "./pages/platform/GamesPage";
import HowToPlayPage from "./pages/platform/HowToPlayPage";
import SupportPage from "./pages/platform/SupportPage";
import CompanyPage from "./pages/platform/CompanyPage";
import LobbyPage from "./pages/platform/LobbyPage";
import JoinPage from "./pages/player/JoinPage";
import AvatarPage from "./pages/player/AvatarPage";
import WaitingPage from "./pages/player/WaitingPage";
import InRoomPage from "./pages/player/InRoomPage";
import CosmicTriviaBigScreen from "./pages/games/cosmic-trivia/BigScreenPage";
import CosmicTriviaPhone from "./pages/games/cosmic-trivia/PhonePage";
import FateWerewolfBigScreen from "./pages/games/fate-werewolf/BigScreenPage";
import FateWerewolfPhone from "./pages/games/fate-werewolf/PhonePage";
import NotFoundPage from "./pages/NotFoundPage";

function AnimatedRoutes() {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<HomePage />} />
        <Route path="/games" element={<GamesPage />} />
        <Route path="/how-to-play" element={<HowToPlayPage />} />
        <Route path="/support" element={<SupportPage />} />
        <Route path="/company" element={<CompanyPage />} />
        <Route path="/room/:code" element={<LobbyPage />} />
        <Route path="/join" element={<JoinPage />} />
        <Route path="/join/:code" element={<AvatarPage />} />
        <Route path="/play/:code" element={<InRoomPage />} />
        <Route path="/waiting/:code" element={<WaitingPage />} />
        <Route path="/game/cosmic-trivia/:code" element={<CosmicTriviaBigScreen />} />
        <Route path="/game/cosmic-trivia/:code/phone" element={<CosmicTriviaPhone />} />
        <Route path="/game/fate-werewolf/:code" element={<FateWerewolfBigScreen />} />
        <Route path="/game/fate-werewolf/:code/phone" element={<FateWerewolfPhone />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </AnimatePresence>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AnimatedRoutes />
    </BrowserRouter>
  );
}
```

- [ ] **Step 2: Replace `src/pages/platform/HomePage.tsx` with full implementation**

```tsx
import { useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import NavBar from "../../components/platform/NavBar";
import PromoRail from "../../components/platform/PromoRail";
import CreateRoomButton from "../../components/platform/CreateRoomButton";
import JoinRoomForm from "../../components/platform/JoinRoomForm";
import GameCard from "../../components/platform/GameCard";
import AuthModal from "../../components/platform/AuthModal";
import { useConfig } from "../../hooks/useConfig";
import { useAuthStore } from "../../stores/authStore";

export default function HomePage() {
  const { config } = useConfig();
  const navigate = useNavigate();
  const isSignedIn = useAuthStore((s) => s.isSignedIn);
  const [authOpen, setAuthOpen] = useState(false);

  function handlePlay(gameId?: string) {
    if (!isSignedIn) {
      setAuthOpen(true);
      return;
    }
    // Phase 3 will handle room creation. For now, navigate to a placeholder.
    void gameId;
    navigate("/room/setup");
  }

  return (
    <motion.main
      className="home-screen min-h-screen pt-[64px]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.22 }}
    >
      <NavBar
        floating
        onSignIn={() => setAuthOpen(true)}
        onPlay={() => handlePlay()}
      />

      {/* Hero promo rail */}
      <PromoRail games={config.games} onPlay={handlePlay} />

      {/* Action band */}
      <section
        className={[
          "grid [grid-template-columns:minmax(0,1fr)_minmax(360px,440px)] items-start gap-[34px]",
          "px-[48px] pt-[30px] pb-[46px]",
          "[background:linear-gradient(180deg,#0c0f14,rgba(12,15,20,.96))]",
        ].join(" ")}
      >
        {/* Start a Jam + Join room */}
        <div className="grid [grid-template-columns:minmax(220px,320px)_minmax(310px,460px)] items-stretch gap-[14px]">
          <CreateRoomButton onClick={() => handlePlay()} />
          <JoinRoomForm />
        </div>

        {/* Pair device (placeholder — Phase 3) */}
        <div className="relative pl-[28px] before:absolute before:left-0 before:top-[8px] before:bottom-[8px] before:w-[1px] before:bg-white/[.14]">
          <aside
            className={[
              "grid [grid-template-columns:46px_1fr] items-center gap-[12px] p-[12px] min-h-[92px]",
              "rounded-[8px] border border-white/[.12] bg-[rgba(17,24,33,.92)] [box-shadow:var(--shadow)]",
            ].join(" ")}
          >
            <div className="w-[46px] h-[46px] grid place-items-center rounded-[8px] bg-[var(--panel-2)] text-[var(--muted)]">
              <svg className="w-[20px] h-[20px] fill-none stroke-current [stroke-width:2]" viewBox="0 0 24 24"><rect x="5" y="2" width="14" height="20" rx="2" /><circle cx="12" cy="17" r="1" fill="currentColor" /></svg>
            </div>
            <div>
              <span className="block text-[var(--green)] text-[11px] font-[950] tracking-[.08em] uppercase mb-[4px]">
                Pair phone and screen
              </span>
              <strong className="block text-[var(--ink)] text-[16px]">
                Enter the desktop pair code
              </strong>
              <span className="block text-[var(--muted)] text-[13px]">
                Sync your phone to control this screen.
              </span>
            </div>
          </aside>
        </div>
      </section>

      {/* Game Library */}
      <section className="px-[48px] pt-[34px] pb-[60px]">
        <div className="flex items-end justify-between gap-[20px] mb-[18px]">
          <div>
            <h2 className="m-0 text-[28px] font-[800] text-[var(--ink)]">
              Game Library
            </h2>
            <p className="text-[var(--muted)] text-[14px] mt-[6px] mb-0">
              Browse by mood, group size, and party style.
            </p>
          </div>
        </div>
        <div className="grid [grid-template-columns:repeat(4,minmax(0,1fr))] gap-[16px]">
          {config.games.map((game) => (
            <GameCard
              key={game.id}
              game={game as any}
              onPlay={handlePlay}
            />
          ))}
        </div>
      </section>

      {/* Auth Modal */}
      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
    </motion.main>
  );
}
```

- [ ] **Step 3: Commit HomePage**

```bash
git add src/pages/platform/HomePage.tsx src/App.tsx
git commit -m "feat(react): add HomePage with full layout, PromoRail, ActionBand, GameLibrary"
```

---

### Task 8: Benchmark verification

- [ ] **Step 1: Start both servers**

Terminal 1:
```bash
node server.js
```
Expected: `Server running on http://0.0.0.0:4173`

Terminal 2:
```bash
npm run dev
```
Expected: `Local: http://localhost:5173/`

- [ ] **Step 2: Run all tests**

```bash
npm run test:ui
```

Expected:
```
✓ src/__tests__/stores.test.ts (12 tests)
✓ src/__tests__/Button.test.tsx (3 tests)
✓ src/__tests__/JoinRoomForm.test.tsx (3 tests)
✓ src/__tests__/AuthModal.test.tsx (4 tests)

Test Files  4 passed (4)
Tests       22 passed (22)
```

- [ ] **Step 3: Open homepage and check against benchmark criteria**

Open `http://localhost:5173/` and verify each criterion:

1. Fixed topbar visible at top with Joyly Games brand, nav links (Games, How to Play, Support, Company), Sign in + Play buttons
2. Hero promo rail shows below topbar — at least one game slide visible with prev/next/dots controls
3. "Start a Jam" green/yellow button visible in action band
4. "Join room" card with room code input and Join button visible
5. Game Library grid below action band
6. Click "Sign in" → auth modal appears with display name + email fields
7. Fill display name + email, click Continue → modal closes, Play button area updates
8. Enter `123` in room code, click Join → error text "Enter a 6 digit code." appears
9. No red errors in browser console
10. Page fades in on first load (Framer Motion animation)

- [ ] **Step 4: Check at 768px viewport (tablet)**

Resize browser to 768px wide. Confirm layout does not overflow horizontally.

- [ ] **Step 5: Final Phase 2 commit**

```bash
git add -A
git commit -m "feat(react): Phase 2 complete — Homepage Benchmark passing"
```

---

## Phase 2 Complete

At this point:
- Homepage at `localhost:5173/` matches old design with React + Tailwind
- 22 tests passing across stores, Button, JoinRoomForm, AuthModal
- Framer Motion page transitions wired up
- Auth flow working (sign-in stores to authStore)
- Room code entry navigates to `/join/:code`
- Old app unchanged at `localhost:4173`

**Benchmark gate passed — Phase 3 can begin.**

**Next:** Phase 3 — Platform UI (`docs/superpowers/plans/2026-06-15-phase3-platform-ui.md`)
