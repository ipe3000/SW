import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { activate, at, canEnter, charmed, commitSkip, copyAt, copyRoute, count, defaultOptions, deploymentInfo, empty, finishesActivation, finishTurn, hasExtraStep, INFO, isWall, newMatch, other, phaseName, previewActivation, sideName, speed, targetPoints, teleportDestinations, wizard, type Activation, type Game, type Match, type Options, type Side, type Spell, type Wizard } from '../engine/game';
import { adjacent, distance, same, shortestPath, square, type Point } from '../engine/geometry';
import { importMatch } from '../engine/backup';
import { loadMatches, saveMatch } from '../game-storage';
import { BoardGrid, ForceWall } from './BoardGrid';
import { useComputer } from './useComputer';
import { ComputerSpeedSelect } from './ComputerSpeedSelect';
import { ComputerPanel } from './ComputerPanel';
import { cuesAt, presentChange, presentTurn, type Presentation } from '../engine/presentation';
import { usePresentation } from './usePresentation';
import { ActionPresentation } from './ActionPresentation';
import type { ComputerSpeed } from '../engine/game';
import { gameText } from './text';
import { applyGameAction, type GameAction } from '../engine/commands';
import { MatchResultDialog } from './MatchResultDialog';
import { EffectIcon } from './EffectIcon';
import { MageEmblem } from './MageEmblem';
import { GameModes, type GameMode, type LocalMode } from './GameModes';
import { BattleOverlay } from './BattleOverlay';
import { BattlePreferences } from './BattlePreferences';
import { useBattleFeedback } from './useBattleFeedback';
import { charmInfluence } from '../engine/visual-effects';
import { MageDetailsDialog, mageConditions, type MageDetailsRequest } from './MageDetailsDialog';
import { usePlayViewport } from './usePlayViewport';
import { EntryScene, SavedGames } from './EntryScene';
import { MatchOptions } from './MatchOptions';
import { createPortal } from 'react-dom';
import { GameNavigation, useGameMenu } from './GameNavigation';

