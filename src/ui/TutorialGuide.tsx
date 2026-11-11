import { mageGlossary } from '../i18n/glossary';
import { useLanguage } from '../i18n/language';
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

function guidance({ lesson, game, draft, mode, instruction, abilityAllowed }: GuideProps, english: boolean): string {
  if (lesson === 0) {
    if (draft?.spell) return (english ? "The numbers on the pieces show their health. Confirm to apply the hit and end your turn." : 'I numeri sulle pedine indicano i punti vita. Conferma per applicare il colpo e passare la mano.');
    if (mode === 'target') return (english ? "Select the Blue Geomancer. Arcane Blade strikes only orthogonally." : 'Seleziona il Geomante blu. Lama arcana colpisce solo sopra, sotto o di lato.');
    if (draft?.wizardId !== 'red:spellsword') return (english ? "Select the Red Spellsword on D3." : 'Seleziona la Lamarcana rossa in D3.');
    if (!abilityAllowed) return (english ? "Choose a highlighted square next to the Blue Geomancer. Each step is horizontal or vertical." : 'Scegli una casella evidenziata accanto al Geomante blu. Ogni passo va in orizzontale o in verticale.');
    return (english ? "Choose Use ability when you are next to the Blue Geomancer. With a mouse, you can also double-click your mage. You can edit the path before confirming." : 'Premi «Usa abilità» quando sei accanto al Geomante blu. Con il mouse puoi anche fare doppio clic sul tuo mago. Puoi correggere il percorso prima di confermare.');
  }
  if (lesson === 1) {
    if (game.phase === 2) return (english ? "The extra step is optional. Move a third mage one square without using an ability, or choose Skip extra step." : 'Il Passo extra è facoltativo. Muovi un terzo mago di una casella, senza usare poteri, oppure premi «Salta passo extra».');
    if (game.phase === 0) {
      if (mode === 'wind') return (english ? "Move the target up to two steps toward the other Blue mage. Try E5, then finish the ability." : 'Sposta il bersaglio fino a due passi per avvicinarlo all’altro mago blu. Prova E5, poi premi «Concludi abilità».');
      if (mode === 'target') return (english ? "Choose a highlighted Blue mage. For the guided route, choose the Geomancer on D5." : 'Scegli un mago blu evidenziato. Per il percorso guidato, scegli il Geomante in D5.');
      if (draft?.spell) return (english ? "When both targets are close together, choose Confirm activation." : 'Quando i due bersagli sono vicini, premi «Conferma attivazione».');
      return (english ? "Select the Red Aeromancer on D3 and choose Use ability." : 'Seleziona l’Aeromante rosso in D3 e premi «Usa abilità».');
    }
    if (mode === 'target') return (english ? "Choose the center. Fireball hits there and on the four adjacent squares. The preview should show two Blue mages taking damage." : 'Scegli il centro: il fuoco colpisce lì e nelle quattro caselle ai lati. L’anteprima deve mostrare due maghi blu feriti.');
    if (draft?.spell) return (english ? "Confirm when both Blue mages lose 1 HP. You can still undo activations while it is your turn." : 'Se entrambi i maghi blu perdono 1 PV, conferma. Puoi ancora annullare le attivazioni finché il turno è tuo.');
    return (english ? "Choose the Pyromancer for the second activation and prepare Fireball. The center must be visible and within two squares." : 'Scegli il Piromante per la seconda attivazione e prepara Palla di fuoco. Il centro deve essere visibile ed entro due caselle.');
  }
  return draft ? instruction : (english ? "Look for a Blue mage with low health. Open mage details to inspect them." : 'Cerca un mago blu con pochi punti vita. Puoi consultare i maghi con «Dettagli».');
}

