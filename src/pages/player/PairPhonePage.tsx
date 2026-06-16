import { useState, type FormEvent } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import PhoneLayout from "../../components/player/PhoneLayout";
import { useAuthStore } from "../../stores/authStore";
import { useRoomStore } from "../../stores/roomStore";
import type { Room } from "../../types/room";

export default function PairPhonePage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const setAccount = useAuthStore((s) => s.setAccount);
  const setRoom = useRoomStore((s) => s.setRoom);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!token || !name.trim() || !email.trim() || submitting) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(`/api/pairings/${encodeURIComponent(token)}/claim`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: name.trim(), email: email.trim() }),
      });
      const data = (await res.json()) as { account?: { name: string; email: string }; room?: Room; error?: string };
      if (!res.ok || !data.account) {
        setError(data.error ?? "Pairing failed. The code may have expired.");
        return;
      }
      setAccount({ displayName: data.account.name, email: data.account.email });
      if (data.room) {
        setRoom(data.room);
        navigate(`/room/${data.room.code}`, { replace: true });
      } else {
        navigate("/room/setup", { replace: true });
      }
    } catch {
      setError("Could not connect. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const inputClass = [
    "w-full h-[44px] px-[14px] rounded-[8px] text-[14px] text-[var(--ink)]",
    "bg-[rgba(17,24,33,.8)] border border-white/[.15]",
    "focus:outline-none focus:border-[var(--green)] transition-colors",
    "placeholder:text-[var(--muted)]",
  ].join(" ");

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
      <PhoneLayout>
        <form className="phone-card grid gap-[14px]" onSubmit={handleSubmit}>
          <div className="grid gap-[4px]">
            <h1 className="text-[var(--ink)] text-[20px] font-[800] m-0">Pair host phone</h1>
            <p className="text-[var(--muted)] text-[13px] m-0">
              Sign in here. The big screen will follow this host account.
            </p>
          </div>

          <div className="grid gap-[10px]">
            <input
              className={inputClass}
              type="text"
              placeholder="Display name"
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
            <input
              className={inputClass}
              type="email"
              placeholder="Email address"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          {error && (
            <p className="text-[rgba(240,100,100,1)] text-[13px] m-0">{error}</p>
          )}

          <button
            type="submit"
            disabled={submitting || !name.trim() || !email.trim()}
            className="w-full h-[44px] rounded-[8px] bg-[var(--brand,#78d45e)] text-[#0a0f14] text-[14px] font-[700] hover:opacity-90 transition-opacity disabled:opacity-50 cursor-pointer"
          >
            {submitting ? "Pairing…" : "Continue"}
          </button>
        </form>
      </PhoneLayout>
    </motion.div>
  );
}
