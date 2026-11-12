import type { Language } from '../i18n/glossary';
import { defaultOptions, newMatch, targetPoints, wizard, type Activation, type Game, type Kind, type Match } from '../engine/game';
import { distance, type Point } from '../engine/geometry';

export type Lesson = 0 | 1 | 2 | 3;
const field = (x: number, rank: number): Point => ({ x, y: 10 - rank });

export const lessons = [
  { it: { title: 'Prepara un’attivazione', goal: 'Muovi la Lamarcana e ferisci il Geomante blu.' }, en: { title: 'Plan an activation', goal: 'Move the Spellsword and wound the Blue Geomancer.' } },
  { it: { title: 'Gestisci un turno ordinario', goal: 'Prova ad annullare un’attivazione e poi completa il turno.' }, en: { title: 'Manage a regular turn', goal: 'Undo a confirmed activation, then finish the turn.' } },
  { it: { title: 'Combina due poteri', goal: 'Usa il vento per avvicinare i due maghi blu, poi colpiscili insieme con la Palla di fuoco.' }, en: {"title": "Combine two abilities", "goal": "Use Gale to bring the two Blue mages closer, then hit both with Fireball."} },
  { it: { title: 'Chiudi il duello', goal: 'Il Blu ha quattro maghi. Vinci lasciandogliene tre o meno.' }, en: {"title": "Finish the duel", "goal": "Blue has four mages. Win by leaving them with three or fewer."} },
] as const;

export function createLesson(lesson: Lesson): Match {
  const match = newMatch(defaultOptions);
  const g = match.game;
  g.turn = lesson === 0 ? 0 : 2;
  g.walls = lesson === 3 ? [field(4, 5)] : [];
  const red: [Kind, Point][] = lesson === 2
    ? [['aeromancer', field(3, 3)], ['pyromancer', field(5, 3)], ['spellsword', field(2, 2)], ['teleporter', field(7, 2)]]
    : lesson === 3
      ? [['spellsword', field(3, 4)], ['pyromancer', field(5, 3)], ['geomancer', field(1, 2)], ['teleporter', field(8, 2)]]
      : [['spellsword', field(3, 3)], ['pyromancer', field(6, 2)], ['geomancer', field(1, 2)], ['teleporter', field(8, 2)]];
  const blue: [Kind, Point, number?][] = lesson === 2
    ? [['geomancer', field(3, 5)], ['spellsword', field(6, 5)], ['teleporter', field(1, 9)], ['pyromancer', field(8, 9)]]
    : [['geomancer', lesson === 3 ? field(5, 5) : field(3, 6), lesson === 3 ? 1 : 4], ['spellsword', field(5, 8)], ['teleporter', field(1, 9)], ['pyromancer', field(8, 9)]];
  g.wizards = g.wizards.flatMap(w => {
    const piece = (w.side === 'red' ? red : blue).find(([kind]) => kind === w.kind);
    return piece ? [{ ...w, pos: piece[1], hp: piece[2] ?? w.hp }] : [];
  });
  return match;
}

export function lessonComplete(lesson: Lesson, g: Game) {
  return lesson === 3 ? g.result?.winner === 'red' : g.active === 'blue';
}

export function suggestedMage(lesson: Lesson, game: Game) {
  if (lesson === 0) return 'red:spellsword';
  if (lesson === 1 && game.phase === 0) return 'red:spellsword';
  if (lesson === 2 && game.phase === 0) return 'red:aeromancer';
  if (lesson === 2 && game.phase === 1) return 'red:pyromancer';
}

export function comboCenter(game: Game) {
  const caster = wizard(game, 'red:pyromancer');
  if (!caster) return;
  const enemies = game.wizards.filter(mage => mage.side === 'blue' && mage.pos);
  return targetPoints(game, caster).find(center => enemies.filter(mage => distance(center, mage.pos!) <= 1).length >= 2);
}

/** Check the exercise objective after the engine has resolved a legal command. */
export function lessonFeedback(lesson: Lesson, before: Game, after: Game, activation: Activation, practicedUndo: boolean, language: Language = 'it') {
  if (lesson === 0 && (activation.spell?.kind !== 'sword' || activation.spell.targetId !== 'blue:geomancer' || !activation.before.length)) {
    return language === 'en' ? 'Move the Spellsword next to the Geomancer and prepare Arcane Blade before confirming.' : 'Per questa prova, avvicina la Lamarcana al Geomante e prepara Lama arcana prima di confermare.';
  }
  if (lesson === 0 && !practicedUndo) {
    return language === 'en' ? 'Try Undo last step before confirming. Then prepare your move again.' : 'Prova «Annulla ultimo passo» prima di confermare, poi prepara di nuovo il movimento.';
  }
  if (lesson === 1 && before.phase === 1 && !practicedUndo) {
    return language === 'en' ? 'Clear your plan, then choose Undo activation to take back the first move.' : 'Azzera la preparazione, poi premi «Annulla attivazione» per ritirare la prima mossa.';
  }
  if (lesson === 1 && activation.spell) {
    return language === 'en' ? 'Use movement alone in this exercise. Clear your plan and prepare a move.' : 'In questa prova basta muoversi. Azzera la preparazione e prepara un movimento.';
  }
  if (lesson === 2 && before.phase === 0) {
    if (activation.spell?.kind !== 'wind' || !activation.spell.path.length || !comboCenter(after)) {
      return language === 'en' ? 'Use Gale to bring the two Blue mages together. Move the Geomancer from D5 to E5 so the Pyromancer can hit both.' : 'Avvicina i due maghi blu con il vento. Prova a spostare il Geomante da D5 a E5, così il Piromante può colpirli insieme.';
    }
  }
  if (lesson === 2 && before.phase === 1) {
    const damaged = before.wizards.filter(w => w.side === 'blue' && (wizard(after, w.id)?.hp ?? 0) < w.hp);
    if (activation.spell?.kind !== 'fireball' || damaged.length < 2) {
      return language === 'en' ? 'Choose a Fireball center that hits both mages. The blast hits the center and its four orthogonal neighbors.' : 'Cerca un centro della Palla di fuoco che colpisca entrambi i maghi vicini. Ogni casella della croce conta, tranne le diagonali.';
    }
  }
}
