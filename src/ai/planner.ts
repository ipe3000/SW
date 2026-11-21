import { activate, endTurn, finishesActivation, hasExtraStep, skipPhase, speed, wizard, type Game } from '../engine/game';
import { activationSeeds, movementPaths, type Candidate } from './candidates';
import { afterSpellCandidates, didactic, evaluator, tieBreak } from './didactic';
import { type ComputerCommand, type ComputerDecision } from './types';
import { immediateWin, twoActivationWin, type TurnThreat } from './tactics';
import { distance } from '../engine/geometry';
import { applyComputerCommand } from './types';
import { decisionPosition } from './position';
import { openingTimeScale } from './opening-pace';
import { diverseMoves, tacticalFamily, needsFullReply } from './coverage';
import type { HardProfile } from './profile';

export const planningBudgets = {
  normal: { milliseconds: 750, nodes: 24_000, depth: 4, width: 7, branch: 2, candidates: 160 },
  hard: { milliseconds: 3200, nodes: 120_000, depth: 7, width: 10, branch: 3, candidates: 160 }
};
type Move = { command: ComputerCommand; game: Game; score: number; forcing: boolean; family: string };
type Bound = { depth: number; extension: number; score: number; kind: 'exact' | 'lower' | 'upper' };
export type PlannedDecision = ComputerDecision & { depth: number; replies: number; cacheHits: number };

/** Keep preparation and defensive moves alongside immediate damage, without filling every slot with variants of one spell. */
function varied(moves: Move[], width: number): Move[] {
  return diverseMoves(moves, width, move => move.family);
}

