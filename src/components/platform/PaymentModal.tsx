import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Icon from "../ui/Icon";
import Button from "../ui/Button";
import { useAuthStore } from "../../stores/authStore";
import { useRoomStore } from "../../stores/roomStore";
import type { GameConfig } from "../../types/config";
import type { Room } from "../../types/room";

const PASSES = [
  { minutes: 60, label: "1 hr", price: "29 kr" },
  { minutes: 120, label: "2 hrs", price: "39 kr" },
  { minutes: 240, label: "4 hrs", price: "59 kr" },
] as const;

const CREDIT_PACKS = [
  { credits: 20, price: "29 kr" },
  { credits: 50, price: "59 kr" },
  { credits: 120, price: "99 kr" },
] as const;

type PaymentMode = "time" | "useCredits" | "buyCredits";

interface PaymentModalProps {
  open: boolean;
  game: GameConfig | null;
  onClose: () => void;
  onRoomCreated: (room: Room) => void;
}

export default function PaymentModal({
  open,
  game,
  onClose,
  onRoomCreated,
}: PaymentModalProps) {
  const account = useAuthStore((s) => s.account);
  const entitlement = useAuthStore((s) => s.entitlement);
  const setEntitlement = useAuthStore((s) => s.setEntitlement);
  const setRoom = useRoomStore((s) => s.setRoom);

  const [mode, setMode] = useState<PaymentMode>("time");
  const [selectedMinutes, setSelectedMinutes] = useState(60);
  const [selectedCredits, setSelectedCredits] = useState(20);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  if (!game || !account) return null;

  const availablePoints = entitlement.points;
  const canUsePoints = availablePoints >= (game.credits ?? Infinity);

  const pass = PASSES.find((p) => p.minutes === selectedMinutes) ?? PASSES[0];
  const creditPack =
    CREDIT_PACKS.find((p) => p.credits === selectedCredits) ?? CREDIT_PACKS[0];

  const ctaLabel =
    mode === "time"
      ? `Pay ${pass.price} · Create room`
      : mode === "useCredits"
      ? "Use points · Create room"
      : `Buy ${creditPack.credits} points · Create room`;

  const ctaDisabled = (mode === "useCredits" && !canUsePoints) || creating;

  async function handleCreate() {
    if (!account || !game) return;
    setCreating(true);
    setError("");
    try {
      const body: Record<string, unknown> = {
        hostName: account.displayName,
        email: account.email,
        gameId: game.id,
        paymentMode: mode,
      };
      if (mode === "time") body.minutes = selectedMinutes;
      if (mode === "buyCredits") body.credits = selectedCredits;

      const res = await fetch("/api/rooms", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error ?? "Failed to create room");
      }
      const data = (await res.json()) as { room: Room; entitlement?: typeof entitlement };
      setRoom(data.room);
      if (data.entitlement) setEntitlement(data.entitlement);
      onRoomCreated(data.room);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setCreating(false);
    }
  }

  const tabClass = (active: boolean) =>
    [
      "flex items-center justify-center gap-[8px] min-h-[52px] rounded-[8px]",
      "border font-[800] text-[14px] cursor-pointer transition-colors",
      active
        ? "border-[rgba(120,212,94,.7)] text-[var(--ink)] bg-[rgba(23,29,37,.74)]"
        : "border-white/[.12] text-[var(--muted)] bg-[rgba(23,29,37,.74)] hover:text-[var(--ink)]",
    ].join(" ");

  const priceCardClass = (active: boolean) =>
    [
      "flex flex-col items-center gap-[6px] min-h-[90px] p-[14px] rounded-[8px]",
      "border cursor-pointer transition-colors text-[14px]",
      active
        ? "border-[rgba(120,212,94,.7)] text-[var(--ink)] bg-[rgba(23,29,37,.74)]"
        : "border-white/[.12] text-[var(--muted)] bg-[rgba(23,29,37,.74)] hover:text-[var(--ink)]",
    ].join(" ");

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/[.72] backdrop-blur-[4px]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onClick={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
        >
          <motion.section
            className={[
              "relative w-[min(780px,94vw)] max-h-[min(760px,90vh)] overflow-y-auto",
              "rounded-[12px] border border-white/[.1] bg-[rgba(17,24,33,.98)] p-[28px]",
              "[box-shadow:var(--shadow)]",
            ].join(" ")}
            initial={{ opacity: 0, y: -12, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ duration: 0.18 }}
          >
            {/* Close */}
            <button
              className={[
                "absolute top-[14px] right-[14px] w-[36px] h-[36px] grid place-items-center",
                "rounded-[6px] border border-white/[.1] bg-[rgba(17,24,33,.9)]",
                "text-[var(--muted)] cursor-pointer hover:text-[var(--ink)] transition-colors",
              ].join(" ")}
              type="button"
              onClick={onClose}
              aria-label="Close"
            >
              ✕
            </button>

            <h2 className="text-[22px] font-[800] text-[var(--ink)] m-0 mb-[4px]">
              Payment
            </h2>
            <p className="text-[var(--muted)] text-[14px] m-0 mb-[2px]">
              {game.title} · {game.players} players
            </p>

            {/* Summary strip */}
            <div className="grid [grid-template-columns:repeat(3,1fr)] px-[14px] py-[12px] rounded-[8px] bg-[rgba(23,29,37,.74)] border border-white/[.08] my-[14px]">
              {[
                { label: "Game", value: game.title },
                { label: "Points", value: String(availablePoints) },
                { label: "Time left", value: "--" },
              ].map(({ label, value }) => (
                <div key={label} className="flex flex-col gap-[4px]">
                  <span className="text-[var(--muted)] text-[11px] font-[700] tracking-[.06em] uppercase">
                    {label}
                  </span>
                  <strong className="text-[var(--ink)] text-[16px] font-[800]">
                    {value}
                  </strong>
                </div>
              ))}
            </div>

            {/* Tabs */}
            <div className="grid [grid-template-columns:repeat(3,1fr)] gap-[10px] my-[18px]">
              <button className={tabClass(mode === "time")} type="button" onClick={() => setMode("time")}>
                <Icon name="card" />
                Time pass
              </button>
              <button className={tabClass(mode === "useCredits")} type="button" onClick={() => setMode("useCredits")}>
                <Icon name="coins" />
                Use points
              </button>
              <button className={tabClass(mode === "buyCredits")} type="button" onClick={() => setMode("buyCredits")}>
                <Icon name="coins" />
                Buy points
              </button>
            </div>

            {/* Time pass options */}
            {mode === "time" && (
              <div className="grid [grid-template-columns:repeat(3,1fr)] gap-[10px] my-[14px]">
                {PASSES.map((item) => (
                  <button
                    key={item.minutes}
                    className={priceCardClass(item.minutes === selectedMinutes)}
                    type="button"
                    onClick={() => setSelectedMinutes(item.minutes)}
                  >
                    <Icon name="card" />
                    <strong>{item.label}</strong>
                    <span>{item.price}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Use points */}
            {mode === "useCredits" && (
              <div className="grid [grid-template-columns:repeat(3,1fr)] px-[14px] py-[14px] rounded-[8px] bg-[rgba(23,29,37,.74)] border border-white/[.08] my-[14px]">
                {[
                  { label: "Current points", value: String(availablePoints) },
                  { label: "This game costs", value: String(game.credits ?? "?") },
                  {
                    label: "After purchase",
                    value: String(Math.max(0, availablePoints - (game.credits ?? 0))),
                  },
                ].map(({ label, value }) => (
                  <div key={label} className="flex flex-col gap-[4px]">
                    <span className="text-[var(--muted)] text-[11px] font-[700] tracking-[.06em] uppercase">
                      {label}
                    </span>
                    <strong className="text-[var(--ink)] text-[18px] font-[800]">
                      {value}
                    </strong>
                  </div>
                ))}
              </div>
            )}
            {mode === "useCredits" && !canUsePoints && (
              <p className="text-[#f67272] text-[14px] mt-[4px]">
                Not enough points for this game.
              </p>
            )}

            {/* Buy credits */}
            {mode === "buyCredits" && (
              <div className="grid [grid-template-columns:repeat(3,1fr)] gap-[10px] my-[14px]">
                {CREDIT_PACKS.map((item) => (
                  <button
                    key={item.credits}
                    className={priceCardClass(item.credits === selectedCredits)}
                    type="button"
                    onClick={() => setSelectedCredits(item.credits)}
                  >
                    <Icon name="coins" />
                    <strong>{item.credits}</strong>
                    <span>{item.price}</span>
                  </button>
                ))}
              </div>
            )}

            {error && (
              <p className="text-[#f67272] text-[14px] mt-[8px]">{error}</p>
            )}

            <Button
              variant="primary"
              className="w-full mt-[8px]"
              disabled={ctaDisabled}
              onClick={handleCreate}
            >
              <Icon name={mode === "time" ? "card" : "coins"} />
              <span>{creating ? "Creating…" : ctaLabel}</span>
            </Button>
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
