import type { ReactNode } from 'react';
import { square, type Point } from '../engine/geometry';
import type { MovementTrack } from '../engine/presentation';
import { MovingPiece, type BoardMotion } from './MovingPiece';
export function ForceWall() {
  return <img className="force-wall energy-barrier" src={`${import.meta.env.BASE_URL}assets/force-wall-obsidian.png`} alt="" aria-hidden="true" draggable={false}/>;
}

export type CellInfo = { content?: ReactNode; label?: string; className?: string; disabled?: boolean; wizardId?: string; title?: string };
export function BoardGrid({ rotated = false, path, tracks, motion, cell, onSelect, label = 'Scacchiera 10 per 10', overlay, reducedEffects = false, pausedEffects = false }: { rotated?: boolean; path?: Point[] | null; tracks?: MovementTrack[]; motion?: BoardMotion; cell: (p: Point) => CellInfo; onSelect?: (p: Point) => void; label?: string; overlay?: ReactNode; reducedEffects?: boolean; pausedEffects?: boolean }) {
  const map = (p: Point) => `${((rotated ? 9 - p.x : p.x) + .5) * 100},${((rotated ? 9 - p.y : p.y) + .5) * 100}`;
  return <div className="board-frame meadow-board" style={{ backgroundImage: `url("${import.meta.env.BASE_URL}assets/arcane-meadow-fantasy.webp")` }}><div className="file-labels">{Array.from({ length: 10 }, (_, i) => <span key={i}>{String.fromCharCode(65 + (rotated ? 9 - i : i))}</span>)}</div><div className="board-with-ranks"><div className="rank-labels">{Array.from({ length: 10 }, (_, i) => <span key={i}>{rotated ? i + 1 : 10 - i}</span>)}</div><div className={`board-grid ${reducedEffects ? 'effects-reduced' : ''} ${pausedEffects ? 'effects-paused' : ''}`} role="group" aria-label={label}>{Array.from({ length: 100 }, (_, i) => {
    const x = i % 10, y = Math.floor(i / 10), p = { x: rotated ? 9 - x : x, y: rotated ? 9 - y : y }, info = cell(p);
    return <button key={`${p.x},${p.y}`} className={`cell ${(x + y) % 2 ? 'alternate' : ''} ${info.className ?? ''}`} data-square={square(p)} data-wizard-id={info.wizardId} title={info.title} aria-label={`Casella ${square(p)}${info.label ? ', ' + info.label : ''}`} disabled={info.disabled ?? !onSelect} onClick={() => onSelect?.(p)}>{info.content}</button>;
  })}{tracks?.length ? <svg className="path-overlay movement-trails" viewBox="0 0 1000 1000" role="img" aria-label={tracks.map(t => `Percorso ${t.label}: ${t.points.map(square).join(' → ')}`).join('. ')}>{tracks.map(track => {
    const stops = new Map<string, { point: Point; numbers: number[] }>();
    track.points.forEach((point, i) => { const key = square(point); if (!stops.has(key)) stops.set(key, { point, numbers: [] }); stops.get(key)!.numbers.push(i); });
    return <g key={track.id} data-track-id={track.id} className={track.copy ? 'copy-trail' : 'mage-trail'}><polyline className="trail-planned" points={track.points.map(map).join(' ')}/><polyline className="trail-travelled" points={track.points.slice(0, track.completed + 1).map(map).join(' ')}/>{[...stops.values()].map(({ point, numbers }) => {
      const [x, y] = map(point).split(',').map(Number), text = numbers.join('/'), width = 14 + text.length * 13;
      return <g key={square(point)} className={`trail-stop ${numbers.some(n => n <= track.completed) ? 'visited' : ''}`} data-trail-square={square(point)} data-trail-steps={text}><rect x={x - 45} y={y - 45} width={width} height="27" rx="5"/><text x={x - 45 + width / 2} y={y - 25}>{text}</text></g>;
    })}</g>;
  })}</svg> : path && path.length > 1 && <svg className="path-overlay" viewBox="0 0 1000 1000" aria-hidden="true"><polyline points={path.map(map).join(' ')}/></svg>}{motion && <MovingPiece motion={{ ...motion, reduced: reducedEffects }} rotated={rotated}/>}<div className="board-fx-host">{overlay}</div></div></div></div>;
}
