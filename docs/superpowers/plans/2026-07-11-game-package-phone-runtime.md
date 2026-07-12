# Game Package Phone Runtime Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Standardize platform-to-game loading so platform pages do not import or branch on individual games, while removing the public-history UI and fixing the Werewolf phone entry path.

**Architecture:** Add a small client package registry with lazy phone and screen adapters. Platform pages render generic runtime surfaces; each game package owns its entry adapter. Keep existing game rules and server runtime APIs unchanged in this task.

## Task 1: Client game-package runtime

Files:
- Create `src/game-runtime/types.ts` and `src/game-runtime/registry.tsx`.
- Create `games/cosmic-trivia/client/package.tsx` and `games/werewolf/client/package.tsx`.
- Modify `games/cosmic-trivia/client/PhonePage.tsx` and `games/werewolf/client/PhonePage.tsx` to accept runtime props where needed.
- Modify `src/pages/player/InRoomPage.tsx`, `src/components/platform/HostPhoneLobbyView.tsx`, `src/pages/platform/LobbyPage.tsx`, and `src/App.tsx` to use generic runtime surfaces instead of direct game imports/branches.
- Add tests for registry resolution and Werewolf role-assignment rendering.

Steps:
- Write failing tests proving the registry resolves both games and `/play/:code` renders the Werewolf package instead of “is live”.
- Implement typed `GamePhoneEntryProps` and lazy package loaders.
- Adapt existing Cosmic Trivia and Werewolf entries without changing their internal game UI.
- Replace platform direct imports with generic runtime components; preserve direct game URLs through package screen loaders.
- Run focused tests, full UI tests, and build.

## Task 2: Remove public-history UI

Files:
- Modify `games/werewolf/client/PhonePage.tsx` and `games/werewolf/client/BigScreenPage.tsx`.
- Remove/update tests that assert visible public history.

Steps:
- Write failing render tests asserting no “公开记录”/public ledger is visible on phone or big screen.
- Remove the visual components and their calls; retain server history projection for future package-owned replay UI.
- Run focused tests, full UI tests, and build.

## Final verification

Run `npm run test:ui` and `npm run build`. Confirm Cosmic Trivia and Werewolf package entry tests pass and no platform page directly imports a game page component.
