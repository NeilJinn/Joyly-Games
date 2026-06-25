# Joyly Project Restructure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reorganize Joyly into platform / room / games / dev-tools layers; each game is a fully self-contained package with its own client, server, and assets.

**Architecture:** No shared code between games — each game owns everything game-specific. Platform handles auth/payment/discovery. Room manages pairing and cross-game player state. Games reference cross-layer types (`src/types/room`, `src/types/player`) via relative imports but own all game-specific code. **No path aliases exist anywhere** — all imports are relative paths, so every file move requires updating every caller.

**Tech Stack:** React 18 + Vite 5, Node.js ESM, TypeScript 5, Tailwind, Zustand

**Verification command after each phase:** `npm run build && npm test && npm run test:ui`

---

## Complete File Move Reference Table

| # | Source (current) | Destination (target) | Files that reference this (must update imports) |
|---|-----------------|---------------------|------------------------------------------------|
| **PHASE 1 — CLEANUP** | | | |
| 1.1 | All `* 2.*` files (dozens) | DELETE | none |
| 1.2 | `node_modules 2/` | DELETE | none |
| 1.3 | `render 2.yaml` | DELETE | none |
| 1.4 | `src/pages/games/fate-werewolf/BigScreenPage.tsx` | DELETE (empty shell) | none |
| 1.5 | `src/pages/games/fate-werewolf/PhonePage.tsx` | DELETE (empty shell) | none |
| 1.6 | `server/games/fate-werewolf 2.js` | DELETE | none |
| 1.7 | `server/games/cosmic-trivia 2.js` | DELETE | none |
| **PHASE 2 — cosmic-trivia GAME PACKAGE** | | | |
| 2.1 | `src/pages/games/cosmic-trivia/BigScreenPage.tsx` | `games/cosmic-trivia/client/BigScreenPage.tsx` | `src/pages/platform/LobbyPage.tsx` |
| 2.2 | `src/pages/games/cosmic-trivia/PhonePage.tsx` | `games/cosmic-trivia/client/PhonePage.tsx` | `src/pages/player/InRoomPage.tsx`, `src/components/platform/HostPhoneLobbyView.tsx` |
| 2.3 | `src/components/games/cosmic-trivia/AnswerGrid.tsx` | `games/cosmic-trivia/client/components/AnswerGrid.tsx` | BigScreenPage, PhonePage (moving with them) |
| 2.4 | `src/components/games/cosmic-trivia/CountdownBar.tsx` | `games/cosmic-trivia/client/components/CountdownBar.tsx` | BigScreenPage |
| 2.5 | `src/components/games/cosmic-trivia/PhoneSadEmojiRain.tsx` | `games/cosmic-trivia/client/components/PhoneSadEmojiRain.tsx` | PhonePage |
| 2.6 | `src/components/games/cosmic-trivia/PreferencesPicker.tsx` | `games/cosmic-trivia/client/components/PreferencesPicker.tsx` | PhonePage |
| 2.7 | `src/components/games/cosmic-trivia/ScoreBurstOverlay.tsx` | `games/cosmic-trivia/client/components/ScoreBurstOverlay.tsx` | BigScreenPage |
| 2.8 | `src/components/games/cosmic-trivia/ScoreRow.tsx` | `games/cosmic-trivia/client/components/ScoreRow.tsx` | BigScreenPage |
| 2.9 | `src/components/games/cosmic-trivia/WinnerBoard.tsx` | `games/cosmic-trivia/client/components/WinnerBoard.tsx` | BigScreenPage |
| 2.10 | `src/components/ui/ConfettiRain.tsx` | `games/cosmic-trivia/client/components/ConfettiRain.tsx` | BigScreenPage, PhonePage (moving) |
| 2.11 | `src/components/ui/Joyly01Overlay.tsx` | `games/cosmic-trivia/client/components/Joyly01Overlay.tsx` | BigScreenPage, PhonePage (moving) |
| 2.12 | `src/hooks/useCosmicTriviaDirector.ts` | `games/cosmic-trivia/client/hooks/useCosmicTriviaDirector.ts` | BigScreenPage (moving) |
| 2.13 | `src/hooks/useCountdown.ts` | `games/cosmic-trivia/client/hooks/useCountdown.ts` | CountdownBar (moving) |
| 2.14 | `src/hooks/useEmojiParticles.ts` | `games/cosmic-trivia/client/hooks/useEmojiParticles.ts` | useCosmicTriviaDirector (moving) |
| 2.15 | `src/lib/director/` (all files) | `games/cosmic-trivia/client/lib/director/` | useCosmicTriviaDirector (moving) |
| 2.16 | `src/types/cosmic-trivia.ts` | `games/cosmic-trivia/shared/types.ts` | BigScreenPage, PhonePage, components, hooks (all moving) |
| 2.17 | `src/__tests__/director-cue-library.test.ts` | `games/cosmic-trivia/client/__tests__/director-cue-library.test.ts` | vitest.config.ts (update include path) |
| 2.18 | `src/__tests__/director-flow.test.ts` | `games/cosmic-trivia/client/__tests__/director-flow.test.ts` | vitest.config.ts |
| 2.19 | `server/games/cosmic-trivia.js` | `games/cosmic-trivia/server/index.js` | `server/games/registry.js` |
| 2.20 | `server/games/cosmic-trivia/content-loader.js` | `games/cosmic-trivia/server/content-loader.js` | index.js (updating), flow.js, question-selector.js |
| 2.21 | `server/games/cosmic-trivia/director.js` | `games/cosmic-trivia/server/director.js` | index.js, flow.js, state.js |
| 2.22 | `server/games/cosmic-trivia/events.js` | `games/cosmic-trivia/server/events.js` | (check if referenced) |
| 2.23 | `server/games/cosmic-trivia/flow.js` | `games/cosmic-trivia/server/flow.js` | index.js |
| 2.24 | `server/games/cosmic-trivia/question-history.js` | `games/cosmic-trivia/server/question-history.js` | index.js, flow.js |
| 2.25 | `server/games/cosmic-trivia/question-selector.js` | `games/cosmic-trivia/server/question-selector.js` | flow.js |
| 2.26 | `server/games/cosmic-trivia/scoring.js` | `games/cosmic-trivia/server/scoring.js` | index.js, flow.js |
| 2.27 | `server/games/cosmic-trivia/state.js` | `games/cosmic-trivia/server/state.js` | index.js, flow.js, scoring.js, summaries.js |
| 2.28 | `server/games/cosmic-trivia/summaries.js` | `games/cosmic-trivia/server/summaries.js` | flow.js |
| **PHASE 3 — DEV-TOOLS ISOLATION** | | | |
| 3.1 | `demos/` | `dev-tools/demos/` | none (standalone HTML files) |
| 3.2 | `public/demos/` | `dev-tools/demos/` (merge) | `server.js` (remove static serve of /demos) |
| 3.3 | `server/voice-library/catalog.js` | `dev-tools/voice-library/server/catalog.js` | `server.js` |
| 3.4 | `server/voice-library/regenerate.js` | `dev-tools/voice-library/server/regenerate.js` | `server.js` |
| 3.5 | `server/voice-library/review-state.js` | `dev-tools/voice-library/server/review-state.js` | `server.js` |
| 3.6 | `server/voice-library/sqlite-store.js` | `dev-tools/voice-library/server/sqlite-store.js` | `server.js` |
| 3.7 | `server/voice-library/text.js` | `dev-tools/voice-library/server/text.js` | regenerate.js, review-state.js |
| 3.8 | `public/voice-library/` | `dev-tools/voice-library/client/` | `server.js` (remove static serve) |
| 3.9 | `content/` | `dev-tools/content/` | scripts (update paths) |
| 3.10 | `scripts/` | `dev-tools/scripts/` | `package.json` (update all script commands) |
| 3.11 | `tools/` | `dev-tools/scripts/tools/` | `package.json` |
| 3.12 | `tests/` | `dev-tools/tests/` | `package.json` `"test"` script |
| **PHASE 4 — PATH ALIASES (FOUNDATION)** | | | |
| 4.1 | `vite.config.ts` | add aliases: `@platform`, `@room`, `@games` | — |
| 4.2 | `tsconfig.app.json` | add matching `paths` config | — |

