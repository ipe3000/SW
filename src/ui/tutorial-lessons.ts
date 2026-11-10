import { defaultOptions, newMatch, targetPoints, wizard, type Activation, type Game, type Kind, type Match } from '../engine/game';
import { distance, type Point } from '../engine/geometry';

export type Lesson = 0 | 1 | 2;
const field = (x: number, rank: number): Point => ({ x, y: 10 - rank });

export const lessons = [
  { title: 'Avvicinati e colpisci', goal: 'Ferisci il Geomante blu con la Lamarcana.' },
  { title: 'Combina due poteri', goal: 'Usa il vento per avvicinare i due maghi blu, poi colpiscili insieme con la Palla di fuoco.' },
  { title: 'Chiudi il duello', goal: 'Il Blu ha quattro maghi. Vinci lasciandogliene tre o meno.' },
] as const;

export function createLesson(lesson: Lesson): Match {
  const match = newMatch(defaultOptions);
  const g = match.game;
  g.turn = lesson === 0 ? 0 : 2;
  g.walls = lesson === 2 ? [field(5, 5)] : [];
  const red: [Kind, Point][] = lesson === 1
    ? [['aeromancer', field(3, 3)], ['pyromancer', field(5, 3)], ['spellsword', field(2, 2)], ['teleporter', field(7, 2)]]
    : [['spellsword', field(3, 3)], ['pyromancer', field(6, 2)], ['geomancer', field(1, 2)], ['teleporter', field(8, 2)]];
  const blue: [Kind, Point, number?][] = lesson === 1
    ? [['geomancer', field(3, 5)], ['spellsword', field(6, 5)], ['teleporter', field(1, 9)], ['pyromancer', field(8, 9)]]
    : [['geomancer', field(3, 6), lesson === 2 ? 2 : 4], ['spellsword', field(5, 8)], ['teleporter', field(1, 9)], ['pyromancer', field(8, 9)]];
  g.wizards = g.wizards.flatMap(w => {
    const piece = (w.side === 'red' ? red : blue).find(([kind]) => kind === w.kind);
    return piece ? [{ ...w, pos: piece[1], hp: piece[2] ?? w.hp }] : [];
  });
  return match;
}

export function lessonComplete(lesson: Lesson, g: Game) {
  return lesson === 2 ? g.result?.winner === 'red' : g.active === 'blue';
}

export function comboCenter(game: Game) {
  const caster = wizard(game, 'red:pyromancer');
  if (!caster) return;
  const enemies = game.wizards.filter(mage => mage.side === 'blue' && mage.pos);
  return targetPoints(game, caster).find(center => enemies.filter(mage => distance(center, mage.pos!) <= 1).length >= 2);
}

/** Check the exercise objective after the engine has resolved a legal command. */
export function lessonFeedback(lesson: Lesson, before: Game, after: Game, activation: Activation) {
  if (lesson === 0 && (activation.spell?.kind !== 'sword' || activation.spell.targetId !== 'blue:geomancer' || !activation.before.length)) {
    return 'Per questa prova, avvicina la Lamarcana al Geomante e prepara Lama arcana prima di confermare.';
  }
  if (lesson === 1 && before.phase === 0) {
    if (activation.spell?.kind !== 'wind' || !activation.spell.path.length || !comboCenter(after)) {
      return 'Avvicina i due maghi blu con il vento. Prova a spostare il Geomante da D5 a E5, così il Piromante può colpirli insieme.';
    }
  }
  if (lesson === 1 && before.phase === 1) {
    const damaged = before.wizards.filter(w => w.side === 'blue' && (wizard(after, w.id)?.hp ?? 0) < w.hp);
    if (activation.spell?.kind !== 'fireball' || damaged.length < 2) {
      return 'Cerca un centro della Palla di fuoco che colpisca entrambi i maghi vicini. Ogni casella della croce conta, tranne le diagonali.';
    }
  }
}
