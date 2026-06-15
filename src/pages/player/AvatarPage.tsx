import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import PhoneLayout from "../../components/player/PhoneLayout";
import Button from "../../components/ui/Button";
import Icon from "../../components/ui/Icon";
import { usePlayerStore } from "../../stores/playerStore";
import { useRoomStore } from "../../stores/roomStore";
import {
  loadPlayerIdentity,
  makePlayerId,
  savePlayerIdentity,
} from "../../types/player";
import type { Room } from "../../types/room";

const COLORS = [
  "#78d45e", "#5eb8d4", "#f4b04a", "#e05eb4",
  "#5e82f4", "#f45e5e", "#5ef4d4", "#d4d45e",
];

export default function AvatarPage() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const setPlayer = usePlayerStore((s) => s.setPlayer);
  const setRoom = useRoomStore((s) => s.setRoom);

  const [room, setLocalRoom] = useState<Room | null>(null);
  const [roomError, setRoomError] = useState("");
  const [nickname, setNickname] = useState("");
  const [selectedColor, setSelectedColor] = useState(COLORS[0]);
  const [submitting, setSubmitting] = useState(false);
  const [joinError, setJoinError] = useState("");

  useEffect(() => {
    if (!code) return;
    (async () => {
      try {
        const res = await fetch(`/api/rooms/${code}`);
        const data = (await res.json()) as { room: Room };
        if (!data.room) { setRoomError("Room not found."); return; }
        if (data.room.status === "closed") { setRoomError("This room is closed."); return; }
        setLocalRoom(data.room);
        setRoom(data.room);

        const identity = loadPlayerIdentity();
        if (identity?.playerId && identity.nickname) {
          const joinRes = await fetch(`/api/rooms/${code}/join`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ playerId: identity.playerId, nickname: identity.nickname, avatar: null }),
          });
          if (joinRes.ok) {
            const joinData = (await joinRes.json()) as { player: { id: string; nickname: string }; room: Room };
            setRoom(joinData.room);
            setPlayer({ playerId: joinData.player.id, nickname: joinData.player.nickname, avatar: null, color: identity.color });
            navigate(`/waiting/${code}`, { replace: true });
            return;
          }
        }
        if (identity?.nickname) setNickname(identity.nickname);
        if (identity?.color) setSelectedColor(identity.color);
      } catch {
        setRoomError("Could not load room. Check your connection.");
      }
    })();
  }, [code]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!code || !room) return;
    const trimmed = nickname.trim();
    if (!trimmed) { setJoinError("Enter a nickname"); return; }
    setSubmitting(true);
    setJoinError("");
    try {
      const playerId = loadPlayerIdentity()?.playerId ?? makePlayerId();
      const res = await fetch(`/api/rooms/${code}/join`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ playerId, nickname: trimmed, avatar: null }),
      });
      if (!res.ok) {
        const err = (await res.json()) as { error?: string };
        throw new Error(err.error ?? "Failed to join");
      }
      const data = (await res.json()) as { player: { id: string; nickname: string }; room: Room };
      savePlayerIdentity({ playerId: data.player.id, nickname: data.player.nickname, avatar: null, color: selectedColor });
      setPlayer({ playerId: data.player.id, nickname: data.player.nickname, avatar: null, color: selectedColor });
      setRoom(data.room);
      navigate(`/waiting/${code}`);
    } catch (err) {
      setJoinError(err instanceof Error ? err.message : "Failed to join");
    } finally {
      setSubmitting(false);
    }
  }

  if (roomError) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
        <PhoneLayout>
          <div className="phone-card grid gap-[12px] text-center">
            <div className="text-[48px]">✕</div>
            <h1 className="text-[var(--ink)] text-[22px] font-[800] m-0">
              {roomError.includes("closed") ? "Room closed" : "Room not found"}
            </h1>
            <p className="text-[var(--muted)] text-[14px] m-0">Ask the host for a new code.</p>
          </div>
        </PhoneLayout>
      </motion.div>
    );
  }

  if (!room) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
        <PhoneLayout>
          <div className="phone-card text-center">
            <p className="text-[var(--muted)] text-[14px] m-0">Loading room…</p>
          </div>
        </PhoneLayout>
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
      <PhoneLayout>
        <form className="phone-card grid gap-[18px]" onSubmit={handleSubmit}>
          <div>
            <h1 className="text-[var(--ink)] text-[22px] font-[800] m-0 mb-[6px]">
              Join {code}
            </h1>
            <p className="text-[var(--muted)] text-[14px] m-0">
              Choose your player name for this room.
            </p>
          </div>

          <label className="grid gap-[8px]">
            <span className="text-[#c8d4de] text-[13px] font-[700]">Nickname</span>
            <input
              className={[
                "w-full min-h-[48px] px-[14px] rounded-[6px]",
                "border border-white/[.12] bg-[rgba(23,29,37,.74)]",
                "text-[var(--ink)] text-[16px]",
                "focus:outline-none focus:border-[rgba(120,212,94,.7)]",
              ].join(" ")}
              name="nickname"
              maxLength={24}
              placeholder="Alex"
              value={nickname}
              onChange={(e) => { setNickname(e.target.value); setJoinError(""); }}
              autoFocus
              autoComplete="nickname"
            />
          </label>

          <div className="grid gap-[8px]">
            <span className="text-[#c8d4de] text-[13px] font-[700]">Pick a color</span>
            <div className="flex flex-wrap gap-[10px]">
              {COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  className={[
                    "w-[36px] h-[36px] rounded-full border-[3px] cursor-pointer transition-[box-shadow]",
                    selectedColor === color
                      ? "border-white [box-shadow:0_0_0_2px_rgba(255,255,255,.4)]"
                      : "border-transparent",
                  ].join(" ")}
                  style={{ background: color }}
                  onClick={() => setSelectedColor(color)}
                  aria-label={`Color ${color}`}
                />
              ))}
            </div>
          </div>

          {joinError && (
            <p className="text-[#f67272] text-[13px] m-0">{joinError}</p>
          )}

          <Button variant="primary" className="w-full" type="submit" disabled={submitting}>
            <Icon name="login" />
            <span>{submitting ? "Joining…" : "Join room"}</span>
          </Button>
        </form>
      </PhoneLayout>
    </motion.div>
  );
}
