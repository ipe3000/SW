import { expect, it } from 'vitest';
import { activationSeeds } from '../src/ai/candidates';
import { defenceAgainstPreparedLightning, scanPreparedLightning } from '../src/ai/prepared-lightning';
import { applyComputerCommand, type ComputerCommand } from '../src/ai/types';
import type { Game } from '../src/engine/game';
import fixtures from './fixtures/prepared-lightning.json';

for (const { position, command, expected } of fixtures as { position: Game; command: ComputerCommand; expected: number }[]) {
  it(`finds and reduces the prepared ${expected}-mage lightning chain in both levels`, () => {
    const exposed = applyComputerCommand(position, command);
    const deadline = () => performance.now() + 3000;
    expect(scanPreparedLightning(exposed, deadline(), 72, 6).threat?.loss).toBeGreaterThanOrEqual(expected);
    const expired = scanPreparedLightning(exposed, performance.now() - 1, 72);
    expect(expired).toMatchObject({ complete: false, checked: 0 });
    const alternatives = [...activationSeeds(position)].map(({ activation }) => {
      const command: ComputerCommand = { kind: 'activate', activation };
      return { command, game: applyComputerCommand(position, command) };
    });
    for (const level of ['normal', 'hard'] as const) {
      const defence = defenceAgainstPreparedLightning(exposed, alternatives, deadline(), level);
      expect(defence).toBeDefined();
      const safer = applyComputerCommand(position, defence!);
      expect(scanPreparedLightning(safer, deadline(), 500).threat?.loss ?? 0).toBeLessThan(expected);
    }
  });
}
