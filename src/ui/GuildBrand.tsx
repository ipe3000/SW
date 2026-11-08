/** An eight-point arcane light over an open grimoire, drawn for this game's wordmark. */
export function GuildBrand() {
  return <><svg className="brand-sigil" viewBox="0 0 64 64" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path className="brand-sigil-star" d="m32 3 3.5 11 9-6-5 10 11 3-11 3 5 10-9-6L32 39l-3.5-11-9 6 5-10-11-3 11-3-5-10 9 6Z" fill="currentColor" stroke="none"/>
    <path d="M7 38q12-6 25 2 13-8 25-2v20q-12-6-25 2-13-8-25-2Zm25 2v20M12 43q8-3 15 1m10 0q7-4 15-1M12 49q8-3 15 1m10 0q7-4 15-1"/>
  </svg><span className="brand-wordmark">Strategic <strong>Wizardry</strong></span></>;
}
