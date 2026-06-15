# React Migration — Phase 1: Foundation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scaffold the React + TypeScript + Vite + Tailwind project alongside the existing server, with typed Zustand stores, a working SSE hook, and all route placeholders — without touching any existing files.

**Architecture:** Vite dev server runs at port 5173 and proxies `/api` calls to the existing Node.js server at port 4173. The old `public/` app continues to serve at 4173 throughout Phase 1. The new React app is accessed at 5173 during development. The existing `server.js`, `public/`, and all game files are not modified.

**Tech Stack:** React 18 · TypeScript 5 · Vite 5 · React Router v6 · Zustand 4 · Tailwind CSS 3 · Framer Motion 11 · GSAP 3 · Vitest 2

---

## Files Created in This Phase

```
index.html                        Vite root HTML (project root, not public/)
vite.config.ts                    Vite config with API proxy
tsconfig.json                     TypeScript config
tsconfig.node.json                TypeScript config for Vite config file
tailwind.config.ts                Tailwind config
postcss.config.js                 PostCSS config (required by Tailwind)
src/
  main.tsx                        React entry point
  App.tsx                         Router root with all routes
  styles/
    globals.css                   Tailwind base + CSS variables from existing styles
  types/
    config.ts                     Server /api/config response type
    room.ts                       Room, Player types
    game.ts                       GamePhase, Question, Score types
    auth.ts                       HostAccount, Entitlement types
  stores/
    authStore.ts                  Host account + entitlement state
    roomStore.ts                  Room code, status, player list
    playerStore.ts                Current device player identity
    gameStore.ts                  Active game phase, scores, question
    sseStore.ts                   SSE connection status
  hooks/
    useConfig.ts                  Fetches /api/config on mount
    useSSE.ts                     Opens SSE connection, logs events
  pages/
    platform/
      HomePage.tsx                Placeholder
      GamesPage.tsx               Placeholder
      HowToPlayPage.tsx           Placeholder
      SupportPage.tsx             Placeholder
      CompanyPage.tsx             Placeholder
      LobbyPage.tsx               Placeholder
    player/
      JoinPage.tsx                Placeholder
      AvatarPage.tsx              Placeholder
      WaitingPage.tsx             Placeholder
      InRoomPage.tsx              Placeholder
    games/
      cosmic-trivia/
        BigScreenPage.tsx         Placeholder
        PhonePage.tsx             Placeholder
      fate-werewolf/
        BigScreenPage.tsx         Placeholder
        PhonePage.tsx             Placeholder
    NotFoundPage.tsx              404 placeholder
src/__tests__/
  stores.test.ts                  Zustand store shape smoke tests
vitest.config.ts                  Vitest config
```

**Files modified:**
```
package.json                      Add React/Vite/Tailwind dependencies and new scripts
```

**Files NOT touched:**
- `server.js` and all `server/` files
- `public/` directory and all its contents
- `packages/jms/` (still exists, deleted in Phase 6)
- `content/`, `scripts/`, `tools/`

---

### Task 1: Install dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Add React + Vite + Tailwind dependencies to package.json**

Replace the `scripts` block and add `dependencies` and `devDependencies`:

```json
{
  "name": "joyly-games-prototype",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "workspaces": [
    "packages/*"
  ],
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "start": "node server.js",
    "test": "node --test tests/*.test.js",
    "test:ui": "vitest run",
    "test:ui:watch": "vitest",
    "build:trivia": "node scripts/build-cosmic-trivia-pack.js",
    "build:trivia-director-cues": "node scripts/build-cosmic-trivia-director-cues.js",
    "validate:cosmic-trivia": "node scripts/validate-cosmic-trivia-pack.js",
    "generate:cosmic-trivia-host-audio": "node scripts/generate-cosmic-trivia-host-audio.js",
    "generate:cosmic-trivia-question-audio": "node scripts/generate-cosmic-trivia-question-audio.js"
  },
  "dependencies": {
    "framer-motion": "^11.0.0",
    "gsap": "^3.13.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^6.26.0",
    "zustand": "^4.5.0"
  },
  "devDependencies": {
    "@types/react": "^18.3.3",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.1",
    "autoprefixer": "^10.4.19",
    "postcss": "^8.4.38",
    "tailwindcss": "^3.4.4",
    "typescript": "^5.5.3",
    "vite": "^5.4.0",
    "@testing-library/react": "^16.0.0",
    "@testing-library/jest-dom": "^6.4.0",
    "jsdom": "^24.1.0",
    "vitest": "^2.0.0"
  }
}
```

