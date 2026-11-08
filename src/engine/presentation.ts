import { charmed, INFO, previewActivation, sideName, wizard, type Activation, type Game, type Match, type ResolutionEvent, type TurnReplay } from './game';
import { same, square, type Point } from './geometry';
import { eventVisuals, removedGhosts, spellVisual, type VisualEffect, type VisualGhost } from './visual-effects';

export type Cue = { at: Point; text: string; badge?: string[]; amount?: number; symbol?: 'damage' | 'skull' | 'dissolve' | 'earth' | 'summon' | 'teleport' | 'release'; kind: 'damage' | 'removed' | 'status' | 'move' };
export type MovementTrack = { id: string; label: string; points: Point[]; completed: number; copy?: boolean };
export type Frame = { game: Game; title: string; details: string[]; actorId?: string; copyOwner?: string; charmedId?: string; visuals?: VisualEffect[]; ghosts?: VisualGhost[]; points: Point[]; path?: Point[]; tracks?: MovementTrack[]; movement?: { from: Point; to: Point; step: number }; cues: Cue[]; weight: number };
export type Presentation = { id: number; kind: 'activation' | 'change' | 'undo'; title: string; summary: string[]; frames: Frame[] };
const clone = <T,>(value: T): T => structuredClone(value);
const mageName = (g: Game, id: string) => { const w = wizard(g, id)!; return `${INFO[w.kind].name} ${sideName(w.side)}`; };

