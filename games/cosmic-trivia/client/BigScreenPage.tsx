import React, { useCallback, useEffect, useRef, useState } from "react";
import type { Room, Player } from "@types/room";
import type { CosmicTriviaState } from "@types/cosmic-trivia";
import AnswerGrid from "./components/AnswerGrid";
import CountdownBar from "./components/CountdownBar";
import ScoreRow from "./components/ScoreRow";
import WinnerBoard from "./components/WinnerBoard";
import { useCosmicTriviaDirector } from "./hooks/useCosmicTriviaDirector";
import ScoreBurstOverlay from "./components/ScoreBurstOverlay";
import ConfettiRain from "./components/ConfettiRain";
import ShaderLinesTransition from "./components/ShaderLinesTransition";
import { getQuestionTransitionKey } from "./lib/shader-lines-transition";
import { shouldRenderScoreBurstOverlay } from "./lib/trivia-presentation";

interface CosmicTriviaHostProps {
  room: Room;
  code: string;
}

// ── Category display helpers ─────────────────────────────────

const CATEGORY_EMOJI: Record<string, string> = {
  space: "🚀", science: "🔬", general: "🌍", history: "📜",
  geography: "🗺️", nature: "🌿", movies: "🎬", sports: "⚽",
  planets: "🪐", ai: "🤖", light: "💡", inventions: "⚙️",
  cards: "🃏", language: "💬", oceans: "🌊", animals: "🐾",
  books: "📚", games: "🎮", earth: "🌎", food: "🍕",
  music: "🎵", plants: "🌱", weather: "⛅", art: "🎨",
  tech: "💻", film: "🎬", pop: "🎤", ancient: "🏛️",
};

const CATEGORY_PALETTE = [
  { border: "rgba(99,102,241,.55)",  bg: "rgba(99,102,241,.1)",  text: "#818cf8" },
  { border: "rgba(245,158,11,.5)",   bg: "rgba(245,158,11,.08)", text: "#fbbf24" },
  { border: "rgba(16,185,129,.5)",   bg: "rgba(16,185,129,.08)", text: "#34d399" },
];

// ── Sidebar ──────────────────────────────────────────────────

interface SidebarProps {
  room: Room;
  trivia: CosmicTriviaState;
  scoreRowHits:      Record<string, number>;
  scoreRowPushes:    Record<string, number>;
  scoreRowWinners:   Set<string>;
  frozenPlayerOrder: string[] | null;
}

function Sidebar({ room, trivia, scoreRowHits, scoreRowPushes, scoreRowWinners, frozenPlayerOrder }: SidebarProps) {
  const isReveal = trivia.phase === "reveal" || trivia.phase === "scoring";

  // During animation: use frozen pre-score order; otherwise sort by score.
  const players: Player[] = frozenPlayerOrder
    ? frozenPlayerOrder
        .map(id => room.players.find(p => p.id === id))
        .filter(Boolean) as Player[]
    : [...room.players].sort(
        (a, b) => (trivia.scores[b.id] ?? 0) - (trivia.scores[a.id] ?? 0)
      );

  return (
    <aside className="w-[260px] flex-none flex flex-col gap-[8px] px-[6px] py-[2px]">
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
          hitVersion={scoreRowHits[player.id] ?? 0}
          pushedVersion={scoreRowPushes[player.id] ?? 0}
          isHighlighted={scoreRowWinners.has(player.id)}
        />
      ))}
    </aside>
  );
}

