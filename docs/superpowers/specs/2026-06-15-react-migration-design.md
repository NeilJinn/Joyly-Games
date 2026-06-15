# React Migration Design

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Migrate the Joyly Games frontend from vanilla JS to React + TypeScript, replacing JMS with GSAP + Framer Motion, while leaving the Node.js server API completely untouched.

**Architecture:** Layered replacement strategy — build a new React SPA alongside the existing server, migrating one page surface at a time. The server's REST and SSE APIs remain unchanged throughout. Each phase produces a working, testable state.

**Tech Stack:** React 18 · TypeScript · Vite · React Router v6 · Zustand · Tailwind CSS · Framer Motion · GSAP · Vitest

---

## Decisions

| Topic | Decision | Reason |
|---|---|---|
| Migration strategy | Layered replacement (new React app alongside existing server) | Low risk, each phase is independently testable |
| TypeScript | Yes | Better AI agent code generation quality across files |
| JMS | Delete entirely | Replaced by GSAP (game animations) + Framer Motion (UI transitions) |
| State management | Zustand | Lightweight, zero boilerplate, works naturally with SSE events |
| Routing | Single SPA with React Router v6 | All surfaces in one app, clean shared component reuse |
| Styling | Tailwind CSS | Highest AI agent generation quality, no class naming overhead |
| Build tool | Vite | Lightweight, proxies to existing Node.js server, standard setup |
| Testing | Vitest | Same ecosystem as Vite, zero config |
| Server | No changes | REST + SSE API is already clean and well-structured |
| Deleted pages | JMS playground, voice library tool | No longer needed |

---

## What Gets Deleted

- `packages/jms/` — entire directory (JMS motion system)
- `public/voice-library/` — voice library tool page
- `public/jms/` — JMS playground page
- `public/platform/` — old platform JS/HTML (removed after Phase 2)
- `public/players/` — old player JS/HTML (removed after Phase 3)
- `public/games/cosmic-trivia/` old JS/CSS (removed after Phase 4)
- `public/app.js`, `public/index.html` — old root files (removed in Phase 5)

---

## New Project Structure

```
src/
  app/
    App.tsx              # React root with router
    router.tsx           # All route definitions
  pages/
    platform/
      HomePage.tsx       # Host landing page, sign-in
      GamePickerPage.tsx # Game selection modal/page
      PaymentPage.tsx    # Time pass / points payment
      LobbyPage.tsx      # Room lobby, player list, launch button
    player/
      JoinPage.tsx       # Enter room code
      AvatarPage.tsx     # Nickname + avatar selection
      WaitingPage.tsx    # Waiting in lobby on phone
      PlayPage.tsx       # In-game phone interface (routes to game-specific)
    games/
      cosmic-trivia/
        PresentationPage.tsx   # Big screen: question, countdown, scores
        PhonePage.tsx          # Phone: answer buttons
      fate-werewolf/
        PresentationPage.tsx
        PhonePage.tsx
  components/
    ui/                  # Reusable UI: Button, Card, Modal, Avatar, etc.
    room/                # Room code display, QR code, player token
    platform/            # Host controls, account menu
  stores/
    authStore.ts         # Host login state, account info, time pass
    roomStore.ts         # Room code, room status, player list
    playerStore.ts       # Current player identity (nickname, avatar)
    gameStore.ts         # Game phase, scores, current question, Director state
    sseStore.ts          # SSE connection status
  hooks/
    useSSE.ts            # Core SSE hook — connects and routes events to stores
    useRoom.ts           # Room join/leave helpers
    useAuth.ts           # Host auth helpers
  types/
    room.ts              # Room, Player, RoomStatus types
    game.ts              # GamePhase, Score, Question types
    auth.ts              # HostAccount, Entitlement types
  main.tsx               # Vite entry point
index.html               # Vite root HTML
vite.config.ts           # Vite config with server proxy
tailwind.config.ts
tsconfig.json
```

---

## URL Structure

| URL | Who sees it | What it is |
|---|---|---|
| `/` | Host (big screen) | Landing page, sign-in |
| `/room/:code` | Host (big screen) | Lobby + game presentation |
| `/join` | Player (phone) | Enter room code |
| `/join/:code` | Player (phone) | Direct join via QR link |
| `/play/:code` | Player (phone) | In-game phone interface |

