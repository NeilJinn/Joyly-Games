import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import HomePage from "../pages/platform/HomePage";

const mockNavigate = vi.fn();
const paymentModalMock = vi.fn();
const homeState = {
  isSignedIn: true,
};

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
      ],
      localJoinBase: "http://localhost:4173",
      tools: { voiceLibrary: false },
    },
    loading: false,
  }),
}));

vi.mock("../hooks/usePairing", () => ({
  usePairing: () => null,
}));

vi.mock("../stores/authStore", () => ({
  useAuthStore: (selector: (state: { isSignedIn: boolean }) => boolean) =>
    selector({ isSignedIn: homeState.isSignedIn }),
}));

vi.mock("../components/platform/NavBar", () => ({
  default: ({ onPlay, onSignIn }: { onPlay: () => void; onSignIn: () => void }) => (
    <div>
      <button onClick={onPlay}>Start a Jam</button>
      <button onClick={onSignIn}>Sign in</button>
    </div>
  ),
}));

vi.mock("../components/platform/PromoRail", () => ({
  default: ({ onPlay }: { onPlay: (gameId: string) => void }) => (
    <button onClick={() => onPlay("fate-werewolf")}>Promo play</button>
  ),
}));

vi.mock("../components/platform/CreateRoomButton", () => ({
  default: ({ onClick }: { onClick: () => void }) => (
    <button onClick={onClick}>Create room</button>
  ),
}));

vi.mock("../components/platform/JoinRoomForm", () => ({
  default: () => <div>Join room</div>,
}));

vi.mock("../components/platform/GameCard", () => ({
  default: ({
    game,
    onPlay,
  }: {
    game: { id: string; title: string };
    onPlay: (gameId: string) => void;
  }) => <button onClick={() => onPlay(game.id)}>Play {game.title}</button>,
}));

vi.mock("../components/platform/AuthModal", () => ({
  default: ({ open }: { open: boolean }) => (open ? <div>Host account</div> : null),
}));

vi.mock("../components/platform/PaymentModal", () => ({
  default: (props: unknown) => {
    paymentModalMock(props);
    return <div data-testid="home-payment-modal-probe" />;
  },
}));

describe("HomePage room flow", () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    paymentModalMock.mockReset();
    homeState.isSignedIn = true;
  });

  it("routes signed-in generic start to setup", () => {
    render(<HomePage />);

    fireEvent.click(screen.getByText("Create room"));

    expect(mockNavigate).toHaveBeenCalledWith("/room/setup");
  });

  it("opens payment directly for a signed-in game start", () => {
    render(<HomePage />);

    fireEvent.click(screen.getByRole("button", { name: /play fate werewolf/i }));

    expect(mockNavigate).not.toHaveBeenCalled();

    const lastCall = paymentModalMock.mock.calls[paymentModalMock.mock.calls.length - 1]?.[0] as {
      open: boolean;
      game: { id: string };
    };
    expect(lastCall.open).toBe(true);
    expect(lastCall.game.id).toBe("fate-werewolf");
  });

  it("prompts sign-in before room creation when signed out", () => {
    homeState.isSignedIn = false;
    render(<HomePage />);

    fireEvent.click(screen.getByRole("button", { name: /play fate werewolf/i }));

    expect(mockNavigate).not.toHaveBeenCalled();
    expect(screen.getByText("Host account")).toBeInTheDocument();
  });
});
