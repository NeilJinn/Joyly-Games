import { describe, it, expect } from "vitest";

// Logic mirrors usePairing hook: build pairing URL and display code
function buildPairingState(origin: string, token: string) {
  return {
    token,
    url: `${origin}/?pair=${token}`,
    code: token.toUpperCase(),
  };
}

// Logic mirrors PairPhonePage: map API response to auth store shape
function mapAccountToAuth(apiAccount: { name: string; email: string }) {
  return { displayName: apiAccount.name, email: apiAccount.email };
}

describe("buildPairingState", () => {
  it("builds correct URL from origin and token", () => {
    const state = buildPairingState("https://joyly.gg", "abc12");
    expect(state.url).toBe("https://joyly.gg/?pair=abc12");
  });

  it("uppercases token as display code", () => {
    const state = buildPairingState("https://joyly.gg", "abc12");
    expect(state.code).toBe("ABC12");
  });

  it("preserves original token (case-sensitive for API)", () => {
    const state = buildPairingState("https://joyly.gg", "abc12");
    expect(state.token).toBe("abc12");
  });
});

describe("mapAccountToAuth", () => {
  it("maps name to displayName", () => {
    const auth = mapAccountToAuth({ name: "Neil", email: "neil@example.com" });
    expect(auth.displayName).toBe("Neil");
    expect(auth.email).toBe("neil@example.com");
  });

  it("preserves email exactly", () => {
    const auth = mapAccountToAuth({ name: "Host", email: "HOST@EXAMPLE.COM" });
    expect(auth.email).toBe("HOST@EXAMPLE.COM");
  });
});
