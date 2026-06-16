import { useState, useRef, useEffect } from "react";
import Icon from "../ui/Icon";
import { useAuthStore } from "../../stores/authStore";
import { useRoomStore } from "../../stores/roomStore";

function remainingTime(expiresAt?: number): string {
  if (!expiresAt || expiresAt <= Date.now()) return "--";
  const minutes = Math.max(0, Math.ceil((expiresAt - Date.now()) / 60_000));
  if (minutes >= 60) return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
  return `${minutes}m`;
}

export default function AccountMenu() {
  const account = useAuthStore((s) => s.account);
  const entitlement = useAuthStore((s) => s.entitlement);
  const clearAccount = useAuthStore((s) => s.clearAccount);
  const clearRoom = useRoomStore((s) => s.clearRoom);
  const room = useRoomStore((s) => s.room);
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  if (!account) return null;

  const timeLeft = remainingTime(entitlement.timePassExpiresAt);

  function handleLogout() {
    clearAccount();
    clearRoom();
    window.location.href = "/";
  }

  async function handleCloseRoom() {
    if (!room || closing) return;
    setClosing(true);
    try {
      await fetch(`/api/rooms/${room.code}/close`, { method: "POST" });
      clearRoom();
      window.location.href = "/";
    } finally {
      setClosing(false);
    }
  }

  const rowBase = [
    "flex items-center gap-[10px] w-full min-h-[46px] px-[14px]",
    "rounded-[6px] text-[14px] font-[700]",
    "border-0 bg-transparent cursor-pointer hover:bg-white/[.06] transition-colors",
  ].join(" ");

  return (
    <div ref={ref} className="relative">
      {/* Trigger chip */}
      <button
        className={[
          "inline-flex items-center gap-[8px] h-[40px] px-[14px]",
          "rounded-[6px] border border-white/[.12] bg-[rgba(17,24,33,.9)]",
          "text-[14px] cursor-pointer",
          open ? "border-white/[.25]" : "",
        ].join(" ")}
        type="button"
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <Icon name="users" />
        <span className="text-[var(--muted)]">Host</span>
        <strong className="text-[var(--ink)]">{account.displayName}</strong>
      </button>

      {/* Popover */}
      {open && (
        <div
          className={[
            "absolute top-[calc(100%+8px)] right-0 z-50",
            "w-[310px] rounded-[8px] border border-white/[.12] bg-[rgba(17,24,33,.98)]",
            "p-[8px] [box-shadow:var(--shadow)]",
          ].join(" ")}
        >
          {/* Head */}
          <div className="px-[14px] pt-[12px] pb-[8px] border-b border-white/[.08]">
            <strong className="block text-[var(--ink)] text-[16px] font-[800]">
              {account.displayName}
            </strong>
            <span className="text-[var(--muted)] text-[13px]">{account.email}</span>
          </div>

          {/* Stats */}
          <div className="grid [grid-template-columns:repeat(3,1fr)] px-[14px] py-[12px] border-b border-white/[.08]">
            {[
              { label: "Points", value: String(entitlement.points) },
              { label: "Time", value: timeLeft },
              { label: "Balance", value: "–" },
            ].map(({ label, value }) => (
              <div key={label} className="flex flex-col gap-[4px]">
                <span className="text-[var(--muted)] text-[11px] font-[700] tracking-[.06em] uppercase">
                  {label}
                </span>
                <strong className="text-[var(--ink)] text-[18px] font-[800]">
                  {value}
                </strong>
              </div>
            ))}
          </div>

          {/* Menu rows */}
          <button className={`${rowBase} text-[var(--ink)]`} type="button">
            <Icon name="settings" />
            <span>User settings</span>
          </button>

          {room && (
            <>
              <button className={`${rowBase} text-[var(--ink)]`} type="button">
                <Icon name="door" />
                <span>Room {room.code} · {room.status}</span>
              </button>
              <button
                className={`${rowBase} text-[#f67272] disabled:opacity-50`}
                type="button"
                disabled={closing}
                onClick={handleCloseRoom}
              >
                <Icon name="power" />
                <span>{closing ? "Closing…" : "Close room"}</span>
              </button>
            </>
          )}

          <button
            className={`${rowBase} text-[#f67272]`}
            type="button"
            onClick={handleLogout}
          >
            <Icon name="logout" />
            <span>Log out</span>
          </button>
        </div>
      )}
    </div>
  );
}
