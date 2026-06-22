# Fate Werewolf Prototype Architecture

## Intent

This first pass keeps `Fate Werewolf` fully separate from `Cosmic Trivia`.
It uses the same Joyly platform shell only for:

- room lifecycle
- host and phone transport
- shared player profiles
- shared UI helpers and CSS foundations

All werewolf rule logic lives in its own runtime and its own client module.

## Runtime Split

- `server/games/fate-werewolf.js`
  - role dealing
  - authoritative phase state machine
  - public stage state
  - private player state
  - werewolf night targeting
  - daytime voting
  - basic victory checks

- `public/games/fate-werewolf/client.js`
  - host stage rendering
  - private phone rendering
  - local notes
  - private-state fetches
  - game-specific action wiring

- `public/games/fate-werewolf/styles.css`
  - Figma-inspired occult stage and card presentation
  - day/night theme variants
  - host/phone layout styling

## First-Pass Phase Model

- `role-reveal`
- `first-night`
- `night-werewolf`
- `daybreak`
- `day-discussion`
- `voting`
- `results`
- `nightfall`
- `complete`

Each phase has:

- a single player expectation
- a server-owned timer
- a public headline and message
- private action rules when relevant

## Public vs Private Data

Public room state exposes:

- current phase
- stage theme
- seat list
- alive/dead state
- progress counts
- last public outcome

Private werewolf state exposes:

- role card
- team
- living packmates
- current personal action
- prototype prompt copy

This separation is critical for later expansion into:

- Cupid and lovers
- Guardian protection
- Oracle prophecy
- Fate Council for dead players
- tarot blessings
- full destiny card orchestration

## Next Expansion Path

1. Add dead-player Fate Council state and voting.
2. Add modular night resolvers per role.
3. Add destiny deck and omen outputs.
4. Add richer host direction and animated transitions.
5. Move roles and phase definitions into smaller files once the rule surface stabilizes.
