interface TagProps {
  children: React.ReactNode;
  className?: string;
}

export default function Tag({ children, className = "" }: TagProps) {
  return (
    <span
      className={`inline-flex min-h-[26px] items-center rounded-[4px] px-[8px] text-[#081015] bg-[var(--green)] text-[12px] font-[900] ${className}`}
    >
      {children}
    </span>
  );
}
