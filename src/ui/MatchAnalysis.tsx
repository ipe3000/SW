import { useEffect, useState } from 'react';
import { scanBudgetMs, suggestionBudgetMs, analysisPositions, type AnalysisFinding, type AnalysisMoment, type AnalysisRequest, type AnalysisResponse } from '../ai/match-analysis';
import { activate, wizard, type AnalysisPosition, type Match, type Side } from '../engine/game';
import { presentActivation, type Presentation } from '../engine/presentation';
import { mageGlossary } from '../i18n/glossary';
import { useLanguage } from '../i18n/language';

export type ReviewLine = 'historical' | 'suggested';

function runAnalysis(request: AnalysisRequest, receive: (response: AnalysisResponse) => void, failed: () => void) {
  let worker: Worker;
  try {
    worker = new Worker(new URL('../ai/analysis-worker.ts', import.meta.url), { type: 'module' });
  } catch {
    failed();
    return;
  }
  const budget = request.kind === 'scan' ? scanBudgetMs : suggestionBudgetMs;
  const timer = window.setTimeout(() => { worker.terminate(); failed(); }, budget);
  worker.onmessage = ({ data }: MessageEvent<AnalysisResponse>) => receive(data);
  worker.onerror = failed;
  worker.postMessage(request);
  return () => { window.clearTimeout(timer); worker.terminate(); };
}

export function useMatchAnalysis() {
  const [open, setOpen] = useState(false);
  const [request, setRequest] = useState<Extract<AnalysisRequest, { kind: 'scan' }> | null>(null);
  const [moments, setMoments] = useState<AnalysisMoment[] | null>(null);
  const [suggestions, setSuggestions] = useState<Record<number, AnalysisFinding | null>>({});
  const [key, setKey] = useState('');
  const [side, setSide] = useState<Side>('red');
  const [index, setIndex] = useState(0);
  const [failed, setFailed] = useState(false);
  const moment = moments?.[index];
  const suggestion = suggestions[index];

  useEffect(() => {
    if (!open || !request) return;
    return runAnalysis(request, response => {
      if (response.kind !== 'scan') return;
      setMoments(response.moments);
      setRequest(null);
    }, () => { setFailed(true); setRequest(null); });
  }, [open, request]);

  useEffect(() => {
    if (!open || !moment || suggestion !== undefined) return;
    function finish(result: AnalysisFinding | null) {
      setSuggestions(previous => ({ ...previous, [index]: result }));
    }
    return runAnalysis({ kind: 'suggest', moment }, response => {
      if (response.kind === 'suggest') finish(response.suggestion);
    }, () => finish(null));
  }, [open, moment, suggestion, index]);

  function start(match: Match, side: Side) {
    const matchKey = match.game.id + ':' + match.revision + ':' + side;
    setOpen(true);
    setSide(side);
    setFailed(false);
    if (key === matchKey && moments) return;
    setKey(matchKey);
    setMoments(null);
    setSuggestions({});
    setIndex(0);
    setRequest({ kind: 'scan', positions: analysisPositions(match), side });
  }
  function close() { setRequest(null); setOpen(false); }
  return { open, start, close, side, running: Boolean(request), failed, moments, index, setIndex, moment, suggestion };
}

export function reviewPresentation(positions: AnalysisPosition[]): Presentation {
  const parts = positions.map(({ before, activation }, index) => {
    const after = activate(before, activation, true);
    return presentActivation(before, after, activation, index);
  });
  return { ...parts[0], frames: parts.flatMap(part => part.frames), summary: parts.flatMap(part => part.summary) };
}

export function AnalysisEntry({ match, ownSide, onStart }: { match: Match; ownSide?: Side; onStart: (side: Side) => void }) {
  const { language } = useLanguage(), en = language === 'en';
  const [side, setSide] = useState(ownSide ?? match.game.result!.loser);
  const available = analysisPositions(match).some(position => position.before.active === side);
  return <section className="result-chronicle match-analysis" aria-labelledby="match-analysis-title">
    <h3 id="match-analysis-title">{en ? 'Post-match analysis' : 'Analisi post-partita'}</h3>
    {!ownSide && <label>{en ? 'Guild to analyse' : 'Gilda da analizzare'} <select value={side} onChange={e => setSide(e.target.value as Side)}>
      <option value="red">{en ? 'Red' : 'Rossa'}</option><option value="blue">{en ? 'Blue' : 'Blu'}</option>
    </select></label>}
    {available ? <button className="button secondary" onClick={() => onStart(side)}>{en ? 'Analyse the match' : 'Analizza la partita'}</button> :
      <p>{en ? 'This save has no recorded positions for this guild.' : 'Questo salvataggio non contiene posizioni registrate per questa gilda.'}</p>}
  </section>;
}

function LoadingGrimoire({ budget }: { budget: number }) {
  const { language } = useLanguage();
  const [percent, setPercent] = useState(0);
  useEffect(() => {
    const start = performance.now();
    const timer = window.setInterval(() => {
      const elapsed = (performance.now() - start) / budget;
      const displayed = elapsed < .55 ? elapsed / .55 * 90 : 90 + (elapsed - .55) / .45 * 10;
      setPercent(Math.min(99, Math.floor(displayed)));
    }, 150);
    return () => window.clearInterval(timer);
  }, [budget]);
  const label = language === 'en' ? 'Loading…' : 'Caricamento…';
  return <div className="analysis-loading">
    <span className="analysis-grimoire" aria-hidden="true"><img alt="" src={`${import.meta.env.BASE_URL}assets/analysis-grimoire.webp`}/></span>
    <span role="status">{label}</span><span role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}>{percent}%</span>
  </div>;
}

