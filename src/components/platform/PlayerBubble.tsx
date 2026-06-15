import type { Player } from "../../types/room";

interface PlayerBubbleProps {
  player: Player;
}

function getInitials(nickname: string): string {
  return nickname.slice(0, 2).toUpperCase();
}

export default function PlayerBubble({ player }: PlayerBubbleProps) {
  const state = player.online === false ? "disconnected" : player.ready ? "ready" : "pending";
  const ringColor =
    state === "disconnected" ? "#8f99a6" : state === "ready" ? "#78d45e" : "#f4b04a";
  const statusText =
    state === "disconnected"
      ? "Disconnected"
      : state === "ready"
      ? "Ready"
      : "Getting ready";

  return (
    <article
      className={[
        "w-[168px] min-h-[172px] grid place-items-center gap-[8px] p-[18px]",
        "rounded-[10px] border bg-[rgba(17,24,33,.9)] text-center text-[13px]",
        state === "ready"
          ? "border-[rgba(120,212,94,.4)]"
          : state === "disconnected"
          ? "border-white/[.12] opacity-[.6]"
          : "border-white/[.12]",
      ].join(" ")}
    >
      {/* Avatar placeholder with colored ring */}
      <div
        className="w-[64px] h-[64px] rounded-full flex items-center justify-center text-[20px] font-[800] text-white bg-[rgba(17,24,33,.9)]"
        style={{
          boxShadow: `0 0 0 3px ${ringColor}, 0 0 12px ${ringColor}66`,
        }}
      >
        {getInitials(player.nickname)}
      </div>
      <strong className="text-[var(--ink)] text-[14px] font-[800] leading-[1.2]">
        {player.nickname}
      </strong>
      <span
        className="text-[12px] font-[600]"
        style={{ color: ringColor }}
      >
        {statusText}
      </span>
    </article>
  );
}
