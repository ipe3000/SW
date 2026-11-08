import { useEffect, useRef, useState } from 'react';
import { INFO, sideName, wizard, type Game, type Wizard } from '../engine/game';
import { charmInfluence } from '../engine/visual-effects';
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

export function mageConditions(game: Game, mage: Wizard, charmedId?: string) {
  const conditions: { label: string; description: string }[] = [];
  if (mage.restrainedUntil !== undefined) conditions.push({ label: 'Immobilizzato', description: `Non può camminare fino alla fine ${game.active === mage.side && game.turn >= mage.restrainedUntil ? 'di questo turno' : `del prossimo turno ${sideName(mage.side)}`}; può usare il potere ed essere spostato.` });
  if (mage.id === charmedId) conditions.push({ label: 'Incantato', description: 'Abilità bloccata fino alla fine dell’attivazione.' });
  else if (charmInfluence(game).some(link => link.targetId === mage.id)) conditions.push({ label: 'Influenza nemica', description: 'Blocca l’abilità soltanto se l’attivazione inizia accanto all’Incantatore nemico.' });
  if (game.activated.includes(mage.id)) conditions.push({ label: 'Già attivato', description: 'Questo mago è già stato attivato nel turno corrente.' });
  return conditions;
}

export type MageDetailsRequest = { game: Game; mageId: string; charmedId?: string };
export function MageDetailsDialog({ request, onClose }: { request: MageDetailsRequest; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null), outside = useRef(false);
  const [mageId, setMageId] = useState(request.mageId);
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
    <header className="mage-details-heading"><div><span className={`guild-label ${mage.side}`}>{sideName(mage.side)}</span><h2 id="mage-details-title">{INFO[mage.kind].name}</h2></div><button autoFocus className="button ghost" aria-label="Chiudi scheda mago" onClick={() => ref.current?.close()}><svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg></button></header>
    <div className="mage-details-stats"><span className={`details-emblem ${mage.side}`} aria-hidden="true"><MageEmblem kind={mage.kind}/></span><dl><div><dt>Punti vita</dt><dd>{mage.hp}</dd></div><div><dt>Movimento</dt><dd>{INFO[mage.kind].speed}</dd></div><div><dt>Gittata</dt><dd>{INFO[mage.kind].range}</dd></div></dl></div>
    {mageConditions(request.game, mage, request.charmedId).map(condition => <p className="mage-condition-note" key={condition.label}><strong>{condition.label}.</strong> {condition.description}</p>)}
    <section className="mage-power"><h3>{INFO[mage.kind].ability}</h3><p>{POWER_SUMMARY[mage.kind]}</p><details><summary>Regole complete</summary><p>{INFO[mage.kind].description}</p></details></section>
    <label className="mage-details-picker">Mago da consultare<select value={mageId} onChange={e => setMageId(e.target.value)}>{request.game.wizards.filter(w => w.pos || w.id === request.mageId).map(w => <option key={w.id} value={w.id}>{INFO[w.kind].name} · {sideName(w.side)}</option>)}</select></label>
  </dialog>;
}
