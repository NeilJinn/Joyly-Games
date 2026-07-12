# Fate Werewolf Core Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a complete 6–10 player Fate Werewolf core mode with server-authoritative rules, placeholder fate-card flow, and phone interactions.

**Architecture:** Keep `games/werewolf/server/game.js` as the runtime adapter and phase machine, but move role, fate, and resolution decisions into focused modules. The server projects public and player-private state; React phone and large-screen clients render those projections and submit typed actions. A placeholder fate deck uses the final card contract and weighted council draw but never changes game outcomes.

**Tech Stack:** Node.js ESM runtime, React + TypeScript, Vitest, Vite.

**Workspace note:** The user explicitly chose the current `main-1.0` workspace rather than an isolated worktree. Do not stage or commit unrelated existing changes; each task must use exact-path staging only if the worktree is clean enough to do so safely.

---

## File structure

- Create `games/werewolf/server/roles/registry.js`: core-role definitions and extension registration contract.
- Create `games/werewolf/server/fate/cards.js`: placeholder minor/major card definitions, trigger eligibility and weighted draw.
- Create `games/werewolf/server/resolvers/victory.js`: ordered faction victory check using registered third-party hooks.
- Create `games/werewolf/server/resolvers/night.js`: deterministic night-death resolution and hunter eligibility.
- Modify `games/werewolf/server/game.js`: retain runtime API; use modules; correct phase order, public/private projections and actions.
- Modify `games/werewolf/shared/types.ts`: express all current action input shapes and public history.
- Modify `games/werewolf/client/PhonePage.tsx`: render single-target, multi-target, card-and-target and opt-in actions; store personal notes/tools.
- Modify `games/werewolf/client/BigScreenPage.tsx`: remove always-visible test panel from production and render host controls/public history.
- Modify `server/platform/game-catalog.js` and `games/werewolf/manifest.ts`: make the first release 6–10 players.
- Modify `vitest.config.ts`: include game tests.
- Create focused tests under `games/werewolf/server/__tests__/` and `games/werewolf/client/__tests__/`.

## Task 1: Make Werewolf rules testable and define stable types

**Files:**
- Modify: `vitest.config.ts:6-8`
- Modify: `games/werewolf/shared/types.ts:1-128`
- Modify: `games/werewolf/server/__tests__/phases.test.ts:1-144`
- Create: `games/werewolf/server/__tests__/fate-flow.test.ts`

- [ ] **Step 1: Write failing rule-contract tests.**

```ts
it('draws fate only after every dead player has voted', async () => {
  const room = await startedRoom(8)
  moveTo(room, 'fate-council')
  expect(room.gameState.currentFateCard).toBeNull()
  actionWerewolf(room, deadId, { type: 'fate-vote', tendency: 'oracle' })
  await advanceWerewolf(room)
  expect(room.gameState.currentFateCard?.tendency).toBe('oracle')
})

it('does not let surviving wolves win merely by matching moon players', () => {
  expect(checkVictory(roomWith({ wolves: 1, moon: 1, third: 1 }))).toBeNull()
})
```

- [ ] **Step 2: Run the targeted tests and verify they fail because the current state draws before council voting and uses parity.**

Run: `npx vitest run games/werewolf/server/__tests__/phases.test.ts games/werewolf/server/__tests__/fate-flow.test.ts`

Expected: at least the new tests fail; they must now be discovered by Vitest.

- [ ] **Step 3: Expand the shared action contract without `any` or overloaded target fields.**

```ts
export type WerewolfAction =
  | { type: 'confirm-role'; label: string; disabled?: boolean }
  | { type: 'select-target'; actionId: 'guardian-protect' | 'vote-target' | 'pk-vote' | 'hunter-revenge' | 'arsonist-mark'; label: string; targets: WerewolfActionTarget[]; selectedTargetId?: string; allowSkip?: boolean }
  | { type: 'wolf-night-action'; label: string; targets: WerewolfActionTarget[]; wolfOptions: WolfOption[]; selectedTargetId?: string; selectedOption?: string }
  | { type: 'card-and-target'; actionId: 'fate-weaver-card'; label: string; cards: WerewolfTarotCard[]; targets: WerewolfActionTarget[]; selectedCardId?: string; selectedTargetId?: string }
  | { type: 'multi-target'; actionId: string; label: string; targets: WerewolfActionTarget[]; requiredTargetCount: number; selectedTargetIds?: string[] }
  | { type: 'fate-vote'; label: string; tendencies: WerewolfFateTendency[]; selectedTendency?: string }
  | { type: 'discussion-opt-in'; label: string; selected?: boolean }
```

- [ ] **Step 4: Make the test configuration discover both React and game test folders.**

