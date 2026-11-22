import { useMemo, useState } from 'react';
import { KINDS, wizard, type Kind, type Match, type Side } from '../engine/game';
import { availableTurns, summarizeDuel } from '../engine/duel-recap';
import { mageGlossary } from '../i18n/glossary';
import { useLanguage } from '../i18n/language';

const sides = ['red', 'blue'] as const;
const metrics = ['full', 'extra', 'abilities'] as const;
const controlMetrics = ['restraints', 'charms', 'wind', 'teleport'] as const;
type Control = ReturnType<typeof summarizeDuel>['guilds'][Side]['applied'];
type Row = { label: string; values: readonly [string | number, string | number]; units?: string };
const pair = (ally = 0, enemy = 0) => `${ally} / ${enemy}`;
const bySide = <T,>(read: (side: Side) => T): [T, T] => [read('red'), read('blue')];

const labels = {
  it: {
    title: 'Recap tattico', red: 'Rosso', blue: 'Blu', full: 'Attivazioni complete', extra: 'Passi extra', abilities: 'Abilità usate',
    enemy: 'PV tolti ai nemici', friendly: 'PV tolti agli alleati',
    alliedLosses: 'Alleati eliminati', used: 'Turni di utilizzo / disponibili', available: 'Disponibile se in campo a inizio turno',
    dealt: 'PV tolti', lost: 'PV persi', to: 'agli alleati / ai nemici', from: 'da alleati / da nemici',
    applied: { restraints: 'Immobilizzazioni inflitte', charms: 'Ammaliamento per l’intero turno', wind: 'Spostamenti con Vento', teleport: 'Spostamenti con Teletrasporto' },
    received: { restraints: 'Immobilizzato dal Geomante', charms: 'Turni interi sotto ammaliamento', wind: 'Spostato dall’Aeromante', teleport: 'Spostato dal Teletrasportatore' },
    exchange: 'PV persi per turno', turn: 'Turno', damageTurns: 'Solo turni con perdite di PV', noDamage: 'Nessun PV perso.',
    missingCharm: 'I dati sull’ammaliamento sono incompleti per questo salvataggio.', state: 'Stato finale',
    comparison: 'Confronto tra gilde', mages: 'Impiego dei maghi', mage: 'Mago',
    short: ['Att.', 'Extra', 'Ab.'], hp: 'PV', eliminated: 'Eliminato al turno',
    missing: 'Statistiche tattiche non disponibili per questo salvataggio.',
  },
  en: {
    title: 'Tactical recap', red: 'Red', blue: 'Blue', full: 'Full activations', extra: 'Extra steps', abilities: 'Abilities used',
    enemy: 'Enemy HP lost', friendly: 'Allied HP lost',
    alliedLosses: 'Allies eliminated', used: 'Turns used / available', available: 'Available if on the board at turn start',
    dealt: 'HP dealt', lost: 'HP lost', to: 'to allies / to enemies', from: 'from allies / from enemies',
    applied: { restraints: 'Restraints applied', charms: 'Full turns of charm imposed', wind: 'Gale relocations', teleport: 'Teleport relocations' },
    received: { restraints: 'Restrained by Geomancer', charms: 'Full turns under charm', wind: 'Moved by Aeromancer', teleport: 'Moved by Teleporter' },
    exchange: 'HP lost per turn', turn: 'Turn', damageTurns: 'Only turns with HP loss', noDamage: 'No HP lost.',
    missingCharm: 'Charm data is incomplete for this save.', state: 'Final state',
    comparison: 'Guild comparison', mages: 'Mage usage', mage: 'Mage',
    short: ['Act.', 'Extra', 'Ab.'], hp: 'HP', eliminated: 'Eliminated on turn',
    missing: 'Tactical statistics are unavailable for this save.',
  },
};

