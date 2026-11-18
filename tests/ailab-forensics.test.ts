import { expect, it } from 'vitest';
import fixtures from './fixtures/ailab-four-defeats.json';
import { applyComputerCommand, type ComputerCommand } from '../src/ai/types';
import { activationSeeds } from '../src/ai/candidates';
import { immediateWin } from '../src/ai/tactics';
import type { Game } from '../src/engine/game';

function blocksRecordedLine(game: Game, commands: ComputerCommand[], winner: string) {
  try { for(const command of commands) game=applyComputerCommand(game,command); }
  catch { return true; }
  return game.result?.winner!==winner;
}
for(const fixture of fixtures) it(`preserves the verified tactical evidence for ${fixture.id}`,()=>{
  const game=fixture.position as Game, response=fixture.enemyFinish as ComputerCommand[];
  const actual=applyComputerCommand(game,fixture.original as ComputerCommand);
  let terminal=actual; for(const command of response) terminal=applyComputerCommand(terminal,command);
  expect(terminal.stage).toBe('finished'); expect(terminal.result!.winner).not.toBe(game.active);
  if(fixture.forcedImmediate) {
    const commands: ComputerCommand[]=[...activationSeeds(game)].map(c=>({kind:'activate',activation:c.activation}));commands.push({kind:'skip'});
    for(const command of commands) {
      const next=applyComputerCommand(game,command), threat=immediateWin(next,performance.now()+1000);
      expect(threat.complete).toBe(true);expect(threat.command).toBeDefined();
      expect(applyComputerCommand(next,threat.command!).result?.winner).not.toBe(game.active);
    }
  }
  if(fixture.extraAlternative) {
    const alternative=applyComputerCommand(game,fixture.extraAlternative as ComputerCommand);
    expect(blocksRecordedLine(alternative,response,terminal.result!.winner)).toBe(true);
  }
  if(fixture.earlierAlternative) {
    let alternative=fixture.earlierPosition as Game;
    for(const command of fixture.earlierAlternative as ComputerCommand[]) alternative=applyComputerCommand(alternative,command);
    expect(alternative.result).toBeNull(); expect(alternative.active).not.toBe(game.active);
    const scan=immediateWin(alternative,performance.now()+1000);
    expect(scan.complete).toBe(true);expect(scan.command).toBeUndefined();
    expect(blocksRecordedLine(alternative,response,terminal.result!.winner)).toBe(true);
  }
});
