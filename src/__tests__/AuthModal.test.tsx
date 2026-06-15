import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import AuthModal from "../components/platform/AuthModal";

describe("AuthModal", () => {
  it("does not render when closed", () => {
    const { container } = render(
      <AuthModal open={false} onClose={() => {}} />
    );
    expect(container.querySelector("form")).toBeNull();
  });

  it("renders the sign-in form when open", () => {
    render(<AuthModal open={true} onClose={() => {}} />);
    expect(screen.getByText("Host account")).toBeInTheDocument();
    expect(screen.getByLabelText(/display name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
  });

  it("calls onClose when backdrop is clicked", () => {
    const onClose = vi.fn();
    render(<AuthModal open={true} onClose={onClose} />);
    fireEvent.click(document.querySelector(".fixed")!);
    expect(onClose).toHaveBeenCalled();
  });

  it("stores account in authStore and calls onClose on submit", () => {
    const onClose = vi.fn();
    render(<AuthModal open={true} onClose={onClose} />);

    fireEvent.change(screen.getByLabelText(/display name/i), {
      target: { value: "Neil" },
    });
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: "neil@test.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));

    expect(onClose).toHaveBeenCalled();
  });
});
