import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import NavBar from "../../components/platform/NavBar";
import PaymentModal from "../../components/platform/PaymentModal";
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
  const [paymentOpen, setPaymentOpen] = useState(false);
  const playableGames = config.games.filter((game) => game.status === "playable");

  useEffect(() => {
    if (!isSignedIn) {
      navigate("/", { replace: true });
    }
  }, [isSignedIn, navigate]);

  function handleRoomCreated(room: Room) {
    navigate(`/room/${room.code}`);
  }

  function handleSelectGame(gameId: string) {
    const game = playableGames.find((g) => g.id === gameId) ?? null;
    if (!game) return;
    setSelectedGame(game);
    setPaymentOpen(true);
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
        <div className="w-[min(1120px,100%)] grid gap-[26px]">
          <div className="flex items-start justify-between gap-[20px] mb-[2px]">
            <div>
              <h2 className="m-0 text-[24px] font-[800] text-[var(--ink)]">
                Choose a Game
              </h2>
              <p className="text-[var(--muted)] text-[14px] mt-[6px] mb-0">
                Pick a playable game and we will open payment right away.
              </p>
            </div>
          </div>

          {playableGames.length > 0 ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-[16px]">
              {playableGames.map((game) => (
                <button
                  key={game.id}
                  className={[
                    "group grid grid-cols-1 md:[grid-template-columns:240px_1fr] gap-[18px] p-[18px]",
                    "rounded-[10px] border border-white/[.12] bg-[rgba(17,24,33,.94)] [box-shadow:var(--shadow)]",
                    "text-left cursor-pointer transition-[transform,border-color,box-shadow,background-color] duration-[180ms]",
                    "hover:-translate-y-[2px] hover:border-[rgba(160,233,120,.9)] hover:bg-[rgba(28,40,46,.99)]",
                    "hover:[box-shadow:0_0_0_2px_rgba(160,233,120,.28),0_0_36px_rgba(146,224,109,.18),0_26px_56px_rgba(5,10,18,.5)]",
                    selectedGame?.id === game.id
                      ? "border-[rgba(120,212,94,.72)] [box-shadow:0_0_0_2px_rgba(120,212,94,.14),var(--shadow)]"
                      : "",
                  ].join(" ")}
                  type="button"
                  onClick={() => handleSelectGame(game.id)}
                >
                  <div
                    className={[
                      `game-art rounded-[8px] game-art-${game.id}`,
                      "transition-[filter,transform] duration-[180ms]",
                      "group-hover:brightness-[1.18] group-hover:saturate-[1.08]",
                    ].join(" ")}
                  />
                  <div className="flex flex-col justify-between gap-[16px] min-w-0">
                    <div className="grid gap-[10px]">
                      <span className="flex items-center gap-[6px] text-[11px] font-[950] tracking-[.08em] uppercase text-[var(--green)]">
                        <Icon name="game" />
                        Choose game
                      </span>
                      <Tag>{game.genre}</Tag>
                      <div>
                        <h3 className="m-0 text-[24px] font-[800] text-[var(--ink)]">
                          {game.title}
                        </h3>
                        <p className="text-[var(--muted)] text-[14px] mt-[8px] mb-0 leading-[1.5]">
                          {game.description}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-end justify-between gap-[16px] flex-wrap">
                      <div className="flex flex-wrap gap-[8px] text-[12px] text-[var(--muted)]">
                        <span className="rounded-full border border-white/[.12] px-[10px] py-[6px]">
                          {game.players} players
                        </span>
                        <span className="rounded-full border border-white/[.12] px-[10px] py-[6px]">
                          {game.mood}
                        </span>
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="grid gap-[10px] p-[20px] rounded-[10px] border border-white/[.1] bg-[rgba(17,24,33,.92)]">
              <span className="flex items-center gap-[8px] text-[12px] font-[950] tracking-[.08em] uppercase text-[var(--green)]">
                <Icon name="star" />
                No playable games
              </span>
              <h3 className="m-0 text-[20px] font-[800] text-[var(--ink)]">
                There is nothing to start right now.
              </h3>
              <p className="m-0 text-[14px] text-[var(--muted)]">
                Add a playable game to the config and this room setup screen will unlock automatically.
              </p>
            </div>
          )}
        </div>
      </section>

      <PaymentModal
        open={paymentOpen}
        game={selectedGame}
        onClose={() => setPaymentOpen(false)}
        onRoomCreated={handleRoomCreated}
      />
    </motion.div>
  );
}
