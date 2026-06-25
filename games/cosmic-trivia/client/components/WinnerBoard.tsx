import AvatarStack from "../../player/AvatarStack";
import type { Player } from "../../../types/room";

interface WinnerBoardProps {
  players: Player[];
  scores: Record<string, number>;
  onPlayAgain?: () => void;
}

export default function WinnerBoard({ players, scores, onPlayAgain }: WinnerBoardProps) {
  const ranked = [...players]
    .filter((p) => scores[p.id] !== undefined)
    .sort((a, b) => (scores[b.id] ?? 0) - (scores[a.id] ?? 0));

  return (
    <div className="flex flex-col gap-[8px] w-full max-w-[560px] mx-auto">
      <h2 className="text-[var(--ink)] text-[28px] font-[800] text-center mb-[8px]">
        Final Results
      </h2>
      {ranked.map((player, i) => (
        <div
          key={player.id}
          className={[
            "flex items-center gap-[14px] px-[20px] py-[14px] rounded-[10px] border",
            i === 0
              ? "border-[var(--sun)] bg-[rgba(244,176,74,.12)]"
              : "border-white/[.08] bg-[rgba(17,24,33,.6)]",
          ].join(" ")}
        >
          <span
            className={[
              "w-[36px] h-[36px] rounded-full flex items-center justify-center font-[800] text-[15px] flex-none",
              i === 0 ? "bg-[var(--sun)] text-black" : "bg-white/[.08] text-[var(--muted)]",
            ].join(" ")}
          >
            {i + 1}
          </span>
          <AvatarStack avatar={player.avatar} size="normal" />
          <span className="flex-1 text-[var(--ink)] text-[18px] font-[700]">
            {player.nickname}
          </span>
          <span className={[
            "text-[20px] font-[800] tabular-nums",
            i === 0 ? "text-[var(--sun)]" : "text-[var(--muted)]",
          ].join(" ")}>
            {scores[player.id] ?? 0}
          </span>
        </div>
      ))}
      {onPlayAgain && (
        <button
          type="button"
          onClick={onPlayAgain}
          className="mt-[16px] mx-auto px-[28px] h-[44px] rounded-[8px] border border-white/[.2] bg-transparent text-[var(--ink)] font-[700] hover:border-white/[.4] transition-colors"
        >
          Play again
        </button>
      )}
    </div>
  );
}