- [ ] **Step 2: Install dependencies**

```bash
npm install
```

Expected: packages installed, no errors. Ignore workspace warnings about `packages/jms`.

---

### Task 2: Vite, TypeScript, Tailwind config

**Files:**
- Create: `vite.config.ts`
- Create: `tsconfig.json`
- Create: `tsconfig.node.json`
- Create: `tailwind.config.ts`
- Create: `postcss.config.js`

- [ ] **Step 1: Create `vite.config.ts`**

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:4173",
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: "dist",
  },
});
```

- [ ] **Step 2: Create `tsconfig.json`**

```json
{
  "files": [],
  "references": [
    { "path": "./tsconfig.app.json" },
    { "path": "./tsconfig.node.json" }
  ]
}
```

- [ ] **Step 3: Create `tsconfig.app.json`**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src"]
}
```

- [ ] **Step 4: Create `tsconfig.node.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2023"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["vite.config.ts"]
}
```

- [ ] **Step 5: Create `tailwind.config.ts`**

```ts
import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {},
  },
  plugins: [],
} satisfies Config;
```

- [ ] **Step 6: Create `postcss.config.js`**

```js
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

---

### Task 3: Root HTML and global styles

**Files:**
- Create: `index.html`
- Create: `src/styles/globals.css`

- [ ] **Step 1: Create `index.html`** at project root (not inside `public/`)

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Joyly Games</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Baloo+2:wght@400;500;600;700;800&display=swap"
      rel="stylesheet"
    />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 2: Create `src/styles/globals.css`**

Ports all CSS custom properties and base styles from `public/platform/styles.css` into the Tailwind entry file:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  color-scheme: dark;
  --bg: #0c0f14;
  --panel: #172033;
  --panel-2: #25324b;
  --ink: #fff8e8;
  --muted: #b8c8d2;
  --line: #3c4962;
  --green: #85d95f;
  --cyan: #74d5e8;
  --orange: #f7b84a;
  --red: #ff7a59;
  --violet: #c084fc;
  --sun: #ffd166;
  --outline: #09121c;
  --cream-paper: #fff3df;
  --paper-edge: rgba(255, 248, 232, 0.34);
  --paper-shadow: 0 7px 0 rgba(3, 8, 14, 0.28), 0 18px 42px rgba(0, 0, 0, 0.28);
  --shadow: 0 18px 60px rgba(0, 0, 0, 0.35);
  --brand-mark: url("/assets/brand/joyly-logo.png");
  --hero-paper: url("/assets/brand/paper-hills-dark.svg");
  --cover-cosmic-trivia: url("/assets/games/cosmic-trivia/cover.svg");
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  min-height: 100vh;
  background:
    radial-gradient(circle at 18% 8%, rgba(255, 248, 232, 0.06) 0 1px, transparent 2px),
    radial-gradient(circle at 72% 22%, rgba(255, 248, 232, 0.05) 0 1px, transparent 2px),
    linear-gradient(135deg, rgba(116, 213, 232, 0.16) 0 12%, transparent 12% 100%),
    linear-gradient(225deg, rgba(255, 209, 102, 0.18) 0 10%, transparent 10% 100%),
    radial-gradient(circle at 12% 0%, rgba(255, 122, 89, 0.18), transparent 24rem),
    linear-gradient(180deg, #17243b 0%, var(--bg) 52%, #090e17 100%);
  color: var(--ink);
  font-family: Inter, "Baloo 2", ui-sans-serif, system-ui, -apple-system,
    BlinkMacSystemFont, "Segoe UI", sans-serif;
  letter-spacing: 0;
}

html[data-device-view="mobile"] body {
  background: #05070b;
}

html[data-device-view="mobile"] #root {
  width: min(430px, 100vw);
  min-height: 100vh;
  margin: 0 auto;
  overflow-x: hidden;
  overflow-y: auto;
  border-left: 1px solid rgba(255, 255, 255, 0.12);
  border-right: 1px solid rgba(255, 255, 255, 0.12);
  box-shadow: 0 0 80px rgba(0, 0, 0, 0.55);
}

button,
input,
select {
  font: inherit;
}

button {
  border: 0;
  cursor: pointer;
}
```

