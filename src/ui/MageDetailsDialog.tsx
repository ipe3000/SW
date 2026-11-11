import { useLanguage } from '../i18n/language';
import { mageGlossary } from '../i18n/glossary';
import { conditionGlossary } from '../i18n/glossary';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { INFO, sideName, wizard, type Game, type Wizard } from '../engine/game';
import { MageEmblem } from './MageEmblem';

export const POWER_SUMMARY = {
  aeromancer: 'Sposta un altro mago di 0–2 passi; ai nemici infligge anche 1 danno.',
  electromancer: '1 danno a tutti i maghi nella catena di adiacenze, alleati compresi.',
  enchanter: '1 danno adiacente. Blocca il potere dei nemici che iniziano l’attivazione accanto.',
  geomancer: '1 danno e movimento proprio bloccato fino alla fine del prossimo turno nemico.',
  illusionist: 'Evoca e muove una copia entro 3 caselle da sé. La copia può infliggere 1 danno.',
  pyromancer: '1 danno ai nemici nella croce di cinque caselle. Gli alleati sono immuni.',
  spellsword: '2 danni a un nemico ortogonalmente adiacente.',
  teleporter: 'Sposta un altro mago su una casella libera entro 2 da sé.',
};

export const englishPowers = {
  aeromancer: 'Choose another visible mage within 3 squares. An enemy takes 1 damage. Then move the target 0–2 orthogonal steps through empty squares in any direction.',
  electromancer: 'Every mage connected to you by a chain of orthogonal adjacencies takes 1 damage, including allies. You are immune. Copies do not conduct the lightning.',
  enchanter: 'Deal 1 damage to an adjacent enemy. Passive: an enemy who begins their activation next to you cannot use their ability during that activation.',
  geomancer: 'A visible enemy within 3 squares takes 1 damage and cannot move on their own until the end of their next turn. They can still use abilities and be moved by Gale or Teleport.',
  illusionist: 'Summon an adjacent copy if none exists, then move it 0–3 steps. The entire path must stay within 3 squares of the Illusionist. The copy can deal 1 damage to an adjacent enemy. It vanishes as soon as you take damage.',
  pyromancer: 'Choose a visible square within 2 squares, including your own, with no wall. Enemies in that square and the four orthogonally adjacent squares take 1 damage. Allies are immune. Only the center needs to be visible.',
  spellsword: 'Deal 2 damage to an orthogonally adjacent enemy.',
  teleporter: 'Move another visible mage within 2 squares to an empty square that is also visible and within 2 squares of you. The path between the two squares does not matter.',
} satisfies Record<keyof typeof INFO, string>;

export function mageConditions(game: Game, mage: Wizard, charmedId?: string, language: keyof typeof conditionGlossary = 'it') {
  const conditions: { label: string; description: string }[] = [];
  if (mage.restrainedUntil !== undefined) conditions.push({ label: conditionGlossary[language].restrained, description: language === 'en'
    ? `Cannot move on their own until the end of ${game.active === mage.side && game.turn >= mage.restrainedUntil ? 'this turn' : `the next ${mage.side === 'red' ? 'Red' : 'Blue'} turn`}. Can still use abilities and be moved.`
    : `Non può camminare fino alla fine ${game.active === mage.side && game.turn >= mage.restrainedUntil ? 'di questo turno' : `del prossimo turno ${sideName(mage.side)}`}; può usare il potere ed essere spostato.` });
  if (mage.id === charmedId) conditions.push({ label: conditionGlossary[language].charmed, description: language === 'en' ? 'Cannot use an ability until the end of this activation.' : 'Abilità bloccata fino alla fine dell’attivazione.' });
  if (game.activated.includes(mage.id)) conditions.push({ label: conditionGlossary[language].activated, description: language === 'en' ? 'This mage has already been activated this turn.' : 'Questo mago è già stato attivato nel turno corrente.' });
  return conditions;
}

export type MageDetailsRequest = { game: Game; mageId: string; charmedId?: string };
export function MageDetailsDialog({ request, onClose, children }: { request: MageDetailsRequest; onClose: () => void; children?: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null), outside = useRef(false);
  const [mageId, setMageId] = useState(request.mageId);
  const { language } = useLanguage();
  const terms = mageGlossary[language];
  const english = language === 'en';
  const guild = (side: Wizard['side']) => english ? (side === 'red' ? 'Red' : 'Blue') : sideName(side);
  const mage = wizard(request.game, mageId)!;
  useEffect(() => {
    const dialog = ref.current!, previousOverflow = document.body.style.overflow;
    dialog.showModal(); document.body.style.overflow = 'hidden';
    return () => { dialog.close(); document.body.style.overflow = previousOverflow; };
  }, []);
  const beyond = (x: number, y: number) => { const box = ref.current!.getBoundingClientRect(); return x < box.left || x > box.right || y < box.top || y > box.bottom; };
  return <dialog ref={ref} className="mage-details-dialog" aria-labelledby="mage-details-title" onClose={onClose}
    onPointerDown={e => { outside.current = e.target === e.currentTarget && beyond(e.clientX, e.clientY); }}
    onClick={e => { if (outside.current && e.target === e.currentTarget && beyond(e.clientX, e.clientY)) ref.current?.close(); outside.current = false; }}>
    <header className="mage-details-heading"><div><span className={`guild-label ${mage.side}`}>{guild(mage.side)}</span><h2 id="mage-details-title">{terms[mage.kind].name}</h2></div><button autoFocus className="button ghost" aria-label={english ? 'Close mage details' : 'Chiudi scheda mago'} onClick={() => ref.current?.close()}><svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg></button></header>
    <div className="mage-details-stats"><span className={`details-emblem ${mage.side}`} aria-hidden="true"><MageEmblem kind={mage.kind}/></span><dl><div><dt>{english ? 'Health' : 'Punti vita'}</dt><dd>{mage.hp}</dd></div><div><dt>{english ? 'Movement' : 'Movimento'}</dt><dd>{INFO[mage.kind].speed}</dd></div><div><dt>{english ? 'Range' : 'Gittata'}</dt><dd>{INFO[mage.kind].range}</dd></div></dl></div>
    {mageConditions(request.game, mage, request.charmedId, language).map(condition => <p className="mage-condition-note" key={condition.label}><strong>{condition.label}.</strong> {condition.description}</p>)}
    <section className="mage-power"><h3>{terms[mage.kind].ability}</h3><p>{english ? englishPowers[mage.kind] : POWER_SUMMARY[mage.kind]}</p>{!english && <details><summary>Regole complete</summary><p>{INFO[mage.kind].description}</p></details>}</section>
    {mageId === request.mageId && children}
    <label className="mage-details-picker">{english ? 'Mage to inspect' : 'Mago da consultare'}<select value={mageId} onChange={e => setMageId(e.target.value)}>{request.game.wizards.filter(w => w.pos || w.id === request.mageId).map(w => <option key={w.id} value={w.id}>{terms[w.kind].name} · {guild(w.side)}</option>)}</select></label>
  </dialog>;
}