export function MatchAnalysis({ analysis, line, playing, onPlay, onSelect, onPractice, onPause, paused, onFinish, onReset }: {
  analysis: ReturnType<typeof useMatchAnalysis>; line?: ReviewLine; playing: boolean;
  onPlay: (line: ReviewLine) => void; onSelect: (index: number) => void;
  onPractice: (position: AnalysisPosition) => void; onPause: () => void;
  paused: boolean; onFinish: () => void; onReset: () => void;
}) {
  const { language } = useLanguage(), en = language === 'en';
  const { running, failed, moment, moments, suggestion, index } = analysis;
  const before = moment?.position.before;
  const mage = before && suggestion ? wizard(before, suggestion.mageId) : undefined;
  const name = mage ? mageGlossary[language][mage.kind].name : '';
  const guild = analysis.side === 'red' ? (en ? 'Red Guild' : 'Gilda Rossa') : (en ? 'Blue Guild' : 'Gilda Blu');
  const targetGuild = mage?.side === 'red' ? (en ? 'Red' : 'Rosso') : (en ? 'Blue' : 'Blu');
  const lesson = suggestion && mage
    ? en
      ? `Engine simulation · ${name} (${targetGuild}) ends with ${suggestion.playedHp} HP after the move played and ${suggestion.suggestedHp} HP after the suggested move.`
      : `Simulazione del motore · ${name} (${targetGuild}) chiude con ${suggestion.playedHp} PV dopo la mossa giocata e ${suggestion.suggestedHp} PV dopo quella suggerita.`
    : null;
  return <section className="card action-dock analysis-dock" aria-label={en ? 'Post-match analysis' : 'Analisi post-partita'}>
    <p className="analysis-perspective"><span className={`seat-dot ${analysis.side}`} aria-hidden="true"/>{en ? 'Analysing for' : 'Analisi per'} <strong>{guild}</strong></p>
    {running ? <LoadingGrimoire key="scan" budget={scanBudgetMs}/> : failed ? <p role="alert">{en ? 'Analysis could not be completed.' : 'Non è stato possibile completare l’analisi.'}</p> :
      moment && before && moments ? <>
        <h3 tabIndex={-1} data-analysis-heading>{en ? 'Turn' : 'Turno'} {before.turn + 1} · {before.phase === 2 ? en ? 'Extra step' : 'Passo extra' : `${en ? 'Activation' : 'Attivazione'} ${before.phase + 1}`}</h3>
        {moments.length > 1 && <nav className="analysis-lines" aria-label={en ? 'Moments to review' : 'Momenti da rivedere'}>
          {moments.map((item, i) => <button key={item.position.before.turn} className="button secondary" aria-current={i === index ? 'step' : undefined} onClick={() => onSelect(i)}>{en ? 'Moment' : 'Momento'} {i + 1}</button>)}
        </nav>}
        {suggestion ? <p>{lesson}</p> : suggestion === null ? <p role="status">{en ? 'The engine found no clear improvement after checking the opponent’s replies.' : 'Il motore non ha trovato un miglioramento chiaro dopo aver verificato le risposte avversarie.'}</p> :
          <LoadingGrimoire key={index} budget={suggestionBudgetMs}/>}
        <div className="analysis-lines">
          <button className="button secondary" aria-pressed={line === 'historical'} onClick={() => onPlay('historical')}>{en ? 'Move played' : 'Mossa giocata'}</button>
          <button className="button secondary" aria-pressed={line === 'suggested'} disabled={!suggestion} onClick={() => onPlay('suggested')}>{en ? 'Suggested move' : 'Mossa suggerita'}</button>
        </div>
        {line && <p className="fine-print">{line === 'historical' ? (en ? 'Actual match sequence' : 'Sequenza della partita') : (en ? 'Sequence simulated by the engine' : 'Sequenza simulata dal motore')}</p>}
        {line && <div className="analysis-lines">
          {playing && <><button className="button ghost" onClick={onPause}>{paused ? (en ? 'Resume' : 'Riprendi') : (en ? 'Pause' : 'Pausa')}</button>
            <button className="button ghost" onClick={onFinish}>{en ? 'Show outcome' : 'Mostra esito'}</button></>}
          <button className="button ghost" onClick={onReset}>{en ? 'Starting position' : 'Posizione iniziale'}</button>
        </div>}
        <button className="button primary" onClick={() => onPractice(moment.position)}>{en ? 'Play from here' : 'Gioca da qui'}</button>
      </> : <p role="status">{en ? 'The engine found no clear tactical improvement in the recorded positions.' : 'Il motore non ha trovato un miglioramento tattico chiaro nelle posizioni registrate.'}</p>}
    <button className="button ghost" onClick={analysis.close}>{running ? (en ? 'Cancel' : 'Annulla') : (en ? 'Back to the match' : 'Torna al duello')}</button>
  </section>;
}
