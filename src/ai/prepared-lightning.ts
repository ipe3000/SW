import { charmed, hasSight, lightningTargets, previewActivation, speed, teleportDestinations, wizard, type Activation, type Game } from '../engine/game';
import { distance } from '../engine/geometry';
import { movementPaths } from './candidates';
import { lightningImpact } from './lightning';
import { applyComputerCommand, type ComputerCommand } from './types';

type Threat = { setup: Activation; loss: number };

export function canPrepareLightning(game: Game) {
  if (game.stage !== 'playing' || game.pending || game.turn === 0 || game.phase !== 0) return false;
  const teleporter = wizard(game, game.active + ':teleporter'), caster = wizard(game, game.active + ':electromancer');
  return Boolean(teleporter?.pos && caster?.pos && !charmed(game, teleporter) &&
    distance(teleporter.pos, caster.pos) <= speed(game, teleporter) + 2 &&
    game.wizards.filter(mage => mage.side !== game.active && mage.pos).length >= 3);
}

function lossAfterSetup(game: Game, setup: Activation, deadline: number, stopAt: number): number | undefined {
  let ready: Game;
  try { ready = applyComputerCommand(game, { kind: 'activate', activation: setup }); }
  catch { return 0; }
  const caster = wizard(ready, game.active + ':electromancer');
  if (ready.active !== game.active || !caster?.pos || ready.phase !== 1 || charmed(ready, caster)) return 0;
  let loss = 0;
  for (const path of movementPaths(ready, caster.pos, speed(ready, caster), caster.side, caster.id)) {
    if (performance.now() >= deadline) return;
    // The engine excludes the caster by id. Supply its new position for the start of the chain.
    const targets = lightningTargets(ready, { ...caster, pos: path.position });
    if (targets.filter(mage => mage.side !== caster.side).length < 3) continue;
    const after = applyComputerCommand(ready, { kind: 'activate',
      activation: { wizardId: caster.id, before: path.steps, spell: { kind: 'lightning' }, after: [] } });
    if ((after.result ?? after.pending)?.winner === game.active) return Infinity;
    if ((after.result ?? after.pending)?.winner) continue;
    const impact = lightningImpact(ready, after);
    loss = Math.max(loss, impact.enemyDamage - impact.allyDamage + 4 * (impact.enemyKills - impact.allyKills));
    if (loss >= stopAt) return loss;
  }
  return loss;
}

export function scanPreparedLightning(game: Game, deadline: number, maxSetups: number, stopAt = Infinity) {
  let threat: Threat | undefined, checked = 0;
  if (!canPrepareLightning(game)) return { threat, checked, complete: true };
  const teleporter = wizard(game, game.active + ':teleporter')!, caster = wizard(game, game.active + ':electromancer')!;
  const enemies = game.wizards.filter(mage => mage.side !== game.active && mage.pos);
  function separation(point: NonNullable<typeof caster.pos>) {
    return Math.min(...enemies.map(mage => distance(point, mage.pos!)));
  }
  const setups: { activation: Activation; distance: number }[] = [];
  for (const path of movementPaths(game, teleporter.pos!, speed(game, teleporter), game.active, teleporter.id)) {
    if (performance.now() >= deadline) return { threat, checked, complete: false };
    if (distance(path.position, caster.pos!) > 2) continue;
    const moved = previewActivation(game, { wizardId: teleporter.id, before: path.steps, after: [] }).game;
    if (!hasSight(moved, path.position, caster.pos!, game.active)) continue;
    const movedTeleporter = wizard(moved, teleporter.id)!;
    for (const destination of teleportDestinations(moved, movedTeleporter)) {
      const gap = separation(destination);
      setups.push({ activation: { wizardId: teleporter.id, before: path.steps, after: [],
        spell: { kind: 'teleport', targetId: caster.id, destination } }, distance: gap });
    }
  }
  setups.sort((a, b) => a.distance - b.distance || a.activation.before.length - b.activation.before.length);
  for (const { activation } of setups) {
    if (checked >= maxSetups || performance.now() >= deadline) return { threat, checked, complete: false };
    const loss = lossAfterSetup(game, activation, deadline, stopAt);
    if (loss === undefined) return { threat, checked, complete: false };
    checked++;
    if (loss > (threat?.loss ?? 0)) threat = { setup: activation, loss };
    if (loss >= stopAt) return { threat, checked, complete: false };
  }
  // A follow-up move by the Teleporter is outside this targeted scan.
  return { threat, checked, complete: true };
}

export function defenceAgainstPreparedLightning(
  resultingGame: Game, alternatives: readonly { command: ComputerCommand; game: Game }[],
  deadline: number, level: 'normal' | 'hard',
) {
  const { threat } = scanPreparedLightning(resultingGame, deadline, level === 'hard' ? 72 : 28, 6);
  if (!threat || threat.loss < 6) return;
  for (const option of alternatives) {
    if (performance.now() >= deadline) return;
    const againstWitness = lossAfterSetup(option.game, threat.setup, deadline, threat.loss);
    if (againstWitness === undefined || againstWitness >= threat.loss || againstWitness > threat.loss - 3) continue;
    const check = scanPreparedLightning(option.game, deadline, level === 'hard' ? 48 : 18, threat.loss - 2);
    // Prefer measured improvements over the same line, and reject any similarly bad reply actually found.
    // A truncated scan is deliberately not treated as a proof of safety.
    if (performance.now() < deadline && (check.threat?.loss ?? 0) < threat.loss - 2) return option.command;
  }
}
