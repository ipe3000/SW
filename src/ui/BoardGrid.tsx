import { useId, type ReactNode } from 'react';
import { square, type Point } from '../engine/geometry';
import type { MovementTrack } from '../engine/presentation';
import { MovingPiece, type BoardMotion } from './MovingPiece';
export function ForceWall() {
  const id = `ward-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  return <svg className="force-wall" viewBox="0 0 60 60" aria-hidden="true"><defs><linearGradient id={id} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#5d3bba" stopOpacity=".85"/><stop offset=".48" stopColor="#e2faff" stopOpacity=".65"/><stop offset="1" stopColor="#6542c4" stopOpacity=".9"/></linearGradient></defs>
    <rect x="1" y="1" width="58" height="58" rx="4" className="force-wall-body"/>
    <ellipse cx="30" cy="49" rx="24" ry="7" className="ward-ground"/><ellipse cx="30" cy="49" rx="18" ry="4" className="ward-ground-inner"/>
    <path d="M8 42V12Q30 1 52 12V42Q30 54 8 42Z" fill={`url(#${id})`} className="ward-veil"/>
    <path d="M8 42V12Q30 1 52 12V42M12 13Q30 5 48 13M8 42Q30 54 52 42" className="ward-edge"/>
    <g className="ward-energy"><path d="M14 39Q23 30 16 17M24 44Q17 32 27 10M35 45Q44 31 34 10M46 39Q37 26 45 17"/><path d="m15 24 7-4 8 4 8-4 7 4m-30 0v9l7 4 8-4 8 4 7-4v-9M22 20v-8m8 12v9m8-13v-8" className="ward-lattice"/></g>
    <path d="m24 46 2 3-2 3m6-5v6m6-7-2 3 2 3M5 18v5m-2-2h4m48 9v6m-3-3h6M30 3v5m-2-3h4" className="ward-runes"/>
    <g className="ward-motes"><circle cx="10" cy="8" r="1.1"/><circle cx="49" cy="7" r="1"/><circle cx="19" cy="32" r="1.3"/><circle cx="41" cy="27" r="1"/><circle cx="8" cy="47" r="1"/><circle cx="51" cy="46" r="1.2"/></g>
  </svg>;
}
export type CellInfo = { content?: ReactNode; label?: string; className?: string; disabled?: boolean; wizardId?: string; title?: string };
export function BoardGrid({ rotated = false, path, tracks, motion, cell, onSelect, label = 'Scacchiera 10 per 10', overlay, reducedEffects = false, pausedEffects = false }: { rotated?: boolean; path?: Point[] | null; tracks?: MovementTrack[]; motion?: BoardMotion; cell: (p: Point) => CellInfo; onSelect?: (p: Point) => void; label?: string; overlay?: ReactNode; reducedEffects?: boolean; pausedEffects?: boolean }) {
  const map = (p: Point) => `${((rotated ? 9 - p.x : p.x) + .5) * 100},${((rotated ? 9 - p.y : p.y) + .5) * 100}`;
  return <div className="board-frame"><div className="file-labels">{Array.from({ length: 10 }, (_, i) => <span key={i}>{String.fromCharCode(65 + (rotated ? 9 - i : i))}</span>)}</div><div className="board-with-ranks"><div className="rank-labels">{Array.from({ length: 10 }, (_, i) => <span key={i}>{rotated ? i + 1 : 10 - i}</span>)}</div><div className={`board-grid ${reducedEffects ? 'effects-reduced' : ''} ${pausedEffects ? 'effects-paused' : ''}`} role="group" aria-label={label}>{Array.from({ length: 100 }, (_, i) => {
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
