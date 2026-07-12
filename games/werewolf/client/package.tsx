import { lazy, Suspense } from "react";
import type { GameBigScreenEntry, GamePhoneEntry } from "../../../src/game-runtime/types";

const Phone = lazy(() => import("./PhonePage"));
const BigScreen = lazy(() => import("./BigScreenPage"));

function Loading() {
  return <div className="flex items-center justify-center min-h-[120px] text-[var(--muted)]">Loading game…</div>;
}

export const FateWerewolfPhone: GamePhoneEntry = ({ room, code, playerId, embedded }) => (
  <Suspense fallback={<Loading />}>
    <Phone room={room} code={code} playerId={playerId ?? undefined} embedded={embedded} />
  </Suspense>
);

export const FateWerewolfBigScreen: GameBigScreenEntry = ({ room, code }) => (
  <Suspense fallback={<Loading />}>
    <BigScreen room={room} code={code} />
  </Suspense>
);

export const fateWerewolfPackage = {
  id: "fate-werewolf",
  title: "命运狼人",
  phone: FateWerewolfPhone,
  bigScreen: FateWerewolfBigScreen,
};
