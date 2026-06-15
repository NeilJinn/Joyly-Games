import AvatarStack from "../../player/AvatarStack";
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
      <AvatarStack
        avatar={player.avatar}
        size="normal"
        ringColor={player.online === false ? "#8f99a6" : undefined}
      />
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
