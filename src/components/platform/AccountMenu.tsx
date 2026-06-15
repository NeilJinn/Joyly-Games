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

  if (!account) return null;

  const timeLeft = remainingTime(entitlement.timePassExpiresAt);

  function handleLogout() {
    clearAccount();
    clearRoom();
    window.location.href = "/";
  }

  return (
    <div
      className={[
        "relative",
        "[&:hover_.account-popover]:opacity-100 [&:hover_.account-popover]:pointer-events-auto [&:hover_.account-popover]:translate-y-0",
        "[&:focus-within_.account-popover]:opacity-100 [&:focus-within_.account-popover]:pointer-events-auto [&:focus-within_.account-popover]:translate-y-0",
      ].join(" ")}
    >
      {/* Trigger chip */}
      <button
        className={[
          "inline-flex items-center gap-[8px] h-[40px] px-[14px]",
          "rounded-[6px] border border-white/[.12] bg-[rgba(17,24,33,.9)]",
          "text-[14px] cursor-pointer",
        ].join(" ")}
        type="button"
        aria-haspopup="true"
      >
        <Icon name="users" />
        <span className="text-[var(--muted)]">Host</span>
        <strong className="text-[var(--ink)]">{account.displayName}</strong>
      </button>

      {/* Popover */}
      <div
        className={[
          "account-popover absolute top-[calc(100%+8px)] right-0 z-50",
          "w-[310px] rounded-[8px] border border-white/[.12] bg-[rgba(17,24,33,.98)]",
          "p-[8px] [box-shadow:var(--shadow)]",
          "opacity-0 pointer-events-none translate-y-[-4px]",
          "transition-[opacity,transform] duration-[180ms]",
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
        <button
          className={[
            "flex items-center gap-[10px] w-full min-h-[46px] px-[14px]",
            "rounded-[6px] text-[var(--ink)] text-[14px] font-[700]",
            "border-0 bg-transparent cursor-pointer hover:bg-white/[.06] transition-colors",
          ].join(" ")}
          type="button"
        >
          <Icon name="settings" />
          <span>User settings</span>
        </button>

        {room && (
          <button
            className={[
              "flex items-center gap-[10px] w-full min-h-[46px] px-[14px]",
              "rounded-[6px] text-[var(--ink)] text-[14px] font-[700]",
              "border-0 bg-transparent cursor-pointer hover:bg-white/[.06] transition-colors",
            ].join(" ")}
            type="button"
          >
            <Icon name="door" />
            <span>Room {room.code} · {room.status}</span>
          </button>
        )}

        <button
          className={[
            "flex items-center gap-[10px] w-full min-h-[46px] px-[14px]",
            "rounded-[6px] text-[#f67272] text-[14px] font-[700]",
            "border-0 bg-transparent cursor-pointer hover:bg-white/[.06] transition-colors",
          ].join(" ")}
          type="button"
          onClick={handleLogout}
        >
          <Icon name="logout" />
          <span>Log out</span>
        </button>
      </div>
    </div>
  );
}
