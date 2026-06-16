import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import NavBar from "../../components/platform/NavBar";
import GamePickerModal from "../../components/platform/GamePickerModal";
import PaymentModal from "../../components/platform/PaymentModal";
import Button from "../../components/ui/Button";
import Icon from "../../components/ui/Icon";
import Tag from "../../components/ui/Tag";
import { useConfig } from "../../hooks/useConfig";
import { useAuthStore } from "../../stores/authStore";
import type { Room } from "../../types/room";
import type { GameConfig } from "../../types/config";

export default function SetupPage() {
  const navigate = useNavigate();
  const { config } = useConfig();
  const isSignedIn = useAuthStore((s) => s.isSignedIn);

  const [selectedGame, setSelectedGame] = useState<GameConfig | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);

  // Default to first playable game
  useEffect(() => {
    if (!selectedGame && config.games.length > 0) {
      const first = config.games.find((g) => g.status === "playable") ?? config.games[0];
      setSelectedGame(first);
    }
  }, [config.games, selectedGame]);

  // Redirect unauthenticated users
  useEffect(() => {
    if (!isSignedIn) {
      navigate("/", { replace: true });
    }
  }, [isSignedIn, navigate]);

  function handleRoomCreated(room: Room) {
    navigate(`/room/${room.code}`);
  }

  function handleSelectGame(gameId: string) {
    const game = config.games.find((g) => g.id === gameId) ?? null;
    setSelectedGame(game);
    setPickerOpen(false);
  }

  if (!isSignedIn) return null;

  return (
    <motion.div
      className="min-h-screen pt-[52px]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.22 }}
    >
      <NavBar />

      {/* Setup area */}
      <section
        className="grid place-items-center p-[34px]"
        style={{ minHeight: "calc(100vh - 52px)" }}
      >
        <div className="w-[min(980px,100%)] grid gap-[24px]">
          <div className="flex items-start justify-between gap-[20px] mb-[4px]">
            <div>
              <h2 className="m-0 text-[24px] font-[800] text-[var(--ink)]">
                Set Up Room
              </h2>
              <p className="text-[var(--muted)] text-[14px] mt-[6px] mb-0">
                Choose a game, then open a 2–8 player room.
              </p>
            </div>
          </div>

          {/* Selected game card */}
          <button
            className={[
              "grid [grid-template-columns:340px_1fr] min-h-[230px] p-[18px] gap-[18px]",
              "rounded-[8px] border border-white/[.12] bg-[rgba(17,24,33,.92)] [box-shadow:var(--shadow)]",
              "cursor-pointer text-left w-full",
              "hover:border-white/[.2] transition-colors",
            ].join(" ")}
            type="button"
            onClick={() => setPickerOpen(true)}
          >
            <div
              className={`game-art rounded-[6px] ${selectedGame ? `game-art-${selectedGame.id}` : ""}`}
            />
            <div className="flex flex-col justify-center gap-[10px]">
              <span className="flex items-center gap-[6px] text-[11px] font-[950] tracking-[.08em] uppercase text-[var(--green)]">
                <Icon name="game" />
                Choose game
              </span>
              {selectedGame && (
                <>
                  <Tag>{selectedGame.genre}</Tag>
                  <h3 className="m-0 text-[22px] font-[800] text-[var(--ink)]">
                    {selectedGame.title}
                  </h3>
                  <p className="text-[var(--muted)] text-[14px] m-0">
                    {selectedGame.players} players · {selectedGame.mood}
                  </p>
                </>
              )}
              {!selectedGame && (
                <p className="text-[var(--muted)] text-[14px] m-0">
                  Tap to choose a game
                </p>
              )}
            </div>
          </button>

          {/* Setup summary */}
          <div className="grid gap-[10px] p-[14px] rounded-[8px] bg-[rgba(23,29,37,.6)] border border-white/[.07]">
            <div className="flex items-center gap-[10px] text-[14px] text-[var(--muted)]">
              <Icon name="users" />
              <span>Players choose their characters on their phones.</span>
            </div>
            <div className="flex items-center gap-[10px] text-[14px] text-[var(--muted)]">
              <Icon name="music" />
              <span>Bright stage colors are ready for an upbeat music loop.</span>
            </div>
          </div>

          {/* CTA */}
          <Button
            variant="primary"
            className="w-full min-h-[52px] text-[16px]"
            disabled={!selectedGame || selectedGame.status !== "playable"}
            onClick={() => setPaymentOpen(true)}
          >
            <Icon name="card" />
            <span>Payment · Create room</span>
          </Button>
        </div>
      </section>

      {/* Modals */}
      <GamePickerModal
        open={pickerOpen}
        games={config.games}
        selectedGameId={selectedGame?.id ?? null}
        onSelect={handleSelectGame}
        onClose={() => setPickerOpen(false)}
      />
      <PaymentModal
        open={paymentOpen}
        game={selectedGame}
        onClose={() => setPaymentOpen(false)}
        onRoomCreated={handleRoomCreated}
      />
    </motion.div>
  );
}
