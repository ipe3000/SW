import type { Game } from '../../../src/engine/game';

/** Includes identity and all rule inputs; excludes presentation history only. */
export const decisionPosition = (g: Game) => JSON.stringify([g.id,g.stage,g.pending,g.result,g.options,g.walls,g.turn,g.active,g.phase,g.activity,[...g.activated].sort(),g.wizards,g.copies]);
