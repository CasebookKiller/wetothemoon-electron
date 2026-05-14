import path from "path";
import { viteStaticCopy } from 'vite-plugin-static-copy';
import { defineConfig } from "vite";

// https://vitejs.dev/config
export default defineConfig(
  ({ mode }: { mode: "development" | "production" }) => ({
    plugins: [
      viteStaticCopy({
        targets: [
          {
            src: 'proto',        // копирует папку proto целиком
            dest: '.',           // в корень dist/main, получится dist/main/proto
          },
        ],
      }),
    ],
    build: {
      sourcemap: mode === "development",
      outDir: path.resolve(__dirname, "dist/main"),
      rollupOptions: {
        external: mode === "production" ? [] : [/node_modules/],
      },
    },
  }),
);