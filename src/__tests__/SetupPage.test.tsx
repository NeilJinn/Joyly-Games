import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import SetupPage from "../pages/platform/SetupPage";

const mockNavigate = vi.fn();
const paymentModalMock = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock("../hooks/useConfig", () => ({
  useConfig: () => ({
    config: {
      games: [
        {
          id: "fate-werewolf",
          title: "Fate Werewolf",
          genre: "Social deduction ritual",
          players: "5-8",
          minPlayers: 5,
          maxPlayers: 8,
          mood: "Occult moonlit drama",
          status: "playable",
          description: "Moonlit deduction with private roles.",
          price: 8,
          credits: 3,
        },
        {
          id: "after-hours",
          title: "After Hours",
          genre: "Social deduction",
          players: "5-12",
          minPlayers: 5,
          maxPlayers: 12,
          mood: "Neon mystery",
          status: "coming-soon",
          description: "A fast bluffing game.",
          price: 8,
          credits: 3,
        },
      ],
    },
  }),
}));

vi.mock("../stores/authStore", () => ({
  useAuthStore: (selector: (state: { isSignedIn: boolean }) => boolean) =>
    selector({ isSignedIn: true }),
}));

vi.mock("../components/platform/NavBar", () => ({
  default: () => <div>NavBar</div>,
}));

vi.mock("../components/platform/GamePickerModal", () => ({
  default: () => null,
}));

vi.mock("../components/platform/PaymentModal", () => ({
  default: (props: unknown) => {
    paymentModalMock(props);
    return <div data-testid="payment-modal-probe" />;
  },
}));

describe("SetupPage", () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    paymentModalMock.mockReset();
  });

  it("shows only playable games on the setup page", () => {
    render(<SetupPage />);

    expect(screen.getByText("Fate Werewolf")).toBeInTheDocument();
    expect(screen.queryByText("After Hours")).not.toBeInTheDocument();
  });

  it("does not open payment until a game is chosen", () => {
    render(<SetupPage />);

    const lastCall = paymentModalMock.mock.calls[paymentModalMock.mock.calls.length - 1]?.[0] as {
      open: boolean;
    };
    expect(lastCall.open).toBe(false);
  });

  it("opens payment for the selected playable game", () => {
    render(<SetupPage />);

    fireEvent.click(screen.getByRole("button", { name: /fate werewolf/i }));

    const lastCall = paymentModalMock.mock.calls[paymentModalMock.mock.calls.length - 1]?.[0] as {
      open: boolean;
      game: { id: string };
    };

    expect(lastCall.open).toBe(true);
    expect(lastCall.game.id).toBe("fate-werewolf");
  });
});
