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
      host: { name: "Host", email: "host@test.com" },
      selectedGame: null,
      paymentMode: "free",
      entitlement: { type: "free" },
      launchCountdown: null,
      gameSetup: null,
      gameState: null,
      createdAt: 0,
    });
    expect(useRoomStore.getState().room?.code).toBe("123456");
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