Device role is determined by URL path — no device detection needed.

---

## State Management

### Stores

**`authStore`** — host login and entitlement
```ts
{ email, isSignedIn, entitlement: { hasActivePass, passExpiresAt, points } }
```

**`roomStore`** — room state shared across all clients
```ts
{ code, status, players: Player[], game: string | null, hostEmail }
```

**`playerStore`** — current player's own identity (phone only)
```ts
{ playerId, nickname, avatarKey, status: 'joining' | 'ready' | 'playing' }
```

**`gameStore`** — live game state pushed by Director
```ts
{ phase, currentQuestion, scores, timeRemaining, selectedAnswer }
```

**`sseStore`** — connection health
```ts
{ connected, reconnecting, error }
```

### SSE Event Flow

```
Server SSE event arrives
  → useSSE hook receives it
  → Routes by event.type:
      'room-update'   → roomStore.setRoom()
      'player-update' → roomStore.setPlayers()
      'game-phase'    → gameStore.setPhase()
      'scores'        → gameStore.setScores()
      'question'      → gameStore.setQuestion()
  → React components re-render automatically
```

`useSSE(roomCode)` is called once at the room/play page level and cleans up on unmount.

---

## Animation Strategy

**Framer Motion** — everyday UI animations
- Page transitions, modal open/close, button feedback, player join animations
- Declared directly on React components with `motion.div`, `AnimatePresence`

**GSAP** — game "big moment" animations
- Question reveal, answer fly-in, score counting up, victory celebration
- Used in `PresentationPage.tsx` via `useGSAP()` hook with refs
- Timeline-based for precise sequencing matching the Director phase events

---

## Migration Phases

### Phase 1 — Foundation
Set up the new React project skeleton inside the existing repo. Nothing gets deleted yet. Existing `public/` files keep serving.

Deliverables:
- `src/` directory with React + TS + Vite
- Tailwind configured
- React Router with placeholder pages for all routes
- Zustand stores defined (empty/stub state)
- `useSSE` hook connecting to existing server
- Vite dev server proxying API calls to `localhost:4173`
- Vitest configured with one smoke test

### Phase 2 — Platform UI (Host Big Screen)
Migrate all pre-game host screens.

Deliverables:
- `HomePage.tsx` — landing, sign-in form
- `GamePickerPage.tsx` — game selection
- `PaymentPage.tsx` — time pass and points UI
- `LobbyPage.tsx` — room code, QR, player list, launch button
- Shared `ui/` components: Button, Card, Modal, RoomCode, PlayerToken
- `authStore` + `roomStore` wired to real API
- Delete `public/platform/` old files

### Phase 3 — Player Phone UI
Migrate the phone join and in-room flow.

Deliverables:
- `JoinPage.tsx` — room code entry
- `AvatarPage.tsx` — nickname + character selection
- `WaitingPage.tsx` — waiting lobby on phone
- `playerStore` wired to real API
- Delete `public/players/` old files

### Phase 4 — Cosmic Trivia Game
Migrate the game itself — the most animation-heavy phase.

Deliverables:
- `PresentationPage.tsx` — big screen question/countdown/scoring with GSAP animations
- `PhonePage.tsx` — answer buttons, feedback states with Framer Motion
- `gameStore` receiving Director phase events via SSE
- All Cosmic Trivia audio playback preserved
- Delete old `public/games/cosmic-trivia/` JS/CSS files

### Phase 5 — Cleanup
Remove all legacy files and wire up production serving.

Deliverables:
- Delete `packages/jms/`, `public/voice-library/`, `public/jms/`, `public/app.js`, `public/index.html`
- Update `server.js` to serve the Vite build output from `dist/`
- Build script (`npm run build`) produces production bundle
- Fate Werewolf: stub pages in new React app (full rewrite is a separate project)
- All routes tested end-to-end

---

## Server Changes (Minimal)

The only server change needed is in Phase 5: update the static file serving path from `public/` to `dist/` (Vite build output). All API routes, SSE endpoints, and game logic stay exactly as-is.

---

## Out of Scope

- Fate Werewolf full game rewrite (separate project after migration complete)
- Voice library tool (deleted, replaced by external software)
- JMS playground (deleted)
- Backend refactoring
- New features or game content
- Multilingual support
