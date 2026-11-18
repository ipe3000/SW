import { defaultOptions, newMatch, type ComputerDifficulty, type Game, type Options, type Side } from '../engine/game';
import type { ComputerCommand } from '../ai/types';

export const levels: ComputerDifficulty[] = ['easy', 'normal', 'hard'];
export const labels: Record<ComputerDifficulty, string> = { easy: 'Facile', normal: 'Normale', hard: 'Difficile' };
export type Config = { mode: 'league' | 'pair'; a: ComputerDifficulty; b: ComputerDifficulty; fields: number; seed: number; hp: Options['hp'] | 'mixed'; walls: Options['walls'] | 'mixed'; limit: number; audit: boolean };
export type Case = { id: string; seed: number; hp: Options['hp']; walls: Options['walls']; red: ComputerDifficulty; blue: ComputerDifficulty; reversed: boolean };
export type Step = { before: Game; command: ComputerCommand; milliseconds: number; evaluated: number };
export type Finding = { step: number; kind: 'missed-win'; side: Side; alternative: ComputerCommand };
export type Result = { test: Case; outcome: Side | 'limit' | 'repetition' | 'error'; steps: Step[]; final: Game; findings: Finding[]; audits: { completed: number; interrupted: number }; error?: string; elapsed: number };
export type Campaign = { format: 'strategic-wizardry-ailab'; schema: 1; id: string; created: string; build: string; userAgent: string; config: Config; cases: Case[]; results: Result[] };
export const defaults: Config = { mode: 'league', a: 'hard', b: 'easy', fields: 3, seed: 301, hp: 'mixed', walls: 'mixed', limit: 150, audit: true };

export function casesFor(config: Config): Case[] {
  if (!Number.isInteger(config.fields) || config.fields < 1 || config.fields > 100 || !Number.isInteger(config.seed) || config.seed < 0 || config.seed > 0xffffffff || !Number.isInteger(config.limit) || config.limit < 1 || config.limit > 1000) throw new Error('Controlla campi (1–100), seme (0–4294967295) e limite (1–1000).');
  const pairs: [ComputerDifficulty, ComputerDifficulty][] = config.mode === 'pair' ? [[config.a, config.b]] : [['hard', 'easy'], ['hard', 'normal'], ['normal', 'easy']];
  return pairs.flatMap(([a, b]) => Array.from({ length: config.fields }, (_, index) => [false, true].map(reversed => ({
    id: `${a}-${b}-${index}-${Number(reversed)}`, seed: (config.seed + index) >>> 0,
    hp: config.hp === 'mixed' ? ([3, 4, 5] as const)[index % 3] : config.hp,
    walls: config.walls === 'mixed' ? index % 2 ? 'varied' as const : 'standard' as const : config.walls,
    red: reversed ? b : a, blue: reversed ? a : b, reversed,
  })))).flat();
}
export function initialGame(test: Case): Game {
  let seed = test.seed;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  const game = newMatch({ ...defaultOptions, hp: test.hp, walls: test.walls }, random).game;
  // Same identity for both color assignments: tie breaks get the same inputs.
  return { ...game, id: `ailab-${test.seed}-${test.hp}-${test.walls}`, log: [], chronicle: undefined };
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
export function markdown(campaign: Campaign): string {
  const lines = ['# ailab · Strategic Wizardry', '', `Campagna: ${campaign.id}`, `Motore: ${campaign.build}`, `Creata: ${campaign.created}`, `Browser: ${campaign.userAgent}`, `Completate: ${campaign.results.length}/${campaign.cases.length}`, '', '## Configurazione', '```json', JSON.stringify(campaign.config, null, 2), '```', '', '| Caso | Seme | PV / muri | Rosso | Blu | Esito | Comandi | Media / max ms | Vittorie mancate |', '|---|---|---|---|---|---|---|---|---|'];
  for (const row of campaign.results) {
    const times = row.steps.map(step => step.milliseconds);
    lines.push(`| ${row.test.id} | ${row.test.seed} | ${row.test.hp} / ${row.test.walls} | ${labels[row.test.red]} | ${labels[row.test.blue]} | ${row.outcome} | ${times.length} | ${Math.round(times.reduce((a,b) => a+b, 0) / (times.length || 1))} / ${Math.round(Math.max(0, ...times))} | ${row.findings.length} |`);
  }
  lines.push('', '## Riepilogo per difficoltà', '', '| Difficoltà | Vittorie | Sconfitte | Inconcluse | Decisioni | Media / max ms |', '|---|---|---|---|---|---|');
  for (const row of statistics(campaign.results)) lines.push(`| ${labels[row.level]} | ${row.wins} | ${row.losses} | ${row.incomplete} | ${row.decisions} | ${row.averageMs} / ${row.maxMs} |`);
  lines.push('', 'I confronti allo stesso livello contano una partecipazione per lato: una vittoria e una sconfitta se la partita termina. Il campione non misura un Elo né garantisce una percentuale generale di vittorie.', '', '## Casi da analizzare con Codex');
  for (const row of campaign.results) {
    if (row.outcome === 'error' || row.outcome === 'limit' || row.outcome === 'repetition') lines.push(`- ${row.test.id}: ${row.outcome}${row.error ? ` (${row.error})` : ''}.`);
    for (const finding of row.findings) lines.push(`- ${row.test.id}, comando ${finding.step + 1}, ${finding.side}: vittoria immediata mancata, alternativa convalidata dal motore. Vedi posizione e comando nel JSON.`);
  }
  lines.push('', '## Interpretazione', 'Limiti, ripetizioni ed errori non sono vittorie né pareggi certificati. Il controllo tattico cerca solo vittorie immediate: una scansione interrotta non dimostra che non esistano. I tempi delle decisioni escludono il controllo tattico. Semi e tracce permettono di ricostruire le partite; i budget temporali possono produrre scelte diverse su dispositivi diversi.', '', '## Richiesta per Codex', 'Analizza il JSON allegato. Riproduci i casi problematici con il motore condiviso, separa errori dimostrati e ipotesi strategiche, proponi correzioni e aggiungi regressioni per i problemi confermati. Ripeti gli stessi campi dopo le modifiche.');
  return lines.join('\n');
}
