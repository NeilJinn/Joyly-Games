import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import AvatarStack from "../components/player/AvatarStack";
import type { AvatarSelection } from "../types/avatar";

const mockAvatar: AvatarSelection = {
  characterId: "Charac-1-wave",
  hatId: "Hat-1-firefighter",
  decorationId: null,
  paletteId: "gold",
};

describe("AvatarStack", () => {
  it("renders character and hat images", () => {
    const { container } = render(<AvatarStack avatar={mockAvatar} />);
    const imgs = container.querySelectorAll("img");
    expect(imgs).toHaveLength(2); // character + hat; no decoration
    expect(imgs[0].src).toContain("Charac-1-wave.png");
    expect(imgs[1].src).toContain("Hat-1-firefighter.png");
  });

  it("applies large class for size=large", () => {
    const { container } = render(<AvatarStack avatar={mockAvatar} size="large" />);
    expect(container.firstChild).toHaveClass("large");
  });

  it("renders no images when avatar is null (just the ring and core)", () => {
    const { container } = render(<AvatarStack avatar={null} />);
    const imgs = container.querySelectorAll("img");
    expect(imgs).toHaveLength(0);
  });

  it("applies custom ringColor via CSS custom property", () => {
    const { container } = render(
      <AvatarStack avatar={mockAvatar} ringColor="#ff0000" />
    );
    const el = container.firstChild as HTMLElement;
    expect(el.style.getPropertyValue("--avatar-ring")).toBe("#ff0000");
  });
});
