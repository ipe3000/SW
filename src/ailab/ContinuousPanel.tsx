import { useEffect, useMemo, useRef, useState } from 'react';
import { readLocalHardProfile, saveLocalHardProfile, type LocalHardProfile } from '../ai/local-profile';
import { defaultHardProfileName } from '../ai/profile';
import { wallColumns, weightLabels, weights } from './autotune';
import { continuousCheckpoint } from './autotune-storage';
import type { SearchWorkerMessage } from './autotune-worker';
import { checkLimits, continuousDefaults, continuousProfile, continuousStages, continuousState, continuousStops, extendContinuous,
  recordContinuousGame, sessionDefaults, startContinuous, type ContinuousRun } from './continuous';

declare const __CONTINUOUS_BUILD__: string;
declare const __CONTINUOUS_COMPATIBLE_BUILDS__: readonly string[];

function download(filename: string, body: unknown) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(body, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function elapsed(milliseconds: number) {
  const minutes = Math.floor(milliseconds / 60_000);
  return minutes >= 60 ? `${Math.floor(minutes / 60)} h ${minutes % 60} min` : `${minutes} min`;
}

export function ContinuousPanel({ onBusy }: { onBusy: (busy: boolean) => void }) {
  const [settings, setSettings] = useState(continuousDefaults);
  const [limits, setLimits] = useState(sessionDefaults);
  const [run, setRun] = useState<ContinuousRun>();
  const [applied, setApplied] = useState(readLocalHardProfile);
  const [ready, setReady] = useState(false);
  const [running, setRunning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [notice, setNotice] = useState('');
  const [commands, setCommands] = useState(0);
  const current = useRef<ContinuousRun | undefined>(undefined);
  const saved = useRef<ContinuousRun | undefined>(undefined);
  const worker = useRef<Worker | undefined>(undefined);
  const deadline = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  function pause() {
    worker.current?.terminate();
    worker.current = undefined;
    clearTimeout(deadline.current);
    setRunning(false);
  }

  useEffect(() => {
    let mounted = true;
    continuousCheckpoint().then(checkpoint => {
      if (!mounted || !checkpoint) return;
      current.current = saved.current = checkpoint;
      setRun(checkpoint);
      setSettings(checkpoint.settings);
      setLimits(checkpoint.session.limits);
    }).catch(error => { if (mounted) setNotice(String(error)); }).finally(() => { if (mounted) setReady(true); });
    const unload = (event: BeforeUnloadEvent) => { if (worker.current) event.preventDefault(); };
    window.addEventListener('beforeunload', unload);
    return () => {
      mounted = false;
      window.removeEventListener('beforeunload', unload);
      worker.current?.terminate();
      worker.current = undefined;
      clearTimeout(deadline.current);
    };
  }, []);
  useEffect(() => { onBusy(running || saving); }, [onBusy, running, saving]);

  async function persist(next: ContinuousRun) {
    current.current = next;
    setRun(next);
    setSaving(true);
    try {
      await continuousCheckpoint(next, saved.current);
      saved.current = next;
      return true;
    } catch (error) {
      pause();
      setNotice(`Salvataggio interrotto. ${String(error)}`);
      return false;
    } finally { setSaving(false); }
  }

  function dispatch(instance: Worker, retry = true) {
    const snapshot = current.current;
    if (!snapshot || worker.current !== instance) return;
    const { job } = continuousState(snapshot);
    if (!job) { pause(); return; }
    setCommands(0);
    const arm = () => {
      clearTimeout(deadline.current);
      deadline.current = setTimeout(() => {
        pause();
        setNotice('Il worker non risponde. Riprendi per rigiocare la partita in corso.');
      }, 45_000);
    };
    instance.onmessage = async ({ data }: MessageEvent<SearchWorkerMessage>) => {
      if (worker.current !== instance) return;
      if (data.kind === 'progress') {
        arm();
        setCommands(data.progress.commands);
        return;
      }
      clearTimeout(deadline.current);
      try {
        const next = recordContinuousGame(snapshot, job, data.summary);
        if (!(await persist(next)) || worker.current !== instance) return;
        if (data.summary.outcome === 'error' && !retry) {
          pause();
          setNotice(`La partita è fallita due volte. ${next.lastError?.message} Riprendi per tentare di nuovo.`);
          return;
        }
        dispatch(instance, data.summary.outcome !== 'error');
      } catch (error) {
        pause();
        setNotice(String(error));
      }
    };
    arm();
    instance.postMessage(job);
  }

  async function runFrom(snapshot: ContinuousRun) {
    if (worker.current || !__CONTINUOUS_COMPATIBLE_BUILDS__.includes(snapshot.build)) return;
    setNotice('');
    setPreparing(false);
    setRunning(true);
    if (saved.current !== snapshot && !(await persist(snapshot))) return;
    try {
      const instance = new Worker(new URL('./autotune-worker.ts', import.meta.url), { type: 'module' });
      worker.current = instance;
      instance.onerror = () => {
        pause();
        setNotice('Il worker si è interrotto. Le partite registrate sono salvate.');
      };
      dispatch(instance);
    } catch (error) {
      pause();
      setNotice(String(error));
    }
  }

  const state = useMemo(() => run && continuousState(run), [run]);
  const busy = running || saving;
  const incompatible = Boolean(run && !__CONTINUOUS_COMPATIBLE_BUILDS__.includes(run.build));
  const canConfigure = !run || preparing || incompatible;
  const previousLimits = run?.session.limits;
  const newBudget = Boolean(state?.stop || (previousLimits && (
    limits.rounds !== previousLimits.rounds || limits.minutes !== previousLimits.minutes ||
    limits.stagnant !== previousLimits.stagnant || Boolean(limits.unlimited) !== Boolean(previousLimits.unlimited)
  )));
  const field = run && `${run.settings.top}6–${run.settings.bottom}5`;
  const champion = run && continuousProfile(run);
  let limitError = '';
  try { checkLimits(limits); } catch (error) { limitError = (error as Error).message; }

  function apply(profile?: LocalHardProfile) {
    try {
      saveLocalHardProfile(profile);
      setApplied(profile);
      setNotice(profile ? `${profile.id} attivo a Difficile su ${profile.field.top}6–${profile.field.bottom}5 in questo browser.`
        : `Profilo locale rimosso. Difficile usa ${defaultHardProfileName}.`);
    } catch (error) { setNotice(String(error)); }
  }

  return <>
    <div className="lab-layout">
      <section className="lab-card">
        <h2>Configura la ricerca continua</h2>
        <p>Difficile · schieramento standard · 4 PV · 2 muri standard</p>
        <fieldset disabled={busy || !ready || !canConfigure}>
          <div className="lab-pair">
            {(['top', 'bottom'] as const).map((key, index) => {
              const row = 6 - index;
              return <label key={key}>Muro in riga {row}<select value={settings[key]}
                onChange={event => setSettings({ ...settings, [key]: event.target.value })}>
                {wallColumns.map(column => <option key={column} value={column}>{column}{row}</option>)}
              </select></label>;
            })}
          </div>
          <div className="lab-pair">
            <label>Seme dei profili<input type="number" min="0" max="4294967295" value={Number.isNaN(settings.seed) ? '' : settings.seed}
              onChange={event => setSettings({ ...settings, seed: event.target.valueAsNumber })}/></label>
            <label>Variazione dei pesi (%)<input type="number" min="2" max="30" value={Number.isNaN(settings.radius) ? '' : settings.radius}
              onChange={event => setSettings({ ...settings, radius: event.target.valueAsNumber })}/></label>
          </div>
        </fieldset>
        <fieldset disabled={busy || !ready}>
          <label className="lab-check"><input type="checkbox" checked={Boolean(limits.unlimited)}
            onChange={event => setLimits({ ...(limitError ? sessionDefaults : limits), unlimited: event.target.checked })}/>Prosegui fino alla pausa manuale</label>
          <div className="lab-pair">
            <label>Giri per sessione<input disabled={limits.unlimited} type="number" min="1" max="100" value={Number.isNaN(limits.rounds) ? '' : limits.rounds}
              onChange={event => setLimits({ ...limits, rounds: event.target.valueAsNumber })}/></label>
            <label>Minuti di simulazione<input disabled={limits.unlimited} type="number" min="1" max="1440" value={Number.isNaN(limits.minutes) ? '' : limits.minutes}
              onChange={event => setLimits({ ...limits, minutes: event.target.valueAsNumber })}/></label>
          </div>
          <label>Giri senza promozioni<input disabled={limits.unlimited} type="number" min="1" max="100" value={Number.isNaN(limits.stagnant) ? '' : limits.stagnant}
            onChange={event => setLimits({ ...limits, stagnant: event.target.valueAsNumber })}/></label>
        </fieldset>
        <p className="lab-muted">Ogni giro prova fino a quattro sfidanti. Per promuoverne uno servono due 2–0 contro il riferimento. Dopo la prima promozione controlla anche che lo sfidante regga contro il profilo iniziale.</p>
        {limitError && <p className="lab-notice" role="alert">{limitError}</p>}
        <div className="lab-actions">
          {running ? <button disabled={saving} onClick={pause}>Pausa ricerca</button> : canConfigure
            ? <button className="primary" disabled={!ready || saving || Boolean(limitError)} onClick={() => {
              try { void runFrom(startContinuous(settings, limits, __CONTINUOUS_BUILD__, navigator.userAgent)); }
              catch (error) { setNotice(String(error)); }
            }}>{run ? 'Avvia nuova ricerca continua' : 'Avvia ricerca continua'}</button>
            : run && <button className="primary" disabled={saving || Boolean(limitError)} onClick={() => {
              void runFrom(newBudget ? extendContinuous(run, limits) : run);
            }}>{newBudget ? 'Continua con un nuovo budget' : 'Riprendi ricerca'}</button>}
          {run && !busy && !incompatible && <button onClick={() => {
            if (preparing) { setSettings(run.settings); setLimits(run.session.limits); }
            setPreparing(!preparing);
          }}>{preparing ? 'Annulla' : 'Configura altra ricerca'}</button>}
        </div>
        {run && preparing && <p className="lab-muted">Avviare un’altra ricerca sostituisce il checkpoint corrente. Puoi scaricare prima il report.</p>}
      </section>
      <section className="lab-card">
        <h2>Avanzamento della ricerca</h2>
        {run && <div className="lab-stats">
          <div><strong>{run.champion.id}</strong><span>Profilo di riferimento</span></div>
          <div><strong>{run.games}</strong><span>Partite completate</span></div>
          <div><strong>{run.promotions}</strong><span>Promozioni</span></div>
        </div>}
        <p role="status">{state?.stop ? `${continuousStops[state.stop]}. Puoi continuare dal checkpoint.`
          : state?.job && state.round ? `Giro ${state.round.number} · ${field} · ${continuousStages[state.job.phase]} · ${state.job.profile.id} da ${state.job.candidateSide === 'red' ? 'rosso' : 'blu'}${running ? ` · ${commands} comandi` : ' · in pausa'}`
          : ready ? 'Pronto' : 'Caricamento'}</p>
        {run && <p className="lab-muted">{run.rounds} giri conclusi · {elapsed(run.elapsed - run.session.atElapsed)} di simulazione in questa sessione · {run.failures} errori registrati</p>}
        {incompatible && <p className="lab-notice">Questo checkpoint appartiene a un’altra build. Puoi esportare i risultati e i pesi.</p>}
        {notice && <p className="lab-notice" role="alert">{notice}</p>}
        <div className="lab-actions">
          <button disabled={!run} onClick={() => { if (run) download(`autotune-continuo-${run.id}.json`, run); }}>Scarica report ricerca</button>
          {champion && <>
            <button onClick={() => download(`profilo-${champion.id}.json`, champion)}>Scarica profilo migliore</button>
            <button disabled={incompatible || applied?.source === champion.source && applied.id === champion.id} onClick={() => apply(champion)}>Applica a Difficile su {field}</button>
          </>}
          {applied && <button onClick={() => apply()}>Ripristina {defaultHardProfileName}</button>}
        </div>
        {applied && <p className="lab-muted">Nel gioco è attivo {applied.id} su {applied.field.top}6–{applied.field.bottom}5 in questo browser.</p>}
        {run && <details><summary>Pesi del profilo di riferimento</summary>
          <dl>{weights.map(key => <div key={key}><dt>{weightLabels[key]}</dt>
            <dd>{run.champion.values[key].toLocaleString('it-IT', { maximumFractionDigits: 4 })}</dd></div>)}</dl>
        </details>}
      </section>
    </div>
    {run && run.history.length > 0 && <section className="lab-card lab-results">
      <h2>Ultimi giri</h2>
      <div className="lab-scroll"><table aria-label="Giri della ricerca continua">
        <thead><tr><th>Giro</th><th>Riferimento</th><th>Sfidanti</th><th>Partite</th><th>Promozione</th></tr></thead>
        <tbody>{[...run.history].reverse().map(round => <tr key={round.number}>
          <th scope="row">{round.number}</th><td>{round.reference.id}</td><td>{round.candidates.length}</td>
          <td>{round.rows.length}</td><td>{round.winner?.id ?? '—'}</td>
        </tr>)}</tbody>
      </table></div>
    </section>}
  </>;
}
