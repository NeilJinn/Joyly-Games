import { useState, useRef, type FormEvent } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import NavBar from "../../components/platform/NavBar";
import PromoRail from "../../components/platform/PromoRail";
import CreateRoomButton from "../../components/platform/CreateRoomButton";
import JoinRoomForm from "../../components/platform/JoinRoomForm";
import GameCard from "../../components/platform/GameCard";
import AuthModal from "../../components/platform/AuthModal";
import { useConfig } from "../../hooks/useConfig";
import { usePairing } from "../../hooks/usePairing";
import { useAuthStore } from "../../stores/authStore";

export default function HomePage() {
  const { config, loading: configLoading } = useConfig();
  const navigate = useNavigate();
  const isSignedIn = useAuthStore((s) => s.isSignedIn);
  const [authOpen, setAuthOpen] = useState(false);
  const pairing = usePairing(configLoading ? null : config.localJoinBase);
  const pairInputRef = useRef<HTMLInputElement>(null);

  function handlePairSubmit(e: FormEvent) {
    e.preventDefault();
    const code = pairInputRef.current?.value.trim();
    if (code) navigate(`/pair/${encodeURIComponent(code.toLowerCase())}`);
  }

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
      className="min-h-screen pt-[52px]"
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

        {/* Pair with screen — mobile only, manual code entry */}
        <form
          onSubmit={handlePairSubmit}
          className="lg:hidden flex items-center gap-[8px] p-[12px] rounded-[8px] border border-white/[.1] bg-[rgba(17,24,33,.6)]"
        >
          <div className="grid gap-[2px] flex-1 min-w-0">
            <span className="block text-[var(--green)] text-[10px] font-[950] tracking-[.08em] uppercase">
              Pair with screen
            </span>
            <input
              ref={pairInputRef}
              type="text"
              placeholder="Enter pair code"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              maxLength={12}
              className={[
                "w-full bg-transparent border-none outline-none",
                "text-[var(--ink)] text-[16px] font-[800] tracking-[3px] placeholder:text-[var(--muted)] placeholder:font-[400] placeholder:tracking-normal placeholder:text-[13px]",
              ].join(" ")}
            />
          </div>
          <button
            type="submit"
            className="flex-none h-[38px] px-[14px] rounded-[6px] bg-[var(--brand,#78d45e)] text-[#0a0f14] text-[13px] font-[700]"
          >
            Pair
          </button>
        </form>

        {/* Pair device — hidden on mobile, hidden when signed in without active pairing */}
        {(!isSignedIn || pairing?.phase === "claimed") && (
          <div className="hidden lg:block relative pl-[28px] before:absolute before:left-0 before:top-[8px] before:bottom-[8px] before:w-[1px] before:bg-white/[.14]">
            {pairing?.phase === "waiting" ? (
              /* QR code — waiting for phone to scan */
              <aside
                className={[
                  "grid [grid-template-columns:auto_1fr] items-center gap-[14px] p-[14px]",
                  "rounded-[8px] border border-white/[.12] bg-[rgba(17,24,33,.92)] [box-shadow:var(--shadow)]",
                ].join(" ")}
              >
                <div className="p-[6px] bg-white rounded-[6px] flex-none">
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(pairing.url)}`}
                    alt="Pair phone QR code"
                    width={80}
                    height={80}
                    className="block"
                  />
                </div>
                <div className="grid gap-[4px]">
                  <span className="block text-[var(--green)] text-[11px] font-[950] tracking-[.08em] uppercase">
                    Pair phone and screen
                  </span>
                  <strong className="block text-[var(--ink)] text-[22px] font-[800] tracking-[4px] leading-[1]">
                    {pairing.code}
                  </strong>
                  <span className="block text-[var(--muted)] text-[12px] leading-snug">
                    Scan here to use your phone as a controller
                  </span>
                </div>
              </aside>
            ) : pairing?.phase === "claimed" ? (
              /* Phone paired — waiting for phone to create a room */
              <aside
                className={[
                  "grid [grid-template-columns:46px_1fr] items-center gap-[12px] p-[14px] min-h-[92px]",
                  "rounded-[8px] border border-[var(--green)]/30 bg-[rgba(17,24,33,.92)] [box-shadow:var(--shadow)]",
                ].join(" ")}
              >
                <div className="w-[46px] h-[46px] grid place-items-center rounded-[8px] bg-[rgba(120,212,94,.12)] text-[var(--green)] flex-none">
                  <svg className="w-[22px] h-[22px] fill-none stroke-current [stroke-width:2]" viewBox="0 0 24 24" aria-hidden="true">
                    <rect x="5" y="2" width="14" height="20" rx="2" />
                    <circle cx="12" cy="17" r="1" fill="currentColor" />
                    <path d="M9 7h6M9 11h4" stroke-linecap="round" />
                  </svg>
                </div>
                <div className="grid gap-[4px]">
                  <span className="block text-[var(--green)] text-[11px] font-[950] tracking-[.08em] uppercase">
                    Phone paired
                  </span>
                  <strong className="block text-[var(--ink)] text-[15px] font-[700] leading-snug">
                    Waiting for your phone to create a room
                  </strong>
                  <span className="block text-[var(--muted)] text-[12px]">
                    Choose a game and pay on your phone — this screen will follow.
                  </span>
                </div>
              </aside>
            ) : (
              /* Loading — config not ready yet */
              <aside
                className={[
                  "grid [grid-template-columns:46px_1fr] items-center gap-[12px] p-[12px] min-h-[92px]",
                  "rounded-[8px] border border-white/[.07] bg-[rgba(17,24,33,.6)]",
                ].join(" ")}
              >
                <div className="w-[46px] h-[46px] grid place-items-center rounded-[8px] bg-[var(--panel-2)] text-[var(--muted)]">
                  <svg className="w-[20px] h-[20px] fill-none stroke-current [stroke-width:2]" viewBox="0 0 24 24" aria-hidden="true">
                    <rect x="5" y="2" width="14" height="20" rx="2" />
                    <circle cx="12" cy="17" r="1" fill="currentColor" />
                  </svg>
                </div>
                <div>
                  <span className="block text-[var(--muted)] text-[11px] font-[700] tracking-[.06em] uppercase mb-[2px]">
                    Pair phone and screen
                  </span>
                  <span className="block text-[var(--muted)] text-[13px]">Loading pair code…</span>
                </div>
              </aside>
            )}
          </div>
        )}
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
