/** Shared artwork for the Enchanter's emblem and an actually charmed wizard. */
export function ChainedHeart() {
  return <g className="chained-heart" data-symbol="chained-heart" fill="currentColor" stroke="none">
    <path d="M32 58 9 35C-7 17 14 1 27 14l5 5 5-5C50 1 71 17 55 35Z"/>
    <g transform="rotate(-32 32 34)" fill="none" strokeLinecap="round">
      <path d="M8 34h48" stroke="#242729" strokeWidth="11"/>
      {[5, 23, 41].map(x => <rect key={x} x={x} y="29" width="19" height="10" rx="5" stroke="#eef0ee" strokeWidth="3.5"/>)}
      <path d="M20 34h8m10 0h8" stroke="#eef0ee" strokeWidth="3.5"/>
    </g>
  </g>;
}
