import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useParams, useNavigate } from "react-router-dom";
import NavBar from "../../components/platform/NavBar";
import LobbyControls from "../../components/platform/LobbyControls";
import PlayerStage from "../../components/platform/PlayerStage";
import GamePickerModal from "../../components/platform/GamePickerModal";
import HostPhoneLobbyView from "../../components/platform/HostPhoneLobbyView";
import { GameBigScreenRuntime } from "../../game-runtime/GameSurfaces";
import { useSSE } from "../../hooks/useSSE";
import { useRoomStore } from "../../stores/roomStore";
import { useAuthStore } from "../../stores/authStore";
import { useConfig } from "../../hooks/useConfig";
import type { Room } from "../../types/room";

export default function LobbyPage() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const { config } = useConfig();

  const room = useRoomStore((s) => s.room);
  const setRoom = useRoomStore((s) => s.setRoom);
  const clearRoom = useRoomStore((s) => s.clearRoom);
  const isSignedIn = useAuthStore((s) => s.isSignedIn);
  const [loading, setLoading] = useState(true);
  const [pickerOpen, setPickerOpen] = useState(false);

  // Fetch room on mount
  useEffect(() => {
    if (!code) return;
    fetch(`/api/rooms/${code}`)
      .then((r) => r.json())
      .then((data: { room: Room }) => {
        if (data.room) setRoom(data.room);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [code, setRoom]);

  // SSE for real-time updates
  useSSE(code ?? null);

  // Navigate away when room is closed
  useEffect(() => {
    if (room?.status === "closed") {
      clearRoom();
      navigate("/");
    }
  }, [room?.status, clearRoom, navigate]);

  async function handleSelectGame(gameId: string) {
    if (!code) return;
    setPickerOpen(false);
    try {
      const res = await fetch(`/api/rooms/${code}/select-game`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ gameId }),
      });
      if (res.ok) {
        const data = (await res.json()) as { room: Room };
        if (data.room) setRoom(data.room);
      }
    } catch {
      // SSE will sync the update anyway
    }
  }

  const joinUrl = `${config.localJoinBase}/?room=${code ?? ""}`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=164x164&data=${encodeURIComponent(joinUrl)}`;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-[var(--muted)]">Loading room…</p>
      </div>
    );
  }

  if (!room) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-[var(--muted)]">Room not found.</p>
      </div>
    );
  }

  // Host phone: signed-in users on mobile are the host (regular players never sign in)
  const isMobile = window.matchMedia("(max-width: 768px)").matches;
  const isHostPhone = isMobile && isSignedIn;
  if (isHostPhone) {
    return (
      <HostPhoneLobbyView
        room={room}
        code={code!}
        onRoomUpdate={setRoom}
      />
    );
  }

  const minPlayers = room.selectedGame?.minPlayers ?? 2;
  const maxPlayers = room.selectedGame?.maxPlayers ?? 8;

  return (
    <motion.div
      className="min-h-screen pt-[52px]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.22 }}
    >
      <NavBar />

      {room.status === "playing" ? (
        <div style={{ position: "fixed", top: 52, left: 0, right: 0, bottom: 0, overflow: "hidden" }}>
          <GameBigScreenRuntime gameId={room.selectedGame?.id} room={room} code={code!} />
        </div>
      ) : (
        <div
          className="grid"
          style={{
            gridTemplateColumns: "320px 1fr",
            minHeight: "calc(100vh - 52px)",
          }}
        >
          {/* Sidebar */}
          <aside
            className={[
              "flex flex-col gap-[20px] p-[24px]",
              "border-r border-white/[.07] bg-[rgba(23,29,37,.74)]",
            ].join(" ")}
          >
            <div>
              <span className="block text-[11px] font-[700] tracking-[.06em] uppercase text-[var(--muted)] mb-[6px]">
                Room code
              </span>
              <strong className="block text-[48px] font-[800] text-[var(--ink)] leading-[1] tracking-[4px]">
                {room.code}
              </strong>
            </div>

            <div className="p-[14px] bg-white rounded-[8px] max-w-[290px]">
              <img
                src={qrUrl}
                alt="Scan to join room"
                className="w-full h-auto block"
                width={164}
                height={164}
              />
            </div>

            <a
              href={joinUrl}
              className="text-[13px] text-[var(--muted)] break-all hover:text-[var(--ink)] transition-colors"
            >
              {joinUrl}
            </a>

            <div className="mt-auto p-[12px] rounded-[8px] border border-white/[.07] bg-[rgba(17,24,33,.6)]">
              <span className="block text-[11px] font-[700] tracking-[.06em] uppercase text-[var(--muted)] mb-[4px]">
                Host phone control
              </span>
              <p className="text-[var(--muted)] text-[13px] m-0">
                Sign in with {room.host.email} on your phone.
              </p>
            </div>
          </aside>

          {/* Main stage */}
          <main className="flex flex-col gap-[20px] p-[28px]">
            <LobbyControls
              room={room}
              onOpenGamePicker={() => setPickerOpen(true)}
            />
            <PlayerStage
              players={room.players}
              minPlayers={minPlayers}
              maxPlayers={maxPlayers}
            />
            <button
              className={[
                "self-start inline-flex items-center gap-[8px]",
                "min-h-[36px] px-[14px] rounded-[6px]",
                "border border-white/[.12] bg-[rgba(17,24,33,.9)]",
                "text-[var(--muted)] text-[13px] font-[700] cursor-pointer",
                "hover:text-[var(--ink)] transition-colors",
              ].join(" ")}
              type="button"
              onClick={async () => {
                await navigator.clipboard?.writeText(joinUrl).catch(() => {});
              }}
            >
              <svg
                className="w-[14px] h-[14px] fill-none stroke-current [stroke-width:2] flex-none"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path d="M20 9H11a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2v-9a2 2 0 0 0-2-2zM5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
              Copy link
            </button>
          </main>
        </div>
      )}

      <GamePickerModal
        open={pickerOpen}
        games={config.games}
        selectedGameId={room.selectedGame?.id ?? null}
        onSelect={handleSelectGame}
        onClose={() => setPickerOpen(false)}
      />
    </motion.div>
  );
}
