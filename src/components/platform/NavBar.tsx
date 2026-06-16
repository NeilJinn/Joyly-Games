import { Link, useLocation, useNavigate } from "react-router-dom";
import Icon from "../ui/Icon";
import Button from "../ui/Button";
import { useAuthStore } from "../../stores/authStore";
import { useRoomStore } from "../../stores/roomStore";
import AccountMenu from "./AccountMenu";

const NAV_ITEMS = [
  { to: "/games", label: "Games" },
  { to: "/how-to-play", label: "How to Play" },
  { to: "/support", label: "Support" },
  { to: "/company", label: "Company" },
];

interface NavBarProps {
  floating?: boolean;
  onSignIn?: () => void;
  onPlay?: () => void;
}

export default function NavBar({
  floating = true,
  onSignIn,
  onPlay,
}: NavBarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { isSignedIn } = useAuthStore();
  const room = useRoomStore((s) => s.room);

  return (
    <header
      className={[
        "h-[52px] flex items-center justify-between px-[16px] md:px-[28px] overflow-visible",
        "border-b border-white/[.07] bg-[rgba(14,22,35,.82)] backdrop-blur-[16px] z-20",
        floating ? "fixed inset-x-0 top-0" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {/* Brand + marketing nav */}
      <div className="flex items-center gap-[24px] min-w-0">
        <Link
          to="/"
          className="flex items-center no-underline"
          aria-label="Home"
        >
          <span
            className="w-[75px] h-[75px] block flex-none overflow-hidden rounded-[19px] [background:var(--brand-mark)_center/contain_no-repeat] text-transparent [text-indent:-999px] [filter:drop-shadow(0_6px_8px_rgba(0,0,0,.32))]"
            aria-hidden="true"
          >
            J
          </span>
        </Link>

        <nav className="hidden md:flex items-center gap-[6px] flex-wrap" aria-label="Site">
          {NAV_ITEMS.map((item) => {
            const active = location.pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={[
                  "min-h-[40px] px-[14px] flex items-center rounded-full border transition-[color,background,border-color] duration-[180ms] no-underline",
                  active
                    ? "text-[var(--outline)] bg-[var(--sun)] border-[rgba(255,209,102,.8)]"
                    : "text-[var(--muted)] bg-transparent border-transparent hover:text-[var(--ink)] hover:bg-[rgba(255,248,232,.06)] hover:border-[rgba(255,248,232,.1)]",
                ]
                  .filter(Boolean)
                  .join(" ")}
                aria-current={active ? "page" : undefined}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Right-side actions */}
      <nav className="flex items-center gap-[10px]" aria-label="Account">
        {!isSignedIn ? (
          <>
            <Button variant="secondary" onClick={onSignIn}>
              <Icon name="login" />
              <span className="hidden sm:inline">Sign in</span>
            </Button>
            <Button variant="primary" onClick={onPlay}>
              <Icon name="play" />
              <span className="hidden sm:inline">Play</span>
            </Button>
          </>
        ) : (
          <>
            {room ? (
              <button
                type="button"
                onClick={() => navigate(`/room/${room.code}`)}
                className={[
                  "flex items-center gap-[8px] h-[36px] px-[12px] rounded-full",
                  "border border-white/[.15] bg-[rgba(17,24,33,.8)]",
                  "text-[var(--ink)] text-[13px] font-[700] cursor-pointer",
                  "hover:border-white/[.3] transition-colors",
                ].join(" ")}
              >
                <svg className="w-[14px] h-[14px] fill-none stroke-current [stroke-width:2] flex-none" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                  <polyline points="9,22 9,12 15,12 15,22" />
                </svg>
                <span>Room {room.code}</span>
                <strong className="text-[var(--green)]">{room.selectedGame?.title ?? "Lobby"}</strong>
              </button>
            ) : onPlay && (
              <Button variant="secondary" onClick={onPlay}>
                <Icon name="play" />
                <span>Play</span>
              </Button>
            )}
            <AccountMenu />
          </>
        )}
      </nav>
    </header>
  );
}
