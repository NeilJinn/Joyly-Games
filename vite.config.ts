import path from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@platform': path.resolve(__dirname, 'src/components/platform'),
      '@room': path.resolve(__dirname, 'src/pages/player'),
      '@types': path.resolve(__dirname, 'src/types'),
      '@ui': path.resolve(__dirname, 'src/components/ui'),
      '@stores': path.resolve(__dirname, 'src/stores'),
      '@hooks': path.resolve(__dirname, 'src/hooks'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:4173",
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: "dist",
  },
});
