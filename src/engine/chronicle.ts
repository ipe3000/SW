import { mageGlossary, type Language } from '../i18n/glossary';
import { count, INFO, sideName, type ChronicleEvent, type Game, type Kind, type Side } from './game';

function title(id: string): string {
  const [side, kind] = id.split(':') as [Side, Kind];
  const name = INFO[kind].name;
  const article = kind === 'spellsword' ? 'la ' : /^[AEIOU]/.test(name) ? 'l’' : 'il ';
  return article + name + (kind === 'spellsword' && side === 'red' ? ' Rossa' : ` ${sideName(side)}`);
}

const sentence = (text: string) => text.charAt(0).toUpperCase() + text.slice(1) + '.';
const italianList = new Intl.ListFormat('it');
const names = (ids: string[]) => italianList.format(ids.map(title));
const targets = (event: ChronicleEvent, kind: ChronicleEvent['effects'][number]['kind']) =>
  event.effects.filter(effect => effect.kind === kind).map(effect => effect.wizardId);

function describe(event: ChronicleEvent, variant: number, opening: boolean): string {
  const { wizardId, spell } = event.activation;
  const actor = title(wizardId);
  const alternate = variant % 2 === 1;
  if (!spell && event.charmedBy) {
    const enchanter = title(event.charmedBy);
    return sentence(alternate
      ? `${actor} dovette agire senza magia, sotto l’incanto del${enchanter}`
      : `${enchanter} serrò il suo incanto su ${actor}, che sotto quell’influsso non poté ricorrere alla magia`);
  }
  if (!spell) return '';
  const hit = targets(event, 'damage');
  const struck = names(hit);
  const fallen = targets(event, 'removed');
  const moved = targets(event, 'move');
  const held = targets(event, 'restrain');
  const faded = targets(event, 'fade');
  let action: string;

  switch (spell.kind) {
    case 'lightning':
      action = alternate ? `Una scarica attraversò lo schieramento e investì ${struck}. A scatenarla fu ${actor}` :
        `${actor} scatenò una scarica a catena che investì ${struck}`;
      break;
    case 'fireball':
      action = alternate ? `La palla di fuoco esplose e le fiamme investirono ${struck}. A scagliarla fu ${actor}` :
        `${actor} scagliò una palla di fuoco che investì ${struck}`;
      break;
    case 'touch':
      action = alternate ? `Fu un tocco psichico a ferire ${struck}. A sferrarlo fu ${actor}` :
        `${actor} colpì ${struck} con il suo tocco psichico`;
      break;
    case 'earth':
      action = held.length
        ? alternate ? `Al richiamo del ${actor.slice(3)}, la terra ferì e trattenne ${struck}` : `${actor} ferì e inchiodò al suolo ${struck}`
        : `${actor} colpì ${struck} con la Presa della terra`;
      break;
    case 'sword':
      action = alternate ? `La lama arcana fendette l’aria e raggiunse ${struck}. A brandirla era ${actor}` :
        `${actor} menò un fendente di lama arcana contro ${struck}`;
      break;
    case 'wind': {
      const target = title(spell.targetId);
      if (hit.length && moved.length) action = `${actor} levò una raffica che ferì e travolse ${target}`;
      else if (moved.length) action = alternate ? `Una raffica sospinse ${target}. A chiamare il vento fu ${actor}` :
        `${actor} sospinse ${target} con un colpo di vento`;
      else action = `${actor} ferì ${target} con una sferzata di vento`;
      break;
    }
    case 'teleport': {
      const target = title(spell.targetId);
      action = alternate ? `${target} svanì e riapparve in un altro punto del campo, per opera del ${actor.slice(3)}` :
        `${actor} piegò lo spazio e trasportò ${target} in un altro punto del campo`;
      break;
    }
    case 'illusion':
      if (spell.summon) {
        action = alternate ? `Accanto al${actor} prese forma una copia illusoria` :
          `${actor} evocò la propria copia`;
        if (hit.length) action += `. La copia si avventò su ${struck} e colpì nel segno`;
      } else {
        action = hit.length ? `${actor} mandò la propria copia a colpire ${struck}` :
          `${actor} fece avanzare la propria copia sul campo`;
      }
      break;
  }

  if (opening) {
    if (spell.kind === 'fireball') {
      action = alternate
        ? `Tra le schiere divampò il fuoco. Fu ${actor} a scagliare le fiamme contro ${struck}`
        : `Quando le fiamme squarciarono il campo, fu la palla di fuoco del ${actor.slice(3)} a investire ${struck}`;
    } else if (spell.kind === 'lightning') {
      action = alternate
        ? `La folgore corse di mago in mago, investendo ${struck}. A scatenarla fu ${actor}`
        : `${actor} destò la folgore. La scarica attraversò le schiere e investì ${struck}`;
    } else {
      const lead = ['Nel vivo del duello', 'Sul campo conteso', 'Fra le schiere rivali'][variant % 3];
      action = `${lead}, ${action.charAt(0).toLowerCase()}${action.slice(1)}`;
    }
  }
  const aftermath = [sentence(action)];
  if (faded.length) {
    aftermath.push(sentence(italianList.format(faded.map(id => `la copia del${title(id)}`)) +
      (faded.length === 1 ? ' si dissolse' : ' si dissolsero')));
  }
  if (fallen.length) aftermath.push(sentence(`${names(fallen)} ${fallen.length === 1 ? 'cadde' : 'caddero'}`));
  return aftermath.join(' ');
}

