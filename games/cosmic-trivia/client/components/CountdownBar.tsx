import { useCountdown } from "../../../hooks/useCountdown";

interface CountdownBarProps {
  endsAt: number | null;
  totalSecs: number;
}

export default function CountdownBar({ endsAt, totalSecs }: CountdownBarProps) {
  const secs = useCountdown(endsAt);
  const pct = totalSecs > 0 ? Math.min(100, (secs / totalSecs) * 100) : 0;
  const isDanger = secs <= 5;
  const isWarning = secs <= 10 && !isDanger;

  return (
    <div className="flex items-center gap-[12px]">
      <div className="flex-1 h-[6px] rounded-full bg-white/[.08] overflow-hidden">
        <div
          className={[
            "h-full rounded-full transition-all duration-500",
            isDanger ? "bg-[#f67272]" : isWarning ? "bg-[var(--sun)]" : "bg-[var(--green)]",
          ].join(" ")}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className={[
        "text-[20px] font-[800] w-[40px] text-right tabular-nums",
        isDanger ? "text-[#f67272]" : isWarning ? "text-[var(--sun)]" : "text-[var(--muted)]",
      ].join(" ")}>
        {secs}s
      </span>
    </div>
  );
}
