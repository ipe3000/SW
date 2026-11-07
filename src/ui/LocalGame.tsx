import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { activate, at, canEnter, charmed, commitSkip, copyAt, copyRoute, count, defaultOptions, deploymentInfo, empty, finishTurn, INFO, isWall, newMatch, other, phaseName, previewActivation, sideName, speed, targetPoints, teleportDestinations, wizard, type Activation, type Game, type Match, type Options, type Side, type Spell, type Wizard } from '../engine/game';
import { adjacent, distance, same, shortestPath, square, type Point } from '../engine/geometry';
import { importMatch } from '../engine/backup';
import { loadMatches, saveMatch } from '../game-storage';
import { BoardGrid, ForceWall } from './BoardGrid';
import { useComputer } from './useComputer';
import { ComputerSpeedSelect } from './ComputerSpeedSelect';
import { ComputerPanel } from './ComputerPanel';
import { cuesAt, presentChange, type Presentation } from '../engine/presentation';
import { usePresentation } from './usePresentation';
import { ActionPresentation } from './ActionPresentation';
import type { ComputerSpeed } from '../engine/game';
import { gameText } from './text';
import { applyGameAction, type GameAction } from '../engine/commands';

function Portrait({ mage, copy = false }: { mage: Wizard; copy?: boolean }) {
  const info = INFO[mage.kind];
  return <span className={`mage-token ${mage.side} ${copy ? 'illusion-token' : ''}`} aria-hidden="true">
    <svg className="mage-face" viewBox={`${82 + info.portrait * 71.2} 16 66 52`}><image href={`${import.meta.env.BASE_URL}assets/wizard-roster.png`} width="735" height="733" /></svg>
    <span className="mage-footer"><span className="mage-abbr">{copy ? 'COPIA' : info.short}</span>{!copy && mage.restrainedUntil !== undefined && <span className="mage-restraint">⛓</span>}{!copy && <span className="mage-hp">{mage.hp}</span>}</span>
  </span>;
}
function ImportButton({ onFile, disabled }: { onFile: (file: File) => void; disabled: boolean }) {
  const ref = useRef<HTMLInputElement>(null);
  return <><button className="button ghost" disabled={disabled} onClick={() => ref.current?.click()}>↑ Importa partita</button><input type="file" accept=".json,application/json" hidden data-testid="import-game" ref={ref} onChange={e => { const file = e.target.files?.[0]; if (file) onFile(file); e.target.value = ''; }} /></>;
}
function exportGame(match: Match) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(match, null, 2)], { type: 'application/json' }));
  const a = document.createElement('a'); a.href = url; a.download = `strategic-wizardry-${match.game.id.slice(0, 8)}-r${match.revision}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const message = (e: unknown) => e instanceof Error ? e.message : 'Operazione non riuscita.';
const nameOf = (g: Game, side = g.active) => side === 'red' ? g.options.redName : g.options.blueName;

export function LocalGame() {
  const [match, setMatch] = useState<Match | null>(null), [saved, setSaved] = useState<Match[]>([]);
  useEffect(() => { window.scrollTo(0, 0); }, [match?.game.id]);
  const [presentation, setPresentation] = useState<Presentation | null>(null);
  const [options, setOptions] = useState<Options>({ ...defaultOptions });
  const [opponent, setOpponent] = useState<'local' | 'computer' | 'watch'>('local'), [humanSide, setHumanSide] = useState<Side>('red');
  const [watchSpeed, setWatchSpeed] = useState<ComputerSpeed>('normal');
  const [error, setError] = useState(''), [busy, setBusy] = useState(false), [loading, setLoading] = useState(true), [help, setHelp] = useState(false);
  useEffect(() => {
    let alive = true;
    loadMatches().then(items => { if (!alive) return; setSaved(items); const active = sessionStorage.getItem('sw-local-active'); setMatch(items.find(item => item.game.id === active) ?? null); }).catch(e => { if (alive) setError(message(e)); }).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);
  async function open(value: Match) { sessionStorage.setItem('sw-local-active', value.game.id); setPresentation(null); setMatch(value); setError(''); }
  async function create(e: FormEvent) {
    e.preventDefault(); setBusy(true); setError('');
    try {
      const computerSide = other(humanSide);
      const settings = opponent === 'watch' ? { ...options, redName: 'Computer Rosso', blueName: 'Computer Blu' } : opponent === 'computer' ? { ...options, [computerSide === 'red' ? 'redName' : 'blueName']: 'Computer didattico' } : options;
      const value = newMatch(settings);
      if (opponent === 'computer') value.computer = { profile: 'didactic-v1', side: computerSide };
      if (opponent === 'watch') value.computer = { profile: 'didactic-v1', side: 'both', speed: watchSpeed };
      await saveMatch(value); await open(value);
    } catch (e) { setError(message(e)); } finally { setBusy(false); }
  }
  async function persist(next: Match, activation?: Activation) {
    if (!match || busy) return;
    setBusy(true); setError('');
    try { const sequence = presentChange(match, next, activation); await saveMatch(next, match.revision); if (sequence) setPresentation(sequence); setMatch(next); } catch (e) { setError(message(e)); throw e; } finally { setBusy(false); }
  }
  async function home() { setMatch(null); sessionStorage.removeItem('sw-local-active'); setError(''); try { setSaved(await loadMatches()); } catch (e) { setError(message(e)); } }
  async function importFile(file: File) {
    setBusy(true); setError('');
    try {
      if (file.size > 5_000_000) throw new Error('Il salvataggio supera il limite di 5 MB.');
      const value = importMatch(await file.text()), existing = (await loadMatches()).find(item => item.game.id === value.game.id);
      if (existing && JSON.stringify(existing) !== JSON.stringify(value)) throw new Error('Questa partita è già presente con dati differenti. Il salvataggio esistente è stato conservato: riprendilo dal menu.');
      await saveMatch(value, existing?.revision); await open(value);
    } catch (e) { setError(message(e)); } finally { setBusy(false); }
  }
  return <div className={`app-shell local-app ${match ? 'in-match' : ''}`}>
    <header className="topbar"><a className="brand" href="./" onClick={e => { e.preventDefault(); if (!busy) void home(); }}><span className="brand-diamond">◇</span><span>Strategic <strong>Wizardry</strong><small>OTTO MAGHI. UNA STRATEGIA.</small></span></a><nav><a className="text-button" href="?online=1">Gioca online ↗</a><button className="text-button" onClick={() => setHelp(!help)} aria-expanded={help}>Regole rapide</button></nav></header>
    {help && <section className="help-strip"><strong>Un duello di posizione e poteri.</strong><p>Vinci lasciando all’avversario tre maghi o meno. Normalmente attivi due maghi diversi: ognuno può muovere e usare un’abilità, anche durante il percorso. Un terzo mago può fare un solo passo senza agire. Il Rosso inizia con una sola attivazione. Almeno un’attivazione completa deve produrre movimento o un’azione, se possibile. Puoi annullare fino a «Termina turno».</p><p>Movimento e distanze sono ortogonali. Attraversi gli alleati ma ti fermi su caselle libere. Muri, maghi e copie nemiche bloccano la visuale; le copie alleate sono trasparenti. Un solo angolo sfiorato non blocca, due ostacoli sullo stesso angolo sì. Seleziona un mago per leggerne il potere e le passive.</p></section>}
    {error && <div className="notice error" role="alert">{error}<button className="text-button" onClick={() => setError('')} aria-label="Chiudi messaggio">×</button></div>}
    {match ? <GameScreen key={match.game.id} match={match} presentation={presentation} save={persist} busy={busy} home={home} /> : <>
      <section className="page-intro"><div><p className="eyebrow"><span/>IL DUELLO DELLE GILDE</p><h1>La forza è nel potere.<br/>La vittoria, nelle scelte.</h1><p className="intro-copy">Due gilde, otto maghi ciascuna, un solo campo.<br/>Gioca con un amico sullo stesso computer o affronta l’avversario didattico.</p></div><div className="intro-mark"><span className="brand-diamond large">◇</span></div></section>
      <p className="online-entry"><a className="button secondary" href="?online=1">Gioca online con un amico · invito tramite link ↗</a></p><main className="local-home"><section className="card new-game"><span className="eyebrow">PREPARA IL CAMPO</span><h2>Una nuova partita</h2><form onSubmit={create}>
        <fieldset className="mode-choice"><legend>Modalità</legend><label><input type="radio" name="opponent" value="local" checked={opponent === 'local'} onChange={() => setOpponent('local')}/>Due giocatori</label><label><input type="radio" name="opponent" value="computer" checked={opponent === 'computer'} onChange={() => setOpponent('computer')}/>Contro il computer</label><label><input type="radio" name="opponent" value="watch" checked={opponent === 'watch'} onChange={() => setOpponent('watch')}/>Computer vs Computer</label></fieldset>
        {opponent === 'watch' ? <p className="computer-intro">Osserva due computer didattici giocare l’intera partita. Puoi mettere in pausa, riprendere e salvare il duello.</p> : opponent === 'computer' ? <><label>La tua gilda<select value={humanSide} onChange={e => setHumanSide(e.target.value as Side)}><option value="red">Rosso · cominci tu</option><option value="blue">Blu · comincia il computer</option></select></label><label>Il tuo nome<input value={humanSide === 'red' ? options.redName : options.blueName} maxLength={40} onChange={e => setOptions({ ...options, [humanSide === 'red' ? 'redName' : 'blueName']: e.target.value })}/></label><p className="computer-intro">Un avversario semplice per imparare, con tutti gli otto maghi. Gioca nel tuo browser, senza registrazione.</p></> : <div className="form-pair"><label>Giocatore Rosso<input value={options.redName} maxLength={40} onChange={e => setOptions({ ...options, redName: e.target.value })}/></label><label>Giocatore Blu<input value={options.blueName} maxLength={40} onChange={e => setOptions({ ...options, blueName: e.target.value })}/></label></div>}
        <label>Punti vita iniziali<select value={options.hp} onChange={e => setOptions({ ...options, hp: Number(e.target.value) as Options['hp'] })}><option value={3}>3 PV · variante rapida</option><option value={4}>4 PV · standard</option><option value={5}>5 PV · variante resistente</option></select></label>
        {opponent === 'watch' && <ComputerSpeedSelect id="setup-computer-speed" value={watchSpeed} disabled={busy || loading} onChange={setWatchSpeed}/>}
        <label>Muri di forza<select value={options.walls} onChange={e => setOptions({ ...options, walls: e.target.value as Options['walls'] })}><option value="standard">Standard · due muri, due dadi</option><option value="varied">Alternativa · quattro settori, da zero a quattro muri</option></select></label>
        <label>Schieramento<select value={options.placement} onChange={e => setOptions({ ...options, placement: e.target.value as Options['placement'] })}><option value="standard">Standard · disposizione del regolamento</option><option value="custom">Personalizzato · sequenza 4 / 6 / 2 / 2 / 2</option></select></label>
        <button className="button primary full" disabled={busy || loading}>{opponent === 'watch' ? 'Avvia Computer vs Computer' : opponent === 'computer' ? 'Gioca contro il computer' : 'Inizia partita locale'} <span>→</span></button>
      </form><p className="fine-print">Senza orologi. I dadi dei muri vengono lanciati all’inizio. Salvataggio automatico dopo ogni conferma.</p></section>
      <section className="card saved-card"><span className="eyebrow">LE PARTITE DI QUESTO BROWSER</span><h2>Riprendi il duello</h2>{loading ? <p>Leggo i salvataggi…</p> : saved.length ? <ul className="saved-list">{saved.map(item => <li key={item.game.id}><button disabled={busy} onClick={() => void open(item)}><span className={`seat-dot ${item.game.active}`}/><span>{item.game.options.redName} / {item.game.options.blueName}<small>{item.computer?.side === 'both' ? 'Computer vs Computer · ' : item.computer ? `Contro il computer · giochi ${sideName(other(item.computer.side))} · ` : ''}{item.game.stage === 'finished' ? `Vittoria ${nameOf(item.game, item.game.result!.winner)}` : `${phaseName(item.game)} · ${nameOf(item.game)}`} · {new Date(item.savedAt).toLocaleString('it-IT')}</small></span><span>↗</span></button></li>)}</ul> : <p className="empty-saves">Le partite compariranno qui dopo il primo salvataggio.</p>}<ImportButton onFile={importFile} disabled={busy || loading}/><p className="fine-print">Esporta il file della partita per conservarla anche se i dati del browser vengono cancellati.</p></section></main>
    </>}
    <footer><span>STRATEGIC WIZARDRY / IL DUELLO DELLE GILDE</span><span>Regole complete · Italiano · Salvataggi nel browser</span></footer>
  </div>;
}

type Mode = 'move' | 'target' | 'wind' | 'teleport' | 'summon' | 'copy';
function tryValue<T>(fn: () => T): { value: T | null; error: string } { try { return { value: fn(), error: '' }; } catch (e) { return { value: null, error: message(e) }; } }
export type OnlineControl = { side: Side; enabled: boolean; phase: string; panel: ReactNode; perform: (action: GameAction) => Promise<void>; displayed: (revision: number) => void; exportBackup: () => void };
export function GameScreen({ match, presentation, save, busy, home, online }: { match: Match; presentation: Presentation | null; save: (next: Match, activation?: Activation) => Promise<void>; busy: boolean; home: () => void; online?: OnlineControl }) {
  const g = match.game;
  const playback = usePresentation(presentation, match);
  const computer = useComputer(match, save, busy, playback.active);
  const observing = computer.computerTurn || Boolean(online && (online.side !== g.active || !online.enabled));
  useEffect(() => { if (!playback.active) online?.displayed(match.revision); }, [playback.active, match.revision, online?.phase, online?.displayed]);
  const [draft, setDraft] = useState<Activation | null>(null), [inspect, setInspect] = useState<string | null>(null), [mode, setMode] = useState<Mode>('move');
  const [teleTarget, setTeleTarget] = useState<string | null>(null);
  const [rotated, setRotated] = useState(online ? online.side === 'blue' : match.computer?.side === 'red'), [helpers, setHelpers] = useState(true), [manual, setManual] = useState(false), [error, setError] = useState('');
  const reset = () => { setDraft(null); setMode('move'); setTeleTarget(null); setError(''); };
  useEffect(() => { reset(); }, [match.revision]);
  const initial = draft ? wizard(g, draft.wizardId) : undefined;
  const partial = useMemo(() => draft ? tryValue(() => previewActivation(g, draft, true)) : { value: null, error: '' }, [g, draft]);
  const shown = playback.frame?.game ?? partial.value?.game ?? g;
  const strict = useMemo(() => draft ? tryValue(() => activate(g, draft)) : { value: null, error: '' }, [g, draft]);
  const caster = initial ? wizard(shown, initial.id) : undefined;
  const dirty = Boolean(draft && (draft.before.length || draft.after.length || draft.spell));
  const locked = busy || playback.active || observing || g.stage !== 'playing' || Boolean(g.pending) || g.phase >= 3;
  const atCast = useMemo(() => draft ? tryValue(() => previewActivation(g, { ...draft, spell: undefined, after: [] }, true)).value?.game ?? g : g, [g, draft]);
  const castMage = initial ? wizard(atCast, initial.id) : undefined;
  const moveBase = useMemo(() => draft?.spell ? tryValue(() => previewActivation(g, { ...draft, after: [] }, true)).value?.game ?? g : g, [g, draft]);
  const moveMage = initial ? wizard(moveBase, initial.id) : undefined;
  const endAllowed = !busy && !playback.active && !observing && g.stage === 'playing' && !dirty && Boolean(tryValue(() => finishTurn(match)).value);
  const abilityAllowed = Boolean(initial && castMage?.pos && !locked && g.phase < 2 && !draft?.spell && !charmed(g, initial) && empty(atCast, castMage.pos, castMage.id) && targetPoints(atCast, castMage).length);
  const wind = draft?.spell?.kind === 'wind' ? draft.spell : null;
  const illusion = draft?.spell?.kind === 'illusion' ? draft.spell : null;
  const copyOrigin = illusion && castMage ? atCast.copies.find(c => c.ownerId === castMage.id) ?? (illusion.summon ? { ownerId: castMage.id, side: castMage.side, pos: illusion.summon } : null) : null;
  const activeCopy = shown.copies.find(c => c.ownerId === initial?.id);
  const highlights = useMemo(() => {
    if (g.stage === 'deployment') return Array.from({ length: 8 }, (_, i) => ({ x: i + 1, y: g.active === 'red' ? 9 : 0 })).filter(p => empty(g, p));
    if (!draft || !initial || locked) return [];
    if (mode === 'target' || mode === 'summon') return castMage ? targetPoints(atCast, castMage) : [];
    if (mode === 'teleport') return castMage ? teleportDestinations(atCast, castMage) : [];
    if (mode === 'wind') { const target = wind && wizard(shown, wind.targetId); return target?.pos && wind!.path.length < 2 ? adjacent(target.pos).filter(p => empty(shown, p, target.id)) : []; }
    if (mode === 'copy' && castMage && copyOrigin && illusion) {
      return Array.from({ length: 100 }, (_, i) => ({ x: i % 10, y: Math.floor(i / 10) })).filter(p => {
        if (activeCopy && shown.wizards.some(w => w.side !== castMage.side && w.pos && same(w.pos, p) && distance(w.pos, activeCopy.pos) === 1)) return true;
        return Boolean(copyRoute(atCast, castMage, copyOrigin, p));
      });
    }
    if (mode !== 'move' || !moveMage?.pos || shown.pending) return [];
    const max = speed(g, initial) - (draft.spell ? draft.before.length : 0);
    return Array.from({ length: 100 }, (_, i) => ({ x: i % 10, y: Math.floor(i / 10) })).filter(p => Boolean(shortestPath(moveMage.pos!, p, max, q => canEnter(moveBase, q, initial.side, initial.id), q => empty(moveBase, q, initial.id))));
  }, [g, shown, draft, mode, initial, castMage, atCast, locked, wind, illusion, activeCopy, copyOrigin, moveBase, moveMage]);
  function select(w: Wizard) {
    setInspect(w.id); setError('');
    if (observing || playback.active) return;
    if (g.stage === 'deployment') { if (w.side === g.active && !w.pos) setDraft({ wizardId: w.id, before: [], after: [] }); return; }
    if (!locked && w.side === g.active && !g.activated.includes(w.id)) { setDraft({ wizardId: w.id, before: [], after: [] }); setMode('move'); }
  }
  async function apply(action: GameAction) { setError(''); try { if (online) await online.perform(action); else await save(applyGameAction(match, action), action.kind === 'activate' ? action.activation : undefined); } catch (e) { setError(message(e)); } }
  function changeSpell(spell: Spell, nextMode: Mode) {
    if (!draft) return;
    const next = { ...draft, spell, after: [] };
    const check = tryValue(() => previewActivation(g, next, nextMode !== 'move'));
    if (!check.value) { setError(check.error); return; }
    setDraft(next); setMode(nextMode); setError('');
  }
  function startAbility() {
    if (!draft || !initial || !abilityAllowed) return;
    setError('');
    if (initial.kind === 'electromancer') changeSpell({ kind: 'lightning' }, 'move');
    else if (initial.kind === 'illusionist') {
      if (atCast.copies.some(c => c.ownerId === initial.id)) changeSpell({ kind: 'illusion', path: [] }, 'copy');
      else setMode('summon');
    } else setMode('target');
  }
  async function click(p: Point) {
    if (busy) return;
    if (playback.active) { const clicked = at(shown, p); if (clicked) setInspect(clicked.id); return; }
    if (observing) { const clicked = at(g, p); if (clicked) setInspect(clicked.id); return; }
    setError('');
    if (g.stage === 'deployment') {
      if (!draft) { setError('Scegli prima un mago da schierare.'); return; }
      await apply({ kind: 'place', wizardId: draft.wizardId, to: p }); return;
    }
    if (mode === 'move' && (!draft || !dirty && !manual)) {
      const clicked = at(g, p); if (clicked) { select(clicked); return; }
    }
    if (!draft || !initial || locked) { const clicked = at(g, p); if (clicked) setInspect(clicked.id); return; }
    try {
      if (mode === 'target') {
        if (!highlights.some(q => same(q, p))) throw new Error('Scegli un bersaglio valido per questa abilità.');
        const target = at(atCast, p);
        switch (initial.kind) {
          case 'aeromancer': changeSpell({ kind: 'wind', targetId: target!.id, path: [] }, target!.side !== initial.side && target!.hp === 1 ? 'move' : 'wind'); break;
          case 'teleporter': if (target) { setTeleTarget(target.id); setMode('teleport'); } break;
          case 'pyromancer': changeSpell({ kind: 'fireball', center: p }, 'move'); break;
          case 'geomancer': case 'enchanter': case 'spellsword': changeSpell({ kind: initial.kind === 'geomancer' ? 'earth' : initial.kind === 'enchanter' ? 'touch' : 'sword', targetId: target!.id }, 'move'); break;
        }
        return;
      }
      if (mode === 'teleport' && teleTarget) { changeSpell({ kind: 'teleport', targetId: teleTarget, destination: p }, 'move'); return; }
      if (mode === 'wind' && wind) { changeSpell({ ...wind, path: [...wind.path, p] }, 'wind'); return; }
      if (mode === 'summon') { changeSpell({ kind: 'illusion', summon: p, path: [] }, 'copy'); return; }
      if (mode === 'copy' && illusion && copyOrigin && castMage) {
        const target = at(shown, p);
        if (target?.side !== initial.side && target?.pos && activeCopy && distance(target.pos, activeCopy.pos) === 1) changeSpell({ ...illusion, targetId: target.id }, 'copy');
        else {
          const path = manual && activeCopy && distance(activeCopy.pos, p) === 1 ? [...illusion.path, p] : copyRoute(atCast, castMage, copyOrigin, p);
          if (!path) throw new Error('La copia non può raggiungere questa casella restando entro tre caselle dal mago.');
          changeSpell({ ...illusion, path, targetId: undefined }, 'copy');
        }
        return;
      }
      if (mode !== 'move' || !moveMage?.pos || shown.pending) return;
      const segment = draft.spell ? 'after' : 'before', old = draft[segment];
      const max = speed(g, initial) - (draft.spell ? draft.before.length : 0);
      const path = manual ? [...old, p] : shortestPath(moveMage.pos, p, max, q => canEnter(moveBase, q, initial.side, initial.id), q => empty(moveBase, q, initial.id));
      if (!path) throw new Error('Questa destinazione non è raggiungibile con il movimento disponibile.');
      const next = { ...draft, [segment]: path }, check = tryValue(() => previewActivation(g, next, true));
      if (!check.value) throw new Error(check.error);
      setDraft(next);
    } catch (e) { setError(message(e)); }
  }
  function undoStep() {
    if (!draft) return; setError('');
    if (mode === 'wind' && wind) changeSpell({ ...wind, path: wind.path.slice(0, -1) }, 'wind');
    else if (mode === 'copy' && illusion) changeSpell({ ...illusion, path: illusion.path.slice(0, -1), targetId: undefined }, 'copy');
    else { const segment = draft.spell ? 'after' : 'before'; setDraft({ ...draft, [segment]: draft[segment].slice(0, -1) }); }
  }
  const selected = (inspect && wizard(shown, inspect)) || caster || (playback.frame?.actorId ? wizard(shown, playback.frame.actorId) : undefined);
  const movement = playback.frame?.movement;
  const movingMage = movement && playback.frame?.actorId ? wizard(shown, playback.frame.copyOwner ?? playback.frame.actorId) : undefined;
  const motion = movingMage && movement ? { id: playback.movementKey, pieceId: playback.frame?.copyOwner ? `copy:${movingMage.id}` : movingMage.id, label: playback.frame?.copyOwner ? `Copia ${sideName(movingMage.side)}` : `${INFO[movingMage.kind].name} ${sideName(movingMage.side)}`, from: movement.from, to: movement.to, content: <Portrait mage={movingMage} copy={Boolean(playback.frame?.copyOwner)}/>, duration: playback.movementDuration, paused: playback.paused, onComplete: playback.completeMovement } : undefined;
  const tracks = playback.frame?.tracks ?? (!draft ? playback.last?.frames.at(-1)?.tracks : undefined);
  const path = draft && initial?.pos ? [initial.pos, ...draft.before, ...draft.after] : null;
  const instruction = mode === 'target' ? 'Scegli il bersaglio evidenziato.' : mode === 'teleport' ? 'Scegli la destinazione del teletrasporto.' : mode === 'wind' ? `Scegli fino a due passi per il bersaglio (${wind?.path.length ?? 0}/2), poi concludi l’abilità.` : mode === 'summon' ? 'Scegli dove evocare la copia, accanto all’Illusionista.' : mode === 'copy' ? 'Muovi la copia, poi scegli eventualmente un nemico adiacente da colpire. Concludi l’abilità.' : shown.pending ? 'La soglia di sconfitta è raggiunta. Conferma l’attivazione oppure modifica la preparazione.' : draft ? 'Scegli dove muovere. Puoi usare l’abilità prima, durante o dopo il movimento.' : g.phase >= 3 ? 'Le attivazioni sono concluse. Puoi annullare o terminare il turno.' : 'Seleziona un mago della gilda attiva.';
  return <>
    <main className={`main-grid active-grid game-grid ${match.computer?.side === 'both' ? 'spectator' : ''}`}>
    <section className="game-heading"><div><button className="text-button back" disabled={busy || computer.changingSpeed} onClick={home}>← Le mie partite</button><h1>{g.stage === 'finished' ? `Vittoria ${nameOf(g, g.result!.winner)}` : g.stage === 'deployment' ? 'Le gilde prendono posizione.' : `Il turno di ${nameOf(g)}.`}</h1></div><span className={`guild-label ${g.active}`}>{sideName(g.active)} · {g.stage === 'deployment' ? 'Schieramento' : `Turno ${g.turn + 1}`}</span></section>
    <section className="board-panel">
      <div className="panel-heading"><div><span className="eyebrow">IL CAMPO DEL DUELLO</span><h2>{playback.active ? playback.replaying ? 'Rivedi l’attivazione' : 'Attivazione in corso' : g.stage === 'finished' ? 'Duello concluso' : g.pending ? 'Risultato provvisorio' : phaseName(g)}</h2></div><button className="round-button" onClick={() => setRotated(!rotated)} aria-label="Ruota la scacchiera">↻</button></div>
      <div className="board-player"><span className={`seat-dot ${rotated ? 'red' : 'blue'}`}/>{nameOf(g, rotated ? 'red' : 'blue')}<span className="player-place">{count(shown, rotated ? 'red' : 'blue')} / 8 maghi</span></div>
      <div className="guild-counts">{([rotated ? 'red' : 'blue', rotated ? 'blue' : 'red'] as Side[]).map(side => <span key={side}><span className={`seat-dot ${side}`}/><span>{nameOf(g, side)}</span><strong>{count(shown, side)} / 8</strong></span>)}</div>
      <BoardGrid rotated={rotated} tracks={tracks} motion={motion} path={playback.frame?.path ?? (helpers ? path : null)} onSelect={p => void click(p)} cell={p => {
        const actor = playback.frame?.actorId && wizard(shown, playback.frame.actorId);
        const copy = copyAt(shown, p), w = copy && copy.ownerId === playback.frame?.copyOwner ? undefined : actor && actor.pos && same(actor.pos, p) ? actor : at(shown, p), owner = copy && wizard(shown, copy.ownerId), wall = isWall(g, p);
        const visibleMage = motion && !playback.frame?.copyOwner ? at(shown, p, movingMage!.id) : motion && playback.frame?.copyOwner ? at(shown, p) : w;
        const visibleCopy = copy && copy.ownerId !== playback.frame?.copyOwner ? owner : !motion ? owner : undefined;
        const cues = cuesAt(playback.frame, p), focused = playback.frame?.points.some(q => same(q, p));
        const chosen = w && w.id === draft?.wizardId, available = highlights.some(q => same(q, p));
        const victim = helpers && partial.value?.effects.some(e => e.kind === 'damage' && e.at && same(e.at, p));
        const eliminated = !w && helpers && partial.value?.effects.find(e => e.kind === 'removed' && e.at && same(e.at, p));
        return { wizardId: w?.id, title: wall ? 'Muro di forza: blocca movimento e visuale' : w ? `${INFO[w.kind].name} ${sideName(w.side)} · ${w.hp} PV` : copy ? `Copia illusoria ${sideName(copy.side)}` : square(p), label: (wall ? 'muro di forza' : w ? `${INFO[w.kind].name} ${sideName(w.side)}, ${w.hp} punti vita${w.restrainedUntil !== undefined ? ', immobilizzato' : ''}${shown.activated.includes(w.id) ? ', già attivato' : ''}` : copy ? `copia illusoria ${sideName(copy.side)}` : '') + (cues.length ? `, ${cues.map(c => c.text).join(', ')}` : ''), className: `${wall ? 'wall' : ''} ${chosen ? 'selected' : ''} ${!playback.active && available && helpers ? mode === 'move' ? 'reachable' : 'targetable' : ''} ${w && shown.activated.includes(w.id) ? 'spent' : ''} ${victim ? 'damaged-preview' : ''} ${focused ? 'event-focus' : ''} ${w && w.id === playback.frame?.actorId ? 'event-actor' : ''} ${cues.length ? 'event-affected' : ''}`, content: <>{wall ? <ForceWall/> : visibleMage ? <Portrait mage={visibleMage}/> : visibleCopy ? <Portrait mage={visibleCopy} copy/> : eliminated ? <span className="eliminated-preview">×</span> : !playback.active && available && helpers ? <span className="reachable-dot"/> : null}{cues.length > 0 && <span className="event-cues">{cues.map((cue, i) => <span key={i} className={`event-cue ${cue.kind}`} aria-label={cue.text}>{(cue.badge ?? [cue.text]).map((line, j) => <span key={j} className="cue-line">{line}</span>)}</span>)}</span>}</> };
      }}/>
      <div className="board-player own"><span className={`seat-dot ${rotated ? 'blue' : 'red'}`}/>{nameOf(g, rotated ? 'blue' : 'red')}<span className="player-place">{count(shown, rotated ? 'blue' : 'red')} / 8 maghi</span></div>
      <div className="board-caption"><span className="caption-dot"/>{tracks?.length ? 'Percorsi numerati: 0 = partenza. Oro = mago, azzurro = copia. Numeri sulle pedine: PV.' : 'Muri di forza: caselle interamente bloccate. Numeri sulle pedine: PV.'}</div>
    </section><ActionPresentation control={playback} change={presentation} game={g} disabled={busy || computer.changingSpeed || dirty}/><aside className="side-column">
    {!playback.active && g.pending && <div className="notice provisional" role="status"><strong>Risultato provvisorio: vince {nameOf(g, g.pending.winner)}.</strong> {observing ? online ? 'Il risultato resta provvisorio finch? l?avversario conclude il turno.' : 'Il computer sta concludendo il proprio turno.' : 'Puoi annullare l’attivazione oppure rendere definitivo l’esito con «Termina turno».'}</div>}
    {!playback.active && g.result && <div className="notice success" role="status">{g.result.reason} La partita è conclusa e rimane fra i salvataggi.</div>}

      <ComputerPanel match={match} busy={busy} control={computer}/>{online?.panel}
      {g.stage === 'deployment' ? <section className="card"><span className="eyebrow">SCHIERAMENTO PERSONALIZZATO</span><h3>{nameOf(g)}: colloca {deploymentInfo(g)[1] - g.deployment.count} maghi</h3><p>{observing ? online ? 'Attendi il collegamento e lo schieramento della gilda attiva.' : 'Il computer dispone i propri maghi nella sua prima riga.' : 'Scegli un ritratto, poi una casella libera nella prima riga, esclusi gli angoli.'}</p><div className="deployment-roster">{g.wizards.filter(w => w.side === g.active && !w.pos).map(w => <button key={w.id} disabled={busy || playback.active || observing} className={draft?.wizardId === w.id ? 'chosen' : ''} aria-label={`Schiera ${INFO[w.kind].name}`} onClick={() => select(w)}><Portrait mage={w}/><span>{INFO[w.kind].name}</span></button>)}</div><button className="button secondary full" disabled={busy || playback.active || observing || !match.undo.length} onClick={() => void apply({ kind: 'undo' })}>Annulla ultimo schieramento</button><p className="fine-print">Sequenza: Rosso 4 · Blu 6 · Rosso 2 · Blu 2 · Rosso 2. Ogni gruppo si conferma quando viene completato.</p></section> : <section className="card action-card"><div className="card-title"><h3>{playback.active ? 'Segui l’attivazione' : g.stage === 'finished' ? 'Partita conclusa' : observing ? online ? online.side === g.active ? 'Attendi il collegamento' : 'Gioca l’avversario' : 'Il computer gioca' : 'Prepara l’attivazione'}</h3><span className={`guild-label ${g.active}`}>{sideName(g.active)}</span></div>
        {shown.stage === 'playing' && !shown.pending && <div className="phase-track">{(shown.turn === 0 ? ['Attivazione'] : ['Prima', 'Seconda', 'Semi']).map((s, i) => <span key={s} className={i < shown.phase ? 'done' : i === shown.phase ? 'current' : ''}>{i < shown.phase ? '✓' : i + 1} {s}</span>)}</div>}
        <div className="draft-preview"><span className="eyebrow">{draft && initial ? INFO[initial.kind].name.toUpperCase() : observing ? 'OSSERVA IL CAMPO' : 'LA TUA SCELTA'}</span><p>{playback.active ? 'Segui gli eventi nel pannello della sequenza. Puoi ispezionare i maghi; i comandi di gioco riprendono alla fine della sequenza.' : g.pending ? 'Il risultato è provvisorio fino alla conclusione del turno.' : g.stage === 'finished' ? 'Torna alle tue partite per iniziare un altro duello.' : observing ? online ? 'Le attivazioni confermate appaiono sul campo con il percorso completo. Puoi ispezionare i maghi. Attendi che entrambi abbiano visto la sequenza prima di continuare.' : 'Le attivazioni del computer appariranno sulla scacchiera e nella cronaca. Puoi selezionare i maghi per leggerne i poteri.' : instruction}</p>{draft && initial && <p className="draft-budget">Passi: {draft.before.length + draft.after.length} / {speed(g, initial)} · {draft.spell ? 'Abilità preparata' : g.phase === 2 ? 'Nessuna azione' : 'Abilità disponibile'}</p>}</div>
        {g.stage === 'playing' && !g.pending && !observing && <>
          {['wind', 'copy'].includes(mode) ? <button className="button secondary full" onClick={() => draft?.spell && changeSpell(draft.spell, 'move')}>Concludi abilità</button> : <button className="button secondary full" disabled={!abilityAllowed || mode !== 'move'} onClick={startAbility}>Usa abilità</button>}
          {mode !== 'move' || draft?.spell ? <button className="button ghost full" onClick={() => { if (draft) setDraft({ ...draft, spell: undefined, after: [] }); setMode('move'); setError(''); }}>Rimuovi abilità preparata</button> : null}
          <button className="button primary full confirm-activation" disabled={busy || playback.active || !strict.value || mode !== 'move'} onClick={() => draft && void apply({ kind: 'activate', activation: draft })}>Conferma attivazione <span>→</span></button>
          {draft && !strict.value && mode === 'move' && <p className="fine-print">{strict.error}</p>}
          <div className="button-row"><button className="button ghost" disabled={!draft} onClick={reset}>Azzera preparazione</button><button className="button ghost" disabled={!draft} onClick={undoStep}>Togli ultimo passo</button></div>
          <label className="checkbox-label"><input type="checkbox" checked={manual} onChange={e => setManual(e.target.checked)}/>Modifica percorso passo per passo</label>
        </>}
        <div className="button-row"><button className="button secondary" disabled={busy || playback.active || observing || !match.undo.length || g.stage === 'finished'} onClick={() => void apply({ kind: 'undo' })}>Annulla attivazione</button><button className="button secondary" disabled={!endAllowed} onClick={() => void apply({ kind: 'end-turn' })}>Termina turno</button></div>
        {g.stage === 'playing' && !g.pending && !observing && g.phase < 3 && <button className="button ghost full" disabled={busy || playback.active || dirty || !tryValue(() => commitSkip(match)).value} onClick={() => void apply({ kind: 'skip' })}>{g.phase === 2 ? 'Salta semiattivazione' : 'Passa questa attivazione'}</button>}
        <label className="checkbox-label"><input type="checkbox" checked={helpers} onChange={e => setHelpers(e.target.checked)}/>Mostra aiuti e anteprime degli effetti</label>
        {helpers && partial.value && partial.value.effects.length > 0 && <ul className="effect-list" aria-label="Anteprima degli effetti">{partial.value.effects.map((e, i) => <li key={i}>{e.text}</li>)}</ul>}
      </section>}
      {error && <div className="notice error" role="alert">{error}</div>}
      <section className="card mage-card">{selected ? <><div className="mage-card-heading"><Portrait mage={selected}/><div><span className={`guild-label ${selected.side}`}>{sideName(selected.side)}</span><h3>{INFO[selected.kind].name}</h3><p>{selected.hp} PV · Movimento {INFO[selected.kind].speed} · Gittata {INFO[selected.kind].range}</p></div></div><strong>{INFO[selected.kind].ability}</strong><p>{INFO[selected.kind].description}</p>{selected.restrainedUntil !== undefined && <p className="status-note">⛓ Immobilizzato fino alla fine {shown.active === selected.side && shown.turn >= selected.restrainedUntil ? 'di questo turno' : `del prossimo turno ${sideName(selected.side)}`}: non può muovere, ma può agire ed essere spostato.</p>}{initial && charmed(g, initial) && selected.id === initial.id && <p className="status-note">Incantato all’inizio: nessuna abilità per tutta questa attivazione.</p>}</> : <><h3>Scheda del mago</h3><p>Seleziona un mago sul campo per leggerne potere ed effetti.</p></>}</section>
      <section className="card compact-save"><div className="card-title"><h3>Il duello è salvato</h3><span className="saved-indicator">● {busy ? 'Salvo…' : 'In questo browser'}</span></div><p>Ogni conferma è salvata. La preparazione non confermata si perde chiudendo la pagina.</p><button className="button ghost" disabled={busy && !online} onClick={() => online ? online.exportBackup() : exportGame(match)}>↓ {online ? 'Esporta backup personale' : 'Esporta partita'}</button><details><summary>Preparazione del campo</summary><p>{g.options.hp} PV · Dadi: {g.dice.join(', ')} · Muri: {g.walls.map(square).join(', ') || 'nessuno'} · Schieramento {g.options.placement === 'custom' ? 'personalizzato' : 'standard'}.</p></details></section>
    </aside></main>
    <section className="history-panel game-history"><div><p className="eyebrow">CRONACA DEL DUELLO</p><h3>Gli ultimi incantesimi</h3></div>{g.log.length ? <div><ol>{g.log.slice(-8).reverse().map((row, i) => <li key={`${g.log.length - i}`}><span className="history-number">{g.log.length - i}</span>{gameText(row)}</li>)}</ol>{g.log.length > 8 && <details><summary>Cronaca completa · {g.log.length} eventi</summary><ol>{g.log.map((row, i) => <li key={i}><span className="history-number">{i + 1}</span>{gameText(row)}</li>)}</ol></details>}</div> : <p>Qui compariranno le attivazioni confermate.</p>}</section>
  </>;
}
