import { reactRouter } from "@react-router/dev/vite";
import { defineConfig } from 'vite';
import { resolve } from 'path';

const ignoredWatchFragments = [
  '/services/strands-agent/',
  '/build/',
  '/test-results/',
  '/__pycache__/',
];

export default defineConfig({
  plugins: [reactRouter()],
  server: {
    watch: {
      ignored: (watchPath) => {
        const normalizedPath = watchPath.replaceAll('\\', '/');
        return ignoredWatchFragments.some((fragment) =>
          normalizedPath.includes(fragment),
        );
      },
    },
  },
  resolve: {
    alias: {
      '~': resolve(__dirname, 'app'),
      '@': resolve(__dirname, 'src'),
    },
  },
});
