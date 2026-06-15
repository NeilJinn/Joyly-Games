import { useState, useEffect, useCallback } from "react";
import type { Room } from "../../../types/room";
import type { CosmicTriviaState, CosmicPrivateState } from "../../../types/cosmic-trivia";
import { loadPlayerIdentity } from "../../../types/player";
import PhoneLayout from "../../../components/player/PhoneLayout";
import AnswerGrid from "../../../components/games/cosmic-trivia/AnswerGrid";
import PreferencesPicker from "../../../components/games/cosmic-trivia/PreferencesPicker";

interface CosmicTriviaPhoneProps {
  room: Room;
  code: string;
}

export default function CosmicTriviaPhone({ room, code }: CosmicTriviaPhoneProps) {
  const trivia = room.gameState as CosmicTriviaState | null;
  const identity = loadPlayerIdentity();
  const playerId = identity?.playerId ?? null;

  const [selectedAnswerId, setSelectedAnswerId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [prefSubmitting, setPrefSubmitting] = useState(false);
  const [privateState, setPrivateState] = useState<CosmicPrivateState | null>(null);

  // Reset selected answer when question changes
  useEffect(() => {
    setSelectedAnswerId(null);
  }, [trivia?.questionIndex]);

  // Fetch private state on phase change
  useEffect(() => {
    if (!playerId || !trivia) return;
    fetch(`/api/rooms/${code}/trivia/private/${playerId}`)
      .then((r) => r.json())
      .then((d: { privateState?: CosmicPrivateState }) => {
        if (d.privateState) setPrivateState(d.privateState);
      })
      .catch(() => {});
  }, [trivia?.phase, code, playerId]);

  const submitAnswer = useCallback(async (answerId: string) => {
    if (!playerId || submitting || selectedAnswerId) return;
    setSelectedAnswerId(answerId);
    setSubmitting(true);
    try {
      await fetch(`/api/rooms/${code}/trivia/answer`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ playerId, choice: answerId }),
      });
    } catch {
      // SSE will update state
    } finally {
      setSubmitting(false);
    }
  }, [playerId, code, submitting, selectedAnswerId]);

  const submitPreferences = useCallback(async (prefs: { categories: string[]; tags: string[] }) => {
    if (!playerId || prefSubmitting) return;
    setPrefSubmitting(true);
    try {
      await fetch(`/api/rooms/${code}/trivia/preferences`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ playerId, preferences: prefs }),
      });
    } catch {
      // ignore
    } finally {
      setPrefSubmitting(false);
    }
  }, [playerId, code, prefSubmitting]);

  if (!trivia) {
    return (
      <PhoneLayout>
        <div className="phone-card text-center">
          <p className="text-[var(--muted)] text-[14px] m-0">Loading…</p>
        </div>
      </PhoneLayout>
    );
  }

  const phase = trivia.phase;
  const q = trivia.currentQuestion;
  const myPlayerState = playerId ? trivia.playerStates[playerId] : null;
  const hasLockedPrefs = myPlayerState?.preferencesLocked ?? false;
  const hasAnswered = playerId ? trivia.answeredPlayerIds.includes(playerId) : false;
  const score = playerId && privateState
    ? privateState.personalScore
    : playerId
    ? trivia.scores[playerId]
    : undefined;

  const questionLabel = `Question ${trivia.questionIndex + 1} / ${trivia.questionCount}`;

  const scoreChip = score !== undefined && (
    <div className="flex justify-between items-center text-[13px] text-[var(--muted)]">
      <span>{questionLabel}</span>
      <span className="font-[700] text-[var(--ink)]">{score} pts</span>
    </div>
  );

  if (phase === "game-setup") {
    return (
      <PhoneLayout>
        <div className="phone-card grid gap-[10px]">
          <p className="text-[var(--muted)] text-[13px] m-0">Setting up</p>
          <h2 className="text-[var(--ink)] text-[20px] font-[800] m-0">
            The host is choosing the round length
          </h2>
          <p className="text-[var(--muted)] text-[13px] m-0">
            Once set, you&apos;ll choose categories here.
          </p>
        </div>
      </PhoneLayout>
    );
  }

  if (phase === "preferences") {
    if (hasLockedPrefs) {
      return (
        <PhoneLayout>
          <div className="phone-card grid gap-[10px]">
            <p className="text-[#78d45e] text-[13px] font-[700] m-0">Choices locked ✓</p>
            <p className="text-[var(--muted)] text-[13px] m-0">Waiting for other players…</p>
          </div>
        </PhoneLayout>
      );
    }
    return (
      <PhoneLayout>
        <div className="phone-card grid gap-[4px]">
          <h2 className="text-[var(--ink)] text-[20px] font-[800] m-0 mb-[4px]">Pick your choices</h2>
          {trivia.questionOptions && (
            <PreferencesPicker
              options={trivia.questionOptions}
              onSubmit={submitPreferences}
              submitting={prefSubmitting}
            />
          )}
        </div>
      </PhoneLayout>
    );
  }

  if (phase === "round-prep" || phase === "question-intro" || phase === "question-read") {
    return (
      <PhoneLayout>
        <div className="phone-card grid gap-[10px]">
          <p className="text-[var(--muted)] text-[13px] m-0">Get ready</p>
          <h2 className="text-[var(--ink)] text-[20px] font-[800] m-0">
            {phase === "question-read" ? "Listen closely…" : "Round starting!"}
          </h2>
        </div>
      </PhoneLayout>
    );
  }

  if (phase === "answering" && q) {
    return (
      <PhoneLayout>
        <div className="phone-card grid gap-[14px]">
          {scoreChip}
          <p className="text-[var(--ink)] text-[16px] font-[700] m-0 leading-snug">{q.question}</p>
          <AnswerGrid
            answers={q.answers}
            selectedId={selectedAnswerId}
            disabled={hasAnswered || submitting}
            onSelect={submitAnswer}
            variant="phone"
          />
          {hasAnswered && (
            <p className="text-[#78d45e] text-[13px] text-center m-0 font-[700]">
              Answer locked in ✓
            </p>
          )}
        </div>
      </PhoneLayout>
    );
  }

  if (phase === "answer-lock") {
    return (
      <PhoneLayout>
        <div className="phone-card grid gap-[10px] text-center">
          <p className="text-[var(--sun)] text-[13px] font-[700] m-0">Locked</p>
          <h2 className="text-[var(--ink)] text-[20px] font-[800] m-0">Answers are closed</h2>
          <p className="text-[var(--muted)] text-[13px] m-0">Revealing the answer now…</p>
        </div>
      </PhoneLayout>
    );
  }

  if ((phase === "reveal" || phase === "scoring" || phase === "between-questions") && q) {
    const correctAnswer = q.answers.find((a) => a.id === q.correctAnswer);
    return (
      <PhoneLayout>
        <div className="phone-card grid gap-[14px]">
          {scoreChip}
          <AnswerGrid
            answers={q.answers}
            selectedId={selectedAnswerId}
            correctId={q.correctAnswer ?? undefined}
            disabled
            variant="phone"
          />
          {correctAnswer && (
            <div className="grid gap-[4px]">
              <p className="text-[#78d45e] text-[13px] font-[700] m-0">
                Correct: {correctAnswer.text}
              </p>
              {q.fact && <p className="text-[var(--muted)] text-[12px] m-0">{q.fact}</p>}
            </div>
          )}
        </div>
      </PhoneLayout>
    );
  }

  if (phase === "final-hype" || phase === "finale") {
    return (
      <PhoneLayout>
        <div className="phone-card text-center grid gap-[10px]">
          <p className="text-[var(--sun)] text-[13px] font-[700] m-0">Final results</p>
          <h2 className="text-[var(--ink)] text-[20px] font-[800] m-0">
            {trivia.finalHype?.current?.text ?? "Final results are on their way…"}
          </h2>
        </div>
      </PhoneLayout>
    );
  }

  // post-game
  return (
    <PhoneLayout>
      <div className="phone-card text-center grid gap-[10px]">
        <div className="text-[48px]" aria-hidden="true">🏆</div>
        <h2 className="text-[var(--ink)] text-[20px] font-[800] m-0">Game over!</h2>
        <p className="text-[var(--muted)] text-[13px] m-0">Check the big screen for results.</p>
        {score !== undefined && (
          <p className="text-[var(--ink)] text-[24px] font-[800]">{score} pts</p>
        )}
      </div>
    </PhoneLayout>
  );
}
