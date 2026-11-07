import type { Frame } from '../engine/presentation';
import type { Point } from '../engine/geometry';
import { square } from '../engine/geometry';
import { EffectIcon } from './EffectIcon';

export function BattleOverlay({ frame, frameKey, rotated, reduced, paused, influence = [] }: { frame: Frame | null; frameKey: string; rotated: boolean; reduced: boolean; paused: boolean; influence?: Point[] }) {
  const xy = (p: Point) => ({ x: ((rotated ? 9 - p.x : p.x) + .5) * 100, y: ((rotated ? 9 - p.y : p.y) + .5) * 100 });
  const point = (p: Point) => { const q = xy(p); return `${q.x},${q.y}`; };
  return <div className={`battle-overlay ${reduced ? 'reduced-effects' : ''} ${paused ? 'effects-paused' : ''}`} aria-hidden="true" data-effect-frame={frameKey}>
    <svg className="spell-overlay" viewBox="0 0 1000 1000">
      {influence.map((p, i) => { const q = xy(p); return <g key={`influence-${i}`} className="charm-influence" data-charm-influence="true" transform={`translate(${q.x},${q.y})`}><rect x="-47" y="-47" width="94" height="94" rx="8"/><path d="M0-16C-17-34-37-8 0 18C37-8 17-34 0-16Z"/></g>; })}
      {(frame?.visuals ?? []).map((effect, i) => <g key={`${frameKey}:${i}`} className={`spell-effect spell-${effect.kind} ${effect.impact ? 'spell-impact' : ''}`} data-spell-effect={effect.kind}>
        {effect.kind === 'lightning' && effect.links?.map(([a, b], j) => { const x = xy(a), y = xy(b), dx = y.x - x.x, dy = y.y - x.y; return <path key={j} className="lightning-link" d={`M${x.x} ${x.y}l${dx * .3 + dy * .13} ${dy * .3 - dx * .13}l${dx * .15 - dy * .26} ${dy * .15 + dx * .26}L${y.x} ${y.y}`}/>; })}
        {effect.origin && effect.points[0] && ['wind', 'touch', 'fireball', 'illusion'].includes(effect.kind) && !effect.impact && <path className="spell-ray" d={`M${point(effect.origin)} L${point(effect.points[0])}`}/>}
        {effect.kind === 'dissolve' && effect.origin && effect.points[0] && <path className="copy-owner-link" d={`M${point(effect.origin)} Q${(xy(effect.origin).x + xy(effect.points[0]).x) / 2} ${(xy(effect.origin).y + xy(effect.points[0]).y) / 2 - 20} ${point(effect.points[0])}`}/>}
        {effect.points.map((p, j) => { const q = xy(p); return <g key={j} transform={`translate(${q.x},${q.y})`} className="spell-site">
          {effect.kind === 'wind' ? <><path d="M-40-19q55-30 65-7t-20 13M-38 4q68-20 72 0t-20 9M-33 24q48-9 55 2" className="wind-curls"/></> : effect.kind === 'fireball' ? <><rect x="-47" y="-47" width="94" height="94" rx="10" className="fire-area"/><path className="fire-flame" d="M0 36C-43 17-28-4-13-15c-3 15 7 17 9 9C0-22 16-26 11-42c29 24 8 34 17 43C45 17 19 37 0 36Z"/></> : effect.kind === 'sword' ? <><path className="blade-swipe" d="M-43 35Q-5-12 42-39M-35 39Q0 4 45-25"/></> : effect.kind === 'touch' ? <><circle r="31" className="psychic-ring"/><path d="M-30 0Q0-33 30 0Q0 33-30 0Zm30-16v32M-16 0h32"/></> : effect.kind === 'earth' || effect.kind === 'release' ? <><ellipse cy="28" rx="43" ry="14"/><path className="earth-shards" d="m-42 31 9-26 9 21 8-12 10 18 12-19 12 13 10-24 12 29M-25 36l9 7m30-7 11 7"/></> : effect.kind === 'teleport' ? <><ellipse cy="25" rx="43" ry="18" className="portal-ring"/><ellipse cy="25" rx="33" ry="11"/><path d="m-33 26 8-7m13 13v-9m24 9v-9m13-4 8 7M-21-33q-22 27 0 49M21-33q22 27 0 49"/><text className="portal-label" x="0" y="-37">{j === 0 ? 'PARTENZA' : 'ARRIVO'}</text></> : effect.kind === 'summon' || effect.kind === 'illusion' ? <><path className="summon-sigil" d="m0-40 11 25 27 5-24 15 2 28L0 16-16 33l2-28-24-15 27-5Z"/><ellipse cy="29" rx="35" ry="10"/></> : effect.kind === 'dissolve' ? <><path className="dissolve-shards" d="m-29-26 8-4-2 10Zm38-7 10 7-13 4Zm23 27 9 5-10 10ZM-31 15l11 4-7 12ZM5 25l7 12-14-4Z"/></> : effect.kind === 'undo' ? <g className="undo-sigil"><circle r="35"/><path d="M-21-17a27 27 0 1 1-4 32M-20-34v20h-20M0-18V1l12 7"/></g> : <circle r="35"/>}
        </g>; })}
      </g>)}
    </svg>
    {(frame?.cues ?? []).filter(cue => cue.kind === 'damage' || cue.kind === 'removed').map((cue, i) => { const p = xy(cue.at); return <span key={`${frameKey}:cue:${i}`} className={`battle-cue event-cue ${cue.kind} ${cue.symbol ?? ''}`} style={{ left: `${p.x / 10}%`, top: `${(p.y - (cue.kind === 'damage' ? 45 : 0)) / 10}%` }} data-cue-square={square(cue.at)} data-cue-symbol={cue.symbol} aria-label={cue.text}>
      <EffectIcon kind={cue.symbol === 'skull' ? 'skull' : cue.symbol === 'dissolve' ? 'dissolve' : 'damage'}/>{cue.kind === 'damage' ? <strong>−{cue.amount}</strong> : <strong>{cue.symbol === 'dissolve' ? 'COPIA SVANITA' : 'ELIMINATO'}</strong>}<span className="effect-sr">{cue.badge?.join(' · ')}</span>
    </span>; })}
  </div>;
}
