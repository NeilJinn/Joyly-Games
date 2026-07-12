import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import InRoomPage from "../pages/player/InRoomPage";
import { useRoomStore } from "../stores/roomStore";
import type { Room } from "../types/room";

vi.mock("../hooks/useSSE", () => ({ useSSE: () => undefined }));
vi.mock("../stores/authStore", () => ({
  useAuthStore: (selector: (state: { isSignedIn: boolean }) => unknown) => selector({ isSignedIn: false }),
}));
vi.mock("../game-runtime/GameSurfaces", () => ({
  GamePhoneRuntime: ({ gameId }: { gameId?: string }) => <div data-testid="game-phone-surface">{gameId} package</div>,
}));

const room: Room = {
  code: "1234",
  host: { name: "Host", email: "host@example.com" },
  players: [],
  status: "playing",
  selectedGame: {
    id: "fate-werewolf",
    title: "命运狼人",
    genre: "Social deduction",
    players: "6-10",
    minPlayers: 6,
    maxPlayers: 10,
    mood: "Moonlit",
    status: "playable",
    description: "",
  },
  paymentMode: "free",
  entitlement: { type: "free" },
  launchCountdown: null,
  gameSetup: null,
  gameState: null,
  createdAt: Date.now(),
};

describe("InRoomPage game runtime", () => {
  beforeEach(() => useRoomStore.setState({ room }));

  it("loads the selected game package for a werewolf player instead of the generic live page", () => {
    render(
      <MemoryRouter initialEntries={["/play/1234"]}>
        <Routes><Route path="/play/:code" element={<InRoomPage />} /></Routes>
      </MemoryRouter>,
    );

    expect(screen.getByTestId("game-phone-surface")).toHaveTextContent("fate-werewolf package");
    expect(screen.queryByText(/is live/i)).not.toBeInTheDocument();
  });
});