---

## Import Update Detail Table

This table shows the exact import string changes needed for each affected file.

### Callers in src/ that reference cosmic-trivia (Phase 2 impact)

| File | Old import string | New import string |
|------|------------------|------------------|
| `src/pages/platform/LobbyPage.tsx` | `../../../games/werewolf/client/BigScreenPage` (unchanged) | — |
| `src/pages/platform/LobbyPage.tsx` | `./games/cosmic-trivia/BigScreenPage` _(or similar)_ | `../../../games/cosmic-trivia/client/BigScreenPage` |
| `src/pages/player/InRoomPage.tsx` | `../games/cosmic-trivia/PhonePage` _(or similar)_ | `../../../games/cosmic-trivia/client/PhonePage` |
| `src/components/platform/HostPhoneLobbyView.tsx` | `../../pages/games/cosmic-trivia/PhonePage` _(or similar)_ | `../../../games/cosmic-trivia/client/PhonePage` |
| `server/games/registry.js` | `./cosmic-trivia.js` | `../../games/cosmic-trivia/server/index.js` |
| `vitest.config.ts` | (check include patterns for src/__tests__) | add `games/*/client/__tests__/**` |

### Inside games/cosmic-trivia/client/ (after move, internal path fixes)

| File | Old import | New import |
|------|-----------|-----------|
| `client/BigScreenPage.tsx` | `../../../types/cosmic-trivia` | `../shared/types` |
| `client/BigScreenPage.tsx` | `../../../components/games/cosmic-trivia/AnswerGrid` | `./components/AnswerGrid` |
| `client/BigScreenPage.tsx` | `../../../components/games/cosmic-trivia/CountdownBar` | `./components/CountdownBar` |
| `client/BigScreenPage.tsx` | `../../../components/games/cosmic-trivia/ScoreRow` | `./components/ScoreRow` |
| `client/BigScreenPage.tsx` | `../../../components/games/cosmic-trivia/WinnerBoard` | `./components/WinnerBoard` |
| `client/BigScreenPage.tsx` | `../../../hooks/useCosmicTriviaDirector` | `./hooks/useCosmicTriviaDirector` |
| `client/BigScreenPage.tsx` | `../../../components/games/cosmic-trivia/ScoreBurstOverlay` | `./components/ScoreBurstOverlay` |
| `client/BigScreenPage.tsx` | `../../../components/ui/ConfettiRain` | `./components/ConfettiRain` |
| `client/BigScreenPage.tsx` | `../../../components/ui/Joyly01Overlay` | `./components/Joyly01Overlay` |
| `client/BigScreenPage.tsx` | `../../../types/room` | `../../../src/types/room` |
| `client/PhonePage.tsx` | `../../../types/cosmic-trivia` | `../shared/types` |
| `client/PhonePage.tsx` | `../../../types/room` | `../../../src/types/room` |
| `client/PhonePage.tsx` | `../../../types/player` | `../../../src/types/player` |
| `client/PhonePage.tsx` | `../../../components/player/PhoneLayout` | `../../../src/components/player/PhoneLayout` |
| `client/PhonePage.tsx` | `../../../components/games/cosmic-trivia/AnswerGrid` | `./components/AnswerGrid` |
| `client/PhonePage.tsx` | `../../../components/games/cosmic-trivia/PreferencesPicker` | `./components/PreferencesPicker` |
| `client/PhonePage.tsx` | `../../../components/ui/Joyly01Overlay` | `./components/Joyly01Overlay` |
| `client/PhonePage.tsx` | `../../../components/games/cosmic-trivia/PhoneSadEmojiRain` | `./components/PhoneSadEmojiRain` |
| `client/PhonePage.tsx` | `../../../components/ui/ConfettiRain` | `./components/ConfettiRain` |
| `client/components/ScoreRow.tsx` | `../../../components/player/AvatarStack` | `../../../../src/components/player/AvatarStack` |
| `client/components/ScoreRow.tsx` | `../../../types/room` | `../../../../src/types/room` |
| `client/components/WinnerBoard.tsx` | `../../../components/player/AvatarStack` | `../../../../src/components/player/AvatarStack` |
| `client/components/WinnerBoard.tsx` | `../../../types/room` | `../../../../src/types/room` |
| `client/components/CountdownBar.tsx` | `../../hooks/useCountdown` | `../hooks/useCountdown` |
| `client/components/PreferencesPicker.tsx` | `../../../components/ui/Button` | `../../../../src/components/ui/Button` |
| `client/hooks/useCosmicTriviaDirector.ts` | `../../types/room` | `../../../../src/types/room` |
| `client/hooks/useCosmicTriviaDirector.ts` | `../../types/cosmic-trivia` | `../../shared/types` |
| `client/hooks/useCosmicTriviaDirector.ts` | `../lib/director/cosmic-trivia-director` | `../lib/director/cosmic-trivia-director` _(no change — relative within client/)_ |
| `client/hooks/useCosmicTriviaDirector.ts` | `../lib/director/flow` | `../lib/director/flow` _(no change)_ |
| `client/hooks/useCosmicTriviaDirector.ts` | `../lib/director/types` | `../lib/director/types` _(no change)_ |
| `client/hooks/useCosmicTriviaDirector.ts` | `./useEmojiParticles` | `./useEmojiParticles` _(no change)_ |
| `client/hooks/useCosmicTriviaDirector.ts` | `../lib/director/cosmic-trivia-cue-library` | `../lib/director/cosmic-trivia-cue-library` _(no change)_ |

