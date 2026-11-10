import { useEffect, useRef, useState } from 'react';
import { wizard, type Activation, type Effect, type Game } from '../engine/game';
import { square } from '../engine/geometry';
import { comboCenter, lessons, type Lesson } from './tutorial-lessons';

export type TutorialControls = {
  lesson: Lesson;
  retry: () => void;
  next: () => void;
  play?: () => Promise<void>;
  exit: () => void;
  error: string;
};

type GuideProps = TutorialControls & {
  game: Game;
  draft: Activation | null;
  mode: string;
  instruction: string;
  abilityAllowed: boolean;
  effects: Effect[];
  playback: boolean;
  complete: boolean;
  busy: boolean;
};

function guidance({ lesson, game, draft, mode, instruction, abilityAllowed }: GuideProps): string {
  if (lesson === 0) {
    if (draft?.spell) return 'I numeri sulle pedine indicano i punti vita. Conferma per applicare il colpo e passare la mano.';
    if (mode === 'target') return 'Seleziona il Geomante blu. Lama arcana colpisce solo sopra, sotto o di lato.';
    if (draft?.wizardId !== 'red:spellsword') return 'Seleziona la Lamarcana rossa in D3.';
    if (!abilityAllowed) return 'Scegli una casella evidenziata accanto al Geomante blu. Ogni passo va in orizzontale o in verticale.';
    return 'Premi «Prepara abilità» quando sei accanto al Geomante blu. Puoi correggere il percorso prima di confermare.';
  }
  if (lesson === 1) {
    if (game.phase === 2) return 'Il Passo extra è facoltativo. Muovi un terzo mago di una casella, senza usare poteri, oppure premi «Salta passo extra».';
    if (game.phase === 0) {
      if (mode === 'wind') return 'Sposta il bersaglio fino a due passi per avvicinarlo all’altro mago blu. Prova E5, poi premi «Concludi abilità».';
      if (mode === 'target') return 'Scegli un mago blu evidenziato. Per il percorso guidato, scegli il Geomante in D5.';
      if (draft?.spell) return 'Quando i due bersagli sono vicini, premi «Conferma attivazione».';
      return 'Seleziona l’Aeromante rosso in D3 e premi «Prepara abilità».';
    }
    if (mode === 'target') return 'Scegli il centro: il fuoco colpisce lì e nelle quattro caselle ai lati. L’anteprima deve mostrare due maghi blu feriti.';
    if (draft?.spell) return 'Se entrambi i maghi blu perdono 1 PV, conferma. Puoi ancora annullare le attivazioni finché il turno è tuo.';
    return 'Scegli il Piromante per la seconda attivazione e prepara Palla di fuoco. Il centro deve essere visibile ed entro due caselle.';
  }
  return draft ? instruction : 'Cerca un mago blu con pochi punti vita. Puoi consultare i maghi con «Dettagli».';
}

function hint({ lesson, game, mode, draft }: GuideProps) {
  if (lesson === 0) {
    if (mode === 'target') return 'Tocca il Geomante blu in D6.';
    if (draft?.spell) return 'Premi «Conferma e passa turno».';
    return 'Con la Lamarcana selezionata, scegli D5, una casella sotto il Geomante. Poi prepara Lama arcana.';
  }
  if (lesson === 1) {
    if (game.phase === 0) return 'Parti dall’Aeromante in D3. Spostare il Geomante blu da D5 a E5 è sufficiente.';
    if (game.phase === 1) {
      const center = comboCenter(game);
      return center ? 'Dalla posizione iniziale del Piromante, mira a ' + square(center) + ' per colpire entrambi i bersagli.' : 'Cerca una casella visibile dalla quale la croce di fuoco raggiunge entrambi i bersagli.';
    }
    return 'Puoi saltare questa fase e completare la prova.';
  }
  const mage = wizard(game, 'red:spellsword');
  if (!mage || game.activated.includes(mage.id)) return 'Puoi annullare l’ultima attivazione confermata o riprovare dalla posizione iniziale.';
  return 'Il Geomante blu in D6 parte con 2 PV. Prova a raggiungere D5 con la Lamarcana e colpiscilo con Lama arcana.';
}

export function TutorialGuide(props: GuideProps) {
  const { lesson, game, complete, playback, busy, retry, next, play, exit, error } = props;
  const continueButton = useRef<HTMLButtonElement>(null);
  useEffect(() => { if (complete && !playback) continueButton.current?.focus(); }, [complete, playback]);
  const [showHint, setShowHint] = useState(false);
  const [phase, setPhase] = useState(game.phase);
  if (phase !== game.phase) { setPhase(game.phase); setShowHint(false); }

  const damage = props.effects.filter(effect => effect.kind === 'damage');
  return <section className="tutorial-guide" aria-label="Guida del tutorial">
    <div aria-live="polite" aria-atomic="true">
      {playback ? <p>Osserva l’esito sulla scacchiera.</p> : complete
        ? <p><strong>{lesson === 2 ? 'Tutorial completato.' : 'Prova riuscita.'}</strong> {lesson === 0
          ? 'Il Rosso apre con una sola attivazione. Nei turni ordinari puoi attivare due maghi diversi.'
          : lesson === 1 ? 'Il vento ha raggruppato i bersagli e la Palla di fuoco li ha colpiti insieme.'
          : 'Hai lasciato il Blu con tre maghi. Ora conosci le basi del duello.'}</p>
        : <><p><strong>{lessons[lesson].goal}</strong></p><p>{guidance(props)}</p>{damage.length > 0 && <p className="tutorial-preview">Anteprima · {damage.map(effect => effect.text).join(' ')}</p>}</>}
    </div>
    {!playback && <>
      <div className="tutorial-guide-actions">
        {complete && (lesson === 2
          ? <button ref={continueButton} className="button primary" disabled={busy} onClick={play ? () => void play() : exit}>{play ? 'Gioca contro il computer' : 'Torna alla partita'}</button>
          : <button ref={continueButton} className="button primary" onClick={next}>Prossima prova</button>)}
        {!complete && <button className="button secondary" aria-expanded={showHint} onClick={() => setShowHint(!showHint)}>{showHint ? 'Nascondi indizio' : 'Mostra indizio'}</button>}
        <button className="button secondary" disabled={busy} onClick={retry}>Riprova</button>
      </div>
      {!complete && showHint && <p className="tutorial-hint" role="status">{hint(props)}</p>}
      {error && <p className="notice error" role="alert">{error}</p>}
    </>}
  </section>;
}