// ── DevPanel ─────────────────────────────────────────────────

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
          {trivia && room.players.length > 0 && trivia.phase === "answering" && (
            <>
              <p className="text-[var(--muted)] text-[10px] font-[700] uppercase tracking-[1.5px] m-0 mt-[4px] mb-[2px]">
                Answer correctly
              </p>
              {room.players.map((p) => (
                <button
                  key={p.id}
                  className={btnBase}
                  disabled={busy || trivia.answeredPlayerIds.includes(p.id)}
                  onClick={() => call("tester/answer-correct", { playerId: p.id })}
                >
                  ✓ {p.nickname}
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

// ── Main component ───────────────────────────────────────────

export default function CosmicTriviaHost({ room, code }: CosmicTriviaHostProps) {
  const trivia = room.gameState as CosmicTriviaState | null;
  const [settingUp, setSettingUp] = useState(false);
  const [restartingGame, setRestartingGame] = useState(false);
  const [revealedQuestionId, setRevealedQuestionId] = useState<string | null>(null);
  const [displayQuestion, setDisplayQuestion] = useState<CosmicTriviaState["currentQuestion"]>(null);
  const seenTransitionKeyRef = useRef<string | null>(null);

  const director = useCosmicTriviaDirector(room, code);
  const phase = trivia?.phase;
  const q = trivia?.currentQuestion;
  const transitionKey = getQuestionTransitionKey({
    phase: phase ?? "",
    questionId: q?.id ?? "",
  });

  useEffect(() => {
    if (!transitionKey || seenTransitionKeyRef.current === transitionKey) return;
    seenTransitionKeyRef.current = transitionKey;
    setRevealedQuestionId(null);
  }, [transitionKey]);

  const transitionActive = Boolean(trivia && transitionKey && revealedQuestionId !== q?.id);
  useEffect(() => {
    if (!q || transitionActive) return;
    setDisplayQuestion(q);
  }, [q, transitionActive]);

  const handleTransitionComplete = useCallback(() => {
    if (q?.id && transitionKey) {
      setDisplayQuestion(q);
      setRevealedQuestionId(q.id);
    }
  }, [q?.id, transitionKey]);

  if (!trivia) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-[var(--muted)]">Loading game…</p>
      </div>
    );
  }

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
      <>
        <div className="flex flex-col items-center justify-center gap-[24px] p-[32px] h-full">
          <WinnerBoard
            players={room.players}
            scores={trivia.scores}
            onPlayAgain={handleRestart}
          />
          <DevPanel code={code} room={room} />
        </div>
        <ConfettiRain active={director.confettiRainActive} />
      </>
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

  const isRevealPhase = phase === "reveal" || phase === "scoring" || phase === "between-questions";

  let mainContent: React.ReactNode;

  if (phase === "preferences") {
    mainContent = (
      <div ref={director.prefsContentRef} className="max-w-[560px] w-full grid gap-[16px]">
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
    );
  } else if (phase === "interest-reveal") {
    const { interestRevealStep, topCategories } = director;
    mainContent = (
      <div className="flex flex-col items-center justify-center h-full gap-[32px]">
        <p className="text-white/60 text-[13px] font-[700] tracking-[3px] uppercase m-0">
          Tonight's vibe
        </p>
        <div className="flex gap-[20px] items-end">
          {topCategories.slice(0, 3).map((cat, i) => {
            const visible = interestRevealStep > i;
            const c = CATEGORY_PALETTE[i] ?? CATEGORY_PALETTE[0];
            const emoji = CATEGORY_EMOJI[cat.toLowerCase()] ?? "✦";
            const isTop = i === 0;
            return (
              <div
                key={cat}
                style={{
                  border: `1px solid ${c.border}`,
                  background: c.bg,
                  transform: visible ? "scale(1) translateY(0)" : "scale(0.95) translateY(16px)",
                  opacity: visible ? 1 : 0,
                  transition: "opacity 500ms ease, transform 500ms ease",
                }}
                className={[
                  "rounded-[16px] flex flex-col items-center gap-[10px] select-none",
                  isTop ? "px-[32px] py-[28px]" : "px-[24px] py-[22px]",
                ].join(" ")}
              >
                <span className={isTop ? "text-[48px]" : "text-[36px]"}>{emoji}</span>
                <span
                  style={{ color: c.text }}
                  className={[
                    "font-[700] capitalize text-center leading-tight",
                    isTop ? "text-[20px]" : "text-[16px]",
                  ].join(" ")}
                >
                  {cat}
                </span>
                <span className="text-white/30 text-[11px] font-[600] tracking-[1.5px] uppercase">
                  {["#1", "#2", "#3"][i]}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  } else if (
    phase === "round-prep" ||
    phase === "question-intro" ||
    phase === "question-read" ||
    phase === "final-hype" ||
    phase === "finale"
  ) {
    const label =
      phase === "round-prep"      ? "Building your round…" :
      phase === "question-intro"  ? "Next question coming up" :
      phase === "question-read"   ? "Listen to the question" :
      phase === "final-hype"      ? (trivia.finalHype?.current?.text ?? "Final results coming up…") :
      "And the results are…";

    const showQuestionAfterTransition =
      Boolean(q) &&
      (phase === "question-read" || revealedQuestionId === q?.id);

    mainContent = showQuestionAfterTransition ? (
      <div
        className="max-w-[720px] w-full text-center grid gap-[12px]"
        style={{ animation: "cosmic-trivia-question-in 2000ms ease both" }}
      >
        <p className="text-[var(--muted)] text-[14px] m-0">
          Question {trivia.questionIndex + 1} / {trivia.questionCount}
        </p>
        <h2 className="text-[var(--ink)] text-[32px] font-[800] m-0 leading-snug">{q?.question}</h2>
      </div>
    ) : (
      <div className="max-w-[500px] w-full text-center grid gap-[12px]">
        {(phase === "question-intro" || phase === "question-read") && (
          <p className="text-[var(--muted)] text-[14px] m-0">
            Question {trivia.questionIndex + 1} / {trivia.questionCount}
          </p>
        )}
        <h2 className="text-[var(--ink)] text-[32px] font-[800] m-0">{label}</h2>
      </div>
    );
  } else {
    const questionToRender = transitionActive && phase === "between-questions"
      ? (displayQuestion ?? q)
      : q;
    mainContent = (
      <div className="w-full grid gap-[16px]">
        <div className="flex items-center justify-between">
          <p className="text-[var(--muted)] text-[13px] m-0">
            Question {trivia.questionIndex + 1} / {trivia.questionCount}
          </p>
          <span className="text-[var(--muted)] text-[13px]">
            {trivia.answeredPlayerIds.length} / {trivia.expectedAnswerCount} answered
          </span>
        </div>
        {questionToRender && (
          <>
            <h2 className="text-[var(--ink)] text-[24px] font-[800] m-0 leading-snug">
              {questionToRender.question}
            </h2>
            <AnswerGrid
              answers={questionToRender.answers}
              correctId={isRevealPhase ? questionToRender.correctAnswer : null}
              variant="big-screen"
            />
            {isRevealPhase && questionToRender.fact && (
              <p className="text-[var(--muted)] text-[14px] m-0 border-l-[3px] border-[rgba(120,212,94,.4)] pl-[12px]">
                {questionToRender.fact}
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
    );
  }

  return (
    <>
      <style>{`@keyframes cosmic-trivia-question-in {
        from { opacity: 0; transform: translateY(12px); }
        to { opacity: 1; transform: translateY(0); }
      }`}</style>
      <div className="flex items-center gap-[32px] p-[32px] h-full">
        <div
          className="flex-1 flex items-center justify-center min-h-0"
          style={{
            opacity: transitionActive ? 0 : 1,
            transition: "opacity 2000ms ease-out",
          }}
        >
          {mainContent}
        </div>
        <Sidebar
          room={room}
          trivia={trivia}
          scoreRowHits={director.scoreRowHits}
          scoreRowPushes={director.scoreRowPushes}
          scoreRowWinners={director.scoreRowWinners}
          frozenPlayerOrder={director.frozenPlayerOrder}
        />
        <DevPanel code={code} room={room} />
      </div>
      {shouldRenderScoreBurstOverlay(phase) && (
        <ScoreBurstOverlay
          correctPlayerIds={director.scoreBurstWinnerIds}
          trigger={director.scoreBurstTrigger}
          onBurstReady={director.onScoreBurstReady}
          onPlayerHit={director.onScoreFlowerHit}
          onPlayerLeave={director.onScoreFlowerLeave}
        />
      )}
      <ShaderLinesTransition
        active={transitionActive}
        runKey={transitionKey}
        readyToReveal={phase === "question-read"}
        durationMs={4_000}
        enterMs={2_000}
        onComplete={handleTransitionComplete}
      />
    </>
  );
}
