import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type FormEvent } from 'react';
import { defaultOptions, sideName, type Match, type Options } from '../engine/game';
import { presentChange, type Presentation } from '../engine/presentation';
import { backupText, fingerprint, inviteUrl, makeSession, newId, parseInvite, readBackup, replay, seatFor, type SessionRecord } from '../network/model';
import { importSession, listSessions, saveSession, sessionKey } from '../network/storage';
import { connectionLabel, OnlineSession } from '../network/session';
import { GameScreen } from './LocalGame';

const errorText = (e: unknown) => e instanceof Error ? e.message : 'Operazione non riuscita.';
function download(record: SessionRecord) {
  const url = URL.createObjectURL(new Blob([backupText(record)], { type: 'application/json' }));
  const a = document.createElement('a'); a.href = url; a.download = `sw-online-${record.roomId.slice(0, 8)}-${record.role}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function OnlineGame() {
  const [record, setRecord] = useState<SessionRecord | null>(null), [saved, setSaved] = useState<SessionRecord[]>([]);
  const [name, setName] = useState(''), [invite, setInvite] = useState(location.hash.startsWith('#duello=') ? location.href : '');
  const [options, setOptions] = useState<Options>({ ...defaultOptions }), [error, setError] = useState(''), [busy, setBusy] = useState(true);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    let alive = true;
    listSessions().then(items => {
      if (!alive) return; setSaved(items);
      const active = sessionStorage.getItem('sw-online-active');
      // A newly received invite must never reopen an unrelated or host seat automatically.
      const incoming = location.hash.startsWith('#duello=') ? parseInvite(location.href) : null;
      const found = incoming ? items.find(r => r.role === 'guest' && r.roomId === incoming.roomId && r.joinToken === incoming.joinToken) : items.find(r => sessionKey(r) === active);
      if (found) { setRecord(found); sessionStorage.setItem('sw-online-active', sessionKey(found)); }
    }).catch(e => { if (alive) setError(errorText(e)); }).finally(() => { if (alive) setBusy(false); });
    return () => { alive = false; };
  }, []);
  function open(value: SessionRecord) { sessionStorage.setItem('sw-online-active', sessionKey(value)); setRecord(value); setError(''); window.scrollTo(0, 0); }
  async function create(e: FormEvent, join: boolean) {
    e.preventDefault(); setBusy(true); setError('');
    try {
      const parsed = join ? parseInvite(invite) : undefined;
      const existing = parsed && saved.find(r => r.role === 'guest' && r.roomId === parsed.roomId && r.joinToken === parsed.joinToken);
      const value = existing || makeSession(name, parsed, options);
      if (!existing) await saveSession(value); open(value);
    } catch (e) { setError(errorText(e)); } finally { setBusy(false); }
  }
  async function home() {
    setRecord(null); sessionStorage.removeItem('sw-online-active'); history.replaceState(null, '', '?online=1');
    try { setSaved(await listSessions()); } catch (e) { setError(errorText(e)); }
  }
  async function restore(file: File) {
    setBusy(true); setError('');
    try { if (file.size > 8_000_000) throw new Error('Backup troppo grande (massimo 8 MB).'); open(await importSession(readBackup(await file.text()))); }
    catch (e) { setError(errorText(e)); } finally { setBusy(false); }
  }
  return <div className={`app-shell local-app ${record ? 'in-match' : ''}`}>
    <header className="topbar"><a className="brand" href="./"><span className="brand-diamond">◇</span><span>Strategic <strong>Wizardry</strong><small>OTTO MAGHI. UNA STRATEGIA.</small></span></a><nav><a className="text-button" href="./">Partite locali</a></nav></header>
    {error && <div className="notice error" role="alert">{error}</div>}
    {record ? <ConnectedGame key={sessionKey(record)} initial={record} home={() => void home()}/> : <>
      <section className="page-intro"><div><p className="eyebrow">IL DUELLO A DISTANZA</p><h1>Due gilde.<br/>Un campo condiviso.</h1><p className="intro-copy">Invita un amico e giocate dal vivo. Nessuna registrazione.<br/>Il creatore gioca Rosso, l’invitato Blu.</p></div></section>
      <main className="local-home online-home"><section className="card"><h2>Prepara il duello</h2><label>Come ti chiami?<input value={name} maxLength={40} onChange={e => setName(e.target.value)}/></label>
        <form onSubmit={e => void create(e, false)}>
          <label>Punti vita iniziali<select value={options.hp} onChange={e => setOptions({ ...options, hp: Number(e.target.value) as Options['hp'] })}><option value={3}>3 PV</option><option value={4}>4 PV · standard</option><option value={5}>5 PV</option></select></label>
          <label>Muri di forza<select value={options.walls} onChange={e => setOptions({ ...options, walls: e.target.value as Options['walls'] })}><option value="standard">Standard · due dadi</option><option value="varied">Alternativa · quattro settori</option></select></label>
          <label>Schieramento<select value={options.placement} onChange={e => setOptions({ ...options, placement: e.target.value as Options['placement'] })}><option value="standard">Standard</option><option value="custom">Personalizzato · 4 / 6 / 2 / 2 / 2</option></select></label>
          <button className="button primary full" disabled={busy}>Crea duello e invito →</button>
        </form>
        <form className="join-online" onSubmit={e => void create(e, true)}><h3>Hai già un invito?</h3><label>Link d’invito<input value={invite} onChange={e => setInvite(e.target.value)} placeholder="Incolla il link ricevuto"/></label><button className="button secondary full" disabled={busy || !invite.trim()}>Entra nel duello</button></form>
      </section><section className="card saved-card"><h2>Riprendi una partita online</h2><p>I due browser conservano campo, attivazioni e annullamenti. Riapri il tuo posto e attendi il rientro dell’amico.</p>
        {busy ? <p>Leggo i salvataggi…</p> : saved.length ? <ul className="saved-list">{saved.map(r => <li key={sessionKey(r)}><button onClick={() => open(r)}><span className={`seat-dot ${seatFor(r.role)}`}/><span>{r.name} / {r.remoteName || 'in attesa'}<small>Gilda {sideName(seatFor(r.role))} · {r.journal.events.length} conferme · {new Date(r.updatedAt).toLocaleString('it-IT')}</small></span><span>↗</span></button></li>)}</ul> : <p>Nessuna partita online salvata.</p>}
        <button className="button ghost" disabled={busy} onClick={() => input.current?.click()}>↑ Importa backup personale</button><input ref={input} type="file" hidden accept=".json,application/json" data-testid="import-online" onChange={e => { const file = e.target.files?.[0]; if (file) void restore(file); e.target.value = ''; }}/>
        <p className="fine-print">Il backup contiene il tuo accesso personale: conservalo e non condividerlo come invito. Serve per cambiare browser o dispositivo.</p><p className="fine-print">Connessione diretta fra amici: alcune reti possono impedire il collegamento. Nessun orologio e nessuna sconfitta per disconnessione. Il recupero richiede i dati di almeno un browser e gli accessi personali di entrambi.</p>
      </section></main>
    </>}
    <footer><span>STRATEGIC WIZARDRY / IL DUELLO DELLE GILDE</span><span>Online con invito · Salvataggi nei browser</span></footer>
  </div>;
}

function ConnectedGame({ initial, home }: { initial: SessionRecord; home: () => void }) {
  const session = useMemo(() => new OnlineSession(initial), [initial]);
  const view = useSyncExternalStore(session.subscribe, session.getSnapshot), r = view.record;
  useEffect(() => {
    session.start();
    const leave = () => session.pause(), resume = (e: PageTransitionEvent) => { if (e.persisted) session.reconnect(); };
    window.addEventListener('pagehide', leave); window.addEventListener('pageshow', resume);
    return () => { window.removeEventListener('pagehide', leave); window.removeEventListener('pageshow', resume); session.dispose(); };
  }, [session]);
  const digest = fingerprint(r.journal);
  const canonical = useMemo(() => r.journal.initial ? replay(r.journal) : null, [r.journal]);
  const [display, setDisplay] = useState<{ digest: string; journal: SessionRecord['journal']; match: Match | null; presentation: Presentation | null }>({ digest, journal: r.journal, match: canonical, presentation: null });
  if (display.digest !== digest) {
    const event = r.journal.events.at(-1), regular = view.phase === 'connected' && display.match && canonical && r.journal.events.length === display.journal.events.length + 1;
    setDisplay({ digest, journal: r.journal, match: canonical, presentation: regular ? presentChange(display.match!, canonical!, event?.action.kind === 'activate' ? event.action.activation : undefined) : null });
  }
  const [copied, setCopied] = useState(false);
  const panel = <section className="card online-status" aria-label="Collegamento online"><div className="card-title"><h3><span className={`seat-dot ${seatFor(r.role)}`}/>Tu: {sideName(seatFor(r.role))}</h3><span className="saved-indicator" data-testid="connection-state">{connectionLabel(view.phase)}</span></div>
    <p role="status">{view.busy ? 'Conferma in corso. Attendi il salvataggio nei due browser.' : view.waitingForPlayback ? 'Attendo che entrambi abbiano visto la sequenza. Per proseguire puoi usare «Mostra esito».' : view.message}</p>
    {r.outbox && <p className="status-note">Una richiesta è salvata in attesa: verrà verificata e recuperata alla riconnessione.</p>}
    {view.error && <div className="notice error" role="alert">{view.error}</div>}
    <div className="button-row"><button className="button ghost" onClick={session.reconnect}>Ricollega</button><button className="button ghost" onClick={session.pause}>Sospendi collegamento</button></div>
    <details open={!r.remoteName}><summary>Invito e recupero</summary><label>Invito per il posto Blu<input readOnly value={inviteUrl(r)} onFocus={e => e.target.select()}/></label><button className="button secondary" onClick={() => { void navigator.clipboard.writeText(inviteUrl(r)).then(() => setCopied(true)).catch(() => setCopied(false)); }}>{copied ? 'Invito copiato' : 'Copia invito'}</button><p className="fine-print">Rientra dallo stesso browser o importa il tuo backup personale. Il posto Blu, una volta assegnato, rimane riservato.</p><p className="fine-print">Conferme: <span data-testid="revision">{r.journal.events.length}</span> · Verifica: <span data-testid="fingerprint">{digest}</span></p></details>
  </section>;
  // Use canonical names in the journal; display the names authenticated by the handshake.
  const match = display.match && { ...display.match, game: { ...display.match.game, options: { ...display.match.game.options, redName: r.role === 'host' ? r.name : r.remoteName || 'Gilda Rossa', blueName: r.role === 'guest' ? r.name : r.remoteName || 'Gilda Blu' } } };
  return match ? <GameScreen match={match} presentation={display.presentation} save={async () => { throw new Error('Usa un comando online.'); }} busy={view.busy} home={home} online={{ side: seatFor(r.role), enabled: view.ready, phase: view.phase, panel, perform: action => session.request({ id: newId(), actor: seatFor(r.role), at: new Date().toISOString(), action }), displayed: session.displayed, exportBackup: () => download(r) }}/> : <main className="local-home"><section className="card"><h1>Attendo il campo condiviso</h1><p>Il creatore invierà lo stesso schieramento, gli stessi dadi e gli stessi muri. Giocherai con la gilda Blu.</p>{panel}<button className="text-button" onClick={home}>← Le mie partite online</button><button className="button ghost" onClick={() => download(r)}>↓ Esporta backup personale</button></section></main>;
}
