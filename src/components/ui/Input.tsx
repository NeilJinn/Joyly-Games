import type { InputHTMLAttributes } from "react";

export default function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full min-h-[46px] px-[14px] text-[var(--ink)] bg-[#0f151d] border border-[var(--line)] rounded-[6px] outline-none [user-select:text] focus:border-[var(--cyan)] ${props.className ?? ""}`}
    />
  );
}
