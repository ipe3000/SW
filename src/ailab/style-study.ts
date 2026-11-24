import { KINDS, type Kind } from '../engine/game';
import { mageGlossary } from '../i18n/glossary';
import { casesFor, defaults, initialGame, physicalPositionKey, type Campaign, type Case, type Config, type Result } from './model';

export const styleVariants = [
  { id: 'standard', name: 'Standard', safeLightning: false, shorterSpellswordMove: false, fasterEnchanter: false },
  { id: 'lightning', name: 'Elettromante', safeLightning: true, shorterSpellswordMove: false, fasterEnchanter: false },
  { id: 'spellsword', name: 'Lamarcana', safeLightning: false, shorterSpellswordMove: true, fasterEnchanter: false },
  { id: 'enchanter', name: 'Incantatore', safeLightning: false, shorterSpellswordMove: false, fasterEnchanter: true },
  { id: 'both', name: 'Elettromante + Lamarcana', safeLightning: true, shorterSpellswordMove: true, fasterEnchanter: false },
  { id: 'lightning-enchanter', name: 'Elettromante + Incantatore', safeLightning: true, shorterSpellswordMove: false, fasterEnchanter: true },
  { id: 'spellsword-enchanter', name: 'Lamarcana + Incantatore', safeLightning: false, shorterSpellswordMove: true, fasterEnchanter: true },
  { id: 'all', name: 'Elettromante + Lamarcana + Incantatore', safeLightning: true, shorterSpellswordMove: true, fasterEnchanter: true },
] as const;
export type StyleVariantId = (typeof styleVariants)[number]['id'];
export const originalStyleVariants: StyleVariantId[] = ['standard', 'lightning', 'spellsword', 'both'];

export const styleDefaults: Config = { ...defaults, mode: 'pair', a: 'hard', b: 'hard', hp: 4, walls: 'standard', audit: false };

export function styleCases(config: Config): Case[] {
  const variants = styleVariants.filter(variant => (config.styleVariants ?? originalStyleVariants).includes(variant.id));
  if (!variants.length) throw new Error('Seleziona almeno una modalità da testare.');
  const fields = casesFor({ ...config, mode: 'pair', a: 'hard', b: 'hard', safeLightning: false, shorterSpellswordMove: false, fasterEnchanter: false });
  return fields.flatMap((field, index) => variants.map((_, offset) => {
    // Rotate processing order to distribute startup and device load across the selected series.
    const { id, name: _name, ...rules } = variants[(index + offset) % variants.length];
    const test = { ...field, ...rules, id: `style-${index + 1}-${id}` };
    return { ...test, fieldKey: physicalPositionKey(initialGame(test)) };
  }));
}

export function styleVariantFor(test: Case) {
  return styleVariants.find(variant => variant.safeLightning === Boolean(test.safeLightning) &&
    variant.shorterSpellswordMove === Boolean(test.shorterSpellswordMove) &&
    variant.fasterEnchanter === Boolean(test.fasterEnchanter))!;
}

export function styleSummary(results: Result[], cases: Case[]) {
  const scheduled = new Set(cases.map(test => styleVariantFor(test).id));
  const variants = styleVariants.filter(variant => scheduled.has(variant.id));
  const bySeed = new Map<number, Map<string, Result>>();
  for (const row of results) {
    if (row.outcome === 'error') continue;
    const group = bySeed.get(row.test.seed) ?? new Map<string, Result>();
    group.set(styleVariantFor(row.test).id, row);
    bySeed.set(row.test.seed, group);
  }
  // A partially played field would give some rules a different set of positions.
  const paired = [...bySeed.values()].filter(group => variants.every(variant => group.has(variant.id)));
  return variants.map(variant => {
    const rows = paired.map(group => group.get(variant.id)!);
    const mages = Object.fromEntries(KINDS.map(kind => [kind, { main: 0, spells: 0, steps: 0 }])) as Record<Kind, { main: number; spells: number; steps: number }>;
    let main = 0, spells = 0, passes = 0, eliminated = 0, red = 0, blue = 0;
    for (const row of rows) {
      red += Number(row.outcome === 'red');
      blue += Number(row.outcome === 'blue');
      eliminated += 16 - row.final.wizards.length;
      for (const { before, command } of row.steps) {
        if (before.stage !== 'playing' || before.phase > 1) continue;
        if (command.kind === 'skip') { passes++; continue; }
        if (command.kind !== 'activate') continue;
        const mage = before.wizards.find(mage => mage.id === command.activation.wizardId);
        if (!mage) continue;
        const used = Number(Boolean(command.activation.spell));
        mages[mage.kind].main++;
        mages[mage.kind].spells += used;
        mages[mage.kind].steps += command.activation.before.length + command.activation.after.length;
        main++;
        spells += used;
      }
    }
    return { id: variant.id, name: variant.name, games: rows.length, mages, main, spells, passes, eliminated, red, blue,
      limits: rows.filter(row => row.outcome === 'limit').length, repetitions: rows.filter(row => row.outcome === 'repetition').length };
  });
}

const percent = new Intl.NumberFormat('it-IT', { style: 'percent', maximumFractionDigits: 1 });
export function stylePercent(count: number, total: number) {
  return total ? percent.format(count / total) : '—';
}

export function styleMarkdown(campaign: Campaign) {
  const series = styleSummary(campaign.results, campaign.cases);
  return [
    '# AI Lab · Stile di gioco', '',
    `Difficile contro Difficile · ${campaign.hardProfile} · build ${campaign.build}`,
    `${campaign.results.length}/${campaign.cases.length} partite registrate · ${series[0]?.games ?? 0} campi con tutte le modalità selezionate`, '',
    'Quote sulle sole attivazioni principali. Ogni cella mostra quota di attivazione e frequenza di lancio quando il mago viene scelto.', '',
    `| Mago | ${series.map(row => row.name).join(' | ')} |`,
    `| --- | ${series.map(() => '---').join(' | ')} |`,
    ...KINDS.map(kind => `| ${mageGlossary.it[kind].name} | ${series.map(row => {
      const mage = row.mages[kind];
      return `${stylePercent(mage.main, row.main)} / ${stylePercent(mage.spells, mage.main)} (${mage.main} attivazioni, ${mage.spells} lanci)`;
    }).join(' | ')} |`), '',
    '| Regole | Attivazioni principali | Lanci | Passi Lamarcana per attivazione | Passi Incantatore per attivazione | Passaggi principali | Eliminazioni | Vittorie rosso / blu | Limiti / ripetizioni |',
    '| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
    ...series.map(row => `| ${row.name} | ${row.main} | ${row.spells} | ${styleAverage(row.mages.spellsword.steps, row.mages.spellsword.main)} | ${styleAverage(row.mages.enchanter.steps, row.mages.enchanter.main)} | ${row.passes} | ${row.eliminated} | ${row.red} / ${row.blue} | ${row.limits} / ${row.repetitions} |`), '',
  ].join('\n');
}

export function styleAverage(count: number, total: number) {
  return total ? (count / total).toLocaleString('it-IT', { maximumFractionDigits: 1 }) : '—';
}
