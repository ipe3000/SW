import { expect, it } from 'vitest';
import { newMatch } from '../src/engine/game';
import { runVersionMatch, type VersionPlayer } from '../scripts/version-match';
import { decisionPosition } from '../src/ai/position';
import { applyComputerCommand, type ComputerCommand } from '../src/ai/types';
import { activationSeeds } from '../src/ai/candidates';

it('separates version plans, validates commands and records limits as unfinished', () => {
  const game = newMatch().game;
  let calls = 0;
  const player: VersionPlayer = { id: 'a', choose: (position, _level, preferred) => {
    calls++; expect(preferred).toBeUndefined();
    expect(decisionPosition(position)).toBe(decisionPosition(game));
    return { evaluated: 0, command: { kind: 'activate', activation: { wizardId: 'red:electromancer', before: [{x:0,y:9}], after: [] } } };
  } };
  const original = structuredClone(game);
  const result = runVersionMatch(game, player, { id: 'b', choose: () => { throw new Error('must not run'); } }, 'normal', 1);
  expect(calls).toBe(1); expect(result.outcome).toBe('unfinished'); expect(result.steps[0].version).toBe('a'); expect(game).toEqual(original);
});

it('passes each continuation only to its own side and replays the resulting trace', () => {
  const game = newMatch().game; game.turn=2;
  const move = {kind:'activate',activation:{wizardId:'red:electromancer',before:[{x:0,y:9}],after:[]}} as const;
  const command: ComputerCommand = structuredClone({ ...move, activation:{...move.activation,before:[...move.activation.before],after:[]} });
  const next=applyComputerCommand(game,command);
  const skip: ComputerCommand={kind:'skip'};
  let redCalls=0, blueCalls=0;
  const red:VersionPlayer={id:'red-version',choose:(position,_level,preferred)=>{
    redCalls++;
    if(redCalls===1) return {command,evaluated:0,continuation:[{position:decisionPosition(next),command:skip}]};
    if(redCalls===2) expect(preferred).toEqual(skip);
    return {command:skip,evaluated:0};
  }};
  const blue:VersionPlayer={id:'blue-version',choose:(position,_level,preferred)=>{
    blueCalls++;expect(preferred).toBeUndefined();
    return {command:{kind:'activate',activation:activationSeeds(position).next().value!.activation},evaluated:0};
  }};
  const result=runVersionMatch(game,red,blue,'normal',4);
  expect(redCalls).toBe(3);expect(blueCalls).toBe(1);
  let replay=game;
  for(const step of result.steps){expect(replay).toEqual(step.before);replay=applyComputerCommand(replay,step.command);}
  expect(replay).toEqual(result.final);
});
