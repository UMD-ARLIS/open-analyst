import { reactRouter } from "@react-router/dev/vite";
import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  plugins: [reactRouter()],
  resolve: {
    alias: {
      '~': resolve(__dirname, 'app'),
      '@': resolve(__dirname, 'src'),
      '@renderer': resolve(__dirname, 'src/renderer'),
      'react-i18next': resolve(__dirname, 'src/renderer/shims/react-i18next.ts'),
    },
  },
});
