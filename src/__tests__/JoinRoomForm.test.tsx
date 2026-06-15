import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";
import JoinRoomForm from "../components/platform/JoinRoomForm";

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return { ...actual, useNavigate: () => mockNavigate };
});

const mockFetch = vi.fn();
global.fetch = mockFetch;

beforeEach(() => {
  vi.clearAllMocks();
});

function renderForm() {
  return render(
    <MemoryRouter>
      <JoinRoomForm />
    </MemoryRouter>
  );
}

describe("JoinRoomForm", () => {
  it("shows error for non-6-digit input", async () => {
    renderForm();
    const input = screen.getByPlaceholderText("Room code");
    const button = screen.getByRole("button", { name: /join/i });

    fireEvent.change(input, { target: { value: "123" } });
    fireEvent.click(button);

    expect(await screen.findByText("Enter a 6 digit code.")).toBeInTheDocument();
  });

  it("navigates to /join/:code when room exists", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) });
    renderForm();

    const input = screen.getByPlaceholderText("Room code");
    fireEvent.change(input, { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: /join/i }));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/join/123456");
    });
  });

  it("shows error when room is not found", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: "Not found" }),
    });
    renderForm();

    const input = screen.getByPlaceholderText("Room code");
    fireEvent.change(input, { target: { value: "999999" } });
    fireEvent.click(screen.getByRole("button", { name: /join/i }));

    expect(await screen.findByText("Room not found.")).toBeInTheDocument();
  });
});