---

### Task 4: TypeScript type definitions

**Files:**
- Create: `src/types/config.ts`
- Create: `src/types/room.ts`
- Create: `src/types/game.ts`
- Create: `src/types/auth.ts`

- [ ] **Step 1: Create `src/types/config.ts`**

```ts
export interface GameConfig {
  id: string;
  name: string;
  playable: boolean;
  minPlayers: number;
  maxPlayers: number;
}

export interface AppConfig {
  games: GameConfig[];
  localJoinBase: string;
  tools: {
    jmsStudio: boolean;
    voiceLibrary: boolean;
  };
}
```

- [ ] **Step 2: Create `src/types/room.ts`**

```ts
export type RoomStatus = "waiting" | "playing" | "complete";

export interface Player {
  id: string;
  nickname: string;
  avatarKey: string;
  ready: boolean;
  connected: boolean;
}

export interface Room {
  code: string;
  status: RoomStatus;
  players: Player[];
  selectedGameId: string | null;
  hostEmail: string | null;
}
```

- [ ] **Step 3: Create `src/types/game.ts`**

```ts
export type GamePhase =
  | "deck-selecting"
  | "interest-selecting"
  | "preferences-locked"
  | "question-intro"
  | "question-audio"
  | "answering"
  | "scoring"
  | "next-question"
  | "complete";

export interface AnswerOption {
  key: string;
  text: string;
}

export interface Question {
  id: string;
  category: string;
  difficulty: string;
  question: string;
  answers: AnswerOption[];
  correctAnswer: string;
  questionAudioPath: string | null;
}

export interface ScoreEntry {
  playerId: string;
  score: number;
  delta: number;
  correct: boolean;
}
```

- [ ] **Step 4: Create `src/types/auth.ts`**

```ts
export interface Entitlement {
  points: number;
  hasActiveTimePass: boolean;
  timePassExpiresAt: number;
}

export interface HostAccount {
  email: string;
  displayName: string;
}
```

- [ ] **Step 5: Commit types**

```bash
git add src/types/
git commit -m "feat(react): add TypeScript type definitions"
```

---

### Task 5: Zustand stores

**Files:**
- Create: `src/stores/authStore.ts`
- Create: `src/stores/roomStore.ts`
- Create: `src/stores/playerStore.ts`
- Create: `src/stores/gameStore.ts`
- Create: `src/stores/sseStore.ts`

- [ ] **Step 1: Create `src/stores/authStore.ts`**

```ts
import { create } from "zustand";
import type { Entitlement, HostAccount } from "../types/auth";

interface AuthState {
  account: HostAccount | null;
  isSignedIn: boolean;
  entitlement: Entitlement;
  setAccount: (account: HostAccount) => void;
  clearAccount: () => void;
  setEntitlement: (entitlement: Entitlement) => void;
}

const DEFAULT_ENTITLEMENT: Entitlement = {
  points: 120,
  hasActiveTimePass: false,
  timePassExpiresAt: 0,
};

export const useAuthStore = create<AuthState>()((set) => ({
  account: null,
  isSignedIn: false,
  entitlement: DEFAULT_ENTITLEMENT,
  setAccount: (account) => set({ account, isSignedIn: true }),
  clearAccount: () =>
    set({ account: null, isSignedIn: false, entitlement: DEFAULT_ENTITLEMENT }),
  setEntitlement: (entitlement) => set({ entitlement }),
}));
```

- [ ] **Step 2: Create `src/stores/roomStore.ts`**

