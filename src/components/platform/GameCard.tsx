import Tag from "../ui/Tag";
import Button from "../ui/Button";
import Icon from "../ui/Icon";
import type { GameConfig } from "../../types/config";

interface GameCardProps {
  game: GameConfig & { genre?: string; description?: string; mood?: string; players?: string };
  selected?: boolean;
  onPlay: (gameId: string) => void;
}

export default function GameCard({ game, selected = false, onPlay }: GameCardProps) {
  return (
    <article
      className={[
        "overflow-hidden rounded-[8px] border border-white/[.12] bg-[rgba(17,24,33,.92)]",
        selected ? "border-[rgba(120,212,94,.7)] [box-shadow:0_0_0_2px_rgba(120,212,94,.18),var(--shadow)]" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className={`game-art game-art-${game.id}`}>
        <Tag>{game.genre ?? ""}</Tag>
      </div>
      <div className="p-[14px] grid gap-[12px]">
        <div>
          <h3 className="text-[18px] font-[800] text-[var(--ink)] m-0">{game.name}</h3>
          <p className="text-[var(--muted)] text-[13px] mt-[6px] mb-0 leading-[1.4]">
            {game.description ?? ""}
          </p>
        </div>
        <div className="flex gap-[8px] flex-wrap text-[var(--muted)] text-[12px]">
          <span>{game.players ?? `${game.minPlayers}–${game.maxPlayers} players`}</span>
          {game.mood && <span>{game.mood}</span>}
          <span>{game.playable ? "Playable" : "Coming soon"}</span>
        </div>
        <Button
          variant="primary"
          disabled={!game.playable}
          onClick={() => onPlay(game.id)}
          className="w-full"
        >
          {game.playable ? (
            <>
              <Icon name="play" />
              <span>Play</span>
            </>
          ) : (
            <>
              <Icon name="star" />
              <span>Coming soon</span>
            </>
          )}
        </Button>
      </div>
    </article>
  );
}
