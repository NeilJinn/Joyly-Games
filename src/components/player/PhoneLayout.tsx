import type { ReactNode } from "react";
import { Link } from "react-router-dom";

interface PhoneLayoutProps {
  children: ReactNode;
}

export default function PhoneLayout({ children }: PhoneLayoutProps) {
  return (
    <div className="phone-wrap">
      <header className="phone-topbar">
        <Link
          to="/join"
          className="flex items-center gap-[10px] text-[var(--ink)] font-[800] text-[16px] no-underline"
          aria-label="Home"
        >
          <span
            className="w-[36px] h-[36px] flex-none overflow-hidden rounded-[9px]"
            aria-hidden="true"
            style={{
              background: "var(--brand-mark, #78d45e) center/contain no-repeat",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "white",
              fontWeight: 800,
              fontSize: 18,
            }}
          >
            J
          </span>
          Joyly Games
        </Link>
      </header>
      <div className="phone-flow">{children}</div>
    </div>
  );
}