### Inside games/cosmic-trivia/server/ (after move, internal path fixes)

| File | Old import | New import |
|------|-----------|-----------|
| `server/index.js` (was cosmic-trivia.js) | `./cosmic-trivia/content-loader.js` | `./content-loader.js` |
| `server/index.js` | `./cosmic-trivia/state.js` | `./state.js` |
| `server/index.js` | `./cosmic-trivia/flow.js` | `./flow.js` |
| `server/index.js` | `./cosmic-trivia/scoring.js` | `./scoring.js` |
| `server/index.js` | `./cosmic-trivia/question-history.js` | `./question-history.js` |
| `server/index.js` | `./cosmic-trivia/director.js` | `./director.js` |
| `server/index.js` | `../players/status.js` | `../../../server/players/status.js` |
| `server/scoring.js` | `../../players/status.js` | `../../../server/players/status.js` |
| `server/state.js` | `../../players/status.js` | `../../../server/players/status.js` |
| `server/flow.js` | `../../players/status.js` | `../../../server/players/status.js` |
| `server/flow.js` | `../../../public/games/cosmic-trivia/director/cue-library.generated.js` | `../../../public/games/cosmic-trivia/director/cue-library.generated.js` ✓ _(depth unchanged)_ |
| `server/director.js` | `../../../public/shared/director/flow.js` | `../../../public/shared/director/flow.js` ✓ _(depth unchanged)_ |
| `server/director.js` | `../../../public/shared/director/cosmic-trivia-phases.js` | `../../../public/shared/director/cosmic-trivia-phases.js` ✓ _(depth unchanged)_ |
| `server/question-selector.js` | `./content-loader.js` | `./content-loader.js` _(no change)_ |

