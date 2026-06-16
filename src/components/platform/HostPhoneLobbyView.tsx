import { useState } from "react";
import { useNavigate } from "react-router-dom";
import GamePickerModal from "./GamePickerModal";
import AvatarStack from "../player/AvatarStack";
import CosmicTriviaPhone from "../../pages/games/cosmic-trivia/PhonePage";
import { useAuthStore } from "../../stores/authStore";
import { useConfig } from "../../hooks/useConfig";
import { loadPlayerIdentity } from "../../types/player";
import type { Room } from "../../types/room";

interface Props {
  room: Room;
  code: string;
  onRoomUpdate: (room: Room) => void;
}

function launchState(room: Room) {
  const game = room.selectedGame;
  const minPlayers = game?.minPlayers ?? 2;
  const online = room.players.filter((p) => p.online !== false);
  const ready = online.filter((p) => p.ready);
  const countdown = (room as unknown as { launchCountdown?: { endsAt?: number } }).launchCountdown?.endsAt;
  if (countdown) return { label: "Starting soon", endpoint: "force-start", disabled: true };
  const allReady =
    online.length >= minPlayers &&
    ready.length === online.length &&
    online.length > 0;
  if (allReady) return { label: "Start now", endpoint: "start", disabled: false };
  if (room.players.length >= minPlayers)
    return { label: "Force start", endpoint: "force-start", disabled: false };
  return { label: `Need ${minPlayers} players`, endpoint: "force-start", disabled: true };
}

