import type { Kind } from '../engine/game';

/** Bold silhouettes stay sharp on the board, in the roster and during movement. */
export function MageEmblem({ kind }: { kind: Kind }) {
  return <svg className={`mage-face mage-emblem emblem-${kind}`} data-emblem={kind} viewBox="0 0 64 64" aria-hidden="true" fill="currentColor">
    {kind === 'pyromancer' && <path d="M33 3c7 15-5 20 1 27 5-4 7-9 6-14 14 13 20 25 12 36-4 6-10 8-15 9 8-10 3-16-3-23-1 9-11 12-8 23C7 57 5 44 13 31l7-11c-1 8 1 10 3 12C31 22 36 15 33 3Z"/>}
    {kind === 'geomancer' && <><path d="m9 19 14-11 21 3 13 17-2 21-18 10-21-4L5 39Z"/><path d="m23 8 3 17-12 9-8 5m20-14 13 5 5-19M39 30l-4 13 9 12M35 43l-18 12m22-25 17-2" fill="none" stroke="#292b29" strokeWidth="3.5" strokeLinejoin="round"/></>}
    {kind === 'electromancer' && <path d="m41 3-30 34h19L23 61l31-37H35Z"/>}
    {kind === 'aeromancer' && <g fill="none" stroke="currentColor" strokeWidth="4.5" strokeLinecap="round"><path d="M14 23h24c14 0 14-19 3-19-8 0-11 7-8 12"/><path d="M5 35h44c15 0 15-20 3-20-7 0-11 6-9 12"/><path d="M14 47h24c14 0 14 14 5 14-7 0-10-6-7-10"/></g>}
    {kind === 'enchanter' && <><path d="M32 58 9 35C-7 17 14 1 27 14l5 5 5-5C50 1 71 17 55 35Z"/><g transform="rotate(-32 32 34)" fill="none" strokeLinecap="round"><path d="M8 34h48" stroke="#242729" strokeWidth="11"/>{[5, 23, 41].map(x => <rect key={x} x={x} y="29" width="19" height="10" rx="5" stroke="#eef0ee" strokeWidth="3.5"/>)}<path d="M20 34h8m10 0h8" stroke="#eef0ee" strokeWidth="3.5"/></g></>}
    {kind === 'illusionist' && <><path d="M3 32Q32 1 61 32 32 63 3 32Zm9 0q20 20 40 0-20-20-40 0Z" fillRule="evenodd"/><circle cx="32" cy="32" r="9"/></>}
    {kind === 'spellsword' && <><path d="M27 19h10v30l-5 11-5-11Z"/><path d="M18 18q14-4 28 0v5q-14-4-28 0Z"/><path d="M30 8h4v11h-4Z"/><circle cx="32" cy="6" r="4"/><path d="m33 28-3 5 5 3-4 6" fill="none" stroke="#292b29" strokeWidth="2.3" strokeLinejoin="round"/></>}
    {kind === 'teleporter' && <g>{[0, 120, 240].map(angle => <path key={angle} transform={`rotate(${angle} 32 32)`} d="M29 31C44 35 53 19 40 9 35 5 27 4 20 6 36-5 57 5 57 23c0 14-15 23-28 8Z"/>)}</g>}
  </svg>;
}