```ts
import { create } from "zustand";
import type { Room, Player } from "../types/room";

interface RoomState {
  room: Room | null;
  setRoom: (room: Room) => void;
  addPlayer: (player: Player) => void;
  removePlayer: (playerId: string) => void;
  setPlayerReady: (playerId: string, ready: boolean) => void;
  clearRoom: () => void;
}

export const useRoomStore = create<RoomState>()((set) => ({
  room: null,
  setRoom: (room) => set({ room }),
  addPlayer: (player) =>
    set((state) => {
      if (!state.room) return state;
      const exists = state.room.players.some((p) => p.id === player.id);
      const players = exists
        ? state.room.players.map((p) => (p.id === player.id ? player : p))
        : [...state.room.players, player];
      return { room: { ...state.room, players } };
    }),
  removePlayer: (playerId) =>
    set((state) => {
      if (!state.room) return state;
      return {
        room: {
          ...state.room,
          players: state.room.players.filter((p) => p.id !== playerId),
        },
      };
    }),
  setPlayerReady: (playerId, ready) =>
    set((state) => {
      if (!state.room) return state;
      return {
        room: {
          ...state.room,
          players: state.room.players.map((p) =>
            p.id === playerId ? { ...p, ready } : p
          ),
        },
      };
    }),
  clearRoom: () => set({ room: null }),
}));
```

- [ ] **Step 3: Create `src/stores/playerStore.ts`**

```ts
import { create } from "zustand";

type JoinStatus = "idle" | "joining" | "joined" | "error";

interface PlayerState {
  playerId: string | null;
  nickname: string;
  avatarKey: string;
  joinStatus: JoinStatus;
  joinError: string;
  setIdentity: (playerId: string, nickname: string, avatarKey: string) => void;
  setJoinStatus: (status: JoinStatus, error?: string) => void;
  clearIdentity: () => void;
}

export const usePlayerStore = create<PlayerState>()((set) => ({
  playerId: null,
  nickname: "",
  avatarKey: "",
  joinStatus: "idle",
  joinError: "",
  setIdentity: (playerId, nickname, avatarKey) =>
    set({ playerId, nickname, avatarKey, joinStatus: "joined", joinError: "" }),
  setJoinStatus: (status, error = "") =>
    set({ joinStatus: status, joinError: error }),
  clearIdentity: () =>
    set({
      playerId: null,
      nickname: "",
      avatarKey: "",
      joinStatus: "idle",
      joinError: "",
    }),
}));
```

- [ ] **Step 4: Create `src/stores/gameStore.ts`**

```ts
import { create } from "zustand";
import type { GamePhase, Question, ScoreEntry } from "../types/game";

interface GameState {
  phase: GamePhase | null;
  currentQuestion: Question | null;
  scores: ScoreEntry[];
  answers: Record<string, string>;
  selectedAnswer: string | null;
  questionAudioPath: string | null;
  nextQuestionAudioPath: string | null;
  setPhase: (phase: GamePhase) => void;
  setQuestion: (question: Question, nextAudioPath?: string | null) => void;
  setScores: (scores: ScoreEntry[]) => void;
  recordAnswer: (playerId: string, answerKey: string) => void;
  setSelectedAnswer: (key: string) => void;
  clearGame: () => void;
}

export const useGameStore = create<GameState>()((set) => ({
  phase: null,
  currentQuestion: null,
  scores: [],
  answers: {},
  selectedAnswer: null,
  questionAudioPath: null,
  nextQuestionAudioPath: null,
  setPhase: (phase) => set({ phase }),
  setQuestion: (question, nextAudioPath = null) =>
    set({
      currentQuestion: question,
      questionAudioPath: question.questionAudioPath,
      nextQuestionAudioPath: nextAudioPath,
      answers: {},
      selectedAnswer: null,
    }),
  setScores: (scores) => set({ scores }),
  recordAnswer: (playerId, answerKey) =>
    set((state) => ({
      answers: { ...state.answers, [playerId]: answerKey },
    })),
  setSelectedAnswer: (key) => set({ selectedAnswer: key }),
  clearGame: () =>
    set({
      phase: null,
      currentQuestion: null,
      scores: [],
      answers: {},
      selectedAnswer: null,
      questionAudioPath: null,
      nextQuestionAudioPath: null,
    }),
}));
```

- [ ] **Step 5: Create `src/stores/sseStore.ts`**