```ts
include: [
  'src/__tests__/**/*.test.{ts,tsx}',
  'games/**/__tests__/**/*.test.{ts,tsx}',
],
```

- [ ] **Step 5: Run all UI and game tests.**

Run: `npm run test:ui`

Expected: current layout failure is either fixed within its owning task or reported as a pre-existing unrelated failure; all Werewolf server tests must execute.

## Task 2: Build extension-ready role and resolution modules

**Files:**
- Create: `games/werewolf/server/roles/registry.js`
- Create: `games/werewolf/server/resolvers/night.js`
- Create: `games/werewolf/server/resolvers/victory.js`
- Create: `games/werewolf/server/__tests__/victory.test.ts`
- Create: `games/werewolf/server/__tests__/night.test.ts`
- Modify: `games/werewolf/server/game.js:1-288`

- [ ] **Step 1: Write the failing victory and night resolver tests.**

```ts
it('declares wolves victorious only when no moon or hostile third faction survives', () => {
  expect(resolveVictory(snapshot({ wolf: 2, moon: 0, hostileThird: 1 }))).toBeNull()
  expect(resolveVictory(snapshot({ wolf: 2, moon: 0, hostileThird: 0 }))?.winner).toBe('狼神阵营')
})

it('does not offer hunter revenge after a fate-weaver kill card', () => {
  const outcome = resolveNight(stateWithFateWeaverKillOnHunter())
  expect(outcome.pendingHunterRevenge).toBeNull()
})
```

- [ ] **Step 2: Run them and verify they fail before the extraction.**

Run: `npx vitest run games/werewolf/server/__tests__/victory.test.ts games/werewolf/server/__tests__/night.test.ts`

Expected: FAIL because the modules do not exist.

- [ ] **Step 3: Add the role-module registry with extension hooks.**

```js
export const coreRoleModules = Object.freeze({
  villager: { id: 'villager', team: 'moon' },
  werewolf: { id: 'werewolf', team: 'wolf', nightStep: { id: 'wolf-action', order: 20 } },
  guardian: { id: 'guardian', team: 'moon', nightStep: { id: 'guardian-action', order: 10 } },
  fateweaver: { id: 'fateweaver', team: 'moon', nightStep: { id: 'fate-weaver-action', order: 30 } },
  oracle: { id: 'oracle', team: 'moon', nightStep: { id: 'oracle-action', order: 40 } },
  hunter: { id: 'hunter', team: 'moon' },
})

export function registeredNightSteps(roleIds, round) {
  return roleIds.flatMap((id) => {
    const step = coreRoleModules[id]?.nightStep
    return step && (step.firstNightOnly ? round === 1 : true) ? [step] : []
  }).sort((a, b) => a.order - b.order)
}
```

- [ ] **Step 4: Implement pure night and victory resolvers, then adapt `game.js` to call them.**

The resolver input must be a state snapshot and return a structured outcome (`deaths`, `pendingHunterRevenge`, `nextNightState`) rather than mutate global room state. `game.js` applies the returned outcome once. Victory must execute registered third-party checks first, then wolf elimination, wolf extinction, and moon victory; it must never use numerical parity.

- [ ] **Step 5: Run the resolver suite and the existing phase suite.**

Run: `npx vitest run games/werewolf/server/__tests__/victory.test.ts games/werewolf/server/__tests__/night.test.ts games/werewolf/server/__tests__/phases.test.ts`

Expected: PASS.

## Task 3: Implement the placeholder fate lifecycle

**Files:**
- Create: `games/werewolf/server/fate/cards.js`
- Modify: `games/werewolf/server/game.js:120-165, 302-327, 452-585`
- Modify: `games/werewolf/server/__tests__/fate-flow.test.ts`

- [ ] **Step 1: Add failing tests for weighted tendency, major triggers and placeholder processing.**

```ts
it('adds major cards only after an eligible trigger', () => {
  expect(eligibleCards({ majorTriggers: [] }).every(c => c.arcanaType === 'minor')).toBe(true)
  expect(eligibleCards({ majorTriggers: ['first-wolf-death'] }).some(c => c.arcanaType === 'major')).toBe(true)
})

it('marks a placeholder card processed without changing alive players or votes', () => {
  const before = snapshot(room)
  applyFateEffect(room, placeholderCard)
  expect(room.gameState.fate.processedCardIds).toContain(placeholderCard.id)
  expect(snapshotPlayers(room)).toEqual(before.players)
})
```

- [ ] **Step 2: Run the test file and verify the missing fate module fails.**

Run: `npx vitest run games/werewolf/server/__tests__/fate-flow.test.ts`

Expected: FAIL with missing exports.

- [ ] **Step 3: Define the final placeholder card data contract and weighted draw.**

