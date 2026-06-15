import { useState } from "react";
import Button from "../../ui/Button";

interface PreferencesPickerProps {
  options: { categories: string[]; tags: string[] };
  onSubmit: (prefs: { categories: string[]; tags: string[] }) => void;
  submitting: boolean;
}

function toggle<T>(arr: T[], item: T, max: number): T[] {
  return arr.includes(item) ? arr.filter((x) => x !== item) : arr.length < max ? [...arr, item] : arr;
}

export default function PreferencesPicker({ options, onSubmit, submitting }: PreferencesPickerProps) {
  const [cats, setCats] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);

  return (
    <div className="grid gap-[20px]">
      <div>
        <p className="text-[#c8d4de] text-[13px] font-[700] m-0 mb-[10px]">
          Categories <span className="text-[var(--muted)] font-[400]">(pick up to 3)</span>
        </p>
        <div className="flex flex-wrap gap-[8px]">
          {options.categories.map((cat) => {
            const active = cats.includes(cat);
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setCats(toggle(cats, cat, 3))}
                className={[
                  "px-[12px] h-[34px] rounded-full text-[13px] font-[600] border transition-colors",
                  active
                    ? "border-[#78d45e] bg-[rgba(120,212,94,.15)] text-[#78d45e]"
                    : "border-white/[.15] bg-transparent text-[var(--muted)] hover:border-white/[.3]",
                ].join(" ")}
              >
                {cat}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <p className="text-[#c8d4de] text-[13px] font-[700] m-0 mb-[10px]">
          Keywords <span className="text-[var(--muted)] font-[400]">(pick up to 5)</span>
        </p>
        <div className="flex flex-wrap gap-[8px]">
          {options.tags.map((tag) => {
            const active = tags.includes(tag);
            return (
              <button
                key={tag}
                type="button"
                onClick={() => setTags(toggle(tags, tag, 5))}
                className={[
                  "px-[12px] h-[34px] rounded-full text-[13px] font-[600] border transition-colors",
                  active
                    ? "border-[var(--cyan)] bg-[rgba(94,184,212,.15)] text-[var(--cyan)]"
                    : "border-white/[.15] bg-transparent text-[var(--muted)] hover:border-white/[.3]",
                ].join(" ")}
              >
                {tag}
              </button>
            );
          })}
        </div>
      </div>

      <Button
        variant="primary"
        className="w-full"
        disabled={submitting}
        onClick={() => onSubmit({ categories: cats, tags })}
      >
        <span>{submitting ? "Locking in…" : "Lock in choices"}</span>
      </Button>
    </div>
  );
}
