import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type FormEvent, type ReactNode } from 'react';
import { applyCommand, backupText, fingerprint, initialState, inviteUrl, makeSession, movementPath, newId, parseInvite, readBackup, reconcile, replay, revision, samePoint, seatFor, squareName, WALLS, type BoardState, type Point, type SessionRecord } from '../model';
import { OnlineSession, connectionLabel } from '../online';
import { listSessions, saveSession, sessionKey } from '../storage';

function Rune({ small = false }: { small?: boolean }) {
  return <svg viewBox="0 0 48 48" aria-hidden="true" className={small ? 'rune small' : 'rune'}><path d="M24 3 42 24 24 45 6 24Z" /><path d="M24 11 35 24 24 37 13 24Z"/><path d="M24 3v42M6 24h36"/></svg>;
}
function Icon({ children }: { children: ReactNode }) { return <span className="button-icon" aria-hidden="true">{children}</span>; }
function FilePicker({ onImport, disabled = false }: { onImport: (file: File) => void; disabled?: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  return <><button className="button ghost" disabled={disabled} onClick={() => input.current?.click()}><Icon>↑</Icon>Importa backup</button><input ref={input} data-testid="import-backup" type="file" accept=".json,application/json" hidden onChange={event => { const file = event.target.files?.[0]; if (file) onImport(file); event.target.value = ''; }} /></>;
}

export function App() {
  const [controller, setController] = useState<OnlineSession | null>(null);
  const [saved, setSaved] = useState<SessionRecord[]>([]);
  const [name, setName] = useState('');
  const [invite, setInvite] = useState(location.hash.startsWith('#invito=') ? location.href : '');
  const [tab, setTab] = useState<'create' | 'join'>(location.hash.startsWith('#invito=') ? 'join' : 'create');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [help, setHelp] = useState(false);

  useEffect(() => {
    let alive = true;
    listSessions().then(records => {
      if (!alive) return;
      setSaved(records);
      if (!location.hash.startsWith('#invito=')) {
        const active = sessionStorage.getItem('sw-lab-active');
        const record = records.find(r => sessionKey(r) === active);
        if (record) setController(new OnlineSession(record));
      }
    }).catch(e => { if (alive) setError(e.message); }).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  async function open(record: SessionRecord) {
    setBusy(true); setError('');
    try {
      await saveSession(record);
      sessionStorage.setItem('sw-lab-active', sessionKey(record));
      history.replaceState(null, '', location.pathname + location.search);
      setController(new OnlineSession(record));
    } catch (e) { setError(e instanceof Error ? e.message : 'Apertura non riuscita.'); }
    finally { setBusy(false); }
  }
  async function submit(event: FormEvent) {
    event.preventDefault(); setError('');
    try {
      if (tab === 'create') await open(makeSession(name));
      else {
        const parsed = parseInvite(invite);
        const previous = saved.find(r => r.role === 'guest' && r.roomId === parsed.roomId && r.joinToken === parsed.joinToken && r.hostPeerId === parsed.hostPeerId);
        await open(previous ?? makeSession(name, parsed));
      }
    } catch (e) { setError(e instanceof Error ? e.message : 'Invito non valido.'); }
  }
  async function importFile(file: File) {
    setError(''); setBusy(true);
    try {
      if (file.size > 2_000_000) throw new Error('Il backup supera il limite di 2 MB.');
      const imported = readBackup(await file.text());
      const existing = (await listSessions()).find(r => sessionKey(r) === sessionKey(imported));
      if (existing) {
        if (existing.joinToken !== imported.joinToken || existing.hostPeerId !== imported.hostPeerId) throw new Error('Il backup non corrisponde all’accesso già salvato.');
        imported.journal = reconcile(existing.journal, imported.journal);
        imported.prepared = null;
        imported.guestCredential = existing.guestCredential ?? imported.guestCredential;
      }
      // Validate before replacing an open session or writing anything.
      await saveSession(imported);
      controller?.dispose();
      await open(imported);
    } catch (e) { setError(e instanceof Error ? e.message : 'Importazione non riuscita.'); }
    finally { setBusy(false); }
  }
  async function home() {
    controller?.dispose(); setController(null); sessionStorage.removeItem('sw-lab-active');
    setError('');
    try { setSaved(await listSessions()); } catch (e) { setError((e as Error).message); }
  }
  return <div className="app-shell">
    <header className="topbar">
      <a className="brand" href="#" onClick={e => { e.preventDefault(); if (controller) void home(); }}><Rune small /><span>Strategic <strong>Wizardry</strong><small>IL LABORATORIO ONLINE</small></span></a>
      <nav aria-label="Navigazione"><span className="prototype-tag">PROTOTIPO 01</span><button className="text-button" onClick={() => setHelp(!help)} aria-expanded={help}>Come funziona <span aria-hidden="true">↗</span></button></nav>
    </header>
    {help && <section className="help-strip"><strong>La prima prova, insieme.</strong><p>Crea una sessione, condividi l’invito e aprilo nell’altro browser. Quando entrambi risultate sincronizzati, spostate le pedine, annullate e provate un’interruzione. Per verificare Internet servono due reti diverse. Questa prova usa regole dimostrative: il gioco completo arriverà in seguito.</p></section>}
    {error && <div className="notice error" role="alert">{error}<button className="text-button" aria-label="Chiudi messaggio" onClick={() => setError('')}>×</button></div>}
    {controller ? <SessionScreen key={sessionKey(controller.getSnapshot().record)} controller={controller} onHome={home} onImport={importFile} importing={busy} /> : <>
      <section className="page-intro"><div><p className="eyebrow"><span />PRIMO PASSAGGIO · CONNESSIONE</p><h1>Mettiamo in contatto<br />le due gilde.</h1><p className="intro-copy">Un invito, due browser, lo stesso campo.<br />Verifichiamo insieme connessione, salvataggio e ripresa.</p></div><div className="intro-mark"><Rune /><span>DUELLO A DISTANZA<br /><b>Senza registrazione</b></span></div></section>
      <main className="main-grid">
        <section className="board-panel"><div className="panel-heading"><div><span className="eyebrow">IL CAMPO</span><h2>Pronti all’incontro</h2></div><span className="subtle-label">10 × 10</span></div><Board state={initialState()} /><div className="board-caption"><span className="caption-dot"/>Due pedine dimostrative. Le regole complete non sono ancora attive.</div></section>
        <aside className="side-column">
          <section className="card entrance"><span className="eyebrow">SCEGLI IL TUO INGRESSO</span><div className="tabs" role="tablist" aria-label="Accesso alla sessione"><button role="tab" aria-selected={tab === 'create'} onClick={() => setTab('create')}>Crea una sessione</button><button role="tab" aria-selected={tab === 'join'} onClick={() => setTab('join')}>Ho un invito</button></div>
            <form onSubmit={submit}><label htmlFor="player-name">Come ti chiami?</label><input id="player-name" name="name" autoComplete="nickname" maxLength={40} value={name} onChange={e => setName(e.target.value)} placeholder="Il tuo nome" required />
              {tab === 'join' && <><label htmlFor="invite-link">Il tuo invito</label><textarea id="invite-link" value={invite} onChange={e => setInvite(e.target.value)} placeholder="Incolla qui il collegamento completo" required rows={3}/></>}
              <button className="button primary full" disabled={busy || loading} type="submit">{busy ? 'Apertura…' : tab === 'create' ? 'Crea sessione' : 'Entra nella sessione'}<Icon>→</Icon></button>
            </form><p className="fine-print">{tab === 'create' ? 'Avrai il posto Rosso. Condividi l’invito per assegnare il posto Blu.' : 'Il creatore deve avere la sessione aperta. Se eri già entrato, riuseremo il tuo accesso locale.'}</p>
          </section>
          <section className="card saved-card"><div className="card-title"><h3>Riprendi il filo</h3><Icon>↺</Icon></div><p>Riapri una sessione di questo browser oppure importa il tuo backup personale.</p>
            {loading ? <p className="muted">Leggo i salvataggi…</p> : saved.length ? <ul className="saved-list">{saved.slice(0, 5).map(record => <li key={sessionKey(record)}><button onClick={() => void open(record)} disabled={busy}><span className={`seat-dot ${seatFor(record.role)}`}/><span>{record.name}<small>{record.role === 'host' ? 'Creatore · Rosso' : 'Ospite · Blu'} · {revision(record.journal)} modifiche</small></span><span aria-hidden="true">↗</span></button></li>)}</ul> : <p className="empty-saves">Qui compariranno le sessioni salvate.</p>}
            <FilePicker onImport={importFile} disabled={busy}/>
          </section>
          <div className="side-note"><span aria-hidden="true">◇</span><p><strong>Una connessione fra persone.</strong>Il servizio pubblico avvia il collegamento; la sessione è salvata nei vostri browser. Alcune reti possono impedirne l’apertura.</p></div>
        </aside>
      </main>
    </>}
    <footer><span>STRATEGIC WIZARDRY <span className="footer-separator">/</span> LABORATORIO DI CONNESSIONE</span><span>Nessun account · Salvataggi locali · Versione 0.1</span></footer>
  </div>;
}

function SessionScreen({ controller, onHome, onImport, importing }: { controller: OnlineSession; onHome: () => void; onImport: (file: File) => void; importing: boolean }) {
  const view = useSyncExternalStore(controller.subscribe, controller.getSnapshot);
  const { record, phase, busy } = view;
  const board = useMemo(() => replay(record.journal), [record.journal]);
  const [draft, setDraft] = useState<Point | null>(null);
  const [rotated, setRotated] = useState(record.role === 'guest');
  const [copied, setCopied] = useState(false);
  const [showHelpers, setShowHelpers] = useState(true);
  const [exportError, setExportError] = useState('');
  const ownSeat = seatFor(record.role);
  const canAct = phase === 'connected' && !busy && board.active === ownSeat;
  const path = draft ? movementPath(board, draft) : null;
  const link = inviteUrl(record);
  const linkInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    controller.start();
    const pageExit = () => controller.pause();
    const pageReturn = (event: PageTransitionEvent) => { if (event.persisted) controller.reconnect(); };
    window.addEventListener('pagehide', pageExit);
    window.addEventListener('pageshow', pageReturn);
    return () => { window.removeEventListener('pagehide', pageExit); window.removeEventListener('pageshow', pageReturn); controller.dispose(); };
  }, [controller]);
  useEffect(() => { setDraft(null); }, [record.journal, phase]);
  useEffect(() => { if (!copied) return; const timer = setTimeout(() => setCopied(false), 2500); return () => clearTimeout(timer); }, [copied]);
  function command(kind: 'move' | 'undo' | 'end-turn') {
    if (!canAct || kind === 'move' && !draft) return;
    controller.request(kind === 'move' ? { id: newId(), kind, actor: ownSeat, to: draft! } : { id: newId(), kind, actor: ownSeat });
    setDraft(null);
  }
  async function copyLink() {
    try { await navigator.clipboard.writeText(link); setCopied(true); }
    catch { linkInput.current?.focus(); linkInput.current?.select(); setCopied(false); }
  }
  function exportBackup() {
    setExportError('');
    try {
      const blob = new Blob([backupText(record)], { type: 'application/json' });
      const url = URL.createObjectURL(blob); const a = document.createElement('a');
      a.href = url; a.download = `wizardry-${record.roomId.slice(0, 8)}-${ownSeat}-r${revision(record.journal)}.json`;
      a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch { setExportError('Esportazione non riuscita. Riprova prima di chiudere la pagina.'); }
  }
  const journalRows = useMemo(() => {
    let previous = initialState();
    return record.journal.events.map((event, i) => {
      const who = event.actor === 'red' ? 'Rosso' : 'Blu';
      const text = event.kind === 'move' ? `${who}: ${squareName(previous.positions[event.actor])} → ${squareName(event.to)}` : event.kind === 'undo' ? `${who}: spostamento annullato` : `${who}: turno concluso`;
      previous = applyCommand(previous, event);
      return { id: event.id, text, number: i + 1, actor: event.actor };
    }).slice(-5).reverse();
  }, [record.journal]);
  const stage = phase === 'connected' ? 3 : ['connecting', 'syncing'].includes(phase) ? 2 : 1;
  return <>
    <section className="session-intro"><div><button className="text-button back" disabled={busy} onClick={onHome}>← Le mie sessioni</button><h1>Le gilde si incontrano.</h1><p>Campo dimostrativo · fino a 3 passi per spostamento · 2 spostamenti per turno</p></div><div className={`status-pill ${phase === 'connected' ? 'online' : ['error', 'offline', 'paused'].includes(phase) ? 'attention' : ''}`} role="status" aria-live="polite" data-testid="connection-state"><span/>{connectionLabel(phase)}</div></section>
    <div className={`connection-steps ${phase === 'connected' ? 'completed' : ''}`} aria-label="Avanzamento del collegamento">{['Invito', 'Collegamento', 'Stato sincronizzato'].map((label, i) => <span key={label} className={stage >= i + 1 ? 'reached' : ''}><b>{stage > i + 1 ? '✓' : `0${i + 1}`}</b>{label}</span>)}</div>
    {view.error && <div className="notice error" role="alert">{view.error}</div>}
    <div className={`notice connection-notice ${phase === 'connected' ? 'success' : ''}`} aria-live="polite"><span aria-hidden="true">{phase === 'connected' ? '✓' : '◇'}</span>{view.message}</div>
    <main className="main-grid active-grid">
      <section className="board-panel"><div className="panel-heading"><div><span className="eyebrow">CAMPO DI PROVA</span><h2>{phase !== 'connected' ? 'In attesa del collegamento' : board.active === ownSeat ? 'Tocca alla tua gilda' : 'Tocca all’altra gilda'}</h2></div><button className="round-button" onClick={() => setRotated(!rotated)} aria-label="Ruota la scacchiera" title="Ruota la scacchiera">↻</button></div>
        <div className="board-player"><span className={`seat-dot ${ownSeat === 'red' ? 'blue' : 'red'}`}/>{record.remoteName || 'In attesa dell’avversario'}<span className="player-place">Avversario</span></div>
        <Board state={board} rotated={rotated} path={path} onSelect={canAct && board.moves < 2 ? setDraft : undefined} helpers={showHelpers}/>
        <div className="board-player own"><span className={`seat-dot ${ownSeat}`}/>{record.name}<span className="player-place">Tu · {ownSeat === 'red' ? 'Rosso' : 'Blu'}</span></div>
        <div className="board-caption"><span className="caption-dot"/>Prova tecnica: le pedine non rappresentano ancora i maghi del gioco completo.</div>
      </section>
      <aside className="side-column">
        <section className="card action-card"><div className="card-title"><h3>Comandi di turno</h3><span className={`guild-label ${board.active}`}>{board.active === 'red' ? 'Rosso' : 'Blu'}</span></div>
          <div className="turn-summary"><span>Turno <b>{board.turn}</b></span><span>Spostamenti <b>{board.moves} / 2</b></span></div>
          <div className={`draft-preview ${path ? 'has-draft' : ''}`}><span className="eyebrow">{busy ? 'CONFERMA IN CORSO' : path ? 'LA TUA ANTEPRIMA' : 'PREPARA LO SPOSTAMENTO'}</span><p>{busy ? 'Attendo il salvataggio e il riscontro dell’altro browser.' : path ? <><strong>{squareName(path[0])} → {squareName(path[path.length - 1])}</strong><span>{path.length - 1} {path.length === 2 ? 'passo' : 'passi'} · visibile solo a te fino alla conferma</span></> : canAct ? board.moves < 2 ? 'Scegli una casella evidenziata. Potrai cambiare idea prima di confermare.' : 'Puoi annullare uno spostamento o terminare il turno.' : phase === 'connected' ? 'Puoi osservare il campo mentre l’altro giocatore prepara le sue scelte.' : 'I comandi saranno disponibili quando i browser saranno sincronizzati.'}</p></div>
          <button className="button primary full" disabled={!canAct || !path || board.moves >= 2} onClick={() => command('move')}>Conferma spostamento<Icon>→</Icon></button>
          <div className="button-row"><button className="button secondary" disabled={!canAct || !board.undo.length} onClick={() => command('undo')}><Icon>↶</Icon>Annulla</button><button className="button secondary" disabled={!canAct || !board.moves} onClick={() => command('end-turn')}>Termina turno</button></div>
          <label className="checkbox-label"><input type="checkbox" checked={showHelpers} onChange={e => setShowHelpers(e.target.checked)}/>Mostra caselle raggiungibili</label>
        </section>
        <section className="card connection-card"><div className="card-title"><h3>Il collegamento</h3><Icon>⌁</Icon></div>
          {record.role === 'host' && <><label htmlFor="share-invite">Invito per il posto Blu</label><div className="copy-row"><input id="share-invite" ref={linkInput} value={link} readOnly onFocus={e => e.target.select()} /><button className="button secondary" onClick={copyLink}>{copied ? 'Copiato' : 'Copia invito'}</button></div></>}
          {['localhost', '127.0.0.1', '[::1]'].includes(location.hostname) && <p className="fine-print local-warning">Questo indirizzo locale funziona su questo computer. Per invitare da un altro dispositivo servirà la pubblicazione HTTPS su GitHub Pages.</p>}
          <div className="button-row"><button className="button ghost" onClick={controller.reconnect}>↻ Ricollega</button><button className="button ghost" disabled={phase === 'paused'} onClick={controller.pause}>Interrompi per prova</button></div>
          <details><summary>Dettagli della connessione</summary><dl className="technical-details"><dt>Sessione</dt><dd>{record.roomId.slice(0, 8)}</dd><dt>Revisione</dt><dd data-testid="revision">{revision(record.journal)}</dd><dt>Impronta</dt><dd data-testid="fingerprint">{fingerprint(record.journal)}</dd><dt>Servizio</dt><dd>{view.localSignaling ? 'PeerServer locale di test' : 'PeerServer Cloud pubblico'}</dd></dl></details>
        </section>
        <section className="card backup-card"><div className="card-title"><h3>Il filo è al sicuro</h3><span className="saved-indicator">● Salvato qui</span></div><p>Ultimo salvataggio alle {new Date(view.savedAt).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'Europe/Rome' })}. {phase === 'connected' && !busy ? 'Entrambi conservate la vostra copia nel browser.' : 'La tua copia locale è conservata in questo browser.'}</p><div className="button-row"><button className="button ghost" onClick={exportBackup}>↓ Esporta backup</button><FilePicker onImport={onImport} disabled={busy || importing}/></div><p className="fine-print">Il backup contiene il tuo accesso personale. Conservalo per riprendere il tuo posto, anche su un altro dispositivo.</p>{exportError && <p role="alert" className="inline-error">{exportError}</p>}</section>
      </aside>
    </main>
    <section className="history-panel"><div><p className="eyebrow">CRONOLOGIA CONDIVISA</p><h3>Gli ultimi passaggi</h3></div>{journalRows.length ? <ol>{journalRows.map(row => <li key={row.id}><span className="history-number">{String(row.number).padStart(2, '0')}</span><span className={`seat-dot ${row.actor}`}/>{row.text}</li>)}</ol> : <p>La prima modifica confermata comparirà qui, su entrambi i browser.</p>}</section>
  </>;
}

