import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';

export function fingerprint(autoTune = false, continuous = false) {
  const hash = createHash('sha256');
  const files = ['src/ai', 'src/engine'].flatMap(directory =>
    readdirSync(new URL('../' + directory, import.meta.url)).filter(file => file.endsWith('.ts')).sort().map(file => directory + '/' + file));
  if (autoTune) files.push('src/ailab/model.ts', 'src/ailab/simulation.ts', 'src/ailab/autotune.ts');
  if (continuous) files.push('src/ailab/continuous.ts');
  for (const file of files) {
    hash.update(autoTune ? file : file.split('/').at(-1));
    hash.update(readFileSync(new URL('../' + file, import.meta.url), 'utf8').replace(/\r\n/g, '\n'));
  }
  return hash.digest('hex').slice(0, 16);
}

export function compatibleAutoTuneBuilds(continuous = false) {
  const current = fingerprint(true, continuous);
  // These checkpoints have explicit match weights. Continuous checkpoints without an anchor retain P2.
  const previous = current === 'b397f07eddee8c06' ? ['b34c00848d4277fd', 'ab16787cac2c7928']
    : current === '5415ef21e992307a' ? ['db492f988972a740'] : [];
  return [current, ...previous];
}
