import { useEffect, useState } from 'react';
import { analysisPositions, type AnalysisFinding } from '../ai/match-analysis';
import { square } from '../engine/geometry';
import { wizard, type Activation, type AnalysisPosition, type Game, type Match, type Side } from '../engine/game';
import { mageGlossary, type Language } from '../i18n/glossary';
import { useLanguage } from '../i18n/language';

function describe(game: Game, activation: Activation, language: Language) {
  const mage = wizard(game, activation.wizardId)!;
  const terms = mageGlossary[language];
  const name = (id: string) => {
    const target = wizard(game, id);
    return target ? terms[target.kind].name : id;
  };
  const parts = [terms[mage.kind].name];
  if (mage.pos) parts.push([mage.pos, ...activation.before].map(square).join(' → '));
  const spell = activation.spell;
  if (spell) {
    const target = 'targetId' in spell && spell.targetId ? name(spell.targetId) : '';
    const points = spell.kind === 'fireball' ? [spell.center] : spell.kind === 'teleport' ? [spell.destination] :
      spell.kind === 'wind' ? spell.path : spell.kind === 'illusion' ? [...(spell.summon ? [spell.summon] : []), ...spell.path] : [];
    parts.push([terms[mage.kind].ability, target, points.map(square).join(' → ')].filter(Boolean).join(' '));
  }
  if (activation.after.length) parts.push(activation.after.map(square).join(' → '));
  return parts.join(' · ');
}

export function MatchAnalysis({ match, ownSide, active, onPractice }: { match: Match; ownSide?: Side; active: boolean; onPractice: (position: AnalysisPosition) => void }) {
  const { language } = useLanguage(), en = language === 'en';
  const [side, setSide] = useState(ownSide ?? match.game.result!.loser);
  const [status, setStatus] = useState<'idle' | 'running' | 'empty' | 'error' | 'done'>('idle');
  const [finding, setFinding] = useState<AnalysisFinding | null>(null);
  const positions = analysisPositions(match);
  const available = positions.some(position => position.before.active === side);
  useEffect(() => {
    if (status !== 'running' || !active) return;
    let worker: Worker;
    try {
      worker = new Worker(new URL('../ai/analysis-worker.ts', import.meta.url), { type: 'module' });
    } catch {
      setStatus('error');
      return;
    }
    const timer = window.setTimeout(() => { worker.terminate(); setStatus('empty'); }, 60_000);
    worker.onmessage = ({ data }: MessageEvent<AnalysisFinding | null>) => {
      setFinding(data);
      setStatus(data ? 'done' : 'empty');
    };
    worker.onerror = () => setStatus('error');
    worker.postMessage({ positions: analysisPositions(match), side });
    return () => { window.clearTimeout(timer); worker.terminate(); };
  }, [status, active, match, side]);

  const running = status === 'running' && active;
  const game = finding?.position.before;
  const mage = finding && game ? wizard(game, finding.mageId) : undefined;
  const actualReply = finding?.historicalAttack;
  return <section className="result-chronicle match-analysis" aria-labelledby="match-analysis-title">
    <h3 id="match-analysis-title">{en ? 'Post-match analysis' : 'Analisi post-partita'}</h3>
    {!ownSide && <label>{en ? 'Guild to analyse' : 'Gilda da analizzare'} <select value={side} onChange={e => { setSide(e.target.value as Side); setStatus('idle'); setFinding(null); }}>
      <option value="red">{en ? 'Red' : 'Rossa'}</option><option value="blue">{en ? 'Blue' : 'Blu'}</option>
    </select></label>}
    {!available && <p>{en ? 'This save has no recorded positions for this guild.' : 'Questo salvataggio non contiene posizioni registrate per questa gilda.'}</p>}
    {available && !running && !finding && <button className="button secondary" onClick={() => setStatus('running')}>{en ? 'Analyse the match' : 'Analizza la partita'}</button>}
    {running && <><p role="status">{en ? 'Comparing moves. This can take up to a minute.' : 'Confronto le mosse. Potrebbe volerci fino a un minuto.'}</p><button className="button ghost" onClick={() => setStatus('idle')}>{en ? 'Cancel analysis' : 'Interrompi analisi'}</button></>}
    {status === 'empty' && <p role="status">{en ? 'The engine found no clear tactical improvement in the recorded positions it examined.' : 'Il motore non ha trovato un miglioramento tattico chiaro nelle posizioni registrate che ha esaminato.'}</p>}
    {status === 'error' && <p role="alert">{en ? 'Analysis could not be completed.' : 'Non è stato possibile completare l’analisi.'}</p>}
    {finding && game && mage && <div aria-live="polite">
      <h4>{en ? 'Turn' : 'Turno'} {game.turn + 1} · {en ? 'Activation' : 'Attivazione'} {game.phase + 1}</h4>
      <p><strong>{en ? 'Played' : 'Mossa giocata'}</strong> · {describe(game, finding.position.activation, language)}</p>
      <p><strong>{en ? 'Try' : 'Alternativa'}</strong> · {describe(game, finding.alternative, language)}</p>
      <p>{en ? 'In the lines the engine explored, this changes the remaining HP of ' : 'Nelle sequenze esplorate dal motore, cambiano i PV residui di '}{mageGlossary[language][mage.kind].name} ({mage.side === 'red' ? en ? 'Red' : 'Rosso' : en ? 'Blue' : 'Blu'}) {finding.playedHp} → {finding.suggestedHp}.</p>
      {actualReply && <p><strong>{en ? 'What your opponent did' : 'Come ha risposto l’avversario'}</strong> · {en ? 'Turn' : 'Turno'} {actualReply.position.before.turn + 1}, {describe(actualReply.position.before, actualReply.position.activation, language)}. {en ? 'HP lost by' : 'PV persi da'} {mageGlossary[language][wizard(actualReply.position.before, actualReply.mageId)!.kind].name}: {actualReply.damage}.</p>}
      <p>{finding.theme === 'survival' ? (en ? 'Before moving a wounded mage, check which enemies can reach its destination with an attack.' : 'Prima di spostare un mago ferito, controlla quali nemici possono attaccarlo nella casella di arrivo.') :
        finding.theme === 'elimination' ? (en ? 'Check whether a different mage or attack order can finish an exposed enemy.' : 'Controlla se cambiando mago o ordine degli attacchi puoi eliminare un nemico esposto.') :
        (en ? 'Compare the damage you deal with the damage the opponent can return.' : 'Confronta il danno che infliggi con quello che l’avversario può restituire.')}</p>
      <button className="button primary" onClick={() => onPractice(finding.position)}>{en ? 'Play from here' : 'Gioca da qui'}</button>
    </div>}
  </section>;
}