function hint({ lesson, game, mode, draft }: GuideProps, english: boolean) {
  if (lesson === 0) {
    if (mode === 'target') return (english ? "Tap the Blue Geomancer on D6." : 'Tocca il Geomante blu in D6.');
    if (draft?.spell) return (english ? "Choose Confirm and end turn." : 'Premi «Conferma e passa turno».');
    return (english ? "With the Spellsword selected, choose D5, one square below the Geomancer. Then prepare Arcane Blade." : 'Con la Lamarcana selezionata, scegli D5, una casella sotto il Geomante. Poi prepara Lama arcana.');
  }
  if (lesson === 1) {
    if (game.phase === 0) return (english ? "Start with the Aeromancer on D3. Moving the Blue Geomancer from D5 to E5 is enough." : 'Parti dall’Aeromante in D3. Spostare il Geomante blu da D5 a E5 è sufficiente.');
    if (game.phase === 1) {
      const center = comboCenter(game);
      return center ? (english ? "From the Pyromancer’s starting square, aim at " : 'Dalla posizione iniziale del Piromante, mira a ') + square(center) + (english ? " to hit both targets." : ' per colpire entrambi i bersagli.') : (english ? "Look for a visible square where the Fireball cross reaches both targets." : 'Cerca una casella visibile dalla quale la croce di fuoco raggiunge entrambi i bersagli.');
    }
    return (english ? "You can skip this phase and complete the exercise." : 'Puoi saltare questa fase e completare la prova.');
  }
  const mage = wizard(game, 'red:spellsword');
  if (!mage || game.activated.includes(mage.id)) return (english ? "Undo the last confirmed activation or restart the exercise." : 'Puoi annullare l’ultima attivazione confermata o riprovare dalla posizione iniziale.');
  return (english ? "The Blue Geomancer on D6 starts with 2 HP. Try moving the Spellsword to D5 and striking with Arcane Blade." : 'Il Geomante blu in D6 parte con 2 PV. Prova a raggiungere D5 con la Lamarcana e colpiscilo con Lama arcana.');
}

export function TutorialGuide(props: GuideProps) {
  const { language } = useLanguage();
  const english = language === 'en';
  const { lesson, game, complete, playback, busy, retry, next, play, exit, error } = props;
  const continueButton = useRef<HTMLButtonElement>(null);
  useEffect(() => { if (complete && !playback) continueButton.current?.focus(); }, [complete, playback]);
  const [showHint, setShowHint] = useState(false);
  const [phase, setPhase] = useState(game.phase);
  if (phase !== game.phase) { setPhase(game.phase); setShowHint(false); }

  const damage = props.effects.filter(effect => effect.kind === 'damage');
  return <section className="tutorial-guide" aria-label={english ? 'Tutorial guide' : 'Guida del tutorial'}>
    <div aria-live="polite" aria-atomic="true">
      {playback ? <p>{(english ? "Watch the result on the board." : "Osserva l’esito sulla scacchiera.")}</p> : complete
        ? <p><strong>{lesson === 2 ? (english ? "Tutorial complete." : "Tutorial completato.") : (english ? "Exercise complete." : "Prova riuscita.")}</strong> {lesson === 0
          ? (english ? "Red opens with one activation. On normal turns you can activate two different mages." : "Il Rosso apre con una sola attivazione. Nei turni ordinari puoi attivare due maghi diversi.")
          : lesson === 1 ? (english ? "Gale brought the targets together and Fireball hit both." : "Il vento ha raggruppato i bersagli e la Palla di fuoco li ha colpiti insieme.")
          : (english ? "Blue has three mages left. You now know the basics of the duel." : "Hai lasciato il Blu con tre maghi. Ora conosci le basi del duello.")}</p>
        : <><p><strong>{lessons[lesson][language].goal}</strong></p><p>{guidance(props, english)}</p>{damage.length > 0 && <p className="tutorial-preview">{english ? 'Preview' : 'Anteprima'} · {damage.map(effect => {
          const mage = effect.wizardId ? wizard(game, effect.wizardId) : undefined;
          if (!english || !mage || effect.amount === undefined || effect.fromHp === undefined) return effect.text;
          const side = mage.side === 'red' ? 'Red' : 'Blue';
          return `${side} ${mageGlossary.en[mage.kind].name}: −${effect.amount} HP (${effect.fromHp} → ${Math.max(0, effect.fromHp - effect.amount)}).`;
        }).join(' ')}</p>}</>}
    </div>
    {!playback && <>
      <div className="tutorial-guide-actions">
        {complete && (lesson === 2
          ? <button ref={continueButton} className="button primary" disabled={busy} onClick={play ? () => void play() : exit}>{play ? (english ? "Play against the computer" : "Gioca contro il computer") : (english ? "Return to match" : "Torna alla partita")}</button>
          : <button ref={continueButton} className="button primary" onClick={next}>{(english ? "Next exercise" : "Prossima prova")}</button>)}
        {!complete && <button className="button secondary" aria-expanded={showHint} onClick={() => setShowHint(!showHint)}>{showHint ? (english ? "Hide hint" : "Nascondi indizio") : (english ? "Show hint" : "Mostra indizio")}</button>}
        <button className="button secondary" disabled={busy} onClick={retry}>{(english ? "Retry" : "Riprova")}</button>
      </div>
      {!complete && showHint && <p className="tutorial-hint" role="status">{hint(props, english)}</p>}
      {error && <p className="notice error" role="alert">{error}</p>}
    </>}
  </section>;
}