/** The observer follows the engine's actual resolution; it never infers rules from the log. */
export function presentActivation(before: Game, after: Game, activation: Activation, id: number): Presentation {
  const actor = wizard(before, activation.wizardId)!, title = `${mageName(before, actor.id)} · ${before.phase === 2 ? 'semiattivazione' : 'attivazione'}`;
  const frames: Frame[] = [{ game: clone(before), title, details: [charmed(before, actor) ? 'Incantato all’inizio: può muovere, ma non usare abilità.' : 'Segui il mago evidenziato.'], actorId: actor.id, points: [actor.pos!], cues: [], weight: .6 }];
  const tracks: MovementTrack[] = activation.before.length + activation.after.length ? [{ id: actor.id, label: mageName(before, actor.id), points: [actor.pos!, ...activation.before, ...activation.after], completed: 0 }] : [];
  frames[0].tracks = clone(tracks);
  const summary: string[] = [];
  let spellEffect: VisualEffect | undefined;
  function event(e: ResolutionEvent) {
    const game = clone(e.game), effects = e.effects ?? [];
    const previous = frames.at(-1)!.game;
    if (e.kind === 'ability' && activation.spell) spellEffect = spellVisual(game, actor.id, activation.spell);
    const details = effects.map(effect => effect.text);
    let heading: string = e.kind === 'ability' ? `${mageName(before, actor.id)}: ${INFO[actor.kind].ability}` : e.kind === 'damage' ? 'Danni simultanei' : e.kind === 'removed' ? 'Eliminazioni e copie svanite' : e.kind === 'restrain' ? 'Immobilizzazione' : e.kind === 'teleport' ? 'Teletrasporto · senza percorso intermedio' : e.kind === 'wind' ? 'Spostamento causato dal vento' : e.kind === 'copy' ? 'Copia illusoria' : 'Movimento';
    if (e.path) {
      const movingName = e.copyOwner ? `Copia ${sideName(actor.side)}` : mageName(before, e.actorId);
      const description = `${movingName}: ${square(e.path[0])} → ${square(e.path.at(-1)!)}${e.kind === 'wind' ? ' · spostato dal vento' : ''}.`;
      summary.push(description);
      const trackId = e.copyOwner ? `copy:${e.copyOwner}` : e.actorId;
      let track = tracks.find(t => t.id === trackId);
      if (!track) { track = { id: trackId, label: movingName, points: e.path, completed: 0, copy: Boolean(e.copyOwner) }; tracks.push(track); }
      for (let i = 1; i < e.path.length; i++) {
        const snapshot = clone(game);
        if (e.copyOwner) snapshot.copies.find(c => c.ownerId === e.copyOwner)!.pos = e.path[i];
        else wizard(snapshot, e.actorId)!.pos = e.path[i];
        track.completed++;
        frames.push({ game: snapshot, title: heading, details: [description, `Passo ${track.completed} di ${track.points.length - 1}.`], actorId: e.actorId, copyOwner: e.copyOwner, path: e.path, tracks: clone(tracks), movement: { from: e.path[i - 1], to: e.path[i], step: track.completed }, visuals: e.kind === 'wind' ? [{ kind: 'wind', points: [e.path[i]], origin: e.path[i - 1], impact: true }] : [], points: [e.path[i]], cues: [], weight: .35 });
      }
      return;
    }
    const cues: Cue[] = effects.flatMap<Cue>(effect => {
      const at = effect.at ?? (effect.wizardId && wizard(game, effect.wizardId)?.pos);
      if (!at) return [];
      if (effect.kind === 'damage') {
        const current = wizard(game, effect.wizardId!)!, previous = effect.fromHp!;
        return [{ at, kind: 'damage' as const, symbol: 'damage', amount: effect.amount, badge: [`−${effect.amount} PV`, `${previous} → ${current.hp}`, ...(current.hp === 0 ? ['Eliminato'] : [])], text: `−${effect.amount} PV · ${previous} → ${current.hp}${current.hp === 0 ? ' · ELIMINATO' : ''}` }];
      }
      const text = effect.kind === 'removed' ? 'ELIMINATO' : effect.kind === 'copy' && e.kind === 'removed' ? 'COPIA SVANITA' : effect.kind === 'restrain' ? 'IMMOBILIZZATO' : effect.kind === 'move' ? 'TELETRASPORTO' : 'COPIA EVOCATA';
      return [{ at, kind: effect.kind === 'removed' || effect.kind === 'copy' && e.kind === 'removed' ? 'removed' as const : 'status' as const, symbol: effect.kind === 'removed' ? 'skull' : effect.kind === 'restrain' ? 'earth' : effect.kind === 'move' ? 'teleport' : e.kind === 'removed' ? 'dissolve' : 'summon', text, badge: effect.kind === 'removed' ? ['×', 'Eliminato'] : effect.kind === 'restrain' ? ['⛓', 'Bloccato'] : effect.kind === 'move' ? ['✦', 'Arrivo'] : text.split(' ') }];
    });
    if (e.kind === 'damage' && effects.length === 1) heading = 'Danno';
    if (e.kind === 'ability') {
      const spell = activation.spell!;
      const target = 'targetId' in spell && spell.targetId ? wizard(game, spell.targetId) : undefined;
      const description = spell.kind === 'fireball' ? `Centro ${square(spell.center)}: colpisce i nemici nella croce evidenziata.` : spell.kind === 'lightning' ? `${e.points?.length ?? 0} maghi collegati, alleati compresi. Il lanciatore è immune.` : target ? `Bersaglio: ${mageName(game, target.id)} in ${square(target.pos!)}.` : 'L’Illusionista evoca o comanda la propria copia.';
      details.push(description);
      summary.push(`${INFO[actor.kind].ability}. ${description}`);
    }
    if (e.kind !== 'ability') summary.push(...details);
    frames.push({ game, title: heading, details: details.length ? details : [e.kind === 'ability' ? 'Bersagli e area evidenziati sulla scacchiera.' : heading], actorId: e.actorId, tracks: clone(tracks), visuals: eventVisuals(e, spellEffect, previous), ghosts: removedGhosts(previous, e), points: e.points ?? effects.flatMap(effect => effect.at ? [effect.at] : []), cues, weight: e.kind === 'damage' || e.kind === 'removed' ? 1.8 : .9 });
  }
  previewActivation(before, activation, false, event);
  if (charmed(before, actor)) for (const frame of frames) frame.charmedId = actor.id;
  if (!summary.length) summary.push('Nessun movimento o abilità in questa attivazione.');
  if (after.turn !== before.turn) {
    summary.push(`Turno confermato: la mano passa a ${sideName(after.active)}.`);
    for (const w of before.wizards) if (w.restrainedUntil !== undefined && wizard(after, w.id)?.restrainedUntil === undefined) summary.push(`${mageName(before, w.id)}: immobilizzazione terminata.`);
  }
  if (after.pending) summary.push(`Risultato provvisorio: vince ${sideName(after.pending.winner)}. La soglia di sconfitta è raggiunta.`);
  const released = before.wizards.filter(w => w.restrainedUntil !== undefined && wizard(after, w.id)?.restrainedUntil === undefined).flatMap(w => wizard(after, w.id)?.pos ? [wizard(after, w.id)!.pos!] : []);
  frames.push({ game: clone(after), title: 'Attivazione conclusa', details: summary, actorId: actor.id, tracks: clone(tracks), visuals: released.length ? [{ kind: 'release', points: released }] : [], points: wizard(after, actor.id)?.pos ? [wizard(after, actor.id)!.pos!] : [], cues: [], weight: .6 });
  return { id, kind: 'activation', title, summary, frames };
}

