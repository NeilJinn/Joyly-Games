# React Migration Design Spec

**Goal:** Upgrade the Joyly Games frontend from vanilla JS to React 18 + TypeScript + Vite + Tailwind CSS, preserving all existing visual layouts and functionality exactly. This is a technical upgrade — not a redesign. Layouts, spacing, colors, and component structures are preserved by converting old CSS to equivalent Tailwind classes.

**Architecture:** Layered replacement — build a new React SPA alongside the existing server, migrating one surface at a time. The homepage is migrated first as a benchmark before any further work. The server's REST and SSE APIs stay completely untouched throughout.

**Tech Stack:** React 18 · TypeScript · Vite · React Router v6 · Zustand · Tailwind CSS · Framer Motion · GSAP · Vitest

---

## Core Constraints

1. **Visual fidelity first.** Every migrated page must match the old design at all common viewport sizes before proceeding to the next phase.
2. **Server is frozen.** Zero changes to `server.js` until Phase 6 (static path update only).
3. **Homepage is the benchmark.** Phase 2 ends with a visual review gate. Phase 3 does not start until the homepage passes.
4. **Tailwind replicates, does not redesign.** Use arbitrary-value syntax (`p-[14px]`, `text-[#3a2e5c]`) to match existing CSS values exactly. No creative deviations.

---

## What Gets Deleted

| Path | Reason |
|---|---|
| `packages/jms/` | JMS replaced by GSAP + Framer Motion |
| `public/jms/` | JMS playground no longer needed |
| `public/voice-library/` | Replaced by external software |
| `public/platform/` | Replaced by React (Phase 3) |
| `public/players/` | Replaced by React (Phase 4) |
| `public/games/cosmic-trivia/` JS+CSS | Replaced by React (Phase 5) |
| `public/app.js`, `public/index.html` | Replaced by Vite entry (Phase 6) |

---

## New Project Structure

```
src/
  main.tsx                   # Vite entry point
  App.tsx                    # Router root
  types/
    room.ts                  # Room, Player, RoomStatus types
    game.ts                  # GamePhase, Score, Question types
    auth.ts                  # HostAccount, Entitlement types
    config.ts                # Server config response shape
  stores/
    authStore.ts             # Host account, entitlement, time pass
    roomStore.ts             # Room code, status, player list
    playerStore.ts           # Current device player identity
    gameStore.ts             # Active phase, scores, current question
    sseStore.ts              # SSE connection lifecycle
  hooks/
    useSSE.ts                # Opens SSE, routes events to stores
    useConfig.ts             # Fetches /api/config on mount
    useRoom.ts               # Room-scoped helpers
    useAuth.ts               # Host auth helpers
  pages/
    platform/
      HomePage.tsx           # Landing page + room code entry  ← BENCHMARK
      GamesPage.tsx          # Game store / library
      HowToPlayPage.tsx
      SupportPage.tsx
      CompanyPage.tsx
      LobbyPage.tsx          # Big-screen lobby: QR, player list, launch
    player/
      JoinPage.tsx           # Phone: enter room code
      AvatarPage.tsx         # Phone: nickname + avatar selection
      WaitingPage.tsx        # Phone: waiting for game to start
      InRoomPage.tsx         # Phone: in-game controls container
    games/
      cosmic-trivia/
        BigScreenPage.tsx    # Host big-screen game view
        PhonePage.tsx        # Player phone answer UI
        phases/
          DeckSelectingPhase.tsx
          QuestionIntroPhase.tsx
          AnsweringPhase.tsx
          ScoringPhase.tsx
          CompletePhase.tsx
      fate-werewolf/
        BigScreenPage.tsx    # Stub only
        PhonePage.tsx        # Stub only
  components/
    ui/                      # Button, Card, Modal, Icon
    room/                    # RoomCode, QRCode, PlayerToken
    platform/                # NavBar, GamePicker, PaymentCard, AccountMenu
  styles/
    globals.css              # Tailwind base + font imports + CSS variables
index.html                   # Vite root HTML
vite.config.ts               # Proxy /api → localhost:4173
tailwind.config.ts
tsconfig.json
```

---

## URL Structure

| URL | Device | View |
|---|---|---|
| `/` | Big screen | Home / landing |
| `/games` | Big screen | Game library |
| `/how-to-play` | Big screen | How to play |
| `/support` | Big screen | Support |
| `/company` | Big screen | Company |
| `/room/:code` | Big screen | Lobby → in-game |
| `/join` | Phone | Enter room code |
| `/join/:code` | Phone | Avatar selection |
| `/play/:code` | Phone | In-game controls |

Device role is determined by URL — no device detection logic needed.

---

## State Management

### Store Shapes

**`authStore`**
```ts
{
  email: string | null
  isSignedIn: boolean
  entitlement: {
    points: number
    hasActiveTimePass: boolean
    timePassExpiresAt: number   // unix ms
  }
}
```

**`roomStore`**
```ts
{
  code: string | null
  status: 'waiting' | 'playing' | 'complete' | null
  players: Player[]
  selectedGameId: string | null
  hostEmail: string | null
}
```

**`playerStore`**
```ts
{
  playerId: string | null
  nickname: string
  avatarKey: string
  joinStatus: 'idle' | 'joining' | 'joined' | 'error'
  joinError: string
}
```

**`gameStore`**
```ts
{
  phase: string | null
  currentQuestion: Question | null
  scores: Record<string, number>
  answers: Record<string, string>   // playerId → answer key
  selectedAnswer: string | null     // this device's answer
  questionAudioPath: string | null
  nextQuestionAudioPath: string | null
}
```