```js
export function drawFateCard({ votes, triggers, random = Math.random }) {
  const pool = eligibleCards({ majorTriggers: triggers })
  const weights = tendencyWeights(votes)
  const total = pool.reduce((sum, card) => sum + weights[card.tendency], 0)
  let cursor = random() * total
  for (const card of pool) {
    cursor -= weights[card.tendency]
    if (cursor <= 0) return card
  }
  return pool.at(-1)
}
```

Use a deterministic injected random function in tests. Define minor placeholder cards for all four tendencies and major placeholders for `first-wolf-death`, `endgame`, and `two-peaceful-nights`.

- [ ] **Step 4: Change the phase order in `game.js`.**

At night completion, calculate triggers and enter `fate-council` with `currentFateCard: null`. When every eligible dead player has voted or the host ends the window, draw and apply the placeholder card, append `{ round, cardId, arcanaType, tendency, processedAt }` to public history, then enter `fate-card-reveal`.

- [ ] **Step 5: Run fate and integration tests.**

Run: `npx vitest run games/werewolf/server/__tests__/fate-flow.test.ts games/werewolf/server/__tests__/phases.test.ts`

Expected: PASS.

## Task 4: Repair core role actions and server phase permissions

**Files:**
- Modify: `games/werewolf/server/game.js:369-449, 588-703`
- Modify: `games/werewolf/shared/types.ts:80-128`
- Create: `games/werewolf/server/__tests__/actions.test.ts`

- [ ] **Step 1: Write failing action tests.**

```ts
it('allows a fate weaver to choose a card and its required target independently', () => {
  const result = actionWerewolf(room, weaverId, {
    type: 'fate-weaver-card', cardId: 'guard', targetId: villagerId,
  })
  expect(result.status).toBe(200)
  expect(room.gameState.night.fateweaverGuard).toBe(villagerId)
})

it('rejects a target-less kill or guard card but permits save and skip', () => {
  expect(actionWerewolf(room, weaverId, { type: 'fate-weaver-card', cardId: 'kill' }).status).toBe(400)
  expect(actionWerewolf(room, weaverId, { type: 'fate-weaver-card', cardId: 'save' }).status).toBe(200)
})

it('allows only living non-PK candidates to submit a PK vote', () => {
  expect(actionWerewolf(room, candidateId, { type: 'pk-vote', targetId: otherCandidateId }).status).toBe(403)
})
```

- [ ] **Step 2: Run the action tests and confirm existing action shapes fail.**

Run: `npx vitest run games/werewolf/server/__tests__/actions.test.ts`

Expected: FAIL until separate `cardId` and `targetId` handling is in place.

- [ ] **Step 3: Generate private actions from the tagged union and validate each server-side.**

`fate-weaver-card` must receive `cardId` separately from `targetId`; `save` clears only the resolved wolf-kill target and cannot erase self-sacrifices. The server must return a disabled action after a successful submission so replays are idempotent. Preserve deliberate no-action and hunter skip behavior.

- [ ] **Step 4: Add second-round opt-in and ordered speaker actions.**

Add `discussion-opt-in` during `discussion-r2`, retain an ordered list of living opt-ins, and expose the current `speakerNickname`. Add a host-only progression endpoint or a public host action that moves the speaker without granting players phase advancement authority.

- [ ] **Step 5: Correct vote progress projections.**

For `pk-voting`, compute `{ cast: Object.keys(pkVotes).length, expected: eligibleNonCandidates.length }`; for normal voting use all living voters. Add tests for both counts.

- [ ] **Step 6: Run action and phase tests.**

Run: `npx vitest run games/werewolf/server/__tests__/actions.test.ts games/werewolf/server/__tests__/phases.test.ts`

Expected: PASS.

## Task 5: Deliver phone interaction, personal tools, public history and safe production host UI

**Files:**
- Modify: `games/werewolf/client/PhonePage.tsx:103-306`
- Modify: `games/werewolf/client/BigScreenPage.tsx:459-720`
- Modify: `games/werewolf/shared/types.ts:28-128`
- Create: `games/werewolf/client/__tests__/phone-actions.test.tsx`
- Create: `games/werewolf/client/__tests__/history-and-notes.test.tsx`

- [ ] **Step 1: Write failing phone interaction tests.**

```tsx
it('submits a card id and target id independently', async () => {
  render(<ActionPanel action={weaverAction} onSubmit={onSubmit} />)
  await user.click(screen.getByRole('button', { name: /守护牌/ }))
  await user.click(screen.getByRole('button', { name: '小明' }))
  await user.click(screen.getByRole('button', { name: /提交/ }))
  expect(onSubmit).toHaveBeenCalledWith({ type: 'fate-weaver-card', cardId: 'guard', targetId: 'p1' })
})

it('selects exactly two targets for a multi-target action', async () => {
  render(<ActionPanel action={{ ...cupidAction, requiredTargetCount: 2 }} onSubmit={onSubmit} />)
  await user.click(screen.getByRole('button', { name: '甲' }))
  await user.click(screen.getByRole('button', { name: '乙' }))
  expect(screen.getByRole('button', { name: /提交/ })).toBeEnabled()
})
```