```ts
import { create } from "zustand";

type SSEStatus = "idle" | "connecting" | "connected" | "reconnecting" | "error";

interface SSEState {
  status: SSEStatus;
  lastEventAt: number | null;
  setStatus: (status: SSEStatus) => void;
  recordEvent: () => void;
}

export const useSSEStore = create<SSEState>()((set) => ({
  status: "idle",
  lastEventAt: null,
  setStatus: (status) => set({ status }),
  recordEvent: () => set({ lastEventAt: Date.now() }),
}));
```

- [ ] **Step 6: Commit stores**

```bash
git add src/stores/
git commit -m "feat(react): add Zustand stores for auth, room, player, game, sse"
```

---

### Task 6: Hooks

**Files:**
- Create: `src/hooks/useConfig.ts`
- Create: `src/hooks/useSSE.ts`

- [ ] **Step 1: Create `src/hooks/useConfig.ts`**

```ts
import { useEffect, useState } from "react";
import type { AppConfig } from "../types/config";

const DEFAULT_CONFIG: AppConfig = {
  games: [],
  localJoinBase: window.location.origin,
  tools: { jmsStudio: false, voiceLibrary: false },
};

export function useConfig() {
  const [config, setConfig] = useState<AppConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/config")
      .then((r) => r.json())
      .then((data: AppConfig) => setConfig(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return { config, loading };
}
```

- [ ] **Step 2: Create `src/hooks/useSSE.ts`**