const englishList = new Intl.ListFormat('en');

function englishTitle(id: string): string {
  const [side, kind] = id.split(':') as [Side, Kind];
  return `the ${side === 'red' ? 'Red' : 'Blue'} ${mageGlossary.en[kind].name}`;
}

function describeEnglish(event: ChronicleEvent, variant: number, opening: boolean): string {
  const { wizardId, spell } = event.activation;
  const actor = englishTitle(wizardId);
  if (!spell) {
    return event.charmedBy
      ? sentence(`${englishTitle(event.charmedBy)} held ${actor} under a charm, sealing away their magic`)
      : '';
  }

  const hit = targets(event, 'damage');
  const struck = englishList.format(hit.map(englishTitle));
  const moved = targets(event, 'move').length > 0;
  let action: string;
  switch (spell.kind) {
    case 'lightning':
      action = `${actor} unleashed Chain Lightning${hit.length ? `, striking ${struck}` : ''}`;
      break;
    case 'fireball':
      action = hit.length ? `${actor} hurled a Fireball that engulfed ${struck}` :
        `${actor} hurled a Fireball that burst harmlessly`;
      break;
    case 'touch':
      action = `${actor} wounded ${struck} with Psychic Touch`;
      break;
    case 'earth':
      action = targets(event, 'restrain').length
        ? `${actor} called on Earth Grasp to wound and pin ${struck}`
        : `${actor} struck ${struck} with Earth Grasp`;
      break;
    case 'sword':
      action = `${actor} cut down at ${struck} with an Arcane Blade`;
      break;
    case 'wind': {
      const target = englishTitle(spell.targetId);
      if (hit.length && moved) action = `${actor} raised a gale that wounded and swept away ${target}`;
      else if (moved) action = `${actor} swept ${target} aside with a gale`;
      else if (hit.length) action = `${actor} wounded ${target} with a blast of wind`;
      else action = `${actor} summoned a gale around ${target}`;
      break;
    }
    case 'teleport':
      action = `${actor} folded space and carried ${englishTitle(spell.targetId)} to another part of the field`;
      break;
    case 'illusion':
      if (spell.summon) {
        action = `${actor} summoned an Illusory Copy`;
        if (hit.length) action += `. The copy lunged at ${struck} and struck true`;
      } else {
        action = hit.length ? `${actor} sent their copy to strike ${struck}` :
          `${actor} sent their copy across the field`;
      }
      break;
  }

  if (opening) {
    const lead = ['In the thick of the duel', 'On the contested field', 'Among the rival ranks'][variant % 3];
    action = `${lead}, ${action}`;
  }
  const aftermath = [sentence(action)];
  const faded = targets(event, 'fade');
  const fallen = targets(event, 'removed');
  if (faded.length) {
    aftermath.push(sentence(`${englishList.format(faded.map(id => `${englishTitle(id)}’s copy`))} faded away`));
  }
  if (fallen.length) aftermath.push(sentence(`${englishList.format(fallen.map(englishTitle))} fell`));
  return aftermath.join(' ');
}

function englishEnding(game: Game, winner: Side, loser: Side): string {
  const victor = winner === 'red' ? 'the Red Guild' : 'the Blue Guild';
  const defeated = loser === 'red' ? 'the Red Guild' : 'the Blue Guild';
  if (count(game, winner) <= 3) {
    return `The same burst of lightning brought both guilds to the brink of defeat. Having unleashed it, ${defeated} yielded the field to ${victor}.`;
  }
  const remaining = ['no mages left', 'only one mage left', 'only two mages left', 'only three mages left'][count(game, loser)];
  return `With ${remaining}, ${defeated} yielded the field to ${victor}.`;
}