---

## Tasks

### Task 1: Delete duplicate files (macOS "* 2.*" artifacts)

**Files:**
- Delete: All `* 2.*` files throughout the project
- Delete: `node_modules 2/`
- Delete: `render 2.yaml`

- [ ] **Step 1: Find and delete all Finder-copy artifacts**

```bash
# Preview what will be deleted (check output first)
find /Users/neil/Documents/派对游戏 -not -path '*/node_modules/*' -not -path '*/.git/*' -name "* 2.*" | sort

# Delete them
find /Users/neil/Documents/派对游戏 -not -path '*/node_modules/*' -not -path '*/.git/*' -name "* 2.*" -delete

# Delete duplicate node_modules
rm -rf "node_modules 2"

# Delete duplicate render.yaml
rm "render 2.yaml"
```

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "chore: delete macOS Finder duplicate artifacts"
```

---

### Task 2: Delete empty shell files

**Files:**
- Delete: `src/pages/games/fate-werewolf/BigScreenPage.tsx`
- Delete: `src/pages/games/fate-werewolf/PhonePage.tsx`
- Delete: `server/games/fate-werewolf.js` (old stub, registry.js no longer imports it)

- [ ] **Step 1: Verify these files have no real content**

```bash
cat "src/pages/games/fate-werewolf/BigScreenPage.tsx"
cat "src/pages/games/fate-werewolf/PhonePage.tsx"
cat "server/games/fate-werewolf.js"
```

Expected: BigScreenPage and PhonePage are placeholder divs with no imports. fate-werewolf.js is a stub data object.

- [ ] **Step 2: Delete**

```bash
git rm "src/pages/games/fate-werewolf/BigScreenPage.tsx"
git rm "src/pages/games/fate-werewolf/PhonePage.tsx"
git rm "server/games/fate-werewolf.js"
rmdir "src/pages/games/fate-werewolf"
```

- [ ] **Step 3: Verify build still works**

```bash
npm run build
```

Expected: Build succeeds. No references to deleted files exist.

- [ ] **Step 4: Commit**

```bash
git commit -m "chore: remove empty fate-werewolf shell files"
```

---

### Task 3: Create games/cosmic-trivia/ directory structure

**Files:**
- Create directories: `games/cosmic-trivia/client/components/`, `games/cosmic-trivia/client/hooks/`, `games/cosmic-trivia/client/lib/`, `games/cosmic-trivia/client/__tests__/`, `games/cosmic-trivia/server/`, `games/cosmic-trivia/shared/`
- Create: `games/cosmic-trivia/manifest.ts`

- [ ] **Step 1: Create directory structure**

```bash
mkdir -p games/cosmic-trivia/client/components
mkdir -p games/cosmic-trivia/client/hooks
mkdir -p games/cosmic-trivia/client/lib
mkdir -p games/cosmic-trivia/client/__tests__
mkdir -p games/cosmic-trivia/server
mkdir -p games/cosmic-trivia/shared
```

- [ ] **Step 2: Create manifest.ts**

```typescript
// games/cosmic-trivia/manifest.ts
export const cosmicTriviaManifest = {
  id: 'cosmic-trivia',
  title: '宇宙知识王',
  playerRange: { min: 2, max: 10 },
  serverModule: './server/index.js',
}
```

- [ ] **Step 3: Commit**

```bash
git add games/cosmic-trivia/
git commit -m "chore: scaffold games/cosmic-trivia/ package structure"
```

---

### Task 4: Move cosmic-trivia server code

**Files:**
- Move: `server/games/cosmic-trivia.js` → `games/cosmic-trivia/server/index.js`
- Move: `server/games/cosmic-trivia/*` → `games/cosmic-trivia/server/`

- [ ] **Step 1: Move server files with git mv**

```bash
git mv server/games/cosmic-trivia/content-loader.js   games/cosmic-trivia/server/content-loader.js
git mv server/games/cosmic-trivia/director.js          games/cosmic-trivia/server/director.js
git mv server/games/cosmic-trivia/events.js            games/cosmic-trivia/server/events.js
git mv server/games/cosmic-trivia/flow.js              games/cosmic-trivia/server/flow.js
git mv server/games/cosmic-trivia/question-history.js  games/cosmic-trivia/server/question-history.js
git mv server/games/cosmic-trivia/question-selector.js games/cosmic-trivia/server/question-selector.js
git mv server/games/cosmic-trivia/scoring.js           games/cosmic-trivia/server/scoring.js
git mv server/games/cosmic-trivia/state.js             games/cosmic-trivia/server/state.js
git mv server/games/cosmic-trivia/summaries.js         games/cosmic-trivia/server/summaries.js
git mv server/games/cosmic-trivia.js                   games/cosmic-trivia/server/index.js
rmdir server/games/cosmic-trivia
```

- [ ] **Step 2: Update imports in games/cosmic-trivia/server/index.js**

Open `games/cosmic-trivia/server/index.js` and change:
```js
// BEFORE
import './cosmic-trivia/content-loader.js'  // (or require)
// Each ./cosmic-trivia/XYZ.js import
// '../players/status.js'

// AFTER — flatten the subdirectory (files are now siblings)
// './content-loader.js', './state.js', etc.
// '../../../server/players/status.js'
```

Exact replacements:
- `./cosmic-trivia/content-loader.js` → `./content-loader.js`
- `./cosmic-trivia/state.js` → `./state.js`
- `./cosmic-trivia/flow.js` → `./flow.js`
- `./cosmic-trivia/scoring.js` → `./scoring.js`
- `./cosmic-trivia/question-history.js` → `./question-history.js`
- `./cosmic-trivia/director.js` → `./director.js`
- `../players/status.js` → `../../../server/players/status.js`

- [ ] **Step 3: Update `../players/status.js` references in scoring.js, state.js, flow.js**

In each file, replace:
- `../../players/status.js` → `../../../server/players/status.js`

```bash
# Verify which files have this pattern
grep -r "players/status" games/cosmic-trivia/server/
```

- [ ] **Step 4: Update registry.js to point to new location**

Edit `server/games/registry.js`:
- Change `./cosmic-trivia.js` → `../../games/cosmic-trivia/server/index.js`

- [ ] **Step 5: Verify server starts without errors**

```bash
node server.js &
sleep 2
curl http://localhost:4173/api/config
kill %1
```

Expected: JSON config response, no import errors.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor: move cosmic-trivia server into games/cosmic-trivia/server/"
```

---

### Task 5: Move cosmic-trivia client code

**Files:**
- Move: `src/types/cosmic-trivia.ts` → `games/cosmic-trivia/shared/types.ts`
- Move: `src/lib/director/` → `games/cosmic-trivia/client/lib/director/`
- Move: `src/hooks/useCosmicTriviaDirector.ts` → `games/cosmic-trivia/client/hooks/`
- Move: `src/hooks/useCountdown.ts` → `games/cosmic-trivia/client/hooks/`
- Move: `src/hooks/useEmojiParticles.ts` → `games/cosmic-trivia/client/hooks/`
- Move: `src/components/games/cosmic-trivia/*` → `games/cosmic-trivia/client/components/`
- Move: `src/components/ui/ConfettiRain.tsx` → `games/cosmic-trivia/client/components/`
- Move: `src/components/ui/Joyly01Overlay.tsx` → `games/cosmic-trivia/client/components/`
- Move: `src/pages/games/cosmic-trivia/BigScreenPage.tsx` → `games/cosmic-trivia/client/`
- Move: `src/pages/games/cosmic-trivia/PhonePage.tsx` → `games/cosmic-trivia/client/`
- Move: `src/__tests__/director-*.test.ts` → `games/cosmic-trivia/client/__tests__/`

- [ ] **Step 1: Move shared types**

```bash
git mv src/types/cosmic-trivia.ts games/cosmic-trivia/shared/types.ts
```

- [ ] **Step 2: Move lib/director (all files)**

```bash
git mv src/lib/director/cosmic-trivia-cue-library.ts           games/cosmic-trivia/client/lib/director/
git mv src/lib/director/cosmic-trivia-cue-library.generated.ts games/cosmic-trivia/client/lib/director/
git mv src/lib/director/cosmic-trivia-director.ts              games/cosmic-trivia/client/lib/director/
git mv src/lib/director/cosmic-trivia-phases.ts                games/cosmic-trivia/client/lib/director/
git mv src/lib/director/cues.ts                                games/cosmic-trivia/client/lib/director/
git mv src/lib/director/flow.ts                                games/cosmic-trivia/client/lib/director/
git mv src/lib/director/types.ts                               games/cosmic-trivia/client/lib/director/
rmdir src/lib/director
rmdir src/lib
```

- [ ] **Step 3: Move hooks**

```bash
git mv src/hooks/useCosmicTriviaDirector.ts games/cosmic-trivia/client/hooks/
git mv src/hooks/useCountdown.ts            games/cosmic-trivia/client/hooks/
git mv src/hooks/useEmojiParticles.ts       games/cosmic-trivia/client/hooks/
```

- [ ] **Step 4: Move components**

```bash
git mv src/components/games/cosmic-trivia/AnswerGrid.tsx        games/cosmic-trivia/client/components/
git mv src/components/games/cosmic-trivia/CountdownBar.tsx      games/cosmic-trivia/client/components/
git mv src/components/games/cosmic-trivia/PhoneSadEmojiRain.tsx games/cosmic-trivia/client/components/
git mv src/components/games/cosmic-trivia/PreferencesPicker.tsx games/cosmic-trivia/client/components/
git mv src/components/games/cosmic-trivia/ScoreBurstOverlay.tsx games/cosmic-trivia/client/components/
git mv src/components/games/cosmic-trivia/ScoreRow.tsx          games/cosmic-trivia/client/components/
git mv src/components/games/cosmic-trivia/WinnerBoard.tsx       games/cosmic-trivia/client/components/
git mv src/components/ui/ConfettiRain.tsx                       games/cosmic-trivia/client/components/
git mv src/components/ui/Joyly01Overlay.tsx                     games/cosmic-trivia/client/components/
rmdir src/components/games/cosmic-trivia
rmdir src/components/games
```

- [ ] **Step 5: Move pages**

```bash
git mv src/pages/games/cosmic-trivia/BigScreenPage.tsx games/cosmic-trivia/client/BigScreenPage.tsx
git mv src/pages/games/cosmic-trivia/PhonePage.tsx     games/cosmic-trivia/client/PhonePage.tsx
rmdir src/pages/games/cosmic-trivia
rmdir src/pages/games
```

- [ ] **Step 6: Move director tests**

```bash
git mv src/__tests__/director-cue-library.test.ts games/cosmic-trivia/client/__tests__/
git mv src/__tests__/director-flow.test.ts         games/cosmic-trivia/client/__tests__/
```

- [ ] **Step 7: Commit the file moves (before fixing imports)**

```bash
git add -A
git commit -m "refactor: move cosmic-trivia client files into games/cosmic-trivia/client/"
```

---

### Task 6: Fix imports inside games/cosmic-trivia/client/

Apply the exact import replacements from the **Import Update Detail Table** above.

- [ ] **Step 1: Fix BigScreenPage.tsx**

Edit `games/cosmic-trivia/client/BigScreenPage.tsx`. Apply these changes:

| Find | Replace with |
|------|-------------|
| `from '../../../types/room'` | `from '../../../src/types/room'` |
| `from '../../../types/cosmic-trivia'` | `from '../shared/types'` |
| `from '../../../components/games/cosmic-trivia/AnswerGrid'` | `from './components/AnswerGrid'` |
| `from '../../../components/games/cosmic-trivia/CountdownBar'` | `from './components/CountdownBar'` |
| `from '../../../components/games/cosmic-trivia/ScoreRow'` | `from './components/ScoreRow'` |
| `from '../../../components/games/cosmic-trivia/WinnerBoard'` | `from './components/WinnerBoard'` |
| `from '../../../hooks/useCosmicTriviaDirector'` | `from './hooks/useCosmicTriviaDirector'` |
| `from '../../../components/games/cosmic-trivia/ScoreBurstOverlay'` | `from './components/ScoreBurstOverlay'` |
| `from '../../../components/ui/ConfettiRain'` | `from './components/ConfettiRain'` |
| `from '../../../components/ui/Joyly01Overlay'` | `from './components/Joyly01Overlay'` |

- [ ] **Step 2: Fix PhonePage.tsx**

Edit `games/cosmic-trivia/client/PhonePage.tsx`. Apply changes:

| Find | Replace with |
|------|-------------|
| `from '../../../types/room'` | `from '../../../src/types/room'` |
| `from '../../../types/cosmic-trivia'` | `from '../shared/types'` |
| `from '../../../types/player'` | `from '../../../src/types/player'` |
| `from '../../../components/player/PhoneLayout'` | `from '../../../src/components/player/PhoneLayout'` |
| `from '../../../components/games/cosmic-trivia/AnswerGrid'` | `from './components/AnswerGrid'` |
| `from '../../../components/games/cosmic-trivia/PreferencesPicker'` | `from './components/PreferencesPicker'` |
| `from '../../../components/ui/Joyly01Overlay'` | `from './components/Joyly01Overlay'` |
| `from '../../../components/games/cosmic-trivia/PhoneSadEmojiRain'` | `from './components/PhoneSadEmojiRain'` |
| `from '../../../components/ui/ConfettiRain'` | `from './components/ConfettiRain'` |

- [ ] **Step 3: Fix components that reference src/**

`games/cosmic-trivia/client/components/ScoreRow.tsx`:
- `../../../components/player/AvatarStack` → `../../../../src/components/player/AvatarStack`
- `../../../types/room` → `../../../../src/types/room`

`games/cosmic-trivia/client/components/WinnerBoard.tsx`:
- `../../../components/player/AvatarStack` → `../../../../src/components/player/AvatarStack`
- `../../../types/room` → `../../../../src/types/room`

`games/cosmic-trivia/client/components/PreferencesPicker.tsx`:
- `../../../components/ui/Button` → `../../../../src/components/ui/Button`

`games/cosmic-trivia/client/components/CountdownBar.tsx`:
- `../../hooks/useCountdown` → `../hooks/useCountdown`

- [ ] **Step 4: Fix hooks/useCosmicTriviaDirector.ts**

- `../../types/room` → `../../../../src/types/room`
- `../../types/cosmic-trivia` → `../../shared/types`
- All `../lib/director/...` paths stay unchanged (already relative within client/)
- `./useEmojiParticles` stays unchanged

- [ ] **Step 5: Fix director tests**

`games/cosmic-trivia/client/__tests__/director-cue-library.test.ts`:
- `../lib/director/cosmic-trivia-cue-library` → `../lib/director/cosmic-trivia-cue-library`
- `../lib/director/cosmic-trivia-phases` → `../lib/director/cosmic-trivia-phases`
_(Paths from `__tests__/` to `lib/` are now `../lib/...` — verify exact strings in file)_

`games/cosmic-trivia/client/__tests__/director-flow.test.ts`:
- `../lib/director/flow` → `../lib/director/flow`

- [ ] **Step 6: Update vitest.config.ts to include new test location**

Edit `vitest.config.ts`, add `games/*/client/__tests__/**` to the include pattern.

- [ ] **Step 7: Run TypeScript check**

```bash
npx tsc --noEmit
```

Expected: Zero errors in moved files. Fix any remaining path issues.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "refactor: fix internal imports in games/cosmic-trivia/client/"
```

---

### Task 7: Fix imports in src/ that reference cosmic-trivia

- [ ] **Step 1: Update LobbyPage.tsx**

Edit `src/pages/platform/LobbyPage.tsx`.

Find the import of cosmic-trivia BigScreenPage (search for `cosmic-trivia` in this file):
```ts
// BEFORE (exact string may vary — check file)
import CosmicTriviaBigScreen from '../pages/games/cosmic-trivia/BigScreenPage'
// or: import ... from '../../games/cosmic-trivia/BigScreenPage'

// AFTER
import CosmicTriviaBigScreen from '../../../games/cosmic-trivia/client/BigScreenPage'
```

- [ ] **Step 2: Update InRoomPage.tsx**

Edit `src/pages/player/InRoomPage.tsx`.

```ts
// BEFORE
import CosmicTriviaPhone from '../games/cosmic-trivia/PhonePage'  // (check exact string)

// AFTER
import CosmicTriviaPhone from '../../../games/cosmic-trivia/client/PhonePage'
```

- [ ] **Step 3: Update HostPhoneLobbyView.tsx**

Edit `src/components/platform/HostPhoneLobbyView.tsx`.

```ts
// BEFORE
import CosmicTriviaPhone from '../../pages/games/cosmic-trivia/PhonePage'  // (check exact string)

// AFTER
import CosmicTriviaPhone from '../../../games/cosmic-trivia/client/PhonePage'
```

- [ ] **Step 4: Verify exact import strings before editing**

```bash
grep -n "cosmic-trivia" src/pages/platform/LobbyPage.tsx
grep -n "cosmic-trivia" src/pages/player/InRoomPage.tsx
grep -n "cosmic-trivia" src/components/platform/HostPhoneLobbyView.tsx
```

Use these actual strings to make the edits above.

- [ ] **Step 5: Full build + test**

```bash
npm run build
npm run test:ui
```

Expected: Build succeeds, all tests pass. This is the Phase 2 completion checkpoint.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor: update src/ imports to point at games/cosmic-trivia/client/"
```

---

### Task 8: Create dev-tools/ and move voice library

**Files:**
- Create: `dev-tools/` structure
- Move: `server/voice-library/*` → `dev-tools/voice-library/server/`
- Move: `public/voice-library/` → `dev-tools/voice-library/client/`
- Update: `server.js` to remove voice-library imports and static serve

- [ ] **Step 1: Create dev-tools structure**

```bash
mkdir -p dev-tools/voice-library/server
mkdir -p dev-tools/voice-library/client
mkdir -p dev-tools/demos
mkdir -p dev-tools/content
mkdir -p dev-tools/scripts/tools
```

- [ ] **Step 2: Move voice-library server files**

```bash
git mv server/voice-library/catalog.js      dev-tools/voice-library/server/catalog.js
git mv server/voice-library/regenerate.js   dev-tools/voice-library/server/regenerate.js
git mv server/voice-library/review-state.js dev-tools/voice-library/server/review-state.js
git mv server/voice-library/sqlite-store.js dev-tools/voice-library/server/sqlite-store.js
git mv server/voice-library/text.js         dev-tools/voice-library/server/text.js
rmdir server/voice-library
```

- [ ] **Step 3: Move voice-library client files**

```bash
git mv public/voice-library/app.js     dev-tools/voice-library/client/app.js
git mv public/voice-library/index.html dev-tools/voice-library/client/index.html
git mv public/voice-library/styles.css dev-tools/voice-library/client/styles.css
rmdir public/voice-library
```

- [ ] **Step 4: Move content, demos, scripts, tools**

```bash
git mv content/voice-library dev-tools/voice-library/data
git mv content/private-assets dev-tools/content/private-assets
git mv demos/* dev-tools/demos/
git mv public/demos/* dev-tools/demos/
git mv scripts/* dev-tools/scripts/
git mv tools/* dev-tools/scripts/tools/
```

- [ ] **Step 5: Update internal imports in dev-tools/voice-library/server/**

Fix `regenerate.js` and `review-state.js` references to `./text.js` (stays the same since they're siblings).

- [ ] **Step 6: Update server.js — remove voice-library routes**

Edit `server.js`. Remove or comment out the voice-library imports and routes:
```js
// REMOVE these imports:
// import catalog from './server/voice-library/catalog.js'
// import regenerate from './server/voice-library/regenerate.js'
// import text from './server/voice-library/text.js'
// import reviewState from './server/voice-library/review-state.js'
// import sqliteStore from './server/voice-library/sqlite-store.js'

// REMOVE or guard with NODE_ENV check:
// app.get('/api/voice-library/...', ...)
// app.static('/voice-library', ...)
```

Voice library is a dev tool — it should not be served in production. Wrap any remaining routes in `if (process.env.NODE_ENV !== 'production')` or create a separate `dev-server.js`.

- [ ] **Step 7: Update package.json scripts to use new paths**

```json
"scripts": {
  "test": "node --test dev-tools/tests/*.test.js",
  "build:trivia": "node dev-tools/scripts/build-cosmic-trivia-pack.js",
  "build:trivia-director-cues": "node dev-tools/scripts/build-cosmic-trivia-director-cues.js",
  "validate:cosmic-trivia": "node dev-tools/scripts/validate-cosmic-trivia-pack.js",
  "generate:cosmic-trivia-host-audio": "node dev-tools/scripts/generate-cosmic-trivia-host-audio.js",
  "generate:cosmic-trivia-question-audio": "node dev-tools/scripts/generate-cosmic-trivia-question-audio.js"
}
```

- [ ] **Step 8: Verify production build and start**

```bash
npm run build
npm start &
sleep 2
curl http://localhost:4173/api/config
kill %1
```

Expected: Server starts, config endpoint responds, no voice-library errors.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "refactor: move voice-library, demos, scripts, content into dev-tools/"
```

---

### Task 9: Add TypeScript path aliases (foundation for future work)

This prevents future file moves from requiring widespread import updates.

**Files:**
- Modify: `vite.config.ts`
- Modify: `tsconfig.app.json`

- [ ] **Step 1: Update vite.config.ts**

```ts
import path from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@platform': path.resolve(__dirname, 'src/components/platform'),
      '@room':     path.resolve(__dirname, 'src/pages/player'),
      '@types':    path.resolve(__dirname, 'src/types'),
      '@ui':       path.resolve(__dirname, 'src/components/ui'),
      '@stores':   path.resolve(__dirname, 'src/stores'),
      '@hooks':    path.resolve(__dirname, 'src/hooks'),
    },
  },
  build: { outDir: 'dist' },
  server: {
    port: 5173,
    proxy: { '/api': { target: 'http://localhost:4173', changeOrigin: true } },
  },
})
```

- [ ] **Step 2: Update tsconfig.app.json**

Add `paths` to compilerOptions:
```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@platform/*": ["src/components/platform/*"],
      "@room/*":     ["src/pages/player/*"],
      "@types/*":    ["src/types/*"],
      "@ui/*":       ["src/components/ui/*"],
      "@stores/*":   ["src/stores/*"],
      "@hooks/*":    ["src/hooks/*"]
    }
  }
}
```

- [ ] **Step 3: Verify TypeScript and build**

```bash
npx tsc --noEmit
npm run build
```

- [ ] **Step 4: Commit**

```bash
git add vite.config.ts tsconfig.app.json
git commit -m "chore: add TypeScript path aliases for platform/room/ui/stores/hooks"
```

---

## Phase Completion Checklist

- [ ] Phase 1 complete: No `* 2.*` files in project, empty shells removed
- [ ] Phase 2 complete: `games/cosmic-trivia/` is self-contained, `npm run build && npm run test:ui` passes
- [ ] Phase 3 complete: `dev-tools/` holds all non-production code, server.js has no voice-library imports
- [ ] Phase 4 complete: Path aliases work, `npx tsc --noEmit` passes
