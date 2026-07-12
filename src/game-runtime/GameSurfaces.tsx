import { useParams } from "react-router-dom";
import { useSSE } from "../hooks/useSSE";
import { usePlayerStore } from "../stores/playerStore";
import { useRoomStore } from "../stores/roomStore";
import type { Room } from "../types/room";
import { getGamePackage } from "./registry";

interface SurfaceProps {
  gameId: string | null | undefined;
  code: string;
  room?: Room;
  embedded?: boolean;
  isHost?: boolean;
}

export function GamePhoneSurface({ gameId, code, room, embedded, isHost }: SurfaceProps) {
  const pkg = getGamePackage(gameId);
  const playerId = usePlayerStore((state) => state.playerId);
  if (!pkg) return <UnavailableGame />;
  return <pkg.phone room={room} code={code} playerId={playerId} embedded={embedded} isHost={isHost} />;
}

export function GameBigScreenSurface({ gameId, code, room }: SurfaceProps) {
  const pkg = getGamePackage(gameId);
  if (!pkg) return <UnavailableGame />;
  return <pkg.bigScreen room={room} code={code} />;
}

export function GamePhoneRouteSurface({ gameId }: { gameId: string }) {
  const { code = "" } = useParams<{ code: string }>();
  useSSE(code || null);
  const room = useRoomStore((state) => state.room);
  return <GamePhoneSurface gameId={gameId} code={code} room={room ?? undefined} />;
}

export function GameBigScreenRouteSurface({ gameId }: { gameId: string }) {
  const { code = "" } = useParams<{ code: string }>();
  useSSE(code || null);
  const room = useRoomStore((state) => state.room);
  return <GameBigScreenSurface gameId={gameId} code={code} room={room ?? undefined} />;
}

/** Stable platform-facing names; implementations stay game-agnostic. */
export const GamePhoneRuntime = GamePhoneSurface;
export const GameBigScreenRuntime = GameBigScreenSurface;

function UnavailableGame() {
  return (
    <div className="flex items-center justify-center h-full min-h-[120px]">
      <p className="text-[var(--muted)]">This game package is unavailable.</p>
    </div>
  );
}
