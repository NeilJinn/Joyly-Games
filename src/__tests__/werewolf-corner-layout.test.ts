import { describe, expect, it } from "vitest";
import { getCornerDecorationLayout } from "../../games/werewolf/client/BigScreenPage";

describe("getCornerDecorationLayout", () => {
  it("keeps the decoration frame at the original aspect ratio and aligns it to the intended side and bottom insets", () => {
    const layout = getCornerDecorationLayout();

    expect(layout.scaleX).toBeCloseTo(layout.scaleY, 6);
    expect(layout.left.width).toBeCloseTo(layout.right.width, 6);
    expect(layout.left.height).toBeCloseTo(layout.right.height, 6);
    expect(layout.left.left).toBe(layout.sideInset);
    expect(layout.top).toBe(layout.topInset);
    expect(810 - (layout.top + layout.left.height)).toBeCloseTo(layout.bottomInset, 6);
    expect(1440 - (layout.right.left + layout.right.width)).toBeCloseTo(layout.sideInset, 6);
    expect(layout.right.left).toBeGreaterThan(layout.left.width);
  });
});
