import { useEffect, useState } from 'react';
import { analysisBudgetMs, analysisPositions, type AnalysisFinding } from '../ai/match-analysis';
import { activate, wizard, type AnalysisPosition, type Match, type Side } from '../engine/game';
import { presentActivation, type Presentation } from '../engine/presentation';
import { mageGlossary } from '../i18n/glossary';
import { useLanguage } from '../i18n/language';

type Request = { positions: AnalysisPosition[]; side: Side };
export type ReviewLine = 'historical' | 'suggested';

export function useMatchAnalysis() {
  const [open, setOpen] = useState(false);
  const [request, setRequest] = useState<Request | null>(null);
  const [findings, setFindings] = useState<AnalysisFinding[] | null>(null);
  const [index, setIndex] = useState(0);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!request) return;
    let worker: Worker;
    try {
      worker = new Worker(new URL('../ai/analysis-worker.ts', import.meta.url), { type: 'module' });
    } catch {
      setFailed(true);
      setRequest(null);
      return;
    }
    const timeout = window.setTimeout(() => { worker.terminate(); setFindings([]); setRequest(null); }, analysisBudgetMs);
    worker.onmessage = ({ data }: MessageEvent<AnalysisFinding[]>) => { setFindings(data); setRequest(null); };
    worker.onerror = () => { setFailed(true); setRequest(null); };
    worker.postMessage(request);
    return () => { window.clearTimeout(timeout); worker.terminate(); };
  }, [request]);

  function start(match: Match, side: Side) {
    const positions = analysisPositions(match);
    setOpen(true);
    setFailed(false);
    setFindings(null);
    setIndex(0);
    setRequest({ positions, side });
  }
  function close() { setRequest(null); setOpen(false); }
  return { open, start, close, running: Boolean(request), failed, findings, index, setIndex, finding: findings?.[index] };
}

export function reviewPresentation(finding: AnalysisFinding, line: ReviewLine): Presentation {
  const parts = finding[line].map(({ before, activation }, index) => {
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

function LoadingGrimoire() {
  const { language } = useLanguage();
  return <div className="analysis-loading" role="status">
    <span className="analysis-grimoire" aria-hidden="true"><span className="analysis-rune"/><span className="analysis-book"/></span>
    <span>{language === 'en' ? 'Loading…' : 'Caricamento…'}</span>
  </div>;
}

export function MatchAnalysis({ analysis, line, playing, onPlay, onSelect, onPractice, onPause, paused, onFinish, onReset }: {
  analysis: ReturnType<typeof useMatchAnalysis>; line?: ReviewLine; playing: boolean;
  onPlay: (line: ReviewLine) => void; onSelect: (index: number) => void;
  onPractice: (position: AnalysisPosition) => void; onPause: () => void;
  paused: boolean; onFinish: () => void; onReset: () => void;
}) {
  const { language } = useLanguage(), en = language === 'en';
  const { running, failed, finding, findings, index } = analysis;
  const before = finding?.position.before;
  const mage = before && finding ? wizard(before, finding.mageId) : undefined;
  const name = mage ? mageGlossary[language][mage.kind].name : '';
  const lesson = finding?.theme === 'survival'
    ? (en ? `Check which enemies could reach ${name} after the move.` : `Controlla quali nemici possono raggiungere ${name} dopo la mossa.`)
    : finding?.theme === 'elimination'
      ? (en ? `Watch how the alternative creates a chance to eliminate ${name}.` : `Osserva come l’alternativa crea l’occasione di eliminare ${name}.`)
      : (en ? `Watch how the two lines change ${name}’s health.` : `Osserva come cambiano i PV di ${name} nelle due sequenze.`);
  return <section className="card action-dock analysis-dock" aria-label={en ? 'Post-match analysis' : 'Analisi post-partita'}>
    {running ? <LoadingGrimoire/> : failed ? <p role="alert">{en ? 'Analysis could not be completed.' : 'Non è stato possibile completare l’analisi.'}</p> :
      finding && before && findings ? <>
        <h3 tabIndex={-1} data-analysis-heading>{en ? 'Turn' : 'Turno'} {before.turn + 1} · {before.phase === 2 ? en ? 'Extra step' : 'Passo extra' : `${en ? 'Activation' : 'Attivazione'} ${before.phase + 1}`}</h3>
        {findings.length > 1 && <nav className="analysis-lines" aria-label={en ? 'Moments to review' : 'Momenti da rivedere'}>
          {findings.map((item, i) => <button key={item.position.before.turn} className="button secondary" aria-current={i === index ? 'step' : undefined} onClick={() => onSelect(i)}>{en ? 'Moment' : 'Momento'} {i + 1}</button>)}
        </nav>}
        <p>{lesson}</p>
        <div className="analysis-lines">
          <button className="button secondary" aria-pressed={line === 'historical'} onClick={() => onPlay('historical')}>{en ? 'Move played' : 'Mossa giocata'}</button>
          <button className="button secondary" aria-pressed={line === 'suggested'} onClick={() => onPlay('suggested')}>{en ? 'Alternative' : 'Alternativa'}</button>
        </div>
        {line && <p className="fine-print">{line === 'historical' ? (en ? 'Actual match sequence' : 'Sequenza della partita') : (en ? 'Sequence simulated by the engine' : 'Sequenza simulata dal motore')}</p>}
        {line && <div className="analysis-lines">
          {playing && <><button className="button ghost" onClick={onPause}>{paused ? (en ? 'Resume' : 'Riprendi') : (en ? 'Pause' : 'Pausa')}</button>
            <button className="button ghost" onClick={onFinish}>{en ? 'Show outcome' : 'Mostra esito'}</button></>}
          <button className="button ghost" onClick={onReset}>{en ? 'Starting position' : 'Posizione iniziale'}</button>
        </div>}
        <button className="button primary" onClick={() => onPractice(finding.position)}>{en ? 'Play from here' : 'Gioca da qui'}</button>
      </> : <p role="status">{en ? 'The engine found no clear tactical improvement in the recorded positions.' : 'Il motore non ha trovato un miglioramento tattico chiaro nelle posizioni registrate.'}</p>}
    <button className="button ghost" onClick={analysis.close}>{running ? (en ? 'Cancel' : 'Annulla') : (en ? 'Back to the match' : 'Torna al duello')}</button>
  </section>;
}
