import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// base './' keeps every asset path relative, so the same build works at a
// domain root or under a GitHub Pages project path such as /trunk/.
// Routing uses the URL hash, so no server rewrites are needed.
export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    target: 'es2022',
    sourcemap: false,
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