function MageToken({ mage, copy = false, fascinated = false, dormant = false, summoning = false }: { mage: Wizard; copy?: boolean; fascinated?: boolean; dormant?: boolean; summoning?: boolean }) {
  const bound = !copy && mage.restrainedUntil !== undefined;
  const sealed = !copy && fascinated;
  return <span className={`mage-token ${mage.side} ${copy ? 'illusion-token' : ''} ${bound ? 'terrain-bound' : ''} ${sealed ? 'is-fascinated' : ''} ${dormant ? 'dormant-copy' : ''} ${summoning ? 'summoning-copy' : ''} ${dormant ? 'has-status-rail' : ''}`} aria-hidden="true">
    <MageEmblem kind={mage.kind}/>
    {bound && <svg className="terrain-roots earth-prison" viewBox="0 0 80 60" preserveAspectRatio="none" aria-hidden="true"><ellipse className="earth-shadow" cx="40" cy="56" rx="39" ry="4"/><g className="earth-clod earth-clod-left"><path d="M0 57 2 35 8 28 10 8 20 3 27 16 24 36 31 49 27 58Z"/><path className="earth-side" d="m20 3 7 13-3 20 7 13-11-6-4-20Z"/><path className="earth-crack" d="m11 13 6 10-5 11 8 9m-13-6 5 3-2 10"/></g><g className="earth-clod earth-clod-right"><path d="m50 58-2-13 8-12-2-16 8-13 11 6 2 20 5 10v17Z"/><path className="earth-side" d="m62 4 2 21-7 12-2 15-7-7 8-12-2-16Z"/><path className="earth-crack" d="m70 15-5 11 5 12-6 8m11-12-5 4 3 10"/></g><path className="earth-base" d="m0 56 10-7 11 4 8-6 11 7 9-5 12 4 10-6 9 9v4H0Z"/><path className="earth-crack" d="m24 54 8 3 7-2 10 3 8-3"/><path className="earth-rubble" d="m1 31 4-6 3 7Zm73-12 3-4 2 6ZM32 54l4-5 4 6Z"/></svg>}
    {sealed && <span className="charm-presence charm-status is-sealed" title="Incantato: abilità bloccata fino alla fine dell’attivazione"><EffectIcon kind="charm"/></span>}
    {dormant && <span className="mage-status-rail"><span className="copy-dormant-status" title="Copia fuori distanza: non può agire"><EffectIcon kind="link"/></span></span>}
    {!copy && <span className="mage-hp">{mage.hp}</span>}
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

export function LocalGame({ mode: opponent, onModeChange }: { mode: LocalMode; onModeChange: (mode: GameMode) => void }) {
  const [match, setMatch] = useState<Match | null>(null), [saved, setSaved] = useState<Match[]>([]);
  useEffect(() => { window.scrollTo(0, 0); }, [match?.game.id]);
  const [presentation, setPresentation] = useState<Presentation | null>(null);
  const [options, setOptions] = useState<Options>({ ...defaultOptions });
  const [humanSide, setHumanSide] = useState<Side>('red');
  const [watchSpeed, setWatchSpeed] = useState<ComputerSpeed>('normal');
  const [error, setError] = useState(''), [busy, setBusy] = useState(false), [loading, setLoading] = useState(true);
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
    <GameNavigation inMatch={Boolean(match)} busy={busy} onExit={() => void home()}>
    {error && <div className="notice error" role="alert">{error}<button className="text-button" onClick={() => setError('')} aria-label="Chiudi messaggio">×</button></div>}
    {match ? <GameScreen key={match.game.id} match={match} presentation={presentation} save={persist} busy={busy} /> : <>
      <main className="local-home fantasy-entry"><EntryScene/><section className="card new-game"><h2>Nuova partita</h2><form onSubmit={create}>
        <GameModes value={opponent} onChange={onModeChange}/>
        {opponent === 'watch' ? <p className="computer-intro">Osserva due computer didattici giocare l’intera partita. Puoi mettere in pausa, riprendere e salvare il duello.</p> : opponent === 'computer' ? <><label>La tua gilda<select value={humanSide} onChange={e => setHumanSide(e.target.value as Side)}><option value="red">Rosso · cominci tu</option><option value="blue">Blu · comincia il computer</option></select></label><label>Il tuo nome<input value={humanSide === 'red' ? options.redName : options.blueName} maxLength={40} onChange={e => setOptions({ ...options, [humanSide === 'red' ? 'redName' : 'blueName']: e.target.value })}/></label><p className="computer-intro">Un avversario semplice per imparare, con tutti gli otto maghi. Gioca nel tuo browser, senza registrazione.</p></> : <div className="form-pair"><label>Giocatore Rosso<input value={options.redName} maxLength={40} onChange={e => setOptions({ ...options, redName: e.target.value })}/></label><label>Giocatore Blu<input value={options.blueName} maxLength={40} onChange={e => setOptions({ ...options, blueName: e.target.value })}/></label></div>}
        <MatchOptions value={options} onChange={setOptions}/>
        {opponent === 'watch' && <ComputerSpeedSelect id="setup-computer-speed" value={watchSpeed} disabled={busy || loading} onChange={setWatchSpeed}/>}
        <button className="button primary full" disabled={busy || loading}>{opponent === 'watch' ? 'Avvia Computer vs Computer' : opponent === 'computer' ? 'Gioca contro il computer' : 'Inizia partita locale'} <span>→</span></button>
      </form></section>
      <SavedGames loading={loading} items={saved.map(item => <li key={item.game.id}><button disabled={busy} onClick={() => void open(item)}><span className={`seat-dot ${item.game.active}`}/><span>{item.game.options.redName} / {item.game.options.blueName}<small>{item.computer?.side === 'both' ? 'Computer vs Computer · ' : item.computer ? `Contro il computer · giochi ${sideName(other(item.computer.side))} · ` : ''}{item.game.stage === 'finished' ? `Vittoria ${nameOf(item.game, item.game.result!.winner)}` : `${phaseName(item.game)} · ${nameOf(item.game)}`} · {new Date(item.savedAt).toLocaleString('it-IT')}</small></span><span>↗</span></button></li>)} importer={<ImportButton onFile={importFile} disabled={busy || loading}/>}/>
      </main>
    </>}
    </GameNavigation>
  </div>;
}

type Mode = 'move' | 'target' | 'wind' | 'teleport' | 'summon' | 'copy';
function tryValue<T>(fn: () => T): { value: T | null; error: string } { try { return { value: fn(), error: '' }; } catch (e) { return { value: null, error: message(e) }; } }
export type OnlineControl = { status: string; revision: number; fingerprint: string; side: Side; enabled: boolean; phase: string; panel: ReactNode; perform: (action: GameAction) => Promise<void>; displayed: (revision: number) => void; exportBackup: () => void };
export function GameScreen({ match, presentation, save, busy, online }: { match: Match; presentation: Presentation | null; save: (next: Match, activation?: Activation) => Promise<void>; busy: boolean; online?: OnlineControl }) {
  const { menuBody, isOpen: navigationOpen, requestExit: home } = useGameMenu();
  const g = match.game;
  const screenRef = usePlayViewport(g.stage);
  const viewer = online?.side ?? (match.computer && match.computer.side !== 'both' ? other(match.computer.side) : g.active);
  const enemyTurn = match.replays?.[other(viewer)];
  const enemyReplay = useMemo(() => enemyTurn ? presentTurn(enemyTurn) : null, [enemyTurn]);
  const playback = usePresentation(presentation, match, enemyReplay);
  const feedback = useBattleFeedback(playback, presentation);
  const computer = useComputer(match, save, busy, playback.active || navigationOpen);
  const observing = computer.computerTurn || Boolean(online && (online.side !== g.active || !online.enabled));
  useEffect(() => { if (!playback.active) online?.displayed(match.revision); }, [playback.active, match.revision, online?.phase, online?.displayed]);
  const [draft, setDraft] = useState<Activation | null>(null), [inspect, setInspect] = useState<string | null>(null), [mode, setMode] = useState<Mode>('move');
  const [teleTarget, setTeleTarget] = useState<string | null>(null);
  const [mageDetails, setMageDetails] = useState<MageDetailsRequest | null>(null);
  const doubleAbility = useRef<string | null>(null);
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
  const finalActivation = g.turn === 0 || g.phase === 2 || Boolean(strict.value && finishesActivation(g, strict.value));
  const confirmLabel = strict.value?.pending ? 'Conferma e concludi partita' : finalActivation ? 'Conferma e passa turno' : 'Conferma attivazione';
  const skipped = useMemo(() => tryValue(() => commitSkip(match)), [match]);
  const skipFinal = Boolean(skipped.value && (skipped.value.game.phase >= 3 || skipped.value.game.phase === 2 && !hasExtraStep(skipped.value.game)));
  const canReplay = Boolean(enemyReplay && !dirty && !busy && (!online || online.side === g.active || g.stage === 'finished') && (!computer.computerTurn || computer.paused));
  function pauseDuel() { const pause = !computer.paused; computer.togglePause(); if (playback.active && !playback.replaying && playback.paused !== pause) playback.togglePause(); }
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
      if (manual && activeCopy) {
        const remaining = 3 - illusion.path.length;
        const steps = remaining > 0 ? adjacent(activeCopy.pos).filter(p => distance(p, castMage.pos!) <= 3 && canEnter(shown, p, initial.side, undefined, initial.id) && (remaining > 1 || !at(shown, p) && !copyAt(shown, p, initial.id))) : [];
        const targets = !at(shown, activeCopy.pos) ? shown.wizards.filter(w => w.side !== initial.side && w.pos && distance(w.pos, activeCopy.pos) === 1).map(w => w.pos!) : [];
        return [...steps, ...targets];
      }
      return Array.from({ length: 100 }, (_, i) => ({ x: i % 10, y: Math.floor(i / 10) })).filter(p => {
        if (activeCopy && shown.wizards.some(w => w.side !== castMage.side && w.pos && same(w.pos, p) && distance(w.pos, activeCopy.pos) === 1)) return true;
        return Boolean(copyRoute(atCast, castMage, copyOrigin, p));
      });
    }
    if (mode !== 'move' || !moveMage?.pos || shown.pending) return [];
    const max = speed(g, initial) - (draft.spell ? draft.before.length : 0);
    if (manual && caster?.pos) {
      const remaining = max - (draft.spell ? draft.after.length : draft.before.length);
      return remaining > 0 ? adjacent(caster.pos).filter(p => canEnter(shown, p, initial.side, initial.id) && (remaining > 1 || empty(shown, p, initial.id))) : [];
    }
    return Array.from({ length: 100 }, (_, i) => ({ x: i % 10, y: Math.floor(i / 10) })).filter(p => Boolean(shortestPath(moveMage.pos!, p, max, q => canEnter(moveBase, q, initial.side, initial.id), q => empty(moveBase, q, initial.id))));
  }, [g, shown, draft, mode, initial, castMage, atCast, locked, wind, illusion, activeCopy, copyOrigin, moveBase, moveMage, manual, caster]);
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
  function boardClick(p: Point) {
    const clicked = at(shown, p);
    // Remember the mode before the first click: selecting a spell target can return to 'move'.
    doubleAbility.current = mode === 'move' && !locked && !draft?.spell && clicked?.side === g.active && !g.activated.includes(clicked.id) && (!dirty || clicked.id === initial?.id) ? clicked.id : null;
    void click(p);
  }
  function doubleClickAbility(p: Point) {
    const clicked = at(shown, p);
    if (mode === 'move' && clicked?.id === doubleAbility.current && clicked?.id === initial?.id && abilityAllowed) startAbility();
    doubleAbility.current = null;
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
    if (mode === 'move' && caster?.pos && same(caster.pos, p)) { setInspect(caster.id); return; }
    const inspectedEnemy = at(shown, p);
    if (mode === 'move' && inspectedEnemy && inspectedEnemy.side !== g.active) { setInspect(inspectedEnemy.id); return; }
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
          const path = manual ? [...illusion.path, p] : copyRoute(atCast, castMage, copyOrigin, p);
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
  const charmedId = playback.active ? playback.frame?.charmedId : initial && charmed(g, initial) ? initial.id : undefined;
  const selectedConditions = selected ? mageConditions(shown, selected, charmedId) : [];
  const charmLinks = useMemo(() => charmInfluence(shown).filter(link => link.targetId === charmedId), [shown, charmedId]);
  const dormantCopy = (owner: Wizard, pos: Point) => !owner.pos || distance(owner.pos, pos) > 3;
  const influence = helpers && !playback.active && selected?.kind === 'enchanter' && selected.pos ? adjacent(selected.pos) : [];
  const movement = playback.frame?.movement;
  const movingMage = movement && playback.frame?.actorId ? wizard(shown, playback.frame.copyOwner ?? playback.frame.actorId) : undefined;
  const motion = movingMage && movement ? { id: playback.movementKey, pieceId: playback.frame?.copyOwner ? `copy:${movingMage.id}` : movingMage.id, label: playback.frame?.copyOwner ? `Copia ${sideName(movingMage.side)}` : `${INFO[movingMage.kind].name} ${sideName(movingMage.side)}`, from: movement.from, to: movement.to, content: <MageToken mage={movingMage} copy={Boolean(playback.frame?.copyOwner)} fascinated={movingMage.id === playback.frame?.charmedId}/>, duration: playback.movementDuration, paused: playback.paused, onComplete: playback.completeMovement } : undefined;
  const tracks = playback.frame?.tracks ?? (!draft ? playback.last?.frames.at(-1)?.tracks : undefined);
  const path = draft && initial?.pos ? [initial.pos, ...draft.before, ...draft.after] : null;
  const instruction = mode === 'target' ? 'Scegli il bersaglio evidenziato.' : mode === 'teleport' ? 'Scegli la destinazione del teletrasporto.' : mode === 'wind' ? `Scegli fino a due passi per il bersaglio (${wind?.path.length ?? 0}/2), poi concludi l’abilità.` : mode === 'summon' ? 'Scegli dove evocare la copia, accanto all’Illusionista.' : mode === 'copy' ? 'Muovi la copia, poi scegli eventualmente un nemico adiacente da colpire. Concludi l’abilità.' : shown.pending ? 'La soglia di sconfitta è raggiunta. Conferma l’attivazione oppure modifica la preparazione.' : draft ? 'Scegli dove muovere o usa l’abilità.' : g.phase >= 3 ? 'Le attivazioni sono concluse. Puoi annullare oppure passare la mano.' : 'Seleziona un mago della gilda attiva.';
  const budget = draft && initial && !playback.active ? <p className="draft-budget" data-actor={initial.id}><strong>{INFO[initial.kind].name} · </strong>{caster?.hp ?? initial.hp} PV · Passi {draft.before.length + draft.after.length}/{speed(g, initial)}{draft.spell ? ' · Potere preparato' : ''}</p> : null;
  return <>
    <main ref={screenRef} className={`main-grid active-grid game-grid ergonomic-game ${match.computer?.side === 'both' ? 'spectator' : ''}`}>
      <section className="game-heading">
        <div className="turn-heading"><span className="turn-number">Turno {g.turn + 1}{busy && <span role="status"> · Salvo…</span>}</span></div>
        <div className={`turn-status ${g.active}`}><div className="turn-status-text" role="status" aria-live="polite" aria-atomic="true">
          <h1>{g.stage === 'finished' ? `Vittoria ${nameOf(g, g.result!.winner)}` : g.stage === 'deployment' ? 'Le gilde prendono posizione.' : `Il turno di ${nameOf(g)}.`}</h1>
          <h2 className="current-turn-phase">{playback.replaying ? 'Replay del turno avversario' : g.stage === 'finished' ? 'Duello concluso' : g.pending ? 'Risultato da confermare' : g.stage === 'playing' && g.phase < 3 ? ['1° Attivazione', '2° Attivazione', 'Passo extra'][g.phase] : phaseName(g)}</h2>
        </div><button className="round-button" onClick={() => setRotated(!rotated)} aria-label="Ruota la scacchiera">↻</button></div>
        <div className="guild-counts">{([rotated ? 'red' : 'blue', rotated ? 'blue' : 'red'] as Side[]).map(side => <span key={side}><span className={`seat-dot ${side}`}/><span>{nameOf(g, side)}</span><strong>{count(shown, side)} / 8</strong></span>)}</div>
        {g.stage === 'playing' && !g.pending && <div className={`phase-track ${g.active}`} aria-label="Avanzamento del turno">{(g.turn === 0 ? ['1° Attivazione'] : ['1° Attivazione', '2° Attivazione', 'Passo extra']).map((label, i) => <span key={label} title={label} aria-label={label} aria-current={i === g.phase ? 'step' : undefined} className={i < g.phase ? 'done' : i === g.phase ? 'current' : ''}><span className="phase-step-label">{label}</span></span>)}</div>}
          <ComputerPanel match={match} busy={busy} control={computer} onPause={pauseDuel} replaying={playback.replaying}/>
      </section>
      <section className="board-panel">
        <BoardGrid rotated={rotated} tracks={tracks} motion={motion} reducedEffects={feedback.reduced} pausedEffects={playback.active && playback.paused} overlay={<BattleOverlay frame={feedback.frame} frameKey={feedback.key} rotated={rotated} reduced={feedback.reduced} paused={playback.paused} influence={influence} charmLinks={charmLinks}/>} path={playback.frame?.path ?? (helpers ? path : null)} onSelect={boardClick} onDoubleSelect={doubleClickAbility} cell={p => {
        const actor = playback.frame?.actorId && wizard(shown, playback.frame.actorId);
        const copy = copyAt(shown, p), w = copy && copy.ownerId === playback.frame?.copyOwner ? undefined : actor && actor.pos && same(actor.pos, p) ? actor : at(shown, p), owner = copy && wizard(shown, copy.ownerId), wall = isWall(g, p);
        const visibleMage = motion && !playback.frame?.copyOwner ? at(shown, p, movingMage!.id) : motion && playback.frame?.copyOwner ? at(shown, p) : w;
        const visibleCopy = copy && copy.ownerId !== playback.frame?.copyOwner ? owner : !motion ? owner : undefined;
        const ghost = !visibleMage && !visibleCopy && playback.frame?.ghosts?.find(ghost => ghost.wizard.pos && same(ghost.wizard.pos, p));
        const stateText = w ? `${w.restrainedUntil !== undefined ? ' · Immobilizzato dal terreno: non può camminare; può agire ed essere spostato.' : ''}${w.id === charmedId ? ' · Affascinato: abilità bloccata fino alla fine di questa attivazione.' : ''}` : copy && owner && dormantCopy(owner, copy.pos) ? ' · Copia fuori distanza: non può agire finché l’Illusionista non torna entro tre caselle.' : '';
        const cues = cuesAt(playback.frame, p), focused = playback.frame?.points.some(q => same(q, p));
        const chosen = w && w.id === draft?.wizardId, available = highlights.some(q => same(q, p));
        const victim = helpers && partial.value?.effects.some(e => e.kind === 'damage' && e.at && same(e.at, p));
        const eliminated = !w && helpers && partial.value?.effects.find(e => e.kind === 'removed' && e.at && same(e.at, p));
        return { wizardId: w?.id, title: (wall ? 'Muro di forza: blocca movimento e visuale' : w ? `${INFO[w.kind].name} ${sideName(w.side)} · ${w.hp} PV` : copy ? `Copia illusoria ${sideName(copy.side)}` : square(p)) + stateText, label: (wall ? 'muro di forza' : w ? `${INFO[w.kind].name} ${sideName(w.side)}, ${w.hp} punti vita${w.restrainedUntil !== undefined ? ', immobilizzato' : ''}${shown.activated.includes(w.id) ? ', già attivato' : ''}` : copy ? `copia illusoria ${sideName(copy.side)}` : '') + stateText + (cues.length ? `, ${cues.map(c => c.text).join(', ')}` : ''), className: `${wall ? 'wall' : ''} ${chosen ? 'selected' : ''} ${!playback.active && available && helpers ? mode === 'move' ? 'reachable' : 'targetable' : ''} ${w && shown.activated.includes(w.id) ? 'spent' : ''} ${victim ? 'damaged-preview' : ''} ${focused ? 'event-focus' : ''} ${w && w.id === playback.frame?.actorId ? 'event-actor' : ''} ${cues.length ? 'event-affected' : ''}`, content: <>{wall ? <ForceWall/> : visibleMage ? <MageToken mage={visibleMage} fascinated={visibleMage.id === charmedId}/> : visibleCopy ? <MageToken mage={visibleCopy} copy dormant={dormantCopy(visibleCopy, copy!.pos)} summoning={Boolean(playback.frame?.visuals?.some(v => v.kind === 'summon' && v.impact && v.points.some(q => same(q, p))))}/> : ghost ? <span className={`battle-ghost ${ghost.copy ? 'ghost-copy' : ghost.departing ? 'ghost-teleport' : 'ghost-death'}`}><MageToken mage={ghost.wizard} copy={ghost.copy}/></span> : eliminated ? <span className="eliminated-preview">×</span> : !playback.active && available && helpers ? <span className="reachable-dot"/> : null}{cues.some(c => c.kind === 'status' || c.kind === 'move') && <span className="event-cues">{cues.filter(c => c.kind === 'status' || c.kind === 'move').map((cue, i) => <span key={`${feedback.key}:${i}`} className={`event-cue ${cue.kind}`} aria-label={cue.text} title={cue.text}><EffectIcon kind={cue.symbol === 'earth' ? 'earth' : cue.symbol === 'teleport' ? 'teleport' : 'summon'}/><span className="effect-sr">{cue.badge?.join(' ')}</span></span>)}</span>}</> };
      }}/>
        <div className="board-caption"><span className="caption-dot"/>Numeri sulle pedine: punti vita. Muri di forza: movimento e visuale bloccati.</div>
      </section>
      <aside className="side-column play-console">
        <div className="console-scroll">
          {online && <p className={`connection-indicator ${online.phase}`} role="status" data-online-revision={online.revision} data-online-fingerprint={online.fingerprint}><span data-testid="connection-state">{online.status}</span>{!online.enabled && online.phase !== 'connected' ? ' · apri il menù' : ''}</p>}
          {selected ? <section className="card mage-card mage-quick-info" aria-label="Mago consultato">
            <div className="mage-card-heading"><MageToken mage={selected} fascinated={selected.id === charmedId}/><div className="mage-quick-name"><h3>{INFO[selected.kind].name}</h3>{budget && selected.id === initial?.id ? budget : <p><span className={`seat-dot ${selected.side}`}/>{sideName(selected.side)} · {selected.hp} PV</p>}</div><button className="button secondary mage-details-button" aria-haspopup="dialog" onClick={() => setMageDetails({ game: shown, mageId: selected.id, charmedId })}><span aria-hidden="true">ⓘ</span> Dettagli</button></div>
            {selectedConditions.length > 0 && <div className="mage-quick-states">{selectedConditions.map(condition => <span key={condition.label} title={condition.description}>{condition.label}</span>)}</div>}
          </section> : null}
          {budget && selected?.id !== initial?.id && budget}
          {dirty && initial && (draft?.spell || mode !== 'move' || Boolean(partial.value?.effects.length)) && <section className="plan-preview" aria-label="Anteprima dell’attivazione"><p>{square(initial.pos!)} → {caster?.pos ? square(caster.pos) : '—'}{draft?.spell ? ` · ${INFO[initial.kind].ability}` : ''}</p>{helpers && partial.value && <ul className="effect-list">{partial.value.effects.map((effect, i) => <li key={i}>{effect.text}</li>)}</ul>}{(mode !== 'move' || draft?.spell) && <button className="button ghost" disabled={busy || playback.active} onClick={() => { if (draft) setDraft({ ...draft, spell: undefined, after: [] }); setMode('move'); setError(''); }}>Rimuovi abilità preparata</button>}</section>}
          <ActionPresentation control={playback} change={presentation} game={g} disabled={busy || computer.changingSpeed || dirty} canReplay={canReplay} showPause={!match.computer}/>
          <details className="console-menu game-history"><summary>Cronaca del duello · {g.log.length} eventi</summary>{g.log.length ? <ol>{g.log.map((row, i) => <li key={i}><span className="history-number">{i + 1}</span>{gameText(row)}</li>)}</ol> : <p>Nessuna azione confermata.</p>}</details>

        </div>
        {g.stage === 'deployment' ? <section className="card"><span className="eyebrow">SCHIERAMENTO PERSONALIZZATO</span><h3>{nameOf(g)}: colloca {deploymentInfo(g)[1] - g.deployment.count} maghi</h3><p>{observing ? online ? 'Attendi il collegamento e lo schieramento della gilda attiva.' : 'Il computer dispone i propri maghi nella sua prima riga.' : 'Scegli un mago, poi una casella libera nella prima riga, esclusi gli angoli.'}</p><div className="deployment-roster">{g.wizards.filter(w => w.side === g.active && !w.pos).map(w => <button key={w.id} disabled={busy || playback.active || observing} className={draft?.wizardId === w.id ? 'chosen' : ''} aria-label={`Schiera ${INFO[w.kind].name}`} onClick={() => select(w)}><MageToken mage={w}/><span>{INFO[w.kind].name}</span></button>)}</div><button className="button secondary full" disabled={busy || playback.active || observing || !match.undo.length} onClick={() => void apply({ kind: 'undo' })}>Annulla ultimo schieramento</button><p className="fine-print">Sequenza: Rosso 4 · Blu 6 · Rosso 2 · Blu 2 · Rosso 2. Ogni gruppo si conferma quando viene completato.</p></section> : <section className="card action-card action-dock" aria-label="Comandi di gioco">
          <div className="dock-instruction" role="status">{playback.replaying ? 'Stai rivedendo il turno avversario. Nessuna modifica alla partita.' : playback.active ? 'Azione in corso: osserva il campo.' : g.stage === 'finished' ? 'Duello concluso.' : observing ? online ? 'Attendi l’avversario o il collegamento.' : 'Il computer sta giocando.' : g.pending ? 'Conferma il risultato oppure annulla l’ultima attivazione.' : instruction}</div>

          {g.stage === 'playing' && !g.pending && g.phase < 3 && <>
            <div className="primary-actions">{['wind', 'copy'].includes(mode) ? <button className="button secondary" disabled={busy || playback.active} onClick={() => draft?.spell && changeSpell(draft.spell, 'move')}>Concludi abilità</button> : <button className="button secondary" disabled={!abilityAllowed || mode !== 'move'} onClick={startAbility} title="Prepara il potere; puoi anche fare doppio clic sul tuo mago">Usa abilità</button>}
              <button className="button primary confirm-activation" disabled={busy || playback.active || observing || !strict.value || mode !== 'move'} onClick={() => draft && void apply({ kind: 'activate', activation: draft, ...(finalActivation ? { finishTurn: true } : {}) })}>{confirmLabel}</button>
            </div>
            <div className="draft-actions"><button className="button ghost" disabled={!dirty || playback.active || observing} onClick={undoStep}>Annulla ultimo passo</button><button className="button ghost" disabled={!draft || playback.active || observing} onClick={reset}>Azzera preparazione</button></div>

            <div className="turn-actions"><button className="button secondary" disabled={busy || playback.active || observing || !match.undo.length || dirty} onClick={() => void apply({ kind: 'undo' })}>Annulla attivazione</button><button className="button ghost" title={skipped.error} disabled={busy || playback.active || observing || dirty || !skipped.value} onClick={() => void apply({ kind: 'skip', ...(skipFinal ? { finishTurn: true } : {}) })}>{g.phase === 2 ? 'Salta passo extra' : 'Salta attivazione'}</button></div>
            {finalActivation && <p className="fine-print semi-turn-note">La conferma passa la mano: le azioni di questo turno non saranno più annullabili.</p>}
            {g.phase === 2 && <p className="fine-print">Saltare il passo extra passa la mano all’altra gilda.</p>}

          </>}
          {!observing && (g.pending || g.phase >= 3) && g.stage === 'playing' && <div className="primary-actions"><button className="button secondary" disabled={busy || playback.active || !match.undo.length} onClick={() => void apply({ kind: 'undo' })}>Annulla attivazione</button><button className="button primary" disabled={!endAllowed} onClick={() => void apply({ kind: 'end-turn' })}>{g.pending ? 'Conferma vittoria' : 'Passa la mano'}</button></div>}
          {error && <p className="notice error" role="alert">{error}</p>}
        </section>}
      </aside>
    </main>
    {menuBody && createPortal(<>
          <section className="settings-menu"><h3>Impostazioni</h3>
            <label className="checkbox-label"><input type="checkbox" checked={helpers} onChange={e => setHelpers(e.target.checked)}/>Mostra aiuti e anteprime degli effetti</label>
            <label className="checkbox-label"><input type="checkbox" checked={manual} onChange={e => setManual(e.target.checked)}/>Modifica percorso passo per passo</label>
            <label>Animazioni delle nuove azioni<select aria-label="Riproduzione delle azioni" value={playback.mode} onChange={e => playback.changeMode(e.target.value as typeof playback.mode)}><option value="automatic">Automatiche</option><option value="manual">Passo per passo</option><option value="instant">Immediate</option></select></label>
            {match.computer?.side === 'both' && <ComputerSpeedSelect id="game-computer-speed" value={computer.speed} disabled={computer.changingSpeed || g.stage === 'finished'} onChange={computer.changeSpeed}/>}
            <BattlePreferences feedback={feedback}/>
          </section>
            <section className="game-menu-match"><h3>Partita</h3>
            {online?.panel}
            <button className="button secondary" disabled={busy && !online} onClick={() => online ? online.exportBackup() : exportGame(match)}><span aria-hidden="true">↓</span>{online ? 'Esporta backup personale' : 'Esporta partita'}</button>
            <p className="fine-print">Salvataggio automatico dopo ogni conferma. La preparazione non confermata non viene salvata.</p>
            <details><summary>Preparazione del campo</summary><p>{g.options.hp} PV · Dadi: {g.dice.join(', ')} · Muri: {g.walls.map(square).join(', ') || 'nessuno'} · Schieramento {g.options.placement === 'custom' ? 'personalizzato' : 'standard'}.</p></details>
            </section>
    </>, menuBody)}
    {mageDetails && <MageDetailsDialog request={mageDetails} onClose={() => setMageDetails(null)}/>}
    <MatchResultDialog game={g} ready={!playback.active && !navigationOpen} ownSide={online?.side ?? (match.computer && match.computer.side !== 'both' ? other(match.computer.side) : undefined)} home={home}/>
  </>;
}
