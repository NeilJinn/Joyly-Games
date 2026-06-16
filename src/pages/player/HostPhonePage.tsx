import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import PhoneLayout from "../../components/player/PhoneLayout";
import GamePickerModal from "../../components/platform/GamePickerModal";
import { useSSE } from "../../hooks/useSSE";
import { useRoomStore } from "../../stores/roomStore";
import { useConfig } from "../../hooks/useConfig";
import type { Room } from "../../types/room";

interface HostAccount {
  email: string;
  name: string;
}

function loadHostAccount(): HostAccount | null {
  try {
    return JSON.parse(localStorage.getItem("joylyHostAccount") || "null");
  } catch {
    return null;
  }
}

function getLaunchState(room: Room): { label: string; endpoint: string; disabled: boolean } {
  const game = room.selectedGame;
  if (!game) return { label: "Select a game first", endpoint: "force-start", disabled: true };
  if (room.players.length < (game.minPlayers ?? 2)) {
    return { label: `Need ${game.minPlayers ?? 2} players`, endpoint: "force-start", disabled: true };
  }
  const allReady = room.players.length > 0 && room.players.every((p) => p.ready);
  return allReady
    ? { label: "Start now", endpoint: "start", disabled: false }
    : { label: "Force start", endpoint: "force-start", disabled: false };
}

export default function HostPhonePage() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const { config } = useConfig();

  const room = useRoomStore((s) => s.room);
  const setRoom = useRoomStore((s) => s.setRoom);
  const clearRoom = useRoomStore((s) => s.clearRoom);

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const hostAccount = loadHostAccount();

  useEffect(() => {
    if (!code || room?.code === code) { setLoading(false); return; }
    fetch(`/api/rooms/${code}`)
      .then((r) => r.json())
      .then((data: { room: Room }) => { if (data.room) setRoom(data.room); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [code, room?.code, setRoom]);

  useSSE(code ?? null);

  useEffect(() => {
    if (room?.status === "closed") {
      clearRoom();
      navigate("/");
    }
  }, [room?.status, clearRoom, navigate]);

  async function apiPost(path: string) {
    if (busy || !code) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/rooms/${code}/${path}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({}) });
      if (res.ok) {
        const data = (await res.json()) as { room?: Room };
        if (data.room) setRoom(data.room);
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleSelectGame(gameId: string) {
    if (!code) return;
    setPickerOpen(false);
    try {
      const res = await fetch(`/api/rooms/${code}/select-game`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ gameId }) });
      if (res.ok) {
        const data = (await res.json()) as { room: Room };
        if (data.room) setRoom(data.room);
      }
    } catch { /* SSE will sync */ }
  }

  const wrap = (children: React.ReactNode) => (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
      <PhoneLayout>{children}</PhoneLayout>
    </motion.div>
  );

  if (loading) {
    return wrap(
      <div className="phone-card text-center">
        <p className="text-[var(--muted)] text-[14px] m-0">Loading room…</p>
      </div>
    );
  }

  if (!room) {
    return wrap(
      <div className="phone-card text-center grid gap-[12px]">
        <p className="text-[var(--ink)] text-[16px] font-[700] m-0">Room not found</p>
        <p className="text-[var(--muted)] text-[13px] m-0">The room may have been closed.</p>
      </div>
    );
  }

  const isAuthorized = Boolean(hostAccount?.email && room.host?.email && hostAccount.email === room.host.email);

  if (!isAuthorized) {
    return wrap(
      <div className="phone-card grid gap-[12px]">
        <p className="text-[var(--ink)] text-[16px] font-[700] m-0">Host controls</p>
        <p className="text-[var(--muted)] text-[13px] m-0">
          This room belongs to <strong>{room.host?.email ?? "unknown"}</strong>.<br />
          Sign in as that host on the big screen to use phone controls.
        </p>
      </div>
    );
  }

  const launch = getLaunchState(room);

  return (
    <>
      {wrap(
        <div className="grid gap-[14px]">
          {/* Room summary */}
          <div className="phone-card grid gap-[6px]">
            <div className="flex items-baseline gap-[10px]">
              <span className="text-[var(--ink)] text-[28px] font-[800] tracking-[3px] leading-[1]">{room.code}</span>
              <span className="text-[var(--muted)] text-[13px]">{room.players.length} player{room.players.length !== 1 ? "s" : ""}</span>
            </div>
            <p className="text-[var(--muted)] text-[13px] m-0">
              {room.selectedGame?.title ?? "No game selected"}
            </p>
          </div>

          {/* Host controls */}
          <div className="phone-card grid gap-[10px]">
            <button
              className="w-full h-[44px] rounded-[8px] border border-white/[.15] bg-[rgba(17,24,33,.8)] text-[var(--ink)] text-[14px] font-[700] hover:border-white/[.3] transition-colors cursor-pointer disabled:opacity-50"
              disabled={busy}
              onClick={() => setPickerOpen(true)}
            >
              Change game
            </button>

            {room.status === "waiting" && (
              <button
                className={[
                  "w-full h-[44px] rounded-[8px] text-[14px] font-[700] transition-colors cursor-pointer",
                  launch.disabled
                    ? "border border-white/[.1] bg-[rgba(17,24,33,.5)] text-[var(--muted)] cursor-not-allowed"
                    : "bg-[var(--brand,#78d45e)] text-[#0a0f14] hover:opacity-90",
                ].join(" ")}
                disabled={busy || launch.disabled}
                onClick={() => apiPost(launch.endpoint)}
              >
                {launch.label}
              </button>
            )}

            <button
              className="w-full h-[44px] rounded-[8px] border border-[rgba(220,60,60,.35)] bg-[rgba(220,60,60,.08)] text-[rgba(240,100,100,1)] text-[14px] font-[700] hover:bg-[rgba(220,60,60,.16)] transition-colors cursor-pointer disabled:opacity-50"
              disabled={busy}
              onClick={() => { if (confirm("Close this room?")) void apiPost("close"); }}
            >
              Close room
            </button>
          </div>

          {/* Player view link */}
          <button
            className="text-[var(--muted)] text-[13px] text-center hover:text-[var(--ink)] transition-colors cursor-pointer bg-transparent border-0 p-0"
            onClick={() => navigate(`/join/${code}`)}
          >
            Switch to Player view →
          </button>
        </div>
      )}

      <GamePickerModal
        open={pickerOpen}
        games={config.games}
        selectedGameId={room.selectedGame?.id ?? null}
        onSelect={handleSelectGame}
        onClose={() => setPickerOpen(false)}
      />
    </>
  );
}
