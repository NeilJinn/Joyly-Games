import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "icon";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant: Variant;
  children: ReactNode;
}

const BASE =
  "min-h-[44px] rounded-[6px] px-[16px] font-[950] tracking-[.01em] transition-[transform,box-shadow,border-color] duration-[140ms] ease-[ease] hover:-translate-y-[1px] active:translate-y-0 cursor-pointer border-0";

const VARIANTS: Record<Variant, string> = {
  primary:
    "inline-flex items-center justify-center gap-[8px] text-[var(--outline)] border border-[rgba(255,248,232,.36)] [background:linear-gradient(135deg,rgba(255,248,232,.36),transparent_36%),linear-gradient(135deg,var(--sun),var(--green)_54%,var(--cyan))] [box-shadow:var(--paper-shadow),inset_0_0_0_2px_rgba(9,18,28,.16)] disabled:opacity-[.48] disabled:cursor-not-allowed",
  secondary:
    "inline-flex items-center justify-center gap-[8px] text-[var(--ink)] [background:linear-gradient(135deg,rgba(255,248,232,.08),transparent_42%),#25324b] border border-[var(--line)] [box-shadow:0_4px_0_rgba(3,8,14,.24)]",
  icon: "w-[44px] p-0 grid place-items-center text-[var(--ink)] [background:linear-gradient(135deg,rgba(255,248,232,.1),transparent_42%),var(--panel-2)] border border-[var(--line)] [box-shadow:0_4px_0_rgba(3,8,14,.24)]",
};

export default function Button({
  variant,
  className = "",
  children,
  ...props
}: ButtonProps) {
  return (
    <button className={`${BASE} ${VARIANTS[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
}
