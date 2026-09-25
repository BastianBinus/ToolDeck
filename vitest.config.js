import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';

// Separate from vite.config.js so unit tests never load the PWA plugin and the
// app build stays exactly as configured there.
export default defineConfig({
  plugins: [svelte()],
  test: {
    include: ['tests/unit/**/*.test.js'],
    environment: 'node',
  },
});
