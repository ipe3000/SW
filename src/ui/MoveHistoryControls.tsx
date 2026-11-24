import type { Ref } from 'react';
import type { Game } from '../engine/game';
import type { MovePoint } from '../engine/move-history';
import { useLanguage } from '../i18n/language';
import { displayPlayerName } from './text';
import './move-history.css';

type Props = {
  game: Game;
  points: MovePoint[];
  index: number;
  lastHuman: number | undefined;
  both: boolean;
  busy: boolean;
  animating: boolean;
  editing: boolean;
  canEdit: boolean;
  finished: boolean;
  positionRef: Ref<HTMLParagraphElement>;
  onSelect: (index: number) => void;
  onResume: () => void;
  onEdit: () => void;
  onCancel: () => void;
};

export function MoveHistoryControls({ game, points, index, lastHuman, both, busy, animating, editing, canEdit, finished, positionRef, onSelect, onResume, onEdit, onCancel }: Props) {
  const { language } = useLanguage();
  const en = language === 'en';
  const last = points.length - 1;
  const current = points[index];
  const side = game.result?.winner ?? game.active;
  const color = side === 'red' ? (en ? 'Red' : 'Rosso') : (en ? 'Blue' : 'Blu');
  const name = displayPlayerName(game.active === 'red' ? game.options.redName : game.options.blueName, language);
  const turn = game.result ? (en ? `${color} wins` : `Vittoria del ${color}`) : (en ? `${color} to move` : `Tocca al ${color}`);
  const position = animating
    ? (en ? `Animation paused · Latest recorded move ${last}` : `Animazione in pausa · Ultima mossa registrata ${last}`)
    : (en ? `Move ${index} of ${last} · ${turn}` : `Mossa ${index} di ${last} · ${turn}`);
  const base = points[0];
  const partial = base.logLength > 0 || base.board.turn > 0 || base.board.phase > 0 || base.board.stage === 'finished' ||
    game.options.placement === 'custom' && base.board.wizards.some(mage => mage.pos);
  return <section className="move-history" aria-label={en ? 'Move history' : 'Cronologia delle mosse'}>
    <p className="move-history-position" ref={positionRef} tabIndex={-1} role="status" aria-atomic="true">
      {position}{!animating && current.manual && (en ? ' · Manual move' : ' · Mossa manuale')}
    </p>
    {editing ? <>
      <p>{both ? (en ? `Choose one move for ${name} on the board.` : `Scegli sul campo una sola mossa per ${name}.`) : (en ? 'Choose your replacement move on the board.' : 'Scegli sul campo la mossa alternativa.')}</p>
      <button className="button secondary" disabled={busy} onClick={onCancel}>{en ? 'Cancel move change' : 'Annulla modifica'}</button>
    </> : <>
      {!animating && index === 0 && partial && <p>{en ? 'First position available in this save.' : 'Prima posizione disponibile nel salvataggio.'}</p>}
      <div className="move-history-step">
        <button className="button secondary" disabled={busy || index === 0} onClick={() => onSelect(index - 1)}><span aria-hidden="true">←</span>{en ? 'Previous move' : 'Mossa precedente'}</button>
        <button className="button secondary" disabled={busy || index === last} onClick={() => onSelect(index + 1)}>{en ? 'Next move' : 'Mossa successiva'}<span aria-hidden="true">→</span></button>
      </div>
      <div className="move-history-step">
        <button className="button secondary" disabled={busy || index === last && !animating} onClick={() => onSelect(last)}>{en ? 'Go to latest move' : 'Torna all’ultima mossa'}</button>
        {!both && <button className="button secondary" disabled={busy || lastHuman === undefined || index === lastHuman && !animating} onClick={() => lastHuman !== undefined && onSelect(lastHuman)}>{en ? 'Review your last move' : 'Rivedi la tua ultima mossa'}</button>}
      </div>
      {canEdit && <button className="button secondary" disabled={busy} onClick={onEdit}>{both ? (en ? `Play for ${name}` : `Gioca per ${name}`) : (en ? 'Change your move' : 'Cambia la tua mossa')}</button>}
      {!finished && index !== last && <button className="button primary" disabled={busy} onClick={onResume}>{en ? 'Return to present and resume' : 'Torna al presente e riprendi'}</button>}
    </>}
  </section>;
}