- [ ] **Step 2: Run the component tests and verify they fail.**

Run: `npx vitest run games/werewolf/client/__tests__/phone-actions.test.tsx`

Expected: FAIL because the current panel has only one selected target and no card model.

- [ ] **Step 3: Replace the generic panel state with typed action renderers.**

Create local components `SingleTargetAction`, `WolfAction`, `CardAndTargetAction`, `MultiTargetAction`, `FateVoteAction`, and `DiscussionOptInAction`. Each builds only the payload accepted by its action type. Disable submit until required selections are complete; preserve selected state after failed requests and show server error text.

- [ ] **Step 4: Add local personal tools and server-provided public history.**

Persist `suspects`, `trusts`, and `notes` under a room-and-player-specific `localStorage` key. Render a compact history list of fate-card reveals, night outcomes, vote totals and executions supplied by `WerewolfPublicState.history`; do not put secret role data in history.

- [ ] **Step 5: Replace the always-visible test panel with an explicit host/development control surface.**

Remove `FloatingTestPanel` from normal `FateWerewolfBigScreen` rendering. Render a host control only when an explicit `?devWerewolf=1` flag is present; label it development-only. The normal stage renders the public phase, current speaker, fate card and history only.

- [ ] **Step 6: Run phone and existing visual tests.**

Run: `npx vitest run games/werewolf/client/__tests__ src/__tests__/werewolf-corner-layout.test.ts src/__tests__/werewolf-illustration-layout.test.ts`

Expected: PASS. If the known bottom-illustration test still fails, repair the layout or update the assertion only when the design requirement supports the changed value.

## Task 6: Publish the core-mode player range and prove end-to-end behavior

**Files:**
- Modify: `server/platform/game-catalog.js:16-29`
- Modify: `games/werewolf/manifest.ts:1-8`
- Create: `games/werewolf/server/__tests__/core-game.integration.test.ts`
- Modify: `docs/fate-werewolf-architecture.md:1-55`

- [ ] **Step 1: Write 6, 8 and 10 player full-flow integration tests.**

```ts
for (const players of [6, 8, 10]) {
  it(`completes a ${players}-player core game without leaked roles`, async () => {
    const room = await startedRoom(players)
    await driveGameToCompletion(room, deterministicChoices)
    expect(publicWerewolfState(room).phase).toBe('complete')
    expect(JSON.stringify(publicWerewolfState(room))).not.toMatch(/werewolf|guardian|oracle|fateweaver/)
  })
}
```

- [ ] **Step 2: Run the integration tests and verify they initially expose any stalled phase or illegal transition.**

Run: `npx vitest run games/werewolf/server/__tests__/core-game.integration.test.ts`

Expected: FAIL until all core phases and action completion conditions are connected.

- [ ] **Step 3: Set both product entry points to 6–10 players and provide all six core roles through the configuration table.**

Set `players: "6-10"`, `minPlayers: 6`, `maxPlayers: 10` in the catalog and `playerRange: { min: 6, max: 10 }` in the manifest. Use a deterministic deck-table validation that every listed deck has exactly the player count and only registered core roles.

- [ ] **Step 4: Update the architecture document to match React paths and the implemented core-mode/fate contract.**

Document the actual `games/werewolf/` paths, server authority, placeholder effect policy, future extension points and intentionally deferred roles.

- [ ] **Step 5: Run full verification.**

Run: `npm run test:ui && npm run build`

Expected: every test passes and Vite produces `build/` successfully.

- [ ] **Step 6: Perform manual smoke tests.**

Run: `npm run dev:all`

Check: create a Fate Werewolf room; join six phones; confirm role assignment; complete every core night action; have a dead phone vote in Fate Council; verify a placeholder minor card reveals after voting; complete voting/PK; restart and repeat at eight and ten players. Confirm normal big-screen mode contains no test controls and no player role names.

## Plan self-review

- Spec coverage: Tasks 1–2 cover rule contract, roles, night resolution and victory; Task 3 covers minor/major placeholder fate lifecycle; Task 4 covers action validation and day permissions; Task 5 covers phone tools and stage UI; Task 6 covers ranges, documentation and full verification.
- No placeholders: `placeholder` appears only as the intentional product effect key defined by the approved specification, never as an omitted engineering step.
- Type consistency: all client action variants map to separate server payload fields; no client field multiplexes card choice and player target.
