import { lazy, Suspense } from "react";
import type { GameBigScreenEntry, GamePhoneEntry } from "../../../src/game-runtime/types";

const Phone = lazy(() => import("./PhonePage"));
const BigScreen = lazy(() => import("./BigScreenPage"));

function Loading() {
  return <div className="flex items-center justify-center min-h-[120px] text-[var(--muted)]">Loading game…</div>;
}

export const CosmicTriviaPhone: GamePhoneEntry = ({ room, code, embedded, isHost }) => {
  if (!room) return <Loading />;
  return <Suspense fallback={<Loading />}><Phone room={room} code={code} embedded={embedded} isHost={isHost} /></Suspense>;
};

export const CosmicTriviaBigScreen: GameBigScreenEntry = ({ room, code }) => {
  if (!room) return <Loading />;
  return <Suspense fallback={<Loading />}><BigScreen room={room} code={code} /></Suspense>;
};

export const cosmicTriviaPackage = {
  id: "cosmic-trivia",
  title: "宇宙知识王",
  phone: CosmicTriviaPhone,
  bigScreen: CosmicTriviaBigScreen,
};
