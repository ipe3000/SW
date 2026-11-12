import { MatchAnalysis, reviewPresentation, useMatchAnalysis, type ReviewLine } from './MatchAnalysis';
import { practiceMatch } from '../ai/match-analysis';
import { mageGlossary } from '../i18n/glossary';
import { formatMessage, GameMessageError } from '../i18n/messages';
import { useLanguage } from '../i18n/language';
import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { activate, at, canEnter, charmed, commitSkip, copyAt, copyRoute, count, defaultOptions, deploymentInfo, empty, finishesActivation, finishTurn, hasExtraStep, INFO, isWall, newMatch, other, phaseName, previewActivation, sideName, speed, targetPoints, teleportDestinations, wizard, type Activation, type AnalysisPosition, type Game, type Match, type Options, type Side, type Spell, type Wizard } from '../engine/game';
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
import { DifficultySelects } from './DifficultySelects';
import { ComputerSettingsDialog } from './ComputerSettingsDialog';
import type { ComputerDifficulties, ComputerDifficulty, ComputerSpeed } from '../engine/game';
import { displayPlayerName, presentationText } from './text';
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
import { lessonComplete, lessonFeedback, lessons, suggestedMage } from './tutorial-lessons';
import { TutorialGuide, type TutorialControls } from './TutorialGuide';

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
  const { language } = useLanguage();
  const ref = useRef<HTMLInputElement>(null);
  return <><button className="button ghost" disabled={disabled} onClick={() => ref.current?.click()}>{language === "en" ? "↑ Import match" : "↑ Importa partita"}</button><input type="file" accept=".json,application/json" hidden data-testid="import-game" ref={ref} onChange={e => { const file = e.target.files?.[0]; if (file) onFile(file); e.target.value = ''; }} /></>;
}
function exportGame(match: Match) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(match, null, 2)], { type: 'application/json' }));
  const a = document.createElement('a'); a.href = url; a.download = `strategic-wizardry-${match.game.id.slice(0, 8)}-r${match.revision}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const message = (e: unknown) => e instanceof GameMessageError ? e : e instanceof Error ? e.message : 'Operazione non riuscita.';
const nameOf = (g: Game, side = g.active) => side === 'red' ? g.options.redName : g.options.blueName;

export function LocalGame({ mode: opponent, onModeChange, onTutorial, suspended }: { mode: LocalMode; onModeChange: (mode: GameMode) => void; onTutorial?: (fromMatch: boolean) => void; suspended?: boolean }) {
  const { language } = useLanguage();
  const [match, setMatch] = useState<Match | null>(null), [saved, setSaved] = useState<Match[]>([]);
  useEffect(() => { window.scrollTo(0, 0); }, [match?.game.id]);
  const [presentation, setPresentation] = useState<Presentation | null>(null);
  const [options, setOptions] = useState<Options>({ ...defaultOptions });
  const [humanSide, setHumanSide] = useState<Side>('red');
  const [watchDifficulty, setWatchDifficulty] = useState<ComputerDifficulties>({});
  const [opponentDifficulty, setOpponentDifficulty] = useState<ComputerDifficulty>('normal');
  const [watchSpeed, setWatchSpeed] = useState<ComputerSpeed>('normal');
  const [error, setError] = useState<string | GameMessageError>(''), [busy, setBusy] = useState(false), [loading, setLoading] = useState(true);
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
      if (opponent === 'computer') value.computer = { profile: 'didactic-v1', side: computerSide, ...(opponentDifficulty !== 'normal' && { difficulty: { [computerSide]: opponentDifficulty } }) };
      if (opponent === 'watch') value.computer = { profile: 'didactic-v1', side: 'both', speed: watchSpeed, ...(Object.keys(watchDifficulty).length > 0 && { difficulty: watchDifficulty }) };
      await saveMatch(value); await open(value);
      if (opponent === 'watch') setWatchDifficulty({});
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
      if (file.size > 5_000_000) throw new GameMessageError('backupTheSaveExceedsTheMbLimit');
      const value = importMatch(await file.text()), existing = (await loadMatches()).find(item => item.game.id === value.game.id);
      if (existing && JSON.stringify(existing) !== JSON.stringify(value)) throw new GameMessageError('localBackupConflict');
      await saveMatch(value, existing?.revision); await open(value);
    } catch (e) { setError(message(e)); } finally { setBusy(false); }
  }
  return <div className={`app-shell local-app ${match ? 'in-match' : ''}`}>
    <GameNavigation inMatch={Boolean(match)} busy={busy} suspended={suspended} onTutorial={onTutorial} onExit={() => void home()}>
    {error && <div className="notice error" role="alert">{error instanceof GameMessageError ? formatMessage(error.code, language) : error}<button className="text-button" onClick={() => setError('')} aria-label={(language === "en" ? "Dismiss message" : "Chiudi messaggio")}>×</button></div>}
    {match ? <GameScreen key={match.game.id} match={match} presentation={presentation} save={persist} busy={busy} /> : <>
      <main className="local-home fantasy-entry"><EntryScene/><section className="card new-game"><h2>{(language === 'en' ? "New match" : "Nuova partita")}</h2><form onSubmit={create}>
        <GameModes value={opponent} onChange={onModeChange}/>
        {opponent === 'watch' ? <p className="computer-intro">{(language === 'en' ? "Watch two computer players duel. You can pause, resume, and save the match." : "Osserva due computer didattici giocare l’intera partita. Puoi mettere in pausa, riprendere e salvare il duello.")}</p> : opponent === 'computer' ? <><label>{(language === 'en' ? "Your guild" : "La tua gilda")}<select value={humanSide} onChange={e => setHumanSide(e.target.value as Side)}><option value="red">{(language === 'en' ? "Red · you go first" : "Rosso · cominci tu")}</option><option value="blue">{(language === 'en' ? "Blue · the computer goes first" : "Blu · comincia il computer")}</option></select></label><label>{(language === 'en' ? "Your name" : "Il tuo nome")}<input value={humanSide === 'red' ? options.redName : options.blueName} maxLength={40} onChange={e => setOptions({ ...options, [humanSide === 'red' ? 'redName' : 'blueName']: e.target.value })}/></label><p className="computer-intro">{(language === 'en' ? "Play against the computer with all eight mages. You can play in your browser without an account." : "Affronta il computer con tutti gli otto maghi. Gioca nel tuo browser, senza registrazione.")}</p></> : <div className="form-pair"><label>{(language === 'en' ? "Red player" : "Giocatore Rosso")}<input value={options.redName} maxLength={40} onChange={e => setOptions({ ...options, redName: e.target.value })}/></label><label>{(language === 'en' ? "Blue player" : "Giocatore Blu")}<input value={options.blueName} maxLength={40} onChange={e => setOptions({ ...options, blueName: e.target.value })}/></label></div>}
        <MatchOptions value={options} onChange={setOptions}/>
        {opponent === 'computer' && <DifficultySelects side={other(humanSide)} value={{ [other(humanSide)]: opponentDifficulty }} onChange={value => setOpponentDifficulty(value[other(humanSide)] ?? 'normal')}/>}
        {opponent === 'watch' && <DifficultySelects side="both" value={watchDifficulty} onChange={setWatchDifficulty}/>}
        {opponent === 'watch' && <ComputerSpeedSelect id="setup-computer-speed" value={watchSpeed} disabled={busy || loading} onChange={setWatchSpeed}/>}
        <button className="button primary full" disabled={busy || loading}>{opponent === 'watch' ? (language === 'en' ? "Start Computer vs Computer" : "Avvia Computer vs Computer") : opponent === 'computer' ? (language === 'en' ? "Play against the computer" : "Gioca contro il computer") : (language === 'en' ? "Start local match" : "Inizia partita locale")} <span>→</span></button>
      </form>
      <SavedGames loading={loading} items={saved.map(item => <li key={item.game.id}><button disabled={busy} onClick={() => void open(item)}><span className={`seat-dot ${item.game.active}`}/><span>{displayPlayerName(item.game.options.redName, language)} / {displayPlayerName(item.game.options.blueName, language)}<small>{item.computer?.side === 'both' ? 'Computer vs Computer · ' : item.computer ? `Contro il computer · giochi ${sideName(other(item.computer.side))} · ` : ''}{item.game.stage === 'finished' ? `${language === "en" ? "Victory for" : "Vittoria"} ${displayPlayerName(nameOf(item.game, item.game.result!.winner), language)}` : `${presentationText(phaseName(item.game), language)} · ${displayPlayerName(nameOf(item.game), language)}`} · {new Date(item.savedAt).toLocaleString(language === 'en' ? 'en' : 'it-IT')}</small></span><span>↗</span></button></li>)} importer={<ImportButton onFile={importFile} disabled={busy || loading}/>}/></section>
      </main>
    </>}
    </GameNavigation>
  </div>;
}

type Mode = 'move' | 'target' | 'wind' | 'teleport' | 'summon' | 'copy';
function tryValue<T>(fn: () => T): { value: T | null; error: string | GameMessageError } { try { return { value: fn(), error: '' }; } catch (e) { return { value: null, error: message(e) }; } }
export type OnlineControl = { status: string; revision: number; fingerprint: string; side: Side; enabled: boolean; phase: string; panel: ReactNode; invite: ReactNode; perform: (action: GameAction) => Promise<void>; displayed: (revision: number) => void; exportBackup: () => void };
type ScreenProps = { match: Match; presentation: Presentation | null; save: (next: Match, activation?: Activation) => Promise<void>; busy: boolean; online?: OnlineControl; tutorial?: TutorialControls };

export function GameScreen(props: ScreenProps) {
  const analysis = useMatchAnalysis();
  const [practice, setPractice] = useState<{ initial: Match; current: Match; presentation: Presentation | null } | null>(null);
  if (practice) return <GameBoard key={practice.initial.game.id} match={practice.current} presentation={practice.presentation} busy={false}
    practice={{
      restart: () => {
        const initial = practiceMatch(props.match, { before: practice.initial.game });
        setPractice({ initial, current: initial, presentation: null });
      },
      exit: () => setPractice(null),
    }}
    save={async (next, activation) => setPractice(previous => previous?.current === practice.current
      ? { ...previous, current: next, presentation: presentChange(previous.current, next, activation) } : previous)}/>;
  return <GameBoard {...props} analysis={props.tutorial ? undefined : analysis} onPractice={position => {
    const initial = practiceMatch(props.match, position);
    setPractice({ initial, current: initial, presentation: null });
  }}/>;
}

function GameBoard({ match, presentation, save, busy, online, tutorial, practice, onPractice, analysis }: ScreenProps & {
  analysis?: ReturnType<typeof useMatchAnalysis>;
  practice?: { restart: () => void; exit: () => void }; onPractice?: (position: AnalysisPosition) => void;
}) {
  const { language } = useLanguage();
  const terms = mageGlossary[language];
  const phases = language === 'en' ? ['1st Activation', '2nd Activation', 'Extra step'] : ['1° Attivazione', '2° Attivazione', 'Passo extra'];
  const guild = (side: Side) => language === "en" ? (side === "red" ? "Red" : "Blue") : sideName(side);
  const { menuBody, section, isOpen: navigationOpen, requestExit: home } = useGameMenu();
  const [reopenResult, setReopenResult] = useState(0);
  const g = match.game;
  const screenRef = usePlayViewport();
  const viewer = online?.side ?? (match.computer && match.computer.side !== 'both' ? other(match.computer.side) : g.active);
  const enemyTurn = match.replays?.[other(viewer)];
  const enemyReplay = useMemo(() => enemyTurn ? presentTurn(enemyTurn) : null, [enemyTurn]);
  const playback = usePresentation(presentation, match, enemyReplay);
  const finding = analysis?.open ? analysis.moment : undefined;
  const [review, setReview] = useState<{ finding: NonNullable<typeof finding>; line: ReviewLine; end: Game } | null>(null);
  const shownReview = finding && review?.finding === finding ? review : null;
  const analysisOpen = Boolean(analysis?.open);
  useEffect(() => {
    if (finding) document.querySelector<HTMLElement>('[data-analysis-heading]')?.focus({ preventScroll: true });
  }, [finding]);
  function resetReview() { playback.skip(); setReview(null); }
  function playReview(line: ReviewLine) {
    const positions = line === 'historical' ? finding?.historical : analysis?.suggestion?.suggested;
    if (!finding || !positions?.length) return;
    const sequence = reviewPresentation(positions);
    setReview({ finding, line, end: sequence.frames.at(-1)!.game });
    playback.replay(sequence);
  }
  const feedback = useBattleFeedback(playback, presentation);
  const [computerSettingsOpen, setComputerSettingsOpen] = useState(false);
  const computer = useComputer(match, save, busy, playback.active || navigationOpen || computerSettingsOpen);
  const resumeAfterComputerSettings = useRef(false);
  function openComputerSettings() {
    resumeAfterComputerSettings.current = playback.active && !playback.paused;
    if (resumeAfterComputerSettings.current) playback.togglePause();
    setComputerSettingsOpen(true);
  }
  function closeComputerSettings() {
    if (resumeAfterComputerSettings.current && playback.active && playback.paused) playback.togglePause();
    resumeAfterComputerSettings.current = false;
    setComputerSettingsOpen(false);
  }
  const practiceComplete = Boolean(tutorial && lessonComplete(tutorial.lesson, g));
  const [practicedUndo, setPracticedUndo] = useState(false);
  const tutorialMage = tutorial ? suggestedMage(tutorial.lesson, g) : undefined;
  const observing = practiceComplete || computer.computerTurn || Boolean(online && (online.side !== g.active || !online.enabled));
  useEffect(() => { if (!playback.active) online?.displayed(match.revision); }, [playback.active, match.revision, online?.phase, online?.displayed]);
  const [draft, setDraft] = useState<Activation | null>(null), [inspect, setInspect] = useState<string | null>(null), [mode, setMode] = useState<Mode>('move');
  const [teleTarget, setTeleTarget] = useState<string | null>(null);
  const [mageDetails, setMageDetails] = useState<MageDetailsRequest | null>(null);
  const resumeAfterInspection = useRef(false);
  function closeMageDetails() {
    if (resumeAfterInspection.current && playback.active && playback.paused) playback.togglePause();
    resumeAfterInspection.current = false; setMageDetails(null);
  }
  const doubleAbility = useRef<string | null>(null);
  const [rotated, setRotated] = useState(online ? online.side === 'blue' : match.computer?.side === 'red'), [helpers, setHelpers] = useState(true), [manual, setManual] = useState(false), [error, setError] = useState<string | GameMessageError>('');
  const reset = () => { setDraft(null); setMode('move'); setTeleTarget(null); setError(''); };
  useEffect(() => { reset(); }, [g]);
  const initial = draft ? wizard(g, draft.wizardId) : undefined;
  const partial = useMemo(() => draft ? tryValue(() => previewActivation(g, draft, true)) : { value: null, error: '' }, [g, draft]);
  const shown = playback.frame?.game ?? shownReview?.end ?? finding?.position.before ?? partial.value?.game ?? g;
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
  const confirmLabel = strict.value?.pending ? (language === "en" ? "Confirm and finish match" : "Conferma e concludi partita") : finalActivation ? (language === "en" ? "Confirm and end turn" : "Conferma e passa turno") : (language === "en" ? "Confirm activation" : "Conferma attivazione");
  const skipped = useMemo(() => tryValue(() => commitSkip(match)), [match]);
  const skipFinal = Boolean(skipped.value && (skipped.value.game.phase >= 3 || skipped.value.game.phase === 2 && !hasExtraStep(skipped.value.game)));
  const canReplay = !analysisOpen && Boolean(enemyReplay && !dirty && !busy && (!online || online.side === g.active || g.stage === 'finished') && (!computer.computerTurn || computer.paused));
  function pauseDuel() { const pause = !computer.paused; computer.togglePause(); if (playback.active && !playback.replaying && playback.paused !== pause) playback.togglePause(); }
  const mustPracticeUndo = tutorial?.lesson === 0 && !practicedUndo;
  const abilityAllowed = Boolean(!mustPracticeUndo && tutorial?.lesson !== 1 && initial && castMage?.pos && !locked && g.phase < 2 && !draft?.spell && !charmed(g, initial) && empty(atCast, castMage.pos, castMage.id) && targetPoints(atCast, castMage).length);
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
  async function apply(action: GameAction) {
    setError('');
    try {
      if (online) { await online.perform(action); return; }
      const next = applyGameAction(match, action);
      const activation = action.kind === 'activate' ? action.activation : undefined;
      if (tutorial) {
        const feedback = activation && lessonFeedback(tutorial.lesson, g, next.game, activation, practicedUndo, language);
        if (feedback) throw new Error(feedback);
        if (tutorial.lesson === 3 && next.game.active !== g.active && next.game.stage !== 'finished') {
          throw new GameMessageError('tutorialDefeatMage');
        }
      }
      await save(next, activation);
      if (tutorial?.lesson === 1 && action.kind === 'undo' && g.phase === 1) setPracticedUndo(true);
    } catch (e) { setError(message(e)); }
  }
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
    if (analysisOpen) return;
    const clicked = at(shown, p);
    // Remember the mode before the first click: selecting a spell target can return to 'move'.
    doubleAbility.current = mode === 'move' && !locked && !draft?.spell && clicked?.side === g.active && !g.activated.includes(clicked.id) && (!dirty || clicked.id === initial?.id) ? clicked.id : null;
    void click(p);
  }
  function doubleClickAbility(p: Point) {
    if (analysisOpen) return;
    const clicked = at(shown, p);
    if (mode === 'move' && clicked?.id === doubleAbility.current && clicked?.id === initial?.id && abilityAllowed) startAbility();
    doubleAbility.current = null;
  }
  async function click(p: Point) {
    if (busy) return;
    if (playback.active) { const clicked = at(shown, p); if (clicked) { setInspect(clicked.id); resumeAfterInspection.current = !playback.paused; if (!playback.paused) playback.togglePause(); setMageDetails({ game: shown, mageId: clicked.id, charmedId: playback.frame?.charmedId }); } return; }
    if (observing) { const clicked = at(g, p); if (clicked) setInspect(clicked.id); return; }
    setError('');
    if (g.stage === 'deployment') {
      if (!draft) { setError((language === "en" ? "Choose a mage to deploy first." : "Scegli prima un mago da schierare.")); return; }
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
        if (!highlights.some(q => same(q, p))) throw new GameMessageError('invalidAbilityTarget');
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
          if (!path) throw new GameMessageError('copyDestinationOutOfRange');
          changeSpell({ ...illusion, path, targetId: undefined }, 'copy');
        }
        return;
      }
      if (mode !== 'move' || !moveMage?.pos || shown.pending) return;
      const segment = draft.spell ? 'after' : 'before', old = draft[segment];
      const max = speed(g, initial) - (draft.spell ? draft.before.length : 0);
      const path = manual ? [...old, p] : shortestPath(moveMage.pos, p, max, q => canEnter(moveBase, q, initial.side, initial.id), q => empty(moveBase, q, initial.id));
      if (!path) throw new GameMessageError('unreachableDestination');
      const next = { ...draft, [segment]: path }, check = tryValue(() => previewActivation(g, next, true));
      if (!check.value) throw check.error;
      setDraft(next);
    } catch (e) { setError(message(e)); }
  }
  function undoStep() {
    if (!draft) return; setError('');
    if (tutorial?.lesson === 0 && mode === 'move' && !draft.spell && draft.before.length) setPracticedUndo(true);
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
  const motion = movingMage && movement ? { id: playback.movementKey, pieceId: playback.frame?.copyOwner ? `copy:${movingMage.id}` : movingMage.id, label: playback.frame?.copyOwner ? `Copia ${guild(movingMage.side)}` : `${terms[movingMage.kind].name} ${guild(movingMage.side)}`, from: movement.from, to: movement.to, content: <MageToken mage={movingMage} copy={Boolean(playback.frame?.copyOwner)} fascinated={movingMage.id === playback.frame?.charmedId}/>, duration: playback.movementDuration, paused: playback.paused, onComplete: playback.completeMovement } : undefined;
  const tracks = playback.frame?.tracks ?? (!draft ? playback.last?.frames.at(-1)?.tracks : undefined);
  const path = draft && initial?.pos ? [initial.pos, ...draft.before, ...draft.after] : null;
  const instruction = mode === 'target' ? (language === "en" ? "Choose a highlighted target." : "Scegli il bersaglio evidenziato.") : mode === 'teleport' ? (language === "en" ? "Choose the Teleport destination." : "Scegli la destinazione del teletrasporto.") : mode === 'wind' ? (language === "en" ? `Choose up to two steps for the target (${wind?.path.length ?? 0}/2), then finish the ability.` : `Scegli fino a due passi per il bersaglio (${wind?.path.length ?? 0}/2), poi concludi l’abilità.`) : mode === 'summon' ? (language === "en" ? "Choose where to summon the copy next to the Illusionist." : "Scegli dove evocare la copia, accanto all’Illusionista.") : mode === 'copy' ? (language === "en" ? "Move the copy, then choose an adjacent enemy to attack if desired. Finish the ability." : "Muovi la copia, poi scegli eventualmente un nemico adiacente da colpire. Concludi l’abilità.") : shown.pending ? (language === "en" ? "The defeat threshold has been reached. Confirm the activation or adjust your plan." : "La soglia di sconfitta è raggiunta. Conferma l’attivazione oppure modifica la preparazione.") : draft ? (language === "en" ? "Move the mage or prepare the ability." : "Muovi il mago o prepara l’abilità.") : g.phase >= 3 ? (language === "en" ? "All activations are complete. Undo an activation or end your turn." : "Le attivazioni sono concluse. Puoi annullare oppure passare la mano.") : (language === "en" ? "Select a mage from the active guild." : "Seleziona un mago della gilda attiva.");
  const budget = draft && initial && !playback.active ? <p className="draft-budget" data-actor={initial.id}><strong>{terms[initial.kind].name} · </strong>{caster?.hp ?? initial.hp} {language === "en" ? "HP · Steps" : "PV · Passi"} {draft.before.length + draft.after.length}/{speed(g, initial)}</p> : null;
  const replayButton = enemyReplay ? <button className="button ghost replay-button" aria-label={(language === "en" ? "Replay opponent’s last turn" : "Rivedi ultimo turno avversario")} title={(language === "en" ? "Replay opponent’s last turn" : "Rivedi ultimo turno avversario")} disabled={busy || playback.active || !canReplay} onClick={() => playback.replay()}>{language === "en" ? "Replay turn" : "Rivedi turno"}</button> : null;
  return <>
    <main ref={screenRef} className={`main-grid active-grid game-grid ergonomic-game fitted-game ${match.computer?.side === 'both' ? 'spectator' : ''}`}>
      <section className="game-heading">
        <div className="turn-heading"><span className="turn-number">{tutorial ? language === "en" ? `Tutorial · Exercise ${tutorial.lesson + 1} of ${lessons.length}` : `Tutorial · Prova ${tutorial.lesson + 1} di ${lessons.length}` : `${language === "en" ? "Turn" : "Turno"} ${(finding ? shown.turn : g.turn) + 1}`}{busy && <span role="status"> · {tutorial ? (language === "en" ? "Starting\u2026" : "Avvio…") : (language === "en" ? "Saving\u2026" : "Salvo…")}</span>}</span></div>
        <div className={`turn-status ${g.active}`}><div className="turn-status-text" role="status" aria-live="polite" aria-atomic="true">
          <h1 tabIndex={tutorial ? -1 : undefined}>{finding ? (language === "en" ? "Post-match analysis" : "Analisi post-partita") : tutorial ? lessons[tutorial.lesson][language].title : online && online.phase !== 'connected' ? (language === "en" ? "Waiting for connection." : "In attesa del collegamento.") : g.stage === 'finished' ? (language === "en" ? `Victory for ${displayPlayerName(nameOf(g, g.result!.winner), language)}` : `Vittoria ${nameOf(g, g.result!.winner)}`) : g.stage === 'deployment' ? (language === "en" ? "The guilds take their positions." : "Le gilde prendono posizione.") : (language === "en" ? `${displayPlayerName(nameOf(g), language)}’s turn.` : `Il turno di ${nameOf(g)}.`)}</h1>
        </div></div>
        <div className="guild-counts">{([rotated ? 'red' : 'blue', rotated ? 'blue' : 'red'] as Side[]).map(side => <span key={side}><span className={`seat-dot ${side}`}/><span>{displayPlayerName(nameOf(g, side), language)}</span><strong>{count(shown, side)}{!tutorial && ' / 8'}</strong></span>)}</div>
        {g.stage === 'finished' && !analysisOpen && !practice && !tutorial && <button className="button secondary" onClick={() => setReopenResult(value => value + 1)}>{language === 'en' ? 'Result and analysis' : 'Esito e analisi'}</button>}
        {g.stage === 'playing' && !g.pending && <div className={`phase-track ${g.active}`} aria-label={(language === "en" ? "Turn progress" : "Avanzamento del turno")}>{(g.turn === 0 ? phases.slice(0, 1) : phases).map((label, i) => <span key={label} title={label} aria-label={label} aria-current={i === g.phase ? 'step' : undefined} className={i < g.phase ? 'done' : i === g.phase ? 'current current-turn-phase' : ''}><span className="phase-step-label">{label}</span></span>)}</div>}
        {practice && <aside className="analysis-practice-bar" aria-label={language === 'en' ? 'Practice' : 'Allenamento'}>
          <strong>{language === 'en' ? 'Practice' : 'Allenamento'}</strong>
          <button className="button secondary" onClick={practice.restart}>{language === 'en' ? 'Retry from here' : 'Riprova da qui'}</button>
          <button className="button ghost" onClick={practice.exit}>{language === 'en' ? 'Return to original match' : 'Torna alla partita originale'}</button>
        </aside>}
      </section>
      <section className="board-panel">
        <div className="board-station">
        <div className="board-tools"><button className="button secondary rotate-board" onClick={() => setRotated(!rotated)} aria-label={(language === "en" ? "Rotate board" : "Ruota la scacchiera")} title={language === "en" ? "Rotate board" : "Ruota campo"}><span aria-hidden="true">↻</span><span>{language === "en" ? "Rotate" : "Ruota"}</span></button></div>
        <BoardGrid rotated={rotated} keyboardStart={tutorialMage ? wizard(g, tutorialMage)?.pos ?? undefined : undefined} tracks={tracks} motion={motion} reducedEffects={feedback.reduced} pausedEffects={playback.active && playback.paused} overlay={<BattleOverlay frame={feedback.frame} frameKey={feedback.key} rotated={rotated} reduced={feedback.reduced} paused={playback.paused} influence={influence} charmLinks={charmLinks}/>} path={playback.frame?.path ?? (helpers ? path : null)} onSelect={analysisOpen ? undefined : boardClick} onDoubleSelect={analysisOpen ? undefined : doubleClickAbility} cell={p => {
        const actor = playback.frame?.actorId && wizard(shown, playback.frame.actorId);
        const copy = copyAt(shown, p), w = copy && copy.ownerId === playback.frame?.copyOwner ? undefined : actor && actor.pos && same(actor.pos, p) ? actor : at(shown, p), owner = copy && wizard(shown, copy.ownerId), wall = isWall(g, p);
        const visibleMage = motion && !playback.frame?.copyOwner ? at(shown, p, movingMage!.id) : motion && playback.frame?.copyOwner ? at(shown, p) : w;
        const visibleCopy = copy && copy.ownerId !== playback.frame?.copyOwner ? owner : !motion ? owner : undefined;
        const ghost = !visibleMage && !visibleCopy && playback.frame?.ghosts?.find(ghost => ghost.wizard.pos && same(ghost.wizard.pos, p));
        const stateText = w ? `${w.restrainedUntil !== undefined ? (language === "en" ? " \u00b7 Restrained by Earth Grasp. Can use abilities and be moved, but cannot walk." : " · Immobilizzato dal terreno: non può camminare; può agire ed essere spostato.") : ''}${w.id === charmedId ? (language === "en" ? " \u00b7 Charmed. Ability blocked until this activation ends." : " · Affascinato: abilità bloccata fino alla fine di questa attivazione.") : ''}` : copy && owner && dormantCopy(owner, copy.pos) ? (language === "en" ? " \u00b7 Copy out of range. It cannot act until the Illusionist returns within three squares." : " · Copia fuori distanza: non può agire finché l’Illusionista non torna entro tre caselle.") : '';
        const cues = cuesAt(playback.frame, p), focused = playback.frame?.points.some(q => same(q, p)) || Boolean(finding && !shownReview && w?.id === finding.position.activation.wizardId);
        const guided = Boolean(tutorialMage && !practiceComplete && !playback.active && !draft && w?.id === tutorialMage);
        const tutorialBlast = tutorial?.lesson === 2 && !playback.active && draft?.spell?.kind === 'fireball' && distance(draft.spell.center, p) <= 1;
        const chosen = w && w.id === draft?.wizardId, available = highlights.some(q => same(q, p));
        const victim = helpers && partial.value?.effects.some(e => e.kind === 'damage' && e.at && same(e.at, p));
        const eliminated = !w && helpers && partial.value?.effects.find(e => e.kind === 'removed' && e.at && same(e.at, p));
        return { wizardId: w?.id, title: (wall ? (language === "en" ? "Force wall: blocks movement and line of sight" : "Muro di forza: blocca movimento e visuale") : w ? `${terms[w.kind].name} ${guild(w.side)} · ${w.hp} ${language === "en" ? "HP" : "PV"}` : copy ? (language === "en" ? `${guild(copy.side)} Illusory Copy` : `Copia illusoria ${guild(copy.side)}`) : square(p)) + stateText, label: (wall ? (language === "en" ? "force wall" : "muro di forza") : w ? `${terms[w.kind].name} ${guild(w.side)}, ${w.hp} ${language === "en" ? "HP" : "punti vita"}${w.restrainedUntil !== undefined ? (language === "en" ? ", restrained" : ", immobilizzato") : ''}${shown.activated.includes(w.id) ? (language === "en" ? ", already activated" : ", già attivato") : ''}` : copy ? (language === "en" ? `${guild(copy.side)} illusory copy` : `copia illusoria ${guild(copy.side)}`) : '') + stateText + (cues.length ? `, ${cues.map(c => presentationText(c.text, language)).join(', ')}` : '') + (guided ? (language === "en" ? ", suggested mage" : ", mago suggerito") : '') + (tutorialBlast ? (language === "en" ? ', Fireball area' : ', area della Palla di fuoco') : ''), className: `${wall ? 'wall' : ''} ${chosen ? 'selected' : ''} ${guided ? 'tutorial-guided' : ''} ${tutorialBlast ? 'tutorial-blast' : ''} ${!playback.active && available && helpers ? mode === 'move' ? 'reachable' : 'targetable' : ''} ${w && shown.activated.includes(w.id) ? 'spent' : ''} ${victim ? 'damaged-preview' : ''} ${focused ? 'event-focus' : ''} ${w && w.id === playback.frame?.actorId ? 'event-actor' : ''} ${cues.length ? 'event-affected' : ''}`, content: <>{wall ? <ForceWall/> : visibleMage ? <MageToken mage={visibleMage} fascinated={visibleMage.id === charmedId}/> : visibleCopy ? <MageToken mage={visibleCopy} copy dormant={dormantCopy(visibleCopy, copy!.pos)} summoning={Boolean(playback.frame?.visuals?.some(v => v.kind === 'summon' && v.impact && v.points.some(q => same(q, p))))}/> : ghost ? <span className={`battle-ghost ${ghost.copy ? 'ghost-copy' : ghost.departing ? 'ghost-teleport' : 'ghost-death'}`}><MageToken mage={ghost.wizard} copy={ghost.copy}/></span> : eliminated ? <span className="eliminated-preview">×</span> : !playback.active && available && helpers ? <span className="reachable-dot"/> : null}{cues.some(c => c.kind === 'status' || c.kind === 'move') && <span className="event-cues">{cues.filter(c => c.kind === 'status' || c.kind === 'move').map((cue, i) => <span key={`${feedback.key}:${i}`} className={`event-cue ${cue.kind}`} aria-label={presentationText(cue.text, language)} title={presentationText(cue.text, language)}><EffectIcon kind={cue.symbol === 'earth' ? 'earth' : cue.symbol === 'teleport' ? 'teleport' : 'summon'}/><span className="effect-sr">{presentationText(cue.badge?.join(' ') ?? '', language)}</span></span>)}</span>}</> };
      }}/>
          {g.stage === 'playing' && !observing && (
            <div className="primary-actions board-actions" role="group" aria-label={(language === "en" ? "Turn actions" : "Azioni del turno")}>
              {!(g.pending || g.phase >= 3) && (
                ['wind', 'copy'].includes(mode) ? (
                  <button className="button secondary" disabled={busy || playback.active} onClick={() => draft?.spell && changeSpell(draft.spell, 'move')}>{(language === "en" ? "Finish ability" : "Concludi abilità")}</button>
                ) : (
                  <button className="button secondary ability-action" disabled={!abilityAllowed || mode !== 'move'} onClick={startAbility} title="Con il mouse puoi anche fare doppio clic sul tuo mago.">
                    {draft?.spell ? (language === "en" ? "Ability prepared" : "Potere preparato") : (language === "en" ? "Use ability" : "Usa abilità")}
                    {abilityAllowed && mode === 'move' && <span className="ability-shortcut" aria-hidden="true">{language === "en" ? "Double-click your mage" : "Doppio clic sul tuo mago"}</span>}
                  </button>
                )
              )}
              {g.pending || g.phase >= 3 ? (
                <button className="button primary board-confirm" disabled={!endAllowed} onClick={() => void apply({ kind: 'end-turn' })}>{g.pending ? (language === "en" ? "Confirm victory" : "Conferma vittoria") : (language === "en" ? "End turn" : "Passa la mano")}</button>
              ) : (
                <button className="button primary confirm-activation board-confirm" title={finalActivation ? 'La conferma passa la mano: le azioni non saranno più annullabili.' : 'Applica la preparazione al campo.'} disabled={locked || mustPracticeUndo || !strict.value || mode !== 'move'} onClick={() => draft && void apply({ kind: 'activate', activation: draft, ...(finalActivation ? { finishTurn: true } : {}) })}>{confirmLabel}</button>
              )}
            </div>
          )}
        </div>
        <div className="board-caption"><span className="caption-dot"/>Numeri sulle pedine: punti vita. Muri di forza: movimento e visuale bloccati.</div>
      </section>
      <aside className="side-column play-console">
        <div className="console-scroll" hidden={analysisOpen}>
          {online?.invite}
          {online && <p className={`connection-indicator ${online.phase}`} role="status" data-online-revision={online.revision} data-online-fingerprint={online.fingerprint}><span data-testid="connection-state">{online.status}</span>{!online.enabled && online.phase !== 'connected' ? (language === "en" ? " \u00b7 open the menu" : " · apri il menù") : ''}</p>}
          {selected && !playback.active ? <section className="card mage-card mage-quick-info" aria-label={selected.id === initial?.id && !observing ? (language === "en" ? "Mage being activated" : "Mago in preparazione") : (language === "en" ? "Mage being inspected" : "Mago consultato")}>
            <div className="mage-card-heading"><MageToken mage={selected} fascinated={selected.id === charmedId}/><div className="mage-quick-name"><span className="mage-context-label">{selected.id === initial?.id && !observing ? (language === "en" ? "Planning" : "In preparazione") : (language === "en" ? "Inspecting" : "In consultazione")} · {guild(selected.side)}</span><h3>{terms[selected.kind].name}</h3>{budget && selected.id === initial?.id ? budget : <p><span className={`seat-dot ${selected.side}`}/>{guild(selected.side)} · {selected.hp} {language === "en" ? "HP" : "PV"}</p>}</div><button className="button secondary mage-details-button" aria-haspopup="dialog" onClick={() => setMageDetails({ game: shown, mageId: selected.id, charmedId })}><span aria-hidden="true">ⓘ</span> {(language === "en" ? "Details" : "Dettagli")}</button></div>
            {selectedConditions.length > 0 && <div className="mage-quick-states">{selectedConditions.map(condition => <span key={condition.label} title={condition.description}>{condition.label}</span>)}</div>}
          </section> : null}
          {budget && selected?.id !== initial?.id && budget}

          <ActionPresentation control={playback} change={presentation} game={g} disabled={busy || dirty} canReplay={canReplay} hasReplay={false} showPause={!match.computer}/>


        </div>
        {computerSettingsOpen && match.computer && <ComputerSettingsDialog opponent={match.computer} busy={busy}
          onClose={closeComputerSettings}
          onApply={opponent => save({ ...match, computer: opponent, revision: match.revision + 1, savedAt: new Date().toISOString() })}/>}
        {analysis?.open ? <MatchAnalysis analysis={{ ...analysis, close: () => { resetReview(); analysis.close(); } }} line={shownReview?.line}
          playing={playback.active} paused={playback.paused} onPause={playback.togglePause} onFinish={playback.skip}
          onPlay={playReview} onSelect={index => { resetReview(); analysis.setIndex(index); }} onReset={resetReview}
          onPractice={position => onPractice?.(position)}/> : g.stage === 'deployment' ? <section className="card deployment-dock"><span className="eyebrow">{(language === "en" ? "CUSTOM DEPLOYMENT" : "SCHIERAMENTO PERSONALIZZATO")}</span><h3>{displayPlayerName(nameOf(g), language)}: {language === "en" ? "deploy" : "colloca"} {deploymentInfo(g)[1] - g.deployment.count} {language === "en" ? "mages" : "maghi"}</h3><ComputerPanel match={match} busy={busy} control={computer} onPause={pauseDuel} onSettings={openComputerSettings}/><p>{observing ? online ? (language === "en" ? "Wait for the connection and the active guild’s deployment." : "Attendi il collegamento e lo schieramento della gilda attiva.") : (language === "en" ? "The computer is deploying its mages on its first rank." : "Il computer dispone i propri maghi nella sua prima riga.") : (language === "en" ? "Choose a mage, then an empty square on your first rank, excluding the corners." : "Scegli un mago, poi una casella libera nella prima riga, esclusi gli angoli.")}</p>{!observing && <div className="deployment-roster">{g.wizards.filter(w => w.side === g.active && !w.pos).map(w => <button key={w.id} disabled={busy || playback.active || observing} className={draft?.wizardId === w.id ? 'chosen' : ''} aria-label={`${language === "en" ? "Deploy" : "Schiera"} ${terms[w.kind].name}`} onClick={() => select(w)}><MageToken mage={w}/><span>{terms[w.kind].name}</span></button>)}</div>}{!observing && match.undo.length > 0 && <button className="button secondary full" disabled={busy || playback.active} onClick={() => void apply({ kind: 'undo' })}>{(language === "en" ? "Undo last deployment" : "Annulla ultimo schieramento")}</button>}</section> : <section className="card action-card action-dock" aria-label={(language === "en" ? "Game controls" : "Comandi di gioco")}>
          {match.computer && <ComputerPanel match={match} busy={busy} control={computer} onPause={pauseDuel} onSettings={openComputerSettings} replaying={playback.replaying}/>}
          {tutorial ? <TutorialGuide {...tutorial} game={g} draft={draft} mode={mode} instruction={instruction} abilityAllowed={abilityAllowed} practicedUndo={practicedUndo} effects={partial.value?.effects ?? []} playback={playback.active} complete={practiceComplete} busy={busy}/> : (!match.computer || !observing && !computer.paused && g.stage !== 'finished') && <div className="dock-instruction" role="status">{playback.replaying ? (language === "en" ? "Replaying your opponent's turn." : "Stai rivedendo il turno avversario.") : playback.active ? (language === "en" ? "Action in progress. Watch the battlefield." : "Azione in corso: osserva il campo.") : g.stage === 'finished' ? (language === "en" ? "Duel complete." : "Duello concluso.") : observing ? online && online.phase !== 'connected' ? (language === "en" ? "Wait for the connection." : "Attendi il collegamento.") : (language === "en" ? "Wait for your opponent." : "Attendi l’avversario.") : g.pending ? (language === "en" ? "Confirm the result or undo the last activation." : "Conferma il risultato oppure annulla l’ultima attivazione.") : instruction}</div>}


          {!observing && !playback.active && g.stage === 'playing' && !g.pending && g.phase < 3 && <>
            <div className="secondary-actions"><div className="draft-actions" aria-label={(language === "en" ? "Edit planned action" : "Correzioni della preparazione")}>{dirty && <><span className="correction-label">{(language === "en" ? "Planned action" : "Preparazione")}</span><button className="button ghost" disabled={!dirty || playback.active || observing} onClick={undoStep}>{(language === "en" ? "Undo last step" : "Annulla ultimo passo")}</button><button className="button ghost" disabled={!draft || playback.active || observing} onClick={reset}>{(language === "en" ? "Clear planned action" : "Azzera preparazione")}</button></>}</div>

            <div className="turn-actions" aria-label={(language === "en" ? "Confirmed actions" : "Azioni confermate")}>{!dirty && match.undo.length > 0 && <><span className="correction-label">{(language === "en" ? "Confirmed actions" : "Azioni confermate")}</span><button className="button secondary" disabled={busy || playback.active || observing || !match.undo.length || dirty} onClick={() => void apply({ kind: 'undo' })}>{(language === "en" ? "Undo activation" : "Annulla attivazione")}</button></>}{!dirty && skipped.value && (!tutorial || g.phase === 2) && <button className="button ghost" title={skipped.error instanceof GameMessageError ? formatMessage(skipped.error.code, language) : skipped.error} disabled={busy || playback.active || observing || dirty || !skipped.value} onClick={() => void apply({ kind: 'skip', ...(skipFinal ? { finishTurn: true } : {}) })}>{g.phase === 2 ? (language === "en" ? "Skip extra step" : "Salta passo extra") : (language === "en" ? "Skip activation" : "Salta attivazione")}</button>}{!dirty && !tutorial && replayButton}</div></div>



          </>}
          {!observing && (g.pending || g.phase >= 3) && g.stage === 'playing' && <div className="turn-actions"><button className="button secondary" disabled={busy || playback.active || !match.undo.length} onClick={() => void apply({ kind: 'undo' })}>{(language === "en" ? "Undo activation" : "Annulla attivazione")}</button></div>}
          {!playback.active && (observing && computer.paused) && replayButton}
          {error && <p className="notice error" role="alert">{error instanceof GameMessageError ? formatMessage(error.code, language) : error}</p>}
        </section>}
      </aside>
    </main>
    {menuBody && createPortal(<>
          {section === 'settings' && <section className="settings-menu"><h3>{language === "en" ? "Controls and visual aids" : "Aiuti e comandi"}</h3>
            <label className="checkbox-label"><input type="checkbox" checked={helpers} onChange={e => setHelpers(e.target.checked)}/>{language === "en" ? "Show aids and effect previews" : "Mostra aiuti e anteprime degli effetti"}</label>
            <label className="checkbox-label"><input type="checkbox" checked={manual} onChange={e => setManual(e.target.checked)}/>{language === "en" ? "Plan paths one square at a time" : "Traccia il percorso una casella alla volta"}</label>
            <label>{language === "en" ? "Action playback" : "Riproduzione delle azioni"}<select aria-label={language === "en" ? "Action playback" : "Riproduzione delle azioni"} value={playback.mode} onChange={e => playback.changeMode(e.target.value as typeof playback.mode)}><option value="automatic">{language === "en" ? "Automatic" : "Automatiche"}</option><option value="manual">{language === "en" ? "Step by step" : "Passo per passo"}</option><option value="instant">{language === "en" ? "Instant" : "Immediate"}</option></select></label>

            <BattlePreferences feedback={feedback}/>
          </section>}
          {section === 'match' && <section className="game-menu-match">
            <div className="match-save">
              <button className="button secondary" disabled={busy && !online} onClick={() => online ? online.exportBackup() : exportGame(match)}><span aria-hidden="true">↓</span>{online ? (language === "en" ? "Export personal backup" : "Esporta backup personale") : (language === "en" ? "Export match" : "Esporta partita")}</button>
              <p>{language === "en" ? "Confirmed actions are saved in this browser." : "Dopo ogni conferma la partita si salva in questo browser."}</p>
              {online && <p className="fine-print">{(language === "en" ? "The backup grants access to your seat. Keep it to resume from another browser." : "Il backup contiene il tuo accesso personale al duello. Conservalo per rientrare da un altro browser.")}</p>}
            </div>
            <details className="console-menu game-history"><summary>{language === "en" ? "Duel history" : "Cronaca del duello"} · {g.log.length} {language === "en" ? "events" : "eventi"}</summary>{g.log.length ? <ol>{g.log.map((row, i) => <li key={i}><span className="history-number">{i + 1}</span>{presentationText(row, language)}</li>)}</ol> : <p>{language === "en" ? "No confirmed actions." : "Nessuna azione confermata."}</p>}</details>
            <details><summary>{language === "en" ? "Board setup" : "Preparazione del campo"}</summary><p>{g.options.hp} {language === "en" ? "HP · Dice" : "PV · Dadi"}: {g.dice.join(', ')} · {language === "en" ? "Walls" : "Muri"}: {g.walls.map(square).join(', ') || (language === 'en' ? 'none' : 'nessuno')} · {language === 'en' ? 'Deployment' : 'Schieramento'} {g.options.placement === 'custom' ? (language === 'en' ? 'custom' : 'personalizzato') : 'standard'}.</p></details>
            {g.stage === 'finished' && replayButton}
          </section>}
          {section === 'connection' && online?.panel}
    </>, menuBody)}

    {mageDetails && <MageDetailsDialog request={mageDetails} onClose={closeMageDetails}>{draft && initial && mageDetails.mageId === initial.id && <section className="mage-power"><h3>{(language === "en" ? "Planned activation" : "Preparazione dell’attivazione")}</h3><p>{square(initial.pos!)} → {caster?.pos ? square(caster.pos) : '—'}{draft.spell ? ` · ${terms[initial.kind].ability}` : ''}</p>{helpers && partial.value && <ul className="effect-list">{partial.value.effects.map((effect, i) => <li key={i}>{presentationText(effect.text, language)}</li>)}</ul>}<p>{(language === "en" ? "The planned action takes effect when you confirm it." : "La preparazione si applica solo dopo la conferma.")}</p>{draft.spell && <button className="button secondary" onClick={() => { setDraft({ ...draft, spell: undefined, after: [] }); setMode('move'); setError(''); setMageDetails(null); }}>{(language === "en" ? "Remove planned ability" : "Rimuovi abilità preparata")}</button>}</section>}</MageDetailsDialog>}
    {!tutorial && <MatchResultDialog match={match} reopen={reopenResult} practice={Boolean(practice)} onAnalyze={analysis ? side => { resetReview(); analysis.start(match, side); } : undefined} ready={!analysisOpen && !playback.active && !navigationOpen} ownSide={online?.side ?? (match.computer && match.computer.side !== 'both' ? other(match.computer.side) : undefined)} home={practice?.exit ?? home}/>}
  </>;
}
