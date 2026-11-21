import { parseArgs } from 'node:util';
import { mkdirSync, openSync, closeSync, readFileSync, writeFileSync, renameSync, unlinkSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { setImmediate } from 'node:timers/promises';
import { createServer } from 'vite';
import { compatibleAutoTuneBuilds, fingerprint } from './ailab-fingerprint.mjs';

function writeJson(path, value) {
  const temporary = path + '.tmp';
  writeFileSync(temporary, JSON.stringify(value, null, 2) + '\n');
  renameSync(temporary, path);
}

async function main() {
  const { values } = parseArgs({ allowNegative: true, options: { file: { type: 'string' }, seed: { type: 'string' },
    ranges: { type: 'string' }, games: { type: 'string' }, help: { type: 'boolean' },
    continuous: { type: 'boolean' }, extend: { type: 'boolean' }, top: { type: 'string' }, bottom: { type: 'string' },
    radius: { type: 'string' }, rounds: { type: 'string' }, minutes: { type: 'string' }, stagnant: { type: 'string' },
    unlimited: { type: 'boolean' } } });
  if (values.help) {
    console.log('npm run ai:autotune -- [--file output/autotune/run.json] [--seed 301] [--ranges weights.json] [--games 0]');
    console.log('npm run ai:autotune -- --continuous [--file output/autotune/continuous.json] [--rounds 3] [--minutes 120] [--stagnant 3] [--unlimited] [--extend]');
    console.log('Il file identifica la ricerca e permette di riprenderla. --games limita le nuove partite di questa esecuzione.');
    return;
  }
  const continuous = Boolean(values.continuous);
  const sessionOptions = ['rounds', 'minutes', 'stagnant'];
  const fieldOptions = ['top', 'bottom', 'radius'];
  const changedLimits = values.unlimited !== undefined || sessionOptions.some(name => values[name] !== undefined);
  const changedField = fieldOptions.some(name => values[name] !== undefined);
  if (!continuous && (values.extend || changedLimits || changedField)) throw new Error('Questi argomenti richiedono --continuous.');
  if (continuous && values.ranges !== undefined) throw new Error('In ricerca continua usa --radius per variare i pesi.');
  const path = resolve(values.file ?? (continuous ? 'output/autotune/continuous.json' : 'output/autotune/run.json'));
  const maxGames = values.games === undefined ? Infinity : Number(values.games);
  if (values.games !== undefined && (!/^\d+$/.test(values.games) || !Number.isSafeInteger(maxGames))) throw new Error('--games richiede un intero da 0 in su.');
  mkdirSync(dirname(path), { recursive: true });
  const lockPath = path + '.lock';
  let lock;
  try { lock = openSync(lockPath, 'wx'); }
  catch (error) {
    if (error.code !== 'EEXIST') throw error;
    throw new Error(`File in uso: ${lockPath}. Rimuovi il lucchetto solo se il batch che lo ha creato è terminato.`);
  }
  let server;
  let stopped = false;
  const pause = () => { stopped = true; };
  try {
    writeFileSync(lock, String(process.pid));
    process.on('SIGINT', pause);
    process.on('SIGTERM', pause);
    const build = fingerprint(true, continuous);
    server = await createServer({ configFile: false, server: { middlewareMode: true, ws: false, watch: null } });
    const tune = await server.ssrLoadModule('/src/ailab/autotune.ts');
    const evolution = continuous && await server.ssrLoadModule('/src/ailab/continuous.ts');
    const stateFor = continuous ? evolution.continuousState : tune.searchState;
    const record = continuous ? evolution.recordContinuousGame : tune.recordSearchGame;
    const report = continuous ? run => run : tune.searchReport;
    const limits = defaults => ({ ...Object.fromEntries(sessionOptions.map(key => [key, numberOption(key, defaults[key])])),
      unlimited: values.unlimited ?? defaults.unlimited });
    const runtime = `Node ${process.version} · ${process.platform} ${process.arch}`;
    function numberOption(name, fallback) {
      const value = values[name];
      return value === undefined ? fallback : /^\d+$/.test(value) ? Number(value) : NaN;
    }
    let run;
    if (existsSync(path)) {
      if (values.seed !== undefined || values.ranges !== undefined || changedField) throw new Error('Seme, campo e variazioni si impostano in un nuovo file.');
      if (changedLimits && !values.extend) throw new Error('Usa --extend per assegnare un nuovo budget al checkpoint.');
      run = JSON.parse(readFileSync(path, 'utf8'));
      const format = continuous ? 'strategic-wizardry-autotune-continuous' : 'strategic-wizardry-autotune';
      const allowedBuilds = compatibleAutoTuneBuilds(continuous);
      if (run.format !== format || run.schema !== 1 || !allowedBuilds.includes(run.build)) {
        throw new Error('Checkpoint incompatibile con questa build di AutoTune. Usa un nuovo file per un’altra ricerca.');
      }
      if (values.extend) {
        run = evolution.extendContinuous(run, limits(run.session.limits));
        writeJson(path, run);
      }
    } else if (continuous) {
      if (values.extend) throw new Error('--extend richiede un checkpoint esistente.');
      const settings = evolution.continuousDefaults;
      run = evolution.startContinuous({
        top: values.top ?? settings.top, bottom: values.bottom ?? settings.bottom,
        radius: numberOption('radius', settings.radius), seed: numberOption('seed', settings.seed),
      }, limits(evolution.sessionDefaults), build, runtime);
      writeJson(path, run);
    } else {
      const ranges = values.ranges === undefined ? tune.searchDefaults.ranges : JSON.parse(readFileSync(values.ranges, 'utf8'));
      const seed = numberOption('seed', tune.searchDefaults.seed);
      run = tune.createSearch({ seed, ranges }, build, runtime);
      writeJson(path, report(run));
    }
    for (let completed = 0; completed < maxGames && !stopped; completed++) {
      const { job, round } = stateFor(run);
      if (!job) break;
      const progress = continuous ? `Giro ${round.number} · ${evolution.continuousStages[job.phase]}`
        : `${run.results.length + 1}/${tune.gameBudget(run.config)} · ${tune.phaseLabels[job.phase]}`;
      console.log(`${progress} · ${job.profile.id} · ${job.test.seed} · ${job.candidateSide}`);
      let summary = tune.playSearchJob(job);
      run = record(run, job, summary);
      writeJson(path, report(run));
      await setImmediate();
      if (summary.outcome === 'error' && !stopped && stateFor(run).job) {
        console.warn(`Errore, un nuovo tentativo: ${summary.error}`);
        summary = tune.playSearchJob(job);
        run = record(run, job, summary);
        writeJson(path, report(run));
        await setImmediate();
        if (summary.outcome === 'error') throw new Error(`Partita interrotta: ${summary.error}`);
      }
      console.log(`  ${summary.outcome} · ${summary.commands} comandi · ${Math.round(summary.elapsed / 1000)} s`);
    }
    const state = stateFor(run);
    const profile = continuous ? evolution.continuousProfile(run) : tune.validatedProfile(run);
    if (profile) writeJson(path + '.profile.json', profile);
    const status = continuous && state.stop ? evolution.continuousStops[state.stop] : state.verdict ?? 'in pausa';
    console.log(`${status} · ${continuous ? run.games : run.results.length} partite · ${path}`);
  } finally {
    process.off('SIGINT', pause);
    process.off('SIGTERM', pause);
    try { await server?.close(); } finally {
      closeSync(lock);
      unlinkSync(lockPath);
    }
  }
}

main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
