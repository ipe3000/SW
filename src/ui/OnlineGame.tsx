import { GameMessageError, formatMessage } from '../i18n/messages';
import { useLanguage } from '../i18n/language';
import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type FormEvent } from 'react';
import { defaultOptions, sideName, type Match, type Options } from '../engine/game';
import { presentChange, type Presentation } from '../engine/presentation';
import { backupText, fingerprint, inviteUrl, makeSession, newId, parseInvite, readBackup, replay, seatFor, type SessionRecord } from '../network/model';
import { importSession, listSessions, saveSession, sessionKey } from '../network/storage';
import { connectionLabel, OnlineSession } from '../network/session';
import { GameScreen } from './LocalGame';
import { GameModes, type GameMode } from './GameModes';
import { EntryScene, SavedGames } from './EntryScene';
import { MatchOptions } from './MatchOptions';
import { createPortal } from 'react-dom';
import { GameNavigation, useGameMenu } from './GameNavigation';

const errorText = (e: unknown) => e instanceof Error ? e : new GameMessageError('onlineOperationFailed');
function download(record: SessionRecord) {
  const url = URL.createObjectURL(new Blob([backupText(record)], { type: 'application/json' }));
  const a = document.createElement('a'); a.href = url; a.download = `sw-online-${record.roomId.slice(0, 8)}-${record.role}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function OnlineGame({ onModeChange, onTutorial, suspended }: { onModeChange: (mode: GameMode) => void; onTutorial?: (fromMatch: boolean) => void; suspended?: boolean }) {
  const { language } = useLanguage();
  const [record, setRecord] = useState<SessionRecord | null>(null), [saved, setSaved] = useState<SessionRecord[]>([]);
  const [name, setName] = useState(''), [invite, setInvite] = useState(location.hash.startsWith('#duello=') ? location.href : '');
  const [options, setOptions] = useState<Options>({ ...defaultOptions }), [error, setError] = useState<Error | ''>(''), [busy, setBusy] = useState(true);
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
    window.scrollTo(0, 0);
    setRecord(null); sessionStorage.removeItem('sw-online-active'); history.replaceState(null, '', '?online=1');
    try { setSaved(await listSessions()); } catch (e) { setError(errorText(e)); }
  }
  async function restore(file: File) {
    setBusy(true); setError('');
    try { if (file.size > 8_000_000) throw new GameMessageError('onlineBackupTooLarge'); open(await importSession(readBackup(await file.text()))); }
    catch (e) { setError(errorText(e)); } finally { setBusy(false); }
  }
  return <div className={`app-shell local-app ${record ? 'in-match' : ''}`}>
    {record ? <ConnectedGame key={sessionKey(record)} initial={record} suspended={suspended} onTutorial={onTutorial} onExit={() => void home()}/> :
    <GameNavigation inMatch={false} online onTutorial={onTutorial} onExit={() => void home()}>
    {error && <div className="notice error" role="alert">{error instanceof GameMessageError ? formatMessage(error.code, language) : error.message}</div>}
      <main className="local-home online-home fantasy-entry"><EntryScene/><section className="card new-game"><h2>{(language === 'en' ? "New match" : "Nuova partita")}</h2><GameModes value="online" onChange={onModeChange}/><p className="online-mode-intro">{(language === 'en' ? "Invite a friend with a link or join using an invitation you received." : "Invita un amico con un link oppure entra con l’invito che hai ricevuto.")}</p><label>{(language === "en" ? "Your name" : "Come ti chiami?")}<input value={name} maxLength={40} onChange={e => setName(e.target.value)}/></label>
        <form onSubmit={e => void create(e, false)}>
          <MatchOptions value={options} onChange={setOptions}/>
          <button className="button primary full" disabled={busy}>{(language === "en" ? "Create duel and invitation →" : "Crea duello e invito →")}</button>
        </form>
        <details className="join-online-entry" open={Boolean(invite.trim()) || undefined}><summary>{(language === "en" ? "Have an invitation?" : "Hai un invito?")}</summary><form className="join-online" onSubmit={e => void create(e, true)}><label>{(language === "en" ? "Invitation link" : "Link d’invito")}<input value={invite} onChange={e => setInvite(e.target.value)} placeholder={(language === "en" ? "Paste your invitation link" : "Incolla il link ricevuto")}/></label><button className="button secondary full" disabled={busy || !invite.trim()}>{(language === "en" ? "Join duel" : "Entra nel duello")}</button></form></details>
      <SavedGames loading={busy} items={saved.map(r => <li key={sessionKey(r)}><button onClick={() => open(r)}><span className={`seat-dot ${seatFor(r.role)}`}/><span>{r.name} / {r.remoteName || (language === "en" ? "waiting" : "in attesa")}<small>Gilda {sideName(seatFor(r.role))} · {r.journal.events.length} conferme · {new Date(r.updatedAt).toLocaleString(language === 'en' ? 'en' : 'it-IT')}</small></span><span>↗</span></button></li>)} importer={<><button className="button ghost" disabled={busy} onClick={() => input.current?.click()}>{(language === "en" ? "↑ Import personal backup" : "↑ Importa backup personale")}</button><input ref={input} type="file" hidden accept=".json,application/json" data-testid="import-online" onChange={e => { const file = e.target.files?.[0]; if (file) void restore(file); e.target.value = ''; }}/>
</>}><details className="backup-info"><summary>{(language === "en" ? "About backups" : "Informazioni sui backup")}</summary><p>{(language === "en" ? "Your backup grants access to your seat. Keep it private and use it to switch browsers or devices." : "Il backup contiene il tuo accesso personale: conservalo e non condividerlo come invito. Serve per cambiare browser o dispositivo.")}</p></details></SavedGames></section></main>
    </GameNavigation>}
  </div>;
}

function ConnectedGame({ initial, suspended, onTutorial, onExit }: { initial: SessionRecord; suspended?: boolean; onTutorial?: (fromMatch: boolean) => void; onExit: () => void }) {
  const { language } = useLanguage();
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
  const inviteControls = <div className="online-invite">
    <label>{(language === "en" ? "Invitation to play Blue" : "Invito per il posto Blu")}<input readOnly value={inviteUrl(r)} onFocus={e => e.target.select()}/></label>
    <button className="button secondary" onClick={() => {
      void navigator.clipboard.writeText(inviteUrl(r)).then(() => setCopied(true)).catch(() => setCopied(false));
    }}>{copied ? (language === "en" ? "Invitation copied" : "Invito copiato") : (language === "en" ? "Copy invitation" : "Copia invito")}</button>
  </div>;
  const panel = <section className="card online-status" aria-label={(language === "en" ? "Online connection" : "Collegamento online")}><div className="card-title"><h3><span className={`seat-dot ${seatFor(r.role)}`}/>{language === 'en' ? `You play ${seatFor(r.role) === 'red' ? 'Red' : 'Blue'}` : `Tu: ${sideName(seatFor(r.role))}`}</h3><span className="saved-indicator connection-state-label">{connectionLabel(view.phase, language)}</span></div>
    <p role="status">{view.busy ? (language === "en" ? "Confirming. Wait for both browsers to save." : "Conferma in corso. Attendi il salvataggio nei due browser.") : view.waitingForPlayback ? (language === "en" ? "Waiting for both players to finish watching. You can choose Show outcome to continue." : "Attendo che entrambi abbiano visto la sequenza. Per proseguire puoi usare «Mostra esito».") : session.messageText(language)}</p>
    {r.outbox && <p className="status-note">{(language === "en" ? "A pending request was saved. It will be checked and recovered on reconnect." : "Una richiesta è salvata in attesa: verrà verificata e recuperata alla riconnessione.")}</p>}
    {view.error && <div className="notice error" role="alert">{session.errorText(language)}</div>}
    <div className="button-row"><button className="button ghost" onClick={session.reconnect}>{(language === "en" ? "Reconnect" : "Ricollega")}</button><button className="button ghost" onClick={session.pause}>{(language === "en" ? "Pause connection" : "Sospendi collegamento")}</button></div>
    {r.role === 'host' && <details open={!r.remoteName}><summary>{(language === "en" ? "Invite a friend" : "Invito per un amico")}</summary>{inviteControls}</details>}
    <details><summary>{(language === "en" ? "Technical details" : "Dettagli tecnici")}</summary><p className="fine-print">{language === "en" ? "Confirmed actions" : "Conferme"}: <span data-testid="revision">{r.journal.events.length}</span> · {language === "en" ? "Fingerprint" : "Verifica"}: <span data-testid="fingerprint">{digest}</span></p></details>
  </section>;
  // Use canonical names in the journal; display the names authenticated by the handshake.
  const match = display.match && { ...display.match, game: { ...display.match.game, options: { ...display.match.game.options, redName: r.role === 'host' ? r.name : r.remoteName || 'Gilda Rossa', blueName: r.role === 'guest' ? r.name : r.remoteName || 'Gilda Blu' } } };
  return <GameNavigation inMatch online suspended={suspended} waiting={!match} busy={view.busy} onTutorial={onTutorial} onExit={onExit}>
    {match ? <GameScreen match={match} presentation={display.presentation} save={async () => { throw new Error('Usa un comando online.'); }} busy={view.busy} online={{ status: connectionLabel(view.phase, language), revision: r.journal.events.length, fingerprint: digest, side: seatFor(r.role), enabled: view.ready, phase: view.phase, panel, invite: r.role === 'host' && !r.remoteName ? inviteControls : null, perform: action => session.request({ id: newId(), actor: seatFor(r.role), at: new Date().toISOString(), action }), displayed: session.displayed, exportBackup: () => download(r) }}/> : <><main className="local-home"><section className="card"><h1>{(language === "en" ? "Waiting for the shared board" : "Attendo il campo condiviso")}</h1><p>{(language === "en" ? "The host will send the shared deployment, dice, and walls. You will play the Blue Guild." : "Il creatore invierà lo stesso schieramento, gli stessi dadi e gli stessi muri. Giocherai con la gilda Blu.")}</p><p role="status" data-testid="connection-state">{connectionLabel(view.phase, language)}</p><p>{session.messageText(language)}</p>{panel}</section></main><WaitingMenu panel={panel} record={r}/></>}
  </GameNavigation>;
}

function WaitingMenu({ panel, record }: { panel: React.ReactNode; record: SessionRecord }) {
  const { language } = useLanguage();
  const { menuBody, section } = useGameMenu();
  return menuBody && createPortal(section === 'connection' ? panel : section === 'match' ? <section className="game-menu-match">
    <button className="button secondary" onClick={() => download(record)}>{(language === "en" ? "Export personal backup" : "Esporta backup personale")}</button>
    <p>Il backup contiene il tuo accesso personale al duello.</p>
  </section> : null, menuBody);
}
