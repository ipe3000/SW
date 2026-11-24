import { useEffect, useRef, useState } from 'react';
import { checkConfig, createSearch, fixedFieldDefaults, gameBudget, lightningDefaults, lightningModes, maximumGames, phaseLabels, rankings, recordSearchGame, referenceLabels, searchDefaults, searchReport, searchState,
  validatedProfile, verificationConfig, wallColumns, weightLabels, weights, type SearchConfig, type SearchRun } from './autotune';
import { lightningCheckpoint, searchCheckpoint } from './autotune-storage';
import type { SearchWorkerMessage } from './autotune-worker';
import { defaultHardProfileId, defaultHardProfileName } from '../ai/profile';
import { LightningResults } from './LightningResults';
import { OptionalRuleControls } from '../ui/OptionalRuleControls';

declare const __AUTOTUNE_BUILD__: string;
declare const __AUTOTUNE_COMPATIBLE_BUILDS__: readonly string[];

function downloadJson(filename: string, data: unknown) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function duration(milliseconds: number) {
  const minutes = Math.ceil(milliseconds / 60_000);
  return minutes >= 60 ? `${Math.floor(minutes / 60)} h ${minutes % 60} min` : `${minutes} min`;
}

export function AutoTunePanel({ onBusy, experiment = false }: { onBusy: (value: boolean) => void; experiment?: boolean }) {
  const loadCheckpoint = experiment ? lightningCheckpoint : searchCheckpoint;
  const [config, setConfig] = useState<SearchConfig>(experiment
    ? { ...searchDefaults, lightning: lightningDefaults } : { ...searchDefaults, fixed: fixedFieldDefaults });
  const [run, setRun] = useState<SearchRun>();
  const [ready, setReady] = useState(false);
  const [running, setRunning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [preparing, setPreparing] = useState(false);
  const [progress, setProgress] = useState({ turn: 0, commands: 0 });
  const current = useRef<SearchRun | undefined>(undefined);
  const saved = useRef<SearchRun | undefined>(undefined);
  const worker = useRef<Worker | undefined>(undefined);
  const watchdog = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const active = useRef(false);

  function stop() {
    active.current = false;
    worker.current?.terminate();
    worker.current = undefined;
    clearTimeout(watchdog.current);
    setRunning(false);
  }

  useEffect(() => {
    let alive = true;
    loadCheckpoint().then(checkpoint => {
      if (!alive || !checkpoint) return;
      current.current = saved.current = checkpoint;
      setRun(checkpoint);
      setConfig(checkpoint.config);
    }).catch(error => { if (alive) setNotice(String(error)); })
      .finally(() => { if (alive) setReady(true); });
    const unload = (event: BeforeUnloadEvent) => { if (active.current) event.preventDefault(); };
    window.addEventListener('beforeunload', unload);
    return () => {
      alive = false;
      active.current = false;
      worker.current?.terminate();
      clearTimeout(watchdog.current);
      window.removeEventListener('beforeunload', unload);
    };
  }, [loadCheckpoint]);
  useEffect(() => { onBusy(running || saving); }, [onBusy, running, saving]);

  async function checkpoint(next: SearchRun) {
    current.current = next;
    setRun(next);
    setSaving(true);
    try {
      await loadCheckpoint(next, saved.current);
      saved.current = next;
      return true;
    } catch (error) {
      stop();
      setNotice(`Salvataggio non riuscito. ${String(error)}`);
      return false;
    } finally { setSaving(false); }
  }

  function dispatch(instance: Worker) {
    const snapshot = current.current;
    if (!active.current || !snapshot || worker.current !== instance) return;
    const { job } = searchState(snapshot);
    if (!job) { stop(); return; }
    setProgress({ turn: 0, commands: 0 });
    const arm = () => {
      clearTimeout(watchdog.current);
      watchdog.current = setTimeout(() => {
        stop();
        setNotice('Worker senza risposta per 45 secondi. Riprendi per rigiocare l’incontro interrotto.');
      }, 45_000);
    };
    instance.onmessage = async ({ data }: MessageEvent<SearchWorkerMessage>) => {
      if (!active.current || worker.current !== instance) return;
      if (data.kind === 'progress') {
        arm();
        setProgress(data.progress);
        return;
      }
      clearTimeout(watchdog.current);
      const ok = await checkpoint(recordSearchGame(snapshot, job, data.summary));
      if (!ok || !active.current) return;
      if (data.summary.outcome === 'error') {
        stop();
        setNotice(`Partita interrotta. ${data.summary.error ?? ''} Riprendi per rigiocarla.`);
      } else dispatch(instance);
    };
    arm();
    instance.postMessage(job);
  }

  async function runFrom(snapshot: SearchRun) {
    active.current = true;
    setRunning(true);
    setPreparing(false);
    setNotice('');
    if (saved.current !== snapshot && !(await checkpoint(snapshot))) return;
    if (!active.current) return;
    try {
      const instance = new Worker(new URL('./autotune-worker.ts', import.meta.url), { type: 'module' });
      worker.current = instance;
      instance.onerror = () => {
        stop();
        setNotice('Worker interrotto. Riprendi dal salvataggio più recente.');
      };
      dispatch(instance);
    } catch (error) {
      stop();
      setNotice(String(error));
    }
  }

  const state = run && searchState(run);
  const incompatible = run && !__AUTOTUNE_COMPATIBLE_BUILDS__.includes(run.build);
  const result = run && validatedProfile(run);
  const completed = run?.results.length ?? 0;
  const fixed = (run?.config ?? config).fixed;
  const total = gameBudget(run?.config ?? config);
  const remaining = run && completed && state?.job
    ? duration(run.results.reduce((sum, row) => sum + row.elapsed, 0) / completed * (total - completed)) : undefined;
  let configError = '';
  try { checkConfig(config); } catch (error) { configError = (error as Error).message; }
  const busy = running || saving;
  const resumable = Boolean(state?.job && !incompatible);
  const canStart = !resumable || preparing;
  const reference = config.reference ?? defaultHardProfileId;
  const candidates = run && state?.verdict === 'field-complete' && run.config.fixed?.strategy === 'tune'
    ? rankings(run).filter(row => row.net > 0) : [];

  return <>
    <div className="lab-layout">
      <section className="lab-card">
        <h2>{experiment ? 'Esperimento Elettromante' : 'Configura AutoTune'}</h2>
        <p>Difficile · schieramento standard · 4 PV · 2 muri standard</p>
        <fieldset disabled={busy || !ready || !canStart}>
          {config.lightning ? <>
            <label>Tipo di incentivo<select value={config.lightning.mode ?? 'opportunity'}
              onChange={event => setConfig({ ...config, lightning: {
                ...config.lightning!, mode: event.target.value === 'impact' ? 'impact' : 'opportunity',
              } })}>
              {Object.entries(lightningModes).map(([key, name]) => <option key={key} value={key}>{name}</option>)}
            </select></label>
            <label>Bonus Elettromante (%)<input type="number" min="0" max="100"
              value={Number.isNaN(config.lightning.bonus) ? '' : config.lightning.bonus}
              onChange={event => setConfig({ ...config, lightning: { ...config.lightning!, bonus: event.target.valueAsNumber } })}/></label>
            <label>Serie di campi<select value={config.lightning.sample}
              onChange={event => setConfig({ ...config, lightning: { ...config.lightning!, sample: event.target.value === 'reserve' ? 'reserve' : 'pilot' } })}>
              <option value="pilot">Pilota · da F6–C5</option>
              <option value="reserve">Riserva · campi diversi dal pilota</option>
            </select></label>
            <label>Campi per confronto<input type="number" min="1" max="8"
              value={Number.isNaN(config.lightning.fields) ? '' : config.lightning.fields}
              onChange={event => setConfig({ ...config, lightning: { ...config.lightning!, fields: event.target.valueAsNumber } })}/></label>
          </> : <>
          <label>Modalità di ricerca<select value={config.fixed?.strategy ?? 'multi'} onChange={event => {
            const strategy = event.target.value;
            if (strategy === 'profile') return;
            const { top, bottom } = config.fixed ?? fixedFieldDefaults;
            setConfig({ ...config, fixed: strategy === 'p3' || strategy === 'tune'
              ? { top, bottom, strategy } : undefined });
          }}>
            <option value="p3">Campo singolo · P3 contro il riferimento</option>
            <option value="tune">Campo singolo · prova quattro profili</option>
            {config.fixed?.strategy === 'profile' && <option value="profile">Campo singolo · {config.fixed.profile.id} del report</option>}
            <option value="multi">Campi diversi · selezione e validazione</option>
          </select></label>
          <label>Profilo di riferimento<select value={reference} onChange={event => setConfig({
            ...config, reference: event.target.value as SearchConfig['reference'],
          })}>
            {Object.entries(referenceLabels).map(([id, name]) => <option key={id} value={id}>{name}</option>)}
          </select></label>
          {config.fixed && <div className="lab-pair">
            {(['top', 'bottom'] as const).map((key, index) => {
              const field = config.fixed!;
              const row = 6 - index;
              return <label key={key}>Muro in riga {row}<select value={field[key]}
                onChange={event => setConfig({ ...config, fixed: { ...field, [key]: event.target.value } })}>
                {wallColumns.map(column => <option key={column} value={column}>{column}{row}</option>)}
              </select></label>;
            })}
          </div>}
          {(!config.fixed || config.fixed.strategy === 'tune') && <>
          <label>{config.fixed ? 'Seme dei profili' : 'Seme dei campi e dei profili'}<input type="number" min="0" max="4294967295" value={Number.isNaN(config.seed) ? '' : config.seed}
            onChange={event => setConfig({ ...config, seed: event.target.valueAsNumber })}/></label>
          <details>
            <summary>Variazione massima dei pesi</summary>
            <p className="lab-muted">Percentuale sopra o sotto il valore del riferimento. Usa 0 per fissare un peso.</p>
            <div className="lab-pair">{weights.map(key => <label key={key}>{weightLabels[key]} (%)
              <input type="number" min="0" max="30" step="1" value={Number.isNaN(config.ranges[key]) ? '' : config.ranges[key]}
                onChange={event => setConfig({ ...config, ranges: { ...config.ranges, [key]: event.target.valueAsNumber } })}/>
            </label>)}</div>
          </details>
          </>}
          </>}
          <OptionalRuleControls value={config} onChange={(rule, enabled) => setConfig({ ...config, [rule]: enabled })} className="lab-check"/>
        </fieldset>
        <p className="lab-muted">{config.lightning
          ? `${defaultHardProfileName} con il bonus scelto contro ${defaultHardProfileName}. Due partite per campo, una per colore. ${
            config.lightning.mode === 'impact'
              ? 'Il bonus premia i PV tolti e i maghi eliminati dalla scarica quando viene lanciata. Il fuoco amico riduce il punteggio.'
              : 'Il bonus aumenta il valore delle opportunità favorevoli di scarica.'
          } Scegli 0% per un confronto di controllo.`
          : config.fixed
          ? `${gameBudget(config)} partite su ${config.fixed.top}6–${config.fixed.bottom}5. Ciascun profilo gioca una volta per colore. L’esito vale per questa disposizione.`
          : `Fino a ${maximumGames} partite. Quattro profili sui primi 6 campi, due su altri 6 e un finalista su 12 campi riservati. Ogni confronto inverte i colori. Il batch può richiedere ore.`}</p>
        {configError && <p className="lab-notice" role="alert">{configError}</p>}
        <div className="lab-actions">
          {running && <button disabled={saving} onClick={stop}>Pausa AutoTune</button>}
          {resumable && !busy && !preparing && <>
            <button className="primary" onClick={() => { if (run) void runFrom(run); }}>Riprendi AutoTune</button>
            <button onClick={() => setPreparing(true)}>Prepara nuova ricerca</button>
          </>}
          {canStart && !running && <>
            <button className="primary" disabled={!ready || busy || Boolean(configError)} onClick={() => {
              try { void runFrom(createSearch(config, __AUTOTUNE_BUILD__, navigator.userAgent)); }
              catch (error) { setNotice(String(error)); }
            }}>{experiment ? 'Avvia esperimento' : config.fixed?.strategy === 'profile' ? `Avvia verifica di ${config.fixed.profile.id}` : run ? 'Avvia nuova ricerca' : 'Avvia AutoTune'}</button>
            {preparing && <button disabled={saving} onClick={() => { if (run) setConfig(run.config); setPreparing(false); }}>Annulla</button>}
          </>}
        </div>
        {run && canStart && !busy && <p className="lab-muted">Avviare una nuova ricerca sostituisce il salvataggio corrente. Puoi scaricarlo dal report.</p>}
      </section>
      <section className="lab-card">
        <h2>Avanzamento</h2>
        <progress aria-label="Avanzamento AutoTune" value={completed} max={state?.verdict ? completed || 1 : total}/>
        <p role="status">{state?.verdict === 'validated' ? `${state.finalist.id} validato su campi riservati.`
          : state?.verdict === 'inconclusive' ? `${state.finalist.id} · risultato inconcludente.`
          : state?.verdict === 'no-finalist' ? 'Nessun profilo ha superato il riferimento nella selezione.'
          : state?.verdict === 'lightning-complete' ? 'Esperimento Elettromante completato.'
          : state?.verdict === 'field-complete' && fixed ? `Confronto completato su ${fixed.top}6–${fixed.bottom}5.`
          : state?.job ? <>{completed} / {total} partite · {experiment ? 'Elettromante' : fixed ? `${fixed.top}6–${fixed.bottom}5` : phaseLabels[state.job.phase]} · {state.job.profile.id}
            {running ? ` · candidato ${state.job.candidateSide === 'red' ? 'rosso' : 'blu'} · turno ${progress.turn + 1} · ${progress.commands} comandi` : ' · in pausa'}</>
          : ready ? 'Pronto' : 'Caricamento'}</p>
        {remaining && <p className="lab-muted">Stima per completare tutte le fasi · {remaining}</p>}
        {state?.score && <p>Validazione su {state.score.fields} campi · {state.score.wins} vittorie, {state.score.losses} sconfitte,
          {' '}{state.score.limits} al limite, {state.score.repetitions} per ripetizione. Test per campo con inconcluse sfavorevoli al candidato: p = {state.pValue.toPrecision(3)}.</p>}
        {incompatible && <p className="lab-notice">Il salvataggio appartiene a un’altra build. Esportalo prima di avviare una nuova ricerca.</p>}
        {notice && <p className="lab-notice" role="alert">{notice}</p>}
        <div className="lab-actions">
          <button disabled={!run} onClick={() => { if (run) downloadJson(`${experiment ? 'elettromante' : 'autotune'}-${run.id}.json`, searchReport(run)); }}>Scarica report {experiment ? 'Elettromante' : 'AutoTune'}</button>
          {run && candidates.map(({ profile }) => <button key={profile.id} disabled={busy} onClick={() => {
            setConfig(verificationConfig(run, profile));
            setPreparing(true);
            setNotice('');
          }}>Prepara verifica di {profile.id}</button>)}
          {result && <button onClick={() => downloadJson(`autotune-${result.profile.id}-validato.json`, result)}>Scarica profilo validato</button>}
        </div>
      </section>
    </div>
    {run?.config.lightning ? <LightningResults run={run}/> : run && <section className="lab-card lab-results">
      <h2>{fixed ? 'Risultati sul campo scelto' : 'Risultati della selezione'}</h2>
      <p className="lab-muted">Riferimento della campagna · {referenceLabels[run.config.reference ?? 'ai2']}</p>
      <div className="lab-scroll"><table aria-label="Profili AutoTune"><thead><tr><th>Profilo</th><th>Campi</th><th>Vittorie</th><th>Sconfitte</th><th>Limiti</th><th>Ripetizioni</th><th>Saldo</th>
        {weights.map(key => <th key={key}>{weightLabels[key]}</th>)}</tr></thead><tbody>
        {rankings(run).map(row => <tr key={row.profile.id}><th scope="row">{row.profile.id}</th><td>{row.fields}</td><td>{row.wins}</td><td>{row.losses}</td>
          <td>{row.limits}</td><td>{row.repetitions}</td><td>{row.net}</td>
          {weights.map(key => <td key={key}>{new Intl.NumberFormat('it-IT', { style: 'percent', maximumFractionDigits: 2, signDisplay: 'exceptZero' }).format(row.profile.values[key] / run.baseline[key] - 1)}</td>)}</tr>)}
      </tbody></table></div>
      <p className="lab-muted">Ogni campo entra nella classifica dopo entrambe le partite. Il report include campi, profili, esiti e tempi per lato.</p>
      {fixed && run.results.length > 0 && <ul>{run.results.map(row => <li key={row.id}>
        {row.profile} da {row.candidateSide === 'red' ? 'rosso' : 'blu'} · {row.outcome === row.candidateSide
          ? 'vittoria' : row.outcome === 'red' || row.outcome === 'blue' ? 'sconfitta' : row.outcome === 'limit' ? 'limite comandi' : 'ripetizione'}
      </li>)}</ul>}
    </section>}
  </>;
}
