import { useEffect, useMemo, useRef, useState } from 'react';
import { duelChronicle } from '../engine/chronicle';
import { count, type Game, type Side } from '../engine/game';

export function MatchResultDialog({ game, ready, ownSide, home }: { game: Game; ready: boolean; ownSide?: Side; home: () => void }) {
  const ref = useRef<HTMLDialogElement>(null), [dismissed, setDismissed] = useState(false);
  const chronicle = useMemo(() => duelChronicle(game), [game]);
  useEffect(() => {
    if (game.result && ready && !dismissed && !ref.current?.open) ref.current?.showModal();
  }, [game.result, ready, dismissed]);
  if (!game.result) return null;
  const result = game.result, winner = result.winner === 'red' ? game.options.redName : game.options.blueName;
  const victory = winner === 'Gilda Rossa' || winner === 'Gilda Blu' ? `Vittoria della ${winner}` : `Vittoria di ${winner}`;
  const title = ownSide ? result.winner === ownSide ? 'Hai vinto!' : 'La tua gilda è stata sconfitta' : victory;
  return <dialog ref={ref} className={`result-dialog ${result.winner}`} aria-labelledby="result-title" aria-describedby={chronicle.length ? undefined : 'result-explanation'} onClose={() => setDismissed(true)}>
    <div className="result-body" tabIndex={0} role="region" aria-label="Esito e cronaca del duello">
      <header className="result-heading">
        <p className="eyebrow">Duello concluso</p>
        <h2 id="result-title">{title}</h2>
        {ownSide && <p className="result-winner"><span className={`seat-dot ${result.winner}`}/>{victory}</p>}
        <ul className="result-guilds" aria-label="Maghi superstiti">
          {(['red', 'blue'] as const).map(side => <li key={side}>
            <span className={`seat-dot ${side}`}/><span>{side === 'red' ? game.options.redName : game.options.blueName}</span>
            <strong aria-label={`${count(game, side)} maghi su 8`}>{count(game, side)}/8</strong>
          </li>)}
        </ul>
      </header>
      {chronicle.length ? <section className="result-chronicle" aria-labelledby="result-chronicle-title">
        <h3 id="result-chronicle-title">Cronaca del duello</h3>
        {chronicle.map((paragraph, index) => <p key={index}>{paragraph}</p>)}
      </section> : <p id="result-explanation">{result.reason}</p>}
    </div>
    <footer className="result-actions"><button autoFocus className="button primary" onClick={() => ref.current?.close()}>Osserva il campo</button><button className="button secondary" onClick={() => { ref.current?.close(); home(); }}>Le mie partite</button></footer>
  </dialog>;
}
