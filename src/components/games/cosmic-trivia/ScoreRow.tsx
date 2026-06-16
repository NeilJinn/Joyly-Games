import { motion, useAnimation } from "framer-motion";
import { useEffect, useRef } from "react";
import AvatarStack from "../../player/AvatarStack";
import type { Player } from "../../../types/room";

interface ScoreRowProps {
  player: Player;
  score: number | undefined;
  rank: number;
  hasAnswered: boolean;
  showScore: boolean;
  isRevealPhase: boolean;
  hitVersion?: number;      // increment to trigger squish on flower landing
  pushedVersion?: number;   // increment to trigger push (neighbor)
  isHighlighted?: boolean;  // true while flower is targeting/resting on this bar
}

export default function ScoreRow({
  player,
  score,
  rank,
  hasAnswered,
  showScore,
  isRevealPhase,
  hitVersion = 0,
  pushedVersion = 0,
  isHighlighted = false,
}: ScoreRowProps) {
  const controls = useAnimation();
  const prevHitRef    = useRef(hitVersion);
  const prevPushedRef = useRef(pushedVersion);
  const everHighlightedRef = useRef(false);

  // Pre-flight: grow when highlighted, shrink when done
  useEffect(() => {
    if (isHighlighted) {
      everHighlightedRef.current = true;
      controls.start({
        scaleX: 1.08,
        scaleY: 1.08,
        transition: { duration: 0.4, ease: "easeOut" },
      });
    } else if (!isHighlighted && everHighlightedRef.current) {
      controls.start({
        scaleX: 1,
        scaleY: 1,
        transition: { duration: 0.45, ease: "easeOut" },
      });
    }
  }, [isHighlighted, controls]);

  // Squish on flower landing (starts from current enlarged scale)
  useEffect(() => {
    if (hitVersion > prevHitRef.current) {
      prevHitRef.current = hitVersion;
      controls.start({
        scaleX: [null, 1.2, 0.88, 1.08],
        scaleY: [null, 1.2, 0.88, 1.08],
        transition: { duration: 0.5, ease: "easeOut" },
      });
    }
  }, [hitVersion, controls]);

  useEffect(() => {
    if (pushedVersion > prevPushedRef.current) {
      prevPushedRef.current = pushedVersion;
      controls.start({
        y: [0, 6, -2, 0],
        transition: { duration: 0.4, ease: "easeOut" },
      });
    }
  }, [pushedVersion, controls]);

  let statusColor = "rgba(255,255,255,.08)";
  if (isHighlighted)      statusColor = "rgba(120,212,94,.22)"; // winner glow
  else if (isRevealPhase) statusColor = "rgba(255,255,255,.12)";
  else if (hasAnswered)   statusColor = "rgba(120,212,94,.25)";

  return (
    <motion.div
      layout
      layoutId={player.id}
      animate={controls}
      data-player-id={player.id}
      className="flex items-center gap-[10px] px-[12px] py-[8px] rounded-[8px] transition-colors"
      style={{ background: statusColor }}
    >
      <span className="text-[var(--muted)] text-[12px] font-[700] w-[18px] text-center tabular-nums">
        {rank}
      </span>
      <AvatarStack
        avatar={player.avatar}
        size="small"
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
    </motion.div>
  );
}