export default function HostPhoneLobbyView({ room, code, onRoomUpdate }: Props) {
  const navigate = useNavigate();
  const clearAccount = useAuthStore((s) => s.clearAccount);
  const { config } = useConfig();
  const [tab, setTab] = useState<"room" | "player">("room");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [readyBusy, setReadyBusy] = useState(false);

  const launch = launchState(room);
  const online = room.players.filter((p) => p.online !== false);
  const ready = online.filter((p) => p.ready);

  const identity = loadPlayerIdentity();
  const currentPlayer = identity ? room.players.find((p) => p.id === identity.playerId) : undefined;
  const hasJoined = Boolean(currentPlayer);


  const countdownEndsAt = (room as unknown as { launchCountdown?: { endsAt?: number } }).launchCountdown?.endsAt;
  const countdownSecs = countdownEndsAt ? Math.max(0, Math.ceil((countdownEndsAt - Date.now()) / 1000)) : 0;
  const countdownActive = countdownSecs > 0;
  const isReady = Boolean(currentPlayer?.ready);

  const ringColor = !currentPlayer || currentPlayer.online === false
    ? "#8f99a6"
    : currentPlayer.ready
    ? "#78d45e"
    : "#f4b04a";

  async function post(endpoint: string) {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/rooms/${code}/${endpoint}`, { method: "POST" });
      if (res.ok) {
        const data = (await res.json()) as { room?: Room };
        if (data.room) onRoomUpdate(data.room);
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleSelectGame(gameId: string) {
    setPickerOpen(false);
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/rooms/${code}/select-game`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ gameId }),
      });
      if (res.ok) {
        const data = (await res.json()) as { room?: Room };
        if (data.room) onRoomUpdate(data.room);
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleToggleReady() {
    if (!identity?.playerId || readyBusy || countdownActive) return;
    setReadyBusy(true);
    try {
      const res = await fetch(`/api/rooms/${code}/players/${identity.playerId}/ready`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ready: !isReady }),
      });
      if (res.ok) {
        const data = (await res.json()) as { room?: Room };
        if (data.room) onRoomUpdate(data.room);
      }
    } finally {
      setReadyBusy(false);
    }
  }

  function handleLogout() {
    clearAccount();
    navigate("/");
  }

  const btnBase = [
    "w-full h-[48px] rounded-[8px] flex items-center justify-center gap-[8px]",
    "text-[14px] font-[700] transition-opacity disabled:opacity-50",
  ].join(" ");

  const tabBase = [
    "flex-1 h-[38px] flex items-center justify-center text-[13px] font-[700]",
    "rounded-[6px] transition-colors",
  ].join(" ");

  return (
    <div className="phone-wrap">
      {/* Phone header */}
      <header className="phone-topbar">
        <a
          href="/"
          className="flex items-center gap-[10px] text-[var(--ink)] font-[800] text-[16px] no-underline"
        >
          <span
            className="w-[36px] h-[36px] flex-none overflow-hidden rounded-[9px] [background:var(--brand-mark,#78d45e)_center/contain_no-repeat] text-transparent [text-indent:-999px]"
            aria-hidden="true"
          >
            J
          </span>
          Joyly Games
        </a>
        <button
          type="button"
          onClick={handleLogout}
          className="text-[12px] text-[var(--muted)] hover:text-[rgba(240,100,100,1)] transition-colors"
        >
          Log out
        </button>
      </header>

      <div className="phone-flow">
        {/* Tab bar */}
        <div className="flex gap-[4px] p-[4px] rounded-[8px] bg-[rgba(17,24,33,.6)] border border-white/[.08]">
          <button
            type="button"
            onClick={() => setTab("room")}
            className={`${tabBase} ${tab === "room" ? "bg-[rgba(255,255,255,.1)] text-[var(--ink)]" : "text-[var(--muted)] hover:text-[var(--ink)]"}`}
          >
            Room
          </button>
          <button
            type="button"
            onClick={() => setTab("player")}
            className={`${tabBase} ${tab === "player" ? "bg-[rgba(255,255,255,.1)] text-[var(--ink)]" : "text-[var(--muted)] hover:text-[var(--ink)]"}`}
          >
            Player
          </button>
        </div>

        {tab === "room" ? (
          <>
            {/* Room info card */}
            <section className="phone-card grid gap-[10px]">
              <span className="block text-[var(--green)] text-[11px] font-[950] tracking-[.08em] uppercase">
                Room view
              </span>
              <h1 className="text-[var(--ink)] text-[22px] font-[800] m-0">
                {room.selectedGame?.title ?? "Joyly Room"}
              </h1>
              <div className="flex gap-[16px] text-[13px] text-[var(--muted)]">
                <div>
                  <span>Room </span>
                  <strong className="text-[var(--ink)] font-[800] tracking-[2px]">{room.code}</strong>
                </div>
                <div>
                  <strong className="text-[var(--ink)]">{ready.length}/{online.length}</strong>
                  <span> ready</span>
                </div>
              </div>
              <p className="text-[var(--muted)] text-[13px] m-0">
                {room.status === "playing"
                  ? "Game is live."
                  : launch.disabled
                  ? launch.label
                  : "Use your phone to control the room."}
              </p>
            </section>

            {/* Host controls */}
            {room.status !== "closed" && (
              <section className="phone-card grid gap-[10px]">
                <span className="block text-[var(--green)] text-[11px] font-[950] tracking-[.08em] uppercase">
                  Host controls
                </span>
                <strong className="text-[var(--ink)] text-[16px] font-[700] block">Control this room</strong>

                <div className="grid gap-[8px] mt-[4px]">
                  <button
                    type="button"
                    onClick={() => setPickerOpen(true)}
                    className={`${btnBase} border border-white/[.15] bg-[rgba(17,24,33,.6)] text-[var(--ink)]`}
                  >
                    <svg className="w-[16px] h-[16px] fill-none stroke-current [stroke-width:2]" viewBox="0 0 24 24">
                      <rect x="2" y="3" width="20" height="14" rx="2" />
                      <path d="M8 21h8M12 17v4" />
                    </svg>
                    Change game
                  </button>

                  {room.status === "waiting" && (
                    <button
                      type="button"
                      disabled={launch.disabled || busy}
                      onClick={() => post(launch.endpoint)}
                      className={`${btnBase} bg-[var(--brand,#78d45e)] text-[#0a0f14]`}
                    >
                      <svg className="w-[16px] h-[16px] fill-current" viewBox="0 0 24 24">
                        <polygon points="5,3 19,12 5,21" />
                      </svg>
                      {launch.label}
                    </button>
                  )}

                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => post("close")}
                    className={`${btnBase} border border-[rgba(240,100,100,.3)] bg-[rgba(240,100,100,.08)] text-[rgba(240,100,100,1)]`}
                  >
                    <svg className="w-[16px] h-[16px] fill-none stroke-current [stroke-width:2]" viewBox="0 0 24 24">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="8" x2="12" y2="12" />
                      <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                    Close room
                  </button>
                </div>
              </section>
            )}
          </>
        ) : room.status === "playing" && hasJoined ? (
          /* Player tab — game in progress, render game UI inline */
          room.selectedGame?.id === "cosmic-trivia" ? (
            <CosmicTriviaPhone room={room} code={code} embedded isHost />
          ) : (
            <section className="phone-card grid gap-[10px] text-center">
              <div className="text-[40px]" aria-hidden="true">🎮</div>
              <h2 className="text-[var(--ink)] text-[18px] font-[800] m-0">{room.selectedGame?.title ?? "Game"} is live</h2>
              <p className="text-[var(--muted)] text-[13px] m-0">Follow along on the big screen.</p>
            </section>
          )
        ) : hasJoined && currentPlayer ? (
          /* Player tab — waiting */
          <div className="phone-status">
            <div className="phone-status-avatar">
              <AvatarStack
                avatar={currentPlayer.avatar ?? identity?.avatar ?? null}
                size="hero"
                ringColor={ringColor}
                glowColor={currentPlayer.online === false ? "#8f99a6" : ringColor}
                greyscale={currentPlayer.online === false}
              />
            </div>
            <div className="phone-status-copy">
              <h1 className="text-[var(--ink)]">{currentPlayer.nickname}</h1>
              <span className={["ready-chip", isReady ? "is-ready" : ""].join(" ")}>
                {countdownActive ? `Starting in ${countdownSecs}s` : isReady ? "Ready" : "Getting ready"}
              </span>
            </div>
            <div className="phone-status-panel">
              {room.status === "waiting" && (
                <button
                  type="button"
                  disabled={readyBusy || countdownActive}
                  onClick={handleToggleReady}
                  className={`${btnBase} ${isReady ? "bg-[var(--brand,#78d45e)] text-[#0a0f14]" : "border border-white/[.2] bg-[rgba(17,24,33,.6)] text-[var(--ink)]"}`}
                >
                  <svg className="w-[16px] h-[16px] fill-none stroke-current [stroke-width:2.5]" viewBox="0 0 24 24">
                    <polyline points="20,6 9,17 4,12" />
                  </svg>
                  {countdownActive ? "Starting soon" : isReady ? "Ready" : "Tap when ready"}
                </button>
              )}
              <button
                type="button"
                className="w-full min-h-[38px] rounded-[8px] border border-white/[.1] text-[var(--muted)] text-[12px] font-[700] bg-transparent hover:text-[var(--ink)] hover:border-white/[.2] transition-colors cursor-pointer"
                onClick={() => navigate(`/join/${code}?edit=1`)}
              >
                Edit avatar
              </button>
              <div className="phone-mini">
                <span>{code}</span>
                <strong>{room.selectedGame?.title ?? "Lobby"}</strong>
              </div>
            </div>
          </div>
        ) : (
          /* Player tab — not yet joined */
          <section className="phone-card grid gap-[12px] text-center">
            <div className="text-[40px]">🎮</div>
            <h2 className="text-[var(--ink)] text-[18px] font-[800] m-0">Play as a player</h2>
            <p className="text-[var(--muted)] text-[13px] m-0">
              Join this room with a player nickname and avatar to play alongside your guests.
            </p>
            <button
              type="button"
              onClick={() => navigate(`/join/${code}`)}
              className={`${btnBase} bg-[var(--brand,#78d45e)] text-[#0a0f14] mt-[4px]`}
            >
              Join as player
            </button>
          </section>
        )}
      </div>

      <GamePickerModal
        open={pickerOpen}
        games={config.games}
        selectedGameId={room.selectedGame?.id ?? null}
        onSelect={handleSelectGame}
        onClose={() => setPickerOpen(false)}
      />
    </div>
  );
}
