# Joyly Motion System Worktree Plan

This repository uses one orchestration branch plus one worktree branch per milestone.

## Branch Roles

- `jms/architecture-orchestrator`
  - Current control branch.
  - Owns only architecture, scope, interfaces, milestone boundaries, and acceptance criteria.
  - Does not own implementation details for motion, theme assets, or gameplay behavior.

- `jms/m1-motion-core`
  - Motion Core foundation.
  - Timeline, GSAP adapter, transform-driven motion, cancellation/replacement, reduced-motion support, and debug hooks.

- `jms/m2-playground`
  - Independent demo and sandbox.
  - Cue preview, theme switching, parameter tuning, timeline inspection, and resource state visibility.

- `jms/m3-presentation-modules`
  - Reusable presentation modules.
  - Phase Transition, Card Entrance, Card Flip Reveal, and Victory Sequence.

- `jms/m4-theme-adapter`
  - Theme and asset mapping layer.
  - PNG, Sprite Sheet, PNG Sequence, sound, particles, glow styles, backgrounds, and UI tokens.

- `jms/m5-advanced-fx`
  - Advanced effect system.
  - Vote Collection, Countdown, Impact Board, Spotlight Reveal, advanced particles, audio sync, and resource recycling.

## Recommended Worktree Layout

Default worktree root:

`../jms-worktrees`

Expected checkout paths:

- `../jms-worktrees/m1-motion-core`
- `../jms-worktrees/m2-playground`
- `../jms-worktrees/m3-presentation-modules`
- `../jms-worktrees/m4-theme-adapter`
- `../jms-worktrees/m5-advanced-fx`

## Operating Rules

- Keep the orchestrator branch free of implementation work.
- Each milestone branch should stay isolated and own only its target slice.
- Changes that affect multiple milestones should be recorded here first as a boundary decision, then implemented in the relevant branch.
- Platform, room, and game code stay outside JMS until a thin bridge is explicitly defined.

