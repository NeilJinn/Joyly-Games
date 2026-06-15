import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Button from "../ui/Button";
import Icon from "../ui/Icon";

export default function JoinRoomForm() {
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleJoin() {
    setError("");
    const digits = code.replace(/\D/g, "");
    if (digits.length !== 6) {
      setError("Enter a 6 digit code.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/rooms/${digits}`);
      if (!res.ok) throw new Error("not found");
      navigate(`/join/${digits}`);
    } catch {
      setError("Room not found.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      className={[
        "grid gap-[8px] p-[12px] rounded-[8px]",
        "border border-white/[.12] bg-[rgba(17,24,33,.92)] [box-shadow:var(--shadow)]",
        "min-h-[92px]",
      ].join(" ")}
      onSubmit={(e) => {
        e.preventDefault();
        void handleJoin();
      }}
    >
      <div className="grid gap-[6px] mb-[8px]">
        <span className="inline-flex items-center text-[var(--green)] text-[11px] font-[950] tracking-[.08em] uppercase">
          Join room
        </span>
      </div>

      <div className="grid [grid-template-columns:minmax(0,1fr)_auto] gap-[14px] items-center">
        <input
          name="code"
          inputMode="numeric"
          maxLength={6}
          placeholder="Room code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          className="w-full min-h-[40px] border-0 bg-[rgba(8,11,15,.66)] font-[800] rounded-[4px] px-[10px] text-[var(--ink)] relative z-[2] outline-none"
        />
        <Button
          variant="secondary"
          type="submit"
          disabled={loading}
          className="min-h-[40px]"
        >
          <Icon name="login" />
          <span>Join</span>
        </Button>
      </div>

      {error && (
        <span className="text-[var(--red)] text-[13px] [grid-column:1_/_-1]">
          {error}
        </span>
      )}
    </form>
  );
}
