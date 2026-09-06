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
            src: 'proto',
            dest: '.',
          },
        ],
      }),
    ],
    build: {
      sourcemap: mode === "development",
      outDir: path.resolve(__dirname, "dist/main"),
      rollupOptions: {
        external: [
          'node:sqlite',                                  // всегда внешний
          ...(mode === "production" ? [] : [/node_modules/]), // в dev не бандлим node_modules
        ],
      },
    },
  }),
);