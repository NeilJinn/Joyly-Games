import { useState, useEffect } from "react";

export function useCountdown(endsAt: number | null): number {
  const [secs, setSecs] = useState(() =>
    endsAt ? Math.max(0, Math.ceil((endsAt - Date.now()) / 1000)) : 0
  );
  useEffect(() => {
    if (!endsAt) { setSecs(0); return; }
    const tick = () => setSecs(Math.max(0, Math.ceil((endsAt - Date.now()) / 1000)));
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [endsAt]);
  return secs;
}
