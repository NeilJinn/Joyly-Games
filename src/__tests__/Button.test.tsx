import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import Button from "../components/ui/Button";

describe("Button", () => {
  it("renders primary variant with children", () => {
    render(<Button variant="primary">Play</Button>);
    expect(screen.getByRole("button", { name: "Play" })).toBeInTheDocument();
  });

  it("renders secondary variant", () => {
    render(<Button variant="secondary">Sign in</Button>);
    expect(screen.getByRole("button", { name: "Sign in" })).toBeInTheDocument();
  });

  it("passes disabled state", () => {
    render(<Button variant="primary" disabled>Play</Button>);
    expect(screen.getByRole("button")).toBeDisabled();
  });
});
