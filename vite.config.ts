import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';

const fingerprint = createHash('sha256');
for (const directory of ['src/ai', 'src/engine']) for (const file of readdirSync(directory).filter(file => file.endsWith('.ts')).sort()) {
  fingerprint.update(file).update(readFileSync(`${directory}/${file}`));
}

export default defineConfig({ plugins: [react()], base: './', define: { __AILAB_BUILD__: JSON.stringify(fingerprint.digest('hex').slice(0, 16)) }, build: { rollupOptions: { input: { main: 'index.html', ailab: 'ailab/index.html' } } }, server: { watch: { ignored: ['**/.private/**', '**/test-results/**'] } } });
