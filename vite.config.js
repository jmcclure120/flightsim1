import { defineConfig } from 'vite';

export default defineConfig({
  base: '/flightsim1/',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
