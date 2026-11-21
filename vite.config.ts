import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { compatibleAutoTuneBuilds, fingerprint } from './scripts/ailab-fingerprint.mjs';

export default defineConfig({ plugins: [react()], base: './', define: {
  __AILAB_BUILD__: JSON.stringify(fingerprint()), __AUTOTUNE_BUILD__: JSON.stringify(fingerprint(true)),
  __CONTINUOUS_BUILD__: JSON.stringify(fingerprint(true, true)),
  __AUTOTUNE_COMPATIBLE_BUILDS__: JSON.stringify(compatibleAutoTuneBuilds()),
  __CONTINUOUS_COMPATIBLE_BUILDS__: JSON.stringify(compatibleAutoTuneBuilds(true)),
}, build: { rollupOptions: { input: { main: 'index.html', ailab: 'ailab/index.html' } } }, server: { watch: { ignored: ['**/.private/**', '**/test-results/**'] } } });
