import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import PhoneLayout from "../../components/player/PhoneLayout";
import AvatarStack from "../../components/player/AvatarStack";
import Button from "../../components/ui/Button";
import Icon from "../../components/ui/Icon";
import { useSSE } from "../../hooks/useSSE";
import { useRoomStore } from "../../stores/roomStore";
import { loadPlayerIdentity } from "../../types/player";
import type { Player } from "../../types/room";

function launchCountdownSeconds(endsAt?: number): number {
  if (!endsAt) return 0;
  return Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
}

export default function WaitingPage() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const room = useRoomStore((s) => s.room);
  const setRoom = useRoomStore((s) => s.setRoom);

  const identity = loadPlayerIdentity();
  const playerId = identity?.playerId ?? null;

  const [toggling, setToggling] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!playerId) navigate(`/join/${code ?? ""}`, { replace: true });
  }, [playerId, code, navigate]);

  useEffect(() => {
    if (!code || room?.code === code) return;
    fetch(`/api/rooms/${code}`)
      .then((r) => r.json())
      .then((data: { room: typeof room }) => { if (data.room) setRoom(data.room); })
      .catch(() => {});
  }, [code, room?.code, setRoom]);

  useSSE(code ?? null);

  useEffect(() => {
    if (room?.status === "playing") navigate(`/play/${code}`, { replace: true });
  }, [room?.status, code, navigate]);

  if (!playerId) return null;

  const currentPlayer: Player | undefined = room?.players.find((p) => p.id === playerId);

  const countdownEndsAt = room?.launchCountdown?.endsAt;
  const countdownSecs = launchCountdownSeconds(countdownEndsAt);
  const countdownActive = countdownSecs > 0;

  const statusText = countdownActive
    ? `Starting in ${countdownSecs}s`
    : currentPlayer?.ready
    ? "Ready"
    : "Getting ready";

  const ringColor = !currentPlayer || currentPlayer.online === false
    ? "#8f99a6"
    : currentPlayer.ready
    ? "#78d45e"
    : "#f4b04a";

  const isReady = Boolean(currentPlayer?.ready);
  const avatarToShow = currentPlayer?.avatar ?? identity?.avatar ?? null;

  async function handleToggleReady() {
    if (!code || !playerId || toggling || countdownActive) return;
    setToggling(true);
    setError("");
    try {
      const res = await fetch(`/api/rooms/${code}/players/${playerId}/ready`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ready: !isReady }),
      });
      if (!res.ok) throw new Error("Failed to update ready status");
      const data = (await res.json()) as { room: typeof room };
      if (data.room) setRoom(data.room);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setToggling(false);
    }
  }

  if (room?.status === "closed") {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
        <PhoneLayout>
          <div className="phone-card grid gap-[12px] text-center">
            <div className="text-[48px]">✕</div>
            <h1 className="text-[var(--ink)] text-[22px] font-[800] m-0">Room closed</h1>
            <p className="text-[var(--muted)] text-[14px] m-0">Ask the host to create a new room.</p>
          </div>
        </PhoneLayout>
      </motion.div>
    );
  }

  const nickname = currentPlayer?.nickname ?? identity?.nickname ?? "Player";

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
    >
      <PhoneLayout>
        <div className="phone-status">
          <div
            className="phone-status-avatar"
            style={{ filter: currentPlayer?.online === false ? "drop-shadow(0 0 16px #8f99a666)" : `drop-shadow(0 0 20px ${ringColor}66)` }}
          >
            <AvatarStack
              avatar={avatarToShow}
              size="hero"
              ringColor={ringColor}
              className={currentPlayer?.online === false ? "[filter:grayscale(1)]" : undefined}
            />
          </div>

          <div className="phone-status-copy">
            <h1 className="text-[var(--ink)]">{nickname}</h1>
            <span className={["ready-chip", isReady ? "is-ready" : ""].join(" ")}>
              {statusText}
            </span>
          </div>

          <div className="phone-status-panel">
            {room?.status === "waiting" && (
              <Button
                variant="primary"
                className="w-full"
                disabled={toggling || countdownActive}
                onClick={handleToggleReady}
              >
                <Icon name="check" />
                <span>
                  {countdownActive
                    ? "Starting soon"
                    : isReady
                    ? "Ready"
                    : "Tap when ready"}
                </span>
              </Button>
            )}

            {error && (
              <p className="text-[#f67272] text-[13px] text-center m-0">{error}</p>
            )}

            <div className="phone-mini">
              <span>{code}</span>
              <strong>{room?.selectedGame?.title ?? "Lobby"}</strong>
            </div>
          </div>
        </div>
      </PhoneLayout>
    </motion.div>
  );
}
