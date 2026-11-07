import { useEffect, useRef, useState } from 'react';
import { count, type Game, type Side } from '../engine/game';

export function MatchResultDialog({ game, ready, ownSide, home }: { game: Game; ready: boolean; ownSide?: Side; home: () => void }) {
  const ref = useRef<HTMLDialogElement>(null), [dismissed, setDismissed] = useState(false);
  useEffect(() => {
    if (game.result && ready && !dismissed && !ref.current?.open) ref.current?.showModal();
  }, [game.result, ready, dismissed]);
  if (!game.result) return null;
  const result = game.result, winner = result.winner === 'red' ? game.options.redName : game.options.blueName;
  const title = ownSide ? result.winner === ownSide ? 'Hai vinto!' : 'La tua gilda è stata sconfitta' : `Vittoria di ${winner}`;
  return <dialog ref={ref} className={`result-dialog ${result.winner}`} aria-labelledby="result-title" aria-describedby="result-explanation" onClose={() => setDismissed(true)}>
    <div className="result-emblem" aria-hidden="true">✧</div><p className="eyebrow">DUELLO CONCLUSO</p><h2 id="result-title">{title}</h2>
    <p className="result-winner"><span className={`seat-dot ${result.winner}`}/>{winner} · Gilda {result.winner === 'red' ? 'Rossa' : 'Blu'}</p>
    <p id="result-explanation">{result.reason}</p>
    <div className="result-guilds">{(['red', 'blue'] as Side[]).map(side => <div key={side}><span className={`seat-dot ${side}`}/><span>{side === 'red' ? game.options.redName : game.options.blueName}</span><strong>{count(game, side)} / 8 maghi</strong></div>)}</div>
    <p className="fine-print">L’esito è definitivo. La partita e la cronaca restano salvate: puoi osservare il campo o esportare il salvataggio.</p>
    <div className="result-actions"><button autoFocus className="button primary" onClick={() => ref.current?.close()}>Osserva il campo</button><button className="button secondary" onClick={() => { ref.current?.close(); home(); }}>Le mie partite</button></div>
  </dialog>;
}
