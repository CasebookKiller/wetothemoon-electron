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
          'node:sqlite',
          // Playwright — всегда external (и в dev, и в prod):
          // playwright-extra делает require('playwright-core') в runtime.
          // Если его замбилдить — require не находит playwright-core.
          'playwright',
          'playwright-core',
          'playwright-extra',
          'puppeteer-extra',
          'puppeteer-extra-plugin',
          'puppeteer-extra-plugin-stealth',
          'puppeteer-extra-plugin-user-preferences',
          'puppeteer-extra-plugin-user-data-dir',
          // electron-native и native-модули
          'electron',
          'electron/main',
          'electron/common',
          'electron/renderer',
          // node built-ins
          /^node:/,
          // в dev дополнительно все node_modules
          ...(mode === "production" ? [] : [/node_modules/]),
        ],
      },
    },
  }),
);