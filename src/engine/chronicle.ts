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

function describe(event: ChronicleEvent, variant: number): string {
  const { wizardId, spell } = event.activation;
  const actor = title(wizardId);
  const hit = targets(event, 'damage');
  const struck = names(hit);
  const fallen = targets(event, 'removed');
  const moved = targets(event, 'move');
  const held = targets(event, 'restrain');
  const faded = targets(event, 'fade');
  const alternate = variant % 2 === 1;
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

  const aftermath = [sentence(action)];
  if (faded.length) {
    aftermath.push(sentence(italianList.format(faded.map(id => `la copia del${title(id)}`)) +
      (faded.length === 1 ? ' si dissolse' : ' si dissolsero')));
  }
  if (fallen.length) aftermath.push(sentence(`${names(fallen)} ${fallen.length === 1 ? 'cadde' : 'caddero'}`));
  return aftermath.join(' ');
}

function weight(event: ChronicleEvent): number {
  return targets(event, 'removed').length * 5 + targets(event, 'damage').length * 2 +
    targets(event, 'fade').length * 2 + targets(event, 'restrain').length + targets(event, 'move').length;
}

export function duelChronicle(game: Game): string[] {
  const events = game.chronicle;
  if (!game.result || !events?.length) return [];
  const last = events.length - 1;
  const scenes = events.map((event, index) => {
    const next = events[index + 1];
    const moved = targets(event, 'move');
    const linked = next && next.turn <= event.turn + 2 && moved.includes(next.activation.wizardId);
    return { index, score: weight(event) + (linked ? 5 : 0), linked };
  });
  const selected = new Set([last]);
  for (const scene of [...scenes].sort((a, b) => b.score - a.score || b.index - a.index)) {
    if (selected.size >= 3 || scene.score < 2) break;
    if (scene.linked && (selected.has(scene.index + 1) || selected.size < 2)) selected.add(scene.index + 1);
    if (selected.size < 3) selected.add(scene.index);
  }

  const seed = Array.from(game.id).reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const paragraphs: string[] = [];
  let previous = -2;
  for (const index of [...selected].sort((a, b) => a - b)) {
    const text = describe(events[index], seed + index);
    const linked = previous === index - 1 && scenes[previous]?.linked;
    if (linked || previous >= 0 && index === last) {
      const transition = linked ? 'Poi' : 'Infine';
      const continuation = `${transition}, ${text[0].toLowerCase()}${text.slice(1)}`;
      if (linked) paragraphs[paragraphs.length - 1] += ` ${continuation}`;
      else paragraphs.push(continuation);
    } else {
      paragraphs.push(text);
    }
    previous = index;
  }
  const { winner, loser } = game.result;
  const survivors = count(game, loser);
  const victor = winner === 'red' ? 'Gilda Rossa' : 'Gilda Blu';
  const defeated = loser === 'red' ? 'Gilda Rossa' : 'Gilda Blu';
  const ending = count(game, winner) <= 3
    ? `Entrambe le gilde erano ormai ridotte a tre maghi o meno. Poiché la scarica era partita dalla ${defeated}, fu lei a cedere il campo alla ${victor}`
    : `Alla ${defeated} ${['non restava più nessuno', 'restava un solo superstite', 'restavano due superstiti', 'restavano tre superstiti'][survivors]}. La vittoria andò alla ${victor}`;
  paragraphs[paragraphs.length - 1] += ` ${sentence(ending)}`;
  return paragraphs;
}
