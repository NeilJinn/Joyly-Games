import { useState } from "react";
import type { Room, Player } from "../../../types/room";
import type { CosmicTriviaState } from "../../../types/cosmic-trivia";
import AnswerGrid from "../../../components/games/cosmic-trivia/AnswerGrid";
import CountdownBar from "../../../components/games/cosmic-trivia/CountdownBar";
import ScoreRow from "../../../components/games/cosmic-trivia/ScoreRow";
import WinnerBoard from "../../../components/games/cosmic-trivia/WinnerBoard";
import { useCosmicTriviaDirector } from "../../../hooks/useCosmicTriviaDirector";

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

function DevPanel({ code, room }: { code: string; room: Room }) {
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const trivia = room.gameState as CosmicTriviaState | null;

  async function call(path: string, body: Record<string, unknown> = {}) {
    if (busy) return;
    setBusy(true);
    try {
      await fetch(`/api/rooms/${code}/trivia/${path}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
    } finally {
      setBusy(false);
    }
  }

  const btnBase = [
    "w-full text-left px-[10px] py-[6px] rounded-[6px] text-[12px] font-[600]",
    "bg-white/[.07] hover:bg-white/[.13] text-[var(--ink)] border border-white/[.1]",
    "transition-colors disabled:opacity-40 cursor-pointer",
  ].join(" ");

  return (
    <div className="fixed bottom-[16px] left-[16px] z-50 select-none">
      {open && (
        <div className="mb-[8px] w-[210px] rounded-[10px] border border-white/[.12] bg-[rgba(14,22,35,.92)] backdrop-blur-[12px] p-[10px] grid gap-[5px]">
          <p className="text-[var(--muted)] text-[10px] font-[700] uppercase tracking-[1.5px] m-0 mb-[2px]">
            Dev Tools
          </p>
          <button className={btnBase} disabled={busy} onClick={() => call("next")}>
            → Next phase
          </button>
          <button className={btnBase} disabled={busy} onClick={() => call("tester/timer", { seconds: 3 })}>
            ⏩ 3s left
          </button>
          <button className={btnBase} disabled={busy} onClick={() => call("tester/complete")}>
            ✓ Auto-complete question
          </button>
          <button className={btnBase} disabled={busy} onClick={() => call("tester/selection", { playerId: null })}>
            ✓ Lock all preferences
          </button>
          {trivia && room.players.length > 0 && (
            <>
              <p className="text-[var(--muted)] text-[10px] font-[700] uppercase tracking-[1.5px] m-0 mt-[4px] mb-[2px]">
                +100 pts
              </p>
              {room.players.map((p) => (
                <button
                  key={p.id}
                  className={btnBase}
                  disabled={busy}
                  onClick={() => call("tester/score", { playerId: p.id, points: 100 })}
                >
                  +100 → {p.nickname}
                </button>
              ))}
            </>
          )}
        </div>
      )}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-[36px] h-[36px] rounded-full border border-white/[.15] bg-[rgba(14,22,35,.82)] backdrop-blur-[8px] text-[var(--muted)] hover:text-[var(--ink)] hover:border-white/[.3] transition-colors text-[16px] flex items-center justify-center cursor-pointer"
        title="Dev tools"
      >
        {open ? "✕" : "⚙"}
      </button>
    </div>
  );
}

export default function CosmicTriviaHost({ room, code }: CosmicTriviaHostProps) {
  const trivia = room.gameState as CosmicTriviaState | null;
  const [settingUp, setSettingUp] = useState(false);
  const [restartingGame, setRestartingGame] = useState(false);
  useCosmicTriviaDirector(room, code);

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
      <div className="flex flex-col items-center justify-center gap-[24px] p-[32px] h-full">
        <WinnerBoard
          players={room.players}
          scores={trivia.scores}
          onPlayAgain={handleRestart}
        />
        <DevPanel code={code} room={room} />
      </div>
    );
  }

  if (phase === "game-setup") {
    return (
      <div className="flex flex-col items-center justify-center gap-[24px] p-[32px] h-full">
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
        <DevPanel code={code} room={room} />
      </div>
    );
  }

  if (phase === "preferences") {
    return (
      <div className="flex items-center gap-[32px] p-[32px] h-full">
        <div className="flex-1 flex items-center">
          <div className="max-w-[560px] w-full grid gap-[16px]">
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
        </div>
        <Sidebar room={room} trivia={trivia} />
        <DevPanel code={code} room={room} />
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
      <div className="flex items-center gap-[32px] p-[32px] h-full">
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
        <DevPanel code={code} room={room} />
      </div>
    );
  }

  // answering / answer-lock / reveal / scoring / between-questions
  const isRevealPhase = phase === "reveal" || phase === "scoring" || phase === "between-questions";

  return (
    <div className="flex items-start gap-[24px] p-[32px] h-full">
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
      <DevPanel code={code} room={room} />
    </div>
  );
}
