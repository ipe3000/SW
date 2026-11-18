import { useEffect, useMemo, useRef, useState } from 'react';
import { casesFor, defaults, labels, levels, markdown, statistics, groupedStatistics, phaseStatistics, physicalPositionKey, initialGame, type Campaign, type Config, type Result } from './model';
import { restore, save } from './storage';
import './styles.css';

declare const __AILAB_BUILD__: string;
export function AiLab() {
  const [config, setConfig] = useState<Config>(defaults);
  const [campaign, setCampaign] = useState<Campaign>();
  const [running, setRunning] = useState(false);
  const [ready, setReady] = useState(false);
  const [notice, setNotice] = useState('');
  const [progress, setProgress] = useState({ commands: 0, turn: 1 });
  const worker = useRef<Worker | null>(null), watchdog = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const current = useRef<Campaign | undefined>(undefined), active = useRef(false), alive = useRef(true);
  const stop = () => { active.current = false; worker.current?.terminate(); worker.current = null; clearTimeout(watchdog.current); setRunning(false); };
  useEffect(() => {
    alive.current = true;
    restore().then(saved => { if (alive.current && saved?.schema === 1) { current.current = saved; setCampaign(saved); setConfig(saved.config); } }).catch(() => { if (alive.current) setNotice('Il salvataggio locale non è disponibile. Puoi comunque esportare i report.'); }).finally(() => { if (alive.current) setReady(true); });
    const unload = (event: BeforeUnloadEvent) => { if (active.current) { event.preventDefault(); event.returnValue = ''; } };
    window.addEventListener('beforeunload', unload);
    return () => { alive.current = false; active.current = false; worker.current?.terminate(); clearTimeout(watchdog.current); window.removeEventListener('beforeunload', unload); };
  }, []);

  async function persist(next: Campaign) {
    try { await save(next); }
    catch { if (alive.current) setNotice('Salvataggio locale fallito (spazio o permessi). Esporta il JSON prima di chiudere la pagina.'); }
  }
  function runNext() {
    const snapshot = current.current;
    if (!active.current || !snapshot || worker.current) return;
    const test = snapshot.cases[snapshot.results.length];
    if (!test) { stop(); return; }
    setProgress({ commands: 0, turn: 1 });
    let instance: Worker;
    try { instance = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' }); }
    catch { stop(); setNotice('Impossibile avviare il worker. Riprova in un browser con Web Worker abilitati.'); return; }
    worker.current = instance;
    const arm = () => { clearTimeout(watchdog.current); watchdog.current = setTimeout(() => { stop(); setNotice('Nessuna risposta dal worker per 30 secondi. La partita interrotta può essere riavviata con Riprendi.'); }, 30_000); };
    arm();
    instance.onerror = () => { stop(); setNotice('Il worker si è interrotto. I risultati completati sono conservati; puoi riprendere.'); };
    instance.onmessage = async ({ data }) => {
      if (!alive.current || !active.current || worker.current !== instance) return;
      arm();
      if (data.kind === 'progress') setProgress({ commands: data.commands, turn: data.turn });
      if (data.kind === 'result') {
        instance.terminate(); worker.current = null; clearTimeout(watchdog.current);
        const next = { ...snapshot, results: [...snapshot.results, data.result as Result] };
        current.current = next; setCampaign(next);
        await persist(next);
        if (active.current) runNext();
      }
    };
    instance.postMessage({ test, config: snapshot.config });
  }
  async function start() {
    try {
      const cases = casesFor(config);
      const next: Campaign = { format: 'strategic-wizardry-ailab', schema: 1, sampling: 'distinct-v2', id: crypto.randomUUID(), created: new Date().toISOString(), build: __AILAB_BUILD__, userAgent: navigator.userAgent, config: { ...config }, cases, results: [] };
      current.current = next; setCampaign(next); setNotice(''); active.current = true; setRunning(true);
      await persist(next);
      if (active.current) runNext();
    } catch (error) { stop(); setNotice(error instanceof Error ? error.message : String(error)); }
  }
  function resume() {
    if (!current.current || current.current.build !== __AILAB_BUILD__) return;
    setNotice(''); active.current = true; setRunning(true); runNext();
  }
  function download(kind: 'json' | 'md') {
    if (!campaign) return;
    const blob = new Blob([kind === 'json' ? JSON.stringify(campaign) : markdown(campaign)], { type: kind === 'json' ? 'application/json' : 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob), anchor = document.createElement('a');
    anchor.href = url; anchor.download = `ailab-${campaign.id}.${kind}`; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const update = <K extends keyof Config>(key: K, value: Config[K]) => setConfig(previous => ({ ...previous, [key]: value }));
  const results = campaign?.results ?? [], wins = results.filter(row => row.outcome === 'red' || row.outcome === 'blue').length;
  const pending = campaign && results.length < campaign.cases.length;
  const differentBuild = campaign && campaign.build !== __AILAB_BUILD__;
  const currentCase = campaign?.cases[results.length];
  const distinctFields = useMemo(()=>campaign ? new Set(campaign.cases.map(test=>physicalPositionKey(initialGame(test)))).size : 0,[campaign?.cases]);
  const preview = useMemo(() => { try { return { count: casesFor(config).length, error: '' }; } catch (error) { return {count:0,error:error instanceof Error ? error.message : String(error)}; } }, [config]);
  const count = preview.count, configError = preview.error;
  return <main className="ailab">
    <header><div><p className="eyebrow">STRATEGIC WIZARDRY · LABORATORIO AI</p><h1>ailab<span> / arena di ricerca</span></h1><p>Metti alla prova le gilde. Conserva le decisioni. Migliora le AI.</p></div><span className="build">Motore {__AILAB_BUILD__}</span></header>
    <div className="lab-layout">
      <section className="lab-card settings"><h2>Configura la campagna</h2>
        <fieldset disabled={running || !ready}>
          <label>Confronto<select value={config.mode} onChange={event => update('mode', event.target.value as Config['mode'])}><option value="league">Campionato fra le tre difficoltà</option><option value="pair">Due difficoltà a scelta</option></select></label>
          {config.mode === 'pair' && <div className="lab-pair">{(['a', 'b'] as const).map((side, index) => <label key={side}>AI {index + 1}<select value={config[side]} onChange={event => update(side, event.target.value as Config['a'])}>{levels.map(level => <option key={level} value={level}>{labels[level]}</option>)}</select></label>)}</div>}
          <div className="lab-pair"><label>Campi per confronto<input type="number" min="1" max="100" value={config.fields} onChange={event => update('fields', Number(event.target.value))}/></label><label>Seme iniziale<input type="number" min="0" max="4294967295" value={config.seed} onChange={event => update('seed', Number(event.target.value))}/></label></div>
          <div className="lab-pair"><label>PV<select value={config.hp} onChange={event => update('hp', event.target.value === 'mixed' ? 'mixed' : Number(event.target.value) as 3 | 4 | 5)}><option value="mixed">Alterna 3 / 4 / 5</option>{[3,4,5].map(hp => <option key={hp}>{hp}</option>)}</select></label><label>Muri<select value={config.walls} onChange={event => update('walls', event.target.value as Config['walls'])}><option value="mixed">Alterna entrambi</option><option value="standard">Standard</option><option value="varied">Variati</option></select></label></div>
          <label>Limite comandi per partita<input type="number" min="1" max="1000" value={config.limit} onChange={event => update('limit', Number(event.target.value))}/></label>
          <label className="lab-check"><input type="checkbox" checked={config.audit} onChange={event => update('audit', event.target.checked)}/>Controlla le vittorie immediate mancate</label>
        </fieldset>
        <p className="lab-muted">{count} partite · ogni campo a colori invertiti. Una partita alla volta, senza animazioni. Le campagne con Difficile possono richiedere ore.</p>
        <p className="lab-muted">Nuove campagne: campi fisicamente distinti per configurazione, semi distribuiti. Il numero di campi include le varianti di PV e muri selezionate.</p>
        {configError && <p role="alert" className="lab-notice">{configError}</p>}
        <div className="lab-actions"><button className="primary" disabled={running || !ready || !count} onClick={start}>Nuova campagna</button>{running ? <button onClick={stop}>Pausa</button> : pending && <button disabled={Boolean(differentBuild)} onClick={resume}>Riprendi</button>}</div>
        <p className="lab-muted">Una nuova campagna sostituisce quella salvata in questo browser. Esporta prima i risultati da conservare.</p>
      </section>
      <section className="lab-card"><div className="lab-section-title"><h2>Osservatorio</h2><span className={running ? 'lab-status active' : 'lab-status'}>{!ready ? 'Caricamento' : running ? 'In esecuzione' : campaign ? pending ? 'In pausa' : 'Completata' : 'Pronto'}</span></div>
        <div className="lab-stats"><div><strong>{results.length}<small> / {campaign?.cases.length ?? '—'}</small></strong><span>Partite completate</span></div><div><strong>{wins}</strong><span>Esiti decisivi</span></div><div><strong>{results.reduce((sum,row) => sum + row.findings.length, 0)}</strong><span>Vittorie mancate</span></div></div>
        <progress aria-label="Avanzamento campagna" value={results.length} max={campaign?.cases.length || 1}/>
        <p role="status">{running && currentCase ? `Partita ${results.length + 1}: ${labels[currentCase.red]} (rosso) contro ${labels[currentCase.blue]} (blu) · turno ${progress.turn} · ${progress.commands} comandi` : 'I risultati completati vengono salvati automaticamente nel browser.'}</p>
        <div className="lab-actions"><button disabled={!campaign} onClick={() => download('md')}>Scarica report Markdown</button><button disabled={!campaign} onClick={() => download('json')}>Scarica archivio JSON</button></div>
        <p className="lab-muted">Allega entrambi i file a Codex: il report orienta l’analisi, il JSON contiene tutte le posizioni e le mosse per ricostruire le partite. Puoi esportare anche durante la campagna.</p>
        {notice && <p className="lab-notice" role="alert">{notice}</p>}
        {differentBuild && <p className="lab-notice">Questa campagna usa un motore diverso ({campaign.build}). Puoi esportarla; avvia una nuova campagna per provare il motore attuale.</p>}
        <details><summary>Come leggere i risultati</summary><p>Il limite di comandi e la terza ripetizione interrompono la partita senza assegnare una vittoria. Il controllo tattico segnala solo alternative vincenti convalidate dalle regole; una scansione interrotta rimane inconclusiva. Non valuta tutti gli errori strategici.</p><p>Normale e Difficile verificano anche combinazioni letali di due attivazioni nei finali fragili. Il report distingue minacce trovate, scansioni sconosciute, scelte modificate e tempo impiegato. Una verifica interrotta non certifica sicurezza.</p><p>Il seme fissa il campo, ma i budget di tempo possono cambiare le scelte secondo il carico del dispositivo. Dopo una pausa o una ricarica, la partita interrotta riparte dall’inizio. Tieni aperta la pagina e il dispositivo attivo.</p></details>
      </section>
    </div>
    <section className="lab-card lab-results"><h2>Risultati della campagna</h2>
      {campaign && <p className="lab-muted">{campaign.id} · motore {campaign.build} · {new Date(campaign.created).toLocaleString('it-IT')}</p>}
      {campaign && <p className="lab-muted">{distinctFields} posizioni iniziali distinte · {campaign.sampling === 'distinct-v2' ? 'Campionamento con deduplicazione' : 'Campagna precedente: possibili campi duplicati'}</p>}
      {results.length > 0 && <details><summary>Confronti, iniziativa e diagnostica</summary><div className="lab-scroll"><table aria-label="Confronti e iniziativa"><thead><tr><th>Gruppo</th><th>Partite</th><th>Vince primo</th><th>Vince secondo</th><th>Inconcluse</th></tr></thead><tbody>{groupedStatistics(results).filter(row=>!row.group.startsWith('Campo: ')).map(row=><tr key={row.group}><td>{row.group}</td><td>{row.games}</td><td>{row.red}</td><td>{row.blue}</td><td>{row.incomplete}</td></tr>)}</tbody></table></div><div className="lab-scroll"><table aria-label="Diagnostica ricerca"><thead><tr><th>AI / fase</th><th>Media ms</th><th>Nodi</th><th>Profondità</th><th>Round incompleti</th><th>Budget tempo / nodi</th><th>Fallback</th></tr></thead><tbody>{phaseStatistics(results).map(row=><tr key={row.level+row.phase}><td>{labels[row.level]} / {row.phase===2?'extra':row.phase+1}</td><td>{row.averageMs}</td><td>{row.averageNodes}</td><td>{row.averageDepth}</td><td>{row.measured ? row.incomplete : 'n/d'}</td><td>{row.measured ? `${row.timeExhausted} / ${row.nodeExhausted}` : 'n/d'}</td><td>{row.measured ? row.fallbacks : 'n/d'}</td></tr>)}</tbody></table></div><p className="lab-muted">La profondità riguarda una ricerca selettiva. I confronti fra AI diverse non isolano il vantaggio del primo giocatore. Il report Markdown include anche il catalogo e i risultati di ogni campo fisico.</p></details>}
      {results.length > 0 && <div className="lab-scroll"><table aria-label="Riepilogo per difficoltà"><thead><tr><th>Difficoltà</th><th>Vittorie</th><th>Sconfitte</th><th>Inconcluse</th><th>Decisioni</th><th>Media / max</th></tr></thead><tbody>{statistics(results).map(row => <tr key={row.level}><td>{labels[row.level]}</td><td>{row.wins}</td><td>{row.losses}</td><td>{row.incomplete}</td><td>{row.decisions}</td><td>{row.averageMs} / {row.maxMs} ms</td></tr>)}</tbody></table><p className="lab-muted">Conteggio per partecipazione: allo stesso livello vengono contati entrambi i lati.</p></div>}
      {!results.length ? <p className="lab-empty">La prima partita completata apparirà qui.</p> : <div className="lab-scroll"><table aria-label="Partite completate"><thead><tr><th>Campo</th><th>PV / muri</th><th>Rosso</th><th>Blu</th><th>Esito</th><th>Comandi</th><th>Media / max</th><th>Segnali</th></tr></thead><tbody>{results.map(row => {
        const times = row.steps.map(step => step.milliseconds), total = times.reduce((a,b) => a+b, 0);
        return <tr key={row.test.id}><td>{row.test.seed}{row.test.reversed ? ' ↔' : ''}</td><td>{row.test.hp} / {row.test.walls === 'standard' ? 'standard' : 'variati'}</td><td>{labels[row.test.red]}</td><td>{labels[row.test.blue]}</td><td>{({ red: 'Vince rosso', blue: 'Vince blu', limit: 'Limite', repetition: 'Ripetizione', error: 'Errore' })[row.outcome]}</td><td>{times.length}</td><td>{Math.round(total / (times.length || 1))} / {Math.round(Math.max(0, ...times))} ms</td><td>{row.findings.length} vittorie mancate · {row.audits.interrupted} scansioni incomplete{row.error && <p>{row.error}</p>}</td></tr>;
      })}</tbody></table></div>}
    </section>
    <footer>Pagina senza collegamenti dalla home · esclusione dall’indicizzazione richiesta con noindex · accesso tramite URL, senza autenticazione</footer>
  </main>;
}