export function presentChange(before: Match, after: Match, activation?: Activation): Presentation | null {
  if (before.game === after.game) return null; // A speed preference does not replay the last action.
  if (activation) return presentActivation(before.game, after.game, activation, after.revision);
  const undo = after.game.log.length < before.game.log.length || after.undo.length < before.undo.length && before.game.turn === after.game.turn && before.game.stage === 'deployment';
  const restored = undo ? 'Annullamento: ripristinati posizioni, punti vita, copie, effetti e risultato precedenti.' : after.game.log.at(-1) ?? 'Schieramento aggiornato.';
  const expired = before.game.wizards.filter(w => w.restrainedUntil !== undefined && wizard(after.game, w.id)?.restrainedUntil === undefined).map(w => `${mageName(before.game, w.id)}: immobilizzazione terminata.`);
  const placed = after.game.wizards.find(w => w.pos && !wizard(before.game, w.id)?.pos);
  const title = undo ? 'Attivazione annullata' : placed ? `${mageName(after.game, placed.id)} schierato in ${square(placed.pos!)}` : after.game.stage === 'finished' ? 'Duello concluso' : after.game.turn !== before.game.turn ? `Inizia il turno ${sideName(after.game.active)}` : 'Fase passata';
  const released = before.game.wizards.filter(w => w.restrainedUntil !== undefined && wizard(after.game, w.id)?.restrainedUntil === undefined).flatMap(w => wizard(after.game, w.id)?.pos ? [wizard(after.game, w.id)!.pos!] : []);
  const changed = after.game.wizards.filter(w => w.pos && JSON.stringify(w) !== JSON.stringify(wizard(before.game, w.id))).map(w => w.pos!);
  changed.push(...before.game.wizards.filter(w => w.pos && !wizard(after.game, w.id)?.pos).map(w => w.pos!));
  changed.push(...after.game.copies.filter(c => !before.game.copies.some(old => old.ownerId === c.ownerId && same(old.pos, c.pos))).map(c => c.pos));
  changed.push(...before.game.copies.filter(c => !after.game.copies.some(next => next.ownerId === c.ownerId && same(next.pos, c.pos))).map(c => c.pos));
  if (undo && !changed.length) { const lastActor = wizard(after.game, before.game.activated.at(-1) ?? ''); if (lastActor?.pos) changed.push(lastActor.pos); }
  return { id: after.revision, kind: undo ? 'undo' : 'change', title, summary: [restored, ...expired], frames: [{ game: clone(after.game), title, details: [restored, ...expired], visuals: undo ? [{ kind: 'undo', points: changed.length ? changed : placed ? [placed.pos!] : [] }] : released.length ? [{ kind: 'release', points: released }] : [], points: placed ? [placed.pos!] : [], cues: [], weight: placed ? .25 : .6 }] };
}

export function cuesAt(frame: Frame | null, point: Point): Cue[] { return frame?.cues.filter(cue => same(cue.at, point)) ?? []; }

export function presentTurn(turn: TurnReplay): Presentation {
  const frames: Frame[] = [{ game: clone(turn.start), title: 'Inizio del turno avversario', details: [`${sideName(turn.side)} · turno ${turn.turn + 1}`, ...(turn.entries.length ? [] : ['Nessuna attivazione: il turno è stato passato.'])], points: [], cues: [], weight: .5 }, ...turn.entries.flatMap((entry, i) => presentActivation(entry.before, entry.after, entry.activation, i).frames)];
  frames.push({ game: clone(turn.end), title: 'Turno avversario concluso', details: ['Ritorno alla partita attuale.'], points: [], cues: [], weight: .5 });
  return { id: turn.turn, kind: 'change', title: 'Replay del turno avversario', summary: [`${sideName(turn.side)} · turno ${turn.turn + 1}`], frames };
}
