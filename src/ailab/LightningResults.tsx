import { lightningModes, lightningStudy, type SearchRun } from './autotune';
import { initialGame } from './model';
import { square } from '../engine/geometry';
import type { LightningStats } from './simulation';

const rate = new Intl.NumberFormat('it-IT', { style: 'percent', maximumFractionDigits: 1 });

function share(used: number, total: number) {
  return total ? `${used}/${total} (${rate.format(used / total)})` : '—';
}

const measures: { label: string; read: (stats: LightningStats) => string | number }[] = [
  { label: 'Attivazioni principali dell’Elettromante', read: s => share(s.electromancerMain, s.main) },
  { label: 'Semiattivazioni dell’Elettromante', read: s => share(s.electromancerExtra, s.extra) },
  { label: 'Scariche a catena', read: s => s.casts },
  { label: 'PV tolti ai nemici', read: s => s.enemyDamage },
  { label: 'PV tolti agli alleati', read: s => s.allyDamage },
  { label: 'Nemici eliminati', read: s => s.enemyKills },
  { label: 'Alleati eliminati', read: s => s.allyKills },
];

export function LightningResults({ run }: { run: SearchRun }) {
  const stats = lightningStudy(run);
  const trial = run.config.lightning!;
  const fields = new Map(run.fields.screening.map(field => [field.seed, initialGame(field).walls.map(square).join('–')]));
  const reference = run.config.reference?.toUpperCase() ?? 'Riferimento';

  return <section className="lab-card lab-results">
    <h2>Risultati dell’esperimento Elettromante</h2>
    <p>{reference} con bonus {trial.bonus}% · {lightningModes[trial.mode ?? 'opportunity']} · {trial.sample === 'pilot' ? 'Campi pilota' : 'Campi di riserva'} · {stats.fields}/{trial.fields} coppie complete</p>
    {stats.fields > 0 && <>
      <p><strong>{stats.wins} vittorie · {stats.losses} sconfitte · {stats.limits + stats.repetitions} inconcluse</strong> per la variante.
        {' '}{stats.positiveFields} campi a saldo positivo, {stats.evenFields} a saldo zero e {stats.negativeFields} a saldo negativo.</p>
      {stats.measuredFields > 0 && <div className="lab-scroll"><table aria-label="Uso dell’Elettromante">
        <thead><tr><th scope="col">Indicatore</th><th scope="col">Variante +{trial.bonus}%</th><th scope="col">{reference}</th></tr></thead>
        <tbody>{measures.map(({ label, read }) => <tr key={label}>
          <th scope="row">{label}</th><td>{read(stats.candidate)}</td><td>{read(stats.reference)}</td>
        </tr>)}</tbody>
      </table></div>}
      <p className="lab-muted">Le statistiche usano solo coppie complete. Le quote sono calcolate sulle attivazioni della stessa gilda.
        {' '}I PV persi e le eliminazioni indicati provengono da Scarica a catena.</p>
    </>}
    {run.results.length > 0 && <details><summary>Singole partite</summary>
      <div className="lab-scroll"><table aria-label="Partite dell’esperimento Elettromante">
        <thead><tr><th>Campo</th><th>Colore della variante</th><th>Esito della variante</th><th>Scariche variante</th><th>Scariche riferimento</th></tr></thead>
        <tbody>{run.results.map(row => {
          const other = row.candidateSide === 'red' ? 'blue' : 'red';
          const outcome = row.outcome === row.candidateSide ? 'Vittoria' : row.outcome === other ? 'Sconfitta'
            : row.outcome === 'limit' ? 'Limite comandi' : 'Ripetizione';
          return <tr key={row.id}><td>{fields.get(row.seed)}</td><td>{row.candidateSide === 'red' ? 'Rosso' : 'Blu'}</td>
            <td>{outcome}</td><td>{row.lightning?.[row.candidateSide].casts ?? '—'}</td><td>{row.lightning?.[other].casts ?? '—'}</td></tr>;
        })}</tbody>
      </table></div>
    </details>}
  </section>;
}
