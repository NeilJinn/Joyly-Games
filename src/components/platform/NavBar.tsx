import { Link, useLocation } from "react-router-dom";
import Icon from "../ui/Icon";
import Button from "../ui/Button";
import { useAuthStore } from "../../stores/authStore";
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
  const { isSignedIn } = useAuthStore();

  return (
    <header
      className={[
        "h-[64px] flex items-center justify-between px-[16px] md:px-[28px]",
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
          className="flex items-center gap-[12px] text-[var(--ink)] font-[800] text-[18px] no-underline"
          aria-label="Home"
        >
          <span
            className="w-[42px] h-[42px] block flex-none overflow-hidden rounded-[11px] [background:var(--brand-mark)_center/contain_no-repeat] text-transparent [text-indent:-999px] [filter:drop-shadow(0_5px_5px_rgba(0,0,0,.28))]"
            aria-hidden="true"
          >
            J
          </span>
          Joyly Games
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
            {onPlay && (
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
