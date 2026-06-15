import { useEffect, useState } from "react";
import type { AppConfig } from "../types/config";

const DEFAULT_CONFIG: AppConfig = {
  games: [],
  localJoinBase: window.location.origin,
  tools: { jmsStudio: false, voiceLibrary: false },
};

export function useConfig() {
  const [config, setConfig] = useState<AppConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/config")
      .then((r) => r.json())
      .then((data: AppConfig) => setConfig(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return { config, loading };
}
