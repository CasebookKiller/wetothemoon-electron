import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  root: path.resolve(__dirname, 'src/renderer/llama-window'), // Корень — папка с index.html для llama-окна
  envDir: path.resolve(__dirname), // Указываем, где искать .env-файлы (в корне проекта)
  plugins: [
    {
      name: 'send-llama-window-port',
      configureServer(server) {
        server.httpServer?.once('listening', () => {
          const address = server.httpServer?.address();
          const port = typeof address === 'object' ? address?.port : 0;
          console.log('Llama window port:', port);
          process.send?.({
            type: 'LLAMA_WINDOW_READY',
            data: {
              port,
              url: `http://localhost:${port}`
            }
          });
        });
      }
    }
  ],
  server: {
    port: 5575
  },
  build: {
    outDir: path.resolve(__dirname, 'dist/llama'), // Отдельная папка сборки для llama-окна
    emptyOutDir: true,
    rollupOptions: {
      input: path.resolve(__dirname, 'src/renderer/llama-window/index.html') // Явная точка входа
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@root': path.resolve(__dirname, '../src')
    }
  }
});