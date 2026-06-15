import { useState } from "react";
import Button from "../ui/Button";
import Icon from "../ui/Icon";
import type { Room } from "../../types/room";

interface LobbyControlsProps {
  room: Room;
  onOpenGamePicker: () => void;
}

function lobbySummary(
  onlineCount: number,
  readyCount: number,
  disconnectedCount: number,
  maxPlayers: number
): string {
  if (onlineCount === 0) return "Waiting for players to join…";
  const parts: string[] = [`${onlineCount} online`];
  if (readyCount > 0) parts.push(`${readyCount} ready`);
  if (disconnectedCount > 0) parts.push(`${disconnectedCount} disconnected`);
  parts.push(`max ${maxPlayers}`);
  return parts.join(" · ");
}

export default function LobbyControls({ room, onOpenGamePicker }: LobbyControlsProps) {
  const [starting, setStarting] = useState(false);
  const [closing, setClosing] = useState(false);
  const [addingTester, setAddingTester] = useState(false);
  const [error, setError] = useState("");

  const minPlayers = room.selectedGame?.minPlayers ?? 2;
  const maxPlayers = room.selectedGame?.maxPlayers ?? 8;

  const onlinePlayers = room.players.filter((p) => p.online !== false);
  const readyPlayers = onlinePlayers.filter((p) => p.ready);
  const disconnectedPlayers = room.players.filter((p) => p.online === false);

  const onlineCount = onlinePlayers.length;
  const readyCount = readyPlayers.length;
  const disconnectedCount = disconnectedPlayers.length;
  const totalCount = room.players.length;

  const canStart = onlineCount >= minPlayers && onlineCount <= maxPlayers;
  const canForceStart = totalCount >= minPlayers && totalCount <= maxPlayers;
  const allReady = canStart && readyCount === onlineCount && onlineCount > 0;
  const countdownSeconds = room.launchCountdown ?? 0;
  const countdownActive = countdownSeconds > 0;

  const startLabel = countdownActive
    ? `Starting in ${countdownSeconds}s`
    : allReady
    ? "Launch now"
    : canForceStart
    ? "Force start · 5s"
    : `Need ${minPlayers} players`;

  const startEnabled = (allReady || canForceStart) && !countdownActive;

  async function handleStart() {
    if (!startEnabled || starting) return;
    setStarting(true);
    setError("");
    try {
      const endpoint = allReady ? "start" : "force-start";
      const res = await fetch(`/api/rooms/${room.code}/${endpoint}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error ?? "Failed to start");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start");
    } finally {
      setStarting(false);
    }
  }

  async function handleClose() {
    if (closing) return;
    setClosing(true);
    setError("");
    try {
      await fetch(`/api/rooms/${room.code}/close`, {
        method: "POST",
        headers: { "content-type": "application/json" },
      });
    } catch {
      // ignore — SSE will sync room closed state
    } finally {
      setClosing(false);
    }
  }

  async function handleAddTester() {
    if (addingTester) return;
    setAddingTester(true);
    setError("");
    try {
      const res = await fetch(`/api/rooms/${room.code}/test-players`, {
        method: "POST",
        headers: { "content-type": "application/json" },
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error ?? "Failed to add tester");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add tester");
    } finally {
      setAddingTester(false);
    }
  }

  return (
    <div>
      <div className="flex items-end justify-between gap-[20px] mb-[16px]">
        <div>
          <h2 className="m-0 text-[24px] font-[800] text-[var(--ink)]">
            Party Stage
          </h2>
          <p className="text-[var(--muted)] text-[14px] mt-[6px] mb-0">
            {lobbySummary(onlineCount, readyCount, disconnectedCount, maxPlayers)}
          </p>
        </div>
        <div className="flex flex-wrap justify-end gap-[10px]">
          <Button variant="secondary" onClick={onOpenGamePicker}>
            <Icon name="game" />
            <span>{room.selectedGame?.title ?? "Choose game"}</span>
          </Button>
          <Button
            variant="secondary"
            disabled={addingTester}
            onClick={handleAddTester}
          >
            <Icon name="users" />
            <span>Add tester</span>
          </Button>
          <button
            className={[
              "inline-flex items-center justify-center gap-[8px] min-h-[44px] px-[16px]",
              "rounded-[6px] border border-[#f67272]/[.4] text-[#f67272] bg-transparent",
              "font-[950] text-[14px] cursor-pointer hover:bg-[#f67272]/[.08] transition-colors",
              "disabled:opacity-[.48] disabled:cursor-not-allowed",
            ].join(" ")}
            type="button"
            disabled={closing}
            onClick={handleClose}
          >
            <Icon name="power" />
            <span>Close</span>
          </button>
          <Button
            variant="primary"
            disabled={!startEnabled || starting}
            onClick={handleStart}
            className={countdownActive ? "ring-2 ring-[var(--green)]" : ""}
          >
            <Icon name="play" />
            <span>{starting ? "Starting…" : startLabel}</span>
          </Button>
        </div>
      </div>
      {error && (
        <p className="text-[#f67272] text-[13px] mt-[4px]">{error}</p>
      )}
    </div>
  );
}
