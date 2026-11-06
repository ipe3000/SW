import { activate, commitActivation, commitSkip, endTurn, finishTurn, placeWizard, skipPhase, type Activation, type Game, type Match, type Point } from '../engine/game';

/** A player chooses commands; the shared game engine remains the authority. */
export type ComputerCommand =
  | { kind: 'activate'; activation: Activation }
  | { kind: 'place'; wizardId: string; position: Point }
  | { kind: 'skip' }
  | { kind: 'end-turn' };
export type ComputerDecision = { command: ComputerCommand; evaluated: number };
export interface ComputerPlayer {
  readonly id: string;
  choose(game: Game): ComputerDecision;
}
export function applyComputerCommand(game: Game, command: ComputerCommand): Game {
  switch (command.kind) {
    case 'activate': return activate(game, command.activation);
    case 'place': return placeWizard(game, command.wizardId, command.position);
    case 'skip': return skipPhase(game);
    case 'end-turn': return endTurn(game);
    default: throw new Error('Comando del computer non riconosciuto.');
  }
}
export function commitComputerCommand(match: Match, command: ComputerCommand): Match {
  if (!match.computer || match.computer.side !== match.game.active || match.game.stage === 'finished') throw new Error('Non è il turno del computer.');
  switch (command.kind) {
    case 'activate': return commitActivation(match, command.activation);
    case 'skip': return commitSkip(match);
    case 'end-turn': return finishTurn(match);
    case 'place': {
      const next = placeWizard(match.game, command.wizardId, command.position);
      return { ...match, game: next, revision: match.revision + 1, savedAt: new Date().toISOString(), undo: next.stage === 'deployment' && next.deployment.step === match.game.deployment.step ? [...match.undo, match.game] : [] };
    }
    default: throw new Error('Comando del computer non riconosciuto.');
  }
}