```ts
import { useEffect, useRef } from "react";
import { useSSEStore } from "../stores/sseStore";
import { useRoomStore } from "../stores/roomStore";
import { useGameStore } from "../stores/gameStore";
import type { Room, Player } from "../types/room";
import type { GamePhase, Question, ScoreEntry } from "../types/game";

const RECONNECT_DELAYS = [1000, 2000, 4000, 8000, 16000];

export function useSSE(roomCode: string | null) {
  const setStatus = useSSEStore((s) => s.setStatus);
  const recordEvent = useSSEStore((s) => s.recordEvent);
  const setRoom = useRoomStore((s) => s.setRoom);
  const addPlayer = useRoomStore((s) => s.addPlayer);
  const removePlayer = useRoomStore((s) => s.removePlayer);
  const setPlayerReady = useRoomStore((s) => s.setPlayerReady);
  const setPhase = useGameStore((s) => s.setPhase);
  const setQuestion = useGameStore((s) => s.setQuestion);
  const setScores = useGameStore((s) => s.setScores);
  const recordAnswer = useGameStore((s) => s.recordAnswer);

  const retryCount = useRef(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!roomCode) return;

    let es: EventSource | null = null;
    let cancelled = false;

    function connect() {
      if (cancelled) return;
      setStatus("connecting");
      es = new EventSource(`/api/room/${roomCode}/events`);

      es.onopen = () => {
        if (cancelled) return;
        setStatus("connected");
        retryCount.current = 0;
      };

      es.onmessage = (evt) => {
        if (cancelled) return;
        recordEvent();
        try {
          const msg = JSON.parse(evt.data) as { type: string; payload: unknown };
          routeEvent(msg.type, msg.payload);
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

    function routeEvent(type: string, payload: unknown) {
      switch (type) {
        case "room-update":
          setRoom(payload as Room);
          break;
        case "player-joined":
          addPlayer(payload as Player);
          break;
        case "player-left":
          removePlayer((payload as { id: string }).id);
          break;
        case "player-ready":
          setPlayerReady(
            (payload as { id: string; ready: boolean }).id,
            (payload as { id: string; ready: boolean }).ready
          );
          break;
        case "game-phase":
          setPhase((payload as { phase: GamePhase }).phase);
          break;
        case "game-question":
          setQuestion(
            (payload as { question: Question; nextAudioPath?: string }).question,
            (payload as { question: Question; nextAudioPath?: string })
              .nextAudioPath
          );
          break;
        case "game-scores":
          setScores(payload as ScoreEntry[]);
          break;
        case "game-answer":
          recordAnswer(
            (payload as { playerId: string; answerKey: string }).playerId,
            (payload as { playerId: string; answerKey: string }).answerKey
          );
          break;
        default:
          break;
      }
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

- [ ] **Step 3: Commit hooks**

```bash
git add src/hooks/
git commit -m "feat(react): add useConfig and useSSE hooks"
```

---

### Task 7: Placeholder pages

**Files:**
- Create: all files listed in the pages section above

- [ ] **Step 1: Create a shared placeholder component template**

Each placeholder page follows this pattern. Create all pages with this structure:

`src/pages/platform/HomePage.tsx`:
```tsx
export default function HomePage() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <p className="text-[var(--muted)]">Home — coming in Phase 2</p>
    </div>
  );
}
```

`src/pages/platform/GamesPage.tsx`:
```tsx
export default function GamesPage() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <p className="text-[var(--muted)]">Games — coming in Phase 3</p>
    </div>
  );
}
```

`src/pages/platform/HowToPlayPage.tsx`:
```tsx
export default function HowToPlayPage() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <p className="text-[var(--muted)]">How To Play — coming in Phase 3</p>
    </div>
  );
}
```

`src/pages/platform/SupportPage.tsx`:
```tsx
export default function SupportPage() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <p className="text-[var(--muted)]">Support — coming in Phase 3</p>
    </div>
  );
}
```

`src/pages/platform/CompanyPage.tsx`:
```tsx
export default function CompanyPage() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <p className="text-[var(--muted)]">Company — coming in Phase 3</p>
    </div>
  );
}
```

`src/pages/platform/LobbyPage.tsx`:
```tsx
export default function LobbyPage() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <p className="text-[var(--muted)]">Lobby — coming in Phase 3</p>
    </div>
  );
}
```

`src/pages/player/JoinPage.tsx`:
```tsx
export default function JoinPage() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <p className="text-[var(--muted)]">Join — coming in Phase 4</p>
    </div>
  );
}
```

`src/pages/player/AvatarPage.tsx`:
```tsx
export default function AvatarPage() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <p className="text-[var(--muted)]">Avatar — coming in Phase 4</p>
    </div>
  );
}
```

`src/pages/player/WaitingPage.tsx`:
```tsx
export default function WaitingPage() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <p className="text-[var(--muted)]">Waiting — coming in Phase 4</p>
    </div>
  );
}
```

`src/pages/player/InRoomPage.tsx`:
```tsx
export default function InRoomPage() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <p className="text-[var(--muted)]">In Room — coming in Phase 4</p>
    </div>
  );
}
```

`src/pages/games/cosmic-trivia/BigScreenPage.tsx`:
```tsx
export default function CosmicTriviaBigScreen() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <p className="text-[var(--muted)]">Cosmic Trivia — coming in Phase 5</p>
    </div>
  );
}
```

`src/pages/games/cosmic-trivia/PhonePage.tsx`:
```tsx
export default function CosmicTriviaPhone() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <p className="text-[var(--muted)]">Cosmic Trivia Phone — coming in Phase 5</p>
    </div>
  );
}
```

`src/pages/games/fate-werewolf/BigScreenPage.tsx`:
```tsx
export default function FateWerewolfBigScreen() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <p className="text-[var(--muted)]">Fate Werewolf — stub</p>
    </div>
  );
}
```

`src/pages/games/fate-werewolf/PhonePage.tsx`:
```tsx
export default function FateWerewolfPhone() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <p className="text-[var(--muted)]">Fate Werewolf Phone — stub</p>
    </div>
  );
}
```

`src/pages/NotFoundPage.tsx`:
```tsx
export default function NotFoundPage() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <p className="text-[var(--muted)]">404 — Page not found</p>
    </div>
  );
}
```

- [ ] **Step 2: Commit placeholder pages**

```bash
git add src/pages/
git commit -m "feat(react): add placeholder pages for all routes"
```

---

### Task 8: App root and router

**Files:**
- Create: `src/main.tsx`
- Create: `src/App.tsx`

- [ ] **Step 1: Create `src/main.tsx`**

```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles/globals.css";
import App from "./App";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
```

- [ ] **Step 2: Create `src/App.tsx`**

```tsx
import { BrowserRouter, Routes, Route } from "react-router-dom";
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

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Platform — big screen */}
        <Route path="/" element={<HomePage />} />
        <Route path="/games" element={<GamesPage />} />
        <Route path="/how-to-play" element={<HowToPlayPage />} />
        <Route path="/support" element={<SupportPage />} />
        <Route path="/company" element={<CompanyPage />} />
        <Route path="/room/:code" element={<LobbyPage />} />

        {/* Player — phone */}
        <Route path="/join" element={<JoinPage />} />
        <Route path="/join/:code" element={<AvatarPage />} />
        <Route path="/play/:code" element={<InRoomPage />} />
        <Route path="/waiting/:code" element={<WaitingPage />} />

        {/* Games */}
        <Route path="/game/cosmic-trivia/:code" element={<CosmicTriviaBigScreen />} />
        <Route path="/game/cosmic-trivia/:code/phone" element={<CosmicTriviaPhone />} />
        <Route path="/game/fate-werewolf/:code" element={<FateWerewolfBigScreen />} />
        <Route path="/game/fate-werewolf/:code/phone" element={<FateWerewolfPhone />} />

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  );
}
```

- [ ] **Step 3: Commit App root**

```bash
git add src/main.tsx src/App.tsx
git commit -m "feat(react): add React root and router with all route definitions"
```

---

### Task 9: Vitest setup and smoke tests

**Files:**
- Create: `vitest.config.ts`
- Create: `src/__tests__/stores.test.ts`

- [ ] **Step 1: Create `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: [],
  },
});
```

- [ ] **Step 2: Create `src/__tests__/stores.test.ts`**

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { useAuthStore } from "../stores/authStore";
import { useRoomStore } from "../stores/roomStore";
import { usePlayerStore } from "../stores/playerStore";
import { useGameStore } from "../stores/gameStore";
import { useSSEStore } from "../stores/sseStore";

beforeEach(() => {
  useAuthStore.setState({
    account: null,
    isSignedIn: false,
    entitlement: { points: 120, hasActiveTimePass: false, timePassExpiresAt: 0 },
  });
  useRoomStore.setState({ room: null });
  usePlayerStore.setState({
    playerId: null,
    nickname: "",
    avatarKey: "",
    joinStatus: "idle",
    joinError: "",
  });
  useGameStore.setState({
    phase: null,
    currentQuestion: null,
    scores: [],
    answers: {},
    selectedAnswer: null,
    questionAudioPath: null,
    nextQuestionAudioPath: null,
  });
  useSSEStore.setState({ status: "idle", lastEventAt: null });
});

describe("authStore", () => {
  it("starts unauthenticated with default entitlement", () => {
    const { isSignedIn, account, entitlement } = useAuthStore.getState();
    expect(isSignedIn).toBe(false);
    expect(account).toBeNull();
    expect(entitlement.points).toBe(120);
    expect(entitlement.hasActiveTimePass).toBe(false);
  });

  it("setAccount marks host as signed in", () => {
    useAuthStore.getState().setAccount({ email: "host@test.com", displayName: "Host" });
    const { isSignedIn, account } = useAuthStore.getState();
    expect(isSignedIn).toBe(true);
    expect(account?.email).toBe("host@test.com");
  });

  it("clearAccount resets to default state", () => {
    useAuthStore.getState().setAccount({ email: "host@test.com", displayName: "Host" });
    useAuthStore.getState().clearAccount();
    const { isSignedIn, account } = useAuthStore.getState();
    expect(isSignedIn).toBe(false);
    expect(account).toBeNull();
  });
});

describe("roomStore", () => {
  it("starts with no room", () => {
    expect(useRoomStore.getState().room).toBeNull();
  });

  it("setRoom stores the room", () => {
    useRoomStore.getState().setRoom({
      code: "123456",
      status: "waiting",
      players: [],
      selectedGameId: null,
      hostEmail: "host@test.com",
    });
    expect(useRoomStore.getState().room?.code).toBe("123456");
  });

  it("addPlayer appends a new player", () => {
    useRoomStore.getState().setRoom({
      code: "123456",
      status: "waiting",
      players: [],
      selectedGameId: null,
      hostEmail: null,
    });
    useRoomStore.getState().addPlayer({
      id: "p1",
      nickname: "Alice",
      avatarKey: "cat",
      ready: false,
      connected: true,
    });
    expect(useRoomStore.getState().room?.players).toHaveLength(1);
    expect(useRoomStore.getState().room?.players[0].nickname).toBe("Alice");
  });

  it("setPlayerReady updates the player's ready flag", () => {
    useRoomStore.getState().setRoom({
      code: "123456",
      status: "waiting",
      players: [{ id: "p1", nickname: "Alice", avatarKey: "cat", ready: false, connected: true }],
      selectedGameId: null,
      hostEmail: null,
    });
    useRoomStore.getState().setPlayerReady("p1", true);
    expect(useRoomStore.getState().room?.players[0].ready).toBe(true);
  });
});

describe("playerStore", () => {
  it("starts with no identity", () => {
    const { playerId, joinStatus } = usePlayerStore.getState();
    expect(playerId).toBeNull();
    expect(joinStatus).toBe("idle");
  });

  it("setIdentity stores player info and marks joined", () => {
    usePlayerStore.getState().setIdentity("p1", "Alice", "cat");
    const { playerId, nickname, joinStatus } = usePlayerStore.getState();
    expect(playerId).toBe("p1");
    expect(nickname).toBe("Alice");
    expect(joinStatus).toBe("joined");
  });
});

describe("gameStore", () => {
  it("starts with no active game", () => {
    expect(useGameStore.getState().phase).toBeNull();
    expect(useGameStore.getState().currentQuestion).toBeNull();
  });

  it("setPhase updates the phase", () => {
    useGameStore.getState().setPhase("answering");
    expect(useGameStore.getState().phase).toBe("answering");
  });

  it("recordAnswer adds player answer", () => {
    useGameStore.getState().recordAnswer("p1", "b");
    expect(useGameStore.getState().answers["p1"]).toBe("b");
  });
});

describe("sseStore", () => {
  it("starts idle", () => {
    expect(useSSEStore.getState().status).toBe("idle");
    expect(useSSEStore.getState().lastEventAt).toBeNull();
  });

  it("recordEvent sets lastEventAt", () => {
    useSSEStore.getState().recordEvent();
    expect(useSSEStore.getState().lastEventAt).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 3: Run tests — verify they pass**

```bash
npm run test:ui
```

Expected output:
```
✓ src/__tests__/stores.test.ts (12 tests)

