import { useMemo } from 'react';
import { KINDS } from '../engine/game';
import { mageGlossary } from '../i18n/glossary';
import type { Result } from './model';
import { styleAverage, stylePercent, styleSummary } from './style-study';

export function StyleResults({ results }: { results: Result[] }) {
  const series = useMemo(() => styleSummary(results), [results]);
  const games = series[0].games;
  const errors = results.filter(row => row.outcome === 'error').length;
  return <section className="lab-card lab-results">
    <h2>Confronto dello stile di gioco</h2>
    <p>{games} {games === 1 ? 'campo confrontabile' : 'campi confrontabili'} · {games * 4} partite incluse. Le statistiche entrano nel confronto quando tutte e quattro le regole sono state provate sullo stesso campo.</p>
    {errors > 0 && <p className="lab-notice">{errors} partite con errore. I relativi campi sono esclusi dal confronto.</p>}
    {games > 0 && <>
      <div className="lab-scroll"><table aria-label="Attivazioni e abilità per mago">
        <thead><tr><th scope="col">Mago</th>{series.map(row => <th key={row.id} scope="col">{row.name}</th>)}</tr></thead>
        <tbody>{KINDS.map(kind => <tr key={kind}><th scope="row">{mageGlossary.it[kind].name}</th>
          {series.map(row => {
            const mage = row.mages[kind];
            return <td key={row.id}><strong>{stylePercent(mage.main, row.main)}</strong> attivazioni
              <br/>{stylePercent(mage.spells, mage.main)} abilità
              <br/><span className="lab-muted">{mage.main} {mage.main === 1 ? 'attivazione' : 'attivazioni'} · {mage.spells} {mage.spells === 1 ? 'lancio' : 'lanci'}</span></td>;
          })}
        </tr>)}</tbody>
      </table></div>
      <p className="lab-muted">Le attivazioni sono la quota sul totale delle attivazioni principali delle due gilde. L’uso dell’abilità è la quota sulle attivazioni principali del singolo mago. Il passo extra è escluso.</p>
      <div className="lab-scroll"><table aria-label="Indicatori per variante">
        <thead><tr><th scope="col">Regole</th><th>Attivazioni a partita</th><th>Abilità sulle attivazioni</th><th>Passi Lamarcana per attivazione</th><th>Passaggi principali</th><th>Eliminazioni a partita</th><th>Vittorie rosso / blu</th><th>Al limite / ripetizioni</th></tr></thead>
        <tbody>{series.map(row => <tr key={row.id}><th scope="row">{row.name}</th>
          <td>{styleAverage(row.main, games)}</td><td>{stylePercent(row.spells, row.main)}</td>
          <td>{styleAverage(row.mages.spellsword.steps, row.mages.spellsword.main)}</td>
          <td>{row.passes}</td><td>{styleAverage(row.eliminated, games)}</td>
          <td>{row.red} / {row.blue}</td><td>{row.limits} / {row.repetitions}</td>
        </tr>)}</tbody>
      </table></div>
    </>}
  </section>;
}
