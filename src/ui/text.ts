import { mageGlossary, type Language } from '../i18n/glossary';

/** Display the current class name in older chronicles without changing saved game data. */
export const gameText = (text: string) => text.replace(/\bSpellsword\b/g, 'Lamarcana');

const presentationTerms: Record<string, string> = {
  'Schieramento': 'Deployment',
  'Prima attivazione': 'First activation',
  'Seconda attivazione': 'Second activation',
  'Semiattivazione': 'Half activation',
  'Concludi il turno': 'End turn',
  'passata.': 'skipped.',

  "semiattivazione": "half activation",
  "attivazione": "activation",
  "Incantato all’inizio: può muovere, ma non usare abilità.": "Charmed at the start. Can move but cannot use abilities.",
  "Segui il mago evidenziato.": "Follow the highlighted mage.",
  "Danni simultanei": "Simultaneous damage",
  "Eliminazioni e copie svanite": "Mages removed and copies faded",
  "Immobilizzazione": "Restraint",
  "Teletrasporto · senza percorso intermedio": "Teleport · skips intervening squares",
  "Spostamento causato dal vento": "Movement caused by Gale",
  "Copia illusoria": "Illusory Copy",
  "Movimento": "Movement",
  "spostato dal vento": "moved by Gale",
  "ELIMINATO": "REMOVED",
  "Eliminato": "Removed",
  "eliminato": "was removed",
  "COPIA SVANITA": "COPY FADED",
  "IMMOBILIZZATO": "RESTRAINED",
  "TELETRASPORTO": "TELEPORT",
  "COPIA EVOCATA": "COPY SUMMONED",
  "Bloccato": "Restrained",
  "Arrivo": "Arrival",
  "Danno": "Damage",
  "L’Illusionista evoca o comanda la propria copia.": "The Illusionist summons or commands their copy.",
  "Bersagli e area evidenziati sulla scacchiera.": "Targets and affected squares are highlighted.",
  "Nessun movimento o abilità in questa attivazione.": "This activation had no movement or ability use.",
  "Attivazione conclusa": "Activation complete",
  "Annullamento: ripristinati posizioni, punti vita, copie, effetti e risultato precedenti.": "Undo restored positions, health, copies, effects, and the previous result.",
  "Schieramento aggiornato.": "Deployment updated.",
  "Attivazione annullata": "Activation undone",
  "Duello concluso": "Duel complete",
  "Fase passata": "Phase skipped",
  "Inizio del turno avversario": "Opponent’s turn begins",
  "Nessuna attivazione: il turno è stato passato.": "The opponent passed without activating a mage.",
  "Turno avversario concluso": "Opponent’s turn complete",
  "Ritorno alla partita attuale.": "Returning to the current match.",
  "Replay del turno avversario": "Opponent’s turn replay",
  "PV": "HP",
  "Rossa": "Red",
  "Rosso": "Red",
  "Blu": "Blue",
  "Passi": "Steps",
  "Gilda Rossa": "Red Guild",
  "Gilda Blu": "Blue Guild"
};

const templates: [RegExp, string][] = [
  [/Entrambe le gilde hanno tre maghi o meno: perde chi ha lanciato la scarica\./g, 'Both guilds have three mages or fewer. The guild that cast Chain Lightning loses.'],
  [/La gilda (Rosso|Blu) è rimasta con tre maghi o meno\./g, 'The $1 Guild has three mages or fewer.'],
  [/Vittoria (Rosso|Blu)\./g, '$1 wins.'],
  [/ · (\d+) passi/g, ' · $1 steps'],

  [/Passo (\d+) di (\d+)\./g, 'Step $1 of $2.'],
  [/Centro (\w+): colpisce i nemici nella croce evidenziata\./g, 'Center $1: hits enemies in the highlighted cross.'],
  [/(\d+) maghi collegati, alleati compresi\. Il lanciatore è immune\./g, '$1 connected mages, including allies. The caster is immune.'],
  [/Bersaglio: (.+?) in (\w+)\./g, 'Target: $1 on $2.'],
  [/Turno confermato: la mano passa a (\w+)\./g, 'Turn confirmed. $1 goes next.'],
  [/immobilizzazione terminata\./g, 'restraint ended.'],
  [/Risultato provvisorio: vince (\w+)\. La soglia di sconfitta è raggiunta\./g, 'Pending result: $1 wins. The defeat threshold has been reached.'],
  [/schierato in (\w+)/g, 'deployed on $1'],
  [/Inizia il turno (\w+)/g, '$1’s turn begins'],
  [/ · turno (\d+)/g, ' · turn $1'],
  [/spostato da (\w+) a (\w+)\./g, 'moved from $1 to $2.'],
  [/immobilizzato fino alla fine del prossimo turno (\w+)\./g, 'restrained until the end of the next $1 turn.'],
  [/teletrasporto (\w+) → (\w+)\./g, 'teleported from $1 to $2.'],
  [/La copia (\w+) svanisce perché il suo Illusionista ha subito danni\./g, 'The $1 copy faded after its Illusionist took damage.'],
  [/Copia (\w+) evocata in (\w+)\./g, '$1 copy summoned on $2.'],
  [/Copia spostata da (\w+) a (\w+)\./g, 'Copy moved from $1 to $2.'],
  [/Copia (Rosso|Blu)/g, '$1 copy'],
];

const mageTerms = Object.entries(mageGlossary.it).flatMap(([kind, italian]) => {
  const english = mageGlossary.en[kind as keyof typeof mageGlossary.en];
  return [[italian.name, english.name], [italian.ability, english.ability]];
});
const terms = Object.fromEntries([...Object.entries(presentationTerms), ...mageTerms]);
const termPattern = new RegExp('(?<![\\p{L}])(?:' + Object.keys(terms).sort((a, b) => b.length - a.length)
  .map(term => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')(?![\\p{L}])', 'gu');

export function presentationText(text: string, language: Language): string {
  if (language === 'it') return gameText(text);
  const expanded = templates.reduce((value, [pattern, replacement]) => value.replace(pattern, replacement), text);
  return expanded.replace(termPattern, term => terms[term]);
}

const englishDefaultNames: Record<string, string> = {
  'Gilda Rossa': 'Red Guild',
  'Gilda Blu': 'Blue Guild',
  'Computer didattico': 'Computer',
  'Computer Rosso': 'Red Computer',
  'Computer Blu': 'Blue Computer',
};

export function displayPlayerName(name: string, language: Language): string {
  return language === 'en' && Object.hasOwn(englishDefaultNames, name) ? englishDefaultNames[name] : name;
}
