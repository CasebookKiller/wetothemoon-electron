import path from 'path';
import { defineConfig } from "vite";

// https://vitejs.dev/config
export default defineConfig(({ mode }) => ({
  build: {
    sourcemap: mode === "development",
    outDir: path.resolve(__dirname, 'dist/main'), // путь вывода для main-процесса
    rollupOptions: {
      external: mode === "production" ? [] : [/node_modules/],
    },
  },
}));