export function choosePlannedMove(input: Game, difficulty: 'normal' | 'hard', baseline?: () => ComputerDecision, preferred?: ComputerCommand, profile?: HardProfile): ComputerDecision | PlannedDecision {
  if (input.stage !== 'playing' || input.pending || input.phase >= 3) return didactic.choose(input);
  const { chronicle: _chronicle, ...position } = input;
  const base: Game = { ...position, log: [] };
  const configuredBudget = planningBudgets[difficulty], timeScale = openingTimeScale(base, difficulty);
  const budget = { ...configuredBudget, milliseconds: configuredBudget.milliseconds * timeScale };
  const start = performance.now(), finalDeadline = start + budget.milliseconds;
  const fragile = base.wizards.filter(w=>w.side===base.active).length<=5 && base.wizards.some(w=>w.side===base.active && w.hp<=3);
  const deadline = start + budget.milliseconds * (fragile ? .67 : .84);
  const fullReply = difficulty === 'hard' || needsFullReply(base);
  const evaluate = evaluator(base, true, difficulty === 'hard', profile), branches = new Map<string, Move[]>(), scores = new Map<string, Bound>();
  const policy = new Map<string,Move>();
  let evaluated = 0, completedDepth = 1, replies = 0, cacheHits = 0;
  let completedBreadth = 0, completedRounds = 0, completedOwnBreadth = 0, incompleteRound = false, rootCandidates = 0, families = 0;
  let threatChecks=0, threatsFound=0, threatUnknown=0, threatMilliseconds=0, safetyOverride=false;
  const diagnostics = (source: 'search' | 'immediate-win' | 'fallback') => ({ source, completedDepth, completedBreadth, completedOwnBreadth, completedRounds, replies, cacheHits, rootCandidates, families, timeExhausted: performance.now() >= deadline, nodesExhausted: evaluated >= budget.nodes, incompleteRound, threatChecks, threatsFound, threatUnknown, threatMilliseconds, safetyOverride, openingTimeScale: timeScale, budgetMilliseconds: budget.milliseconds });
  const exhausted = () => evaluated >= budget.nodes || performance.now() >= deadline;
  const victory = immediateWin(base, Math.min(deadline, start + budget.milliseconds * .055));
  if (victory.command) return { command: victory.command, evaluated: victory.checked, diagnostics: diagnostics('immediate-win') };
  // Only rule-relevant state: walls/options are fixed during this search, histories never participate.
  const positionKey = (game: Game) => JSON.stringify([game.turn, game.active, game.phase, game.activity,
    [...game.activated].sort(), game.wizards, game.copies]);

  function shortlist(game: Game, root = false): Move[] {
    const key = positionKey(game), cached = branches.get(key);
    if (cached) { cacheHits++; return cached; }
    const direction = game.active === base.active ? 1 : -1;
    const moves: Move[] = [], endpoints = new Set<string>();
    const followUps = new Map<string, (Candidate & { score: number })[]>();
    const limit = root ? budget.candidates * 3 : game.phase === 2 ? 80 : budget.candidates;
    const localStart = performance.now();
    const localDeadline = Math.min(deadline, localStart + budget.milliseconds * (root ? .18 : .0125));
    const seedDeadline = localStart + (localDeadline - localStart) * .75;
    let count = 0;
    const stopped = () => count >= limit || exhausted() || performance.now() >= localDeadline;
    function consider(candidate: Candidate) {
      count++;
      const { activation } = candidate, next = candidate.game;
      // Multiple movement/spell routes often end in exactly the same position.
      const signature = positionKey(next);
      if (endpoints.has(signature)) return;
      endpoints.add(signature);
      evaluated++;
      const score = evaluate(next) + direction * tieBreak(game, activation);
      const forcing = Boolean(next.pending || next.wizards.length < game.wizards.length ||
        next.wizards.some(mage => mage.hp < (wizard(game, mage.id)?.hp ?? mage.hp)));
      moves.push({ command: { kind: 'activate', activation }, game: next, score, forcing,
        family: tacticalFamily(game, activation, next) });
      if (activation.spell && !next.pending && activation.before.length < speed(game, wizard(game, activation.wizardId)!)) {
        const list = followUps.get(activation.wizardId) ?? [];
        list.push({ ...candidate, score });
        list.sort((a, b) => direction * (b.score - a.score));
        const selected = diverseMoves(list, root ? 4 : 2, candidate => tacticalFamily(game, candidate.activation, candidate.game));
        list.splice(0, list.length, ...selected);
        followUps.set(activation.wizardId, list);
      }
    }
    let seeds = game.wizards.filter(w => w.side === game.active && w.pos && !game.activated.includes(w.id))
      .map(w => activationSeeds(game, w.id, true));
    // Reserve a quarter of each generation budget for moving away after casting.
    while (seeds.length && count < limit * .75 && performance.now() < seedDeadline && !stopped()) {
      seeds = seeds.filter(seed => {
        if (stopped()) return false;
        const next = seed.next();
        if (next.done) return false;
        consider(next.value);
        return true;
      });
    }
    for (const candidate of afterSpellCandidates(game, [...followUps.values()].flat())) {
      if (stopped()) break;
      consider(candidate);
    }
    // Passing is strategic too: retaining a useful formation can be better than moving a third mage.
    if (!exhausted()) {
      try {
        const next = skipPhase(game);
        moves.push({ command: { kind: 'skip' }, game: next, score: evaluate(next), forcing: false, family: 'skip' });
      } catch { /* The shared rules require activity before some phases may be passed. */ }
    }
    moves.sort((a, b) => direction * (b.score - a.score));
    const selected = varied(moves, root ? budget.width : budget.branch + 2);
    // Keep caches bounded even in sparse endgames with many equivalent sequences.
    if (branches.size < 2500 && selected.length) branches.set(key, selected);
    return selected;
  }

  const advanced = new WeakMap<Move, Game>();
  function advance(game: Game, move: Move) {
    // Use the same atomic phase/turn transitions as the actual computer, including a skipped extra step.
    const cached = advanced.get(move);
    if (cached) return cached;
    const next = move.game;
    const finished = move.command.kind === 'activate' ? finishesActivation(game, next)
      : next.phase >= 3 || next.phase === 2 && !hasExtraStep(next);
    const result = finished ? endTurn(next) : next;
    advanced.set(move, result);
    return result;
  }

  function search(game: Game, depth: number, extension: number, alpha: number, beta: number, breadth: number, ownBreadth: number, noisy = false): number | undefined {
    if (game.result || game.pending) return evaluate(game);
    if (exhausted()) return undefined;
    // Both levels finish tactical replies; distant Normal openings retain cheap lookahead.
    // At most three extra activations prevent an unbounded extension through successive turns.
    const replyIncomplete = game.turn <= base.turn + 1 && (game.active === base.active ||
      (fullReply || game.phase === 0));
    const tacticalLeaf = depth <= 0 && !replyIncomplete && extension > 0 && noisy && difficulty === 'hard' && breadth > 1;
    if (depth <= 0 && !tacticalLeaf && (!replyIncomplete || extension === 0)) return evaluate(game);
    const key = ownBreadth + ':' + breadth + ':' + Number(tacticalLeaf) + ':' + positionKey(game);
    const known = scores.get(key), originalAlpha = alpha, originalBeta = beta;
    const policyKey = key + ':' + depth + ':' + extension;
    if (known && known.depth === depth && known.extension === extension) {
      if (known.kind === 'exact') return known.score;
      if (known.kind === 'lower') alpha = Math.max(alpha, known.score);
      else beta = Math.min(beta, known.score);
      if (alpha >= beta) return known.score;
    }
    const direction = game.active === base.active ? 1 : -1;
    const candidates = shortlist(game);
    const moves = tacticalLeaf ? candidates.filter(move => move.forcing) : candidates;
    if (tacticalLeaf && !moves.length) return evaluate(game);
    if (!moves.length || exhausted()) return undefined;
    let best = tacticalLeaf ? evaluate(game) : direction > 0 ? -Infinity : Infinity;
    let bestMove: Move | undefined;
    // The extra step cannot cast: a small positional sample leaves more time for real attacks.
    const width = game.active === base.active ? ownBreadth : game.phase === 2 ? 1 : breadth;
    for (const move of varied(moves, width)) {
      if (game.active !== base.active) replies++;
      const next = advance(game, move);
      const value = search(next, depth - 1, depth <= 0 ? extension - 1 : extension, alpha, beta, breadth, ownBreadth, move.forcing);
      if (value === undefined) return undefined;
      if (direction * (value-best) > 0) { best = value; bestMove = move; }
      if (direction > 0) alpha = Math.max(alpha, best); else beta = Math.min(beta, best);
      if (alpha >= beta) break;
    }
    if (scores.size < 6000) scores.set(key, { depth, extension, score: best,
      kind: best <= originalAlpha ? 'upper' : best >= originalBeta ? 'lower' : 'exact' });
    if (bestMove && policy.size < 6000) policy.set(policyKey,bestMove);
    return best;
  }

  const roots = shortlist(base, true);
  // Preserve escape endpoints even when a tactical shortlist favors immediate damage.
  if(fragile) for(const mage of base.wizards.filter(w=>w.side===base.active && w.hp<=2 && w.pos && !base.activated.includes(w.id))) {
    const paths=movementPaths(base,mage.pos!,speed(base,mage),mage.side,mage.id);
    const separation=(p:typeof paths[number])=>Math.min(...base.wizards.filter(w=>w.side!==base.active).map(w=>distance(p.position,w.pos!)));
    paths.sort((a,b)=>separation(b)-separation(a)||a.steps.length-b.steps.length);
    for(const path of paths.slice(0,2)) {
      if(!path.steps.length)continue;
      const command:ComputerCommand={kind:'activate',activation:{wizardId:mage.id,before:path.steps,after:[]}};
      try {const next=activate(base,command.activation);if(!roots.some(m=>JSON.stringify(m.command)===JSON.stringify(command)))roots.push({command,game:next,score:evaluate(next),forcing:false,family:mage.id+':escape'});}catch{/* Shared rules reject invalid escapes. */}
    }
  }
  if (preferred) {
    try {
      const next=preferred.kind==='activate'?activate(base,preferred.activation):preferred.kind==='skip'?skipPhase(base):undefined;
      if(next && !roots.some(move=>JSON.stringify(move.command)===JSON.stringify(preferred))) roots.push({command:preferred,game:next,score:evaluate(next),forcing:false,family:'planned'});
    } catch { /* A previous line is only a hint, validated against the current board and rules. */ }
  }
  // The simpler policy is a legal alternative, never a privileged answer. Keep it in the comparison
  // so a larger search cannot omit it merely because its generator samples different endpoints.
  if (baseline && difficulty === 'hard' && performance.now() < deadline - 170) {
    const decision = baseline();
    try {
      const command = decision.command;
      const next = command.kind === 'activate' ? activate(base, command.activation) : command.kind === 'skip' ? skipPhase(base) : undefined;
      if (next && !roots.some(move => JSON.stringify(move.command) === JSON.stringify(command))) roots.push({command,game:next,score:evaluate(next),forcing:false,family:'baseline'});
    } catch { /* Stale or non-playing proposals cannot enter the search. */ }
  }
  // An unusually slow device may exhaust its clock during candidate generation; always return a legal command.
  rootCandidates = roots.length; families = new Set(roots.map(move => move.family)).size;
  if (!roots.length) return { ...didactic.choose(base), diagnostics: diagnostics('fallback') };
  const winning = roots.find(move => (move.game.pending ?? move.game.result)?.winner === base.active);
  if (winning) return { command: winning.command, evaluated, diagnostics: diagnostics('immediate-win') };
  let best = roots[0];
  let finalScores = roots.map(move => ({move,score:move.score}));
  let continuation: NonNullable<ComputerDecision['continuation']> = [];
  const ownLine = (move: Move, depth: number, extension: number, breadth: number, ownBreadth: number) => {
    const line: NonNullable<ComputerDecision['continuation']> = [];
    let next=advance(base,move);
    while(next.active===base.active && next.turn===base.turn && !next.result && line.length<2) {
      const key=ownBreadth+':'+breadth+':0:'+positionKey(next)+':'+depth+':'+extension;
      const step=policy.get(key);
      if(!step) break;
      line.push({position:decisionPosition(next),command:step.command});
      next=advance(next,step); extension=depth<=0?extension-1:extension;depth--;
    }
    return line;
  };
  // Complete a fair comparison of all roots before accepting a deeper result.
  // Spend the first full-turn comparison on alternative enemy replies. Widen our
  // own continuations afterwards, rather than leaving only a shallow fallback.
  const rounds = difficulty === 'hard'
    ? [{ depth: base.phase===2?4:5, breadth: 2, ownBreadth: 1, extension: 1 },
      { depth: base.phase===2?4:5, breadth: 2, ownBreadth: 2, extension: 1 },
      { depth: base.phase===2?4:5, breadth: 3, ownBreadth: 2, extension: 1 }, { depth: budget.depth, breadth: 2, ownBreadth: 2, extension: 2 }]
    : [{ depth: 2, breadth: 2, ownBreadth: 2, extension: 0 },
      { depth: 3, breadth: 2, ownBreadth: 1, extension: fullReply ? 3 : 1 },
      { depth: budget.depth, breadth: 2, ownBreadth: 2, extension: 2 }];
  for (const { depth, breadth, ownBreadth, extension } of rounds) {
    if (exhausted()) break;
    const ranked: { move: Move; score: number }[] = [];
    for (const move of roots) {
      const score = search(advance(base, move), depth - 1, extension, -Infinity, Infinity, breadth, ownBreadth);
      if (score === undefined) break;
      ranked.push({ move, score });
    }
    if (ranked.length !== roots.length) { incompleteRound = true; break; }
    ranked.sort((a, b) => b.score - a.score || b.move.score - a.move.score);
    finalScores = ranked;
    best = ranked[0].move;
    continuation=ownLine(best,depth-1,extension,breadth,ownBreadth);
    completedDepth = depth;
    completedBreadth = breadth; completedOwnBreadth = ownBreadth; completedRounds++;
    // Ordering changes, eligibility does not: a quiet preparation may improve only at a later depth.
    roots.splice(0, roots.length, ...ranked.map(entry => entry.move));
    if (ranked[0].score >= 999999) break;
  }
  // At a turn boundary, verify the opponent's immediate victories outside the selective search.
  // An interrupted scan is unknown, never proof of safety. Keep enough clock for this final check.
  if (base.phase >= 1 || base.turn === 0) {
    const bestNext = advance(base,best);
    const danger = bestNext.active !== base.active && !bestNext.result ? immediateWin(bestNext, Math.min(finalDeadline, performance.now() + budget.milliseconds * .06)) : undefined;
    let safe: Move | undefined;
    for (const entry of danger?.command ? finalScores : []) {
      if (performance.now() >= finalDeadline) break;
      const next = advance(base,entry.move);
      if (next.active === base.active || next.result) continue;
      const result = immediateWin(next, Math.min(finalDeadline, performance.now() + budget.milliseconds * .06));
      evaluated += result.checked;
      if (!result.command && result.complete) { safe = entry.move; break; }
    }
    if (safe && safe !== best) { best = safe; continuation=[]; }
  }
  if(fragile && performance.now()<finalDeadline) {
    const guardStart=performance.now();
    const knownLines: ComputerCommand[][]=[];
    const scan=(game:Game, slice:number):TurnThreat=>{
      for(const line of knownLines) {
        try {let next=game;for(const command of line)next=applyComputerCommand(next,command);
          if(next.result?.winner===game.active)return {line,complete:true,checked:0};
        }catch{/* A changed position invalidates the old witness. */}
      }
      threatChecks++;
      const result=twoActivationWin(game,Math.min(finalDeadline,performance.now()+slice),1000);
      evaluated+=result.checked;
      if(result.line){knownLines.push(result.line);threatsFound++;}else if(!result.complete)threatUnknown++;
      return result;
    };
    // Finish the proposed own turn with legal hints or a small, diverse positional sample.
    const finish=(root:Move,hints:NonNullable<ComputerDecision['continuation']>)=>{
      let next=advance(base,root);const line:NonNullable<ComputerDecision['continuation']>=[];
      while(!next.result && next.active===base.active && next.turn===base.turn && line.length<2 && performance.now()<finalDeadline) {
        const hint=hints.find(step=>step.position===decisionPosition(next));
        let command:ComputerCommand|undefined=hint?.command;
        if(command)try{applyComputerCommand(next,command);}catch{command=undefined;}
        if(!command) {
          const proposals: {command:ComputerCommand;game:Game}[]=[];
          try{proposals.push({command:{kind:'skip'},game:applyComputerCommand(next,{kind:'skip'})});}catch{/* Activity may be required. */}
          const generators=next.wizards.filter(w=>w.side===next.active&&!next.activated.includes(w.id)).map(w=>activationSeeds(next,w.id,true));
          for(let round=0;round<(next.phase===2?12:8);round++)for(const generator of generators) {
            if(performance.now()>=finalDeadline)break;
            const candidate=generator.next();if(!candidate.done){const cmd:ComputerCommand={kind:'activate',activation:candidate.value.activation};proposals.push({command:cmd,game:applyComputerCommand(next,cmd)});}
          }
          proposals.sort((a,b)=>evaluate(b.game)-evaluate(a.game)); command=proposals[0]?.command;
        }
        if(!command)break;
        line.push({position:decisionPosition(next),command});next=applyComputerCommand(next,command);
      }
      return {game:next,line};
    };
    const variants=(root:Move,hints:NonNullable<ComputerDecision['continuation']>)=>{
      const chosen=finish(root,hints),result=[chosen];
      let prefix=advance(base,root);const line:NonNullable<ComputerDecision['continuation']>=[];
      for(const step of chosen.line) {
        if(prefix.phase===2)break;
        line.push(step);prefix=applyComputerCommand(prefix,step.command);
      }
      if(prefix.active===base.active && prefix.phase===2 && !prefix.result) {
        for(const candidate of activationSeeds(prefix)) {
          const command:ComputerCommand={kind:'activate',activation:candidate.activation};
          result.push({game:applyComputerCommand(prefix,command),line:[...line,{position:decisionPosition(prefix),command}]});
        }
        result.push({game:applyComputerCommand(prefix,{kind:'skip'}),line:[...line,{position:decisionPosition(prefix),command:{kind:'skip'}}]});
      }
      return result;
    };
    const initial=finish(best,continuation);
    if(initial.game.active!==base.active && !initial.game.result) {
      const danger=scan(initial.game,budget.milliseconds*.14);
      if(danger.line) {
        // Unknown is never called safe, but a legal unrefuted line can replace a proven loss.
        let fallback:{move:Move;line:NonNullable<ComputerDecision['continuation']>}|undefined;
        let chosenSafe=false;
        const protectsFragile=(move:Move)=>move.command.kind==='activate' && !move.command.activation.spell && (wizard(base,move.command.activation.wizardId)?.hp??4)<=2;
        const defensiveOrder=[...finalScores].sort((a,b)=>Number(protectsFragile(b.move))-Number(protectsFragile(a.move)));
        for(const entry of defensiveOrder) {
          if(performance.now()>=finalDeadline)break;
          for(const candidate of variants(entry.move,entry.move===best?continuation:[]).slice(0,base.phase===0?2:12)) {
          if(performance.now()>=finalDeadline)break;
          if(candidate.game.result?.winner===base.active){best=entry.move;continuation=candidate.line;safetyOverride=true;fallback=undefined;chosenSafe=true;break;}
          if(candidate.game.result || candidate.game.active===base.active)continue;
          const threat=scan(candidate.game,budget.milliseconds*.045);
          if(threat.line)continue;
          fallback??={move:entry.move,line:candidate.line};
          if(threat.complete){fallback={move:entry.move,line:candidate.line};chosenSafe=true;break;}
          }
          if(chosenSafe)break;
        }
        if(fallback){best=fallback.move;continuation=fallback.line;safetyOverride=true;}
      }
    }
    threatMilliseconds=performance.now()-guardStart;
  }
  return { command: best.command, evaluated, continuation, depth: completedDepth, replies, cacheHits, diagnostics: diagnostics('search') };
}
