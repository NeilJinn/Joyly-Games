import { useState, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Tag from "../ui/Tag";
import Button from "../ui/Button";
import Icon from "../ui/Icon";
import type { GameConfig } from "../../types/config";

interface PromoRailProps {
  games: GameConfig[];
  onPlay: (gameId: string) => void;
}

export default function PromoRail({ games, onPlay }: PromoRailProps) {
  const featured = games.slice(0, 4);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (featured.length === 0) return;
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % Math.min(4, featured.length));
    }, 5000);
    return () => clearInterval(id);
  }, [featured.length]);

  function move(step: number) {
    setIndex((i) => (i + step + featured.length) % featured.length);
  }

  const game = featured[index];

  if (!game) return null;

  const playable = game.status === "playable";

  return (
    <section
      className={[
        "relative overflow-hidden min-h-[340px] lg:min-h-[620px] px-[20px] lg:px-[48px] pt-[32px] lg:pt-[44px] pb-[56px] lg:pb-[34px]",
        "[background:linear-gradient(180deg,rgba(9,18,28,.04),#0c0f14),var(--hero-paper)]",
        "bg-cover bg-center",
      ].join(" ")}
      aria-label="Featured games"
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={game.id}
          className="grid items-end gap-[36px] grid-cols-1 lg:[grid-template-columns:minmax(0,1fr)_430px]"
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -24 }}
          transition={{ duration: 0.42, ease: "easeOut" }}
        >
          {/* Left: title + copy */}
          <div>
            <Tag>
              {game.players} · {game.genre}
            </Tag>
            <h1
              className="max-w-[860px] my-[18px] mb-[28px] [font-size:clamp(32px,7vw,86px)] leading-[.98] mt-[18px]"
            >
              {game.title}
            </h1>
            <p className="max-w-[640px] -mt-[12px] mb-[24px] text-[#e5f4f6] text-[20px] leading-[1.42]">
              {game.description}
            </p>
            <Button
              variant="primary"
              className="min-w-[180px]"
              onClick={() => onPlay(game.id)}
              disabled={!playable}
            >
              <Icon name="play" />
              <span>Play now</span>
            </Button>
          </div>

          {/* Right: featured game card — hidden on mobile */}
          <div className="hidden lg:grid gap-[18px] p-[18px] border border-white/[.1] rounded-[8px] bg-[rgba(17,24,33,.9)] [box-shadow:var(--shadow)]">
            <div
              className={`h-[220px] rounded-[6px] game-art game-art-${game.id}`}
            />
            <div>
              <Tag>{index === 0 ? "Featured" : game.mood}</Tag>
              <h2 className="mt-[10px] mb-[6px] text-[30px]">{game.title}</h2>
              <p className="text-[var(--muted)] text-[14px]">
                {game.mood} · {playable ? "Playable now" : "Coming soon"}
              </p>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Promo controls */}
      {featured.length > 1 && (
        <div className="absolute left-[20px] right-[20px] lg:left-[48px] lg:right-[48px] bottom-[28px] z-[4] flex items-center justify-center gap-[14px]">
          <Button
            variant="icon"
            className="bg-[rgba(17,24,33,.82)]"
            onClick={() => move(-1)}
            aria-label="Previous slide"
          >
            <Icon name="left" />
          </Button>

          <div className="inline-flex items-center gap-[8px] px-[10px] py-[8px] rounded-full bg-[rgba(17,24,33,.72)] border border-white/[.1]">
            {featured.map((g, i) => (
              <button
                key={g.id}
                className={[
                  "h-[8px] rounded-full border-0 p-0 transition-[width,background] duration-[200ms] cursor-pointer",
                  i === index
                    ? "w-[34px] bg-[var(--green)]"
                    : "w-[10px] bg-[rgba(255,248,232,.46)]",
                ].join(" ")}
                onClick={() => setIndex(i)}
                aria-label={`Show ${g.title}`}
              />
            ))}
          </div>

          <Button
            variant="icon"
            className="bg-[rgba(17,24,33,.82)]"
            onClick={() => move(1)}
            aria-label="Next slide"
          >
            <Icon name="right" />
          </Button>
        </div>
      )}
    </section>
  );
}
