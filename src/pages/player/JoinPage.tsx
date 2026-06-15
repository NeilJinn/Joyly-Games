import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import PhoneLayout from "../../components/player/PhoneLayout";
import Button from "../../components/ui/Button";
import Icon from "../../components/ui/Icon";

export default function JoinPage() {
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const cleaned = code.replace(/\D/g, "");
    if (cleaned.length !== 6) {
      setError("Enter the 6-digit room code");
      return;
    }
    navigate(`/join/${cleaned}`);
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
    >
      <PhoneLayout>
        <form className="phone-card grid gap-[16px]" onSubmit={handleSubmit}>
          <h1 className="text-[var(--ink)] text-[24px] font-[800] m-0">
            Join a room
          </h1>
          <p className="text-[var(--muted)] text-[14px] m-0">
            Enter the 6-digit code shown on the host screen.
          </p>
          <label className="grid gap-[8px]">
            <span className="text-[#c8d4de] text-[13px] font-[700]">Room code</span>
            <input
              className={[
                "w-full min-h-[48px] px-[14px] rounded-[6px]",
                "border border-white/[.12] bg-[rgba(23,29,37,.74)]",
                "text-[var(--ink)] text-[24px] font-[800] tracking-[.12em] text-center",
                "focus:outline-none focus:border-[rgba(120,212,94,.7)]",
              ].join(" ")}
              inputMode="numeric"
              maxLength={6}
              placeholder="000000"
              value={code}
              onChange={(e) => {
                setCode(e.target.value.replace(/\D/g, "").slice(0, 6));
                setError("");
              }}
              autoFocus
            />
          </label>
          {error && (
            <p className="text-[#f67272] text-[13px] m-0">{error}</p>
          )}
          <Button variant="primary" className="w-full" type="submit">
            <Icon name="login" />
            <span>Join room</span>
          </Button>
        </form>
      </PhoneLayout>
    </motion.div>
  );
}
