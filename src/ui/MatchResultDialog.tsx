import { MatchAnalysis } from './MatchAnalysis';
import { displayPlayerName, presentationText } from './text';
import { useLanguage } from '../i18n/language';
import { useEffect, useMemo, useRef, useState } from 'react';
import { duelChronicle } from '../engine/chronicle';
import { count, type AnalysisPosition, type Match, type Side } from '../engine/game';

export function MatchResultDialog({ match, ready, ownSide, home, onPractice, reopen, practice }: { match: Match; ready: boolean; ownSide?: Side; home: () => void; onPractice: (position: AnalysisPosition) => void; reopen: number; practice?: boolean }) {
  const game = match.game;
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDialogElement>(null), [dismissed, setDismissed] = useState(false);
  const { language } = useLanguage();
  const chronicle = useMemo(() => duelChronicle(game, language), [game, language]);
  useEffect(() => {
    if (game.result && ready && !dismissed && !ref.current?.open) { ref.current?.showModal(); setOpen(true); }
  }, [game.result, ready, dismissed]);
  useEffect(() => { if (reopen) setDismissed(false); }, [reopen]);
  if (!game.result) return null;
  const result = game.result, winner = result.winner === 'red' ? game.options.redName : game.options.blueName;
  const victory = language === 'en' ? `Victory for ${displayPlayerName(winner, language)}` : winner === 'Gilda Rossa' || winner === 'Gilda Blu' ? `Vittoria della ${winner}` : `Vittoria di ${winner}`;
  const title = ownSide ? result.winner === ownSide ? (language === 'en' ? "You won!" : "Hai vinto!") : (language === 'en' ? "Your guild was defeated" : "La tua gilda è stata sconfitta") : victory;
  return <dialog ref={ref} className={`result-dialog ${result.winner}`} aria-labelledby="result-title" aria-describedby={chronicle.length ? undefined : 'result-explanation'} onClose={() => { setDismissed(true); setOpen(false); }}>
    <div className="result-body" tabIndex={0} role="region" aria-label={language === 'en' ? 'Duel result and chronicle' : 'Esito e cronaca del duello'}>
      <header className="result-heading">
        <p className="eyebrow">{(language === 'en' ? "Duel complete" : "Duello concluso")}</p>
        <h2 id="result-title">{title}</h2>
        {ownSide && <p className="result-winner"><span className={`seat-dot ${result.winner}`}/>{victory}</p>}
        <ul className="result-guilds" aria-label={language === 'en' ? 'Surviving mages' : 'Maghi superstiti'}>
          {(['red', 'blue'] as const).map(side => <li key={side}>
            <span className={`seat-dot ${side}`}/><span>{displayPlayerName(side === 'red' ? game.options.redName : game.options.blueName, language)}</span>
            <strong aria-label={`${count(game, side)} ${language === "en" ? "of 8 mages" : "maghi su 8"}`}>{count(game, side)}/8</strong>
          </li>)}
        </ul>
      </header>
      {!practice && <MatchAnalysis match={match} ownSide={ownSide} active={open} onPractice={onPractice}/>}
      {chronicle.length ? <section className="result-chronicle" aria-labelledby="result-chronicle-title">
        <h3 id="result-chronicle-title">{(language === 'en' ? "Duel chronicle" : "Cronaca del duello")}</h3>
        {chronicle.map((paragraph, index) => <p key={index}>{paragraph}</p>)}
      </section> : <p id="result-explanation">{presentationText(result.reason, language)}</p>}
    </div>
    <footer className="result-actions"><button autoFocus className="button primary" onClick={() => ref.current?.close()}>{(language === 'en' ? "View battlefield" : "Osserva il campo")}</button><button className="button secondary" onClick={() => { ref.current?.close(); home(); }}>{(practice ? language === 'en' ? "Return to original match" : "Torna alla partita originale" : language === 'en' ? "My matches" : "Le mie partite")}</button></footer>
  </dialog>;
}
