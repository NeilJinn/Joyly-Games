import { useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import NavBar from "../../components/platform/NavBar";
import PromoRail from "../../components/platform/PromoRail";
import CreateRoomButton from "../../components/platform/CreateRoomButton";
import JoinRoomForm from "../../components/platform/JoinRoomForm";
import GameCard from "../../components/platform/GameCard";
import AuthModal from "../../components/platform/AuthModal";
import { useConfig } from "../../hooks/useConfig";
import { useAuthStore } from "../../stores/authStore";

export default function HomePage() {
  const { config } = useConfig();
  const navigate = useNavigate();
  const isSignedIn = useAuthStore((s) => s.isSignedIn);
  const [authOpen, setAuthOpen] = useState(false);

  function handlePlay(gameId?: string) {
    if (!isSignedIn) {
      setAuthOpen(true);
      return;
    }
    void gameId;
    navigate("/room/setup");
  }

  return (
    <motion.main
      className="min-h-screen pt-[64px]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.22 }}
    >
      <NavBar
        floating
        onSignIn={() => setAuthOpen(true)}
        onPlay={() => handlePlay()}
      />

      {/* Hero promo rail */}
      <PromoRail games={config.games} onPlay={handlePlay} />

      {/* Action band */}
      <section
        className={[
          "grid grid-cols-1 lg:[grid-template-columns:minmax(0,1fr)_minmax(360px,440px)] items-start gap-[24px] lg:gap-[34px]",
          "px-[20px] lg:px-[48px] pt-[24px] lg:pt-[30px] pb-[32px] lg:pb-[46px]",
          "[background:linear-gradient(180deg,#0c0f14,rgba(12,15,20,.96))]",
        ].join(" ")}
      >
        {/* Start a Jam + Join room */}
        <div className="grid grid-cols-1 sm:[grid-template-columns:minmax(220px,320px)_minmax(310px,460px)] items-stretch gap-[12px] lg:gap-[14px]">
          <CreateRoomButton onClick={() => handlePlay()} />
          <JoinRoomForm />
        </div>

        {/* Pair device — hidden on mobile */}
        <div className="hidden lg:block relative pl-[28px] before:absolute before:left-0 before:top-[8px] before:bottom-[8px] before:w-[1px] before:bg-white/[.14]">
          <aside
            className={[
              "grid [grid-template-columns:46px_1fr] items-center gap-[12px] p-[12px] min-h-[92px]",
              "rounded-[8px] border border-white/[.12] bg-[rgba(17,24,33,.92)] [box-shadow:var(--shadow)]",
            ].join(" ")}
          >
            <div className="w-[46px] h-[46px] grid place-items-center rounded-[8px] bg-[var(--panel-2)] text-[var(--muted)]">
              <svg className="w-[20px] h-[20px] fill-none stroke-current [stroke-width:2]" viewBox="0 0 24 24" aria-hidden="true">
                <rect x="5" y="2" width="14" height="20" rx="2" />
                <circle cx="12" cy="17" r="1" fill="currentColor" />
              </svg>
            </div>
            <div>
              <span className="block text-[var(--green)] text-[11px] font-[950] tracking-[.08em] uppercase mb-[4px]">
                Pair phone and screen
              </span>
              <strong className="block text-[var(--ink)] text-[16px]">
                Enter the desktop pair code
              </strong>
              <span className="block text-[var(--muted)] text-[13px]">
                Sync your phone to control this screen.
              </span>
            </div>
          </aside>
        </div>
      </section>

      {/* Game Library */}
      <section className="px-[20px] lg:px-[48px] pt-[28px] lg:pt-[34px] pb-[48px] lg:pb-[60px]">
        <div className="flex items-end justify-between gap-[20px] mb-[18px]">
          <div>
            <h2 className="m-0 text-[28px] font-[800] text-[var(--ink)]">
              Game Library
            </h2>
            <p className="text-[var(--muted)] text-[14px] mt-[6px] mb-0">
              Browse by mood, group size, and party style.
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 lg:[grid-template-columns:repeat(4,minmax(0,1fr))] gap-[12px] lg:gap-[16px]">
          {config.games.map((game) => (
            <GameCard
              key={game.id}
              game={game}
              onPlay={handlePlay}
            />
          ))}
        </div>
      </section>

      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
    </motion.main>
  );
}
