import { useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import PhoneLayout from "../../components/player/PhoneLayout";
import { useSSE } from "../../hooks/useSSE";
import { useRoomStore } from "../../stores/roomStore";
import { useAuthStore } from "../../stores/authStore";
import CosmicTriviaPhone from "../../../games/cosmic-trivia/client/PhonePage";

export default function InRoomPage() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const room = useRoomStore((s) => s.room);
  const setRoom = useRoomStore((s) => s.setRoom);
  const isSignedIn = useAuthStore((s) => s.isSignedIn);

  useEffect(() => {
    if (!code || room?.code === code) return;
    fetch(`/api/rooms/${code}`)
      .then((r) => r.json())
      .then((data: { room: typeof room }) => { if (data.room) setRoom(data.room); })
      .catch(() => {});
  }, [code, room?.code, setRoom]);

  useSSE(code ?? null);

  useEffect(() => {
    if (room?.status === "waiting")
      navigate(isSignedIn ? `/room/${code}` : `/waiting/${code}`, { replace: true });
    if (room?.status === "closed") navigate("/", { replace: true });
  }, [room?.status, code, navigate, isSignedIn]);

  if (!room || !code) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
        <PhoneLayout>
          <div className="phone-card text-center">
            <p className="text-[var(--muted)] text-[14px] m-0">Loading…</p>
          </div>
        </PhoneLayout>
      </motion.div>
    );
  }

  if (room.selectedGame?.id === "cosmic-trivia") {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
        <CosmicTriviaPhone room={room} code={code} />
      </motion.div>
    );
  }

  // Fallback for other games
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
      <PhoneLayout>
        <div className="phone-card grid gap-[12px] text-center">
          <div className="text-[48px]" aria-hidden="true">🎮</div>
          <h1 className="text-[var(--ink)] text-[22px] font-[800] m-0">
            {room.selectedGame?.title ?? "Game"} is live
          </h1>
          <p className="text-[var(--muted)] text-[14px] m-0">Follow along on the big screen.</p>
        </div>
      </PhoneLayout>
    </motion.div>
  );
}
