import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/__tests__/setup.ts"],
    include: [
      "src/__tests__/**/*.test.{ts,tsx}",
      "src/game-runtime/**/__tests__/**/*.test.{ts,tsx}",
      "games/werewolf/**/__tests__/**/*.test.{ts,tsx}",
    ],
  },
});
