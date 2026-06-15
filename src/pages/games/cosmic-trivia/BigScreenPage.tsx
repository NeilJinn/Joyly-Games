import { useState } from "react";
import type { Room, Player } from "../../../types/room";
import type { CosmicTriviaState } from "../../../types/cosmic-trivia";
import AnswerGrid from "../../../components/games/cosmic-trivia/AnswerGrid";
import CountdownBar from "../../../components/games/cosmic-trivia/CountdownBar";
import ScoreRow from "../../../components/games/cosmic-trivia/ScoreRow";
import WinnerBoard from "../../../components/games/cosmic-trivia/WinnerBoard";

interface CosmicTriviaHostProps {
  room: Room;
  code: string;
}

function Sidebar({ room, trivia }: { room: Room; trivia: CosmicTriviaState }) {
  const isReveal = trivia.phase === "reveal" || trivia.phase === "scoring";
  const players = [...room.players].sort(
    (a, b) => (trivia.scores[b.id] ?? 0) - (trivia.scores[a.id] ?? 0)
  );

  return (
    <aside className="w-[260px] flex-none flex flex-col gap-[8px] overflow-y-auto">
      <p className="text-[var(--muted)] text-[12px] font-[700] uppercase tracking-[2px] m-0 px-[4px]">
        Players
      </p>
      {players.map((player: Player, i) => (
        <ScoreRow
          key={player.id}
          player={player}
          score={trivia.scores[player.id]}
          rank={i + 1}
          hasAnswered={trivia.answeredPlayerIds.includes(player.id)}
          showScore={trivia.scoreboardVisible}
          isRevealPhase={isReveal}
        />
      ))}
    </aside>
  );
}

export default function CosmicTriviaHost({ room, code }: CosmicTriviaHostProps) {
  const trivia = room.gameState as CosmicTriviaState | null;
  const [settingUp, setSettingUp] = useState(false);
  const [restartingGame, setRestartingGame] = useState(false);

  if (!trivia) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-[var(--muted)]">Loading game…</p>
      </div>
    );
  }

  const phase = trivia.phase;
  const q = trivia.currentQuestion;

  async function handleSetup(questionCount: number) {
    if (settingUp) return;
    setSettingUp(true);
    try {
      await fetch(`/api/rooms/${code}/trivia/setup`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ questionCount }),
      });
    } finally {
      setSettingUp(false);
    }
  }

  async function handleRestart() {
    if (restartingGame) return;
    setRestartingGame(true);
    try {
      await fetch(`/api/rooms/${code}/trivia/restart`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      });
    } finally {
      setRestartingGame(false);
    }
  }

  if (phase === "post-game") {
    return (
      <div className="flex flex-col items-center justify-center gap-[24px] p-[32px] min-h-full">
        <WinnerBoard
          players={room.players}
          scores={trivia.scores}
          onPlayAgain={handleRestart}
        />
      </div>
    );
  }

  if (phase === "game-setup") {
    return (
      <div className="flex flex-col items-center justify-center gap-[24px] p-[32px] min-h-full">
        <div className="w-full max-w-[560px] grid gap-[20px]">
          <div>
            <h2 className="text-[var(--ink)] text-[28px] font-[800] m-0 mb-[8px]">
              How many questions?
            </h2>
            <p className="text-[var(--muted)] text-[15px] m-0">
              {room.players.length} players · choose the round length
            </p>
          </div>
          <div className="grid grid-cols-4 gap-[12px]">
            {(trivia.questionCountOptions ?? [5, 8, 10, 12]).map((n) => (
              <button
                key={n}
                type="button"
                disabled={settingUp}
                onClick={() => handleSetup(n)}
                className="h-[72px] rounded-[10px] border border-white/[.15] bg-[rgba(17,24,33,.8)] text-[var(--ink)] text-[28px] font-[800] hover:border-[rgba(120,212,94,.5)] hover:bg-[rgba(120,212,94,.08)] transition-colors disabled:opacity-50"
              >
                {n}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (phase === "preferences") {
    return (
      <div className="flex items-center gap-[32px] p-[32px] min-h-full">
        <div className="flex-1 max-w-[560px] grid gap-[16px]">
          <h2 className="text-[var(--ink)] text-[28px] font-[800] m-0">
            Players are choosing their categories
          </h2>
          <p className="text-[var(--muted)] text-[15px] m-0">
            {trivia.preferencePlayerIds.length} / {trivia.expectedPreferenceCount} locked in
          </p>
          {trivia.phaseEndsAt && (
            <CountdownBar endsAt={trivia.phaseEndsAt} totalSecs={60} />
          )}
        </div>
        <Sidebar room={room} trivia={trivia} />
      </div>
    );
  }

  if (
    phase === "round-prep" ||
    phase === "question-intro" ||
    phase === "question-read" ||
    phase === "final-hype" ||
    phase === "finale"
  ) {
    const label =
      phase === "round-prep" ? "Building your round…" :
      phase === "question-intro" ? "Next question coming up" :
      phase === "question-read" ? "Listen to the question" :
      phase === "final-hype" ? (trivia.finalHype?.current?.text ?? "Final results coming up…") :
      "And the results are…";

    return (
      <div className="flex items-center gap-[32px] p-[32px] min-h-full">
        <div className="flex-1 flex items-center justify-center">
          <div className="max-w-[500px] text-center grid gap-[12px]">
            {(phase === "question-intro" || phase === "question-read") && (
              <p className="text-[var(--muted)] text-[14px] m-0">
                Question {trivia.questionIndex + 1} / {trivia.questionCount}
              </p>
            )}
            <h2 className="text-[var(--ink)] text-[32px] font-[800] m-0">{label}</h2>
          </div>
        </div>
        <Sidebar room={room} trivia={trivia} />
      </div>
    );
  }

  // answering / answer-lock / reveal / scoring / between-questions
  const isRevealPhase = phase === "reveal" || phase === "scoring" || phase === "between-questions";

  return (
    <div className="flex items-start gap-[24px] p-[32px] min-h-full">
      <div className="flex-1 grid gap-[16px]">
        <div className="flex items-center justify-between">
          <p className="text-[var(--muted)] text-[13px] m-0">
            Question {trivia.questionIndex + 1} / {trivia.questionCount}
          </p>
          <span className="text-[var(--muted)] text-[13px]">
            {trivia.answeredPlayerIds.length} / {trivia.expectedAnswerCount} answered
          </span>
        </div>

        {q && (
          <>
            <h2 className="text-[var(--ink)] text-[24px] font-[800] m-0 leading-snug">
              {q.question}
            </h2>
            <AnswerGrid
              answers={q.answers}
              correctId={isRevealPhase ? q.correctAnswer : null}
              variant="big-screen"
            />
            {isRevealPhase && q.fact && (
              <p className="text-[var(--muted)] text-[14px] m-0 border-l-[3px] border-[rgba(120,212,94,.4)] pl-[12px]">
                {q.fact}
              </p>
            )}
          </>
        )}

        {phase === "answering" && (
          <CountdownBar endsAt={trivia.phaseEndsAt} totalSecs={20} />
        )}
        {phase === "answer-lock" && (
          <p className="text-[var(--sun)] text-[15px] font-[700] m-0">
            Answers are closed — revealing now…
          </p>
        )}
      </div>
      <Sidebar room={room} trivia={trivia} />
    </div>
  );
}
