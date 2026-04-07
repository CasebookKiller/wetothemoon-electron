//import { defineConfig } from "vite";

// https://vitejs.dev/config
//export default defineConfig({});
import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  root: path.resolve(__dirname, 'src/renderer/main-window/'), // Корень — папка с index.html
  envDir: path.resolve(__dirname), // указываем, где искать .env-файлы
  plugins: [
    {
      name: 'send-main-window-port',
      configureServer(server) {
        server.httpServer?.once('listening', () => {
          const address = server.httpServer?.address();
          const port = typeof address === 'object' ? address?.port : 0;
          console.log('Main window port:', port);
          process.send?.({
            type: 'MAIN_WINDOW_READY',
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
    port: 5574
  },
  build: {
    outDir: path.resolve(__dirname, 'dist/renderer'), // 
    emptyOutDir: true, // Очищать папку перед сборкой
    rollupOptions: {
      input: path.resolve(__dirname, 'src/renderer/main-window/index.html') // Явная точка входа
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@root': path.resolve(__dirname, '../src')
    }
  }
});
