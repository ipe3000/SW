import { defaultOptions, newMatch, type ComputerDifficulty, type Game, type OptionalRules, type Options, type Side } from '../engine/game';
import type { ComputerCommand, SearchDiagnostics } from '../ai/types';
import { defaultHardProfileId, defaultHardProfileName } from '../ai/profile';

export const levels: ComputerDifficulty[] = ['easy', 'normal', 'hard'];
export const labels: Record<ComputerDifficulty, string> = { easy: 'Facile', normal: 'Normale', hard: 'Difficile' };
export type Config = OptionalRules & { mode: 'league' | 'pair' | 'self'; a: ComputerDifficulty; b: ComputerDifficulty; fields: number; seed: number; hp: Options['hp'] | 'mixed'; walls: Options['walls'] | 'mixed'; limit: number; audit: boolean };
export type Case = OptionalRules & { id: string; seed: number; hp: Options['hp']; walls: Options['walls']; red: ComputerDifficulty; blue: ComputerDifficulty; reversed: boolean; fieldKey?: string };
export type Step = { before: Game; command: ComputerCommand; milliseconds: number; evaluated: number; diagnostics?: SearchDiagnostics; auditMilliseconds?: number };
export type Finding = { step: number; kind: 'missed-win'; side: Side; alternative: ComputerCommand };
export type Result = { test: Case; outcome: Side | 'limit' | 'repetition' | 'error'; steps: Step[]; final: Game; findings: Finding[]; audits: { completed: number; interrupted: number }; error?: string; elapsed: number };
export type Campaign = { format: 'strategic-wizardry-ailab'; schema: 1; sampling?: 'distinct-v2'; hardProfile?: 'p2' | typeof defaultHardProfileId; id: string; created: string; build: string; userAgent: string; config: Config; cases: Case[]; results: Result[] };
export const defaults: Config = { mode: 'league', a: 'hard', b: 'easy', fields: 3, seed: 301, hp: 'mixed', walls: 'mixed', limit: 150, audit: true };

