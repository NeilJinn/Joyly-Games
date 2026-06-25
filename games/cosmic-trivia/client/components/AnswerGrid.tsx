import type { CosmicAnswer } from "@types/cosmic-trivia";
import { ANSWER_LETTERS } from "@types/cosmic-trivia";

const LETTER_COLORS = ["#5e82f4", "#f4b04a", "#e05eb4", "#5eb8d4"] as const;

interface AnswerGridProps {
  answers: CosmicAnswer[];
  selectedId?: string | null;
  correctId?: string | null;
  disabled?: boolean;
  onSelect?: (answerId: string) => void;
  variant?: "phone" | "big-screen";
}

export default function AnswerGrid({
  answers,
  selectedId,
  correctId,
  disabled,
  onSelect,
  variant = "phone",
}: AnswerGridProps) {
  const isBig = variant === "big-screen";

  return (
    <div className={["grid grid-cols-2", isBig ? "gap-[12px]" : "gap-[10px]"].join(" ")}>
      {answers.map((answer, i) => {
        const letter = ANSWER_LETTERS[i] ?? String.fromCharCode(65 + i);
        const color = LETTER_COLORS[i] ?? "#c8d4de";
        const isCorrect = correctId && answer.id === correctId;
        const isSelected = selectedId === answer.id;
        const isWrong = correctId && isSelected && !isCorrect;

        let borderColor = "rgba(255,255,255,.1)";
        let bgColor = "rgba(17,24,33,.8)";
        if (isCorrect) { borderColor = "#78d45e"; bgColor = "rgba(120,212,94,.15)"; }
        else if (isWrong) { borderColor = "rgba(246,114,114,.5)"; bgColor = "rgba(246,114,114,.08)"; }
        else if (isSelected) { borderColor = "rgba(120,212,94,.6)"; bgColor = "rgba(120,212,94,.08)"; }

        return (
          <button
            key={answer.id}
            type="button"
            disabled={disabled || !onSelect}
            onClick={() => onSelect?.(answer.id)}
            className={[
              "flex items-start gap-[10px] rounded-[10px] border text-left transition-colors",
              isBig ? "p-[16px] min-h-[80px]" : "p-[12px] min-h-[64px]",
              "disabled:cursor-default",
            ].join(" ")}
            style={{ borderColor, backgroundColor: bgColor }}
          >
            <span
              className={[
                "flex-none rounded-full font-[800] flex items-center justify-center",
                isBig ? "w-[32px] h-[32px] text-[14px]" : "w-[26px] h-[26px] text-[12px]",
              ].join(" ")}
              style={{ background: color, color: "#fff" }}
            >
              {letter}
            </span>
            <span className={[
              "text-[var(--ink)] font-[600] leading-snug",
              isBig ? "text-[16px]" : "text-[14px]",
            ].join(" ")}>
              {answer.text}
            </span>
          </button>
        );
      })}
    </div>
  );
}