function Board({ state, rotated = false, path = null, onSelect, helpers = true }: { state: BoardState; rotated?: boolean; path?: Point[] | null; onSelect?: (point: Point) => void; helpers?: boolean }) {
  const columns = Array.from({ length: 10 }, (_, i) => String.fromCharCode(65 + (rotated ? 9 - i : i)));
  const pathToScreen = (p: Point) => `${((rotated ? 9 - p.x : p.x) + .5) * 100},${((rotated ? 9 - p.y : p.y) + .5) * 100}`;
  return <div className="board-frame"><div className="file-labels">{columns.map(c => <span key={c}>{c}</span>)}</div><div className="board-with-ranks"><div className="rank-labels">{Array.from({ length: 10 }, (_, i) => <span key={i}>{rotated ? i + 1 : 10 - i}</span>)}</div><div className="board-grid" role="group" aria-label="Campo dimostrativo 10 per 10">{Array.from({ length: 100 }, (_, index) => {
    const displayX = index % 10, displayY = Math.floor(index / 10);
    const point = { x: rotated ? 9 - displayX : displayX, y: rotated ? 9 - displayY : displayY };
    const piece = samePoint(state.positions.red, point) ? 'red' : samePoint(state.positions.blue, point) ? 'blue' : null;
    const wall = WALLS.some(w => samePoint(w, point));
    const reachable = Boolean(onSelect && movementPath(state, point));
    const selected = path && samePoint(path[path.length - 1], point);
    const alongPath = path?.some(p => samePoint(p, point));
    return <button key={`${point.x},${point.y}`} className={`cell ${(displayX + displayY) % 2 ? 'alternate' : ''} ${reachable && helpers ? 'reachable' : ''} ${selected ? 'selected' : ''} ${alongPath ? 'on-path' : ''} ${wall ? 'wall' : ''}`} aria-label={`Casella ${squareName(point)}${piece ? `, pedina ${piece === 'red' ? 'Rossa' : 'Blu'}` : wall ? ', muro' : ''}`} disabled={!reachable} onClick={() => onSelect?.(point)} data-square={squareName(point)}>{wall ? <span className="wall-symbol" aria-hidden="true">▰</span> : piece ? <span className={`piece ${piece}`}><Rune small /><span className="piece-gem"/></span> : selected ? <span className="destination" aria-hidden="true">✦</span> : reachable && helpers ? <span className="reachable-dot"/> : null}</button>;
  })}{path && <svg className="path-overlay" viewBox="0 0 1000 1000" aria-hidden="true"><polyline points={path.map(pathToScreen).join(' ')} /></svg>}</div></div></div>;
}
