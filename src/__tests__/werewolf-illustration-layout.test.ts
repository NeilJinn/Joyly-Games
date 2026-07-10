import { describe, expect, it } from "vitest";
import { getBottomIllustrationLayout, getCornerDecorationLayout } from "../../games/werewolf/client/BigScreenPage";

describe("getBottomIllustrationLayout", () => {
  it("anchors the bottom illustration to the inner frame corner, not the outer frame edge", () => {
    const frame = getCornerDecorationLayout();
    const illus = getBottomIllustrationLayout();

    expect(illus.bottom).toBeCloseTo(
      frame.bottomInset + frame.innerBottomLineOffset,
      6,
    );
    expect(illus.left).toBe(35);
    expect(illus.width).toBe(1369);
    expect(illus.height).toBe(393);
  });
});
