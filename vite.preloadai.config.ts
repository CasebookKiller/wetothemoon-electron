import path from "path";
import { defineConfig } from "vite";

// https://vitejs.dev/config
export default defineConfig({
  build: {
    outDir: path.resolve(__dirname, "dist/main"), // путь вывода для preload-процесса
  },
});


/*
// ещё вариант
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    lib: {
      entry: 'src/preload.ts',
      formats: ['cjs'],
    },
    outDir: 'dist', // папка вывода
    emptyOutDir: false,
  },
  resolve: {
    extensions: ['.ts', '.js', '.json']
  }
});


*/