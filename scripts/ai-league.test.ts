import { it, expect } from 'vitest';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { chooseMove } from '../src/ai/search';
import { applyComputerCommand, type ComputerPlan } from '../src/ai/types';
import { decisionPosition } from '../src/ai/position';
import { defaultOptions, newMatch, type ComputerDifficulty } from '../src/engine/game';

it('confronta direttamente i livelli su campi e colori scambiati', () => {
  const configs = [
    {seed:600,hp:3,walls:'standard'}, {seed:304,hp:3,walls:'varied'},
    {seed:405,hp:4,walls:'standard'}, {seed:402,hp:4,walls:'varied'},
    {seed:503,hp:5,walls:'standard'}, {seed:506,hp:5,walls:'varied'}
  ] as const;
  const pairs: [ComputerDifficulty,ComputerDifficulty][] = [['hard','easy'],['hard','normal'],['normal','easy']];
  const shard=Number(process.env.SW_LEAGUE_SHARD??0),shards=Number(process.env.SW_LEAGUE_SHARDS??1);
  const resultPath=`output/ai-league/results${shards>1?'-'+shard:''}.json`;
  const rows: Record<string,unknown>[]=process.env.SW_LEAGUE_RESUME==='1'&&existsSync(resultPath)?JSON.parse(readFileSync(resultPath,'utf8')):[];
  let index=0;
  mkdirSync('output/ai-league',{recursive:true});
  for(const [strong,weak] of pairs) for(const config of configs.slice(0,strong==='hard'&&weak==='easy'?6:2)) for(const side of ['red','blue'] as const) {
    if(index++%shards!==shard) continue;
    if(process.env.SW_LEAGUE_QUICK==='1' && (config.seed!==600 || weak!=='easy' || strong!=='hard')) continue;
    if(rows.some(row=>row.strong===strong&&row.weak===weak&&row.side===side&&row.seed===config.seed)) continue;
    let seed=config.seed;
    const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return config.seed===600?.999:seed/4294967296;};
    let game=newMatch({...defaultOptions,hp:config.hp,walls:config.walls},random).game;
    game.id=`league-${config.seed}`;
    let steps: ComputerPlan=[],commands=0,longest=0,totalMs=0;
    const history: object[]=[];
    for(;commands<150&&game.stage!=='finished';commands++) {
      const level=game.active===side?strong:weak;
      const preferred=steps.find(step=>step.position===decisionPosition(game))?.command;
      const start=performance.now(),decision=chooseMove(game,level,preferred),elapsed=performance.now()-start;
      longest=Math.max(longest,elapsed);totalMs+=elapsed;
      steps=decision.continuation??[];
      const next=applyComputerCommand(game,decision.command);
      expect(next).not.toEqual(game);
      history.push({before:game,command:decision.command});
      game={...next,log:[]};
    }
    const row={strong,weak,side,...config,winner:game.result?.winner,outcome:!game.result?'unfinished':game.result.winner===side?'strong':'weak',commands,longestMs:Math.round(longest),totalMs:Math.round(totalMs)};
    rows.push(row);
    writeFileSync(resultPath,JSON.stringify(rows,null,2));
    if(row.outcome!=='strong') writeFileSync(`output/ai-league/${strong}-${weak}-${config.seed}-${side}.json`,JSON.stringify({row,history,game}));
    console.info(JSON.stringify(row));
  }
});
