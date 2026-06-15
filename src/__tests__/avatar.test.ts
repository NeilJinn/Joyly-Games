import { describe, it, expect } from "vitest";
import {
  paletteById,
  PALETTES,
  defaultAvatar,
  type AvatarSelection,
} from "../types/avatar";

describe("paletteById", () => {
  it("returns the matching palette", () => {
    const p = paletteById("gold");
    expect(p.id).toBe("gold");
    expect(p.fill).toBe("#ffd974");
    expect(p.ring).toBe("#fff9eb");
  });

  it("falls back to teal for unknown id", () => {
    const p = paletteById("nonexistent");
    expect(p.id).toBe("teal");
  });
});

describe("defaultAvatar", () => {
  it("builds a valid AvatarSelection with the given characterId", () => {
    const av: AvatarSelection = defaultAvatar("Charac-1-wave");
    expect(av.characterId).toBe("Charac-1-wave");
    expect(av.hatId).toBeNull();
    expect(av.decorationId).toBeNull();
    expect(av.paletteId).toBe("teal"); // defaultAvatar always uses PALETTES[0].id
  });
});
