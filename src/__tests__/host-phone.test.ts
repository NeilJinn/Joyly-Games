import { describe, it, expect } from "vitest";
import type { Room, Player } from "../types/room";

// Mirror of getLaunchState from HostPhonePage — tests the same contract
function getLaunchState(room: Room): { label: string; endpoint: string; disabled: boolean } {
  const game = room.selectedGame;
  if (!game) return { label: "Select a game first", endpoint: "force-start", disabled: true };
  if (room.players.length < (game.minPlayers ?? 2)) {
    return { label: `Need ${game.minPlayers ?? 2} players`, endpoint: "force-start", disabled: true };
  }
  const allReady = room.players.length > 0 && room.players.every((p) => p.ready);
  return allReady
    ? { label: "Start now", endpoint: "start", disabled: false }
    : { label: "Force start", endpoint: "force-start", disabled: false };
}

function makeRoom(overrides: Partial<Room> = {}): Room {
  return {
    code: "1234",
    status: "waiting",
    host: { email: "host@example.com", name: "Host" },
    players: [],
    selectedGame: null,
    gameState: null,
    paymentMode: "free",
    entitlement: { type: "free" },
    launchCountdown: null,
    gameSetup: null,
    createdAt: Date.now(),
    ...overrides,
  } as unknown as Room;
}

function makePlayer(ready: boolean): Player {
  return {
    id: "p1",
    nickname: "Player",
    ready,
    avatar: null,
    online: true,
  } as unknown as Player;
}

describe("getLaunchState", () => {
  it("disabled when no game selected", () => {
    const state = getLaunchState(makeRoom({ selectedGame: null }));
    expect(state.disabled).toBe(true);
    expect(state.label).toMatch(/select a game/i);
  });

  it("disabled when not enough players", () => {
    const state = getLaunchState(
      makeRoom({
        selectedGame: {
          id: "cosmic-trivia",
          title: "Cosmic Trivia",
          minPlayers: 2,
          maxPlayers: 8,
        } as any,
        players: [makePlayer(true)],
      })
    );
    expect(state.disabled).toBe(true);
    expect(state.label).toMatch(/need/i);
  });

  it("force-start when enough players but not all ready", () => {
    const state = getLaunchState(
      makeRoom({
        selectedGame: {
          id: "cosmic-trivia",
          title: "Cosmic Trivia",
          minPlayers: 2,
          maxPlayers: 8,
        } as any,
        players: [makePlayer(true), makePlayer(false)],
      })
    );
    expect(state.disabled).toBe(false);
    expect(state.endpoint).toBe("force-start");
  });

  it("start when all players ready", () => {
    const state = getLaunchState(
      makeRoom({
        selectedGame: {
          id: "cosmic-trivia",
          title: "Cosmic Trivia",
          minPlayers: 2,
          maxPlayers: 8,
        } as any,
        players: [makePlayer(true), makePlayer(true)],
      })
    );
    expect(state.disabled).toBe(false);
    expect(state.endpoint).toBe("start");
    expect(state.label).toMatch(/start now/i);
  });
});

// Mirror of auth check from HostPhonePage
function isAuthorized(hostEmail: string | null | undefined, roomHostEmail: string | null | undefined): boolean {
  return Boolean(hostEmail && roomHostEmail && hostEmail === roomHostEmail);
}

describe("host auth check", () => {
  it("authorized when emails match", () => {
    expect(isAuthorized("host@example.com", "host@example.com")).toBe(true);
  });

  it("not authorized when emails differ", () => {
    expect(isAuthorized("other@example.com", "host@example.com")).toBe(false);
  });

  it("not authorized when host account is null", () => {
    expect(isAuthorized(null, "host@example.com")).toBe(false);
  });

  it("not authorized when room host is null", () => {
    expect(isAuthorized("host@example.com", null)).toBe(false);
  });
});