export function DuelRecap({ match }: { match: Match }) {
  const { language } = useLanguage();
  const t = labels[language];
  const [expanded, setExpanded] = useState<Kind>();
  const [exchangeOpen, setExchangeOpen] = useState(false);
  const { game, recap } = match;
  const stats = useMemo(() => recap && summarizeDuel(recap), [recap]);
  if (!stats) return <p className="duel-recap-unavailable">{t.missing}</p>;

  const { guilds, mages, eliminated, charmTurns, damageByTurn } = stats;
  const hasCharmData = charmTurns.size === game.turn + 1;
  function controlRows(read: (side: Side) => Control | undefined, direction: 'applied' | 'received'): Row[] {
    return controlMetrics.flatMap((metric): Row[] => {
      if (metric === 'charms' && !hasCharmData) return [];
      const counts = bySide(side => read(side)?.[metric]);
      const label = t[direction][metric];
      if (metric === 'wind' || metric === 'teleport') {
        const moves = bySide(side => read(side)?.[metric]);
        if (!moves.some(value => value && (value.ally || value.enemy))) return [];
        return [{ label, units: direction === 'applied' ? t.to : t.from, values: bySide(side => {
          const move = read(side)?.[metric];
          return pair(move?.ally, move?.enemy);
        }) }];
      }
      if (!counts.some(Boolean)) return [];
      return [{ label, values: bySide(side => read(side)?.[metric] ?? 0) }];
    });
  }
  function mageRows(kind: Kind): Row[] {
    const read = (side: Side) => mages[`${side}:${kind}`];
    const rows: Row[] = [
      { label: t.used, units: t.available, values: bySide(side => {
        const id = `${side}:${kind}` as const;
        return pair(read(side)?.usedTurns, availableTurns(game, id, eliminated[id]));
      }) },
      { label: t.dealt, units: t.to, values: bySide(side => pair(read(side)?.friendly, read(side)?.enemy)) },
      { label: t.lost, units: t.from, values: bySide(side => pair(read(side)?.lost.ally, read(side)?.lost.enemy)) },
      ...controlRows(side => read(side)?.applied, 'applied'),
      ...controlRows(side => read(side)?.received, 'received'),
    ];
    if (sides.some(side => read(side)?.alliedLosses)) {
      rows.push({ label: t.alliedLosses, values: bySide(side => read(side)?.alliedLosses ?? 0) });
    }
    rows.push({ label: t.state, values: bySide(side => {
      const id = `${side}:${kind}` as const;
      const hp = wizard(game, id)?.hp, turn = eliminated[id];
      return turn !== undefined ? `${t.eliminated} ${turn}` : hp === undefined ? '—' : `${hp} ${t.hp}`;
    }) });
    return rows;
  }
  const comparison: Row[] = [
    ...(['enemy', 'friendly'] as const).map(metric => ({ label: t[metric], values: bySide(side => guilds[side][metric]) })),
    ...controlRows(side => guilds[side].applied, 'applied'),
  ];

  return <section className="duel-recap" aria-label={t.title}>
    <table className="duel-recap-comparison">
      <caption>{t.comparison}</caption>
      <RecapColumns red={t.red} blue={t.blue}/>
      <RecapRows rows={comparison}/>
    </table>
    {!hasCharmData && <small className="duel-recap-note">{t.missingCharm}</small>}

    <details className="duel-recap-exchange" onToggle={event => setExchangeOpen(event.currentTarget.open)}>
      <summary>{t.exchange}</summary>
      {exchangeOpen && (damageByTurn.size ? <>
        <small>{t.damageTurns}</small>
        <div className="duel-recap-turns" tabIndex={0} role="region" aria-label={t.exchange}>
          <table className="duel-recap-comparison">
            <RecapColumns red={t.red} blue={t.blue} label={t.turn}/>
            <RecapRows rows={Array.from(damageByTurn, ([turn, damage]) => ({
              label: String(turn), values: [damage.red, damage.blue],
            }))}/>
          </table>
        </div>
      </> : <p>{t.noDamage}</p>)}
    </details>

    <table className="duel-recap-mages">
      <caption>{t.mages}</caption>
      <thead>
        <tr><th rowSpan={2} scope="col">{t.mage}</th>{sides.map(side =>
          <th key={side} colSpan={3} scope="colgroup" className={`recap-${side}`}>{t[side]}</th>)}</tr>
        <tr>{sides.map(side => metrics.map((metric, i) =>
          <th key={side + metric} scope="col" aria-label={`${t[side]} · ${t[metric]}`}><abbr title={t[metric]}>{t.short[i]}</abbr></th>))}</tr>
      </thead>
      {KINDS.map(kind => <tbody key={kind}>
        <tr>
          <th scope="row"><button type="button" aria-expanded={expanded === kind} onClick={() => setExpanded(expanded === kind ? undefined : kind)}>
            <span className="duel-recap-chevron" aria-hidden="true"/>{mageGlossary[language][kind].name}
          </button></th>
          {sides.map(side => metrics.map(metric =>
            <td key={side + metric}>{mages[`${side}:${kind}`]?.[metric] ?? 0}</td>))}
        </tr>
        {expanded === kind && <tr><td className="duel-recap-details" colSpan={7}>
          <table className="duel-recap-comparison" aria-label={mageGlossary[language][kind].name}>
            <RecapColumns red={t.red} blue={t.blue}/>
            <RecapRows rows={mageRows(kind)}/>
          </table>
        </td></tr>}
      </tbody>)}
    </table>
  </section>;
}


function RecapColumns({ red, blue, label }: { red: string; blue: string; label?: string }) {
  return <thead><tr>
    <th scope="col">{label}</th><th scope="col" className="recap-red">{red}</th><th scope="col" className="recap-blue">{blue}</th>
  </tr></thead>;
}

function RecapRows({ rows }: { rows: Row[] }) {
  return <tbody>{rows.map(({ label, values, units }) => <tr key={label}>
    <th scope="row">{label}{units && <small>{units}</small>}</th>
    <td>{values[0]}</td><td>{values[1]}</td>
  </tr>)}</tbody>;
}