export function casesFor(config: Config): Case[] {
  if (!Number.isInteger(config.fields) || config.fields < 1 || config.fields > 100 || !Number.isInteger(config.seed) || config.seed < 0 || config.seed > 0xffffffff || !Number.isInteger(config.limit) || config.limit < 1 || config.limit > 1000) throw new Error('Controlla campi (1–100), seme (0–4294967295) e limite (1–1000).');
  const pairs: [ComputerDifficulty, ComputerDifficulty][] = config.mode === 'self' ? levels.map(level=>[level,level]) : config.mode === 'pair' ? [[config.a, config.b]] : [['hard', 'easy'], ['hard', 'normal'], ['normal', 'easy']];
  if (config.walls === 'standard' && config.hp !== 'mixed' && config.fields > 36) throw new Error('Con PV fissi e muri standard esistono solo 36 campi distinti. Riduci il numero o varia le opzioni.');
  const fields: Case[] = [], seen = new Set<string>();
  const { safeLightning, shorterSpellswordMove } = config;
  let draw = config.seed >>> 0;
  for (let index = 0; index < config.fields; index++) {
    const hp = config.hp === 'mixed' ? ([3,4,5] as const)[index % 3] : config.hp;
    const walls = config.walls === 'mixed' ? index % 2 ? 'varied' : 'standard' : config.walls;
    let accepted = false;
    for (let attempt = 0; attempt < 4096; attempt++) {
      draw = (draw + 0x9e3779b9) >>> 0;
      let seed = draw; seed = Math.imul(seed ^ seed >>> 16, 0x21f0aaad); seed = Math.imul(seed ^ seed >>> 15, 0x735a2d97); seed = (seed ^ seed >>> 15) >>> 0;
      const test: Case = { id: '', seed, hp, walls, red: 'hard', blue: 'easy', reversed: false,
        ...(safeLightning && { safeLightning }), ...(shorterSpellswordMove && { shorterSpellswordMove }) };
      const key = physicalPositionKey(initialGame(test));
      if (seen.has(key)) continue;
      seen.add(key); fields.push({ ...test, fieldKey: key }); accepted = true; break;
    }
    if (!accepted) throw new Error('Non ci sono abbastanza campi distinti per queste opzioni. Riduci il numero richiesto.');
  }
  return pairs.flatMap(([a,b]) => fields.flatMap((field,index) => (a===b?[false]:[false,true]).map(reversed => ({ ...field, id: `${a}-${b}-${index}-${Number(reversed)}`, red: reversed ? b : a, blue: reversed ? a : b, reversed }))));
}
export function sameLevelStatistics(results: Result[]) {
  return levels.map(level=>{
    const rows=results.filter(row=>row.test.red===level && row.test.blue===level);
    const first=rows.filter(row=>row.outcome==='red').length, second=rows.filter(row=>row.outcome==='blue').length;
    return {level,games:rows.length,first,second,incomplete:rows.length-first-second,firstPercent:first+second?Math.round(1000*first/(first+second))/10:null,fields:new Set(rows.map(row=>physicalPositionKey(row.steps[0]?.before??initialGame(row.test)))).size};
  }).filter(row=>row.games);
}
/** Excludes identity, random rolls and presentation; includes physical setup and rule options. */
export function physicalPositionKey(game: Game): string {
  const { hp, walls, placement, safeLightning, shorterSpellswordMove } = game.options;
  return JSON.stringify([hp, walls, placement, [...game.walls].sort((a,b)=>a.y-b.y||a.x-b.x), game.wizards.map(w=>[w.id,w.hp,w.pos]),
    ...(safeLightning || shorterSpellswordMove ? [Boolean(safeLightning), Boolean(shorterSpellswordMove)] : [])]);
}
export function initialGame(test: Case): Game {
  let seed = test.seed;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  const { hp, walls, safeLightning, shorterSpellswordMove } = test;
  const game = newMatch({ ...defaultOptions, hp, walls, safeLightning, shorterSpellswordMove }, random).game;
  // Same identity for both color assignments: tie breaks get the same inputs.
  return { ...game, id: `ailab-${test.seed}-${test.hp}-${test.walls}`, log: [] };
}
export function repetitionKey(game: Game): string {
  // Normalize absolute turn counters, retaining the remaining restraint duration.
  return JSON.stringify([game.stage, game.active, game.phase, game.activity, [...game.activated].sort(), game.wizards.map(w => ({ ...w, restrainedUntil: w.restrainedUntil === undefined ? undefined : Math.max(-1, w.restrainedUntil - game.turn) })), game.copies]);
}
export function statistics(results: Result[]) {
  return levels.map(level => {
    let wins = 0, losses = 0, incomplete = 0, decisions = 0, totalMs = 0, maxMs = 0;
    for (const row of results) {
      for (const side of ['red', 'blue'] as const) if (row.test[side] === level) {
        if (row.outcome !== 'red' && row.outcome !== 'blue') incomplete++;
        else if (row.outcome === side) wins++; else losses++;
      }
      for (const step of row.steps) if (row.test[step.before.active] === level) {
        decisions++; totalMs += step.milliseconds; maxMs = Math.max(maxMs, step.milliseconds);
      }
    }
    return { level, wins, losses, incomplete, decisions, averageMs: Math.round(totalMs / (decisions || 1)), maxMs: Math.round(maxMs) };
  }).filter(row => row.wins + row.losses + row.incomplete > 0);
}
export function groupedStatistics(results: Result[]) {
  const groups = new Map<string, {group: string; games: number; red: number; blue: number; incomplete: number}>();
  for (const row of results) {
    const matchup = [row.test.red,row.test.blue].sort().map(level=>labels[level]).join(' / ');
    for (const key of [`Confronto: ${matchup}`, `Regole: ${row.test.hp} PV / ${row.test.walls}`, `Campo: ${physicalPositionKey(row.steps[0]?.before ?? initialGame(row.test))}`]) {
      const group = groups.get(key) ?? {group:key,games:0,red:0,blue:0,incomplete:0};
      group.games++; if(row.outcome==='red'||row.outcome==='blue') group[row.outcome]++; else group.incomplete++;
      groups.set(key,group);
    }
  }
  return [...groups.values()];
}
export function phaseStatistics(results: Result[]) {
  return levels.flatMap(level => [0,1,2].map(phase => {
    const steps = results.flatMap(row=>row.steps.filter(step=>row.test[step.before.active]===level && step.before.phase===phase));
    const measured = steps.filter(step=>step.diagnostics);
    return {level,phase,decisions:steps.length, measured:measured.length, averageMs:Math.round(steps.reduce((n,s)=>n+s.milliseconds,0)/(steps.length||1)), averageNodes:Math.round(steps.reduce((n,s)=>n+s.evaluated,0)/(steps.length||1)), averageDepth:measured.length ? (measured.reduce((n,s)=>n+s.diagnostics!.completedDepth,0)/measured.length).toFixed(1) : 'n/d', incomplete:measured.filter(s=>s.diagnostics!.incompleteRound).length, timeExhausted:measured.filter(s=>s.diagnostics!.timeExhausted).length, nodeExhausted:measured.filter(s=>s.diagnostics!.nodesExhausted).length, fallbacks:measured.filter(s=>s.diagnostics!.source==='fallback').length, shortenedDecisions:measured.filter(s=>(s.diagnostics!.openingTimeScale??1)<1).length, threatMeasured:measured.filter(s=>s.diagnostics!.threatChecks!==undefined).length, threatChecks:measured.reduce((n,s)=>n+(s.diagnostics!.threatChecks??0),0), threatsFound:measured.reduce((n,s)=>n+(s.diagnostics!.threatsFound??0),0), threatUnknown:measured.reduce((n,s)=>n+(s.diagnostics!.threatUnknown??0),0), safetyOverrides:measured.filter(s=>s.diagnostics!.safetyOverride).length, guardMs:Math.round(measured.reduce((n,s)=>n+(s.diagnostics!.threatMilliseconds??0),0))};
  }).filter(row=>row.decisions));
}
export function markdown(campaign: Campaign): string {
  const motor = campaign.hardProfile === defaultHardProfileId ? `${defaultHardProfileName} a Difficile` : campaign.hardProfile === 'p2' ? 'P2 a Difficile' : 'AI #2';
  const lines = ['# ailab · Strategic Wizardry', '', `Campagna: ${campaign.id}`, `Motore: ${motor} · build ${campaign.build}`, `Creata: ${campaign.created}`, `Browser: ${campaign.userAgent}`, `Completate: ${campaign.results.length}/${campaign.cases.length}`, '', '## Configurazione', '```json', JSON.stringify(campaign.config, null, 2), '```', '', '| Caso | Seme | PV / muri | Rosso | Blu | Esito | Comandi | Media / max ms | Vittorie mancate |', '|---|---|---|---|---|---|---|---|---|'];
  for (const row of campaign.results) {
    const times = row.steps.map(step => step.milliseconds);
    lines.push(`| ${row.test.id} | ${row.test.seed} | ${row.test.hp} / ${row.test.walls} | ${labels[row.test.red]} | ${labels[row.test.blue]} | ${row.outcome} | ${times.length} | ${Math.round(times.reduce((a,b) => a+b, 0) / (times.length || 1))} / ${Math.round(Math.max(0, ...times))} | ${row.findings.length} |`);
  }
  lines.push('', '## Riepilogo per difficoltà', '', '| Difficoltà | Vittorie | Sconfitte | Inconcluse | Decisioni | Media / max ms |', '|---|---|---|---|---|---|');
  for (const row of statistics(campaign.results)) lines.push(`| ${labels[row.level]} | ${row.wins} | ${row.losses} | ${row.incomplete} | ${row.decisions} | ${row.averageMs} / ${row.maxMs} |`);
  const initiative=sameLevelStatistics(campaign.results);
  if(initiative.length){
    lines.push('', '## Iniziativa a parità di livello', '', '| Livello | Partite | Campi distinti | Vince primo (rosso) | Vince secondo (blu) | Inconcluse | Vittorie primo su esiti decisivi |', '|---|---|---|---|---|---|---|');
    for(const row of initiative)lines.push(`| ${labels[row.level]} | ${row.games} | ${row.fields} | ${row.first} | ${row.second} | ${row.incomplete} | ${row.firstPercent===null?'n/d':row.firstPercent+'%'} |`);
    lines.push('', 'Solo partite allo stesso livello; una partita conta una volta. Le inconcluse sono escluse dalla percentuale. I campi sono condivisi fra livelli: non sommare i campioni come prove indipendenti. Primo giocatore e lato rosso coincidono; il campione non separa l’effetto della geometria e non certifica il bilanciamento.');
  }
  const fields = new Map<string,number>();
  for(const test of campaign.cases) { const key=physicalPositionKey(initialGame(test)); if(!fields.has(key)) fields.set(key,fields.size+1); }
  lines.push('', `Campionamento: ${campaign.sampling ?? 'legacy, possibili duplicati'}. Posizioni iniziali fisiche distinte: ${fields.size}. Gli scambi di difficoltà sullo stesso campo non sono nuovi campi.`, '', '## Risultati per confronto, regole e campo', '', '| Gruppo | Partite | Vince primo (rosso) | Vince secondo (blu) | Inconcluse |', '|---|---|---|---|---|');
  for(const row of groupedStatistics(campaign.results)) { const name = row.group.startsWith('Campo: ') ? `Campo C${fields.get(row.group.slice(7)) ?? '?'}` : row.group; lines.push(`| ${name} | ${row.games} | ${row.red} | ${row.blue} | ${row.incomplete} |`); }
  lines.push('', '## Catalogo dei campi', '', '| Campo | Seme | PV | Muri | Coordinate dei muri (0–9) |', '|---|---|---|---|---|');
  for(const [key,id] of fields) { const test=campaign.cases.find(test=>physicalPositionKey(initialGame(test))===key)!; lines.push(`| C${id} | ${test.seed} | ${test.hp} | ${test.walls} | ${initialGame(test).walls.map(p=>`(${p.x},${p.y})`).join(' ')} |`); }
  lines.push('', '## Ricerca per difficoltà e fase', '', '| AI | Fase (0/1 complete, 2 extra) | Decisioni | Media ms | Nodi medi | Profondità media | Telemetria disponibile | Round incompleti | Budget tempo / nodi esaurito | Fallback |', '|---|---|---|---|---|---|---|---|---|---|');
  for(const row of phaseStatistics(campaign.results)) lines.push(`| ${labels[row.level]} | ${row.phase} | ${row.decisions} | ${row.averageMs} | ${row.averageNodes} | ${row.averageDepth} | ${row.measured} | ${row.incomplete} | ${row.timeExhausted} / ${row.nodeExhausted} | ${row.fallbacks} |`);
  lines.push('', 'Profondità e budget descrivono una ricerca selettiva, non una prova di gioco ottimale. La profondità 1 con zero round completati indica la sola selezione iniziale. Telemetria assente significa non disponibile, non zero errori. Il JSON conserva ampiezza, risposte esplorate, cache, famiglie e tempi di audit per ogni decisione.');
  lines.push('', '## Budget adattivo di apertura', '', '| AI / fase | Decisioni | Decisioni con budget ridotto |', '|---|---|---|');
  for(const row of phaseStatistics(campaign.results))lines.push(`| ${labels[row.level]} / ${row.phase} | ${row.decisions} | ${row.shortenedDecisions} |`);
  lines.push('', 'Difficile può usare un budget del 15% inferiore nelle aperture intatte e distanti. Dopo danni, perdite, controllo o contatto ravvicinato torna al budget pieno. Dati assenti nelle campagne precedenti non misurano il comportamento del nuovo budget. Il JSON conserva fattore e budget configurato per decisione.');
  lines.push('', '## Protezione dalle combinazioni di due attivazioni', '', '| AI / fase | Decisioni con telemetria | Scansioni | Minacce trovate | Scansioni sconosciute | Decisioni modificate | Tempo totale guardia ms |', '|---|---|---|---|---|---|---|');
  for(const row of phaseStatistics(campaign.results)) lines.push(`| ${labels[row.level]} / ${row.phase} | ${row.threatMeasured} | ${row.threatChecks} | ${row.threatsFound} | ${row.threatUnknown} | ${row.safetyOverrides} | ${row.guardMs} |`);
  lines.push('', 'Il controllo è limitato a due attivazioni e alle continuazioni proprie campionate. Una scansione sconosciuta non certifica sicurezza. Le minacce contano test di posizioni, non partite distinte; il tempo della guardia è già compreso nel tempo della decisione.');
  lines.push('', 'I confronti allo stesso livello contano una partecipazione per lato: una vittoria e una sconfitta se la partita termina. Il campione non misura un Elo né garantisce una percentuale generale di vittorie.', '', '## Casi da analizzare con Codex');
  for (const row of campaign.results) {
    if (row.outcome === 'error' || row.outcome === 'limit' || row.outcome === 'repetition') lines.push(`- ${row.test.id}: ${row.outcome}${row.error ? ` (${row.error})` : ''}.`);
    for (const finding of row.findings) lines.push(`- ${row.test.id}, comando ${finding.step + 1}, ${finding.side}: vittoria immediata mancata, alternativa convalidata dal motore. Vedi posizione e comando nel JSON.`);
  }
  lines.push('', '## Interpretazione', 'Limiti, ripetizioni ed errori non sono vittorie né pareggi certificati. Il controllo tattico cerca solo vittorie immediate: una scansione interrotta non dimostra che non esistano. I tempi delle decisioni escludono il controllo tattico. Semi e tracce permettono di ricostruire le partite; i budget temporali possono produrre scelte diverse su dispositivi diversi.', '', '## Richiesta per Codex', 'Analizza il JSON allegato. Riproduci i casi problematici con il motore condiviso, separa errori dimostrati e ipotesi strategiche, proponi correzioni e aggiungi regressioni per i problemi confermati. Ripeti gli stessi campi dopo le modifiche.');
  return lines.join('\n');
}
