import type { Player } from "../../../types/room";

interface ScoreRowProps {
  player: Player;
  score: number | undefined;
  rank: number;
  hasAnswered: boolean;
  showScore: boolean;
  isRevealPhase: boolean;
}

export default function ScoreRow({
  player,
  score,
  rank,
  hasAnswered,
  showScore,
  isRevealPhase,
}: ScoreRowProps) {
  const initials = player.nickname.slice(0, 2).toUpperCase();

  let statusColor = "rgba(255,255,255,.08)";
  if (isRevealPhase) statusColor = "rgba(255,255,255,.12)";
  else if (hasAnswered) statusColor = "rgba(120,212,94,.25)";

  return (
    <div
      className="flex items-center gap-[10px] px-[12px] py-[8px] rounded-[8px] transition-colors"
      style={{ background: statusColor }}
    >
      <span className="text-[var(--muted)] text-[12px] font-[700] w-[18px] text-center tabular-nums">
        {rank}
      </span>
      <div
        className="w-[30px] h-[30px] rounded-full flex-none flex items-center justify-center text-[11px] font-[800] text-white"
        style={{ background: player.online === false ? "#333c46" : "#1e2d3d" }}
      >
        {initials}
      </div>
      <span className="flex-1 text-[var(--ink)] text-[13px] font-[600] truncate">
        {player.nickname}
      </span>
      {hasAnswered && !isRevealPhase && (
        <span className="text-[#78d45e] text-[11px]">✓</span>
      )}
      {showScore && score !== undefined && (
        <span className="text-[var(--muted)] text-[12px] font-[700] tabular-nums">
          {score}
        </span>
      )}
    </div>
  );
}
