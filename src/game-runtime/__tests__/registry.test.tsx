import { describe, expect, it } from "vitest";
import { getGamePackage, listGamePackages } from "../registry";

describe("game package registry", () => {
  it("resolves every configured game without platform-specific branching", () => {
    const packages = listGamePackages();

    expect(packages.map((game) => game.id)).toEqual(["cosmic-trivia", "fate-werewolf"]);
    expect(getGamePackage("cosmic-trivia")?.id).toBe("cosmic-trivia");
    expect(getGamePackage("fate-werewolf")?.id).toBe("fate-werewolf");
  });

  it("returns no package for an unknown game instead of rendering a generic live page", () => {
    expect(getGamePackage("unknown-game")).toBeUndefined();
  });
});
