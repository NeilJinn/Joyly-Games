# Room Setup Game Selection Design

## Goal

Simplify the room-creation flow so hosts understand the next action immediately:

`Start a Jam -> Choose Game -> Pay -> Room`

The current `Set Up Room` page combines game selection, explanatory copy, and payment in one layer. The new design removes that extra reading step and makes game choice the primary action.

## Scope

This change applies to the signed-in host flow on the platform side:

- `/setup` becomes a direct game selection page
- only playable games appear in room-creation entry points
- selecting a game opens the existing payment modal immediately
- successful payment still creates the room and redirects to `/room/:code`
- if the user is not signed in, authentication remains the first gate

This change does not introduce a new payment page or a new room creation backend flow.

## User Flows

### 1. Signed-in host from Start a Jam

1. Host clicks `Start a Jam`
2. Host lands on `/setup`
3. Page shows playable games as direct-select cards
4. Host clicks a game card
5. Existing payment modal opens for that game
6. Payment succeeds
7. App navigates to the created room

### 2. Signed-in host from a specific game on the homepage

1. Host clicks `Start` under a specific game on the homepage
2. App treats that game as already selected
3. If the host is signed in, open the existing payment modal immediately
4. Payment succeeds
5. App navigates to the created room

### 3. Signed-out user from any room-creation entry point

1. User clicks `Start a Jam` or a game-specific `Start`
2. App requires sign-in first
3. After authentication, the user continues into the room-creation flow
4. Generic `Start a Jam` continues to `/setup`
5. Game-specific `Start` continues directly to payment for that chosen game

## UI Design

### `/setup`

The page changes from `Set Up Room` to `Choose a Game`.

The main content should:

- show only playable games
- present each game as a clear, clickable card
- surface core decision info without extra copy:
  - title
  - player count
  - mood
  - price or credits if already part of the current payment language
- avoid a separate selected-game hero card
- avoid requiring a second click to open a picker

The page should feel like a selection screen, not a setup summary.

### Payment

Keep the existing `PaymentModal`.

The modal becomes step two of the flow, opened by:

- clicking a game on `/setup`
- clicking `Start` under a specific homepage game when signed in

Closing the modal returns the user to the prior page and lets them choose again.

## Behavioral Rules

### Game visibility

- Room creation surfaces must only display `status === "playable"` games
- `coming soon` games should not appear in `/setup`
- `coming soon` games should not be selectable through the setup picker flow

### Default selection

- `/setup` should not auto-select the first game on page load
- the host should make an explicit choice

### Authentication gate

- authentication stays ahead of payment and room creation
- signed-out users cannot open the payment step until sign-in completes
- signed-in users can go straight to game selection or straight to payment, depending on the entry point

### Navigation and state

- payment success still uses the current room-created callback and room redirect
- closing payment should preserve the currently chosen game in memory for the current interaction when useful
- direct homepage game starts need a lightweight way to carry the chosen game into payment without forcing the setup page first

## Components and Responsibilities

### `src/pages/platform/SetupPage.tsx`

- replace the current selected-game summary layout with a playable-game grid
- filter out non-playable games
- clicking a card sets the current game and opens `PaymentModal`
- keep sign-in redirect behavior

### Homepage game start entry point

- if a user starts from a specific game and is signed in, open payment immediately for that game
- if not signed in, authentication must happen before continuing

The implementation can use route state, query state, or existing store patterns, but the behavior must stay explicit and predictable.

### `GamePickerModal`

- it is no longer needed as the primary selection UI for `/setup`
- if still kept in the codebase temporarily, it should not expose coming-soon games in the room-creation path

## Error Handling

- if a chosen game id is missing or invalid, do not open payment
- if the user reaches payment without a valid playable game, return them to selection
- if config loads with zero playable games, show a clear empty state instead of a broken selection page

## Testing

Cover at least these behaviors:

1. `/setup` shows only playable games
2. `/setup` does not auto-select a game
3. clicking a playable game opens payment
4. closing payment keeps the user on selection
5. signed-in homepage game start opens payment directly
6. signed-out room-creation actions require authentication first
7. payment success still redirects to the room page

## Recommended Implementation Shape

Keep the routing simple:

- use `/setup` as the direct selection page
- reuse the existing payment modal
- thread selected-game state from homepage entry points into the modal flow without creating a separate payment page

This keeps the mental model short for players while minimizing changes to the existing payment and room creation logic.
