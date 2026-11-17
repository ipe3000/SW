import { afterEach, expect, it, vi } from 'vitest';
import { syntheticSafetyPosition } from './ai-positions';
import { think } from '../src/ai/client';
import { decisionPosition } from '../src/ai/position';
import { applyComputerCommand, type ComputerDecision } from '../src/ai/types';
import type { Game } from '../src/engine/game';

afterEach(()=>vi.unstubAllGlobals());

it('il worker riceve un piano solo per la posizione e la difficoltà corrispondenti', async () => {
  const messages: {preferred?: unknown}[]=[];
  const replies: ComputerDecision[]=[];
  class FakeWorker {
    onmessage?: (event:{data:{decision:ComputerDecision}})=>void;
    onerror?: ()=>void;
    terminate() {}
    postMessage(payload:{preferred?:unknown}) {
      messages.push(payload);
      queueMicrotask(()=>this.onmessage?.({data:{decision:replies.shift()!}}));
    }
  }
  vi.stubGlobal('Worker',FakeWorker);
  const game=syntheticSafetyPosition();game.phase=0;game.activated=[];game.activity=false;
  const command={kind:'activate' as const,activation:{wizardId:'red:enchanter',before:[{x:9,y:8}],after:[]}};
  const next=applyComputerCommand(game,command), continuation=[{position:decisionPosition(next),command:{kind:'skip' as const}}];
  const seed=async()=>{replies.push({command,evaluated:1,continuation});await think(game,new AbortController().signal,'hard');};
  const check=async(position:Game,difficulty:'normal'|'hard')=>{replies.push({command:{kind:'skip'},evaluated:1});await think(position,new AbortController().signal,difficulty);return messages.at(-1)?.preferred;};
  await seed();expect(await check(next,'hard')).toEqual({kind:'skip'});
  await seed();expect(await check(next,'normal')).toBeUndefined();
  await seed();expect(await check({...next,id:'another-match'},'hard')).toBeUndefined();
  const changed=structuredClone(next);changed.wizards[0].hp--;
  await seed();expect(await check(changed,'hard')).toBeUndefined();
});
