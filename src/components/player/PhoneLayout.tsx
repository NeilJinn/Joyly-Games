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
            className="w-[36px] h-[36px] flex-none overflow-hidden rounded-[9px] [background:var(--brand-mark,#78d45e)_center/contain_no-repeat] text-transparent [text-indent:-999px] [filter:drop-shadow(0_3px_4px_rgba(0,0,0,.28))]"
            aria-hidden="true"
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
