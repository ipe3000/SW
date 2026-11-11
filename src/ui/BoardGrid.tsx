import { useLanguage } from '../i18n/language';
import { useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { square, type Point } from '../engine/geometry';
import type { MovementTrack } from '../engine/presentation';
import { MovingPiece, type BoardMotion } from './MovingPiece';
export function ForceWall() {
  return <img className="force-wall energy-barrier" src={`${import.meta.env.BASE_URL}assets/force-wall-obsidian.png`} alt="" aria-hidden="true" draggable={false}/>;
}

export type CellInfo = { content?: ReactNode; label?: string; className?: string; disabled?: boolean; wizardId?: string; title?: string };
export function BoardGrid({ rotated = false, path, tracks, motion, cell, onSelect, onDoubleSelect, label = 'Scacchiera 10 per 10', overlay, reducedEffects = false, pausedEffects = false, keyboardStart }: { keyboardStart?: Point; rotated?: boolean; path?: Point[] | null; tracks?: MovementTrack[]; motion?: BoardMotion; cell: (p: Point) => CellInfo; onSelect?: (p: Point) => void; onDoubleSelect?: (p: Point) => void; label?: string; overlay?: ReactNode; reducedEffects?: boolean; pausedEffects?: boolean }) {
  const { language } = useLanguage();
  const pointer = useRef('mouse');
  const [keyboardCell, setKeyboardCell] = useState(keyboardStart);
  function moveFocus(event: KeyboardEvent<HTMLButtonElement>, point: Point) {
    const offsets: Record<string, Point> = { ArrowLeft: { x: -1, y: 0 }, ArrowRight: { x: 1, y: 0 }, ArrowUp: { x: 0, y: -1 }, ArrowDown: { x: 0, y: 1 } };
    const offset = offsets[event.key];
    if (!offset) return;
    event.preventDefault();
    const direction = rotated ? -1 : 1;
    const next = { x: point.x + offset.x * direction, y: point.y + offset.y * direction };
    if (next.x < 0 || next.x > 9 || next.y < 0 || next.y > 9) return;
    event.currentTarget.parentElement?.querySelector<HTMLButtonElement>('[data-square="' + square(next) + '"]')?.focus();
  }
  const map = (p: Point) => `${((rotated ? 9 - p.x : p.x) + .5) * 100},${((rotated ? 9 - p.y : p.y) + .5) * 100}`;
  return <div className="board-frame meadow-board" style={{ backgroundImage: `url("${import.meta.env.BASE_URL}assets/meadow-realism.webp")` }}><div className="file-labels">{Array.from({ length: 10 }, (_, i) => <span key={i}>{String.fromCharCode(65 + (rotated ? 9 - i : i))}</span>)}</div><div className="board-with-ranks"><div className="rank-labels">{Array.from({ length: 10 }, (_, i) => <span key={i}>{rotated ? i + 1 : 10 - i}</span>)}</div><div className={`board-grid ${reducedEffects ? 'effects-reduced' : ''} ${pausedEffects ? 'effects-paused' : ''}`} role="group" aria-label={keyboardStart ? label + (language === "en" ? ". Use the arrow keys to move between squares." : ". Usa le frecce per spostarti tra le caselle.") : label}>{Array.from({ length: 100 }, (_, i) => {
    const x = i % 10, y = Math.floor(i / 10), p = { x: rotated ? 9 - x : x, y: rotated ? 9 - y : y }, info = cell(p);
    return <button key={`${p.x},${p.y}`} className={`cell ${(x + y) % 2 ? 'alternate' : ''} ${info.className ?? ''}`} data-square={square(p)} data-wizard-id={info.wizardId} title={info.title} aria-label={`${language === "en" ? "Square" : "Casella"} ${square(p)}${info.label ? ', ' + info.label : ''}`} disabled={info.disabled ?? !onSelect} tabIndex={keyboardStart ? square(p) === square(keyboardCell ?? keyboardStart) ? 0 : -1 : undefined} onFocus={keyboardStart ? () => setKeyboardCell(p) : undefined} onKeyDown={keyboardStart ? e => moveFocus(e, p) : undefined} onPointerDown={e => { pointer.current = e.pointerType; }} onClick={e => { if (!onDoubleSelect || e.detail < 2) onSelect?.(p); }} onDoubleClick={() => { if (pointer.current === 'mouse') onDoubleSelect?.(p); }}>{info.content}</button>;
  })}{tracks?.length ? <svg className="path-overlay movement-trails" viewBox="0 0 1000 1000" role="img" aria-label={tracks.map(t => `Percorso ${t.label}: ${t.points.map(square).join(' → ')}`).join('. ')}>{tracks.map(track => {
    const stops = new Map<string, { point: Point; numbers: number[] }>();
    track.points.forEach((point, i) => { const key = square(point); if (!stops.has(key)) stops.set(key, { point, numbers: [] }); stops.get(key)!.numbers.push(i); });
    return <g key={track.id} data-track-id={track.id} className={track.copy ? 'copy-trail' : 'mage-trail'}><polyline className="trail-planned" points={track.points.map(map).join(' ')}/><polyline className="trail-travelled" points={track.points.slice(0, track.completed + 1).map(map).join(' ')}/>{[...stops.values()].map(({ point, numbers }) => {
      const [x, y] = map(point).split(',').map(Number), text = numbers.join('/'), width = 14 + text.length * 13;
      return <g key={square(point)} className={`trail-stop ${numbers.some(n => n <= track.completed) ? 'visited' : ''}`} data-trail-square={square(point)} data-trail-steps={text}><rect x={x - 45} y={y - 45} width={width} height="27" rx="5"/><text x={x - 45 + width / 2} y={y - 25}>{text}</text></g>;
    })}</g>;
  })}</svg> : path && path.length > 1 && <svg className="path-overlay" viewBox="0 0 1000 1000" aria-hidden="true"><polyline points={path.map(map).join(' ')}/></svg>}{motion && <MovingPiece motion={{ ...motion, reduced: reducedEffects }} rotated={rotated}/>}<div className="board-fx-host">{overlay}</div></div></div></div>;
}
