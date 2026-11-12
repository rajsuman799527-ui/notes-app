import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      'zitejs/api': path.resolve(__dirname, 'src/lib/api.ts'),
      '@project/components': path.resolve(__dirname, 'src/pkg'),
    },
  },
  build: { target: 'esnext', sourcemap: false },
});