**`sseStore`**
```ts
{
  status: 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'error'
  lastEventAt: number | null
}
```

### SSE Event Routing

`useSSE(roomCode)` hook:
1. Opens `EventSource` to `/api/room/:code/events`
2. Routes incoming events to store actions:

```
room-update      → roomStore.setRoom()
player-joined    → roomStore.addPlayer()
player-left      → roomStore.removePlayer()
player-ready     → roomStore.setPlayerReady()
game-phase       → gameStore.setPhase()
game-question    → gameStore.setQuestion()
game-scores      → gameStore.setScores()
game-answer      → gameStore.recordAnswer()
game-complete    → gameStore.setComplete()
```

3. Reconnects with exponential backoff on disconnect
4. Cleans up `EventSource` on unmount

---

## Animation Strategy

### Framer Motion — Everyday UI
- Page enter/exit transitions
- Modal appear/disappear
- Player token joining the lobby ring
- Button press feedback
- Phase transition fades

### GSAP — Game Big Moments
- Question text and option cards fly-in sequence
- Countdown timer animation
- Answer lock-in effect
- Score number count-up + rank changes
- Victory celebration sequence

**Principle:** The existing JMS motion packs define the reference choreography (timing, sequence, feel). GSAP reimplements that choreography. The goal is "feels the same" — not identical frames, but the same rhythm and intent.

---

## Styling Approach

- Before building each component, the agent reads the corresponding old CSS file
- Tailwind classes are chosen to match computed styles exactly
- Non-standard values use arbitrary syntax: `p-[14px]`, `bg-[#1a1035]`, `text-[13px]`
- CSS custom properties (`--color-primary`, etc.) are ported to `globals.css`
- Font imports are preserved in `globals.css`
- No layout changes, no color changes, no spacing changes

---

## Homepage Benchmark (Phase 2 Gate)

The homepage (`/`) is migrated in Phase 2. It serves as the proof-of-concept for the entire migration approach.

**Pass criteria — all must be met before Phase 3 begins:**

1. Visual layout matches the old homepage at mobile, tablet, and desktop widths
2. Room code input → join flow navigates correctly
3. Marketing navigation links route correctly via React Router
4. No console errors on load
5. Framer Motion page entrance animation plays on first load
6. SSE connection established when a room code is active

If any criterion fails, the styling approach or component structure is revised before continuing.

---

## Migration Phases

### Phase 1 — Foundation
**Goal:** Working React skeleton, nothing deleted yet. Old `public/` keeps serving.

- Vite + React + TypeScript scaffold in repo root
- Tailwind + `globals.css` with existing font/variable imports
- React Router with placeholder components for all routes
- Zustand stores defined with correct TypeScript shapes (no real logic)
- `useConfig.ts` fetching `/api/config`
- `useSSE.ts` connecting to server SSE (logging events only)
- Vite dev server proxying `/api` → `localhost:4173`
- Vitest configured with one smoke test

### Phase 2 — Homepage Benchmark ⬅ Gate
**Goal:** Fully working homepage that passes all benchmark criteria.

- `HomePage.tsx` — landing content, room code entry form, navigation
- `GamesPage.tsx`, `HowToPlayPage.tsx`, `SupportPage.tsx`, `CompanyPage.tsx`
- Shared `components/ui/` and `components/platform/NavBar.tsx`
- `authStore` wired to sign-in API
- Framer Motion page transitions
- **Visual benchmark review — must pass before Phase 3**

### Phase 3 — Platform UI (Host Big Screen)
**Goal:** All pre-game host screens working.

- Auth modal (sign-in)
- Game picker modal
- Payment card (time pass + points UI)
- `LobbyPage.tsx` — room code display, QR code, player list, launch button
- `roomStore` wired to room creation + SSE room events
- Host controls: close room, account menu
- Delete `public/platform/` old files

### Phase 4 — Player Phone UI
**Goal:** Full player join and in-room flow.

- `JoinPage.tsx` — room code entry on phone
- `AvatarPage.tsx` — nickname + character selection
- `WaitingPage.tsx` — lobby waiting state
- `InRoomPage.tsx` — in-game phone container
- `playerStore` wired to join + ready API
- Player SSE events (phase changes, disconnects)
- Delete `public/players/` old files

### Phase 5 — Cosmic Trivia Game
**Goal:** Fully playable Cosmic Trivia in the new stack.

- `BigScreenPage.tsx` with all Director phase components
- `PhonePage.tsx` — answer buttons, selection feedback
- `gameStore` receiving all game SSE events
- GSAP animations for question reveal, scoring, victory
- Audio playback preserved and wired to Director phases
- Delete old `public/games/cosmic-trivia/` JS + CSS files

### Phase 6 — Cleanup & Production
**Goal:** All legacy code removed, server serving Vite build.

- Delete `packages/jms/`, `public/jms/`, `public/voice-library/`
- Delete `public/app.js`, `public/index.html`
- Update `server.js`: serve `dist/` instead of `public/`, add SPA fallback for non-API routes
- `npm run build` produces working production bundle
- Fate Werewolf: stub `BigScreenPage` + `PhonePage` in new React structure (full implementation is a separate future project)
- End-to-end manual test: full game loop with 2+ devices

---

## Server Changes

Only one change in Phase 6:
1. Static file serving: `public/` → `dist/` (Vite build output)
2. SPA fallback: serve `dist/index.html` for all non-`/api` routes

All API endpoints, SSE streams, and game logic: untouched.

---

## Out of Scope

- Fate Werewolf full game implementation
- Voice library tool (deleted)
- JMS playground (deleted)
- Backend refactoring or new API endpoints
- New features or game content
- Multilingual support
- Real auth or payment integration