function weight(event: ChronicleEvent): number {
  return targets(event, 'removed').length * 5 + targets(event, 'damage').length * 2 +
    targets(event, 'fade').length + targets(event, 'restrain').length + targets(event, 'move').length + Number(Boolean(event.charmedBy));
}

export function duelChronicle(game: Game, language: Language = 'it'): string[] {
  const events = game.chronicle;
  if (!game.result || !events?.length) return [];
  const last = events.length - 1;
  const scenes = events.map((event, index) => {
    const next = events[index + 1];
    const moved = targets(event, 'move');
    const linked = next?.activation.spell && next.turn <= event.turn + 2 && moved.includes(next.activation.wizardId);
    return { index, score: weight(event) + (linked ? 5 : 0), linked };
  });
  const ranked = [...scenes].sort((a, b) => b.score - a.score || b.index - a.index);
  const selected = new Set([last]);
  for (const scene of ranked) {
    if (selected.size >= 3 || scene.score < 2) break;
    selected.add(scene.index);
  }

  const completesScene = (index: number) => {
    const fallen = targets(events[index], 'removed');
    return [...selected].some(prior => prior < index && fallen.includes(events[prior].activation.wizardId));
  };
  const connectsMovement = (index: number) =>
    (scenes[index].linked && selected.has(index + 1)) ||
    (selected.has(index - 1) && scenes[index - 1].linked);
  const candidates = ranked.filter(scene => !selected.has(scene.index));
  const extra = candidates.find(scene => completesScene(scene.index)) ??
    candidates.find(scene => connectsMovement(scene.index)) ??
    candidates.find(scene => scene.score >= 2 || events[scene.index].charmedBy);
  if (extra) selected.add(extra.index);

  const seed = Array.from(game.id).reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const describeScene = language === 'en' ? describeEnglish : describe;
  const paragraphs: string[] = [];
  let previous = -2;
  for (const index of [...selected].sort((a, b) => a - b)) {
    const text = describeScene(events[index], seed + index, previous === -2);
    if (!text) continue;
    const linked = previous === index - 1 && scenes[previous]?.linked;
    if (linked || previous >= 0 && index === last) {
      const transition = language === 'en' ? (linked ? 'Then' : 'Finally') : (linked ? 'Poi' : 'Infine');
      const continuation = `${transition}, ${text[0].toLowerCase()}${text.slice(1)}`;
      if (linked) paragraphs[paragraphs.length - 1] += ` ${continuation}`;
      else paragraphs.push(continuation);
    } else {
      paragraphs.push(text);
    }
    previous = index;
  }
  const { winner, loser } = game.result;
  if (!paragraphs.length) return [];
  if (language === 'en') {
    paragraphs[paragraphs.length - 1] += ` ${englishEnding(game, winner, loser)}`;
    return paragraphs;
  }
  const survivors = count(game, loser);
  const victor = winner === 'red' ? 'Gilda Rossa' : 'Gilda Blu';
  const defeated = loser === 'red' ? 'Gilda Rossa' : 'Gilda Blu';
  const remaining = ['non restava più nessuno', 'restava un solo superstite', 'restavano due superstiti', 'restavano tre superstiti'][survivors];
  const endings = count(game, winner) <= 3
    ? [
      `La stessa folgore portò entrambe le gilde alla soglia della sconfitta. A scatenarla era stata la ${defeated}, che dovette cedere il campo alla ${victor}`,
      `Entrambe le gilde erano ormai ridotte a tre maghi o meno. Poiché la scarica era partita dalla ${defeated}, fu lei a cedere il campo alla ${victor}`,
    ]
    : [
      `Con quel colpo si chiuse il duello. Alla ${defeated} ${remaining}, e il campo rimase alla ${victor}`,
      `Alla ${defeated} ${remaining}. Fu allora che dovette cedere il campo alla ${victor}`,
      `La ${victor} ebbe la vittoria. Tra le file della ${defeated} ${remaining}`,
    ];
  const ending = endings[seed % endings.length];
  paragraphs[paragraphs.length - 1] += ` ${sentence(ending)}`;
  return paragraphs;
}
