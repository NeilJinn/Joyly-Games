import { AnimatePresence, motion } from "framer-motion";
import Tag from "../ui/Tag";
import Button from "../ui/Button";
import Icon from "../ui/Icon";
import type { GameConfig } from "../../types/config";

interface GamePickerModalProps {
  open: boolean;
  games: GameConfig[];
  selectedGameId: string | null;
  onSelect: (gameId: string) => void;
  onClose: () => void;
}

export default function GamePickerModal({
  open,
  games,
  selectedGameId,
  onSelect,
  onClose,
}: GamePickerModalProps) {
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
              "relative w-[min(1120px,94vw)] max-h-[min(840px,90vh)] overflow-y-auto",
              "rounded-[12px] border border-white/[.1] bg-[rgba(17,24,33,.98)] p-[28px]",
              "[box-shadow:var(--shadow)]",
            ].join(" ")}
            initial={{ opacity: 0, y: -12, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ duration: 0.18 }}
          >
            {/* Close button */}
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

            <div className="mb-[24px]">
              <h2 className="text-[22px] font-[800] text-[var(--ink)] m-0 mb-[4px]">
                Choose Game
              </h2>
              <p className="text-[var(--muted)] text-[14px] m-0">
                Pick one for this room.
              </p>
            </div>

            <div className="grid [grid-template-columns:repeat(2,1fr)] gap-[16px]">
              {games.map((game) => {
                const playable = game.status === "playable";
                const isSelected = game.id === selectedGameId;
                return (
                  <article
                    key={game.id}
                    className={[
                      "overflow-hidden rounded-[8px] border bg-[rgba(17,24,33,.92)]",
                      isSelected
                        ? "border-[rgba(120,212,94,.7)] [box-shadow:0_0_0_2px_rgba(120,212,94,.18),var(--shadow)]"
                        : "border-white/[.12]",
                    ].join(" ")}
                  >
                    <div className={`game-art game-art-${game.id}`}>
                      <Tag>{game.genre}</Tag>
                    </div>
                    <div className="p-[14px] grid gap-[12px]">
                      <div>
                        <h3 className="text-[18px] font-[800] text-[var(--ink)] m-0">
                          {game.title}
                        </h3>
                        <p className="text-[var(--muted)] text-[13px] mt-[6px] mb-0 leading-[1.4]">
                          {game.description}
                        </p>
                      </div>
                      <div className="flex gap-[8px] flex-wrap text-[var(--muted)] text-[12px]">
                        <span>{game.players}</span>
                        <span>{game.mood}</span>
                        <span>{playable ? "Playable" : "Coming soon"}</span>
                      </div>
                      <Button
                        variant={isSelected ? "primary" : "secondary"}
                        disabled={!playable}
                        onClick={() => {
                          if (playable) onSelect(game.id);
                        }}
                        className="w-full"
                      >
                        {isSelected ? (
                          <>
                            <Icon name="check" />
                            <span>Selected</span>
                          </>
                        ) : playable ? (
                          <>
                            <Icon name="check" />
                            <span>Select</span>
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
              })}
            </div>
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