Test Files  1 passed (1)
Tests       12 passed (12)
```

- [ ] **Step 4: Commit test setup**

```bash
git add vitest.config.ts src/__tests__/
git commit -m "test(react): add Vitest setup and Zustand store smoke tests"
```

---

### Task 10: Verify dev server starts

- [ ] **Step 1: Start the existing Node.js server** (in one terminal)

```bash
node server.js
```

Expected: `Server running on http://0.0.0.0:4173`

- [ ] **Step 2: Start the Vite dev server** (in another terminal)

```bash
npm run dev
```

Expected output includes:
```
  ➜  Local:   http://localhost:5173/
  ➜  Network: ...
```

- [ ] **Step 3: Open the React app**

Visit `http://localhost:5173/` in a browser.

Expected:
- Dark background (from `globals.css`)
- Text: "Home — coming in Phase 2"
- No console errors

- [ ] **Step 4: Verify API proxy works**

Visit `http://localhost:5173/api/config` in a browser.

Expected: JSON response listing available games (proxied from `localhost:4173`).

- [ ] **Step 5: Verify all routes render**

Visit each of these URLs and confirm each shows its placeholder text with no errors:
- `http://localhost:5173/games`
- `http://localhost:5173/room/123456`
- `http://localhost:5173/join`
- `http://localhost:5173/join/123456`

- [ ] **Step 6: Final commit**

```bash
git add index.html vite.config.ts tsconfig.json tsconfig.app.json tsconfig.node.json tailwind.config.ts postcss.config.js src/styles/ package.json
git commit -m "feat(react): Phase 1 complete — React + Vite + Tailwind + Zustand foundation"
```

---

## Phase 1 Complete

At this point:
- React app runs at `localhost:5173`
- All routes are defined and render placeholder pages
- All Zustand stores are typed and tested
- `useSSE` hook is wired up (connects but doesn't update UI yet)
- API proxy working — Vite calls hit the real `server.js`
- Old app still works unchanged at `localhost:4173`
- 12 store tests passing

**Next:** Phase 2 — Homepage Benchmark (`docs/superpowers/plans/2026-06-15-phase2-homepage-benchmark.md`)
