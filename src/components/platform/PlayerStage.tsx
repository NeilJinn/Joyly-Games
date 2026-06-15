import PlayerBubble from "./PlayerBubble";
import type { Player } from "../../types/room";

interface PlayerStageProps {
  players: Player[];
  minPlayers: number;
  maxPlayers: number;
}

export default function PlayerStage({ players, minPlayers, maxPlayers }: PlayerStageProps) {
  return (
    <section className="stage-floor">
      <div className="stage-light one" aria-hidden="true" />
      <div className="stage-light two" aria-hidden="true" />
      <div
        className="flex flex-wrap items-center justify-center gap-[18px] w-[min(820px,92%)] min-h-[360px] mx-auto relative z-[2]"
      >
        {players.length > 0 ? (
          players.map((player) => (
            <PlayerBubble key={player.id} player={player} />
          ))
        ) : (
          <div className="flex flex-col items-center gap-[8px] text-center text-[var(--muted)]">
            <strong className="text-[var(--ink)] text-[18px]">Scan to join</strong>
            <span className="text-[14px]">
              {minPlayers}–{maxPlayers} players
            </span>
          </div>
        )}
      </div>
    </section>
  );
}
